# パック詳細の地点リスト展開/格納 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** パック詳細画面で、複数地点スポットの地点リストを行タップで開閉(アニメーション付き)できるようにし、行に「複数スポット」バッジと進捗バーを出す。

**Architecture:** 開閉状態は `LandmarkPackScreen` 内の state(開いているスポットIDの Set)。行の矢印は汎用 `AppListItem` の `expanded` で出す。アニメーションは標準の `LayoutAnimation` を汎用関数 `animateListExpansion()` から呼ぶ。バッジは `PlusBadge` を汎用の `LabelBadge` に切り出して使い回す。

**Tech Stack:** Expo 58 / React Native 0.88 / TypeScript / jest + @testing-library/react-native v14(render・fireEvent は必ず await)

**Spec:** `docs/superpowers/specs/2026-11-20-landmark-area-collapsible-design.md`

## Global Constraints

- `src/ui/components/**` で `StyleSheet.create` は禁止。スタイルは `src/ui/styles/*.ts` に置く。
- import は `@/` エイリアス(同一ディレクトリは `./`)。`../` は禁止。
- テストの describe/it は日本語。UI要素は `getByLabelText` 優先、押下は `await fireEvent.press`。
- 関数・型・props に日本語JSDoc。文言は `src/ui/appText.ts`。
- 太字をデフォルトにしない。
- コミットは `type(scope): 日本語`、末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Review Focus

- 開いた状態で日別記録へ進んで戻っても開閉状態が残る(画面が残るため。state を key でリセットしない)。
- 同じ行の連続タップで、毎回地図が再ズームする(既存の nonce 方式を保つ)。
- 開いているスポットを閉じたあと、地点の行がスクリーンリーダーからも消える(描画しない)。
- 円1つのスポットに `expanded` を渡さない(矢印・バッジ・進捗バーが出ない)。

---

### Task 1: 汎用バッジ `LabelBadge` と文言

**Files:**

- Create: `src/ui/components/LabelBadge.tsx`, `src/ui/components/__tests__/LabelBadge.test.tsx`
- Modify: `src/ui/components/PlusBadge.tsx`(LabelBadge を使う薄いラッパーにする), `src/ui/styles/*`(`plusBadge`/`plusBadgeText` を `labelBadge`/`labelBadgeText` に改名し、参照箇所も直す), `src/ui/appText.ts`

**Interfaces:**

- Produces: `LabelBadge({ label: string, styles: AppStyles })`。`appText.ts` に `MULTI_AREA_SPOT_BADGE_LABEL = '複数スポット'`、`LANDMARK_AREA_EXPAND_LABEL_SUFFIX = 'の地点を開く'`、`LANDMARK_AREA_COLLAPSE_LABEL_SUFFIX = 'の地点を閉じる'`。

- [ ] テスト: `LabelBadge` に `label="複数スポット"` を渡すと `getByText('複数スポット')` が見つかる。既存の `PlusBadge.test.tsx` はそのまま通る。
- [ ] 実装・テスト通過・`appStylesSplit.test.ts` のキー数(改名のみなら変化なし)を確認してコミット。

### Task 2: `AppListItem` の `expanded`

**Files:** Modify `src/ui/components/AppListItem.tsx`、Test `src/ui/components/__tests__/AppListItem.test.tsx`

**Interfaces:**

- Produces: `expanded?: boolean`。`undefined` なら従来どおり。`true`/`false` なら右端に `Feather` の `chevron-up`(true)/`chevron-down`(false) を出し、`showChevron` の `chevron-right` は出さない。`Pressable` に `accessibilityState={{ expanded }}` を付ける。

- [ ] テスト(既存の Feather モックで name を検証する既存テストの書き方に合わせる):
  - `expanded={false}` → `chevron-down` があり `chevron-right` がない。`accessibilityState.expanded === false`。
  - `expanded={true}` → `chevron-up`。`accessibilityState.expanded === true`。
- [ ] 実装・通過・コミット。

### Task 3: `animateListExpansion()`

**Files:** Create `src/ui/components/listExpansionAnimation.ts`、Test `src/ui/components/__tests__/listExpansionAnimation.test.ts`

**Interfaces:**

- Produces: `export const LIST_EXPANSION_DURATION_MS = 250;` と `export function animateListExpansion(): void`。`LayoutAnimation.configureNext({ duration, create: { type: easeInEaseOut, property: opacity }, update: { type: easeInEaseOut }, delete: { type: easeInEaseOut, property: opacity } })` を呼ぶ。開閉の state 更新の「直前」に呼ぶ旨を JSDoc に書く(`Dialog.tsx` の `animateDialogResize` と同じ方式)。

- [ ] テスト: `jest.spyOn(LayoutAnimation, 'configureNext')` で、duration 250・create/delete が opacity のフェードで呼ばれることを検証。
- [ ] 実装・通過・コミット。

### Task 4: `LandmarkPackScreen` の開閉・バッジ・進捗バー

**Files:** Modify `src/ui/components/LandmarkPackScreen.tsx`、Test `src/ui/components/__tests__/LandmarkPackScreen.test.tsx`

**Interfaces:**

- Consumes: Task 1〜3 の `LabelBadge`、`expanded`、`animateListExpansion`、文言定数。既存の `AppProgressBar` と、スタンプラリー一覧と同じ `landmarkPackProgressRow` / `landmarkPackProgressText` / `landmarkPackProgressBarArea` スタイル。

挙動(spec の「挙動」節が正):

- `const [expandedSpotIds, setExpandedSpotIds] = useState<ReadonlySet<string>>(new Set())`。初期は空(すべて閉じる)。
- 複数地点スポット行(`spot.isMultiArea`)の `onPress`: `animateListExpansion()` → 開閉トグル → `setFocusRequest`(スポット全体へズーム、既存の nonce 方式)。コンプリート済みでも同じ(`onSelectVisitedSpot` は呼ばない)。
- 複数地点スポット行: `expanded={isExpanded}`、`titleAccessory={<LabelBadge label={MULTI_AREA_SPOT_BADGE_LABEL} />}`、`accessibilityLabel` は `${spot.name}${isExpanded ? COLLAPSE : EXPAND}`、`footer` に `${reachedAreaCount}/${areaItems.length}` と `AppProgressBar`(ratio = reached/total、accessibilityLabel `${spot.name}の進捗`)。`detail` はコンプリート時の「コンプリート日: …」だけ(未コンプリートでは出さない)。
- 地点の行は `isExpanded` のときだけ描画する。
- 円1つのスポットは変更しない。

- [ ] 既存テストを新仕様に合わせて直す:
  - 「複数地点スポットの行に到達地点数の進捗を表示する」→ 進捗テキストと `${spot.name}の進捗` のバーが出ることを検証。
  - 地点行を使うテスト(地点行の表示・到達済み地点行で記録へ・未到達地点行でズーム)は、先にスポット行を押して開いてから検証する。
  - 「コンプリート済みの複数地点スポット行を押すとスポット到達日の記録へ遷移する」→「押しても記録へ遷移せず、地点リストを開く」に置き換える。
- [ ] 新規テスト:
  - 初期状態では地点の行が出ていない(`queryByText(地点名)` が null)。
  - スポット行を押すと地点の行が出て地図がスポット全体へズームし、もう一度押すと消えて再ズームする。読み上げラベルが「の地点を開く」→「の地点を閉じる」に変わる。
  - 押したときに `LayoutAnimation.configureNext` が呼ばれる。
  - 複数地点スポット行に「複数スポット」バッジが出て、円1つのスポットには出ない。
- [ ] 実装・`npm test` 全体通過・コミット。

### Task 5: ドキュメント

- [ ] `docs/achievements.md` §14.6「パック詳細画面」を新仕様に更新(開閉・初期は閉じる・行タップは開閉＋ズーム・コンプリート済みも同じ・バッジ・進捗バー・アニメーション)。
- [ ] `DESIGN.md` のカタログ: `AppListItem` の props に `expanded?`、`LabelBadge` を追加(`PlusBadge` は LabelBadge を使う旨)。
- [ ] `npm run typecheck` / `npm test` / `npm run lint`(error 0) / `npx prettier --check` を通してコミット。
