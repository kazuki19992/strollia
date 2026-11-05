# 横画面の2段構成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 横画面(`width > height`)のとき、日ごとの記録詳細・パック詳細を左右50:50の2段、実績一覧を6列、設定の Plus 案内を2列にする。縦画面は一切変えない。

**Architecture:** 横画面判定を純粋関数 + フックに切り出し、2段の左右分割を汎用コンポーネント `TwoPaneLayout` にする。各画面は `useIsLandscapeLayout()` で分岐し、縦画面時は既存JSXをそのまま描画する(縦の見た目を変えないため、縦は共通部品を通さない)。

**Tech Stack:** Expo 58 / React Native 0.88 / TypeScript 6 / jest-expo + @testing-library/react-native 14

**Spec:** `docs/superpowers/specs/2026-11-05-landscape-two-pane-design.md`

## Global Constraints

- 横画面判定は `width > height`。NaN・0以下・正方形は縦扱い(false)
- 2段の左右比は 50:50(左右とも `flex: 1`)
- 縦画面(iPhone 全般・縦向き iPad)のレイアウト・余白・フォントを変えない。既存テストは無修正で通ること
- `src/ui/components/**` で `StyleSheet.create` を使わない。スタイルは `src/ui/styles/*.ts` に追加する
- `../` 始まりの import 禁止。ディレクトリを跨ぐ import は `@/`
- 関数・型・props には日本語 JSDoc。`describe`/`test` の説明文は日本語
- テストは `@testing-library/react-native` v14。`render`/`fireEvent`/`renderHook` は必ず `await`
- 横画面のテストは `jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1180, height: 820, scale: 2, fontScale: 1 })`(`import * as ReactNative from 'react-native'`)。フック内でも `ReactNative.useWindowDimensions` を名前空間経由で呼ぶ(既存 `MapBottomDashboard.tsx` と同じ理由: spy が効くようにする)
- 各タスク末尾で `npm run typecheck`・該当テスト・`npm run lint`(error 0)を通してからコミット
- コミットメッセージ: `type(scope): 日本語`、末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

- 正方形・Split View などで `width === height` の画面 → 縦扱いで従来表示(Task 1 のテストで固定)
- ルートが無い日(`RouteMapPanel` が空表示)を横画面で開く → 右ペインに空表示が高さいっぱいで出て、崩れない(Task 3 のテストで固定)
- 横画面で Plus 加入済みユーザーが設定を開く → Plus 案内ブロック自体が出ないので2列化の影響を受けない(Task 6 のテストで固定)
- 横画面の GIF 範囲選択ダイアログ内の地図 → 従来の高さ332のまま(Task 2 の `fillHeight` 既定値 false で固定)
- 横画面のパック詳細で未到達スポットをタップ → 右ペインの地図がズームする既存挙動が残る(Task 4 のテストで固定)

---

### Task 1: 横画面判定と2段レイアウト部品

**Files:**

- Create: `src/ui/landscapeLayout.ts`
- Create: `src/ui/hooks/useIsLandscapeLayout.ts`
- Create: `src/ui/components/TwoPaneLayout.tsx`
- Modify: `src/ui/styles/commonStyles.ts`(`twoPaneRow`、`twoPanePane` を追加)
- Test: `src/ui/__tests__/landscapeLayout.test.ts`、`src/ui/hooks/__tests__/useIsLandscapeLayout.test.tsx`、`src/ui/components/__tests__/TwoPaneLayout.test.tsx`

**Interfaces:**

- Produces:
  - `isLandscapeLayout(width: number, height: number): boolean`(`@/ui/landscapeLayout`)
  - `useIsLandscapeLayout(): boolean`(`@/ui/hooks/useIsLandscapeLayout`)
  - `TwoPaneLayout({ primary, secondary, styles, testID? }: TwoPaneLayoutProps)`。`primary: ReactNode`(左)、`secondary: ReactNode`(右)。左ペインに `testID="two-pane-primary"`、右ペインに `testID="two-pane-secondary"` を付ける
  - スタイル `twoPaneRow`(`flex: 1, flexDirection: 'row'`)、`twoPanePane`(`flex: 1`)

- [ ] **Step 1: 失敗するテストを書く**

`landscapeLayout.test.ts`(describe「横画面判定 isLandscapeLayout」):

- `isLandscapeLayout(1180, 820)` → true
- `isLandscapeLayout(820, 1180)` → false
- `isLandscapeLayout(800, 800)` → false(正方形は縦扱い)
- `isLandscapeLayout(Number.NaN, 800)`、`isLandscapeLayout(0, -1)` → false

`useIsLandscapeLayout.test.tsx`: `useWindowDimensions` を 1180×820 にモック → `result.current` が true、820×1180 → false。

`TwoPaneLayout.test.tsx`: `primary` に `<Text>左</Text>`、`secondary` に `<Text>右</Text>` を渡し、`within(screen.getByTestId('two-pane-primary')).getByText('左')` と `within(screen.getByTestId('two-pane-secondary')).getByText('右')` が取れる。両ペインの flatten 済み style の `flex` が 1。

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx jest src/ui/__tests__/landscapeLayout.test.ts src/ui/hooks/__tests__/useIsLandscapeLayout.test.tsx src/ui/components/__tests__/TwoPaneLayout.test.tsx`
Expected: FAIL(モジュールが無い)

- [ ] **Step 3: 実装**

`TwoPaneLayout` は `View style={styles.twoPaneRow}` の中に左右の `View style={styles.twoPanePane}`。区切り線は `DESIGN.md` の境界色トークンで左ペインの右に 1px 付けるか実装者判断(付ける場合も縦画面には影響しない)。

- [ ] **Step 4: テストを実行して成功を確認**

Run: 同上 / Expected: PASS

- [ ] **Step 5: Commit** — `feat(ui): 横画面判定と2段レイアウト部品を追加`

---

### Task 2: `RouteMapPanel` に高さいっぱい表示を追加

**Files:**

- Modify: `src/ui/components/RouteMapPanel.tsx`
- Modify: `src/ui/styles/dailyLogStyles.ts`(`routeMapFrameFill` を追加: `flex: 1`, `height: undefined` 相当で332固定を打ち消す)
- Test: `src/ui/components/__tests__/RouteMapPanel.test.tsx`(無ければ作成。`react-native-maps` は View にモック)

**Interfaces:**

- Produces: `RouteMapPanelProps.fillHeight?: boolean`(既定 false)。true のとき地図枠(`routeMapFrame`)と空表示(`routeMapEmptyPanel`)の両方に `routeMapFrameFill` を重ねる

- [ ] **Step 1: 失敗するテストを書く**
  - 「fillHeightを指定しない場合は従来どおり高さ332で描く」: 地図枠の flatten style の `height` が 332
  - 「fillHeightを指定すると地図枠が親の高さいっぱいに広がる」: `flex` が 1 で `height` が 332 でない
  - 「ルートが無い場合もfillHeightで空表示が高さいっぱいに広がる」: `points=[]`・`regionPoints=[]` で空表示文言の親 View の `flex` が 1
  - 地図枠・空表示は `testID="route-map-frame"` / `testID="route-map-empty"` を付けて特定する
- [ ] **Step 2: 失敗を確認** — `npx jest src/ui/components/__tests__/RouteMapPanel.test.tsx`
- [ ] **Step 3: 実装**(GIF範囲選択ダイアログ側の呼び出しは変更しない)
- [ ] **Step 4: 成功を確認**(`DailyLogDetailGifGeneration.test.tsx` も実行して既存が通ること)
- [ ] **Step 5: Commit** — `feat(daily-log): 移動地図パネルを親の高さいっぱいに広げられるようにする`

---

### Task 3: 日ごとの記録詳細の2段構成

**Files:**

- Modify: `src/ui/components/DailyLogDetailScreen.tsx`
- Modify: `src/ui/styles/dailyLogStyles.ts`(右ペイン用 `dailyLogDetailMapPane` 等、必要なものだけ)
- Test: `src/ui/components/__tests__/DailyLogDetailScreen.test.tsx`(既存ファイルに describe を追加)

**Interfaces:**

- Consumes: `useIsLandscapeLayout()`、`TwoPaneLayout`、`RouteMapPanel` の `fillHeight`

仕様: 横画面時、ヘッダーの下を `TwoPaneLayout` にする。

- 右(`secondary`、スクロールしない): `RouteMapPanel fillHeight` + `StepSlider`(`showSlider` のとき) + GIF出力ボタン(`canExportGif` のとき)。地図が残り高さを占め、シークバーとボタンはその下
- 左(`primary`、`ScrollView`): `DailyLogShareSections` → おもいで(Plus未加入時) → アクション群
- 縦画面時は現行JSXを1文字も変えずに描画する(分岐で丸ごと残す。重複を避けたければ、各ブロックをローカル変数の JSX に切り出して縦横で並べ替えるのは可。ただし縦の要素順・ラッパーは不変)
- 画面外の `DailyLogShareCard`・GIFレンダラー・ダイアログは縦横共通で現状の位置のまま

- [ ] **Step 1: 失敗するテストを書く**(describe「日ごとの記録詳細 横画面の2段構成」)
  - 「横画面では地図とシークバーを右ペイン、共有ボタンを左ペインに置く」: `within(getByTestId('two-pane-secondary')).getByLabelText('移動地図の表示時刻')`、`within(getByTestId('two-pane-primary')).getByText('この日の記録を共有')`
  - 「横画面では地図枠を高さいっぱいに広げる」: 右ペイン内 `route-map-frame` の `flex` が 1
  - 「ルートが無い日も横画面では2段構成で空表示を右ペインに出す」: 右ペイン内に「移動地図を表示できません」
  - 「縦画面では2段構成にしない」: 820×1180 で `queryByTestId('two-pane-primary')` が null
- [ ] **Step 2: 失敗を確認** — `npx jest src/ui/components/__tests__/DailyLogDetailScreen.test.tsx`
- [ ] **Step 3: 実装**
- [ ] **Step 4: 成功を確認** — 上記 + `DailyLogDetailGifGeneration.test.tsx`
- [ ] **Step 5: Commit** — `feat(daily-log): 横画面で日ごとの記録詳細を地図と項目の2段構成にする`

---

### Task 4: パック詳細の2段構成

**Files:**

- Modify: `src/ui/components/LandmarkPackScreen.tsx`
- Test: `src/ui/components/__tests__/LandmarkPackScreen.test.tsx`

**Interfaces:**

- Consumes: `useIsLandscapeLayout()`、`TwoPaneLayout`

仕様: 横画面時、`landmarkPackScreenBody` の代わりに `TwoPaneLayout`。左=スポット一覧の `ScrollView`(`contentContainerStyle={styles.screenList}`)、右=`LandmarkPackMapPreview`(既存の `landmarkPackMapSection` で包んでよい)。`focusRequest` の受け渡しは変えない。

- [ ] **Step 1: 失敗するテストを書く**
  - 「横画面ではスポット一覧を左ペイン、地図を右ペインに置く」: 左ペイン内にスポット名の行、右ペイン内に地図(既存テストが地図を特定している方法に合わせる)
  - 「横画面でも未到達スポットをタップすると地図がそのスポットへズームする」: 既存の縦画面テストと同じ検証を横画面で行う
  - 「縦画面では2段構成にしない」
- [ ] **Step 2: 失敗を確認** — `npx jest src/ui/components/__tests__/LandmarkPackScreen.test.tsx`
- [ ] **Step 3: 実装**
- [ ] **Step 4: 成功を確認**
- [ ] **Step 5: Commit** — `feat(landmarks): 横画面でパック詳細をスポット一覧と地図の2段構成にする`

---

### Task 5: 実績一覧のグリッドを横画面で6列にする

**Files:**

- Modify: `src/ui/components/AchievementListScreen.tsx`(61-66行付近のタイル幅計算)
- Test: `src/ui/components/__tests__/AchievementListScreen.test.ts`、`src/ui/components/__tests__/AchievementListScreenChrome.test.tsx`

**Interfaces:**

- Consumes: `useIsLandscapeLayout()`
- Produces: `getAchievementGridLayout(windowWidth: number, columns: number): { tileWidth: number; imageSize: number }`(`AchievementListScreen.tsx` から export)。`tileWidth = (windowWidth - 24 * 2 - 10 * (columns - 1)) / columns`、`imageSize = Math.max(0, Math.floor(tileWidth * 0.86))`
- 定数: `ACHIEVEMENT_GRID_COLUMNS_PORTRAIT = 3`、`ACHIEVEMENT_GRID_COLUMNS_LANDSCAPE = 6`

仕様: 縦画面は `columns = 3` で従来の `grayscaleImageSize` と同値、タイルの style も従来の `achievementGridTile`(`flexBasis: '30%'`)のまま。横画面は `columns = 6` で、タイルに `{ flexBasis: tileWidth, flexGrow: 0 }` を重ねる。

- [ ] **Step 1: 失敗するテストを書く**
  - `AchievementListScreen.test.ts`:「3列のタイル幅と画像サイズは従来の計算と一致する」: `getAchievementGridLayout(393, 3)` が `{ tileWidth: (393-48-20)/3, imageSize: Math.floor(((393-48-20)/3)*0.86) }`
  - 「6列では列間の余白5つ分を引いて6等分する」: `getAchievementGridLayout(1180, 6).tileWidth === (1180-48-50)/6`
  - `AchievementListScreenChrome.test.tsx`:「横画面では実績タイルを6列幅で並べる」: 1180×820 で、実績タイルの flatten style の `flexBasis` が `(1180-48-50)/6`。「縦画面ではタイル幅を変えない」: 393×852 で `flexBasis` が `'30%'`
- [ ] **Step 2: 失敗を確認** — `npx jest src/ui/components/__tests__/AchievementListScreen`
- [ ] **Step 3: 実装**
- [ ] **Step 4: 成功を確認**(`AchievementListScreenLandmarkPacks.test.tsx` も含めて)
- [ ] **Step 5: Commit** — `feat(achievements): 横画面で実績一覧のアイコンを6列にする`

---

### Task 6: 設定の Strollia Plus 案内を2列にする

**Files:**

- Modify: `src/ui/components/SettingsScreen.tsx`(433行付近の `!isPlusActive` ブロック)
- Modify: `src/ui/styles/settingsStyles.ts`(`settingsSubscriptionColumns`: `flexDirection: 'row', gap: 16, alignItems: 'stretch'`、`settingsSubscriptionTextColumn`: `flex: 1, justifyContent: 'space-between', gap: 16`、`settingsSubscriptionActionsBottom`: `gap: 16`、`settingsSubscriptionImageColumn`: `flex: 1`)
- Test: `src/ui/components/__tests__/SettingsScreen.test.tsx`

**Interfaces:**

- Consumes: `useIsLandscapeLayout()`

仕様: 横画面かつ Plus 未加入のとき

- 左列(`testID="plus-intro-text-column"`): 上に `InfoBlock`、下揃えブロックに「いつでも解約できます。」・月額/年額ボタン・復元ボタン・読み込み中文言
- 右列(`testID="plus-intro-image-column"`): `PlusAdImage`
- 2列の下に全幅で `paywallLegal`
- 縦画面時は現行JSXのまま

- [ ] **Step 1: 失敗するテストを書く**(既存テストの Plus 未加入 props を流用)
  - 「横画面ではPlus案内のボタン群を左列、宣伝画像を右列に置く」: 左列内に「月額300円ではじめる！」「年額3300円ではじめる！」「Strollia Plusの購入を復元する」、右列内に `getByLabelText('Strollia Plusの機能比較広告')`
  - 「横画面でも規約リンクは2列の外に置く」: 規約リンク(既存テストで使っている文言)が左右どちらの列にも含まれない
  - 「Plus加入済みなら横画面でも案内の2列を出さない」: `queryByTestId('plus-intro-text-column')` が null
  - 「縦画面ではPlus案内を2列にしない」
- [ ] **Step 2: 失敗を確認** — `npx jest src/ui/components/__tests__/SettingsScreen.test.tsx`
- [ ] **Step 3: 実装**
- [ ] **Step 4: 成功を確認**
- [ ] **Step 5: Commit** — `feat(settings): 横画面でStrollia Plusの案内をボタンと画像の2列にする`

---

### Task 7: ドキュメント更新と全体検証

**Files:**

- Modify: `docs/overview.md`(§5 の対応端末表の後、ダッシュボードの段落の次)
- Modify: `.ai/context/architecture.md`(ディレクトリマップの `src/ui/components/` 行に `TwoPaneLayout.tsx`(横画面の2段構成)を追記、`src/ui/hooks/` の主要フックに `useIsLandscapeLayout`)

- [ ] **Step 1: `docs/overview.md` に追記** — 横画面(画面が縦より横に長いとき)の表示: 日ごとの記録詳細・パック詳細は左に項目/右に地図の50:50の2段、実績一覧は6列、設定の Plus 案内はボタン群と宣伝画像の2列
- [ ] **Step 2: 全体検証**
      Run: `npm run typecheck` → エラー0 / `npm run lint` → `0 errors` / `npm test` → 全件 PASS
- [ ] **Step 3: Commit** — `docs: 横画面の2段構成を仕様とアーキテクチャに追記`
