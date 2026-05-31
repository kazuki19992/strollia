import { developmentFlags } from '../../config/developmentFlags';
import { STROLLIA_PLUS_ENTITLEMENT_ID } from './premiumCatalog';

/** RevenueCatから得る購読/買い切りの利用可否。 */
export type PremiumAccessState = {
  /** Strollia Plusが有効な場合はtrue。 */
  isPlusActive: boolean;
  /** 判定に使ったRevenueCat entitlement ID。 */
  entitlementId: string;
};

/** RevenueCat Offeringを設定画面で表示するための概要。 */
export type PremiumOfferingSummary = {
  /** RevenueCat Offering ID。 */
  offeringId: string;
  /** Offeringに含まれる購入Package一覧。 */
  packages: PremiumPackageSummary[];
};

/** RevenueCat Package/ProductをUI表示用へ正規化した情報。 */
export type PremiumPackageSummary = {
  /** RevenueCat Package ID。 */
  identifier: string;
  /** RevenueCat Package種別。 */
  packageType: string;
  /** Storeの商品ID。 */
  productIdentifier: string;
  /** 商品名。 */
  title: string;
  /** 商品説明。 */
  description: string;
  /** ローカライズ済み価格文字列。 */
  priceText: string;
};

/** RevenueCat Paywall表示結果をアプリ側で扱いやすくした値。 */
export type PremiumPaywallResult = 'purchased' | 'restored' | 'cancelled' | 'notPresented' | 'error';

/** RevenueCat SDK導入後に差し替える課金クライアント境界。 */
export type RevenueCatClient = {
  /**
   * 指定entitlementが有効かどうかを返す。
   *
   * @param entitlementId - RevenueCatで設定したentitlement ID。
   * @returns entitlementが有効ならtrue。
   */
  hasActiveEntitlement(entitlementId: string): Promise<boolean>;
  /** 現在のRevenueCat Offering概要を返す。 */
  getCurrentOffering(): Promise<PremiumOfferingSummary | null>;
  /** RevenueCat Paywallを表示する。 */
  presentPaywall(): Promise<PremiumPaywallResult>;
  /** 購入復元後のPlus状態を返す。 */
  restorePurchases(): Promise<PremiumAccessState>;
};

/**
 * RevenueCat未接続時の既定状態を返す。
 *
 * @returns 開発用フラグに応じた課金状態。
 */
export function getDefaultPremiumAccessState(): PremiumAccessState {
  return {
    isPlusActive: developmentFlags.enablePremiumAccessWithoutRevenueCat,
    entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID,
  };
}

/**
 * RevenueCatクライアントからStrollia Plusの利用可否を解決する。
 *
 * @param client - RevenueCat SDKを薄く包んだクライアント。
 * @returns Strollia Plusの課金状態。
 */
export async function resolvePremiumAccessState(client: RevenueCatClient): Promise<PremiumAccessState> {
  return {
    isPlusActive: await client.hasActiveEntitlement(STROLLIA_PLUS_ENTITLEMENT_ID),
    entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID,
  };
}

/**
 * RevenueCatクライアントから現在のOffering概要を取得する。
 *
 * @param client - RevenueCat SDKを薄く包んだクライアント。
 * @returns 現在のOffering概要。未設定ならnull。
 */
export async function resolvePremiumOfferingSummary(client: RevenueCatClient): Promise<PremiumOfferingSummary | null> {
  return client.getCurrentOffering();
}

/** RevenueCat SDKが使える場合はCustomerInfoから、使えない場合は既定状態からPlus状態を返す。 */
export async function getPremiumAccessState(): Promise<PremiumAccessState> {
  try {
    const { createRevenueCatClient } = require('./revenueCatClient') as typeof import('./revenueCatClient');
    return await resolvePremiumAccessState(createRevenueCatClient());
  } catch (error: unknown) {
    console.warn('Failed to load RevenueCat premium state:', error);
    return getDefaultPremiumAccessState();
  }
}

/** RevenueCat SDKが使える場合はOffering概要を返し、失敗時はnullにする。 */
export async function getPremiumOfferingSummary(): Promise<PremiumOfferingSummary | null> {
  try {
    const { createRevenueCatClient } = require('./revenueCatClient') as typeof import('./revenueCatClient');
    return await resolvePremiumOfferingSummary(createRevenueCatClient());
  } catch (error: unknown) {
    console.warn('Failed to load RevenueCat offerings:', error);
    return null;
  }
}

/** RevenueCat Paywallを表示する。 */
export async function presentPremiumPaywall(): Promise<PremiumPaywallResult> {
  try {
    const { createRevenueCatClient } = require('./revenueCatClient') as typeof import('./revenueCatClient');
    return await createRevenueCatClient().presentPaywall();
  } catch (error: unknown) {
    console.warn('Failed to present RevenueCat paywall:', error);
    return 'error';
  }
}

/** RevenueCatで購入を復元し、復元後のPlus状態を返す。 */
export async function restorePremiumPurchases(): Promise<PremiumAccessState> {
  try {
    const { createRevenueCatClient } = require('./revenueCatClient') as typeof import('./revenueCatClient');
    return await createRevenueCatClient().restorePurchases();
  } catch (error: unknown) {
    console.warn('Failed to restore RevenueCat purchases:', error);
    return getDefaultPremiumAccessState();
  }
}
