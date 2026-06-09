# 日ごとの記録詳細ページ Strollia Plus ペイウォール設計

## 概要

日ごとの記録の詳細ページに Strollia Plus 限定コンテンツのマスキングと、全画面ペイウォールモーダルを実装する。

---

## 新規コンポーネント

### `PremiumPaywallModal`

**ファイル:** `src/app/components/PremiumPaywallModal.tsx`

- React Native の `Modal`（システムコンポーネント）を使用
- `animationType="slide"` / `presentationStyle="pageSheet"`
- 設定画面のサブスク未加入UIと同じ内容を表示:
  - InfoBlock（ごあんない）
  - PlusAdImage（機能比較広告）
  - DescriptionText「いつでも解約できます。」
  - ActionPill 月払いボタン（緑）
  - ActionPill 年払いボタン（緑）
  - ActionPill 購入復元ボタン
- 右上に閉じるボタン（×）
- Props:
  - `visible: boolean`
  - `styles: AppStyles`
  - `theme: AppTheme`
  - `premiumOfferingSummary: PremiumOfferingSummary | null`
  - `isLoadingPremiumOffering: boolean`
  - `isPurchasingPremiumPackage: boolean`
  - `isRestoringPremiumPurchases: boolean`
  - `onClose: () => void`
  - `onPurchaseMonthlyPremiumPackage: () => void`
  - `onPurchaseYearlyPremiumPackage: () => void`
  - `onRestorePremiumPurchases: () => void`

---

## 変更コンポーネント

### `App.tsx`

- `isPremiumPaywallVisible: boolean` state を追加
- `openPremiumPaywall` / `closePremiumPaywall` ハンドラを追加
- `PremiumPaywallModal` をルートでレンダリング（全画面からアクセス可能）
- `DailyLogDetailScreen` に以下を追加で渡す:
  - `premiumAccessState`
  - `onOpenPremiumPaywall`

### `DailyLogDetailScreen`

Props 追加:
- `premiumAccessState: PremiumAccessState`
- `onOpenPremiumPaywall: () => void`

---

## レイアウト詳細

### Plus ユーザー

```
captureViewRef:
  ├ RouteMapPanel
  ├ StepSlider（showSlider の場合）
  ├ 移動のデータ:
  │   ├ DataSummaryRow: 移動距離
  │   ├ DataSummaryRow: 開始地点と終了地点
  │   ├ DataSummaryRow: 訪問したエリア数
  │   └ DataSummaryRow: 新しく訪問したエリア数
  ├ DescriptionText「移動距離は〜」
  └ おもいで（AchievementScroller）

captureViewRef 外:
  └ ActionPill「この日の記録を共有」（アウトライン、Feather share-2 アイコン）
```

### 一般ユーザー

```
captureViewRef:
  ├ RouteMapPanel
  ├（StepSlider 非表示）
  └ 移動のデータ:
      ├ SectionTitle
      ├ DescriptionText「移動距離は〜」← タイトル直下に移動
      ├ DataSummaryRow: 移動距離
      ├ DataSummaryRow: 開始地点と終了地点
      └（訪問エリア2行 非表示）

captureViewRef 外:
  ├ BlurView（expo-blur）＋半透明オーバーレイ＋「Plusでくわしく！」テキスト（おもいでセクション全体）
  ├ ActionPill「この日の記録を共有」（アウトライン）
  ├ ActionPill「Plusでもっと詳しく！」（緑）
  └ DescriptionText「移動軌跡を時系列でふりかえられたり、獲得した実績、エリア数などもみることができます！」
```

---

## ブラー仕様

- `expo-blur` の `BlurView` を使用（`expo install expo-blur`）
- `intensity` は読めない程度の濃いめ（intensity: 80〜100 程度）
- BlurView の上に半透明の暗いオーバーレイ（`rgba(0,0,0,0.3)` 程度）を重ねる
- オーバーレイ上に「Plusでくわしく！」テキストを中央配置（白文字）
- おもいでセクションと同じ高さの固定高さを持つ

---

## 共有ボタン変更

既存の `ShareButton` コンポーネントを `ActionPill` に置き換え:
- `alignLeft={false}`（中央揃え）
- `icon={<Feather name="share-2" />}`
- `label="この日の記録を共有"`
- デフォルトのアウトラインスタイル（override なし）

---

## 依存関係

- `expo-blur` を追加（`expo install expo-blur`）

---

## テスト方針

- `DailyLogDetailScreen` の既存テストを `premiumAccessState` と `onOpenPremiumPaywall` prop に対応させる
- Plus / 非Plus 両方のレンダリングをスナップショットまたはアサーションで確認
- `PremiumPaywallModal` の表示・非表示・ボタン押下のテストを追加
