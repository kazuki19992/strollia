# RevenueCat Paywall and Purchase Flow Design

## 1. Goal

Strollia Plusの購入導線をRevenueCat Paywallで表示し、購入後または復元後に既存のPlus判定へ反映できるようにする。

このPRではアプリ内の購入・復元・Paywall表示・Offering表示の実装と、ストア/RevenueCat Dashboard実設定のチェックリスト整備を行う。App Store Connect、Google Play Console、RevenueCat Dashboardの実操作はこのPRでは行わない。

## 2. Scope

### In scope

- `react-native-purchases-ui` を追加する
- 設定画面からRevenueCat Paywallを表示する
- RevenueCatのOffering / Package / Productを取得し、設定画面に現在の商品状態を表示する
- Paywallで購入または復元が完了した場合にPlus状態を再取得する
- 明示的な「購入を復元」ボタンで `restorePurchases()` を呼ぶ
- Plus限定項目をタップした時にPaywallへ誘導する
- App Store Connect / Google Play Console / RevenueCat Dashboard設定チェックリストをdocsへ追加する

### Out of scope

- App Store Connect / Google Play Console / RevenueCat Dashboardの実操作
- Sign in with Apple導入
- 独自アカウント機能
- サーバー同期
- カスタムPaywallの全面自作
- 新しいPlus特典の追加

## 3. Identity Policy

今回の購入導線ではRevenueCatの匿名App User IDを使う。

理由は、Strolliaがローカルファーストであり、現時点でアカウント機能を持たないためである。RevenueCat公式仕様では、`Purchases.configure()` にApp User IDを渡さない場合、SDKが `$RCAnonymousID:` で始まる匿名IDを端末に生成・キャッシュする。この方式はログイン不要の単一アプリ購入導線に適している。

Apple IDそのものはアプリから取得できないため、RevenueCatのApp User IDには使わない。将来ログインID連携を行う場合は、Apple IDではなくSign in with Appleで返るアプリ/開発チーム向けの安定したユーザー識別子を `Purchases.logIn()` に渡す。その場合は、匿名IDから識別済みIDへのalias/merge、ログアウト方針、復元時の説明を別PRで設計する。

## 4. Architecture

### 4.1 Premium boundary

RevenueCat SDKとPaywall UIは `src/features/premium/` に閉じ込める。UIコンポーネントはRevenueCat SDK型を直接扱わず、アプリ向けDTOと操作関数だけを使う。

既存の `revenueCatClient.ts` を拡張し、SDK初期化を共有する。`react-native-purchases-ui` はJestや通常UIテストへ漏れないよう、Paywall表示関数内で遅延読み込みする。

### 4.2 Data model

アプリ内では以下のような表示用DTOを使う。

```ts
export type PremiumOfferingSummary = {
  offeringId: string;
  packages: PremiumPackageSummary[];
};

export type PremiumPackageSummary = {
  identifier: string;
  packageType: string;
  productIdentifier: string;
  title: string;
  description: string;
  priceText: string;
};
```

RevenueCatのPackage/Product型はこの境界内でDTOへ変換する。Offeringが未設定、商品が取得できない、APIキーが未設定の場合は `null` または空配列として扱い、設定画面とGPS記録は止めない。

### 4.3 Operations

`src/features/premium/revenueCatAccess.ts` は以下のアプリ向け操作を公開する。

- `getPremiumAccessState()`
- `getPremiumOfferingSummary()`
- `presentPremiumPaywall()`
- `restorePremiumPurchases()`

購入と復元の後は `getPremiumAccessState()` を再実行し、`App.tsx` 側の `premiumAccessState` を更新する。

## 5. UI Flow

### 5.1 Settings Plus card

設定画面のStrollia Plusカードには以下を表示する。

- Plus状態
- entitlement ID
- Offeringの商品概要
- 「Strollia Plusを見る」ボタン
- 「購入を復元」ボタン

Plus未加入の場合、「Strollia Plusを見る」でPaywallを表示する。Plus有効の場合も、必要に応じてプラン確認やRevenueCat Paywall表示に使える導線として残す。

Offering取得中は読み込み中表示、取得失敗時は「ストア設定を確認中」と表示する。エラー詳細はユーザーへ生のSDKエラーを見せず、console warningに残す。

### 5.2 Premium locked action

Plus限定の現在地アイコンを未加入状態でタップした場合は、従来の「実装後に選択可能」Alertをやめ、Paywall表示へ誘導する。

Paywall表示が購入または復元成功を返したらPlus状態を再取得する。キャンセル、未表示、エラーの場合は選択状態を変えない。

### 5.3 Restore

設定画面の「購入を復元」は `Purchases.restorePurchases()` を呼ぶ。戻り値のCustomerInfoに `strollia_plus` entitlementがあればPlus有効として反映する。

復元完了でもentitlementが無い場合は、購入が見つからなかった旨を表示する。復元失敗時は短いエラーメッセージを表示し、詳細はconsole warningに残す。

## 6. Error Handling

- APIキー未設定: Paywall/Offering/Restoreは利用不可として扱い、開発用Plusフラグの状態表示は維持する
- Offering未設定: 商品概要は未取得表示、Paywallボタンは押せるが失敗時に設定確認メッセージを出す
- Paywallキャンセル: 何も変更しない
- Paywall購入/復元成功: Plus状態を再取得する
- RevenueCat UIモジュール読み込み失敗: Paywallを表示せず、development buildが必要である可能性を案内する
- ネットワークエラー: 設定画面は表示したまま、後で再試行できるようにする

## 7. Dashboard and Store Checklist

docsには以下のチェックリストを追加する。

- App Store Connectの商品ID
  - `strollia_plus_monthly`
  - `strollia_plus_yearly`
- Google Play Consoleの商品ID
  - `strollia_plus_monthly`
  - `strollia_plus_yearly`
- RevenueCat entitlement
  - `strollia_plus`
- RevenueCat offering
  - current offeringに月額/年額packageを紐づける
- RevenueCat Paywall
  - current offeringにPaywallを紐づける
- Expo development buildで実購入/復元を確認する
- Expo Goでは実購入確認をしない

## 8. Testing

### Unit tests

- Offering DTO変換
- APIキー未設定時のOffering/Paywall/Restore fallback
- Paywall result別の成功/キャンセル判定
- Restore後CustomerInfoにentitlementがある場合とない場合
- Settings画面の商品表示、Paywallボタン、復元ボタン
- Plus限定項目タップ時にPaywall操作が呼ばれること

### Manual verification

- `npm run typecheck`
- `npm test -- --runInBand`
- development buildでPaywall表示、購入、復元を確認する

## 9. Implementation Order

1. `react-native-purchases-ui` を依存に追加する
2. premium境界にOffering/Paywall/Restoreのテストを追加する
3. RevenueCat clientを拡張する
4. Settings画面へ商品表示、Paywall、復元導線を追加する
5. Plus限定項目タップ時のPaywall誘導を追加する
6. monetization docsとtodoを更新する
7. 型チェックとテストを実行する

## 10. Open Decisions

Sign in with Apple連携は今回実装しない。必要になった時点で、匿名IDからSign in with Apple識別子へ移行する設計を別PRで扱う。
