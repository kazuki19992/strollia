/** RevenueCat上で管理するStrollia Plusの権利ID。 */
export const STROLLIA_PLUS_ENTITLEMENT_ID = 'strollia_plus';

/** RevenueCat上で管理する月額商品の識別子候補。 */
export const STROLLIA_PLUS_MONTHLY_PRODUCT_ID = 'strollia_plus_monthly';

/** RevenueCat上で管理する年額商品の識別子候補。 */
export const STROLLIA_PLUS_YEARLY_PRODUCT_ID = 'strollia_plus_yearly';

/** 課金で開放するカスタマイズカテゴリ。 */
export type PremiumCustomizationCategory = 'userLocationIcon';

/** 設定画面に表示する課金カスタマイズ項目。 */
export type PremiumCustomizationItem = {
  /** 項目を安定して識別するID。 */
  id: PremiumCustomizationCategory;
  /** 設定画面に表示するタイトル。 */
  title: string;
  /** 設定画面に表示する説明。 */
  description: string;
};

/** 設定画面に表示するStrollia Plusのカスタマイズ項目一覧。 */
export const PREMIUM_CUSTOMIZATION_ITEMS: PremiumCustomizationItem[] = [
  {
    id: 'userLocationIcon',
    title: '現在地アイコン',
    description: '現在地を表すアイコンを好みの見た目へ変更できるようにします。',
  },
];
