---
name: premium-gate
description: Use when adding or modifying Strollia Plus (premium) gated features, RevenueCat entitlement checks, paywall flows, or premium-only options. Triggers include Plus限定, 課金, premium, RevenueCat, entitlement, paywall.
---

# Plus機能ゲート

## 前提知識

- 権利ID: `STROLLIA_PLUS_ENTITLEMENT_ID = 'Strollia Plus'`(`src/features/premium/premiumCatalog.ts`)
- 商品: `strollia_plus_monthly` / `strollia_plus_yearly`
- Plus判定の中心: `src/features/premium/revenueCatAccess.ts` の `PremiumAccessState { isPlusActive: boolean }`
- 仕様ドキュメント: `docs/monetization.md`, `docs/plus-features.md`, `docs/revenuecat-integration.md`

## 実装パターン

1. **状態取得**: `getPremiumAccessState()` / `getConfirmedPremiumAccessState()` で `isPlusActive` を取得。変更の購読は `subscribePremiumAccessStateUpdates(onUpdate)`
2. **オプションのゲート**: 選択肢に `premium: boolean` フラグを持たせ、`getAvailableCustomizationOptions(options, isPlusActive)` で絞り込む(実例: `src/features/customization/customizationOptions.ts` の `USER_LOCATION_ICON_OPTIONS`)
3. **設定画面への項目追加**: `premiumCatalog.ts` の `PREMIUM_CUSTOMIZATION_ITEMS` に追加(id/title/description)
4. **購入導線**: `purchasePremiumPackage(plan)` / `restorePremiumPurchases()` / `presentPremiumCustomerCenter()`。UIは `PremiumPaywallModal` を再利用
5. **UI表現**: ロック状態は Plus バッジで示す。Plusバッジ色はカラープリセットに関わらず常に「まっちゃ」(`appStyles.ts` 冒頭の `plusBadgeColor`)

## 開発用フラグ

RevenueCat なしで Plus を有効化: `.env` に `EXPO_PUBLIC_ENABLE_PREMIUM_ACCESS_WITHOUT_REVENUECAT=true`
(`src/config/developmentFlags.ts` の `enablePremiumAccessWithoutRevenueCat`)。
本番プロファイルに混入させないこと。

## テスト

- `RevenueCatClient` 型(`hasActiveEntitlement` 等)をモックして `resolvePremiumAccessState` 系をテスト(実例: `src/features/premium/__tests__/`)
- ゲートロジックは純粋関数(`getAvailableCustomizationOptions` 等)に切り出して単体テストする

## よくある間違い

- `isPlusActive` を画面ローカルで判定して分岐をコピペする → 純粋関数に切り出す
- 課金の文言で影響範囲を省略する → 価格・解約・復元の説明を必ず添える(`DESIGN.md` §10)
- 開発フラグ有効のまま検証を完了扱いにする → フラグOFFでロック表示も確認する
