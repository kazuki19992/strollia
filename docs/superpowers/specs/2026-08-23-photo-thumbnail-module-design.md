# 写真サムネイル取得ネイティブモジュール 設計書

作成日: 2026-08-23

関連: issue #160 / PR #161 / PR #162 / PR #164、
親設計書 `docs/superpowers/specs/2026-08-10-photo-map-scan-limit-removal-design.md`

## 1. 目的

iCloud に本体がありローカルへダウンロードされていない写真でも、地図上のマーカーに
サムネイルを表示できるようにする。

## 2. なぜ必要か

### 症状

実機（設定 → 写真 → **「iPhone のストレージを最適化」**）で、地図上に写真マーカーが表示されない。

- PR #164 以前: マーカーは出るが画像が**白紙**
- PR #164 以降: 表示用 URI の解決に失敗した写真を除外する仕様のため、**マーカーごと消える**

症状が「白紙 → 消滅」へ変化したこと自体が、解決が全件失敗している証拠である。

### 原因

利用可能な API がどれも**オリジナル本体**を要求し、かつネットワークアクセスを行わないため。

| 経路 | 実際の挙動 |
| --- | --- |
| 旧 `getAssetInfoAsync` | `requestContentEditingInput` の `fullSizeImageURL`。当アプリは App Hang 対策で `shouldDownloadFromNetwork: false` を明示（PR #136） |
| 新 `Asset.getUri()` | `UriExtractor` が `PHContentEditingInputRequestOptions()` の**既定値**（ネットワーク不許可）で要求 |
| `expo-file-system` の `ph://` コピー | `PHAssetResourceManager.writeData` を `options: nil` で呼ぶ。同じ制約 |

オリジナルが端末に無ければ `fullSizeImageURL` は nil になり、いずれも失敗する。

### 既存手段では解決できないことの確認

- **`expo-media-library` にサムネイル API は無い**（公式ドキュメントで確認。`getUri()` は「アセットの場所」＝オリジナルのみ）
- **`expo-image` は `ph://` をサポートしない**（公式ドキュメントに記載なし。かつ未導入）
- **React Native 0.86 に `RCTPhotoLibraryImageLoader` は存在しない**（`RCTImageLoader.mm` のコメント内で言及されるのみ）

写真アプリが一覧を表示できるのは **`PHImageManager.requestImage`** を使っているためで、これは
オリジナルが端末に無くてもローカルのサムネイルを返す。**この API を公開しているパッケージが無い**ことが
本件の本質である。

## 3. 方針

`PHImageManager.requestImage` だけを公開する、**iOS 専用の小さなローカル Expo モジュール**を追加する。

### 3.1 なぜ iOS 専用でよいか

Android では `expo-media-library` が `file://…` を返し、`<Image>` でそのまま描画できる。
現行の `resolvePhotoDisplayUri`（PR #164）も `ph://` 以外は問い合わせずに素通ししている。
したがって**Android 側の実装は不要**で、モジュールは iOS のみで完結する。

Android を将来対応する場合は `ContentResolver.loadThumbnail`（API 29+）が対応物になるが、
本設計のスコープ外とする（issue #76）。

### 3.2 なぜローカルモジュールか

- `ios/` は gitignore 済みで **CNG（prebuild）運用**。`modules/` 配下のローカルモジュールは
  `expo-module.config.json` により prebuild で自動的に組み込まれる
- 外部依存を増やさない（AGENTS.md §4「ネイティブコードの追加が必要な依存は慎重に判断する」）
- 公開する API は1つだけに絞り、保守対象を最小化する

`npx create-expo-module --local` で生成する。

## 4. インターフェース

```ts
/**
 * 写真ライブラリのアセットからサムネイルを取得し、キャッシュディレクトリ上のパスを返す。
 *
 * @param assetId - `ph://<localIdentifier>` 形式のアセットURI。
 * @param size - 要求するサムネイルの一辺のピクセル数。
 * @returns 生成したサムネイルの `file://` パス。取得できない場合は null。
 */
export async function getPhotoThumbnailAsync(assetId: string, size: number): Promise<string | null>;
```

### 4.1 なぜ base64 ではなくファイルパスか

base64 データURIでも `<Image>` は描画できるが、以下の理由でファイルパスを採る。

- マーカーは `tracksViewChanges` の都合で再描画が起きやすく、巨大な文字列を JS 側で保持すると
  メモリと再レンダリングのコストが乗る
- `<Image>` は URI 単位でネイティブ側にキャッシュを持つため、同じパスなら再デコードを避けられる
- キャッシュディレクトリへ書けば、セッションをまたいだ再利用も期待できる

### 4.2 ネイティブ側の要点

- `PHImageManager.default().requestImage(for:targetSize:contentMode:options:resultHandler:)`
- `PHImageRequestOptions`:
  - `isNetworkAccessAllowed = false` — **iCloud からのダウンロードは行わない**。
    ローカルのサムネイルだけを使う。これが本設計の肝であり、通信・時間・App Hang の
    いずれのリスクも負わない
  - `deliveryMode = .opportunistic` の場合は結果ハンドラが複数回呼ばれる点に注意する
- 取得した `UIImage` を JPEG へエンコードし、キャッシュディレクトリへ書き出す
- ファイル名は `assetId` と `size` から決定的に導く（同じ要求で同じパスになるようにする）

### 4.3 失敗時

`null` を返す。例外を投げない。呼び出し側が「その写真は画像なしで扱う」と判断できるようにする。

## 5. JS 側の変更

変更は `src/features/photos/photoDisplayUri.ts` に閉じる（PR #164 で解決処理を1箇所へ集約済み）。

1. `ph://` の場合、まず `getPhotoThumbnailAsync` を試す
2. 取得できたらそのパスを返す
3. 取得できなかった場合は**写真を除外せず、画像なしのマーカーとして扱う**（後述）
4. `ph://` 以外（Android）は従来どおり素通し

### 5.1 モジュールが利用できない場合のフォールバック

Expo Go・テスト環境・万一のビルド不整合でモジュールが解決できない場合に、
**写真機能全体が落ちないようにする**。モジュール未解決時は「取得できなかった」と同じ扱いにする。

### 5.2 画像を取得できなかった写真の扱い（重要な仕様変更）

PR #164 では「解決できなかった写真は**除外**」としたが、これは本件で
「マーカーごと消える」という最悪の症状を生んだ。

本設計では**除外をやめ、画像なしのマーカーとして表示する**。

- 写真がそこに存在するという情報自体は地図上の価値がある
- 全件取得できない環境でも、地図が「何も無い」状態にはならない
- `PhotoClusterMarker` は代表写真の画像が無い場合にプレースホルダ（写真アイコン）を描画する

これに伴い `PhotoClusterMarker.tsx` の変更が必要になる（PR #164 では変更不要だった）。

## 6. 変更対象ファイル

| ファイル | 変更内容 |
| --- | --- |
| `modules/photo-thumbnail/` | 新設。ローカル Expo モジュール（iOS 実装 + TS インターフェース） |
| `src/features/photos/photoDisplayUri.ts` | サムネイル取得経由へ変更。失敗時は null を返す |
| `src/features/photos/photoLibrary.ts` | 画像を取得できなかった写真を除外しない |
| `src/ui/components/PhotoClusterMarker.tsx` | 画像が無い場合のプレースホルダ描画 |
| `src/ui/appStyles.ts` | プレースホルダ用スタイル |
| `docs/photo-geotag.md` | サムネイル取得方式・iCloud 未ダウンロード時の挙動 |

## 7. テスト方針

ネイティブモジュールそのものは jest でテストできない。`AGENTS.md` §2 に従い、
分離できる部分をテストし、テストできない部分は実機確認手順を明記する。

- **モジュールはモックする**。`photoDisplayUri` の分岐（`ph://` 判定、キャッシュ、失敗時 null、
  モジュール未解決時のフォールバック）を単体テストする
- 画像なしの写真が**除外されない**ことを `photoLibrary` のテストで固定する
- `PhotoClusterMarker` のプレースホルダ描画を UI テストで検証する
- **テストできない部分**: `PHImageManager` の実挙動。実機（ストレージ最適化 ON の端末）で
  サムネイルが表示されること、通信が発生しないことを確認する

## 8. リスク

| リスク | 対応 |
| --- | --- |
| ネイティブモジュールのビルド失敗でリリースが止まる | モジュールは最小限に保つ。JS 側はモジュール未解決でも落ちない |
| OTA 更新で配れない（要ネイティブビルド） | 元よりネイティブ追加は避けられない。リリース手順に影響する旨を周知 |
| ローカルサムネイルすら無い写真がありうる | 画像なしマーカーで表示。除外はしない |
| キャッシュディレクトリの肥大 | 要求サイズを小さく固定する。OS によるキャッシュ削除に委ねる |

## 9. 承認が必要な点

1. **ローカル Expo モジュールを追加すること**（AGENTS.md §4）
2. **iOS 専用実装とし、Android は現行の素通しのままにすること**（issue #76 のスコープ）
3. **画像を取得できなかった写真を除外せず、画像なしマーカーとして表示すること**（PR #164 からの仕様変更）
4. **サムネイルをキャッシュディレクトリへ書き出すこと**（base64 を採らない判断）
