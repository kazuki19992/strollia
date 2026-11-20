# Plus用パックのラベルとぼかし導線 実装計画

**Goal:** 実績画面のスポットセクションで、Plus用パックに「Plus」ラベルを付け、無料ユーザーにはPlus用パックを0.5件だけ見せて残りをグラデーション状のぼかしで隠し、「Plusでもっと挑戦する」導線を出す。

**Spec:** `docs/superpowers/specs/2026-11-20-plus-pack-blur-teaser-design.md`

## Global Constraints

- 文言は `src/ui/appText.ts`: `PLUS_BADGE_LABEL = 'Plus'`, `LANDMARK_PACK_PLUS_TEASER_CTA = 'Plusでもっと挑戦する'`
- `src/ui/components/**` で `StyleSheet.create` 禁止。スタイルは `src/ui/styles/*` に追加(`StyleSheet.absoluteFill` の参照は可)
- 1ファイル1コンポーネント・汎用名・props型をexportし日本語JSDoc
- 太字をデフォルトにしない
- テスト説明文は日本語。RTL v14 の API はすべて await

## Task 1: 分割の純粋関数

- Create `src/features/landmarks/landmarkPackTeaser.ts`: `splitLandmarkPacksForTeaser<T extends { pack: { isFree: boolean } }>(items: T[], isPlusActive: boolean): { visibleItems: T[]; peekItem: T | null; hiddenItems: T[] }`
- Test `src/features/landmarks/__tests__/landmarkPackTeaser.test.ts`: Plus有効→全件visible / Plus用0件・1件→全件visible / 2件→peekあり・hidden空 / 4件→hidden2件 / 無料パックがPlus用パックの後ろにあっても visible の表示順を保つ

## Task 2: 汎用部品

- `PlusBadge.tsx`(props: styles) — 小さなピル表示。accessibilityLabel は付けない(行ラベルに含める)
- `AppListItem` に `titleAccessory?: ReactNode` を追加し、タイトルと横並び(折り返し可)で表示
- `GradientBlurOverlay.tsx`(props: `gradientTop: number`, `gradientHeight: number`, `maxIntensity?: number`(既定90), `steps?: number`(既定8), `tint`) — 絶対配置。`gradientTop` から `gradientHeight` の間を `steps` 本の帯で強さを段階的に上げ、その下を最大強度1枚で覆う。`pointerEvents="none"`
- 各テスト

## Task 3: 実績画面への組み込み

- Plus用パック行に `titleAccessory={<PlusBadge/>}`、行の accessibilityLabel に「Plus」が分かる文言を含める
- `splitLandmarkPacksForTeaser` で分割し、peekItem があればぼかし領域を描画:
  - コンテナ(`accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`, `pointerEvents="none"`)内に peek 行と、固定高さ(定数 `LANDMARK_PACK_TEASER_HIDDEN_HEIGHT`)・`overflow: hidden` の hidden 行領域
  - peek 行の高さを onLayout で測り、`gradientTop = 0`, `gradientHeight = peekHeight`(行の上端から下端まで) で `GradientBlurOverlay`
  - 固定高さ領域の中央付近に `ActionPill`(既存のPlus CTA と同じ配色)「Plusでもっと挑戦する」→ `onRequestPremium`。こちらはアクセシブル
- 既存の `LANDMARK_PACK_PLUS_PROMOTION_NOTE` は残す
- テスト: ラベル有無(未加入/加入済み)、CTA 押下、ぼかし内の行がラベルで取得できない、Plus会員はCTAなし

## Task 4: ドキュメント

- `docs/achievements.md` §14.5、`docs/plus-features.md` §2.3 を更新
