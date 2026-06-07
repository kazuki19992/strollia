import Purchases, { CustomerInfoUpdateListener } from 'react-native-purchases';

import { STROLLIA_PLUS_ENTITLEMENT_ID } from './premiumCatalog';
import type {
  PremiumAccessState,
  PremiumOfferingSummary,
  PremiumPackageSummary,
  PremiumPaywallResult,
  RevenueCatClient,
} from './revenueCatAccess';
import { getRevenueCatConfigureOptions } from './revenueCatConfig';

type RevenueCatPaywallModule = {
  default: {
    presentPaywallIfNeeded(options: { requiredEntitlementIdentifier: string; displayCloseButton: boolean }): Promise<unknown>;
    presentCustomerCenter(): Promise<void>;
  };
  PAYWALL_RESULT: Record<string, unknown>;
};

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

/** RevenueCat CustomerInfo更新を購読し、Plus状態へ変換して通知する。 */
export function subscribePremiumAccessStateUpdatesWithRevenueCat(onUpdate: (state: PremiumAccessState) => void): () => void {
  const configured = configureRevenueCatIfAvailable();

  if (!configured) {
    return () => undefined;
  }

  const listener: CustomerInfoUpdateListener = (customerInfo) => {
    onUpdate(resolveAccessStateFromCustomerInfo(customerInfo));
  };

  Purchases.addCustomerInfoUpdateListener(listener);

  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

/** RevenueCat Paywall UIの戻り値をアプリ内の結果値へ変換する。 */
function mapPaywallResult(paywallResult: unknown, paywallConstants: Record<string, unknown>): PremiumPaywallResult {
  if (paywallResult === paywallConstants.PURCHASED) {
    return 'purchased';
  }

  if (paywallResult === paywallConstants.RESTORED) {
    return 'restored';
  }

  if (paywallResult === paywallConstants.NOT_PRESENTED) {
    return 'notPresented';
  }

  if (paywallResult === paywallConstants.ERROR) {
    return 'error';
  }

  return 'cancelled';
}

/** RevenueCat Paywallを表示する。 */
export async function presentPaywallWithRevenueCat(): Promise<PremiumPaywallResult> {
  const configured = configureRevenueCatIfAvailable();

  if (!configured) {
    throw new Error('RevenueCat API key is not configured for this platform.');
  }

  const paywallModule = require('react-native-purchases-ui') as RevenueCatPaywallModule;
  const result = await paywallModule.default.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: STROLLIA_PLUS_ENTITLEMENT_ID,
    displayCloseButton: true,
  });
  return mapPaywallResult(result, paywallModule.PAYWALL_RESULT);
}

/** RevenueCat Customer Centerを表示する。 */
export async function presentCustomerCenterWithRevenueCat(): Promise<void> {
  const configured = configureRevenueCatIfAvailable();

  if (!configured) {
    throw new Error('RevenueCat API key is not configured for this platform.');
  }

  const paywallModule = require('react-native-purchases-ui') as RevenueCatPaywallModule;
  await paywallModule.default.presentCustomerCenter();
}

/** RevenueCat SDKを既存の課金境界へ接続するクライアントを作る。 */
export function createRevenueCatClient(): RevenueCatClient {
  return {
    hasActiveEntitlement: getPremiumAccessStateFromRevenueCat,
    getCurrentOffering: getPremiumOfferingSummaryFromRevenueCat,
    presentPaywall: presentPaywallWithRevenueCat,
    presentCustomerCenter: presentCustomerCenterWithRevenueCat,
    restorePurchases: restorePremiumPurchasesWithRevenueCat,
    subscribeToCustomerInfoUpdates: subscribePremiumAccessStateUpdatesWithRevenueCat,
  };
}
