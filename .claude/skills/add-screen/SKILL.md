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
2. **画面コンポーネント作成**: `src/app/components/XxxScreen.tsx` を新規作成
   - `DESIGN.md` §15 の雛形に従う: `SafeAreaView` + `styles.appScreen` + `AppScreenHeader` + `ScrollView`
   - props は `styles: AppStyles` / `theme: AppTheme` + データ + コールバック。DB・端末APIを直接呼ばない
   - 全押下要素に `accessibilityLabel` を付ける
3. **スタイル追加**: 画面固有スタイルは `src/app/appStyles.ts` の `createStyles(theme)` に追加。色は `theme.colors.*` か派生準トークン(`settingsText` 等)のみ使用。ハードコード禁止
4. **文言追加**: ユーザー向け文言は `src/app/appText.ts` に定数として追加
5. **ナビゲーション登録**: `src/app/App.tsx` の該当スタック(`SettingsStack` / `DailyLogStack`)に `Stack.Screen` を追加
   - `screenOptions` は既存の `{ animation: 'slide_from_right', gestureEnabled: true, headerShown: false }` を踏襲(右入り/左戻り+iOSスワイプバック)
   - Sentry画面名(`Settings:Xxx` 形式)が `onStateChange` で通知されることを確認
6. **テスト作成**: `src/app/components/__tests__/XxxScreen.test.tsx`。書き方は `.ai/context/testing.md` 参照(日本語describe、accessibilityLabelで要素特定)
7. **検証**: `npm run typecheck` と `npm test`。ライト/ダーク両方で背景・文字・境界線が破綻しないか確認(`DESIGN.md` §18 のチェックリスト)

## よくある間違い

- 画面ローカルに `StyleSheet.create` を作る → `appStyles.ts` に集約する
- 画面名に閉じた再利用不能な部品を作る → 汎用名で共通コンポーネント化するか既存を使う
- 太字をデフォルトにする → 見出しのみ 900、本文・リスト行は 400
