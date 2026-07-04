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

/** 設定画面から直接購入できるStrollia Plusプラン。 */
export type PremiumPackagePlan = 'monthly' | 'yearly';

/** RevenueCat購入結果をアプリ側で扱いやすくした値。 */
export type PremiumPurchaseResult = {
  /** 購入処理の結果。 */
  status: 'purchased' | 'cancelled' | 'error';
  /** 購入後またはフォールバック後のPlus状態。 */
  accessState: PremiumAccessState;
};

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
  /** 指定プランのRevenueCat Packageを直接購入する。 */
  purchasePackage(plan: PremiumPackagePlan): Promise<PremiumAccessState>;
  /** RevenueCat Customer Centerを表示する。 */
  presentCustomerCenter(): Promise<void>;
  /** 購入復元後のPlus状態を返す。 */
  restorePurchases(): Promise<PremiumAccessState>;
  /** RevenueCatのApp User ID（サポート対応用）を返す。未設定/不明ならnull。 */
  getAppUserId(): Promise<string | null>;
  /**
   * RevenueCat CustomerInfo更新を購読する。
   *
   * @param onUpdate - 更新されたPlus状態を受け取る処理。
   * @returns 購読解除関数。
   */
  subscribeToCustomerInfoUpdates(onUpdate: (state: PremiumAccessState) => void): () => void;
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

/**
 * RevenueCatクライアントからApp User ID（サポート対応用）を解決する。
 *
 * @param client - RevenueCat SDKを薄く包んだクライアント。
 * @returns App User ID。未設定/不明ならnull。
 */
export async function resolveRevenueCatAppUserId(client: RevenueCatClient): Promise<string | null> {
  return client.getAppUserId();
}

/** RevenueCat CustomerInfoから確認済みのPlus状態を取得し、失敗は呼び出し元へ伝える。 */
export async function getConfirmedPremiumAccessState(): Promise<PremiumAccessState> {
  const { createRevenueCatClient } = require('./revenueCatClient') as typeof import('./revenueCatClient');
  return resolvePremiumAccessState(createRevenueCatClient());
}

/** RevenueCat SDKが使える場合はCustomerInfoから、使えない場合は既定状態からPlus状態を返す。 */
export async function getPremiumAccessState(): Promise<PremiumAccessState> {
  try {
    return await getConfirmedPremiumAccessState();
  } catch (error: unknown) {
    console.warn('Failed to load RevenueCat premium state:', error);
    return getDefaultPremiumAccessState();
  }
}

/** RevenueCat SDKが使える場合はApp User IDを返し、未設定/失敗時はnullにする。 */
export async function getRevenueCatAppUserId(): Promise<string | null> {
  try {
    const { createRevenueCatClient } = require('./revenueCatClient') as typeof import('./revenueCatClient');
    return await resolveRevenueCatAppUserId(createRevenueCatClient());
  } catch (error: unknown) {
    console.warn('Failed to load RevenueCat app user id:', error);
    return null;
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

function isRevenueCatPurchaseCancelled(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'userCancelled' in error && (error as { userCancelled?: unknown }).userCancelled === true
  );
}

/** RevenueCat Packageを設定画面から直接購入する。 */
export async function purchasePremiumPackage(plan: PremiumPackagePlan): Promise<PremiumPurchaseResult> {
  try {
    const { createRevenueCatClient } = require('./revenueCatClient') as typeof import('./revenueCatClient');
    const accessState = await createRevenueCatClient().purchasePackage(plan);
    return {
      status: accessState.isPlusActive ? 'purchased' : 'error',
      accessState,
    };
  } catch (error: unknown) {
    const currentAccessState = await getPremiumAccessState().catch(() => getDefaultPremiumAccessState());
    if (isRevenueCatPurchaseCancelled(error)) {
      return {
        status: 'cancelled',
        accessState: currentAccessState,
      };
    }

    console.warn('Failed to purchase RevenueCat package:', error);
    return {
      status: 'error',
      accessState: currentAccessState,
    };
  }
}

/** RevenueCat Customer Centerを表示できたかどうかを返す。 */
export async function presentPremiumCustomerCenter(): Promise<boolean> {
  try {
    const { createRevenueCatClient } = require('./revenueCatClient') as typeof import('./revenueCatClient');
    await createRevenueCatClient().presentCustomerCenter();
    return true;
  } catch (error: unknown) {
    console.warn('Failed to present RevenueCat Customer Center:', error);
    return false;
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

/** RevenueCat CustomerInfo更新を購読し、SDK未設定時は何もしない解除関数を返す。 */
export function subscribePremiumAccessStateUpdates(onUpdate: (state: PremiumAccessState) => void): () => void {
  try {
    const { createRevenueCatClient } = require('./revenueCatClient') as typeof import('./revenueCatClient');
    return createRevenueCatClient().subscribeToCustomerInfoUpdates(onUpdate);
  } catch (error: unknown) {
    console.warn('Failed to subscribe RevenueCat customer info updates:', error);
    return () => undefined;
  }
}
