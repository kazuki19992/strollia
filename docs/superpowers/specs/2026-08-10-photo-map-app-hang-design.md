# 写真マップの App Hang 解消と表示上限撤廃 設計書

作成日: 2026-08-10
対象: Sentry `App Hanging: App hanging for at least 2000 ms.`(2026-08-08 23:24:36 UTC 発生)

## 1. 背景と現象

### 観測された事象

Sentry breadcrumb 上で、フォアグラウンド復帰(23:24:28.831)の **7.4秒後** に App Hang が発生した。
同一セッションで `LOW_MEMORY` warning が4回記録されている。

### スタックトレース(要約)

```text
_platform_memmove
FigDataByteStreamRead                       (CoreMedia)
CMPhotoUnifiedJPEGDecoderDecode             (CMPhoto)     ← フル解像度JPEGデコード
AppleJPEGReadPlugin::copyIOSurfaceImp       (ImageIO)
-[CIImage initWithContentsOfURL:options:]   (CoreImage)
CIImage.__allocating_init                   (ExpoMediaLibrary)
closure in MediaLibraryModule.resolveImage  (MediaLibraryModule.swift:451)
__94-[PHImageManager _handleResultForContentEditingInput:...]_block_invoke  (Photos)
_dispatch_main_queue_drain                  (libdispatch) ← メインキュー上で実行
__CFRUNLOOP_IS_SERVICING_THE_MAIN_DISPATCH_QUEUE__
```

メインスレッドがフル解像度 JPEG のデコード中に停止していることが確定している。

## 2. 根本原因

### 2.1 直接原因: 200件分のJPEGデコードがメインキューに積まれる

`src/features/photos/photoLibrary.ts:61-70`

```typescript
const DEFAULT_PHOTO_SCAN_LIMIT = 200;

export async function loadGeotaggedPhotos(limit = DEFAULT_PHOTO_SCAN_LIMIT): Promise<MapPhoto[]> {
  const page = await MediaLibrary.getAssetsAsync({ first: limit, ... });

  const details = await Promise.allSettled(
    page.assets.map((asset) => MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: false })),
  );
  ...
}
```

最新200件に対し `getAssetInfoAsync` を **一斉並列** で発行している。

expo-media-library 57.0.1 のネイティブ実装(`node_modules/expo-media-library/ios/MediaLibraryModule.swift:439-457`):

```swift
private func resolveImage(asset: PHAsset, options: AssetInfoOptions, promise: Promise) {
  var result = exportAssetInfo(asset: asset) ?? [:]
  let imageOptions = PHContentEditingInputRequestOptions()
  imageOptions.isNetworkAccessAllowed = options.shouldDownloadFromNetwork

  asset.requestContentEditingInput(with: imageOptions) { contentInput, info in   // ← 完了ブロックはメインキュー
    result["localUri"] = contentInput?.fullSizeImageURL?.absoluteString
    ...
    if let url = contentInput?.fullSizeImageURL, let ciImage = CIImage(contentsOf: url) {
      result["exif"] = ciImage.properties      // ← 451行目: 無条件にフル解像度デコード
    }
    ...
  }
}
```

問題は次の2点が重なることにある。

1. PhotoKit の `requestContentEditingInput` 完了ブロックは **メインキュー** で実行される
2. その中で `CIImage(contentsOf:)` + `.properties` が **フル解像度 JPEG デコード** を強制する

結果、**フル解像度デコード200回分がメインランループに直列で積まれ**、2秒以上ブロックした。
デコード済み IOSurface が大量に確保されることが `LOW_MEMORY` の説明にもなる。

### 2.2 このデコードは全く不要である

アプリが `AssetInfo` から使うのは `toMapPhoto`(`photoLibrary.ts:39-53`)が読む以下だけ。

| フィールド         | 用途               |
| ------------------ | ------------------ |
| `location`         | 地図上の座標       |
| `id`               | マーカーキー       |
| `localUri ?? uri`  | サムネイル表示     |
| `creationTime`     | クラスタ内の並び順 |
| `width` / `height` | 表示比率           |

**`exif` は一度も参照していない。**

さらに `MediaLibraryUtilities.swift:27-33` を見ると:

```swift
func exportAssetInfo(asset: PHAsset) -> [String: Any?] {
  var assetDict = exportAsset(asset: asset)                          // uri/width/height/creationTime/id
  assetDict["location"] = exportLocation(location: asset.location)   // ← 必要なのはこの1行だけ
  assetDict["isFavorite"] = asset.isFavorite
  assetDict["isHidden"] = asset.isHidden
  return assetDict
}
```

- `getAssetsAsync`(= `exportAsset`)が **`location` 以外の必要フィールドを全て返している**
- `location` は `asset.location` を読むだけの **同期プロパティアクセス**。I/O もデコードも発生しない

つまり現状は、**コストゼロのプロパティ1個を得るために、使いもしない EXIF のためのフル解像度デコードをメインスレッドで200回走らせている**。

### 2.3 発火経路

```text
起動 / フォアグラウンド復帰
  → useAppInitialization で savedShowPhotosOnMap を読む
  → usePhotoMapCrashBreaker.initializePhotoSetting
  → shouldRestorePhotosOnMapAfterMapReady = true
  → isReady && isMapReady を待つ                       (usePhotoMapCrashBreaker.ts:173-195)
  → enableShowPhotosOnMapWithCrashBreaker → setShowPhotosOnMap(true)
  → usePhotoMapOverlay(true) の effect               (usePhotoMapOverlay.ts:62-64)
  → loadGeotaggedPhotos()
  → getAssetInfoAsync × 200 並列 → メインキュー飽和 → App Hang
```

観測された「フォアグラウンドから7.4秒後」という遅延と整合する。

### 2.4 調査で否定した仮説

スタックトレース入手前に「visited grid の Polygon 描画がメインスレッドを止めている」という仮説を立てたが、
**スタックに MapKit のフレームは一切現れておらず、明確に否定された**。本設計書では扱わない。

なお同ログにあった `Background location task failed: Error Domain=kCLErrorDomain Code=0` は
`kCLErrorLocationUnknown`(一時的な測位失敗)であり、`backgroundLocationTask.ts:25-28` の
warn + return は正しい扱い。defect ではないため対象外とする。

## 3. 200件上限が隠している問題

ユーザーからの要望は「全ての写真を地図に表示したい」。
現状の `DEFAULT_PHOTO_SCAN_LIMIT = 200` は **3つの独立した問題を同時に隠している**。

| #   | 問題                                             | 箇所                                                   | Phase 1(並列数制限)で解決するか                                                     |
| --- | ------------------------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 1   | メインスレッドJPEGデコード                       | `photoLibrary.ts:68` + ネイティブ                      | △ 現行200件では緩和で足りるが、デコード自体は残る。上限を上げるほど再び効かなくなる |
| 2   | クラスタリングが O(N²) × 全ライブラリ × パンごと | `photoClusters.ts:106-122`, `AppStateProvider.tsx:582` | ❌ 残る                                                                             |
| 3   | マーカーのビューポート間引きなし                 | `MapScreen.tsx:236`                                    | ❌ 残る                                                                             |

### 問題2の詳細

`AppStateProvider.tsx:582`

```typescript
const photoClusters = useMemo(() => clusterMapPhotos(photos, visibleRegion), [photos, visibleRegion]);
```

`clusterMapPhotos` の `findNearestCluster`(`photoClusters.ts:106-122`)は
**既存クラスタを全走査**するため計算量は O(N × C)、写真が散在する実データでは C ≒ N となり **O(N²)**。
加えてビューポート外の写真も対象に含み、`visibleRegion` 依存なので **地図をパン/ズームするたびに再計算**される。

| 写真数    | 距離計算回数 / パン1回 | 体感               |
| --------- | ---------------------- | ------------------ |
| 200(現状) | 約 4万                 | 問題なし           |
| 5,000     | 約 2,500万             | パンのたびに固まる |
| 20,000    | 約 4億                 | 実用不能           |

**問題1だけを直して上限を外すと、ハングが「起動時」から「地図を動かすたび」へ引っ越すだけになる。**

## 4. 対応方針

段階リリースとする。Phase 1 でユーザー影響(ハング)を最短で止め、Phase 2 で上限撤廃を実現する。

**方針決定**: ネイティブパッチ(node_modules 内 Swift コードの改変)による根本解決は、
SDK 更新のたびに追従確認が必要な保守コストと、prebuild + ネイティブビルド検証が必須になる
リスクを踏まえ**採用しない**。Phase 1 は JS 側のみで完結する対応に限定する。

### Phase 1: App Hang の解消(次リリース対象)

**目的**: メインスレッドを塞がない。写真表示件数は現状維持(200件)。

expo-media-library には EXIF 取得をスキップする JS 側オプションが存在せず
(`resolveImage` で無条件にデコードを実行)、デコード自体を止めるにはネイティブ側の変更が要る。
上記の方針決定によりネイティブパッチは採らないため、Phase 1 では
**`getAssetInfoAsync` の並列数を制限し、メインキューへ一度に積まれるデコード量を減らす**
ことでハングを解消する。

```typescript
/** getAssetInfoAsync の同時実行数。メインキューを飽和させない上限。 */
const PHOTO_INFO_CONCURRENCY = 4;

const details = await mapWithConcurrency(page.assets, PHOTO_INFO_CONCURRENCY, (asset) =>
  MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: false }),
);
```

- `mapWithConcurrency` は `src/utils/concurrency.ts` に**純粋な汎用ヘルパー**として新設し、TDD で書く
- ネイティブに触れないため prebuild 不要。既存のビルド/配布フローをそのまま使える
- メインキューに一度に積まれるデコードが 200 → 4 になり、ランループが息を継げるようになる

**トレードオフ**: デコード自体は残るため、写真が地図に出揃うまでの総時間は現状より延びる。
ただし UI は固まらず、`isLoadingPhotos` により読み込み中であることは既に表示できる。

`PHOTO_INFO_CONCURRENCY` の初期値は 4 とする。実機で App Hang が解消したことを確認したうえで、
必要なら Phase 2 着手時に再調整する。

### Phase 2: 表示上限の撤廃(別PR)

**目的**: `DEFAULT_PHOTO_SCAN_LIMIT` を撤廃し、ライブラリ全体のジオタグ写真を扱えるようにする。

Phase 1 完了を前提に、以下の3点を実装する。いずれも純粋関数として切り出し TDD で書ける。

1. **ページング走査**
   `getAssetsAsync` の `after` カーソルでライブラリ全体を分割取得する。
   1ページ処理ごとに `location` を持つものだけ残し、それ以外は即座に捨てる。

2. **空間グリッドによるクラスタリング**
   `clusterMapPhotos` の O(N²) を、セルサイズ = クラスタ半径の**空間ハッシュ**に置き換え O(N) にする。
   既存の `visited grid`(`src/features/location/grid/`)と同じセル座標の考え方を流用できる。

3. **ビューポート絞り込み**
   クラスタリング前に表示範囲(+ 余白)外の写真を除外する。
   `getGridBoundsForRegion` 相当の考え方を写真側にも適用する。

Phase 2 の詳細設計は Phase 1 マージ後に別設計書として起こす。本書では方針のみ確定させる。

**留意点**: ネイティブパッチを採らない方針のため、問題1(JPEGデコード)自体は Phase 2 でも残る。
上限を撤廃するほど並列数制限だけでは緩和しきれなくなる可能性があるため、Phase 2 では
ページごとの取得件数を絞る・デコード完了を待ってから次ページへ進める、といった
JS 側のさらなる制御で許容範囲に収める設計を検討する。

## 5. 変更対象ファイル(Phase 1)

| ファイル                                             | 変更内容                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/utils/concurrency.ts`                           | 新設。`mapWithConcurrency` 汎用ヘルパー                                        |
| `src/utils/__tests__/concurrency.test.ts`            | 新設。同時実行数・順序保証・失敗時挙動のテスト                                 |
| `src/features/photos/photoLibrary.ts`                | `Promise.allSettled` → `mapWithConcurrency`。`PHOTO_INFO_CONCURRENCY` 定数追加 |
| `src/features/photos/__tests__/photoLibrary.test.ts` | 同時実行数が上限を超えないことの回帰テストを追加                               |
| `docs/photo-geotag.md`                               | 走査上限・並列数制限の理由を追記                                               |

## 6. テスト方針

`AGENTS.md` §2 / §9 に従い、端末APIそのものではなく分離した純粋ロジックをテストする。

### `mapWithConcurrency`(純粋ヘルパー)

- 同時に走る処理数が指定した上限を超えないこと(実行中カウンタの最大値で検証)
- 入力順と出力順が一致すること
- 一部が reject しても全体が完了し、`PromiseSettledResult` 相当で結果を返すこと
- 空配列・上限1・上限が要素数を超える場合の境界

### `loadGeotaggedPhotos`

- `MediaLibrary` をモックし、`getAssetInfoAsync` の同時実行数が `PHOTO_INFO_CONCURRENCY` を超えないこと
- `location` を持たないアセットが除外されること(既存テストの維持)
- 一部のアセット取得が失敗しても、残りの写真が返ること(既存テストの維持)

### 実機での確認(補足)

並列数制限そのものは Jest で検証できるが、「実際にメインスレッドが解放されるか」は
Jest では確認できない。development ビルドでジオタグ写真が200件程度あるライブラリで
写真表示を ON にし、フォアグラウンド復帰時にアプリが固まらないことを手動確認する。

## 7. 影響範囲

- **ユーザー影響**: 起動時/フォアグラウンド復帰時の写真表示でアプリが固まらなくなる。
  表示される写真の件数と内容は Phase 1 では変わらない。
- **写真表示 OFF のユーザー**: `loadGeotaggedPhotos` 自体が呼ばれないため影響なし。
- **ローカルファースト方針**: 写真メタデータの外部送信は発生しない。変更なし。
- **Android**: `resolveImage` は iOS 実装。Android 側の挙動変更はないが、
  並列数制限は共通コードのため Android でも適用される(負荷が下がる方向で無害)。

## 8. 確定事項

- **`PHOTO_INFO_CONCURRENCY` の初期値**: 4。実機で App Hang 解消を確認後、Phase 2 着手時に再調整可。
- **ネイティブパッチは不採用**: 根本解決(EXIF デコードの完全排除)より、保守コストを避けることを優先する。
  Phase 1 は並列数制限のみで対応する。
- **Phase 2 の着手時期**: Phase 1 マージ・実機確認後、別途着手する(本書では方針のみ確定)。
