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
 *
 * 公開するのは2つの関数だけである。
 *
 * - `getPhotoThumbnailAsync` — 地図マーカー用。**通信しない**(`isNetworkAccessAllowed = false`)
 * - `getPhotoPreviewAsync` — 拡大表示用。**ここだけ通信を許可する**(`isNetworkAccessAllowed = true`)
 *
 * 通信を許すのを拡大表示だけに限るのは、地図描画中に通信が走ると通信量と App Hang の問題が
 * 再発するためである。拡大表示は「ユーザーが写真を明示的にタップした」ときにしか走らない。
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

  /**
   * 拡大表示用画像の JPEG 圧縮品質。
   *
   * 全画面に引き伸ばして見る画像なので、マーカー用サムネイルより高い品質を使う。
   * 拡大表示は1枚ずつしか作らないため、容量への影響も限定的である。
   */
  private static let previewJpegCompressionQuality: CGFloat = 0.9

  public func definition() -> ModuleDefinition {
    Name("PhotoThumbnail")

    AsyncFunction("getPhotoThumbnailAsync") { (assetId: String, size: Double, promise: Promise) in
      Self.requestImage(assetId: assetId, size: size, variant: .thumbnail, promise: promise)
    }

    AsyncFunction("getPhotoPreviewAsync") { (assetId: String, size: Double, promise: Promise) in
      Self.requestImage(assetId: assetId, size: size, variant: .preview, promise: promise)
    }

    AsyncFunction("isPhotoAssetAvailableAsync") { (assetId: String) -> Bool in
      Self.isAssetAvailable(assetId: assetId)
    }
  }

  /**
   * 写真ライブラリにアセットが存在するかを返す。
   *
   * 画像を取得できない原因が「削除された」のか「iCloudにあり端末に本体が無い」のかを区別するために使う。
   * `PHAsset.fetchAssets(withLocalIdentifiers:)` は**画像のI/Oもデコードも行わない**ため、
   * 拡大表示の失敗時に呼んでも表示を止めない。
   *
   * **判定できない場合は true(存在する)へ倒す。** フルアクセスが無い状態では、実在する写真でも
   * フェッチ結果が空になる(限定アクセスでは未選択の写真が見えない)。それを「削除された」と扱うと
   * ユーザーへ誤情報を出すことになるため、フルアクセスのときだけ削除を断定する。
   *
   * @param assetId `ph://<localIdentifier>` 形式のアセットURI、またはその `localIdentifier`。
   * @return 存在する場合と判定できない場合は true、削除が確認できた場合のみ false。
   */
  private static func isAssetAvailable(assetId: String) -> Bool {
    let localIdentifier = assetId.hasPrefix(photoLibraryUriScheme)
      ? String(assetId.dropFirst(photoLibraryUriScheme.count))
      : assetId

    guard !localIdentifier.isEmpty else {
      return true
    }

    guard PHPhotoLibrary.authorizationStatus(for: .readWrite) == .authorized else {
      return true
    }

    return PHAsset.fetchAssets(withLocalIdentifiers: [localIdentifier], options: nil).firstObject != nil
  }

  /**
   * 取得する画像の用途。用途ごとに「ネットワークアクセスの可否」と画質の要求が異なる。
   *
   * この2つを1つの enum に集約しているのは、**ネットワークアクセスを許すのは拡大表示だけ**という
   * 線引きをコード上の1箇所で見えるようにするためである。地図マーカー用のサムネイル取得で
   * 通信が走ると、元の App Hang / 通信量の問題が再発する。
   */
  private enum ImageVariant {
    /** 地図マーカー用サムネイル。通信は行わず、ローカルにある表現だけを使う。 */
    case thumbnail
    /** ユーザーが写真をタップして開いた拡大表示用画像。iCloud からのダウンロードを許可する。 */
    case preview

    /** 書き出すファイル名の接頭辞。用途ごとにキャッシュを分け、取り違えを防ぐ。 */
    var fileNamePrefix: String {
      switch self {
      case .thumbnail: return "thumb"
      case .preview: return "preview"
      }
    }

    /** JPEG の圧縮品質。 */
    var compressionQuality: CGFloat {
      switch self {
      case .thumbnail: return PhotoThumbnailModule.jpegCompressionQuality
      case .preview: return PhotoThumbnailModule.previewJpegCompressionQuality
      }
    }

    /**
     * `PHImageManager` へ渡すリクエストオプション。
     *
     * **`isNetworkAccessAllowed` を true にするのは `.preview` だけ**である。
     * 地図描画中に走るサムネイル取得で通信を許すと、通信量・待ち時間・App Hang の
     * リスクをすべて負い直すことになる(設計書 §4.2)。拡大表示は
     * 「ユーザーが写真を明示的にタップした」ときにしか走らず、待たせても意図が伝わるため、
     * ここだけを例外として iCloud からのダウンロードを許可する。
     */
    var requestOptions: PHImageRequestOptions {
      let options = PHImageRequestOptions()
      options.isSynchronous = false

      switch self {
      case .thumbnail:
        // iCloud からのダウンロードは行わない。ローカルに残っているサムネイルだけを使う
        options.isNetworkAccessAllowed = false
        // .opportunistic は結果ハンドラが複数回呼ばれ Promise の二重解決になるため使わない。
        // .fastFormat は結果ハンドラが必ず1回だけ呼ばれ、かつ「すぐ用意できる表現」を返すので、
        // ローカルのサムネイルを取りに行く本用途に合う
        options.deliveryMode = .fastFormat
        options.resizeMode = .fast
      case .preview:
        // ここだけ true。オリジナルが iCloud にしか無い写真でも、拡大表示では正規の画像を出す
        options.isNetworkAccessAllowed = true
        // .highQualityFormat も結果ハンドラは1回だけ呼ばれる。ダウンロードを待ってでも
        // 最終品質の画像を1回で受け取る
        options.deliveryMode = .highQualityFormat
        options.resizeMode = .exact
      }

      return options
    }
  }

  /**
   * アセットの画像を用途に応じた条件で書き出し、その `file://` パスで Promise を解決する。
   *
   * 取得できない場合(アセットが見つからない・ローカルにも iCloud にも表現が無い・
   * ダウンロードに失敗した・書き出しに失敗した)は**例外を投げず null で解決する**。
   * 呼び出し側が「その写真は画像なしで扱う」「サムネイルのままにする」と判断できるようにするため。
   *
   * @param assetId `ph://<localIdentifier>` 形式のアセットURI。
   * @param size 要求する画像の一辺のピクセル数。
   * @param variant 取得する画像の用途。ネットワークアクセスの可否はここで決まる。
   * @param promise 解決先の Promise。
   */
  private static func requestImage(assetId: String, size: Double, variant: ImageVariant, promise: Promise) {
    let localIdentifier = assetId.hasPrefix(photoLibraryUriScheme)
      ? String(assetId.dropFirst(photoLibraryUriScheme.count))
      : assetId

    guard !localIdentifier.isEmpty, size > 0 else {
      promise.resolve()
      return
    }

    guard let destinationUrl = imageFileUrl(localIdentifier: localIdentifier, size: size, variant: variant) else {
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

    let resolveOnce = ResolveOnceFlag()
    // 拡大表示は全画面へ引き伸ばすため、切り取らず収まるように .aspectFit を使う。
    // マーカーは正方形の枠へ敷き詰めるので従来どおり .aspectFill のまま
    let contentMode: PHImageContentMode = variant == .preview ? .aspectFit : .aspectFill

    PHImageManager.default().requestImage(
      for: asset,
      targetSize: CGSize(width: size, height: size),
      contentMode: contentMode,
      options: variant.requestOptions
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
        if let imageUri = writeImage(image: image, to: destinationUrl, variant: variant) {
          promise.resolve(imageUri)
        } else {
          promise.resolve()
        }
      }
    }
  }

  /**
   * 画像の書き出し先URLを、アセット・要求サイズ・用途から決定的に導く。
   *
   * `localIdentifier` は `XXXXXXXX-…/L0/001` のようにスラッシュを含みそのままファイル名にできないため、
   * 英数字以外を `-` へ置き換える。置換は決定的なので、同じ要求からは常に同じパスが得られる。
   *
   * @param localIdentifier `PHAsset.localIdentifier`。
   * @param size 要求する画像の一辺のピクセル数。
   * @param variant 取得する画像の用途。ファイル名の接頭辞に反映する。
   * @return 書き出し先URL。キャッシュディレクトリを取得できない場合は nil。
   */
  private static func imageFileUrl(localIdentifier: String, size: Double, variant: ImageVariant) -> URL? {
    guard let cachesUrl = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
      return nil
    }

    let safeIdentifier = String(localIdentifier.map { $0.isLetter || $0.isNumber ? $0 : "-" })

    return cachesUrl
      .appendingPathComponent(thumbnailDirectoryName, isDirectory: true)
      .appendingPathComponent("\(variant.fileNamePrefix)-\(safeIdentifier)-\(Int(size)).jpg")
  }

  /**
   * 画像を JPEG としてキャッシュディレクトリへ書き出す。
   *
   * @param image 書き出す画像。
   * @param destinationUrl 書き出し先URL。
   * @param variant 取得する画像の用途。圧縮品質を決めるために使う。
   * @return 書き出せた場合は `file://` パス。失敗した場合は nil。
   */
  private static func writeImage(image: UIImage, to destinationUrl: URL, variant: ImageVariant) -> String? {
    guard let jpegData = image.jpegData(compressionQuality: variant.compressionQuality) else {
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
