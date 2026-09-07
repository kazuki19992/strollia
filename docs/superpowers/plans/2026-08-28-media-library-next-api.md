# expo-media-library 新API移行 実装計画

作成日: 2026-08-28

設計書: `docs/superpowers/specs/2026-08-28-media-library-next-api-design.md`（承認済み）

## 前提

**挙動を変えない移行**である。走査対象は現行どおり「最新200件」のままとし、
ページング・上限撤廃・同時実行数の調整はいずれも行わない（すべて 2-c 以降）。

## Task 1: 新APIのモックを用意する

`__mocks__/expo-media-library.js`（PR #165 で追加済み）に `Query` を足す。

- `Query` はメソッドチェーン（`eq` / `orderBy` / `limit` / `offset` が自分自身を返す）
- `exe()` / `exeForMetadata()` は `AsyncFunction`
- `Asset` は既にスタブがある。`getLocation()` を足す
- 既定スタブは「空の結果」を返す。挙動を検証するテストは各テストファイル側で上書きする

このファイルはルートの手動モックなので `jest.mock` の呼び出し無しで全テストへ適用される。
**既存テストを壊さないこと**（現在 185 suites が通っている状態を維持する）。

## Task 2: 走査結果の変換を純粋関数として切り出す

新APIから得た値を `MapPhoto` / `PhotoAssetRecord` へ変換する部分を純粋関数にする。

入力は「`AssetMetadata`（id / creationTime / width / height）」と「`Location | null`」の組。

- **`uri` は `AssetMetadata.id` をそのまま使う。** 新APIの `id` は `ph://<localIdentifier>` 形式で、
  `photo_assets.uri` に保存している値と同一。`getUri()` は `requestContentEditingInput` を伴い
  iCloud 未ダウンロード時に失敗するため、**走査では絶対に使わないこと**
- 位置情報が無いアセットは除外する（既存挙動と同じ）
- 座標は既存の `toFiniteCoordinate` を通す。新APIは `Double` を返すが、
  issue #160 の教訓としてこの防御は残す（設計書 §4.4・承認済み）

### テスト（先に書いて red を確認）

- 位置情報のあるアセットが `MapPhoto` へ変換される
- 位置情報が無いアセットは除外される
- 座標が数値として解釈できない場合も除外される
- `uri` が `AssetMetadata.id`（`ph://…`）になっている

## Task 3: 走査経路を新APIへ差し替える

`src/features/photos/photoLibrary.ts` の `loadGeotaggedPhotos` を置き換える。

```text
new Query()
  .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
  .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
  .limit(limit + 1)
  .exeForMetadata()
  → 各 id について new Asset(id).getLocation()
```

- **`hasNextPage` 相当は `limit + 1` のプロービングで判定する**（設計書 §4.2・承認済み）
  - 返却件数が `limit` を超える → 次ページあり。**保存対象は先頭 `limit` 件へ切り詰める**
  - `limit` 件以下 → ライブラリを見切った
- `getLocation()` の同時実行は既存の `mapWithConcurrency` と `PHOTO_INFO_CONCURRENCY` を**そのまま使う**
  （コストは下がったが、調整は実測後。この移行では触らない）
- 既存の Sentry 診断計装（`load` ステージ）は維持する。送信する値の意味が変わらないようにする
- 走査済み時間窓の突き合わせ（`photoScanWindow.ts` / `savePhotoAssets`）は**変更しない**。
  `hasNextPage` 相当の真偽値を渡すだけ

### テスト（先に書いて red を確認）

- 最新順・画像のみで問い合わせている
- `limit + 1` 件を要求している
- `limit + 1` 件返ったとき、保存対象が `limit` 件へ切り詰められ、`hasNextPage` 相当が true になる
- `limit` 件以下なら `hasNextPage` 相当が false になる
- 一部の `getLocation()` が失敗しても、成功した写真は返る
- 同時実行数が `PHOTO_INFO_CONCURRENCY` を超えない
- 既存の診断計装が従来どおりの件数で送られる

## Task 4: 権限の import を差し替える

`src/ui/hooks/usePhotoMapCrashBreaker.ts` と `src/features/photos/photoLibrary.ts` の
`hasFullPhotoAccess` まわりを、`expo-media-library/legacy` からルートの `expo-media-library` へ移す。

`PermissionResponse` は `accessPrivileges` を含み同じ形なので、**import 元の差し替えのみ**で済むはず。
型が食い違う場合は報告すること。

**クラッシュブレーカーの挙動・Alert・設定の永続化・復元時の権限再確認は変更しないこと。**

### テスト

既存の権限まわりのテストが**そのまま通ること**。モックの import 元差し替えが必要になる場合がある。

## Task 5: legacy import の残りを確認する

`expo-media-library/legacy` を参照している箇所が他に無いか grep で確認し、
残っていれば移行するか、残す理由を報告する。

## Task 6: ドキュメント

- `docs/photo-geotag.md`: 走査に使うAPI、`uri` を `Asset.id` から得ること、
  `hasNextPage` 相当をプロービングで判定していること
- `.ai/context/architecture.md`: 技術スタックの記述に新APIを使っている旨を反映（必要なら）
- 設計書 §9 の承認事項が確定した旨を追記

## 完了条件

- `npm run typecheck` エラー 0
- `npm test` 全通過
- `npm run lint` error 0
- `npm run format:check` clean
- **ユーザーから見た挙動が変わっていないこと**（最新200件、除外条件、表示、クラスタリング）

## 実機確認（マージ後）

`docs/photo-geotag.md` に手順として残すこと。

1. 写真マーカーが従来どおり表示される
2. **走査件数が想定外に増えていない**（設計書 §5 の `PHFetchOptions` の差の確認）
3. 走査の所要時間を記録する（2-c の設計見直しに使う実測値）

## 注意

- `photo_assets` のスキーマ、走査済み時間窓の突き合わせ、クラッシュブレーカー、
  クラスタリング、表示用URIの解決（`photoDisplayUri.ts` / `photoPreviewUri.ts`）は**変更しない**
- ページング・上限撤廃・同時実行数の調整は**やらない**
