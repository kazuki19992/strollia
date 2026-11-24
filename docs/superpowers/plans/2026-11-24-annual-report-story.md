# 年間振り返りストーリー 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1年分の記録を、7秒ごとに自動で送る全画面ストーリーで振り返れる年次レポート（無料・期間限定）を追加する。

**Architecture:** 集計はアプリが前面にある間だけ、`annual_reports` テーブルに進捗を保存しながら月単位のステップで進め、完成したらJSON（`payload_json`）として固定する。表示側はJSONだけを読み、純粋関数でページ構成と文言を決める。ストーリーの再生（タイマー・タップ・一時停止・トランジション）は汎用の部品とフックに分ける。

**Tech Stack:** Expo 58 / React Native 0.88 / expo-router / expo-sqlite / expo-notifications / react-native-maps / react-native-view-shot / expo-blur / RN `Animated` / jest + RTL v14

**Spec:** `docs/superpowers/specs/2026-11-24-annual-report-story-design.md`（実装者は必ず先に読むこと。ページの文言・段階・比較対象の値はすべて spec §4 にある）

## Global Constraints

- 集計期間は対象年 `YYYY-01-01`〜`YYYY-12-15`（`local_date` 基準）。公開期間は `12-20 00:00`〜翌年 `01-15 23:59`（端末ローカル）。集計の起動は `12-16`〜翌年 `01-15`。
- レポート作成条件は、集計期間の記録日数が **7日以上**（開発用フラグ有効時は無視）。
- 1ページ7秒。トランジションはズーム＋ぼかし（ぼかしが重ければ拡大縮小＋フェードのみ可）。
- 「今年」「去年」という文言は使わない。年は数字で書く。
- 通知: タイトル `今年をふりかえりませんか？`、本文 `YYYY年の年間レポートを作りました！`、データ `{ screen: 'annualReport', year }`、Androidチャンネル `annual-reports`（名前「年間レポート」）。この機能のために通知権限をリクエストしない。
- 無料機能。Plus判定を入れない。
- GPS記録処理（`src/features/location/backgroundLocationTask.ts` など）には一切触れない。
- 開発用フラグ: `EXPO_PUBLIC_ANNUAL_REPORT_ALWAYS_AVAILABLE=true`（spec §10.1）。
- import は `@/` エイリアス、`../` 禁止。`src/ui/components/**` で `StyleSheet.create` 禁止（スタイルは `src/ui/styles/` に追加し `appStyles.ts` で束ねる。ストーリーは固定ダーク配色のため、月次の `reports/reportStyles.ts` と同じ扱いで `annualReport/annualReportStyles.ts` を置き、ESLint の除外対象に追加してよい）。
- テストの説明文は日本語。RTL v14 の API はすべて `await` する。
- 各タスク完了時に `npm run typecheck`・該当テスト・`npm run lint`（error 0）を通してからコミットする。コミットは `type(scope): 日本語` ＋ `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Review Focus

1. **端末の日付をまたいで開いたままのアプリ**（12/19 23:59 → 12/20 0:00、1/15 → 1/16）：ボタンの表示・非表示とバッジの日数が、前面復帰や日付変更で正しく更新されること。→ Task 9 のフックテストで、`now` を差し替えて再評価されることを確認する。
2. **集計中にアプリが背面へ回る／終了する**：途中の進捗から再開し、同じ月を二重に足さないこと。→ Task 5 のテスト「同じステップを2回実行しても月別距離が二重に加算されない」。
3. **`distance_meters` が NULL の日が混ざる**：その日だけポイントから計算し、月別距離・最長日の判定に含めること。→ Task 4 のテスト。
4. **非表示半径を持つ滞在場所が壊れている／読み込めない**：共有を開始せずエラーにする（既存方針）。「隠して共有」で範囲内のルートが写らないこと。→ Task 11 のテスト。
5. **通知を、アプリが完全に終了している状態でタップする**：初期化完了を待ってからストーリーを開くこと。公開期間外なら地図のまま。→ Task 8 のフックテスト。

---

## ファイル構成

| ファイル                                                                                                                      | 責務                                                               |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/config/developmentFlags.ts`（変更）                                                                                      | `annualReportAlwaysAvailable` を追加                               |
| `src/features/annualReport/annualReportPeriod.ts`                                                                             | 対象年・集計期間・公開期間・残り日数・集計起動・通知時刻の純粋関数 |
| `src/features/annualReport/annualReportCopy.ts`                                                                               | 比較対象・距離の段階・文言の純粋関数                               |
| `src/features/annualReport/annualReportTypes.ts`                                                                              | JSON（payload v1 / progress）の型と定数                            |
| `src/features/annualReport/annualReportRepository.ts`                                                                         | `annual_reports` の読み書き                                        |
| `src/features/annualReport/annualReportQueries.ts`                                                                            | 集計用SQL（日別距離・初訪問・エリア・実績・スポット）              |
| `src/features/annualReport/annualReportRouteThinning.ts`                                                                      | ルートの間引き（純粋関数）                                         |
| `src/features/annualReport/annualReportAggregator.ts`                                                                         | ステップ実行（月ステップ＋最終ステップ）とJSON組み立て             |
| `src/features/annualReport/annualReportPages.ts`                                                                              | 表示するページ一覧の決定（純粋関数）                               |
| `src/features/annualReport/annualReportNotificationService.ts`                                                                | チャンネル作成・通知予約・通知データ判定                           |
| `src/features/stayPlaces/privacyRouteSegments.ts`（変更）                                                                     | 座標区間向けの非表示処理を追加                                     |
| `src/db/database.ts`（変更）                                                                                                  | `annual_reports` テーブル追加                                      |
| `src/ui/hooks/useAnnualReportState.ts`                                                                                        | 集計の起動・保存済みレポートの読込・公開状態の算出                 |
| `src/ui/hooks/useAnnualReportNotificationResponse.ts`                                                                         | 通知タップでストーリーを開く                                       |
| `src/ui/hooks/useStoryPlayer.ts`                                                                                              | 自動送り・タップ送り・一時停止の状態機械                           |
| `src/ui/components/StoryProgressBar.tsx`                                                                                      | 分割プログレスバー（汎用）                                         |
| `src/ui/components/StoryTransitionView.tsx`                                                                                   | ズーム＋ぼかしで子を入れ替える（汎用）                             |
| `src/ui/components/BadgeFloatingButton.tsx`                                                                                   | バッジ付きのフローティングボタン（汎用）                           |
| `src/ui/components/annualReport/*.tsx`                                                                                        | ストーリー画面本体と各ページ                                       |
| `src/app/annual-report.tsx`                                                                                                   | ルート（薄いラッパー）                                             |
| `src/ui/state/AppStateProvider.tsx` / `src/app/_layout.tsx` / `src/ui/pathnameToScreenMode.ts` / `src/ui/appTypes.ts`（変更） | 結線・遷移・Sentry画面名                                           |

---

### Task 1: 期間判定と開発用フラグ

**Files:**

- Modify: `src/config/developmentFlags.ts`
- Create: `src/features/annualReport/annualReportPeriod.ts`
- Test: `src/features/annualReport/__tests__/annualReportPeriod.test.ts`

**Interfaces:**

- Produces:
  - `developmentFlags.annualReportAlwaysAvailable: boolean`（`EXPO_PUBLIC_ANNUAL_REPORT_ALWAYS_AVAILABLE === 'true'`）
  - `type AnnualReportWindow = { year: number; periodStart: string; periodEnd: string; publishEnd: Date }`（日付は `YYYY-MM-DD`）
  - `resolveAggregationWindow(now: Date, alwaysAvailable: boolean): AnnualReportWindow | null` — 集計を起動してよい期間なら対象を返す。通常は `12-16`〜翌 `01-15`。フラグ時は常に現在年、`periodEnd` は `min(今日, YYYY-12-15)`、`publishEnd` は次の `01-15 23:59:59.999`。
  - `isPublishPeriod(now: Date, year: number, alwaysAvailable: boolean): boolean` — `year-12-20 00:00`〜`year+1-01-15 23:59:59.999`。フラグ時は常に true。
  - `daysUntilPublishEnd(now: Date, publishEnd: Date): number` — ローカル日付の差 + 1（`01-15` 当日は 1、`01-14` は 2）。
  - `resolveNotificationTime(completedAt: Date, year: number, alwaysAvailable: boolean): Date | null` — フラグ時は `completedAt + 10秒`。通常は `completedAt` が `year-12-20 00:00` より前なら `year-12-20 09:00`、それ以降は null。
  - `MIN_ACTIVE_DAYS = 7`、`meetsMinimumActiveDays(activeDays: number, alwaysAvailable: boolean): boolean`

- [ ] **Step 1: 失敗するテストを書く**（すべて `new Date(年, 月-1, 日, 時, 分)` のローカル時刻で作る）

```ts
describe('年次レポートの期間判定 annualReportPeriod', () => {
  it('12月15日は集計を起動しない', () => expect(resolveAggregationWindow(new Date(2026, 11, 15, 23, 59), false)).toBeNull());
  it('12月16日は当年を集計期間1/1〜12/15で起動する', () =>
    expect(resolveAggregationWindow(new Date(2026, 11, 16), false)).toMatchObject({
      year: 2026,
      periodStart: '2026-01-01',
      periodEnd: '2026-12-15',
    }));
  it('1月15日は前年を対象にする', () => expect(resolveAggregationWindow(new Date(2027, 0, 15, 23, 0), false)?.year).toBe(2026));
  it('1月16日は起動しない', () => expect(resolveAggregationWindow(new Date(2027, 0, 16), false)).toBeNull());
  it('開発用フラグ時は6月でも当年を今日までで集計する', () =>
    expect(resolveAggregationWindow(new Date(2026, 5, 10), true)).toMatchObject({ year: 2026, periodEnd: '2026-06-10' }));
  it('公開期間は12/20 0:00から1/15 23:59まで', () => {
    expect(isPublishPeriod(new Date(2026, 11, 19, 23, 59), 2026, false)).toBe(false);
    expect(isPublishPeriod(new Date(2026, 11, 20, 0, 0), 2026, false)).toBe(true);
    expect(isPublishPeriod(new Date(2027, 0, 15, 23, 59), 2026, false)).toBe(true);
    expect(isPublishPeriod(new Date(2027, 0, 16, 0, 0), 2026, false)).toBe(false);
  });
  it('残り日数は終了日当日が1', () => {
    const end = new Date(2027, 0, 15, 23, 59, 59, 999);
    expect(daysUntilPublishEnd(new Date(2027, 0, 15, 8), end)).toBe(1);
    expect(daysUntilPublishEnd(new Date(2026, 11, 20, 8), end)).toBe(27);
  });
  it('12/19に完了したら12/20 9:00に通知する', () =>
    expect(resolveNotificationTime(new Date(2026, 11, 19, 22), 2026, false)).toEqual(new Date(2026, 11, 20, 9, 0)));
  it('12/20以降に完了したら通知しない', () => expect(resolveNotificationTime(new Date(2026, 11, 20, 0, 1), 2026, false)).toBeNull());
  it('開発用フラグ時は10秒後に通知する', () =>
    expect(resolveNotificationTime(new Date(2026, 5, 1, 12), 2026, true)).toEqual(new Date(2026, 5, 1, 12, 0, 10)));
  it('記録6日では作らず、フラグ時は作る', () => {
    expect(meetsMinimumActiveDays(6, false)).toBe(false);
    expect(meetsMinimumActiveDays(7, false)).toBe(true);
    expect(meetsMinimumActiveDays(0, true)).toBe(true);
  });
});
```

- [ ] **Step 2:** `npx jest src/features/annualReport/__tests__/annualReportPeriod.test.ts` → FAIL（モジュールなし）
- [ ] **Step 3:** フラグと上記関数を実装する。日付文字列は既存 `toLocalDate`（`src/utils/date.ts`）で作る。
- [ ] **Step 4:** 同じコマンドで PASS
- [ ] **Step 5:** コミット `feat(annual-report): 年次レポートの期間判定と開発用フラグを追加`

---

### Task 2: 比較対象・距離の段階・文言

**Files:**

- Create: `src/features/annualReport/annualReportCopy.ts`
- Test: `src/features/annualReport/__tests__/annualReportCopy.test.ts`

**Interfaces:**

- Produces:
  - `type DistanceComparison = { label: string; value: number; unit: '往復分' | '周分' | '回分'; endpoints: [string, string] | null }` — `label` は `東京〜大阪` / `日本縦断` / `日本` / `地球` / `地球〜月` / `地球〜火星` / `地球〜太陽`。`endpoints` は2地点間のときだけ（`['東京','大阪']`、`['宗谷岬','佐多岬']`、`['地球','月']` など。`日本` `地球` の周は null）。
  - `resolveDistanceComparison(totalMeters: number): DistanceComparison` — spec §4.1 の表の基準距離で割り、1以上になる最大の単位。どれも1未満なら東京〜大阪。`value` は小数1桁に丸めた数値。
  - `type DistanceTier = 1 | 2 | 3 | 4`、`resolveDistanceTier(totalMeters: number): DistanceTier` — 境目 3,000km / 10,000km / 25,000km（境目ちょうどは上の段階）。
  - `mapPageMessage(tier: DistanceTier): string` / `summaryMessage(tier: DistanceTier, year: number): string` — spec §4.2 の文言をそのまま（段階2のまとめは `${year}年もいっぱい移動しましたね！`）。
  - `achievementMessage(achievementCount: number, spotCount: number): string` — spotCount>0 なら `${a}個の実績解除と、${s}か所のスポットに到達しました！`、0 なら `${a}個の実績を解除しました！`。

- [ ] **Step 1: 失敗するテストを書く**

```ts
describe('年次レポートの文言 annualReportCopy', () => {
  it('1,642kmは東京〜大阪1.6往復分', () =>
    expect(resolveDistanceComparison(1_642_300)).toEqual({ label: '東京〜大阪', value: 1.6, unit: '往復分', endpoints: ['東京', '大阪'] }));
  it('400kmは東京〜大阪0.4往復分', () => expect(resolveDistanceComparison(400_000).value).toBe(0.4));
  it('6,420kmは日本縦断2.1回分', () =>
    expect(resolveDistanceComparison(6_420_000)).toMatchObject({ label: '日本縦断', value: 2.1, unit: '回分' }));
  it('15,230kmは日本1.3周分で両端なし', () =>
    expect(resolveDistanceComparison(15_230_000)).toMatchObject({ label: '日本', value: 1.3, unit: '周分', endpoints: null }));
  it('52,400kmは地球1.3周分', () => expect(resolveDistanceComparison(52_400_000)).toMatchObject({ label: '地球', value: 1.3 }));
  it('段階の境目', () => {
    expect(resolveDistanceTier(2_999_999)).toBe(1);
    expect(resolveDistanceTier(3_000_000)).toBe(2);
    expect(resolveDistanceTier(10_000_000)).toBe(3);
    expect(resolveDistanceTier(25_000_000)).toBe(4);
  });
  it('段階2のまとめは年を数字で書く', () => expect(summaryMessage(2, 2026)).toBe('2026年もいっぱい移動しましたね！'));
  it('スポット0なら実績のみの文言', () => expect(achievementMessage(12, 0)).toBe('12個の実績を解除しました！'));
});
```

- [ ] **Step 2:** 実行して FAIL
- [ ] **Step 3:** 実装（基準距離は spec §4.1 の値をそのまま定数化）
- [ ] **Step 4:** PASS
- [ ] **Step 5:** コミット `feat(annual-report): 比較対象と距離の段階別文言を追加`

---

### Task 3: `annual_reports` テーブルとリポジトリ・型

`db-schema-change` スキルの手順に従う。

**Files:**

- Modify: `src/db/database.ts`（`CREATE TABLE IF NOT EXISTS annual_reports`。カラムは spec §7.2 のとおり、`year INTEGER PRIMARY KEY`）
- Create: `src/features/annualReport/annualReportTypes.ts`, `src/features/annualReport/annualReportRepository.ts`
- Modify: `docs/data-storage.md`（テーブル追加）
- Test: `src/features/annualReport/__tests__/annualReportRepository.test.ts`

**Interfaces:**

- Produces（`annualReportTypes.ts`）:

```ts
export const ANNUAL_REPORT_PAYLOAD_VERSION = 1;
export type AnnualReportCoordinate = { latitude: number; longitude: number };
export type AnnualReportTimedCoordinate = AnnualReportCoordinate & { recordedAt: string };
export type AnnualReportPayloadV1 = {
  version: 1;
  year: number;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  activeDays: number;
  activeDates: string[]; // 記録のある日（カレンダー用）
  totalDistanceMeters: number;
  monthlyDistanceMeters: number[]; // 長さ12
  yearRouteSegments: AnnualReportCoordinate[][]; // 日をまたいでつながない
  farthestDay: { localDate: string; distanceMeters: number; route: AnnualReportTimedCoordinate[] } | null;
  visitedPrefectures: string[]; // その年に訪れた都道府県（チップ表示用）
  newPrefectures: string[]; // その年に初訪問
  newMunicipalityCount: number;
  newCellCount: number;
  previousCellCount: number; // 期間開始前までに塗られていたエリア数
  achievements: { count: number; highlights: { id: string; unlockedLocalDate: string }[] }; // 最大3件、新しい順
  spots: { count: number; highlights: { id: string; visitedLocalDate: string }[] }; // 最大3件、新しい順
};
export type AnnualReportProgress = {
  nextMonth: number; // 1〜12 は次に集計する月、13 は最終ステップ待ち
  activeDates: string[];
  monthlyDistanceMeters: number[];
  yearRouteSegments: AnnualReportCoordinate[][];
  farthestCandidate: { localDate: string; distanceMeters: number } | null;
};
export type AnnualReportRecord =
  | { year: number; status: 'in_progress'; progress: AnnualReportProgress; notificationScheduledAt: string | null }
  | { year: number; status: 'completed'; payload: AnnualReportPayloadV1; notificationScheduledAt: string | null };
```

- Produces（`annualReportRepository.ts`）:
  - `getAnnualReport(year: number): Promise<AnnualReportRecord | null>` — JSONが壊れている、または `payload_version` が未知なら null を返す（Sentryへは呼び出し側で記録）。
  - `saveAnnualReportProgress(year: number, progress: AnnualReportProgress): Promise<void>` — UPSERT、`status='in_progress'`。
  - `completeAnnualReport(year: number, payload: AnnualReportPayloadV1): Promise<void>` — `status='completed'`、`progress_json=NULL`。
  - `markAnnualReportNotificationScheduled(year: number, scheduledAt: string): Promise<void>`
  - `deleteAnnualReport(year: number): Promise<void>` — 開発用フラグ時の作り直しに使う。

- [ ] **Step 1:** リポジトリテストを書く（`db` を `.ai/context/testing.md` の方法でモック）。最低限：「保存済みJSONを型どおりに復元する」「壊れたJSONは null」「payload_version が2なら null」「completeAnnualReport は progress_json を NULL にする（SQL引数で確認）」
- [ ] **Step 2:** FAIL を確認
- [ ] **Step 3:** テーブル・型・リポジトリを実装し、`docs/data-storage.md` を更新
- [ ] **Step 4:** PASS、`npm run typecheck`
- [ ] **Step 5:** コミット `feat(db): 年次レポートを保存するannual_reportsテーブルを追加`

---

### Task 4: 集計用クエリとルートの間引き

**Files:**

- Create: `src/features/annualReport/annualReportQueries.ts`, `src/features/annualReport/annualReportRouteThinning.ts`
- Test: `src/features/annualReport/__tests__/annualReportQueries.test.ts`, `__tests__/annualReportRouteThinning.test.ts`

**Interfaces:**

- Consumes: Task 3 の型。既存の `getLocationPointsByMonth(yearMonth)` / `getLocationPointsByDate(localDate)`（`src/features/logs/logRepository.ts`）、`toRenderRouteSegments`・`simplifyRouteCoordinates`（`src/features/map/routeMapper.ts`）、`totalDistanceMeters`（`src/utils/distance.ts`）。
- Produces（`annualReportQueries.ts`。すべて SQL の集計で返し、GPSポイントは読まない）:
  - `getDailyDistanceRows(fromDate: string, toDate: string): Promise<{ localDate: string; pointCount: number; distanceMeters: number | null }[]>` — `daily_logs`、`point_count > 0` のみ。
  - `getVisitedPrefectureNames(fromDate: string, toDate: string): Promise<string[]>` — `location_point_admin_areas` の `DISTINCT prefecture_name`（`local_date` で絞る）。
  - `getNewAdminAreaSummary(fromIso: string, toIsoExclusive: string): Promise<{ newPrefectures: string[]; newMunicipalityCount: number }>` — `visited_admin_areas.first_visited_at` で絞る。`area_type` の値は `src/features/achievements/adminAreaRepository.ts` で使っている値に合わせる。
  - `getVisitedCellCounts(fromIso: string, toIsoExclusive: string): Promise<{ newCellCount: number; previousCellCount: number }>`
  - `getAchievementUnlockSummary(fromDate: string, toDate: string): Promise<{ count: number; highlights: { id: string; unlockedLocalDate: string }[] }>` — `unlocked_local_date` で絞る。`highlights` は新しい順に3件。
  - `getLandmarkSpotVisitSummary(fromDate: string, toDate: string): Promise<{ count: number; highlights: { id: string; visitedLocalDate: string }[] }>`
  - `toLocalDayStartIso(localDate: string): string` — その日のローカル 0:00 を ISO 文字列にする（`first_visited_at` 系の範囲に使う。終端は `periodEnd` の翌日0:00を排他で渡す）。
- Produces（`annualReportRouteThinning.ts`）:
  - `YEAR_ROUTE_POINT_BUDGET = 2000`、`FARTHEST_DAY_POINT_BUDGET = 500`、`MONTH_ROUTE_POINT_BUDGET = Math.floor(2000 / 12)`
  - `thinRouteSegments(segments: AnnualReportCoordinate[][], budget: number): AnnualReportCoordinate[][]` — まず `simplifyRouteCoordinates` を許容誤差を倍々にしながら適用し、予算内に収まらなければ等間隔に間引く。各区間の先頭と末尾は必ず残し、2点未満の区間は捨てる。
  - `thinTimedRoute(points: AnnualReportTimedCoordinate[], budget: number): AnnualReportTimedCoordinate[]` — 等間隔＋先頭末尾保持（時刻順を保つ）。

- [ ] **Step 1:** テストを書く。クエリは `db.getAllAsync` / `getFirstAsync` のモックで、渡したSQL引数（日付範囲）と戻り値の変換を確認する。間引きのテスト：「合計点数が予算以下になる」「各区間の先頭と末尾が残る」「1点だけの区間は捨てる」「予算内なら変えない」「時刻順を保つ」。
- [ ] **Step 2:** FAIL
- [ ] **Step 3:** 実装
- [ ] **Step 4:** PASS
- [ ] **Step 5:** コミット `feat(annual-report): 年次レポートの集計クエリとルート間引きを追加`

---

### Task 5: ステップ集計（アグリゲーター）

**Files:**

- Create: `src/features/annualReport/annualReportAggregator.ts`
- Test: `src/features/annualReport/__tests__/annualReportAggregator.test.ts`

**Interfaces:**

- Consumes: Task 1〜4。
- Produces:
  - `createInitialProgress(): AnnualReportProgress` — `nextMonth: 1`、月別距離は0が12個。
  - `type AnnualReportStepResult = { kind: 'progressed'; progress: AnnualReportProgress } | { kind: 'completed'; payload: AnnualReportPayloadV1 } | { kind: 'insufficient' }`
  - `runAnnualReportStep(window: AnnualReportWindow, progress: AnnualReportProgress, alwaysAvailable: boolean): Promise<AnnualReportStepResult>` — **DBへは書かない**（保存は呼び出し側＝Task 9）。
    - `nextMonth` が 1〜12 のとき（月ステップ）: その月が `periodEnd` より後なら何もせず次の月へ。そうでなければ `getDailyDistanceRows` で日別距離を取り、`getLocationPointsByMonth` でその月のポイントを読む（`periodEnd` 以降の日は除く）。`distance_meters` が NULL の日だけポイントから `totalDistanceMeters` で計算する。月別距離・`activeDates`・最長日候補（距離が最大、同じなら早い日付）を更新し、`toRenderRouteSegments` の結果を日ごとに区間化して `thinRouteSegments(…, MONTH_ROUTE_POINT_BUDGET)` で追加する。
    - `nextMonth === 13`（最終ステップ）: `meetsMinimumActiveDays` を満たさなければ `insufficient`。満たせば最遠日のルートを `getLocationPointsByDate` → `thinTimedRoute(…, 500)`、Task 4 の各サマリーを取り、`yearRouteSegments` を `thinRouteSegments(…, YEAR_ROUTE_POINT_BUDGET)` で仕上げて payload を返す。
  - 冪等性: 月ステップは入力の `progress` を変更せず、新しい `progress` を返す（同じ入力で2回呼んでも結果は同じ）。

- [ ] **Step 1:** テストを書く（Task 4 のクエリ関数と logRepository をモック）
  - `1月ステップで月別距離[0]と activeDates が更新され nextMonth が2になる`
  - `distance_meters が NULL の日はポイントから計算した距離を足す`
  - `同じ progress で同じステップを2回実行しても月別距離が二重に加算されない`
  - `periodEnd より後の月は読み込まずにスキップする`（開発用フラグ時の 6月10日終了を想定し、7月はクエリが呼ばれない）
  - `12月は15日までのポイントだけを使う`
  - `最長日は移動距離が最大の日で、同距離なら早い日付`
  - `記録6日で最終ステップを迎えると insufficient を返す`
  - `最終ステップで payload の各値が揃い version が1`
- [ ] **Step 2:** FAIL
- [ ] **Step 3:** 実装
- [ ] **Step 4:** PASS
- [ ] **Step 5:** コミット `feat(annual-report): 年次レポートを月単位で集計するステップ処理を追加`

---

### Task 6: 表示ページの決定

**Files:**

- Create: `src/features/annualReport/annualReportPages.ts`
- Test: `src/features/annualReport/__tests__/annualReportPages.test.ts`

**Interfaces:**

- Produces:
  - `type AnnualReportPageId = 'opening' | 'activeDays' | 'distance' | 'yearMap' | 'monthly' | 'farthestDay' | 'firstVisits' | 'newAreas' | 'achievements' | 'summary'`
  - `resolveAnnualReportPages(payload: AnnualReportPayloadV1): AnnualReportPageId[]` — spec §4 の順。`firstVisits` は新しい都道府県が0かつ新しい市区町村が0なら除く。`newAreas` は `newCellCount === 0` で除く。`achievements` は実績もスポットも0で除く。`farthestDay` は `farthestDay === null` で除く。
  - `isMapPage(id: AnnualReportPageId): boolean` — `yearMap` / `farthestDay` / `summary` が true。
  - `resolveMonthExtremes(monthlyDistanceMeters: number[], periodEnd: string): { maxMonth: number; minMonth: number }` — 1始まり。集計期間に含まれる月だけを対象にする。同じ値なら早い月。

- [ ] **Step 1:** テスト: 全部ある場合は10ページ／3ページが0なら7ページ／スポットだけ0なら achievements は残る／`isMapPage`／`resolveMonthExtremes`（開発用フラグの6月終了で、7〜12月の0を最少扱いしない）
- [ ] **Step 2:** FAIL → **Step 3:** 実装 → **Step 4:** PASS
- [ ] **Step 5:** コミット `feat(annual-report): 年次レポートの表示ページ判定を追加`

---

### Task 7: 共有用の座標区間の非表示処理

**Files:**

- Modify: `src/features/stayPlaces/privacyRouteSegments.ts`
- Test: `src/features/stayPlaces/__tests__/privacyRouteSegments.test.ts`（既存ファイルにケース追加）

**Interfaces:**

- Produces:
  - `toPrivacyCoordinateSegments(segments: RouteCoordinate[][], activeStayPlaces: StayPlace[]): RouteSegment[]` — 既存 `splitVisiblePoints` と同じ規則（範囲内の点を落とす、範囲を横切る線分を描かない、前後を別区間にする、壊れた設定なら空配列）を座標の配列に適用する。既存関数の内部処理を座標ベースに共通化し、`toPrivacyRouteSegments` の挙動は変えない。
  - `hasPrivacyRadiusInSegments(segments: RouteCoordinate[][], activeStayPlaces: StayPlace[]): boolean` — 非表示半径を持つ滞在場所の円に、どれかの点または線分がかかるか。共有前の確認ダイアログを出すかの判定に使う。

- [ ] **Step 1:** テスト: `範囲内の点は除かれ前後が別区間になる` / `両端が範囲外でも横切る線分は描かない` / `非表示半径の設定が壊れていれば空配列` / `円にかからなければ hasPrivacyRadiusInSegments は false` / 既存テストがすべて通ること
- [ ] **Step 2:** FAIL → **Step 3:** 実装 → **Step 4:** `npx jest src/features/stayPlaces` PASS
- [ ] **Step 5:** コミット `feat(stay-places): 座標区間向けの共有用非表示処理を追加`

---

### Task 8: 通知

**Files:**

- Create: `src/features/annualReport/annualReportNotificationService.ts`, `src/ui/hooks/useAnnualReportNotificationResponse.ts`
- Modify: `src/ui/hooks/useAppInitialization.ts`（起動時にチャンネル作成。月次と同じ位置）
- Test: `src/features/annualReport/__tests__/annualReportNotificationService.test.ts`, `src/ui/hooks/__tests__/useAnnualReportNotificationResponse.test.tsx`

**Interfaces:**

- Produces:
  - `ANNUAL_REPORT_NOTIFICATION_CHANNEL_ID = 'annual-reports'`
  - `setupAnnualReportNotificationChannel(): Promise<void>` — Androidのみ。名前「年間レポート」、重要度 DEFAULT。
  - `scheduleAnnualReportNotification(year: number, at: Date): Promise<boolean>` — 権限がなければ予約せず false（リクエストしない）。識別子 `annual-report-${year}` で、既存があれば置き換える。トリガーは DATE。タイトル・本文・データは Global Constraints のとおり。
  - `parseAnnualReportNotification(data: unknown): { year: number } | null`
  - `useAnnualReportNotificationResponse(args: { isReady: boolean; onOpenAnnualReport: (year: number) => void }): void` — `useMonthlyReportNotificationResponse` と同じ構造（最新の関数を ref で保持、初期化完了待ち、通知IDの重複ガード、コールドスタート時は `useLastNotificationResponse`）。公開期間かどうかの判定は呼び出し側（Task 9）で行う。

- [ ] **Step 1:** テスト: `権限がなければ予約せず false` / `requestPermissionsAsync を呼ばない` / `識別子・本文・data・日時が仕様どおり` / `parseAnnualReportNotification は monthlyReport の data を null にする` / フック: `初期化前のタップは初期化後に一度だけ開く` / `同じ通知IDは二度処理しない`
- [ ] **Step 2:** FAIL → **Step 3:** 実装 → **Step 4:** PASS
- [ ] **Step 5:** コミット `feat(annual-report): 年次レポートの完成通知を追加`

---

### Task 9: 集計の起動と状態フック・ルート結線

`add-screen` スキルの手順に従う（ルート・AppStateProvider・navigator・Sentry 画面名）。

**Files:**

- Create: `src/ui/hooks/useAnnualReportState.ts`, `src/app/annual-report.tsx`（この時点では仮の画面: `AnnualReportScreen` は Task 10 で作るので、Task 10 と同時にルートを有効にしてもよい）
- Modify: `src/ui/state/AppStateProvider.tsx`, `src/app/_layout.tsx`（`openAnnualReport: () => router.push('/annual-report')`）, `src/ui/appTypes.ts`（`ScreenMode` に `'annualReport'`）, `src/ui/pathnameToScreenMode.ts`（`/annual-report` → `'annualReport'`）
- Test: `src/ui/hooks/__tests__/useAnnualReportState.test.tsx`, `src/ui/__tests__/pathnameToScreenMode.test.ts`（既存にケース追加）

**Interfaces:**

- Consumes: Task 1, 3, 5, 8。
- Produces:
  - `type AnnualReportState = { availableReport: AnnualReportPayloadV1 | null; daysLeft: number | null }` — `availableReport` は公開期間中かつ completed のときだけ非null。
  - `useAnnualReportState(args: { isReady: boolean; now?: () => Date; alwaysAvailable?: boolean }): AnnualReportState`
    - 起動時（`isReady` が true になったとき）と、アプリが前面に戻ったとき（`AppState` の `active`）に評価し直す。
    - `resolveAggregationWindow` が null なら何もしない。保存済みが completed ならそれを使う。開発用フラグ時は、起動ごとに1回だけ `deleteAnnualReport` してから集計し直す。
    - 未完了なら `InteractionManager.runAfterInteractions` の後に `runAnnualReportStep` を1回実行し、`progressed` なら `saveAnnualReportProgress` して次のステップを再び `runAfterInteractions` で予約する（ステップの間でUIへ制御を返す）。`completed` なら `completeAnnualReport` し、`resolveNotificationTime` が非nullなら `scheduleAnnualReportNotification` → 成功で `markAnnualReportNotificationScheduled`。`insufficient` なら何も保存しない。
    - アプリが背面へ回ったら、次のステップを予約しない（実行中のステップは完了させて保存する）。
    - ステップで例外が出たら Sentry（既存の `captureException` 系ラッパー）へ記録し、そのセッション中は再試行しない。
  - `AppStateContextValue` に `annualReport: AnnualReportPayloadV1 | null`、`annualReportDaysLeft: number | null`、`openAnnualReport: () => void` を追加。通知タップは `useAnnualReportNotificationResponse` から `openAnnualReport` を呼ぶ（`availableReport` が null なら何もしない＝地図のまま）。
  - `src/app/annual-report.tsx`: `annualReport` が null なら `<Redirect href="/" />`。

- [ ] **Step 1:** フックのテスト（リポジトリ・アグリゲーター・通知サービスをモック、`now` を注入）
  - `期間外では集計しない`
  - `未完了なら1ステップずつ進めて進捗を保存し、完了で completeAnnualReport を呼ぶ`
  - `12/19に完了したら12/20 9:00で通知を予約し、予約済みを記録する`
  - `insufficient なら保存も通知もしない`
  - `背面へ回ったら次のステップを予約しない`
  - `前面復帰時に日付が1/16になっていれば availableReport が null になる`（Review Focus 1）
  - `開発用フラグ時は起動ごとに作り直す`
  - pathname: `/annual-report` → `'annualReport'`
- [ ] **Step 2:** FAIL → **Step 3:** 実装 → **Step 4:** PASS、`npm run typecheck`
- [ ] **Step 5:** コミット `feat(annual-report): 年次レポートの集計起動と画面遷移を結線`

---

### Task 10: ストーリー再生の汎用部品

**Files:**

- Create: `src/ui/hooks/useStoryPlayer.ts`, `src/ui/components/StoryProgressBar.tsx`, `src/ui/components/StoryTransitionView.tsx`
- Modify: `src/ui/styles/`（新しい `storyStyles.ts` を追加して `appStyles.ts` で束ねる）
- Test: `src/ui/hooks/__tests__/useStoryPlayer.test.tsx`, `src/ui/components/__tests__/StoryProgressBar.test.tsx`

**Interfaces:**

- Produces:
  - `STORY_PAGE_DURATION_MS = 7000`
  - `useStoryPlayer(args: { pageCount: number; durationMs?: number }): { index: number; direction: 'next' | 'prev'; progress: Animated.Value; next(): void; prev(): void; pause(): void; resume(): void; isPaused: boolean }` — 最後のページでは自動送りしない。`pause` は進行バーのアニメーションを止め、`resume` で残り時間から再開する。`AppState` が背面になったら自動で pause、前面で resume。
  - `StoryProgressBar` props: `{ pageCount: number; index: number; progress: Animated.Value; styles: AppStyles }` — 現在より前は満タン、現在は `progress`、後ろは空。
  - `StoryTransitionView` props: `{ pageKey: string; direction: 'next' | 'prev'; children: ReactNode }` — 入る側: scale 1.15→1・opacity 0→1（700ms）、出る側: scale 1→0.9・opacity 1→0（500ms）。ぼかしは `expo-blur` の `BlurView` を重ねて intensity を下げる。実機で重ければ省く（spec §5）。

- [ ] **Step 1:** テスト（jest のフェイクタイマー）: `7秒で次のページへ進む` / `最後のページでは進まない` / `pause中は時間が経っても進まない、resumeで残りから再開` / `prevは0未満にならない` / `背面に回ると止まる` / ProgressBar: `現在より前のバーが満タン`
- [ ] **Step 2:** FAIL → **Step 3:** 実装 → **Step 4:** PASS
- [ ] **Step 5:** コミット `feat(ui): ストーリー再生の汎用フックと部品を追加`

---

### Task 11: ストーリー画面と各ページ・共有

**Files:**

- Create: `src/ui/components/annualReport/AnnualReportScreen.tsx`、ページごとのコンポーネント（`AnnualReportOpeningPage.tsx` / `ActiveDaysPage` / `DistancePage` / `YearMapPage` / `MonthlyDistancePage` / `FarthestDayPage` / `FirstVisitsPage` / `NewAreasPage` / `AchievementsPage` / `SummaryPage`、すべて `AnnualReport` 接頭辞）、`annualReportStyles.ts`
- Modify: `src/app/annual-report.tsx`（`AnnualReportScreen` を描画）、`eslint.config.js`（`annualReportStyles.ts` を `StyleSheet.create` 禁止の除外へ）、`src/ui/appText.ts`（共有ダイアログ文言）
- Test: `src/ui/components/annualReport/__tests__/AnnualReportScreen.test.tsx`, `src/app/__tests__/annualReportRoute.test.tsx`

**Interfaces:**

- Consumes: Task 2, 6, 7, 10、`shareCapturedView`（`src/features/export/capturedViewShare.ts`）、既存の `Dialog` 部品、`getAchievementDefinition`、`getLandmarkSpotById`、DSEG7フォント（月次レポートと同じ読み込み方）。
- `AnnualReportScreen` props: `{ payload: AnnualReportPayloadV1; activeStayPlaces: StayPlace[] | null; stayPlacesStatus: StayPlacesStatus; onClose: () => void }`
- 振る舞い:
  - 背景は固定ダーク（`#0d0d10` 系）。ヘッダー（アイコン・`Strollia`・`Report YYYY`）、閉じるボタン（`accessibilityLabel="閉じる"`）、右下の共有ボタン（`accessibilityLabel="このページを共有"`）。
  - 画面の左35%タップで前、右65%で次（`accessibilityLabel` は `前のページ` / `次のページ`）。長押しで pause、離して resume。
  - 各ページは spec §4 の文言・アニメーション（ページがアクティブになるたびに最初から再生）。地図ページは `react-native-maps` の `MapView` に `Polyline` を重ね、暗いオーバーレイをかける。ページ6はルート上を点が進み、時刻（`HH:MM`）と距離を連動させる。ページ5は `resolveMonthExtremes` の2本だけ棒の上に `NNNkm` を表示する。
  - 共有: `isMapPage(現在のページ)` かつ `stayPlacesStatus === 'ready'` かつ `hasPrivacyRadiusInSegments(そのページのルート, activeStayPlaces)` のとき、`Dialog` で確認（タイトル `プライベートな滞在場所を隠しますか？`、ボタン `隠して共有` / `隠さずに共有` / `キャンセル`。説明文は spec §6）。「隠して共有」はページを `toPrivacyCoordinateSegments` で描き直してからキャプチャする。`stayPlacesStatus` が `ready` 以外の地図ページは共有を開始せずエラー表示（既存の月次と同じ文言）。ダイアログ表示中・共有中は pause。
- [ ] **Step 1:** テストを書く（`react-native-maps`・`expo-sharing`・`react-native-view-shot`・`@expo/vector-icons` をモック）
  - `右側タップで次のページ、左側タップで前のページ`
  - `0件のページは表示しない`（Task 6 の結果が反映される）
  - `地図ページで非表示半径にかかる場合は確認ダイアログを出し、キャンセルで共有しない`
  - `隠して共有ではプライバシー処理済みのルートでキャプチャする`（モックした Polyline の座標で確認）
  - `地図以外のページでは確認なしで共有する`
  - `滞在場所の読み込みに失敗していたら地図ページの共有を開始しない`
  - `比較対象が日本の周回のときは両端の地名を表示しない`
  - ルート: `annualReport が null なら地図へリダイレクトする`
- [ ] **Step 2:** FAIL → **Step 3:** 実装（`DESIGN.md` を参照。太字はメイン文言のみ） → **Step 4:** PASS、`npm run lint`
- [ ] **Step 5:** コミット `feat(annual-report): 年間振り返りストーリー画面を追加`

---

### Task 12: 地図画面のふりかえりボタン

**Files:**

- Create: `src/ui/components/BadgeFloatingButton.tsx`
- Modify: `src/ui/components/MapScreen.tsx`（および必要なら `src/app/index.tsx`）、`src/ui/styles/mapStyles.ts`
- Test: `src/ui/components/__tests__/BadgeFloatingButton.test.tsx`, `src/ui/__tests__/AnnualReportMapButton.test.tsx`（`renderRouter`）

**Interfaces:**

- Consumes: Task 9 の `annualReport` / `annualReportDaysLeft` / `openAnnualReport`。
- `BadgeFloatingButton` props: `{ label: string; badgeText: string | null; accessibilityLabel: string; onPress: () => void; styles: AppStyles }`
- 地図画面: `annualReport` が非nullのときだけ、ラベル `ふりかえり`、バッジ `あと${n}日`、`accessibilityLabel` `年間レポートをふりかえる（あと${n}日）`。配置は地図上部の他の要素と重ならない位置で、`DESIGN.md` §7.1 に沿って決める。地図表示設定パネルを開いている間は既存アクションと同じく無効化する。
- [ ] **Step 1:** テスト: `年間レポートがあるときだけボタンを表示する` / `バッジに残り日数を表示する` / `押すと /annual-report へ遷移する`
- [ ] **Step 2:** FAIL → **Step 3:** 実装 → **Step 4:** PASS
- [ ] **Step 5:** コミット `feat(map): 公開期間中に年間レポートのふりかえりボタンを表示`

---

### Task 13: ドキュメント更新と全体検証

**Files:**

- Modify: `docs/plus-features.md`（§5.4・§5.7〜5.9 の年次レポートを「無料・期間限定のストーリー。詳細は spec 参照」に置き換え）、`docs/stay-places.md`（年次ストーリーの共有では「隠さずに共有」を選べる）、`docs/todo.md`（年次レポートMVPを完了に）、`docs/architecture.md` と `.ai/context/architecture.md`（`/annual-report` ルート、`src/features/annualReport/`、新しいフックと汎用部品）、`DESIGN.md`（ストーリー画面と `BadgeFloatingButton` を共通コンポーネントカタログへ）、`.env.example` があればフラグを追記

- [ ] **Step 1:** ドキュメントを更新する
- [ ] **Step 2:** `npm run typecheck` → エラーなし
- [ ] **Step 3:** `npm test` → すべて PASS
- [ ] **Step 4:** `npm run lint` → error 0
- [ ] **Step 5:** `npm run format:check` → 差分なし（あれば `npm run format`）
- [ ] **Step 6:** コミット `docs: 年間振り返りストーリーに合わせて関連ドキュメントを更新`

### 手動確認（テストで代替できない部分）

`EXPO_PUBLIC_ANNUAL_REPORT_ALWAYS_AVAILABLE=true` で開発ビルドを起動し、iOS シミュレータで以下を確認する。

- 地図にふりかえりボタンとバッジが出る。集計中も地図操作が引っかからない。
- 約10秒後に通知が届き、タップでストーリーが開く（アプリを終了した状態からも）。
- 7秒の自動送り、左右タップ、長押しの一時停止、ズーム＋ぼかしのトランジション、各ページのアニメーション。
- 滞在場所に非表示範囲を設定し、地図ページで共有 → ダイアログ → 「隠して共有」で範囲内が消えた画像になる。
