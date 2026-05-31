# 課金・カスタマイズ仕様

## 1. 基本方針

Strollia は基本機能を無料で使えるローカルファーストGPSロガーとし、蓄積したログをより深く振り返る機能と見た目のカスタマイズを有料要素として提供する。

課金基盤には RevenueCat を使用する方針とする。

## 2. 課金対象

初期候補は以下とする。

- 現在地アイコン変更
- visited cell色変更
- 高度統計
- 月次レポート / 年次レポート
- 日別移動リプレイ

GPS記録、ローカル保存、日別ログ、GPXエクスポートなどの基本機能は無料のままとする。

アプリアイコン変更は、OS差分、Expo設定、ストア審査への影響が大きいため、初期の課金対象から外す。

## 3. RevenueCat方針

RevenueCat 側では `strollia_plus` entitlement を用意する。

商品ID候補は以下とする。

- `strollia_plus_monthly`
- `strollia_plus_yearly`

アプリ側は RevenueCat SDK を直接UIへ結合せず、`src/features/premium/` の境界を通して課金状態を取得する。

## 4. カスタマイズ方針

カスタマイズ候補は `src/features/customization/` に定義する。

初期実装では以下を準備する。

- 無料で使える標準スタイル
- Plusで開放するスタイル候補
- Plus未加入時にロック表示する設定画面項目

カスタマイズ選択値はSQLiteへ保存し、RevenueCat導入後も保存値自体は保持する。Plus状態はRevenueCat CustomerInfoで判定し、Plusが無効な場合は反映時に無料状態へフォールバックする。実際の購入、復元、Paywall、商品表示は次段階で実装する。

### 4.1 visited cell色

メインマップではルート線ではなくVisited Grid Overlayを主表示とする。visited cell色はテーマのprimaryを既定値とし、将来的にはPlus向けのカスタマイズ候補として差し替えられるようにする。

初期実装ではUIには出さず、`GRID_OVERLAY_CONFIG.visitedCellColorOverride` によって実装側で調整しやすい構成にする。

### 4.2 現在地アイコン

無料状態では `react-native-maps` のOS標準現在地表示を使う。Plus有効時に有料アイコンが選択された場合のみ、`showsUserLocation=false` として独自Markerで現在地を描画する。

実装上は `resolveUserLocationIcon` でOS標準表示を使うか独自Markerへ切り替えるかを判定する。選択値が有料アイコンで、Plusが無効な場合はOS標準表示へフォールバックする。

## 5. 設定画面

設定画面に `Strollia Plus` カードを表示する。

カードには以下を含める。

- RevenueCat連携済みであること
- 現在のPlus状態
- 現在地アイコン

項目タップ時は、購入・復元フロー実装後に選択できることを説明する。

## 6. プライバシー

RevenueCat連携後も、GPSログや写真メタデータをRevenueCatへ送信しない。

RevenueCatへ送る情報は購入状態の管理に必要なアプリユーザーIDやストア購入情報に限定する。


## 7. カスタマイズ実装の編集ポイント

### 7.1 visited cell色を変更する場所

visited cell色は以下で定義する。

- `src/features/map/config/gridOverlayConfig.ts`
- `visitedCellColorOverride`

`visitedCellColorOverride` が `null` の場合はテーマのprimaryを使う。HEX色を指定すると、テーマに関係なくその色をvisited cellへ使う。

visited cellの実際の反映は以下で行う。

- `src/features/map/gridOverlay.ts`
- `resolveVisitedGridCellColor`
- `src/app/App.tsx` の Grid Overlay生成

### 7.2 現在地アイコンを変更する場所

現在地アイコンの候補は以下で定義する。

- `src/features/customization/customizationOptions.ts`
- `USER_LOCATION_ICON_OPTIONS`

現在の実装では、Plus有効時に `walker` / `compass` を選ぶと `showsUserLocation=false` になり、独自 `Marker` を描画する。

独自Markerの描画は以下で行う。

- `src/app/App.tsx`
- `userLocationIcon.customIconId` を使っている `Marker`
- `src/app/appStyles.ts` の `customUserLocationMarker`

現在は `@expo/vector-icons` の `MaterialCommunityIcons` を使っている。画像アセットに差し替える場合は、例えば以下のように進める。

1. `assets/user-location-icons/` を作成する
2. `walker.png` や `compass.png` などの画像を配置する
3. `USER_LOCATION_ICON_OPTIONS` に画像参照用の情報を追加する
4. `App.tsx` の独自現在地 `Marker` 内を `Image` 表示へ差し替える
5. 対応するテストと仕様を更新する

無料状態ではOS標準の現在地アイコンを使う。Plus無効時に有料アイコンが保存されていても、描画時にOS標準表示へフォールバックする。

### 7.3 設定保存

カスタマイズ選択値は `app_settings` に保存する。

現在の保存キーは以下である。

- `userLocationIcon`

保存処理と読み込み処理は `src/app/App.tsx` にある。文字列設定の読み込みは `src/features/settings/settingsRepository.ts` の `getStringSetting` を使う。

### 7.4 RevenueCat SDK連携

RevenueCat SDKは `react-native-purchases` で導入する。アプリ側は以下の環境変数からプラットフォームごとのPublic SDK API keyを読み込む。

- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`

APIキーが未設定の場合、SDK初期化は行わず、既存の開発用Plusフラグへフォールバックする。

- `EXPO_PUBLIC_ENABLE_PREMIUM_ACCESS_WITHOUT_REVENUECAT=true`

Plus状態の判定は `CustomerInfo.entitlements.active.strollia_plus` をもとに実装済みである。

購入導線は `react-native-purchases-ui` のRevenueCat Paywallを使う。設定画面のStrollia PlusカードからPaywallを表示し、購入または復元完了後に `CustomerInfo` を再取得してPlus状態へ反映する。

商品表示は `Purchases.getOfferings()` のcurrent offeringから取得する。Offeringや商品が未設定の場合もGPS記録や設定画面は止めず、商品情報は確認中として表示する。

購入復元は設定画面の「購入を復元」から `Purchases.restorePurchases()` を呼ぶ。復元後に `strollia_plus` entitlementが有効ならPlus有効として扱う。

Strolliaは現時点で独自アカウントを持たないため、RevenueCatの匿名App User IDを使う。Apple IDそのものはアプリから取得できない。将来ログインID連携を行う場合は、Sign in with Appleで返るアプリ/開発チーム向け識別子を `Purchases.logIn()` に渡す。

Expo Goでは実購入テストは行わない。RevenueCatの実SDK動作と購入確認にはExpo development build、RevenueCat Dashboard設定、App Store ConnectまたはGoogle Play Consoleの商品設定が必要である。

Expo SDK 54 / React Native 0.81 のNew Architectureでは、RevenueCat SDKのnative module登録に失敗する可能性があるため、Paywall導入時点では `app.json` の `newArchEnabled` を `false` にする。RevenueCat側でExpo SDK 54 New Architecture対応が確認できたら、development buildで購入・復元を再検証したうえで有効化を検討する。

### 7.5 RevenueCat / Store実設定チェックリスト

- App Store Connectで `strollia_plus_monthly` と `strollia_plus_yearly` を作成する
- Google Play Consoleで `strollia_plus_monthly` と `strollia_plus_yearly` を作成する
- RevenueCatで `strollia_plus` entitlementを作成する
- RevenueCatでcurrent offeringに月額/年額packageを紐づける
- RevenueCat Paywallをcurrent offeringへ紐づける
- iOS/AndroidのPublic SDK API keyを環境変数へ設定する
- `app.json` の `newArchEnabled` が `false` であることを確認する
- Expo development buildでPaywall表示、購入、復元を確認する

## 8. Plus機能ロードマップ

課金機能の詳細な優先順位と仕様は `docs/plus-features.md` にまとめる。

現時点では、実績演出強化よりも、蓄積ログの価値を高める月次レポート、高度統計、日別移動リプレイを優先する。月次レポートは期間指定集計として設計し、年次レポートへ拡張する。

## 9. 次に実装すること

次に再開する場合は以下から進める。

1. 現在地アイコン画像のアセット置き場を作る
2. `USER_LOCATION_ICON_OPTIONS` に画像情報を持たせる
3. 独自現在地Markerを画像表示へ差し替える
4. visited cell色カスタマイズをUI化するか判断する
5. 高度統計の集計仕様と画面を実装する
6. 日別移動リプレイMVPを実装する
7. 購入・復元UIを設定画面に追加する

実装済み:

- 月次レポートMVP
- RevenueCat SDK導入とCustomerInfoによるPlus状態判定
