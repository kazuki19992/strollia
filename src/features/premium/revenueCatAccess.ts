import { STROLLIA_PLUS_ENTITLEMENT_ID } from './premiumCatalog';

/** RevenueCat導入前にPlus特典の動作確認を行うための開発用フラグ。 */
export const DEVELOPMENT_PREMIUM_ACCESS_ENABLED = true;

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
 * RevenueCat未接続時の既定状態を返す。
 *
 * @returns 開発用フラグに応じた課金状態。
 */
export function getDefaultPremiumAccessState(): PremiumAccessState {
  return {
    isPlusActive: DEVELOPMENT_PREMIUM_ACCESS_ENABLED,
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
