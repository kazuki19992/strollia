# RevenueCat Integration Guide

## 1. Install SDKs

Strollia uses RevenueCat from the React Native app through the app-level premium boundary in `src/features/premium/`.

```bash
npm install --save react-native-purchases react-native-purchases-ui
```

The current dependency versions are kept in `package.json`. `react-native-purchases` handles direct subscription purchases. `react-native-purchases-ui` is kept for Customer Center only; Strollia does not require RevenueCat Paywalls.

## 2. Configure Local API Keys

Do not commit real API key values. Put local keys in `.env.local`, which is ignored by git.

```bash
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=your_ios_public_sdk_key
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=your_android_public_sdk_key
```

If only a test key is available during setup, use it locally for development builds and replace it with each platform's public SDK key before release. Keep `.env.example` empty so committed files document the variable names without exposing values.

## 3. RevenueCat Dashboard Setup

Create the following objects in RevenueCat and the stores:

- Entitlement: `strollia_plus`
- Monthly product: `strollia_plus_monthly`
- Yearly product: `strollia_plus_yearly`
- Offering: mark the offering containing monthly and yearly packages as current
- Customer Center: enable it after the RevenueCat plan and dashboard configuration support it

Use localized store prices from RevenueCat offerings in the app. Avoid hard-coding prices as the source of truth.

## 4. SDK Initialization

The SDK is configured only when the current platform has a key.

```ts
import { Platform } from 'react-native';

export function getRevenueCatApiKeyForPlatform(): string | null {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || null;
  }

  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || null;
  }

  return null;
}
```

```ts
import Purchases from 'react-native-purchases';

export function configureRevenueCatIfAvailable(): boolean {
  const apiKey = getRevenueCatApiKeyForPlatform();

  if (!apiKey) {
    return false;
  }

  Purchases.configure({ apiKey });
  return true;
}
```

## 5. Entitlement Checking

Strollia Plus is active when `CustomerInfo.entitlements.active.strollia_plus` exists.

```ts
import Purchases from 'react-native-purchases';

const STROLLIA_PLUS_ENTITLEMENT_ID = 'strollia_plus';

export async function isStrolliaPlusActive(): Promise<boolean> {
  const customerInfo = await Purchases.getCustomerInfo();
  return customerInfo.entitlements.active[STROLLIA_PLUS_ENTITLEMENT_ID] != null;
}
```

The app uses `getPremiumAccessState()` instead of calling the SDK from UI components. If RevenueCat is unavailable, the app falls back to the development premium flag and keeps GPS logging usable.

## 6. Customer Info Updates

Register a CustomerInfo update listener after app startup. The listener keeps the app state in sync after purchases, restores, and SDK refreshes.

```ts
import Purchases, { CustomerInfoUpdateListener } from 'react-native-purchases';

export function subscribePremiumAccessStateUpdates(onUpdate: (isPlusActive: boolean) => void): () => void {
  const listener: CustomerInfoUpdateListener = (customerInfo) => {
    onUpdate(customerInfo.entitlements.active.strollia_plus != null);
  };

  Purchases.addCustomerInfoUpdateListener(listener);

  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}
```

## 7. Direct Purchase

Strollia does not use RevenueCat Paywalls. Settings gets the current offering and calls `purchasePackage` for the selected monthly or yearly package.

```ts
import Purchases from 'react-native-purchases';

type StrolliaPlusPlan = 'monthly' | 'yearly';

export async function purchaseStrolliaPlus(plan: StrolliaPlusPlan): Promise<boolean> {
  const offerings = await Purchases.getOfferings();
  const packageType = plan === 'monthly' ? 'MONTHLY' : 'ANNUAL';
  const packageToPurchase = offerings.current?.availablePackages.find((pkg) => pkg.packageType === packageType);

  if (!packageToPurchase) {
    throw new Error(`${packageType} package is not configured.`);
  }

  const result = await Purchases.purchasePackage(packageToPurchase);
  return result.customerInfo.entitlements.active.strollia_plus != null;
}
```

In Strollia, `purchasePremiumPackage('monthly' | 'yearly')` maps SDK success, cancellation, and errors into app result values: `purchased`, `cancelled`, and `error`.

## 8. Offering and Product Display

Fetch the current offering to display store-owned product metadata.

```ts
import Purchases from 'react-native-purchases';

export async function getCurrentStrolliaPlusPackages() {
  const offerings = await Purchases.getOfferings();

  return (
    offerings.current?.availablePackages.map((pkg) => ({
      packageId: pkg.identifier,
      packageType: pkg.packageType,
      productId: pkg.product.identifier,
      title: pkg.product.title,
      description: pkg.product.description,
      price: pkg.product.priceString,
    })) ?? []
  );
}
```

If RevenueCat has no current offering yet, keep the settings screen usable and show a loading or setup message instead of blocking the app.

## 9. Restore Purchases

Expose restore from settings. After restore, check `strollia_plus` again.

```ts
import Purchases from 'react-native-purchases';

export async function restoreStrolliaPlus(): Promise<boolean> {
  const customerInfo = await Purchases.restorePurchases();
  return customerInfo.entitlements.active.strollia_plus != null;
}
```

Use RevenueCat's dashboard restore behavior that fits an account-less app. Strollia currently uses anonymous RevenueCat App User IDs; cross-platform restore should be designed with a real login identity later.

## 10. Customer Center

Customer Center makes sense after Strollia has active subscribers, because it gives users a self-service place to manage subscriptions, restore purchases, request supported refunds, and access support flows configured in RevenueCat.

```ts
import RevenueCatUI from 'react-native-purchases-ui';

export async function openCustomerCenter(): Promise<void> {
  await RevenueCatUI.presentCustomerCenter();
}
```

Strollia shows this action for Plus users in Settings. Keep the existing restore button for non-subscribed users.

## 11. Error Handling

- API key missing: do not configure RevenueCat; fall back to the development premium state.
- CustomerInfo fetch failure: warn in console and keep the current/default state.
- Offering missing: keep Settings usable and do not block GPS logging.
- Purchase cancelled: leave state unchanged and do not show an error.
- Purchase error: show a short setup/retry message.
- Restore completed without entitlement: tell the user no Strollia Plus purchase was found.
- Customer Center error: keep Settings usable and show a short setup/retry message.

## 12. Verification

Run local verification after any RevenueCat integration change:

```bash
npm run typecheck
npm test -- src/features/premium/__tests__/revenueCatAccess.test.ts --runInBand
npm test -- src/app/components/__tests__/SettingsScreen.test.tsx --runInBand
npm test -- src/app/__tests__/AppMapReturn.test.tsx --runInBand
```

Real purchase, restore, and Customer Center behavior must be verified in an Expo development build with App Store Connect or Google Play products connected to RevenueCat.
