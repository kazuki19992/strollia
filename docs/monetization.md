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
