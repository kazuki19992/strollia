# スタンプラリー: 無料/有料パック区分 設計書

作成日: 2026-09-27

## 1. 背景と目的

「スポット訪問実績」を **スタンプラリー** という機能名でユーザーへ見せる。あわせて、パック（スタンプラリー企画）を無料パックと有料パックに分け、Strollia Plus 限定だった機能を「一部は誰でも使える」形へ広げる。

意図は2つある。

- **客寄せ**: 無料パックを1〜2個常設することで、Plus未加入ユーザーにも実際に使える状態のコンテンツを提供し、Plusへの動機づけにする
- **将来の企業コラボ・広告タイアップの受け皿**: 「無料パック」という区分を用意しておけば、将来スポンサー付きのスタンプラリー企画を追加するときに新しい仕組みを作らずに済む

前提の設計書は `docs/superpowers/specs/2026-09-23-landmark-spot-achievements-design.md`（以下「初版設計書」）。本書はその変更差分として書く。初版設計書の用語・全体構成はそのまま踏襲し、本書で扱わない事項は初版設計書を正とする。

## 2. スコープ

### 2.1 対象

- パックへの `isFree` フラグ追加（データモデル・スキーマ・生成物）
- 到達検知ロジックの、機能全体ゲートから「パック単位」ゲートへの組み替え
- 実績画面のパック一覧表示を「全パック表示・パック単位で施錠」へ変更
- 「スタンプラリー」への表示文言変更（セクション見出し・Plus誘導文）
- パイロットパック「日本三名瀑」を無料パックへ変更

### 2.2 非対象

| 項目                                           | 理由                                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| パック単位の買い切りIAP                        | 初版設計書 §4.3 の想定どおり将来の課題。今回は「Plusサブスクに必要」の1軸のみを実装する |
| オリジナルスタンプラリー作成＋QRコード配布機能 | 有料ユーザー向けの将来機能。今回は構想を記録するのみで設計・実装はしない（第7節）       |
| 到達通知タイトルの文言変更                     | 「スポットに到達しました！」のまま変更しない（ユーザー判断）                            |
| 個々のパック名（「日本三名瀑」等）の変更       | 「スタンプラリー」は機能全体のブランドとして使い、個別パック名はそのまま                |
| 既存10パック(未作成)の無料/有料判定            | データ未作成のため今回は対象外。作成時に個別判断する                                    |

## 3. 表示文言の変更

| 定数                                | 現在                                                                   | 変更後                                                         |
| ----------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| `LANDMARK_PACK_SECTION_TITLE`       | `スポット (Strollia Plus)`                                             | `スタンプラリー`                                               |
| `LANDMARK_PACK_PLUS_PROMOTION_NOTE` | `Strollia Plus なら、今後追加されるスポットパックもすべて集められます` | `Strollia Plus なら、有料のスタンプラリーもすべて集められます` |

`LANDMARK_PACK_SECTION_TITLE` から `(Strollia Plus)` の注記を外す。全パックが Plus 限定ではなくなるため、セクション全体に Plus 限定のラベルを付けるのは実態と合わない。個々のパックの施錠有無は行ごとの鍵アイコンで表現する（第6節）。

個別のパック名・スポット名・通知本文など、この節で挙げていない文言は変更しない。

## 4. データモデル: `isFree` フラグ

### 4.1 スキーマ

`data/landmarks/landmarkPacks.schema.json` の `required` に `isFree` を追加し、`properties` へ以下を追加する。

```json
"isFree": {
  "type": "boolean",
  "description": "trueなら無料で誰でも到達検知・完走できる。falseならStrollia Plusのサブスクが必要"
}
```

**必須項目とする。** 省略を許すと「フラグの付け忘れで有料のつもりのパックが無料公開される」事故につながる。デフォルト値は用意せず、パック追加のたびに明示的に選ばせる。

### 4.2 データ更新

`data/landmarks/landmarkPacks.json` の唯一のパック（日本三名瀑、`id: 01a0c450-6c00-7000-8000-000000000001`）に `"isFree": true` を追加する。

### 4.3 生成物・型

`scripts/generate-landmark-catalog.mjs` の TS 生成テンプレートで `isFree` をそのまま通す。`src/features/landmarks/landmarkCatalog.generated.ts` の `GeneratedLandmarkPack` 型、`src/features/landmarks/landmarkCatalog.ts` の `LandmarkPack` 型（`trophyImageUri` を合成する既存のラッパー型）の両方へ `isFree: boolean` を追加する。

### 4.4 パック所属からスポットの無料判定を導く関数

スポットは複数パックに属しうる（初版設計書 §5.1）。**スポットが属するパックのうち1つでも無料なら、そのスポットは無料として扱う。** 物理的な場所そのものは1つであり、無料パックの一部でもある以上、そこへ到達したという事実自体は無料ユーザーにも開いてよいという考え方による。副作用として、その到達が同時に所属する有料パックの進捗も進めるが、これは初版設計書 §5.1 が元々許容している「多対多」の性質であり、新たな懸念ではない。

`src/features/landmarks/landmarkCatalog.ts` へ追加する。

```ts
/** スポットが少なくとも1つの無料パックに属するか。 */
export function isLandmarkSpotInFreePack(spot: LandmarkSpot): boolean {
  return spot.packs.some((membership) => getLandmarkPackById(membership.packId)?.isFree === true);
}
```

## 5. 到達検知ロジックの組み替え

### 5.1 現状

`src/features/landmarks/landmarkRecordingService.ts` の `LandmarkDetectionSnapshot` は3値だった。

```ts
type LandmarkDetectionSnapshot =
  | { status: 'enabled'; spots: readonly LandmarkSpot[]; visitedSpotIds: ReadonlySet<string> }
  | { status: 'disabled' } // Plus無効。検知を一切行わない
  | { status: 'unavailable' }; // 課金状態の取得失敗。滞在状態を保持する
```

Plus が無効なら `'disabled'` を返し、`recordLocationObservation` 側が到達判定そのものをスキップして滞在状態をリセットしていた（初版設計書 §4.1・§7.3）。

### 5.2 変更後

**`'disabled'` を廃止する。** 検知の可否は「機能全体」ではなく「スポットが無料パックに属するか、Plus が有効か」で決まるため、二値の `enabled`/`disabled` という区分がそもそも成立しない。

```ts
type LandmarkDetectionSnapshot =
  { status: 'enabled'; spots: readonly LandmarkSpot[]; visitedSpotIds: ReadonlySet<string> } | { status: 'unavailable' };
```

```ts
export async function getLandmarkDetectionSnapshotForRecording(): Promise<LandmarkDetectionSnapshot> {
  try {
    const premiumAccessState = await getConfirmedPremiumAccessState();
    const spots = getDetectableLandmarkSpots().filter((spot) => premiumAccessState.isPlusActive || isLandmarkSpotInFreePack(spot));

    return { status: 'enabled', spots, visitedSpotIds: await getVisitedLandmarkSpotIds() };
  } catch (error: unknown) {
    console.warn('Landmark detection snapshot loading failed:', error);
    return { status: 'unavailable' };
  }
}
```

`'unavailable'`（課金状態取得の失敗）は変更しない。取得できないときに「無料スポットだけ検知する」という中間状態は作らない。失敗は一時的なものであり、次回の正常取得まで滞在状態を保持するほうが、中途半端なフィルタで誤った検知結果を出すより安全である（初版設計書 §4.1 の考え方を維持）。

### 5.3 呼び出し側の簡略化

`src/features/location/locationObservationRecorder.ts` の `resolveLandmarkArrivalForObservation` は `detection.status === 'disabled'` の分岐を削除する。`'unavailable'` の分岐（滞在状態を保持）はそのまま残す。

```ts
function resolveLandmarkArrivalForObservation(...): { state: LandmarkArrivalState; arrivedSpotId: string | null } {
  if (detection.status === 'unavailable') {
    return { state: toLandmarkArrivalState(persistedState), arrivedSpotId: null };
  }

  return resolveLandmarkArrival({ ... spots: detection.spots, ... });
}
```

### 5.4 Plus解約時の挙動（副次的な改善）

Plus 加入中に有料パックのスポットへ滞在中（`landmarkCandidateSpotId` が設定された状態）に解約が発生した場合、次の配信バッチで `spots` からそのスポットが消える。`resolveLandmarkArrival` の `findClosestSpotInRadius` は与えられた `spots` の中からしか候補を探さないため、そのスポットは候補として見つからなくなり、`resolveWhileOutside` の「2回連続で圏外なら状態をリセット」の経路を通る。

これは旧 `'disabled'` が単一観測で即座にリセットしていたのに比べて**穏やかな失効**であり、退行ではなく改善として扱う。特別な分岐は追加しない。

## 6. UI: 全パック表示とパック単位の施錠

### 6.1 `useLandmarkPackState`

`src/ui/hooks/useLandmarkPackState.ts` の `landmarkPackItems` から「Plus無効なら先頭1件だけ表示する」絞り込みを削除し、**常に全パックを表示**する。施錠判定をパック単位にする。

```ts
const landmarkPackItems = useMemo<LandmarkPackListItem[]>(() => {
  return LANDMARK_PACKS.map((pack) => {
    const progress = progressByPackId.get(pack.id);
    const isLocked = !pack.isFree && !isPlusActive;

    return {
      pack,
      visitedCount: isLocked ? 0 : (progress?.visitedCount ?? 0),
      totalCount: progress?.totalCount ?? 0,
      isLocked,
    };
  });
}, [isPlusActive, visitedLocalDateBySpotId]);
```

無料パックは `isPlusActive` の値に関わらず `isLocked: false`。有料パックは Plus 無効時のみ `isLocked: true`。

### 6.2 `AchievementListScreen`

パック行の描画ロジック自体は変更しない（`isLocked` に応じた鍵バッジ・進捗非表示は既存のまま機能する）。変更するのは Plus 誘導文の表示条件のみ。

現状は `!isPlusActive` の間は常に表示していた。変更後は「施錠中のパックが1件でも残っている場合」だけ表示する。

```tsx
{
  landmarkPackItems.some((item) => item.isLocked) ? (
    <DescriptionText styles={styles}>{LANDMARK_PACK_PLUS_PROMOTION_NOTE}</DescriptionText>
  ) : null;
}
```

`isLocked` は `!pack.isFree && !isPlusActive` からしか true にならないため、この条件は暗黙に「Plus無効かつ有料パックが存在する」場合だけ真になる。`!isPlusActive` を明示的に併記する必要はない。

## 7. 将来構想（今回は設計・実装しない）

### 7.1 企業コラボ・広告タイアップのスタンプラリー

無料パックという区分そのものが、将来のスポンサー付き企画の受け皿になる。`isFree: true` のパックを追加するだけで実現でき、今回追加する仕組み以外に新しい概念は必要ないと見込んでいる。実際に企画が来た際は、スポンサー名の表示方法など別途検討する。

### 7.2 オリジナルスタンプラリー作成＋QRコード配布

Plus ユーザー向けに、自分で地点を選んでオリジナルのスタンプラリーを作成し、QRコードとして配布できるようにする構想がある。配布された側がQRコードを読み込むと、そのスタンプラリーが端末に追加される、という体験を想定している。

**今回は構想の記録のみとし、設計・実装は行わない。** 現在のマスタデータはビルド時にバンドルへ焼き込む方式（初版設計書 §5.3）のため、ユーザーが動的に作成したパックをどう配布・保存するかは全く別のデータフローが必要になり、この設計書のスコープを大きく超える。着手する際はあらためてブレインストーミングから行う。

## 8. ドキュメント更新

- `docs/superpowers/specs/2026-09-23-landmark-spot-achievements-design.md` §3.2・§4.1 に、無料パックは検知対象になる旨の注記と本書への相互参照を追記する
- `docs/landmark-spot-packs.md` に無料/有料パックの選定方針（無料は1〜2個の客寄せ目的に留める、既定は有料）を追記する
- `docs/achievements.md` / `docs/plus-features.md` のスポット実績（スタンプラリー）に関する記述を、全パックがPlus限定ではない旨に合わせて更新する

## 9. テスト方針

| 対象                                                           | 検証内容                                                                                                                                                                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `isLandmarkSpotInFreePack`                                     | 無料パックのみ所属／有料パックのみ所属／両方に所属（多対多）の3パターン                                                                                                                                      |
| `getLandmarkDetectionSnapshotForRecording`                     | Plus無効でも無料パックのスポットは`spots`に含まれること、有料パックのスポットは含まれないこと、Plus有効なら両方含まれること、課金状態取得失敗時は`unavailable`を返すこと（`disabled`が無くなったことの回帰） |
| `resolveLandmarkArrivalForObservation`（recorder内部ロジック） | `unavailable`時に滞在状態を保持すること。`disabled`分岐が無くなったことに伴うテストの整理                                                                                                                    |
| `useLandmarkPackState`                                         | Plus無効時に無料パックが`isLocked: false`で進捗つきで返ること、有料パックが`isLocked: true`で返ること、全パックが表示されること（先頭1件への絞り込みが無いこと）                                             |
| `AchievementListScreen`                                        | 施錠パックが0件のとき誘導文が出ないこと、1件以上あるとき出ること                                                                                                                                             |
| 表示文言                                                       | セクション見出し・誘導文が新しい文言になっていること                                                                                                                                                         |

テストの説明文は日本語で書く（`AGENTS.md` §9）。既存の `'disabled'` を前提にしたテスト（`landmarkRecordingService.test.ts`、`locationObservationRecorder.test.ts`、`backgroundLocationTask.test.ts` のモック等）は新しい2値の型に合わせて更新する。
