---
name: add-screen
description: Use when adding a new screen to the Strollia app, or when restructuring an existing screen's layout and navigation. Triggers include 画面追加, 新しい画面, new screen, XxxScreen 作成.
---

# 新規画面追加

## 前提

- `DESIGN.md` を必ず先に読む(§13〜17 に実値・コンポーネントカタログ・雛形コードがある)
- 軽微でない画面作成は AGENTS.md §10.2 に従い、設計書→承認→計画→TDD の順で進める

## 手順

1. **設計確認**: リスト主体・帯状UIか確認(カード多用は禁止)。既存の共通コンポーネント(`AppScreenHeader`, `AppListItem`, `ActionPill`, `SelectionTile`, `ScreenSection` など)で構成できるか `DESIGN.md` §14 のカタログと突き合わせる

2. **画面コンポーネント作成**: `src/ui/components/XxxScreen.tsx` を新規作成
   - `DESIGN.md` §15 の雛形に従う: `SafeAreaView` + `styles.appScreen` + `AppScreenHeader` + `ScrollView`
   - props は `styles: AppStyles` / `theme: AppTheme` + データ + コールバック。DB・端末APIを直接呼ばない
   - 全押下要素に `accessibilityLabel` を付ける

3. **スタイル追加**: 画面固有スタイルは `src/ui/appStyles.ts` の `createStyles(theme)` に追加。色は `theme.colors.*` か派生準トークン(`settingsText` 等)のみ使用。ハードコード禁止

4. **文言追加**: ユーザー向け文言は `src/ui/appText.ts` に定数として追加

5. **ルートファイル追加**: `src/app/` 配下に expo-router のルートファイルを作成
   - トップレベル画面: `src/app/foo.tsx`
   - 設定スタック内の子画面: `src/app/settings/foo.tsx`(自動検出されるため `_layout.tsx` への手動追加は不要)
   - 日別記録スタック内の子画面: `src/app/daily-logs/foo.tsx`
   - ルートファイルは薄いラッパーにする: `useAppState()` で状態を取得し、画面コンポーネントへ props を渡すだけ

6. **ナビゲーション接続**:
   - `src/app/_layout.tsx` の `useRouterNavigator` に `router.push('/foo')` 等のコールバックを追加する
   - `AppStateProvider`(`src/ui/state/AppStateProvider.tsx`) の `AppStateContextValue` 型と実装に `openFoo` 等のコールバックを追加する
   - `navigator` prop 経由で繋ぐことで、AppStateProvider がルーターの遷移を実行する

7. **Sentry 画面名マッパーを更新** (`src/ui/pathnameToScreenMode.ts`):
   - トップレベル画面の場合: `pathnameToScreenMode` の switch に新パスのケースを追加する
   - 設定スタック内の場合: `pathnameToSettingsSentryScreenName` に `Settings:FooScreen` 形式で追加する
   - 日別記録スタック内の場合: `pathnameToDailyLogsSentryScreenName` に追加する

8. **テスト作成**: `src/ui/components/__tests__/XxxScreen.test.tsx`。書き方は `.ai/context/testing.md` 参照(日本語describe、accessibilityLabelで要素特定)

9. **統合テスト追加**: ルートレベルの遷移テストは `src/ui/__tests__/AppMapReturn.test.tsx` またはその近傍に追加する。`renderRouter('src/app')` を使い、`screen.UNSAFE_getByProps` で要素を特定する

10. **検証**: `npm run typecheck` と `npm test` と `npm run lint`。ライト/ダーク両方で背景・文字・境界線が破綻しないか確認(`DESIGN.md` §18 のチェックリスト)

## よくある間違い

- 画面ローカルに `StyleSheet.create` を作る → `src/ui/appStyles.ts` に集約する
- 画面名に閉じた再利用不能な部品を作る → 汎用名で共通コンポーネント化するか既存を使う
- 太字をデフォルトにする → 見出しのみ 900、本文・リスト行は 400
- ルートファイルにロジックを直接書く → AppStateProvider に移し、ルートファイルは props の橋渡しだけにする
- Sentry 画面名マッパーの更新を忘れる → 新パスを `pathnameToScreenMode.ts` に追加しないと画面名が `'Map'` にフォールバックする
