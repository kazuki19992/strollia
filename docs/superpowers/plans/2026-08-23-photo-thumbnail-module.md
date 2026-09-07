# 写真サムネイル取得ネイティブモジュール 実装計画

作成日: 2026-08-23

設計書: `docs/superpowers/specs/2026-08-23-photo-thumbnail-module-design.md`（承認済み）

## Task 1: ローカル Expo モジュールの追加

`modules/photo-thumbnail/` を新設する。`npx create-expo-module --local` は対話式のため、
**ファイルを直接作成する**（生成物と同じ構成にする）。

```text
modules/photo-thumbnail/
  expo-module.config.json     ← iOS のモジュール名を宣言
  index.ts                    ← 公開API
  ios/PhotoThumbnailModule.swift
  ios/PhotoThumbnail.podspec
```

### 公開API（`index.ts`）

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

- ネイティブモジュールの解決には `requireOptionalNativeModule` を使う。
  **解決できなくても import 時に落ちないこと**（Expo Go・テスト環境・ビルド不整合への保険）
- 解決できない場合は `null` を返す

### iOS 実装の要点

- `PHAsset.fetchAssets(withLocalIdentifiers:)` で `ph://` を落とした識別子から取得する
- `PHImageManager.default().requestImage(for:targetSize:contentMode:options:resultHandler:)`
- `PHImageRequestOptions`:
  - **`isNetworkAccessAllowed = false`** — iCloud からのダウンロードは行わない。**本設計の肝**
  - `deliveryMode` は結果ハンドラが1回だけ呼ばれる設定にする
    （`.opportunistic` は複数回呼ばれ、Promise の二重解決になるため使わない）
  - `resizeMode = .fast` 程度でよい
- 取得した `UIImage` を JPEG エンコードし、キャッシュディレクトリへ書き出す
- ファイル名は `assetId` と `size` から**決定的に**導く（同じ要求で同じパスになる）。
  既に同じパスのファイルがあれば書き直さない
- 取得できない場合は `nil` を返す。**例外を投げない**

Android 実装は作らない（設計書 §3.1）。Android では `photo_assets` の `uri` が `file://` で
そのまま描画できるため、JS 側が呼び出す前に分岐する。

### テスト

ネイティブ実装は jest でテストできない。ここでは TS 側の型と export のみが対象。
実挙動は Task 6 の実機確認手順で担保する。

## Task 2: `photoDisplayUri.ts` をサムネイル取得経由へ

現在は `new Asset(storedUri).getUri()` でオリジナルのパスを解決している。これを差し替える。

- `ph://` の場合、`getPhotoThumbnailAsync` を呼ぶ
- 取得できたらそのパスを返す
- **取得できない場合は `null` を返す**（例外を投げない）。呼び出し側が画像なしとして扱えるようにする
- `ph://` 以外（Android の `file://`）は従来どおり素通しする
- 既存のメモリキャッシュは維持する。**失敗（null）はキャッシュしない**（次回の読み込みで再試行できるように）
- 旧 `Asset.getUri()` の呼び出しは不要になるので削除する

戻り値の型が `Promise<string>` から `Promise<string | null>` になる。

### テスト（先に書いて red を確認）

- `ph://` のとき `getPhotoThumbnailAsync` の結果が返る
- 同じ写真を再度解決してもモジュールが2回呼ばれない（キャッシュ）
- 取得できない場合は `null` を返し、**例外を投げない**
- 失敗はキャッシュされず、次回に再試行される
- `ph://` 以外は問い合わせずそのまま返す
- **モジュールが解決できない環境でも落ちず `null` を返す**

## Task 3: 画像を取得できなかった写真を除外しない

PR #164 では解決失敗時に写真を結果から除外していた。これが「マーカーごと消える」症状を生んだ。

- `photoLibrary.ts` の表示用URI解決で、**取得できなかった写真も結果に残す**
- `MapPhoto.uri` の型を `string | null` にする
- 型変更の波及先（クラスタ、詳細ダイアログ、既存テスト）を追従させる

### テスト（先に書いて red を確認）

- サムネイルを取得できなかった写真が**結果から除外されない**
- 一部だけ取得できた場合、取得できた写真は画像あり・できなかった写真は画像なしで返る
- 既存の「ジオタグなしは除外」挙動は変わらない（**こちらは従来どおり除外**）

## Task 4: `PhotoClusterMarker` のプレースホルダ描画

代表写真の画像が無い場合、写真アイコンのプレースホルダを描画する。

- 既存の `styles: AppStyles` を受け取る規約に従い、スタイルは `src/ui/appStyles.ts` へ追加する
  （`src/ui/components/**` での `StyleSheet.create` は ESLint error）
- クラスタの枚数バッジは従来どおり表示する
- `accessibilityLabel` を適切に設定する（画像あり・なしで内容が変わるなら反映する）
- アイコンは既存の `@expo/vector-icons` の使い方に合わせる

写真詳細ダイアログ側も、画像が無い場合に白紙にならないようにする。

### テスト

- 画像がある場合は `<Image>` が描画される
- 画像が無い場合はプレースホルダが描画され、白紙にならない
- どちらの場合も枚数バッジが出る

## Task 5: ドキュメント

- `docs/photo-geotag.md`:
  - サムネイル取得方式（`PHImageManager`、ネットワークアクセス無し）
  - iCloud 未ダウンロード写真の扱い
  - 画像を取得できない場合はプレースホルダ表示にする方針（除外しない）
  - Android は `file://` を素通しすること
- 設計書 §9 の承認事項が確定した旨を追記

## Task 6: 実機確認手順の明記

テストできない部分について、`AGENTS.md` §2 に従い代替の検証手順を残す。

`docs/photo-geotag.md` に以下を確認手順として記載する。

1. 設定 → 写真 → **「iPhone のストレージを最適化」** が有効な端末で確認する
2. 地図上の写真マーカーにサムネイルが表示されること
3. 機内モードでもサムネイルが表示されること（**ネットワークアクセスしていないことの確認**）
4. アプリを再起動しても表示されること
5. 地図をパン・ズームしてもサムネイル取得が繰り返し走らないこと

## 完了条件

- `npm run typecheck` エラー 0
- `npm test` 全通過
- `npm run lint` error 0
- `npm run format:check` clean
- 写真の表示に関する既存の挙動（ジオタグなしの除外、クラスタリング、走査済み窓の突き合わせ、
  クラッシュブレーカー）が変わっていないこと

## 注意

- `photo_assets` のスキーマは**変更しない**。`ph://` を保存する設計はそのまま
- 走査経路（`loadGeotaggedPhotos`）・突き合わせロジックは**変更しない**
- サムネイルのパスは**永続化しない**（キャッシュディレクトリは OS が消しうるため、メモリキャッシュのみ）
