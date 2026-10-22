# Daily Altitude Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plusユーザーの日別詳細画面とPNG共有に、既存GPS高度を使った相対グラデーションの高度プロファイルを追加する。

**Architecture:** 日別の `LocationPoint[]` を純粋な高度プロファイル生成関数へ渡し、欠測区間ごとの平滑化・最小最大値・表示点数制限を行う。汎用 `AltitudeProfileSection` が同じプロファイルをSVG描画し、日別詳細画面と共有カードから再利用する。GPS取得、DB、GIF生成には触れない。

**Tech Stack:** TypeScript 6、React 19、React Native 0.86、react-native-svg 15.15、Jest、React Native Testing Library

**Spec:** `docs/superpowers/specs/2026-09-21-daily-altitude-profile-design.md`

## Global Constraints

- 実装開始前に `.agents/skills/add-screen/SKILL.md`、`superpowers:test-driven-development`、完了前に `superpowers:verification-before-completion` を読む。
- `LocationPoint.altitude` と `recordedAt` だけを表示入力とし、DB、GPS取得設定、センサー購読を変更しない。
- Plus限定とし、無料ユーザーには画面・PNGともセクション、ぼかし、追加課金導線を表示しない。
- 常に1日全体を表示し、地図の時刻スライダーとは連動させない。
- 初期版は欠測区間で線を分割し、補完値を生成しない。将来は区間末尾と次区間先頭を描画規則だけで直線接続できる形にする。
- PNGには含め、GIFには含めない。
- 新規依存、カードUI、不要な太字を追加しない。
- テストの説明文は日本語で書く。
- 1.3.0のバージョン更新とリリース作業は別作業とする。

## File Structure

- Create `src/features/reports/altitudeProfile.ts`: 検証、欠測分割、5点移動中央値、最小最大値、平坦判定、時刻ラベル、点数制限。
- Create `src/features/reports/__tests__/altitudeProfile.test.ts`: 純粋関数の境界・欠測・性能上限テスト。
- Create `src/ui/components/AltitudeProfileSection.tsx`: 見出し、SVG、相対グラデーション、ラベル、データ不足表示、アクセシビリティ。
- Create `src/ui/components/__tests__/AltitudeProfileSection.test.tsx`: グラフ描画、平坦表示、欠測パス、データ不足表示。
- Modify `src/theme/theme.ts`: 高度グラデーション4色をライト／ダーク共通のテーマ値として定義。
- Modify `src/ui/styles/dailyLogStyles.ts`, `src/ui/__tests__/appStylesSplit.test.ts`: 高度用スタイルとキー数を同期。
- Modify `src/ui/components/DailyLogShareSections.tsx`, `DailyLogDetailScreen.tsx`, `DailyLogShareCard.tsx`: Plus表示とPNG共有へ統合。
- Modify `src/ui/components/__tests__/DailyLogDetailScreen.test.tsx`, `DailyLogDetailGifGeneration.test.tsx`: 課金境界、共有、GIF非対象を検証。
- Modify `docs/plus-features.md`, `docs/monetization.md`, `docs/todo.md`: 仕様とTodoを更新。

---

### Task 1: 高度プロファイル純粋関数

**Files:**

- Create: `src/features/reports/altitudeProfile.ts`
- Test: `src/features/reports/__tests__/altitudeProfile.test.ts`

**Interfaces:**

- Consumes: `readonly LocationPoint[]`, `maxRenderedPoints: number`
- Produces:

```ts
export type AltitudeProfilePoint = { timestampMs: number; altitudeMeters: number };
export type AltitudeProfile = {
  segments: AltitudeProfilePoint[][];
  minAltitudeMeters: number;
  maxAltitudeMeters: number;
  startTimestampMs: number;
  middleTimestampMs: number;
  endTimestampMs: number;
  isFlat: boolean;
};
export const ALTITUDE_PROFILE_FLAT_RANGE_METERS = 10;
export function createAltitudeProfile(points: readonly LocationPoint[], maxRenderedPoints: number): AltitudeProfile | null;
export function formatAltitudeProfileTime(timestampMs: number): string;
```

- [ ] **Step 1: 基本ケースの失敗テストを書く**

```ts
test('有効な高度から時刻範囲と最低・最高高度を作る', () => {
  const profile = createAltitudeProfile([point(1, 9, 0, 10), point(2, 10, 0, 20), point(3, 11, 0, 15)], 100);
  expect(profile).toMatchObject({ minAltitudeMeters: 10, maxAltitudeMeters: 20, isFlat: false });
  expect(formatAltitudeProfileTime(profile!.middleTimestampMs)).toBe('10:00');
});

test('有効高度が2点未満なら表示データを作らない', () => {
  expect(createAltitudeProfile([point(1, 9, 0, null), point(2, 10, 0, 10)], 100)).toBeNull();
});

test('非有限高度と無効日時を欠測として扱う', () => {
  const invalidDatePoint = { ...point(2, 10, 0, 20), recordedAt: 'invalid' };
  expect(createAltitudeProfile([point(1, 9, 0, 10), { ...point(2, 10, 0, 20), altitude: Number.NaN }, invalidDatePoint], 100)).toBeNull();
});
```

- [ ] **Step 2: 未実装で失敗することを確認する**

Run: `npm test -- src/features/reports/__tests__/altitudeProfile.test.ts --runInBand`

Expected: FAIL with `Cannot find module '@/features/reports/altitudeProfile'`.

- [ ] **Step 3: 型、値検証、時刻範囲、平坦判定を最小実装する**

`typeof point.altitude === 'number' && Number.isFinite(point.altitude)` と `Number.isFinite(Date.parse(point.recordedAt))` を満たす点だけを有効点とする。中間時刻は開始・終了の算術中点、平坦判定は `max - min < 10` とする。

```ts
export function formatAltitudeProfileTime(timestampMs: number): string {
  const date = new Date(timestampMs);
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}
```

- [ ] **Step 4: 平滑化と欠測分割の失敗テストを書く**

```ts
test('5点移動中央値で単発ノイズを抑える', () => {
  const profile = createAltitudeProfile(
    [point(1, 9, 0, 10), point(2, 9, 1, 11), point(3, 9, 2, 200), point(4, 9, 3, 12), point(5, 9, 4, 13)],
    100,
  );
  expect(profile!.segments[0][2].altitudeMeters).toBe(12);
});

test('欠測で線を分割し前後の実測点を残す', () => {
  const profile = createAltitudeProfile(
    [point(1, 9, 0, 10), point(2, 9, 1, 11), point(3, 9, 2, null), point(4, 9, 3, 20), point(5, 9, 4, 21)],
    100,
  );
  expect(profile!.segments).toHaveLength(2);
  expect(profile!.segments[0].at(-1)?.altitudeMeters).toBe(11);
  expect(profile!.segments[1][0].altitudeMeters).toBe(20);
});
```

- [ ] **Step 5: 連続区間ごとの5点移動中央値を実装する**

欠測点または無効日時で入力を区切る。区間ごとに現在点の前後2点を含む有限値を昇順ソートし、奇数個は中央、偶数個は中央2値の平均を使う。区間をまたいで窓を作らない。

- [ ] **Step 6: 山谷を残す点数制限の失敗テストを書く**

100点の中に高度500mのピークを1点置き、上限20点へ縮小後もピークが残り、総点数が20以下であることを検証する。

- [ ] **Step 7: min/maxバケット処理を実装する**

上限を各区間の点数比で配分し、区間の先頭・末尾を必ず残す。中間を時刻バケット化して最低点と最高点を元の時刻順で追加する。上限超過時はバケット数を減らして再計算する。最低・最高表示値は縮小前の平滑化済みデータから求める。

- [ ] **Step 8: Task 1を検証してコミットする**

Run:

```bash
npm test -- src/features/reports/__tests__/altitudeProfile.test.ts --runInBand
npm run typecheck
npx prettier --check src/features/reports/altitudeProfile.ts src/features/reports/__tests__/altitudeProfile.test.ts
```

Expected: all PASS.

```bash
git add src/features/reports/altitudeProfile.ts src/features/reports/__tests__/altitudeProfile.test.ts
git commit -m "feat(reports): 日別高度プロファイル生成を追加"
```

---

### Task 2: 高度グラフUIコンポーネント

**Files:**

- Create: `src/ui/components/AltitudeProfileSection.tsx`
- Create: `src/ui/components/__tests__/AltitudeProfileSection.test.tsx`
- Modify: `src/theme/theme.ts`
- Modify: `src/ui/styles/dailyLogStyles.ts`
- Modify: `src/ui/__tests__/appStylesSplit.test.ts`

**Interfaces:**

- Consumes: Task 1の `createAltitudeProfile`, `formatAltitudeProfileTime`
- Produces:

```ts
export type AltitudeProfileSectionProps = {
  points: readonly LocationPoint[];
  styles: AppStyles;
  theme: AppTheme;
  showUnavailableMessage: boolean;
};
export function AltitudeProfileSection(props: AltitudeProfileSectionProps): React.JSX.Element | null;
```

- [ ] **Step 1: 表示とデータ不足の失敗テストを書く**

```ts
test('最低・最高高度と時刻を表示する', () => {
  render(<AltitudeProfileSection points={[point(1, 9, 0, 10), point(2, 11, 0, 30)]} styles={styles as never} theme={lightTheme} showUnavailableMessage />);
  expect(screen.getByText('高度')).toBeTruthy();
  expect(screen.getByText('30m')).toBeTruthy();
  expect(screen.getByText('10m')).toBeTruthy();
  expect(screen.getByLabelText('最低高度10メートル、最高高度30メートル')).toBeTruthy();
});

test('データ不足は画面で説明し共有用では何も返さない', () => {
  const { rerender } = render(<AltitudeProfileSection points={[point(1, 9, 0, null)]} styles={styles as never} theme={lightTheme} showUnavailableMessage />);
  expect(screen.getByText('高度データを表示できません')).toBeTruthy();
  rerender(<AltitudeProfileSection points={[point(1, 9, 0, null)]} styles={styles as never} theme={lightTheme} showUnavailableMessage={false} />);
  expect(screen.queryByText('高度')).toBeNull();
});
```

- [ ] **Step 2: 未実装で失敗することを確認する**

Run: `npm test -- src/ui/components/__tests__/AltitudeProfileSection.test.tsx --runInBand`

Expected: FAIL with module not found.

- [ ] **Step 3: SVGグラフを最小実装する**

`onLayout` で横幅を取り、`Math.max(2, Math.ceil(width * 2))` をTask 1へ渡す。初回論理幅は320、高さは160とする。各区間を独立した `<Path>` にする。`AppTheme.colors` に `altitudeLow`, `altitudeMid`, `altitudeHighMid`, `altitudeHigh` を追加し、ライト／ダークとも順に `#2f80ed`, `#27ae60`, `#f2c94c`, `#f2994a` を設定する。平坦時は `theme.colors.primary` を使う。

```tsx
<LinearGradient id="altitude-profile-gradient" x1="0" y1="1" x2="0" y2="0">
  <Stop offset="0" stopColor={theme.colors.altitudeLow} />
  <Stop offset="0.45" stopColor={theme.colors.altitudeMid} />
  <Stop offset="0.72" stopColor={theme.colors.altitudeHighMid} />
  <Stop offset="1" stopColor={theme.colors.altitudeHigh} />
</LinearGradient>
```

- [ ] **Step 4: 平坦単色、欠測パス分割、ダークテーマのテストを追加する**

高度差9mで `stroke={lightTheme.colors.primary}` が存在すること、`10, 12, null, 20, 22` で折れ線パスが2本になることを検証する。`darkTheme` でもレンダーし、平坦時のstrokeが `darkTheme.colors.primary` へ切り替わることと、アクセシビリティ要約が維持されることを確認する。

- [ ] **Step 5: スタイル7キーとキー数テストを更新する**

`altitudeProfilePlotRow`, `altitudeProfileChart`, `altitudeProfileYAxis`, `altitudeProfileAxisLabel`, `altitudeProfileTimeLabels`, `altitudeProfileTimeLabel`, `altitudeProfileEmptyText` を追加する。軸文字は12px・`fontWeight: '400'`、空表示は15px・`fontWeight: '400'` とする。総キー数を393から400へ更新する。

- [ ] **Step 6: Task 2を検証してコミットする**

Run:

```bash
npm test -- src/ui/components/__tests__/AltitudeProfileSection.test.tsx src/ui/__tests__/appStylesSplit.test.ts --runInBand
npm run typecheck
npx prettier --check src/ui/components/AltitudeProfileSection.tsx src/ui/components/__tests__/AltitudeProfileSection.test.tsx src/theme/theme.ts src/ui/styles/dailyLogStyles.ts src/ui/__tests__/appStylesSplit.test.ts
```

Expected: all PASS.

```bash
git add src/ui/components/AltitudeProfileSection.tsx src/ui/components/__tests__/AltitudeProfileSection.test.tsx src/theme/theme.ts src/ui/styles/dailyLogStyles.ts src/ui/__tests__/appStylesSplit.test.ts
git commit -m "feat(ui): 高度グラフコンポーネントを追加"
```

---

### Task 3: 日別詳細とPNG共有への統合

**Files:**

- Modify: `src/ui/components/DailyLogShareSections.tsx`
- Modify: `src/ui/components/DailyLogDetailScreen.tsx`
- Modify: `src/ui/components/DailyLogShareCard.tsx`
- Modify: `src/ui/components/__tests__/DailyLogDetailScreen.test.tsx`
- Modify: `src/ui/components/__tests__/DailyLogDetailGifGeneration.test.tsx`

**Interfaces:**

- Consumes: Task 2の `AltitudeProfileSection`
- Produces: `DailyLogShareSectionsProps` に `altitudePoints: readonly LocationPoint[]`, `theme: AppTheme`, `showAltitudeUnavailableMessage: boolean` を追加する。`DailyLogShareCardProps` に `altitudePoints: readonly LocationPoint[]` を追加する。

- [ ] **Step 1: Plus表示と無料完全非表示の失敗テストを書く**

標準モック高度を10mと30mに変更し、Plusテストへ `高度`, `10m`, `30m` を追加する。無料テストでは `高度` と `高度データを表示できません` が存在しないことを検証する。

- [ ] **Step 2: 未統合で失敗することを確認する**

Run: `npm test -- src/ui/components/__tests__/DailyLogDetailScreen.test.tsx --runInBand`

Expected: FAIL because `高度` is not rendered.

- [ ] **Step 3: DailyLogShareSectionsへPlus限定表示を追加する**

「移動のデータ」の直後、「おもいで」の直前へ追加し、無料時はコンポーネントをマウントしない。

```tsx
{
  isPlusActive && (
    <AltitudeProfileSection points={altitudePoints} styles={styles} theme={theme} showUnavailableMessage={showAltitudeUnavailableMessage} />
  );
}
```

- [ ] **Step 4: 画面と共有カードへ全日ポイントを渡す**

画面は `altitudePoints={dailyPoints}` と `showAltitudeUnavailableMessage` を渡す。共有カードには地図用 `points={visibleRoutePoints}` と別に `altitudePoints={dailyPoints}` を渡し、内部では `showAltitudeUnavailableMessage={false}` とする。

- [ ] **Step 5: PNG共有の失敗テストを書く**

`DailyLogShareCard` の直接レンダーテストで、Plusかつ高度2点なら表示、無料または高度不足なら非表示を確認する。スライダーを途中へ動かした共有テストでも `DailyLogShareCard.props.altitudePoints` が全2点を保持することを確認する。

画面側はPlusかつ高度不足の場合に「高度データを表示できません」を表示することも確認し、画面用メッセージとPNG省略の差を固定する。

- [ ] **Step 6: 読込中の共有を抑止する**

共有関数とボタンを同じ条件にする。

```ts
if (isSharingDetail || isLoadingDetail || !isSharePrivacyReady) return;
```

```tsx
disabled={isSharingDetail || isLoadingDetail || !isSharePrivacyReady}
```

未解決の `getLocationPointsByDate` を使うテストで、共有押下後も `captureRef` が呼ばれないことを確認する。

- [ ] **Step 7: GIF非対象を明示する**

`DailyLogDetailGifGeneration.test.tsx` で生成中の `GifFrameRenderer.props.altitudePoints` が `undefined` であることを検証し、GIF実装ファイルは変更しない。

- [ ] **Step 8: Task 3を検証してコミットする**

Run:

```bash
npm test -- src/ui/components/__tests__/DailyLogDetailScreen.test.tsx src/ui/components/__tests__/DailyLogDetailGifGeneration.test.tsx --runInBand
npm run typecheck
npx prettier --check src/ui/components/DailyLogShareSections.tsx src/ui/components/DailyLogDetailScreen.tsx src/ui/components/DailyLogShareCard.tsx src/ui/components/__tests__/DailyLogDetailScreen.test.tsx src/ui/components/__tests__/DailyLogDetailGifGeneration.test.tsx
```

Expected: all PASS.

```bash
git add src/ui/components/DailyLogShareSections.tsx src/ui/components/DailyLogDetailScreen.tsx src/ui/components/DailyLogShareCard.tsx src/ui/components/__tests__/DailyLogDetailScreen.test.tsx src/ui/components/__tests__/DailyLogDetailGifGeneration.test.tsx
git commit -m "feat(daily-log): 高度グラフを画面とPNG共有に追加"
```

---

### Task 4: 仕様更新と全体検証

**Files:**

- Modify: `docs/plus-features.md`
- Modify: `docs/monetization.md`
- Modify: `docs/todo.md`

**Interfaces:**

- Consumes: Tasks 1-3で完成した日別高度プロファイル
- Produces: 実装と一致するPlus仕様とTodo

- [ ] **Step 1: Plus仕様を更新する**

`docs/plus-features.md` に、日別の最低・最高高度、時刻ベース折れ線、5点移動中央値、Plus限定、無料プレビューなし、PNG対象、GIF対象外を記載する。累積上昇量と月次・年次集計は将来範囲とする。

- [ ] **Step 2: 収益化仕様とTodoを更新する**

`docs/monetization.md` を「日別高度プロファイル実装済み」へ更新する。`docs/todo.md` の高度項目を次へ置き換える。

```md
- [x] 日別詳細にPlus向け高度プロファイルを追加する
- [ ] 月次・年次の高度集計を追加する
```

- [ ] **Step 3: ドキュメントを検証してコミットする**

Run:

```bash
npx prettier --check docs/plus-features.md docs/monetization.md docs/todo.md
git diff --check
```

Expected: all PASS.

```bash
git add docs/plus-features.md docs/monetization.md docs/todo.md
git commit -m "docs: 高度グラフのPlus仕様を更新"
```

- [ ] **Step 4: 全体検証を実行する**

Run:

```bash
npm run typecheck
npm test -- --runInBand
npm run lint
npm run format:check
git diff --check
git status --short
```

Expected: typecheck/Jest/formatは成功、lintはerror 0、diff checkは出力なし、statusは空。

- [ ] **Step 5: 実機確認項目を結果報告に残す**

自動テストから断定せず、GPS高度のノイズと欠測頻度、欠測分割の見え方、ライト／ダークの視認性、長時間記録のスクロール性能、PNGの解像度と縦横比を実機確認待ちとして報告する。
