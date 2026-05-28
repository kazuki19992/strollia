import Purchases from 'react-native-purchases';

import { STROLLIA_PLUS_ENTITLEMENT_ID } from './premiumCatalog';
import type {
  PremiumAccessState,
  PremiumOfferingSummary,
  PremiumPackageSummary,
  RevenueCatClient,
} from './revenueCatAccess';
import { getRevenueCatConfigureOptions } from './revenueCatConfig';

/** RevenueCat SDKの初期化状態。 */
let isConfigured = false;

/** テストや再初期化が必要な場面でRevenueCat初期化状態を戻す。 */
export function resetRevenueCatClientForTesting(): void {
  isConfigured = false;
}

/** RevenueCat SDKを必要な場合だけ初期化する。 */
export function configureRevenueCatIfAvailable(): boolean {
  if (isConfigured) {
    return true;
  }

  const options = getRevenueCatConfigureOptions();

  if (!options) {
    return false;
  }

  Purchases.configure(options);
  isConfigured = true;
  return true;
}

/** RevenueCatのCustomerInfoからentitlement有効状態を判定する。 */
export async function getPremiumAccessStateFromRevenueCat(entitlementId: string): Promise<boolean> {
  const configured = configureRevenueCatIfAvailable();

  if (!configured) {
    throw new Error('RevenueCat API key is not configured for this platform.');
  }

  const customerInfo = await Purchases.getCustomerInfo();
  return customerInfo.entitlements.active[entitlementId] != null;
}

/** RevenueCat CustomerInfoから既存の課金状態型を作る。 */
function resolveAccessStateFromCustomerInfo(customerInfo: { entitlements: { active: Record<string, unknown> } }): PremiumAccessState {
  return {
    isPlusActive: customerInfo.entitlements.active[STROLLIA_PLUS_ENTITLEMENT_ID] != null,
    entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID,
  };
}

/** RevenueCat Productを設定画面向けの表示値へ変換する。 */
function mapPackageToSummary(revenueCatPackage: {
  identifier: string;
  packageType: string;
  product: {
    identifier: string;
    title: string;
    description: string;
    priceString: string;
  };
}): PremiumPackageSummary {
  return {
    identifier: revenueCatPackage.identifier,
    packageType: revenueCatPackage.packageType,
    productIdentifier: revenueCatPackage.product.identifier,
    title: revenueCatPackage.product.title,
    description: revenueCatPackage.product.description,
    priceText: revenueCatPackage.product.priceString,
  };
}

/** RevenueCatのcurrent Offeringを設定画面向け概要へ変換する。 */
export async function getPremiumOfferingSummaryFromRevenueCat(): Promise<PremiumOfferingSummary | null> {
  const configured = configureRevenueCatIfAvailable();

  if (!configured) {
    throw new Error('RevenueCat API key is not configured for this platform.');
  }

  const offerings = await Purchases.getOfferings();

  if (!offerings.current) {
    return null;
  }

  return {
    offeringId: offerings.current.identifier,
    packages: offerings.current.availablePackages.map(mapPackageToSummary),
  };
}

/** RevenueCatで購入を復元し、復元後のPlus状態へ変換する。 */
export async function restorePremiumPurchasesWithRevenueCat(): Promise<PremiumAccessState> {
  const configured = configureRevenueCatIfAvailable();

  if (!configured) {
    throw new Error('RevenueCat API key is not configured for this platform.');
  }

  return resolveAccessStateFromCustomerInfo(await Purchases.restorePurchases());
}

/** RevenueCat SDKを既存の課金境界へ接続するクライアントを作る。 */
export function createRevenueCatClient(): RevenueCatClient {
  return {
    hasActiveEntitlement: getPremiumAccessStateFromRevenueCat,
    getCurrentOffering: getPremiumOfferingSummaryFromRevenueCat,
    presentPaywall: async () => 'cancelled',
    restorePurchases: restorePremiumPurchasesWithRevenueCat,
  };
}
