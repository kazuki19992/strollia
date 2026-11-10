# 複数地点スポット Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1スポットに複数の到達地点を持たせ、全地点の到達でスポット到達(コンプリート)とする仕組みを、既存の円1つのスポットの挙動を変えずに追加する。

**Architecture:** マスタのスポットを生成時に「地点リスト」へ正規化する(円1つのスポットは地点ID=スポットIDの1地点)。到達判定は地点単位に一般化し、複数地点スポットの地点到達は新テーブル `landmark_area_visits` に記録、全地点が揃った観測で同じトランザクション内に従来の `landmark_spot_visits` へも記録する。パック完走・実績は従来どおり `landmark_spot_visits` だけを見る。

**Tech Stack:** Expo / React Native / TypeScript strict / expo-sqlite / react-native-maps / jest + @testing-library/react-native / Node(生成スクリプト、Ajv2020, sharp)

**Spec:** `docs/superpowers/specs/2026-11-10-multi-area-landmark-spots-design.md`

## Global Constraints

- 既存の円1つのスポット(全32件)は、データ(`landmarkSpots.json`)・到達タイミング・通知・見た目を変えない。既存テストは期待値を変えずに通ること(型変更に伴うフィクスチャの書き換えは可)
- 永続化済みの計測中状態列 `location_recording_state.landmark_candidate_spot_id` は列名を変えず、意味を「計測中の地点ID」に広げる
- 地点の円は、他のどの円(同じスポットの別地点・別スポットの地点・円1つのスポット)とも重ならない。生成時にエラー(issue #201 で将来緩和)
- 複数地点スポットは `areas` を2件以上持ち、`latitude`/`longitude`/`radiusMeters`/`dwellSeconds` を持たない。円1つのスポットはその逆
- 地点IDは UUIDv7 形式で、全スポットID・全地点IDの中で一意
- 地点到達・スポット到達は `INSERT OR IGNORE`(初回が正、取り消さない)
- コンプリート記念スタンプは複数地点スポットだけ。円1つは従来の「訪問済み」スタンプ
- 文言は日本語、太字にしない、`StyleSheet.create` は components 配下で使わず `src/ui/styles/achievementStyles.ts` へ、`@/` import、日本語JSDoc・日本語テスト名(AGENTS.md / `.ai/context/*`)
- DB変更は `.claude/skills/db-schema-change/SKILL.md` に従う。画面変更前に `DESIGN.md` を読む
- 各タスク完了時に `npm run typecheck` / 対象テスト、最終タスクで `npm test` / `npm run lint`(error 0)

## Review Focus

- 同じ配信バッチ内で同じ地点が再び候補になり滞在を満たす(スナップショットは直前の到達を含まない) → 2回目は行が増えずイベントも出ない。Task 3 でテスト
- 最後の地点に到達した時点で、既にそのスポットの到達行がある(別経路で記録済み等) → スポット到達イベントを重複して出さない。Task 3 でテスト
- 地点を何日かに分けて回る → 途中の地点記録は残り、スポット到達の日付は最後の地点の日付。Task 3 でテスト
- 旧バージョンで保存された計測中状態(候補=円1つのスポットID)のままアップデート → 滞在計測がリセットされず継続する。Task 1 でテスト
- 有料パックの複数地点スポットを途中まで回ってPlusが切れ、後で戻る → 途中の地点記録は保持され、Plus無効中はその地点を検知しない。Task 3 でテスト

---

### Task 1: マスタの地点モデルと地点単位の到達判定

**Files:**

- Modify: `data/landmarks/landmarkSpots.schema.json`
- Modify: `scripts/generate-landmark-catalog.mjs`
- Regenerate: `src/features/landmarks/landmarkCatalog.generated.ts`(`node scripts/generate-landmark-catalog.mjs`)
- Modify: `src/features/landmarks/landmarkCatalog.ts`
- Modify: `src/features/landmarks/landmarkArrivalResolver.ts`
- Modify: `src/features/location/locationObservationRecorder.ts`(呼び出しの追従のみ)
- Modify: `src/ui/components/LandmarkPackMapPreview.tsx`(座標参照の追従のみ: マーカーを地点ごとに作る)
- Create: `src/features/landmarks/__tests__/generateLandmarkCatalog.test.ts`
- Modify: `src/features/landmarks/__tests__/landmarkArrivalResolver.test.ts`、`landmarkCatalog.test.ts`、および `LandmarkSpot` を組み立てている既存テストのフィクスチャ

**Interfaces:**

- Produces(生成型、`landmarkCatalog.generated.ts`):
  ```ts
  export type GeneratedLandmarkArea = {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    dwellSeconds: number;
    note?: string;
  };
  export type GeneratedLandmarkSpot = {
    id: string;
    name: string;
    prefectures: readonly string[];
    /** 1件以上。円1つのスポットは id/name がスポットと同じ1件に正規化済み。 */
    areas: readonly GeneratedLandmarkArea[];
    /** マスタで areas を持つスポットなら true。 */
    isMultiArea: boolean;
    retired?: boolean;
    note?: string;
    packs: readonly LandmarkPackMembership[];
  };
  ```
  スポット直下の `latitude`/`longitude`/`radiusMeters`/`dwellSeconds` は生成型から無くす。
- Produces(`landmarkCatalog.ts`): `export type LandmarkArea = GeneratedLandmarkArea;` / `export function getLandmarkAreaById(areaId: string): { area: LandmarkArea; spot: LandmarkSpot } | null`
- Produces(`landmarkArrivalResolver.ts`):
  ```ts
  export type LandmarkArrivalState = { candidateAreaId: string | null; candidateEnteredAt: string | null; outsideCount: number };
  export type LandmarkAreaArrival = { spotId: string; areaId: string };
  export function resolveLandmarkArrival(input: {
    state: LandmarkArrivalState;
    observation: LandmarkArrivalObservation;
    spots: readonly LandmarkSpot[];
    visitedSpotIds: ReadonlySet<string>;
    visitedAreaIds: ReadonlySet<string>;
  }): { state: LandmarkArrivalState; arrival: LandmarkAreaArrival | null };
  ```
  候補から除外: `spot.retired`、`visitedSpotIds.has(spot.id)`、`visitedAreaIds.has(area.id)`。同距離は地点ID昇順。滞在は地点の `dwellSeconds`。
- 生成スクリプトはテスト用に環境変数 `LANDMARK_DATA_DIR`(既定 `data/landmarks`)と `LANDMARK_CATALOG_OUTPUT`(既定は現在の出力パス)で入出力先を差し替えられる。

- [ ] **Step 1: 生成スクリプトの失敗するテストを書く** — `generateLandmarkCatalog.test.ts` で、一時ディレクトリにスキーマ2つ(実ファイルをコピー)と最小のパック/スポットJSONを書き、`spawnSync('node', ['scripts/generate-landmark-catalog.mjs'], { env: { ...process.env, LANDMARK_DATA_DIR, LANDMARK_CATALOG_OUTPUT } })` を実行する。テスト:
  - `areas を2件持つスポットは成功し、生成物に isMultiArea: true と2件の areas を出力する`(status 0、出力文字列に地点IDが含まれる)
  - `円1つのスポットは地点ID・地点名がスポットと同じ1件の areas に正規化される`
  - `areas と latitude を両方持つスポットはエラーになる` / `areas が1件のスポットはエラーになる`(status ≠ 0)
  - `地点IDが他のスポットIDと重複するとエラーになる`
  - `地点の円が別スポットの円と重なるとエラーになる` / `同じスポットの地点同士の円が重なるとエラーになる`(メッセージに両方の名前を含む)
- [ ] **Step 2: 実行して失敗を確認** — Run: `npx jest src/features/landmarks/__tests__/generateLandmarkCatalog.test.ts` Expected: FAIL
- [ ] **Step 3: スキーマと生成スクリプトを実装** — スキーマは `oneOf` で「4項目必須」か「`areas`(minItems 2)必須」を表し、地点の各項目に説明を付ける。生成スクリプトは環境変数対応、ID一意(スポット+地点の全体)、円の重なり検証(retired を除く全地点の全組み合わせ、`距離 < 半径の和` でエラー、距離はハバーサイン)、正規化した `areas`/`isMultiArea` の出力、上記の生成型を出す。
- [ ] **Step 4: 再生成してテストが通ることを確認** — Run: `node scripts/generate-landmark-catalog.mjs && npx jest src/features/landmarks/__tests__/generateLandmarkCatalog.test.ts` Expected: PASS(既存32件のスポットは全て `isMultiArea: false`、`areas` 1件)
- [ ] **Step 5: 到達判定の失敗するテストを書く** — `landmarkArrivalResolver.test.ts` に追加:
  - `複数地点スポットの地点で滞在を満たすと、その地点の到達を返す`(`arrival` が `{ spotId, areaId }`)
  - `到達済みの地点は候補にならず、同じスポットの別地点は計測できる`
  - `到達済みスポットの地点はすべて候補にならない`
  - `旧形式の計測中状態(候補=円1つのスポットID)から滞在計測を引き継ぐ`(`candidateAreaId` にスポットIDを入れた状態で、入場時刻がリセットされず `dwellSeconds` 経過で到達)
  - 既存テストは `arrivedSpotId` → `arrival?.spotId`、`candidateSpotId` → `candidateAreaId` の機械的置換と `visitedAreaIds: new Set()` の追加のみで通すこと
- [ ] **Step 6: 失敗を確認** — Run: `npx jest src/features/landmarks/__tests__/landmarkArrivalResolver.test.ts` Expected: FAIL
- [ ] **Step 7: resolver・catalog・呼び出し側を実装** — resolver は全スポットの `areas` を走査して最寄りの未到達地点を候補にする。`getLandmarkAreaById` を追加。`locationObservationRecorder.ts` は `toLandmarkArrivalState` で永続化値 `landmarkCandidateSpotId` を `candidateAreaId` へ写し、書き戻しも同様(列名・永続化型のプロパティ名は変えない)。`visitedAreaIds` には当面 `detection.visitedSpotIds` を渡す(円1つは地点ID=スポットIDのため正しい)。到達は `arrival && arrival.areaId === arrival.spotId` のときだけ従来どおりスポット到達を記録する(複数地点の記録は Task 3)。`LandmarkPackMapPreview` はマーカーを `spot.areas` から地点ごとに作る(key・識別子は地点ID、番号はスポットの番号、名前は地点名、条件は地点の `dwellSeconds`)。フォーカスは当面スポットIDで最初の地点を探す(Task 6 で置き換え)。
- [ ] **Step 8: 型チェックと関連テスト** — Run: `npm run typecheck && npx jest src/features/landmarks src/features/location src/ui/components/__tests__/LandmarkPack` Expected: PASS
- [ ] **Step 9: Commit** — `feat(landmarks): スポットを地点リストへ正規化し到達判定を地点単位にする`

### Task 2: 地点到達のテーブルとリポジトリ

**Files:**

- Modify: `src/db/database.ts`(`landmark_spot_visits` の隣に `CREATE TABLE IF NOT EXISTS landmark_area_visits` とインデックス)
- Modify: `src/features/landmarks/landmarkVisitRepository.ts`
- Modify: `src/features/logs/logRepository.ts:307` 付近(全削除で `DELETE FROM landmark_area_visits` も行う)
- Modify: `docs/data-storage.md`
- Test: `src/features/landmarks/__tests__/landmarkVisitRepository.test.ts`、`logRepository` の全削除テスト、`database` 初期化テスト(既存のパターンに合わせる)

**Interfaces:**

- テーブル: `landmark_area_visits(area_id TEXT PRIMARY KEY, spot_id TEXT NOT NULL, visited_at TEXT NOT NULL, visited_local_date TEXT NOT NULL, location_point_id INTEGER NULL, created_at TEXT NOT NULL)`、`CREATE INDEX IF NOT EXISTS idx_landmark_area_visits_spot_id ON landmark_area_visits(spot_id)`
- Produces(`landmarkVisitRepository.ts`):

  ```ts
  export type LandmarkAreaVisit = {
    areaId: string;
    spotId: string;
    visitedAt: string;
    visitedLocalDate: string;
    locationPointId: number | null;
  };
  export function getLandmarkAreaVisits(): Promise<LandmarkAreaVisit[]>;
  export function getVisitedLandmarkAreaIds(): Promise<Set<string>>;
  export function insertLandmarkAreaVisitInCurrentTransaction(
    visit: LandmarkAreaVisit,
    createdAt: string,
    runner: SQLite.SQLiteDatabase,
  ): Promise<boolean>; // INSERT OR IGNORE、行が増えたら true
  export function countLandmarkAreaVisitsForSpotInCurrentTransaction(spotId: string, runner: SQLite.SQLiteDatabase): Promise<number>;
  ```

- [ ] **Step 1: 失敗するテストを書く** — `地点到達をINSERT OR IGNOREで記録し、新規ならtrueを返す` / `同じ地点の再記録はfalseを返す`(`changes: 0`)/ `スポットごとの地点到達件数を数える`(SQLに `spot_id = ?` とスポットIDが渡る)/ `到達済み地点IDの集合を返す` / 全削除テストに `DELETE FROM landmark_area_visits` が流れること / DB初期化で `landmark_area_visits` の CREATE が流れること
- [ ] **Step 2: 失敗を確認** — Run: `npx jest src/features/landmarks/__tests__/landmarkVisitRepository.test.ts src/features/logs src/db` Expected: FAIL
- [ ] **Step 3: 実装** — 既存の `landmark_spot_visits` 系関数と同じ書き方。`docs/data-storage.md` にテーブル定義と、`landmark_candidate_spot_id` の意味が「計測中の地点ID(円1つのスポットではスポットIDと同値)」であることを追記。
- [ ] **Step 4: 通ることを確認** — 同コマンド Expected: PASS、`npm run typecheck` PASS
- [ ] **Step 5: Commit** — `feat(db): 複数地点スポットの地点到達を保存するテーブルを追加`

### Task 3: 記録処理で地点到達とコンプリートを記録する

**Files:**

- Modify: `src/features/landmarks/landmarkRecordingService.ts`
- Modify: `src/features/location/locationObservationRecorder.ts`
- Test: `src/features/landmarks/__tests__/landmarkRecordingService*.test.ts`、`src/features/location/__tests__/locationObservationRecorder*.test.ts`(既存ファイル名に合わせる)

**Interfaces:**

- Consumes: Task 1 の `resolveLandmarkArrival` / `LandmarkAreaArrival` / `getLandmarkAreaById`、Task 2 のリポジトリ関数
- Produces:

  ```ts
  // landmarkRecordingService.ts
  export type LandmarkDetectionSnapshot =
    | { status: 'enabled'; spots: readonly LandmarkSpot[]; visitedSpotIds: ReadonlySet<string>; visitedAreaIds: ReadonlySet<string> }
    | { status: 'unavailable' };
  // locationObservationRecorder.ts
  export type LandmarkArrivalEvent =
    { type: 'spot'; spotId: string } | { type: 'area'; spotId: string; areaId: string; visitedAreaCount: number; totalAreaCount: number };
  // RecordLocationObservationResult の saved / not-saved は arrivedLandmarkSpotId の代わりに
  // landmarkArrival: LandmarkArrivalEvent | null を持つ
  ```
  - `visitedAreaIds` は `getVisitedLandmarkAreaIds()` の結果(円1つのスポットの到達はスポットIDで `visitedSpotIds` 側が除外する)
  - 円1つのスポットの到達: 従来どおりスポット到達を挿入し、行が増えたら `{ type: 'spot' }`
  - 複数地点スポットの地点到達: 地点到達を挿入。増えなければイベントなし。増えたら件数を数え、`件数 === spot.areas.length` ならスポット到達を挿入(日時・日付・根拠GPS点はこの観測のもの)し、行が増えたら `{ type: 'spot' }`、増えなければイベントなし。件数が足りなければ `{ type: 'area', visitedAreaCount: 件数, totalAreaCount: spot.areas.length }`

- [ ] **Step 1: 失敗するテストを書く**
  - recordingService: `検知対象に到達済み地点IDの集合を含める` / `Plus無効時は有料パックの複数地点スポットの地点を検知対象に含めない`(既存の free/paid テストのパターン)
  - recorder: `複数地点スポットの途中の地点ではスポット到達を記録せず area イベントを返す`(1/3)/ `最後の地点で同じトランザクション内にスポット到達を記録し spot イベントを返す`(スポット到達の visitedAt・visitedLocalDate がこの観測の値)/ `同じ地点への再到達は行が増えずイベントを返さない` / `最後の地点でスポット到達の行が既にある場合はイベントを返さない` / `円1つのスポットは従来どおり spot イベントを返し地点記録を作らない`
- [ ] **Step 2: 失敗を確認** — Run: `npx jest src/features/landmarks src/features/location` Expected: FAIL
- [ ] **Step 3: 実装** — スナップショットへ `visitedAreaIds` を追加し、recorder を上記の分岐で実装(スポットの解決は `getLandmarkAreaById(arrival.areaId)`)。`arrivedLandmarkSpotId` を参照している `locationRecordingSession.ts` は、この Task では `landmarkArrival?.type === 'spot'` のスポットIDを従来の配列へ入れるだけに追従させる(area の通知は Task 4)。
- [ ] **Step 4: 通ることを確認** — Run: `npm run typecheck && npx jest src/features` Expected: PASS
- [ ] **Step 5: Commit** — `feat(landmarks): 複数地点スポットの地点到達とコンプリートを記録する`

### Task 4: 途中経過とコンプリートの通知

**Files:**

- Modify: `src/features/landmarks/landmarkNotificationService.ts`
- Modify: `src/features/location/locationRecordingSession.ts`
- Test: `src/features/landmarks/__tests__/landmarkNotificationService.test.ts`、`locationRecordingSession` のテスト

**Interfaces:**

- Consumes: Task 3 の `LandmarkArrivalEvent`
- Produces: `export async function notifyLandmarkAreaArrival(event: { areaId: string; visitedAreaCount: number; totalAreaCount: number }): Promise<void>`
- 文言(タイトル / 本文):
  - 地点到達: `地点に到達しました！` / `${area.name}に到達しました（${spot.name} ${visitedAreaCount}/${totalAreaCount}）`
  - 複数地点スポットのコンプリート(`notifyLandmarkSpotArrival` で `spot.isMultiArea` のとき): `スポットをコンプリートしました！` / `${spot.name}をコンプリートしました（${パック進捗}）`(パック進捗の書式は既存と同じ)
  - 円1つのスポット: 変更なし
- `data` は地点到達なら `{ landmarkAreaId, landmarkSpotId }`、それ以外は既存どおり

- [ ] **Step 1: 失敗するテストを書く** — 上記3パターンのタイトル・本文の完全一致 / 通知権限がないときは地点到達も通知しない / セッション: `area イベントは地点到達通知を出し、実績の再評価はしない` / `spot イベントは従来どおりスポット到達通知と、保存点なしバッチでの実績再評価を行う`
- [ ] **Step 2: 失敗を確認** — Run: `npx jest src/features/landmarks/__tests__/landmarkNotificationService.test.ts src/features/location` Expected: FAIL
- [ ] **Step 3: 実装** — セッションはバッチ内のイベントを順に保持し、実績処理より前に、到達順で通知する
- [ ] **Step 4: 通ることを確認** — 同コマンド + `npm run typecheck` Expected: PASS
- [ ] **Step 5: Commit** — `feat(landmarks): 地点到達の途中経過とコンプリートを通知する`

### Task 5: パック状態フックに地点の到達状況を載せる

**Files:**

- Modify: `src/ui/hooks/useLandmarkPackState.ts`
- Test: `src/ui/hooks/__tests__/useLandmarkPackState.test.tsx`

**Interfaces:**

- Consumes: Task 2 の `getLandmarkAreaVisits`
- Produces:

  ```ts
  export type LandmarkAreaListItem = { area: LandmarkArea; visitedLocalDate: string | null };
  export type LandmarkSpotListItem = {
    spot: LandmarkSpot;
    visitedLocalDate: string | null;
    /** 複数地点スポットだけ地点ごとの行(マスタ順)。円1つのスポットは空配列。 */
    areaItems: LandmarkAreaListItem[];
  };
  ```

  `reloadLandmarkState` はスポット到達と地点到達の両方を読み込む。パック進捗(分子・分母)はスポット単位のまま。

- [ ] **Step 1: 失敗するテストを書く** — `複数地点スポットは地点ごとの到達日を areaItems に持つ` / `円1つのスポットの areaItems は空` / `地点だけ到達してもパックの到達数は増えない`
- [ ] **Step 2: 失敗を確認** — Run: `npx jest src/ui/hooks/__tests__/useLandmarkPackState.test.tsx` Expected: FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通ることを確認** — 同コマンド + `npm run typecheck` Expected: PASS
- [ ] **Step 5: Commit** — `feat(landmarks): パック詳細の状態に地点の到達状況を追加`

### Task 6: 埋め込み地図を地点単位にする

**Files:**

- Modify: `src/ui/components/LandmarkPackMapPreview.tsx`
- Test: `src/ui/components/__tests__/LandmarkPackMapPreview.test.tsx`

**Interfaces:**

- Consumes: Task 5 の `LandmarkSpotListItem.areaItems`
- Produces: `export type LandmarkSpotFocusRequest = { targetId: string; nonce: number } | null;`(`targetId` はスポットIDまたは地点ID)
  - 地点IDなら、その地点の円が余白付きで収まる範囲(`createLandmarkSpotFocusRegion`)
  - 複数地点スポットのスポットIDなら、全地点の円が収まる範囲(`createLandmarkSpotsBounds` + `createRegionFromBounds`)
  - 円1つのスポットのスポットIDは従来どおり
- 地点ごとの到達済み表示: 複数地点スポットの地点は `areaItems` の `visitedLocalDate` で到達済みの見た目・ラベル(`到達済み`)を決める。円1つは従来どおりスポットの到達で決める

- [ ] **Step 1: 失敗するテストを書く** — `複数地点スポットは地点ごとに円を描く`(モック Circle の数・中心)/ `到達済みの地点だけ到達済みの見た目になる` / `地点IDのフォーカスでその地点へズームする` / `複数地点スポットのIDのフォーカスで全地点が収まる範囲へズームする` / 既存の円1つのテストは `spotId` → `targetId` の置換のみで通す
- [ ] **Step 2: 失敗を確認** — Run: `npx jest src/ui/components/__tests__/LandmarkPackMapPreview.test.tsx` Expected: FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通ることを確認** — 同コマンド + `npm run typecheck` Expected: PASS
- [ ] **Step 5: Commit** — `feat(landmarks): 埋め込み地図に複数地点スポットの地点を描く`

### Task 7: パック詳細の進捗・地点行・コンプリート記念スタンプ

**Files:**

- Create: `assets/achievements/spots/spots-completed-stamp.png`(600×600、既存の訪問済みスタンプと同寸)と、そのマスタ `assets/achievements/spots/stamp-sources/spots-completed-stamp.svg`(`~/Downloads/completed_stamp.svg` をそのままコピー。`svg/` はトロフィーの自動生成対象なので置かない)
- Modify: `src/ui/components/LandmarkPackScreen.tsx`
- Modify: `src/ui/styles/achievementStyles.ts`(地点行の字下げ等が必要な場合)、`src/ui/appText.ts`(新しい文言)
- Modify: `docs/achievements.md`(スポット実績の章: 複数地点スポット、地点、リリース後の変更ルール、円の重なり禁止と issue #201、画面・通知の挙動)
- Test: `src/ui/components/__tests__/LandmarkPackScreen.test.tsx`、`src/ui/__tests__/appStylesSplit.test.ts`(スタイルキー数)

**Interfaces:**

- Consumes: Task 5 の `areaItems`、Task 6 の `LandmarkSpotFocusRequest`
- 表示(DESIGN.md と既存の `AppListItem` の拡張で実現。新コンポーネントが必要なら作る前に理由を報告する):
  - 複数地点スポット行の `detail` に進捗 `${到達地点数}/${地点数}`(コンプリート後は従来どおり到達日)
  - その下に地点行を字下げして並べる。地点行は地点名と、到達済みなら到達日
  - コンプリート済みの複数地点スポット行の trailing は `spots-completed-stamp.png`(accessibilityLabel `コンプリート`)、円1つは従来の `訪問済み`
  - タップ: 到達済み地点行 → その日の記録 / 未到達地点行 → `{ targetId: 地点ID }` / 未コンプリートの複数地点スポット行 → `{ targetId: スポットID }` / コンプリート済み → 最後の地点の日の記録(=スポット到達日)
  - accessibilityLabel: 地点行は到達済み `${area.name}の記録を開く`、未到達 `${area.name}を地図で見る`

- [ ] **Step 1: スタンプPNGを作る** — `node -e` で sharp を使い SVG を 600×600 の透過PNG(`palette: true`)へ変換し、目視で確認(Read で画像を開く)
- [ ] **Step 2: 失敗するテストを書く** — `複数地点スポットの行に到達地点数の進捗を表示する`(`1/3`)/ `地点行を表示し、到達済みの地点には到達日を出す` / `コンプリート済みの複数地点スポットにはコンプリート記念スタンプを出す` / `円1つのスポットは訪問済みスタンプのまま` / 上記4種類のタップ挙動
- [ ] **Step 3: 失敗を確認** — Run: `npx jest src/ui/components/__tests__/LandmarkPackScreen.test.tsx` Expected: FAIL
- [ ] **Step 4: 実装とドキュメント更新**
- [ ] **Step 5: 全体検証** — Run: `npm run typecheck && npm test && npm run lint && npx prettier --check docs src data scripts` Expected: すべて PASS、lint error 0
- [ ] **Step 6: Commit** — `feat(landmarks): パック詳細に地点の進捗とコンプリート記念スタンプを表示`
