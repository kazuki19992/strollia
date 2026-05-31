# RevenueCat Paywall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Strollia Plus purchase, restore, Paywall display, and RevenueCat Offering display while keeping anonymous RevenueCat IDs.

**Architecture:** Keep RevenueCat native SDK and Paywall UI imports inside `src/features/premium/`. Expose app-level DTOs and operations to `App.tsx`, then pass display state and callbacks into `SettingsScreen`. Use lazy `require()` for `react-native-purchases-ui` to keep Jest and non-paywall screens from loading native UI modules.

**Tech Stack:** Expo SDK 54, React Native, TypeScript, Jest, `react-native-purchases`, `react-native-purchases-ui`, RevenueCat Offerings, CustomerInfo, Paywall UI.

---

## File Map

- Modify `package.json` and `package-lock.json`: add `react-native-purchases-ui`.
- Modify `src/features/premium/revenueCatAccess.ts`: define offering/paywall/restore app contracts and safe fallback wrappers.
- Modify `src/features/premium/revenueCatClient.ts`: implement Offering conversion, Paywall presentation, and purchase restoration using RevenueCat SDKs.
- Modify `src/features/premium/__tests__/revenueCatAccess.test.ts`: add TDD coverage for Offering, Paywall result handling, restore, and fallback behavior.
- Modify `src/app/App.tsx`: load Offering state, open Paywall, restore purchases, refresh Plus state, and route locked Plus actions to Paywall.
- Modify `src/app/__tests__/AppMapReturn.test.tsx`: update premium mock and cover locked Plus action behavior.
- Modify `src/app/components/SettingsScreen.tsx`: display Offering summary and add Paywall/restore buttons.
- Modify `src/app/components/__tests__/SettingsScreen.test.tsx`: cover Plus card product display and buttons.
- Modify `docs/monetization.md`: document Paywall, restore, Offering display, anonymous ID policy, and dashboard/store checklist.
- Modify `docs/todo.md`: mark purchase/restore flow implemented and add Sign in with Apple identity as a future item.

## Task 1: Add RevenueCat Paywall UI Dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install `react-native-purchases-ui`**

Run:

```bash
npx expo install react-native-purchases-ui
```

Expected: `package.json` contains `react-native-purchases-ui`, and `package-lock.json` is updated.

- [ ] **Step 2: Verify dependency type surface**

Run:

```bash
test -d node_modules/react-native-purchases-ui && npm run typecheck
```

Expected: dependency exists and typecheck exits 0.

- [ ] **Step 3: Commit**

Run:

```bash
git add package.json package-lock.json
git commit -m "build(premium): RevenueCat Paywall UIを追加"
```

## Task 2: Add Premium Offering, Paywall, and Restore Contracts

**Files:**
- Modify: `src/features/premium/revenueCatAccess.ts`
- Modify: `src/features/premium/revenueCatClient.ts`
- Modify: `src/features/premium/__tests__/revenueCatAccess.test.ts`

- [ ] **Step 1: Write failing tests for Offering conversion and restore**

Add to `src/features/premium/__tests__/revenueCatAccess.test.ts` imports:

```ts
import {
  createRevenueCatClient,
  getPremiumOfferingSummaryFromRevenueCat,
  resetRevenueCatClientForTesting,
  restorePremiumPurchasesWithRevenueCat,
} from '../revenueCatClient';
import {
  getDefaultPremiumAccessState,
  getPremiumAccessState,
  getPremiumOfferingSummary,
  PremiumPaywallResult,
  resolvePremiumAccessState,
  resolvePremiumOfferingSummary,
  restorePremiumPurchases,
  RevenueCatClient,
} from '../revenueCatAccess';
```

Extend the `react-native-purchases` mock:

```ts
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    getCustomerInfo: jest.fn(),
    getOfferings: jest.fn(),
    restorePurchases: jest.fn(),
  },
}));
```

Add tests inside the existing `describe` block:

```ts
  it('RevenueCat Offeringを設定画面向けの商品概要へ変換する', async () => {
    const client: RevenueCatClient = {
      hasActiveEntitlement: jest.fn().mockResolvedValue(false),
      getCurrentOffering: jest.fn().mockResolvedValue({
        offeringId: 'default',
        packages: [
          {
            identifier: '$rc_monthly',
            packageType: 'MONTHLY',
            productIdentifier: 'strollia_plus_monthly',
            title: 'Strollia Plus Monthly',
            description: 'Monthly plan',
            priceText: '¥300',
          },
        ],
      }),
      presentPaywall: jest.fn().mockResolvedValue('cancelled'),
      restorePurchases: jest.fn().mockResolvedValue({ isPlusActive: false, entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID }),
    };

    await expect(resolvePremiumOfferingSummary(client)).resolves.toEqual({
      offeringId: 'default',
      packages: [
        {
          identifier: '$rc_monthly',
          packageType: 'MONTHLY',
          productIdentifier: 'strollia_plus_monthly',
          title: 'Strollia Plus Monthly',
          description: 'Monthly plan',
          priceText: '¥300',
        },
      ],
    });
  });

  it('RevenueCat Offering未設定時は商品概要をnullにする', async () => {
    const client: RevenueCatClient = {
      hasActiveEntitlement: jest.fn().mockResolvedValue(false),
      getCurrentOffering: jest.fn().mockResolvedValue(null),
      presentPaywall: jest.fn().mockResolvedValue('cancelled'),
      restorePurchases: jest.fn().mockResolvedValue({ isPlusActive: false, entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID }),
    };

    await expect(resolvePremiumOfferingSummary(client)).resolves.toBeNull();
  });

  it('RevenueCatのcurrent Offeringから商品概要を取得する', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    (Purchases.getOfferings as jest.Mock).mockResolvedValue({
      current: {
        identifier: 'default',
        availablePackages: [
          {
            identifier: '$rc_annual',
            packageType: 'ANNUAL',
            product: {
              identifier: 'strollia_plus_yearly',
              title: 'Strollia Plus Annual',
              description: 'Annual plan',
              priceString: '¥2,900',
            },
          },
        ],
      },
    });

    await expect(getPremiumOfferingSummaryFromRevenueCat()).resolves.toEqual({
      offeringId: 'default',
      packages: [
        {
          identifier: '$rc_annual',
          packageType: 'ANNUAL',
          productIdentifier: 'strollia_plus_yearly',
          title: 'Strollia Plus Annual',
          description: 'Annual plan',
          priceText: '¥2,900',
        },
      ],
    });
  });

  it('RevenueCat復元後にentitlementがあればPlus有効状態を返す', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    (Purchases.restorePurchases as jest.Mock).mockResolvedValue({
      entitlements: {
        active: {
          [STROLLIA_PLUS_ENTITLEMENT_ID]: { identifier: STROLLIA_PLUS_ENTITLEMENT_ID },
        },
      },
    });

    await expect(restorePremiumPurchasesWithRevenueCat()).resolves.toEqual({
      isPlusActive: true,
      entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID,
    });
  });

  it('RevenueCat Offering取得失敗時はnullへフォールバックする', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (Purchases.getOfferings as jest.Mock).mockRejectedValue(new Error('network failed'));

    await expect(getPremiumOfferingSummary()).resolves.toBeNull();
    expect(console.warn).toHaveBeenCalledWith('Failed to load RevenueCat offerings:', expect.any(Error));
  });

  it('RevenueCat復元失敗時は既定の課金状態へフォールバックする', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (Purchases.restorePurchases as jest.Mock).mockRejectedValue(new Error('restore failed'));

    await expect(restorePremiumPurchases()).resolves.toEqual(getDefaultPremiumAccessState());
    expect(console.warn).toHaveBeenCalledWith('Failed to restore RevenueCat purchases:', expect.any(Error));
  });
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test -- src/features/premium/__tests__/revenueCatAccess.test.ts --runInBand
```

Expected: FAIL because `getPremiumOfferingSummary`, `resolvePremiumOfferingSummary`, `restorePremiumPurchases`, and related client functions do not exist.

- [ ] **Step 3: Implement contracts and client operations**

In `src/features/premium/revenueCatAccess.ts`, add exported types and wrappers:

```ts
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
```

Extend `RevenueCatClient`:

```ts
  getCurrentOffering(): Promise<PremiumOfferingSummary | null>;
  presentPaywall(): Promise<PremiumPaywallResult>;
  restorePurchases(): Promise<PremiumAccessState>;
```

Add functions:

```ts
/** RevenueCatクライアントから現在のOffering概要を取得する。 */
export async function resolvePremiumOfferingSummary(client: RevenueCatClient): Promise<PremiumOfferingSummary | null> {
  return client.getCurrentOffering();
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
```

In `src/features/premium/revenueCatClient.ts`, import and implement:

```ts
import type {
  PremiumAccessState,
  PremiumOfferingSummary,
  PremiumPackageSummary,
  PremiumPaywallResult,
  RevenueCatClient,
} from './revenueCatAccess';
import { STROLLIA_PLUS_ENTITLEMENT_ID } from './premiumCatalog';
```

Add:

```ts
type RevenueCatPaywallModule = {
  default: {
    presentPaywall(): Promise<unknown>;
  };
  PAYWALL_RESULT: Record<string, unknown>;
};

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
  const result = await paywallModule.default.presentPaywall();
  return mapPaywallResult(result, paywallModule.PAYWALL_RESULT);
}

/** RevenueCatで購入を復元し、復元後のPlus状態へ変換する。 */
export async function restorePremiumPurchasesWithRevenueCat(): Promise<PremiumAccessState> {
  const configured = configureRevenueCatIfAvailable();

  if (!configured) {
    throw new Error('RevenueCat API key is not configured for this platform.');
  }

  return resolveAccessStateFromCustomerInfo(await Purchases.restorePurchases());
}
```

Extend `createRevenueCatClient()`:

```ts
  return {
    hasActiveEntitlement: getPremiumAccessStateFromRevenueCat,
    getCurrentOffering: getPremiumOfferingSummaryFromRevenueCat,
    presentPaywall: presentPaywallWithRevenueCat,
    restorePurchases: restorePremiumPurchasesWithRevenueCat,
  };
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
npm test -- src/features/premium/__tests__/revenueCatAccess.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/features/premium/revenueCatAccess.ts src/features/premium/revenueCatClient.ts src/features/premium/__tests__/revenueCatAccess.test.ts
git commit -m "feat(premium): RevenueCatの商品取得と復元を追加"
```

## Task 3: Add Paywall Result Tests

**Files:**
- Modify: `src/features/premium/__tests__/revenueCatAccess.test.ts`
- Modify: `src/features/premium/revenueCatClient.ts`

- [ ] **Step 1: Write failing tests for Paywall result mapping**

Add a Jest mock for `react-native-purchases-ui` near the `react-native-purchases` mock:

```ts
jest.mock('react-native-purchases-ui', () => ({
  __esModule: true,
  default: {
    presentPaywall: jest.fn(),
  },
  PAYWALL_RESULT: {
    PURCHASED: 'PURCHASED',
    RESTORED: 'RESTORED',
    CANCELLED: 'CANCELLED',
    NOT_PRESENTED: 'NOT_PRESENTED',
    ERROR: 'ERROR',
  },
}));
```

Import it:

```ts
import RevenueCatUI from 'react-native-purchases-ui';
import { presentPremiumPaywall } from '../revenueCatAccess';
import { presentPaywallWithRevenueCat } from '../revenueCatClient';
```

Add tests:

```ts
  it('Paywall購入完了をpurchasedとして返す', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    (RevenueCatUI.presentPaywall as jest.Mock).mockResolvedValue('PURCHASED');

    await expect(presentPaywallWithRevenueCat()).resolves.toBe('purchased');
  });

  it('Paywall復元完了をrestoredとして返す', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    (RevenueCatUI.presentPaywall as jest.Mock).mockResolvedValue('RESTORED');

    await expect(presentPaywallWithRevenueCat()).resolves.toBe('restored');
  });

  it('Paywallキャンセルをcancelledとして返す', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    (RevenueCatUI.presentPaywall as jest.Mock).mockResolvedValue('CANCELLED');

    await expect(presentPaywallWithRevenueCat()).resolves.toBe('cancelled');
  });

  it('Paywall表示失敗時はerrorへフォールバックする', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (RevenueCatUI.presentPaywall as jest.Mock).mockRejectedValue(new Error('native module failed'));

    await expect(presentPremiumPaywall()).resolves.toBe('error');
    expect(console.warn).toHaveBeenCalledWith('Failed to present RevenueCat paywall:', expect.any(Error));
  });
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test -- src/features/premium/__tests__/revenueCatAccess.test.ts --runInBand
```

Expected: FAIL until `presentPaywallWithRevenueCat` exists or returns mapped results.

- [ ] **Step 3: Implement or adjust mapping**

If Task 2 already added the mapping, fix any TypeScript/Jest import issue. Keep `require('react-native-purchases-ui')` inside `presentPaywallWithRevenueCat()`.

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
npm test -- src/features/premium/__tests__/revenueCatAccess.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/features/premium/revenueCatClient.ts src/features/premium/__tests__/revenueCatAccess.test.ts
git commit -m "feat(premium): RevenueCat Paywall表示結果を扱う"
```

## Task 4: Add Settings Screen Paywall and Restore UI

**Files:**
- Modify: `src/app/components/SettingsScreen.tsx`
- Modify: `src/app/components/__tests__/SettingsScreen.test.tsx`

- [ ] **Step 1: Write failing SettingsScreen tests**

In `SettingsScreen.test.tsx`, import the offering type:

```ts
import { PremiumOfferingSummary } from '../../../features/premium/revenueCatAccess';
```

Extend `createProps()`:

```ts
    premiumOfferingSummary: null as PremiumOfferingSummary | null,
    isLoadingPremiumOffering: false,
    isPresentingPremiumPaywall: false,
    isRestoringPremiumPurchases: false,
    onPresentPremiumPaywall: jest.fn(),
    onRestorePremiumPurchases: jest.fn(),
```

Add tests:

```ts
  test('Strollia Plusカードは取得した商品概要を表示する', () => {
    const props = {
      ...createProps(),
      premiumOfferingSummary: {
        offeringId: 'default',
        packages: [
          {
            identifier: '$rc_monthly',
            packageType: 'MONTHLY',
            productIdentifier: 'strollia_plus_monthly',
            title: 'Strollia Plus Monthly',
            description: 'Monthly plan',
            priceText: '¥300',
          },
        ],
      },
    };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('Strollia Plus Monthly');
    expect(texts).toContain('¥300');
    expect(texts).toContain('strollia_plus_monthly');
  });

  test('Strollia PlusカードはPaywall表示と復元ボタンを呼び出す', () => {
    const props = createProps();
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const paywallButton = renderer.root.findAll((node: any) => node.props.onPress === props.onPresentPremiumPaywall)[0];
    const restoreButton = renderer.root.findAll((node: any) => node.props.onPress === props.onRestorePremiumPurchases)[0];

    act(() => {
      paywallButton.props.onPress();
      restoreButton.props.onPress();
    });

    expect(props.onPresentPremiumPaywall).toHaveBeenCalledTimes(1);
    expect(props.onRestorePremiumPurchases).toHaveBeenCalledTimes(1);
  });

  test('Strollia PlusカードはOffering取得中の表示を出す', () => {
    const props = {
      ...createProps(),
      isLoadingPremiumOffering: true,
    };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('商品情報を確認しています...');
  });
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test -- src/app/components/__tests__/SettingsScreen.test.tsx --runInBand
```

Expected: FAIL because new props and UI do not exist.

- [ ] **Step 3: Implement SettingsScreen props and UI**

In `SettingsScreen.tsx`, import:

```ts
import { getDefaultPremiumAccessState, PremiumOfferingSummary } from '../../features/premium/revenueCatAccess';
```

Add props:

```ts
  /** RevenueCat Offeringの商品概要。 */
  premiumOfferingSummary: PremiumOfferingSummary | null;
  /** 商品情報を読み込み中か。 */
  isLoadingPremiumOffering: boolean;
  /** Paywall表示処理中か。 */
  isPresentingPremiumPaywall: boolean;
  /** 購入復元処理中か。 */
  isRestoringPremiumPurchases: boolean;
  /** RevenueCat Paywallを表示する処理。 */
  onPresentPremiumPaywall: () => void;
  /** 購入復元処理。 */
  onRestorePremiumPurchases: () => void;
```

Destructure them in the component parameter.

Inside the Strollia Plus card, after the status row, add:

```tsx
          <PremiumOfferingSummaryView
            styles={styles}
            theme={theme}
            isLoadingPremiumOffering={isLoadingPremiumOffering}
            premiumOfferingSummary={premiumOfferingSummary}
          />
          <View style={styles.actions}>
            <Pressable
              disabled={isPresentingPremiumPaywall}
              onPress={onPresentPremiumPaywall}
              style={[styles.primaryButton, isPresentingPremiumPaywall && styles.buttonDisabled]}
            >
              <Text style={styles.primaryButtonText}>{isPresentingPremiumPaywall ? '表示中...' : 'Strollia Plusを見る'}</Text>
            </Pressable>
            <Pressable
              disabled={isRestoringPremiumPurchases}
              onPress={onRestorePremiumPurchases}
              style={[styles.settingsAction, isRestoringPremiumPurchases && styles.buttonDisabled]}
            >
              <MaterialCommunityIcons name="restore" size={18} color={theme.colors.primary} />
              <Text style={styles.settingsActionText}>{isRestoringPremiumPurchases ? '復元中...' : '購入を復元'}</Text>
            </Pressable>
          </View>
```

Add helper component below `SettingsScreen`:

```tsx
type PremiumOfferingSummaryViewProps = Pick<SettingsScreenProps, 'styles' | 'theme' | 'premiumOfferingSummary' | 'isLoadingPremiumOffering'>;

/** RevenueCat Offeringから取得した商品概要を描画する。 */
function PremiumOfferingSummaryView({ styles, theme, premiumOfferingSummary, isLoadingPremiumOffering }: PremiumOfferingSummaryViewProps) {
  if (isLoadingPremiumOffering) {
    return <Text style={styles.settingsDescription}>商品情報を確認しています...</Text>;
  }

  if (!premiumOfferingSummary || premiumOfferingSummary.packages.length === 0) {
    return <Text style={styles.settingsDescription}>商品情報はまだ取得できません。ストア設定を確認中です。</Text>;
  }

  return (
    <View style={styles.customizationSection}>
      {premiumOfferingSummary.packages.map((revenueCatPackage) => (
        <View key={revenueCatPackage.identifier} style={styles.settingsStatusRow}>
          <MaterialCommunityIcons name="tag-outline" size={18} color={theme.colors.primary} />
          <View style={styles.settingsToggleTextColumn}>
            <Text style={styles.settingsStatusText}>{revenueCatPackage.title}</Text>
            <Text style={styles.settingsDescription}>
              {revenueCatPackage.priceText} / {revenueCatPackage.productIdentifier}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
npm test -- src/app/components/__tests__/SettingsScreen.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/app/components/SettingsScreen.tsx src/app/components/__tests__/SettingsScreen.test.tsx
git commit -m "feat(premium): 設定画面にPaywallと復元導線を追加"
```

## Task 5: Wire Premium Paywall Operations in App

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/__tests__/AppMapReturn.test.tsx`

- [ ] **Step 1: Write failing App test for locked premium action**

In `AppMapReturn.test.tsx`, extend the premium mock:

```ts
jest.mock('../../features/premium/revenueCatAccess', () => ({
  getDefaultPremiumAccessState: jest.fn(() => ({ isPlusActive: false, entitlementId: 'strollia_plus' })),
  getPremiumAccessState: jest.fn().mockResolvedValue({ isPlusActive: false, entitlementId: 'strollia_plus' }),
  getPremiumOfferingSummary: jest.fn().mockResolvedValue(null),
  presentPremiumPaywall: jest.fn().mockResolvedValue('purchased'),
  restorePremiumPurchases: jest.fn().mockResolvedValue({ isPlusActive: true, entitlementId: 'strollia_plus' }),
}));
```

Import:

```ts
import { getPremiumOfferingSummary, presentPremiumPaywall, restorePremiumPurchases } from '../../features/premium/revenueCatAccess';
```

Add test:

```ts
  test('Plus未加入時に有料現在地アイコンを選ぶとPaywallを表示してPlus状態を再取得する', async () => {
    const renderer = await renderApp();

    await act(async () => {
      const settingsButton = renderer.root.findAll((node: any) => node.props.accessibilityLabel === '設定')[0];
      settingsButton.props.onPress();
    });

    await act(async () => {
      const walkerButton = renderer.root.findAll(
        (node: any) => node.props.onPress && node.findAllByType(Text).some((textNode: any) => textNode.props.children === 'さんぽ'),
      )[0];
      walkerButton.props.onPress();
    });

    expect(presentPremiumPaywall).toHaveBeenCalledTimes(1);
    expect(getPremiumAccessState).toHaveBeenCalledTimes(2);
  });
```

If tree lookup is too brittle, locate the `SettingsScreen` component and invoke `props.onUpdateUserLocationIcon('walker')` directly.

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test -- src/app/__tests__/AppMapReturn.test.tsx --runInBand
```

Expected: FAIL because locked action still shows an Alert instead of calling Paywall.

- [ ] **Step 3: Implement App state and operations**

In `App.tsx`, import:

```ts
import {
  getDefaultPremiumAccessState,
  getPremiumAccessState,
  getPremiumOfferingSummary,
  PremiumOfferingSummary,
  presentPremiumPaywall,
  restorePremiumPurchases,
} from '../features/premium/revenueCatAccess';
```

Add state near `premiumAccessState`:

```ts
  const [premiumOfferingSummary, setPremiumOfferingSummary] = useState<PremiumOfferingSummary | null>(null);
  const [isLoadingPremiumOffering, setIsLoadingPremiumOffering] = useState(false);
  const [isPresentingPremiumPaywall, setIsPresentingPremiumPaywall] = useState(false);
  const [isRestoringPremiumPurchases, setIsRestoringPremiumPurchases] = useState(false);
```

In initialization after `getPremiumAccessState()` call, add:

```ts
            setIsLoadingPremiumOffering(true);
            getPremiumOfferingSummary()
              .then(setPremiumOfferingSummary)
              .catch((error: unknown) => {
                console.warn('Failed to refresh premium offering summary:', error);
              })
              .finally(() => {
                setIsLoadingPremiumOffering(false);
              });
```

Add helper:

```ts
  /** RevenueCatのPlus状態を再取得して画面へ反映する。 */
  async function refreshPremiumAccessState(): Promise<void> {
    setPremiumAccessState(await getPremiumAccessState());
  }
```

Add paywall handler:

```ts
  /** RevenueCat Paywallを表示し、購入または復元後にPlus状態を更新する。 */
  async function openPremiumPaywall(): Promise<void> {
    if (isPresentingPremiumPaywall) {
      return;
    }

    triggerSelectionHaptic();
    setIsPresentingPremiumPaywall(true);

    try {
      const result = await presentPremiumPaywall();

      if (result === 'purchased' || result === 'restored') {
        await refreshPremiumAccessState();
        Alert.alert('Strollia Plus', 'Plus特典が有効になりました。');
      } else if (result === 'error' || result === 'notPresented') {
        Alert.alert('Strollia Plus', 'Paywallを表示できませんでした。RevenueCatとストア設定を確認してください。');
      }
    } finally {
      setIsPresentingPremiumPaywall(false);
    }
  }
```

Add restore handler:

```ts
  /** App StoreまたはGoogle Playの購入をRevenueCat経由で復元する。 */
  async function restorePurchasesFromSettings(): Promise<void> {
    if (isRestoringPremiumPurchases) {
      return;
    }

    triggerSelectionHaptic();
    setIsRestoringPremiumPurchases(true);

    try {
      const restoredState = await restorePremiumPurchases();
      setPremiumAccessState(restoredState);
      Alert.alert('購入の復元', restoredState.isPlusActive ? 'Strollia Plusを復元しました。' : '復元できるStrollia Plus購入は見つかりませんでした。');
    } finally {
      setIsRestoringPremiumPurchases(false);
    }
  }
```

Change `showPremiumLockedMessage` to call Paywall:

```ts
  function showPremiumLockedMessage(label: string): void {
    Alert.alert('Strollia Plus限定', `${label}はStrollia Plusで開放できます。Paywallを表示しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '見る',
        onPress: () => {
          openPremiumPaywall().catch((error: unknown) => {
            console.warn('Failed to open premium paywall:', error);
          });
        },
      },
    ]);
  }
```

Pass new props to `SettingsScreen`:

```tsx
            premiumOfferingSummary={premiumOfferingSummary}
            isLoadingPremiumOffering={isLoadingPremiumOffering}
            isPresentingPremiumPaywall={isPresentingPremiumPaywall}
            isRestoringPremiumPurchases={isRestoringPremiumPurchases}
            onPresentPremiumPaywall={() => {
              openPremiumPaywall().catch((error: unknown) => {
                console.warn('Failed to open premium paywall:', error);
              });
            }}
            onRestorePremiumPurchases={() => {
              restorePurchasesFromSettings().catch((error: unknown) => {
                console.warn('Failed to restore premium purchases:', error);
              });
            }}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
npm test -- src/app/__tests__/AppMapReturn.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Run SettingsScreen tests**

Run:

```bash
npm test -- src/app/components/__tests__/SettingsScreen.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/app/App.tsx src/app/__tests__/AppMapReturn.test.tsx
git commit -m "feat(premium): Paywall購入と復元をアプリに接続"
```

## Task 6: Update Monetization Docs and Todo

**Files:**
- Modify: `docs/monetization.md`
- Modify: `docs/todo.md`

- [ ] **Step 1: Update docs**

In `docs/monetization.md`, update section 7.4 to say:

```md
Plus状態の判定は `CustomerInfo.entitlements.active.strollia_plus` をもとに実装済みである。

購入導線は `react-native-purchases-ui` のRevenueCat Paywallを使う。設定画面のStrollia PlusカードからPaywallを表示し、購入または復元完了後に `CustomerInfo` を再取得してPlus状態へ反映する。

商品表示は `Purchases.getOfferings()` のcurrent offeringから取得する。Offeringや商品が未設定の場合もGPS記録や設定画面は止めず、商品情報は確認中として表示する。

購入復元は設定画面の「購入を復元」から `Purchases.restorePurchases()` を呼ぶ。復元後に `strollia_plus` entitlementが有効ならPlus有効として扱う。

Strolliaは現時点で独自アカウントを持たないため、RevenueCatの匿名App User IDを使う。Apple IDそのものはアプリから取得できない。将来ログインID連携を行う場合は、Sign in with Appleで返るアプリ/開発チーム向け識別子を `Purchases.logIn()` に渡す。
```

Add checklist:

```md
### 7.5 RevenueCat / Store実設定チェックリスト

- App Store Connectで `strollia_plus_monthly` と `strollia_plus_yearly` を作成する
- Google Play Consoleで `strollia_plus_monthly` と `strollia_plus_yearly` を作成する
- RevenueCatで `strollia_plus` entitlementを作成する
- RevenueCatでcurrent offeringに月額/年額packageを紐づける
- RevenueCat Paywallをcurrent offeringへ紐づける
- iOS/AndroidのPublic SDK API keyを環境変数へ設定する
- Expo development buildでPaywall表示、購入、復元を確認する
```

In `docs/todo.md`, change:

```md
- [x] 購入・復元フローを実装する
- [ ] Sign in with Apple識別子を使ったRevenueCatログインID連携を検討する
```

- [ ] **Step 2: Inspect docs diff**

Run:

```bash
git diff -- docs/monetization.md docs/todo.md
```

Expected: docs reflect current implementation and remaining identity work.

- [ ] **Step 3: Commit**

Run:

```bash
git add docs/monetization.md docs/todo.md
git commit -m "docs(premium): Paywallとストア設定手順を追加"
```

## Task 7: Final Verification

**Files:**
- All changed files

- [ ] **Step 1: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 2: Run full tests**

Run:

```bash
npm test -- --runInBand
```

Expected: PASS.

- [ ] **Step 3: Inspect final diff and branch**

Run:

```bash
git status --short
git log --oneline main..HEAD
git diff --stat main...HEAD
```

Expected: clean worktree, commits only for Paywall work on top of latest main.
