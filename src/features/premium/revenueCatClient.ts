import Purchases from 'react-native-purchases';

import type { RevenueCatClient } from './revenueCatAccess';
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

/** RevenueCat SDKを既存の課金境界へ接続するクライアントを作る。 */
export function createRevenueCatClient(): RevenueCatClient {
  return {
    hasActiveEntitlement: getPremiumAccessStateFromRevenueCat,
  };
}
