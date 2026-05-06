# 課金・カスタマイズ仕様

## 1. 基本方針

Strollia は基本機能を無料で使えるローカルファーストGPSロガーとし、見た目のカスタマイズを有料要素として提供する。

課金基盤には RevenueCat を使用する方針とする。

## 2. 課金対象

初期候補は以下とする。

- ルート線の色変更
- ルート線の太さ変更
- ルート線の発光スタイル
- 現在地アイコン変更

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

実際の購入、復元、RevenueCat CustomerInfo 連携は次段階で実装する。カスタマイズ選択値はSQLiteへ保存し、RevenueCat導入後も保存値自体は保持する。Plusが無効な場合は反映時に無料状態へフォールバックする。

### 4.1 ルート線スタイル

無料状態では現在のクラシックなルート線を使う。Plus有効時のみ、色、太さ、発光スタイルなどの有料スタイルを選択できる。

実装上は `resolveRouteLineStyle` で課金状態と選択スタイルを解決し、未課金で有料スタイルが選ばれている場合はクラシックへフォールバックする。

### 4.2 現在地アイコン

無料状態では `react-native-maps` のOS標準現在地表示を使う。Plus有効時に有料アイコンが選択された場合のみ、`showsUserLocation=false` として独自Markerで現在地を描画する。

実装上は `resolveUserLocationIcon` でOS標準表示を使うか独自Markerへ切り替えるかを判定する。選択値が有料アイコンで、Plusが無効な場合はOS標準表示へフォールバックする。

## 5. 設定画面

設定画面に `Strollia Plus` カードを表示する。

カードには以下を含める。

- RevenueCat連携準備中であること
- 現在のPlus状態
- ルート線の見た目
- 現在地アイコン

項目タップ時は、RevenueCat連携後に開放予定であることを説明する。

## 6. プライバシー

RevenueCat連携後も、GPSログや写真メタデータをRevenueCatへ送信しない。

RevenueCatへ送る情報は購入状態の管理に必要なアプリユーザーIDやストア購入情報に限定する。


## 7. カスタマイズ実装の編集ポイント

### 7.1 ルート線スタイルを変更する場所

ルート線の候補は以下で定義する。

- `src/features/customization/customizationOptions.ts`
- `ROUTE_LINE_STYLE_OPTIONS`

変更する主な値は以下である。

- `id`: 設定保存に使う識別子。既存ユーザーの保存値に影響するため、公開後は安易に変えない
- `label`: 設定画面に表示する名前
- `color`: Plusスタイルの線色。`classic` はテーマ色を使うため `null` とする
- `width`: `Polyline` の線幅
- `glow`: 発光風の下敷き線を描画するか
- `premium`: Plus限定なら `true`

ルート線の実際の反映は以下で行う。

- `src/features/customization/customizationResolver.ts`
- `resolveRouteLineStyle`
- `src/app/App.tsx` の `Polyline`

無料状態では `classic` が使われる。Plus無効時に有料スタイルが保存されていても、描画時に `classic` へフォールバックする。

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

- `routeLineStyle`
- `userLocationIcon`

保存処理と読み込み処理は `src/app/App.tsx` にある。文字列設定の読み込みは `src/features/settings/settingsRepository.ts` の `getStringSetting` を使う。

### 7.4 開発中のPlus有効化

RevenueCat導入前に有料カスタマイズを確認するため、以下のフラグでPlus状態を仮に有効化している。

- `src/features/premium/revenueCatAccess.ts`
- `DEVELOPMENT_PREMIUM_ACCESS_ENABLED`

RevenueCat導入後は、このフラグではなくRevenueCatの `CustomerInfo.entitlements.active` をもとに `isPlusActive` を決定する。

## 8. 次に実装すること

次に再開する場合は以下から進める。

1. 現在地アイコン画像のアセット置き場を作る
2. `USER_LOCATION_ICON_OPTIONS` に画像情報を持たせる
3. 独自現在地Markerを画像表示へ差し替える
4. ルート線スタイルの本命デザインを `ROUTE_LINE_STYLE_OPTIONS` に追加・調整する
5. RevenueCat SDKを導入し、`isPlusActive` の供給元を差し替える
6. 購入・復元UIを設定画面に追加する
