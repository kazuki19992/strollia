# 課金・カスタマイズ仕様

## 1. 基本方針

Strollia は基本機能を無料で使えるローカルファーストGPSロガーとし、蓄積したログをより深く振り返る機能と見た目のカスタマイズを有料要素として提供する。

課金基盤には RevenueCat を使用する方針とする。

## 2. 課金対象

初期候補は以下とする。

- 現在地アイコン変更
- エリア色変更
- 高度統計
- 月次レポート / 年次レポート
- 日別詳細レポート
- 日別移動リプレイ

GPS記録、ローカル保存、日別ログ、GPXエクスポートなどの基本機能は無料のままとする。

アプリアイコン変更は、OS差分、Expo設定、ストア審査への影響が大きいため、初期の課金対象から外す。

## 3. RevenueCat方針

RevenueCat 側では `strollia_plus` entitlement を用意する。

商品ID候補は以下とする。

- `strollia_plus_monthly`
- `strollia_plus_yearly`

初期価格は以下とする。

- 月額: 300円
- 年額: 3,300円

アプリ内表示ではRevenueCat Offering / Productから取得したストア表示を優先し、価格を固定文字列として埋め込まない。

アプリ側は RevenueCat SDK を直接UIへ結合せず、`src/features/premium/` の境界を通して課金状態を取得する。

## 4. カスタマイズ方針

カスタマイズ候補は `src/features/customization/` に定義する。

初期実装では以下を準備する。

- 無料で使える標準スタイル
- Plusで開放するスタイル候補
- Plus未加入時にロック表示する設定画面項目

カスタマイズ選択値はSQLiteへ保存し、RevenueCat導入後も保存値自体は保持する。Plus状態はRevenueCat CustomerInfoで判定し、Plusが無効な場合は反映時に無料状態へフォールバックする。購入、復元、商品表示は `src/features/premium/` の境界を通して実装する。

### 4.1 エリア / visited cell色

メインマップではルート線ではなくVisited Grid Overlayを主表示とする。VisitedCellはユーザー向けには「エリア」と呼ぶ。Strolliaは移動記録アプリであると同時に、地図を塗りつぶしていくゲーム的な体験を持つため、画面文言やPlus特典説明では「エリア」を優先する。

visited cell色はテーマのprimaryを既定値とし、将来的にはPlus向けのエリア色カスタマイズ候補として差し替えられるようにする。

初期実装ではUIには出さず、`GRID_OVERLAY_CONFIG.visitedCellColorOverride` によって実装側で調整しやすい構成にする。

### 4.2 現在地アイコン

無料状態では `react-native-maps` のOS標準現在地表示を使う。Plus有効時に有料アイコンが選択された場合のみ、`showsUserLocation=false` として独自Markerで現在地を描画する。

実装上は `resolveUserLocationIcon` でOS標準表示を使うか独自Markerへ切り替えるかを判定する。選択値が有料アイコンで、Plusが無効な場合はOS標準表示へフォールバックする。

## 5. 設定画面

設定画面のサブスク情報には、現在のPlus状態と購入導線を表示する。

サブスク有効時は以下を表示する。

- ステータス
- `Plusユーザー` バッジ
- `サブスクを管理する` ボタン
- 退会はストア側のサブスク設定から行う案内

未加入時は以下を表示する。

- `加入する` ボタン
- `サブスクを復元する` ボタン
- Offering取得中は商品情報確認中の文言

現在地アイコン設定は、地図画面設定の中にアイコン付き選択ボタンとして表示する。Plus未加入時も候補は見せるが、有料候補にはロックを表示し、選択時は設定画面の月払い/年払いから加入できることを案内する。

GPS記録状態は設定画面冒頭の大きなパネルで表示する。権限があり記録中のときはprimary色のパネル、権限が不足しているときは赤色パネルと権限付与ボタン、自動記録開始に失敗したときはオレンジ色パネルと復旧用の記録開始ボタンを表示する。

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
- `src/ui/state/AppStateProvider.tsx` の Grid Overlay生成(`useVisitedGridOverlay` 経由)

### 7.2 現在地アイコンを変更する場所

現在地アイコンの候補は以下で定義する。

- `src/features/customization/customizationOptions.ts`
- `USER_LOCATION_ICON_OPTIONS`

現在の実装では、Plus有効時に `walker` / `compass` を選ぶと `showsUserLocation=false` になり、独自 `Marker` を描画する。

独自Markerの描画は以下で行う。

- `src/ui/components/MapScreen.tsx`
- `userLocationIcon.customIconId` を使っている `Marker`
- `src/ui/appStyles.ts` の `customUserLocationMarker`

現在は `@expo/vector-icons` の `MaterialCommunityIcons` を使っている。画像アセットに差し替える場合は、例えば以下のように進める。

1. `assets/user-location-icons/` を作成する
2. `walker.png` や `compass.png` などの画像を配置する
3. `USER_LOCATION_ICON_OPTIONS` に画像参照用の情報を追加する
4. `MapScreen.tsx` の独自現在地 `Marker` 内を `Image` 表示へ差し替える
5. 対応するテストと仕様を更新する

無料状態ではOS標準の現在地アイコンを使う。Plus無効時に有料アイコンが保存されていても、描画時にOS標準表示へフォールバックする。

### 7.3 設定保存

カスタマイズ選択値は `app_settings` に保存する。

現在の保存キーは以下である。

- `userLocationIcon`
- `appThemePreference`

保存処理と読み込み処理は `src/ui/state/AppStateProvider.tsx`(`useUserLocationIconSetting` フック経由)にある。文字列設定の読み込みは `src/features/settings/settingsRepository.ts` の `getStringSetting` を使う。

### 7.4 RevenueCat SDK連携

RevenueCat SDKは `react-native-purchases` で導入する。アプリ側は以下の環境変数からプラットフォームごとのPublic SDK API keyを読み込む。

- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`

APIキーが未設定の場合、SDK初期化は行わず、既存の開発用Plusフラグへフォールバックする。

- `EXPO_PUBLIC_ENABLE_PREMIUM_ACCESS_WITHOUT_REVENUECAT=true`

Plus状態の判定は `CustomerInfo.entitlements.active.strollia_plus` をもとに実装済みである。

購入導線はRevenueCat Paywallを使わず、設定画面の月払い/年払いボタンから `Purchases.purchasePackage()` を直接呼び出す。購入または復元完了後は `CustomerInfo` をもとにPlus状態へ反映する。

商品表示は `Purchases.getOfferings()` のcurrent offeringから取得する。Offeringや商品が未設定の場合もGPS記録や設定画面は止めず、商品情報は確認中として表示する。

購入復元は設定画面の「購入を復元」から `Purchases.restorePurchases()` を呼ぶ。復元後に `strollia_plus` entitlementが有効ならPlus有効として扱う。

アプリ起動中は `Purchases.addCustomerInfoUpdateListener()` でCustomerInfo更新を購読し、RevenueCat側で購入・復元・更新が反映された場合にStrollia Plus状態も追従する。

サブスク有効時はRevenueCat Customer Centerを設定画面から表示できるようにする。Customer CenterはRevenueCat Dashboard側で設定し、ユーザーがサブスク管理、購入復元、サポート導線をセルフサービスで扱える状態にする。

Strolliaは現時点で独自アカウントを持たないため、RevenueCatの匿名App User IDを使う。Apple IDそのものはアプリから取得できない。将来ログインID連携を行う場合は、Sign in with Appleで返るアプリ/開発チーム向け識別子を `Purchases.logIn()` に渡す。

同一ストアアカウントであれば、端末移行後に設定画面の「購入を復元」からサブスクを復元できる想定である。RevenueCat DashboardのRestore Behaviorは、アカウントなしアプリで復元しやすい `Transfer to new App User ID` を初期方針とする。

iOSからAndroidのようにストアをまたぐ復元は、匿名App User IDだけでは自動的にはつながらない。将来クロスプラットフォーム復元を扱う場合は、Sign in with AppleなどのログインID連携を別途設計する。

Expo Goでは実購入テストは行わない。RevenueCatの実SDK動作と購入確認にはExpo development build、RevenueCat Dashboard設定、App Store ConnectまたはGoogle Play Consoleの商品設定が必要である。

Expo SDK 54 / React Native 0.81 のNew Architectureでは、RevenueCat SDKのnative module登録に失敗する可能性があるため、課金導入時点では `app.json` の `newArchEnabled` を `false` にする。RevenueCat側でExpo SDK 54 New Architecture対応が確認できたら、development buildで購入・復元を再検証したうえで有効化を検討する。

### 7.5 RevenueCat / Store実設定チェックリスト

- App Store Connectで `strollia_plus_monthly` と `strollia_plus_yearly` を作成する
- Google Play Consoleで `strollia_plus_monthly` と `strollia_plus_yearly` を作成する
- RevenueCatで `strollia_plus` entitlementを作成する
- RevenueCatでcurrent offeringに月額/年額packageを紐づける
- RevenueCat Customer Centerを必要なサポート導線に合わせて設定する
- iOS/AndroidのPublic SDK API keyを環境変数へ設定する
- `app.json` の `newArchEnabled` が `false` であることを確認する
- Expo development buildで月払い購入、年払い購入、復元、Customer Center表示を確認する

## 8. Plus機能ロードマップ

課金機能の詳細な優先順位と仕様は `docs/plus-features.md` にまとめる。

現時点では、実績演出強化よりも、蓄積ログの価値を高める月次レポート、高度統計、日別詳細レポート、日別移動リプレイを優先する。月次レポートは期間指定集計として設計し、年次レポートへ拡張する。

## 9. 次に実装すること

次に再開する場合は以下から進める。

1. 現在地アイコン画像のアセット置き場を作る
2. `USER_LOCATION_ICON_OPTIONS` に画像情報を持たせる
3. 独自現在地Markerを画像表示へ差し替える
4. エリア色カスタマイズをUI化するか判断する
5. 高度統計の集計仕様と画面を実装する
6. 日別移動リプレイMVPを実装する

実装済み:

- 月次レポートMVP
- 日別詳細レポートMVP
- RevenueCat SDK導入とCustomerInfoによるPlus状態判定
- RevenueCat直接購入、復元、Offering表示、Customer Center表示
