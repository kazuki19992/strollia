import ExpoModulesCore
import Photos
import UIKit

/**
 * 結果ハンドラが複数回呼ばれても、Promise の解決を1回だけに制限するためのフラグ。
 *
 * `PHImageRequestOptions.deliveryMode` の設定で結果ハンドラは1回しか呼ばれない想定だが、
 * Promise を二重解決すると JS 側で例外になる。ここは Photos 側の挙動に依存させず、
 * 呼び出し側で確実に1回へ寄せる保険として持つ。結果ハンドラの呼び出しキューは保証されないため、
 * ロックで直列化する。
 */
private final class ResolveOnceFlag: @unchecked Sendable {
  private let lock = NSLock()
  private var isResolved = false

  /**
   * まだ解決していなければ true を返し、以降の呼び出しには false を返す。
   */
  func acquire() -> Bool {
    lock.lock()
    defer { lock.unlock() }

    if isResolved {
      return false
    }

    isResolved = true
    return true
  }
}

/**
 * 写真ライブラリのサムネイルだけを取り出す iOS 専用モジュール。
 *
 * `expo-media-library` の `getUri()` や `expo-file-system` の `ph://` コピーは、いずれも
 * **オリジナル本体**(`fullSizeImageURL` / `PHAssetResource`)を要求する。
 * 「iPhoneのストレージを最適化」でオリジナルが iCloud へ退避された写真では、これらは nil になり
 * 地図上のマーカーに何も表示できない。`PHImageManager.requestImage` はオリジナルが端末に無くても
 * ローカルのサムネイルを返せるため、写真アプリと同じ経路でサムネイルだけを取得する。
 */
public class PhotoThumbnailModule: Module {
  /** `photo_assets` に保存している iOS のフォトライブラリURIの接頭辞。 */
  private static let photoLibraryUriScheme = "ph://"

  /**
   * サムネイルの書き出し先ディレクトリ名。
   *
   * `Library/Caches` 配下に置く。容量が逼迫したときに OS が消してよいデータであり、
   * 消えても次回の要求で作り直せる(JS 側もパスを永続化しない)。
   */
  private static let thumbnailDirectoryName = "StrolliaPhotoThumbnails"

  /** JPEG の圧縮品質。マーカー表示に十分な画質を保ちつつ、キャッシュ容量を抑える。 */
  private static let jpegCompressionQuality: CGFloat = 0.8

  public func definition() -> ModuleDefinition {
    Name("PhotoThumbnail")

    AsyncFunction("getPhotoThumbnailAsync") { (assetId: String, size: Double, promise: Promise) in
      Self.requestThumbnail(assetId: assetId, size: size, promise: promise)
    }
  }

  /**
   * アセットのサムネイルを書き出し、その `file://` パスで Promise を解決する。
   *
   * 取得できない場合(アセットが見つからない・ローカルにサムネイルが無い・書き出しに失敗した)は
   * **例外を投げず null で解決する**。呼び出し側が「その写真は画像なしで扱う」と判断できるようにするため。
   *
   * @param assetId `ph://<localIdentifier>` 形式のアセットURI。
   * @param size 要求するサムネイルの一辺のピクセル数。
   * @param promise 解決先の Promise。
   */
  private static func requestThumbnail(assetId: String, size: Double, promise: Promise) {
    let localIdentifier = assetId.hasPrefix(photoLibraryUriScheme)
      ? String(assetId.dropFirst(photoLibraryUriScheme.count))
      : assetId

    guard !localIdentifier.isEmpty, size > 0 else {
      promise.resolve()
      return
    }

    guard let destinationUrl = thumbnailFileUrl(localIdentifier: localIdentifier, size: size) else {
      promise.resolve()
      return
    }

    // 同じ assetId と size なら常に同じパスになるため、書き出し済みならそのまま使い回す。
    // 地図のパン・ズームで解決要求が繰り返されても、デコードと書き出しを再実行しない
    if FileManager.default.fileExists(atPath: destinationUrl.path) {
      promise.resolve(destinationUrl.absoluteString)
      return
    }

    // 権限が無い場合や削除済みの場合は空の結果になる。例外にはならない
    guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [localIdentifier], options: nil).firstObject else {
      promise.resolve()
      return
    }

    let options = PHImageRequestOptions()
    // iCloud からのダウンロードは行わない。ローカルに残っているサムネイルだけを使う。
    // true にすると通信・待ち時間・App Hang のリスクをすべて負い直すことになるため、
    // ここは本モジュールの設計上の肝であり変更しない(設計書 §4.2)
    options.isNetworkAccessAllowed = false
    // .opportunistic は結果ハンドラが複数回呼ばれ Promise の二重解決になるため使わない。
    // .fastFormat は結果ハンドラが必ず1回だけ呼ばれ、かつ「すぐ用意できる表現」を返すので、
    // ローカルのサムネイルを取りに行く本用途に合う
    options.deliveryMode = .fastFormat
    options.resizeMode = .fast
    options.isSynchronous = false

    let resolveOnce = ResolveOnceFlag()

    PHImageManager.default().requestImage(
      for: asset,
      targetSize: CGSize(width: size, height: size),
      contentMode: .aspectFill,
      options: options
    ) { image, _ in
      guard resolveOnce.acquire() else {
        return
      }

      guard let image else {
        promise.resolve()
        return
      }

      // 結果ハンドラはメインキューで呼ばれうる。JPEG エンコードとファイル書き出しをそのまま行うと
      // メインスレッドを止めて App Hang になるため、別キューへ逃がす
      DispatchQueue.global(qos: .utility).async {
        if let thumbnailUri = writeThumbnail(image: image, to: destinationUrl) {
          promise.resolve(thumbnailUri)
        } else {
          promise.resolve()
        }
      }
    }
  }

  /**
   * サムネイルの書き出し先URLを、アセットと要求サイズから決定的に導く。
   *
   * `localIdentifier` は `XXXXXXXX-…/L0/001` のようにスラッシュを含みそのままファイル名にできないため、
   * 英数字以外を `-` へ置き換える。置換は決定的なので、同じ要求からは常に同じパスが得られる。
   *
   * @param localIdentifier `PHAsset.localIdentifier`。
   * @param size 要求するサムネイルの一辺のピクセル数。
   * @return 書き出し先URL。キャッシュディレクトリを取得できない場合は nil。
   */
  private static func thumbnailFileUrl(localIdentifier: String, size: Double) -> URL? {
    guard let cachesUrl = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
      return nil
    }

    let safeIdentifier = String(localIdentifier.map { $0.isLetter || $0.isNumber ? $0 : "-" })

    return cachesUrl
      .appendingPathComponent(thumbnailDirectoryName, isDirectory: true)
      .appendingPathComponent("\(safeIdentifier)-\(Int(size)).jpg")
  }

  /**
   * サムネイル画像を JPEG としてキャッシュディレクトリへ書き出す。
   *
   * @param image 書き出す画像。
   * @param destinationUrl 書き出し先URL。
   * @return 書き出せた場合は `file://` パス。失敗した場合は nil。
   */
  private static func writeThumbnail(image: UIImage, to destinationUrl: URL) -> String? {
    guard let jpegData = image.jpegData(compressionQuality: jpegCompressionQuality) else {
      return nil
    }

    do {
      try FileManager.default.createDirectory(
        at: destinationUrl.deletingLastPathComponent(),
        withIntermediateDirectories: true
      )
      // 途中まで書けたファイルを <Image> に読ませないため、原子的に置き換える
      try jpegData.write(to: destinationUrl, options: .atomic)

      return destinationUrl.absoluteString
    } catch {
      return nil
    }
  }
}
