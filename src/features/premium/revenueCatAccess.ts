import { STROLLIA_PLUS_ENTITLEMENT_ID } from './premiumCatalog';

/** RevenueCatから得る購読/買い切りの利用可否。 */
export type PremiumAccessState = {
  /** Strollia Plusが有効な場合はtrue。 */
  isPlusActive: boolean;
  /** 判定に使ったRevenueCat entitlement ID。 */
  entitlementId: string;
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
};

/**
 * RevenueCat未接続時の安全な既定状態を返す。
 *
 * @returns Strollia Plusが無効な課金状態。
 */
export function getDefaultPremiumAccessState(): PremiumAccessState {
  return {
    isPlusActive: false,
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
