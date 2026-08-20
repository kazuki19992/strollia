# 写真マップ表示パイプラインの診断計装

作成日: 2026-08-20

## 背景

実機(production ビルド, 1.2.0 相当)で「設定を ON にしてもマップに写真が表示されない」という不具合が報告された。

調査状況:

- develop の写真パイプライン(`loadGeotaggedPhotos` → `usePhotoMapOverlay` → `usePhotoMapCrashBreaker` → `usePhotoClusters` → `MapScreen`)を静的に読み通したが、明確な欠陥は見つかっていない
- 関連する自動テストはすべて成功している
- シミュレータには写真ライブラリが無く、実機には production ビルドしか入れられないため、**ローカルでの再現手段が無い**

再現できない以上、コードを読み進めても推測が増えるだけになる。そこで
「どのレイヤーで写真が消えているか」を実機の production ビルドから観測できるよう、
Sentry へ診断イベントを送る計装を入れる。

## 目的

次回の TestFlight ビルドで、以下を Sentry 上から確定できるようにする。

1. 写真ライブラリ権限は取れているか(フルアクセスか、限定アクセスか)
2. `getAssetsAsync` は何件返しているか
3. `getAssetInfoAsync` は何件成功/失敗したか
4. ジオタグを持っていた写真は何件か
5. クラスタリング後に何個のクラスタが残ったか

## 非目的

- 不具合の修正そのもの(原因が確定してから別 PR で行う)
- 写真の座標・URI・アセットIDなど、個人を特定しうる情報の送信(**送らない**)

## 設計

### 送信するもの / 送らないもの

送るのは**件数・真偽値・所要時間だけ**。座標、アセットID、URI、ファイル名は一切送らない。
ローカルファースト方針(AGENTS.md §5)に反しないよう、写真メタデータ本体は送信対象外とする。

送信は既存の Sentry 基盤に乗るため、以下は自動的に守られる。

- `isSentryEnabledForBuild()` により production profile のビルドでのみ送信される
- `filterSentryEventBeforeSend` により、不具合レポート設定が OFF のユーザーからは送信されない

### 送信量

1 回の「写真表示 ON」につき最大 3 イベント。ズームやパンでは増えない。

### 1. `src/config/sentry.ts` に診断送信関数を追加

```ts
/** 写真マップ表示パイプラインの調査で使う計装ステージ。 */
export type PhotoMapDiagnosticsStage = 'permission' | 'load' | 'cluster';

/**
 * 写真マップ表示パイプラインの診断値をSentryへ送る。
 *
 * 実機(productionビルド)でしか再現しない「写真が表示されない」不具合の調査用。
 * 座標・アセットID・URIは含めず、件数と真偽値だけを送る。
 */
export function reportPhotoMapDiagnostics(stage: PhotoMapDiagnosticsStage, data: Record<string, unknown>): void;
```

実装は `Sentry.withScope` の中で

- `scope.setTag('investigation_area', 'photo-map')`
- `scope.setTag('photo_map_stage', stage)`
- `scope.setContext('photoMap', data)`
- `Sentry.captureMessage(\`photo-map: ${stage}\`, 'info')`

送信自体が失敗しても本来の処理を壊さないよう、内部で try/catch して握りつぶす。

### 2. `permission` ステージ

`src/ui/hooks/usePhotoMapCrashBreaker.ts` の `updateShowPhotosOnMap` 内、
`MediaLibrary.requestPermissionsAsync` の直後に送る。

| キー               | 内容                                    |
| ------------------ | --------------------------------------- |
| `granted`          | `permission.granted`                    |
| `accessPrivileges` | `permission.accessPrivileges ?? null`   |
| `hasFullAccess`    | `hasFullPhotoAccess(permission)` の結果 |

保存済み設定からの復元経路(`shouldRestorePhotosOnMapAfterMapReady` の effect)は
権限要求を通らないため、このステージは送らない。

### 3. `load` ステージ

`src/features/photos/photoLibrary.ts` の `loadGeotaggedPhotos` の末尾で送る。

| キー                      | 内容                                          |
| ------------------------- | --------------------------------------------- |
| `requestedLimit`          | 引数 `limit`                                  |
| `scannedAssetCount`       | `page.assets.length`                          |
| `hasNextPage`             | `page.hasNextPage`                            |
| `assetInfoFulfilledCount` | `getAssetInfoAsync` が fulfilled だった件数   |
| `assetInfoRejectedCount`  | 同 rejected だった件数                        |
| `geotaggedPhotoCount`     | 最終的に返した写真の件数                      |
| `durationMs`              | 関数全体の所要ミリ秒(`Date.now()` 差分、整数) |

`loadGeotaggedPhotos` が例外で落ちた場合はこの計装を通らないが、
その経路は `usePhotoMapOverlay` が `photoErrorMessage` を立てて UI に出すため計装不要。

### 4. `cluster` ステージ

新規フック `src/ui/hooks/usePhotoMapClusterDiagnostics.ts` を追加する。

```ts
export type UsePhotoMapClusterDiagnosticsParams = {
  /** 写真表示が有効かどうか。false の間は送信しない。 */
  enabled: boolean;
  /** 読み込み済みのジオタグ付き写真一覧。 */
  photos: MapPhoto[];
  /** クラスタリング結果。 */
  clusters: MapPhotoCluster[];
};

export function usePhotoMapClusterDiagnostics(params: UsePhotoMapClusterDiagnosticsParams): void;
```

| キー           | 内容              |
| -------------- | ----------------- |
| `photoCount`   | `photos.length`   |
| `clusterCount` | `clusters.length` |

送信条件: `enabled` が true で、かつ **`photos` の参照が前回送信時から変わったとき**だけ送る。
ズーム変更でクラスタ半径だけが変わるケースでは送らない(イベントが増えすぎるため)。
前回送信した `photos` 参照は ref に保持する。`enabled` が false になったら ref をクリアし、
再度 ON にしたときにまた送れるようにする。

`usePhotoClusters` 自体は純粋なメモ化フックとして保つため、計装は別フックに分離する。

### 5. 結線

`src/ui/state/AppStateProvider.tsx` で `photoClusters` を算出している箇所の直後に
`usePhotoMapClusterDiagnostics({ enabled: showPhotosOnMap, photos, clusters: photoClusters })` を呼ぶ。

## 作業タスク

TDD(テストを先に書いて red を確認してから実装)で進める。

### Task 1: `reportPhotoMapDiagnostics` の追加

- テスト: `src/config/__tests__/sentry.test.ts`(既存があれば追記、無ければ新規)
  - production profile のとき `Sentry.captureMessage` が期待するタグ・context 付きで呼ばれる
  - Sentry 側が例外を投げても呼び出し元へ伝播しない
- 実装: `src/config/sentry.ts`

### Task 2: `load` ステージの計装

- テスト: `src/features/photos/__tests__/photoLibrary.test.ts` に追記
  - `@/config/sentry` をモックし、`reportPhotoMapDiagnostics` が期待する件数で呼ばれる
  - 一部の `getAssetInfoAsync` が reject しても fulfilled/rejected 件数が正しい
  - **既存テスト(返り値の内容)が壊れていないこと**
- 実装: `src/features/photos/photoLibrary.ts`

### Task 3: `permission` ステージの計装

- テスト: `src/ui/hooks/__tests__/usePhotoMapCrashBreaker.test.tsx`(既存があれば追記、無ければ新規)
  - 権限がフルアクセスのとき `hasFullAccess: true` で送られる
  - 限定アクセスのとき `hasFullAccess: false` で送られる(既存の Alert 挙動は変えない)
- 実装: `src/ui/hooks/usePhotoMapCrashBreaker.ts`

### Task 4: `cluster` ステージのフックと結線

- テスト: `src/ui/hooks/__tests__/usePhotoMapClusterDiagnostics.test.tsx`(新規)
  - `enabled: false` のときは送らない
  - `enabled: true` で初回に 1 回送る
  - 同じ `photos` 参照のまま `clusters` だけ変わっても再送しない
  - `photos` 参照が変わったら再送する
  - `enabled` を false → true に戻したら再送する
- 実装: `src/ui/hooks/usePhotoMapClusterDiagnostics.ts` + `src/ui/state/AppStateProvider.tsx` への結線
- 既存の router 統合テストが `@/config/sentry` をハンドモックしている場合、
  `reportPhotoMapDiagnostics: jest.fn()` の追加が必要になる可能性がある(要確認)

### Task 5: ドキュメント更新

- `docs/photo-geotag.md` に「調査用の Sentry 計装」節を追加し、
  送信する項目・送信しない項目・一時的な計装である旨を明記する

## 完了条件

- `npm run typecheck` が通る
- `npm test` が通る(既知の失敗 `DailyLogDetailGifGeneration.test.tsx` の 2 件を除く)
- `npm run lint` が error 0
- 座標・アセットID・URI が送信対象に一切含まれていないことをコードレビューで確認

## 撤去について

これは原因特定のための一時的な計装である。原因が確定して修正が入った後、
`load` / `cluster` ステージの常時送信は撤去するか、閾値付き(件数が 0 のときだけ送る等)へ
絞り込むことを検討する。
