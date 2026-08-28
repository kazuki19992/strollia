# expo-media-library 新API（クラスベース）への移行 設計書

作成日: 2026-08-28

関連: 親設計書 `docs/superpowers/specs/2026-08-10-photo-map-scan-limit-removal-design.md`（Phase 2）、
issue #160、PR #136 / #161 / #162 / #165

## 1. 目的

写真ライブラリの走査経路を、`expo-media-library/legacy` から SDK 57 の**クラスベース新API**へ移行する。

主目的は **Phase 2-c（200件上限の撤廃）の前提を作り直すこと**である。

## 2. なぜ必要か: 2-c の前提が崩れている

親設計書 §3.1 は「**位置情報を取るためだけにフル解像度デコードが走る**」ことを中核の制約とし、
そこから「1万枚で約8分」という試算と「ブロッキングダイアログでアプリを止める」という UX 設計を
導いていた。

新APIではこの前提が成り立たない。

| 取得内容       | 旧 `getAssetInfoAsync`                                                         | 新API                                                                      |
| -------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 位置情報       | `requestContentEditingInput` + **`CIImage(contentsOf:)` でフル解像度デコード** | `getLocation()` が `phAsset.location` を直接読む。**I/O もデコードも無し** |
| 緯度経度の型   | **文字列**（issue #160 の原因）                                                | `Double`                                                                   |
| 撮影日時・寸法 | 同じ呼び出しに同梱                                                             | `exeForMetadata()` で**バッチ取得**（1回の呼び出しで全件分）               |
| 表示用URI      | `localUri`（iCloud 未DLだと nil）                                              | `Asset.id` が `ph://…`。**I/O 無しで得られる**                             |

つまり走査コストが桁違いに下がる。**2-c の「数分待たせる」前提そのものを見直せる可能性が高い。**

副次的な効果として、issue #160 で入れた文字列座標の回避が不要になり、
App Hang 対策として入れた同時実行数の制限（`PHOTO_INFO_CONCURRENCY = 4`）も緩められる余地が出る。

## 3. 方針: 挙動を変えない移行にする

**この移行では、ユーザーから見た挙動を変えない。** 走査対象は現行どおり「最新200件」のままとし、
ページングも上限撤廃も行わない。それらは 2-c の仕事である。

理由は、API 差し替えと仕様変更を同時にやると、実機でしか出ない問題が起きたときに
原因の切り分けができなくなるため。今回の写真マップの調査で、層になったバグの切り分けに
何日も要したことを踏まえた判断である。

## 4. 置き換え内容

### 4.1 走査（`src/features/photos/photoLibrary.ts`）

現行:

```text
getAssetsAsync({ first, mediaType, sortBy })      → 1回
  → mapWithConcurrency(getAssetInfoAsync, 4)      → N回（高コスト）
```

移行後:

```text
new Query()
  .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
  .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
  .limit(N + 1)
  .exeForMetadata()                                → 1回（id/撮影日時/寸法をまとめて取得）
  → 各 id について new Asset(id).getLocation()     → N回（低コスト）
```

- **`uri` は `AssetMetadata.id` から得る。** 新APIの `Asset.id` は `ph://<localIdentifier>` 形式で
  （`ios/next/objects/asset/Asset.swift`）、`photo_assets.uri` に保存している値と同一。
  `getUri()` は `requestContentEditingInput` を伴い iCloud 未DL時に失敗するため、**走査では使わない**
- `exeForMetadata()` は `AssetMetadata` を返し、**`location` を含まない**。位置情報だけは
  アセットごとの `getLocation()` が必要で、往復回数は現行と同じN回。ただし1回あたりのコストが桁違いに安い
- 同時実行数の制限は当面維持する。コストが下がったので緩められる可能性があるが、
  **実測してから**変える（この移行では触らない）

### 4.2 `hasNextPage` の代替

新APIに `hasNextPage` は無い。走査済み時間窓の突き合わせ（PR #162 Task 7）が
「全期間を走査したか」の判定にこれを使っているため、代替が要る。

**`limit(N + 1)` で1件多く要求し、返ってきた件数が N を超えるかで判定する。**

- N+1 件返る → 次ページあり（`hasNextPage: true` 相当）。保存対象は先頭 N 件に切り詰める
- N 件以下 → ライブラリを見切った（`hasNextPage: false` 相当）

既存の突き合わせロジック（`photoScanWindow.ts`）はこの真偽値を受け取るだけなので、**変更しない**。

### 4.3 権限（`src/ui/hooks/usePhotoMapCrashBreaker.ts`）

`requestPermissionsAsync` / `getPermissionsAsync` は新APIのルートからも同じ
`PermissionResponse`（`accessPrivileges` 付き）で提供される。**import 元の差し替えのみ**で済む。

### 4.4 座標の変換（`toFiniteCoordinate`）

新APIは `Double` を返すため、issue #160 の文字列対応は不要になる。
ただし**この関数は残す**。コストがゼロに近く、「ライブラリの型宣言と実装が食い違いうる」という
issue #160 の教訓をテストごと残しておく価値があるため。

## 5. 検証が必要な挙動差（重要）

新旧で **`PHFetchOptions` の設定が異なる**。走査対象の写真が変わりうる。

| 設定                      | 旧 `getAllAssets()`                          | 新 `Query.constructFetchOptions()` |
| ------------------------- | -------------------------------------------- | ---------------------------------- |
| `includeAssetSourceTypes` | `.typeUserLibrary`（ユーザーライブラリのみ） | **未設定**（＝フィルタなし）       |
| `includeHiddenAssets`     | `false` を明示                               | 未設定（PhotoKit の既定は false）  |

`includeAssetSourceTypes` が未設定だと、iTunes 同期アセットや共有アルバムの写真まで
対象に入りうる。**新APIの方が多く返す可能性がある。**

影響:

- 走査件数が増える（＝ジオタグ付き写真が増えるかもしれない）
- 共有アルバムの写真は `getLocation()` や表示用URIの解決に失敗しうる。
  ただし PR #165 で「取得できない写真はプレースホルダ表示」にしてあるため、**壊れはしない**

対応: この差は新APIの仕様であり、こちらから制御する手段が無い（`Query` に該当のフィルタが無い）。
**実機で走査件数が想定外に増えていないかを確認する**。増えていた場合の扱いは、確認結果を見て判断する。

## 6. テスト方針

- **新APIはモックする。** ルートの `__mocks__/expo-media-library.js` は PR #165 で追加済み。
  `Query` のビルダー（メソッドチェーン）を返すモックを足す
- 走査結果の変換（`AssetMetadata` + `Location` → `MapPhoto` / `PhotoAssetRecord`）は純粋関数として
  切り出し、単体テストする
- `hasNextPage` 相当の判定（N+1 件要求して切り詰める）を単体テストする。
  **N+1 件返ったときに保存対象が N 件へ切り詰められること**を含む
- 既存の走査済み時間窓の突き合わせテストが**そのまま通ること**（`photoScanWindow.ts` は変更しない）
- 権限まわりの既存テストがそのまま通ること

## 7. リスク

| リスク                                        | 対応                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| 新APIは相対的に新しく、実績が少ない           | 挙動を変えない移行に留め、問題の切り分けを容易にする                              |
| `PHFetchOptions` の差で走査対象が変わる（§5） | 実機で走査件数を確認する。壊れはしない設計になっている                            |
| クラスベースのモックが書きにくい              | `__mocks__/expo-media-library.js` が既にある。`Query` 用のモックを足す            |
| 往復回数は減らない                            | 1回あたりのコストが桁違いに下がることが目的。**実測してから**同時実行数を調整する |

## 8. 非目的

- ページング・200件上限の撤廃（2-c）
- ブロッキングダイアログなどの UX（2-c）
- 同時実行数の調整（実測後に別途）
- Android 実装の変更（Android は `file://` を返し現状で動作している）

## 9. 承認が必要な点

以下はいずれも**承認済みであり、実装に反映した**。

1. **挙動を変えない移行とすること**（最新200件のまま、ページングは 2-c へ）
2. **`hasNextPage` を `limit(N + 1)` のプロービングで代替すること**
3. **`toFiniteCoordinate` を残すこと**（新APIでは不要だが、教訓をテストごと残す）
4. **`PHFetchOptions` の差（§5）は実機確認で様子を見る**こと。事前に対処しない

実装で新たに確定した点を以下に記す。

- **`photo_assets.asset_id` にも `AssetMetadata.id`（`ph://…`）を入れる。** 旧APIの `asset.id` は
  `ph://` を含まない localIdentifier だったため、`asset_id` の値の形が変わる。
  走査済み時間窓の突き合わせは窓の中しか掃除しないので、**窓の外（走査上限より古い）に残った旧形式の行は
  二度と掃除されず、2-c で深く走査したときに重複マーカーになる**。このため
  **移行時に `photo_assets` を一度だけ全削除する**（`initializeDatabase()` の
  `resetPhotoAssetsForMediaLibraryNextApi()`。実行済みは `app_settings` のキーで記録）。
  `asset_id` の値を変換する案は採らない。Android の `file://` → `content://` が機械的に変換できないため
- **走査結果の `MapPhoto.uri` は既定では `ph://…`（表示用URI未解決）になる。** 旧APIは `localUri` を
  `getAssetInfoAsync` のついでに得ていたが、新APIにその手段が無い（`getUri()` は使えない）。
  この値が描画へ回るのはキャッシュ保存に失敗したときのフォールバック経路だけなので、
  **その経路に限り `resolveMapPhotoDisplayUris` を通して解決する**。これで `ph://` が `<Image>` へ
  到達しうる経路は無くなり、旧実装と同じく画像つきで表示される。保存に成功した場合は走査結果が
  描画に使われないため解決せず、表示範囲の外にある写真ぶんの無駄なサムネイル書き出しを避ける
- **Android では保存する `uri` の形が `file://…` から `content://…` へ変わる。** 新APIの `Asset.id` は
  Android では contentUri だからである（§8 の「Android 実装の変更はしない」はコードの話で、
  値の形は API 差し替えの結果として変わる）。`resolvePhotoDisplayUri` は `ph://` 以外を素通しし、
  React Native の `<Image>` は `content://` を描画できるため表示は成立する見込みだが、**実機で確認する**

## 10. この移行のあとにやること

1. 実機で走査の所要時間を実測する（親設計書 §9-3「2-c 着手前に実機で測ること」）
2. 実測結果をもとに **2-c の設計を見直す**（ブロッキングダイアログが本当に要るか）
3. 同時実行数の再調整を検討する
