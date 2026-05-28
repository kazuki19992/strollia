# RevenueCat SDK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the RevenueCat React Native SDK and resolve Strollia Plus access from `CustomerInfo.entitlements.active.strollia_plus`.

**Architecture:** Keep RevenueCat inside `src/features/premium/` and expose only `PremiumAccessState` to UI. Configure the SDK only when the current platform has an `EXPO_PUBLIC_REVENUECAT_*_API_KEY`; otherwise keep the existing development-flag fallback.

**Tech Stack:** Expo SDK 54, React Native, TypeScript, Jest, `react-native-purchases`, RevenueCat CustomerInfo.

---

## File Structure

- Modify `package.json` and `package-lock.json`: add `react-native-purchases`.
- Create `src/features/premium/revenueCatConfig.ts`: resolve platform API key and SDK configuration input.
- Create `src/features/premium/revenueCatClient.ts`: thin wrapper around `react-native-purchases`.
- Modify `src/features/premium/revenueCatAccess.ts`: add safe RevenueCat state loading while preserving the existing `RevenueCatClient` seam.
- Modify `src/features/premium/__tests__/revenueCatAccess.test.ts`: add config, CustomerInfo, and fallback coverage.
- Modify `src/app/App.tsx`: load premium state asynchronously after app initialization and pass it to settings/customization.
- Modify `src/app/__tests__/AppMapReturn.test.tsx`: update the premium mock to expose the new async loader.
- Modify `src/app/components/SettingsScreen.tsx`: adjust Plus badge/copy from "RevenueCat準備中" to SDK-connected wording.
- Modify `src/app/components/__tests__/SettingsScreen.test.tsx`: assert updated Plus copy.
- Modify `docs/monetization.md` and `docs/todo.md`: document SDK environment variables and mark SDK/CustomerInfo items complete.

## Task 1: Add RevenueCat Dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install `react-native-purchases`**

Run:

```bash
npx expo install react-native-purchases
```

Expected: `package.json` contains `react-native-purchases`, and `package-lock.json` is updated.

- [ ] **Step 2: Run typecheck after dependency install**

Run:

```bash
npm run typecheck
```

Expected: PASS. If it fails because the package version exposes different TypeScript names than expected, inspect `node_modules/react-native-purchases/dist` before continuing.

- [ ] **Step 3: Commit dependency change**

```bash
git add package.json package-lock.json
git commit -m "build(premium): RevenueCat SDKを追加"
```

## Task 2: Add RevenueCat Config Helpers

**Files:**
- Create: `src/features/premium/revenueCatConfig.ts`
- Modify: `src/features/premium/__tests__/revenueCatAccess.test.ts`

- [ ] **Step 1: Write failing config tests**

Append to `src/features/premium/__tests__/revenueCatAccess.test.ts`:

```typescript
import { Platform } from 'react-native';
import {
  getRevenueCatApiKeyForPlatform,
  getRevenueCatConfigureOptions,
} from '../revenueCatConfig';

const originalPlatformOS = Platform.OS;
const originalIosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const originalAndroidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

function setEnvValue(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
```

Add inside the existing `describe('RevenueCat課金状態 revenueCatAccess', () => { ... })` block:

```typescript
  afterEach(() => {
    Platform.OS = originalPlatformOS;
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', originalIosKey);
    setEnvValue('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY', originalAndroidKey);
  });

  it('iOSではRevenueCatのiOS APIキーを設定に使う', () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    setEnvValue('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'goog_android_key');

    expect(getRevenueCatApiKeyForPlatform()).toBe('appl_ios_key');
    expect(getRevenueCatConfigureOptions()).toEqual({ apiKey: 'appl_ios_key' });
  });

  it('AndroidではRevenueCatのAndroid APIキーを設定に使う', () => {
    Platform.OS = 'android';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    setEnvValue('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'goog_android_key');

    expect(getRevenueCatApiKeyForPlatform()).toBe('goog_android_key');
    expect(getRevenueCatConfigureOptions()).toEqual({ apiKey: 'goog_android_key' });
  });

  it('APIキー未設定または未対応プラットフォームではRevenueCat設定を作らない', () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', undefined);
    expect(getRevenueCatApiKeyForPlatform()).toBeNull();
    expect(getRevenueCatConfigureOptions()).toBeNull();

    Platform.OS = 'web';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    setEnvValue('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'goog_android_key');
    expect(getRevenueCatApiKeyForPlatform()).toBeNull();
    expect(getRevenueCatConfigureOptions()).toBeNull();
  });
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/features/premium/__tests__/revenueCatAccess.test.ts --runInBand
```

Expected: FAIL because `../revenueCatConfig` does not exist.

- [ ] **Step 3: Implement config helpers**

Create `src/features/premium/revenueCatConfig.ts`:

```typescript
import { Platform } from 'react-native';

/** RevenueCat SDKのconfigureへ渡す最小設定。 */
export type RevenueCatConfigureOptions = {
  /** RevenueCatのPublic SDK API key。 */
  apiKey: string;
};

/** 現在のプラットフォームに対応するRevenueCat APIキーを返す。 */
export function getRevenueCatApiKeyForPlatform(): string | null {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || null;
  }

  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || null;
  }

  return null;
}

/** APIキーがある場合だけRevenueCat SDK初期化設定を返す。 */
export function getRevenueCatConfigureOptions(): RevenueCatConfigureOptions | null {
  const apiKey = getRevenueCatApiKeyForPlatform();

  if (!apiKey) {
    return null;
  }

  return { apiKey };
}
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- src/features/premium/__tests__/revenueCatAccess.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit config helpers**

```bash
git add src/features/premium/revenueCatConfig.ts src/features/premium/__tests__/revenueCatAccess.test.ts
git commit -m "feat(premium): RevenueCat APIキー設定を追加"
```

## Task 3: Add RevenueCat Client and CustomerInfo Resolution

**Files:**
- Create: `src/features/premium/revenueCatClient.ts`
- Modify: `src/features/premium/revenueCatAccess.ts`
- Modify: `src/features/premium/__tests__/revenueCatAccess.test.ts`

- [ ] **Step 1: Mock `react-native-purchases` in premium tests**

Add near the top of `src/features/premium/__tests__/revenueCatAccess.test.ts`:

```typescript
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    getCustomerInfo: jest.fn(),
  },
}));
```

Add imports:

```typescript
import Purchases from 'react-native-purchases';
import {
  createRevenueCatClient,
} from '../revenueCatClient';
import { getPremiumAccessState } from '../revenueCatAccess';
```

- [ ] **Step 2: Write failing CustomerInfo tests**

Add inside the existing `describe` block:

```typescript
  it('RevenueCat CustomerInfoにstrollia_plus entitlementがあればPlus有効にする', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue({
      entitlements: {
        active: {
          [STROLLIA_PLUS_ENTITLEMENT_ID]: { identifier: STROLLIA_PLUS_ENTITLEMENT_ID },
        },
      },
    });

    const client = createRevenueCatClient();

    await expect(client.hasActiveEntitlement(STROLLIA_PLUS_ENTITLEMENT_ID)).resolves.toBe(true);
    expect(Purchases.configure).toHaveBeenCalledWith({ apiKey: 'appl_ios_key' });
    expect(Purchases.getCustomerInfo).toHaveBeenCalledTimes(1);
  });

  it('RevenueCat CustomerInfoにentitlementがなければPlus無効にする', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue({
      entitlements: { active: {} },
    });

    const client = createRevenueCatClient();

    await expect(client.hasActiveEntitlement(STROLLIA_PLUS_ENTITLEMENT_ID)).resolves.toBe(false);
  });

  it('RevenueCat未設定時は既定の課金状態へフォールバックする', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', undefined);

    await expect(getPremiumAccessState()).resolves.toEqual(getDefaultPremiumAccessState());
    expect(Purchases.configure).not.toHaveBeenCalled();
    expect(Purchases.getCustomerInfo).not.toHaveBeenCalled();
  });

  it('RevenueCat取得失敗時は既定の課金状態へフォールバックする', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (Purchases.getCustomerInfo as jest.Mock).mockRejectedValue(new Error('network failed'));

    await expect(getPremiumAccessState()).resolves.toEqual(getDefaultPremiumAccessState());
    expect(console.warn).toHaveBeenCalledWith('Failed to load RevenueCat premium state:', expect.any(Error));
  });
```

Update `beforeEach` in the test file to reset mocks:

```typescript
  beforeEach(() => {
    jest.clearAllMocks();
  });
```

- [ ] **Step 3: Verify RED**

Run:

```bash
npm test -- src/features/premium/__tests__/revenueCatAccess.test.ts --runInBand
```

Expected: FAIL because `revenueCatClient.ts`, `createRevenueCatClient`, and `getPremiumAccessState` do not exist.

- [ ] **Step 4: Implement RevenueCat client**

Create `src/features/premium/revenueCatClient.ts`:

```typescript
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
```

- [ ] **Step 5: Implement safe premium state loader**

Modify `src/features/premium/revenueCatAccess.ts`:

```typescript
import { developmentFlags } from '../../config/developmentFlags';
import { STROLLIA_PLUS_ENTITLEMENT_ID } from './premiumCatalog';
import { createRevenueCatClient } from './revenueCatClient';

// keep existing PremiumAccessState, RevenueCatClient, getDefaultPremiumAccessState, resolvePremiumAccessState

/** RevenueCat SDKが使える場合はCustomerInfoから、使えない場合は既定状態からPlus状態を返す。 */
export async function getPremiumAccessState(): Promise<PremiumAccessState> {
  try {
    return await resolvePremiumAccessState(createRevenueCatClient());
  } catch (error: unknown) {
    console.warn('Failed to load RevenueCat premium state:', error);
    return getDefaultPremiumAccessState();
  }
}
```

Then adjust `resolvePremiumAccessState` so a `false` result remains a valid RevenueCat result:

```typescript
export async function resolvePremiumAccessState(client: RevenueCatClient): Promise<PremiumAccessState> {
  return {
    isPlusActive: await client.hasActiveEntitlement(STROLLIA_PLUS_ENTITLEMENT_ID),
    entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID,
  };
}
```

- [ ] **Step 6: Make tests reset client state**

Import and call the reset helper in `revenueCatAccess.test.ts`:

```typescript
import { resetRevenueCatClientForTesting } from '../revenueCatClient';

beforeEach(() => {
  jest.clearAllMocks();
  resetRevenueCatClientForTesting();
});
```

- [ ] **Step 7: Verify GREEN**

Run:

```bash
npm test -- src/features/premium/__tests__/revenueCatAccess.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit RevenueCat client**

```bash
git add src/features/premium/revenueCatAccess.ts src/features/premium/revenueCatClient.ts src/features/premium/__tests__/revenueCatAccess.test.ts
git commit -m "feat(premium): CustomerInfoからPlus状態を取得"
```

## Task 4: Wire Premium State Into App Initialization

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/__tests__/AppMapReturn.test.tsx`

- [ ] **Step 1: Write failing App wiring test**

Modify the premium mock in `src/app/__tests__/AppMapReturn.test.tsx`:

```typescript
jest.mock('../../features/premium/revenueCatAccess', () => ({
  getDefaultPremiumAccessState: jest.fn(() => ({ isPlusActive: false, entitlementId: 'strollia_plus' })),
  getPremiumAccessState: jest.fn().mockResolvedValue({ isPlusActive: true, entitlementId: 'strollia_plus' }),
}));
```

Add import:

```typescript
import { getPremiumAccessState } from '../../features/premium/revenueCatAccess';
```

Add a test near the existing app initialization tests:

```typescript
  it('起動後にRevenueCat由来のPlus状態を読み込む', async () => {
    await act(async () => {
      ReactTestRenderer.create(<App />);
    });

    expect(getPremiumAccessState).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/app/__tests__/AppMapReturn.test.tsx --runInBand
```

Expected: FAIL because `App.tsx` does not call `getPremiumAccessState`.

- [ ] **Step 3: Implement App state loading**

Modify import in `src/app/App.tsx`:

```typescript
import { getDefaultPremiumAccessState, getPremiumAccessState } from '../features/premium/revenueCatAccess';
```

Replace:

```typescript
const premiumAccessState = useMemo(() => getDefaultPremiumAccessState(), []);
```

with:

```typescript
const [premiumAccessState, setPremiumAccessState] = useState(getDefaultPremiumAccessState);
```

Inside the existing initialization `useEffect`, after saved settings are loaded and before `setIsReady(true)`, add:

```typescript
        getPremiumAccessState()
          .then(setPremiumAccessState)
          .catch((error: unknown) => {
            console.warn('Failed to refresh premium access state:', error);
          });
```

Do not await this call; premium state should refresh without blocking DB, location, or map readiness.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- src/app/__tests__/AppMapReturn.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit App wiring**

```bash
git add src/app/App.tsx src/app/__tests__/AppMapReturn.test.tsx
git commit -m "feat(premium): アプリ起動時にPlus状態を更新"
```

## Task 5: Update Settings Copy

**Files:**
- Modify: `src/app/components/SettingsScreen.tsx`
- Modify: `src/app/components/__tests__/SettingsScreen.test.tsx`

- [ ] **Step 1: Write failing SettingsScreen copy test**

In `src/app/components/__tests__/SettingsScreen.test.tsx`, replace the Plus copy expectation:

```typescript
expect(texts).toContain('RevenueCatでPlus状態を確認します。無料時はOS標準の現在地アイコンを使います。');
```

Also assert the badge text:

```typescript
expect(texts).toContain('RevenueCat連携済み');
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/app/components/__tests__/SettingsScreen.test.tsx --runInBand
```

Expected: FAIL because the UI still says `RevenueCat準備中`.

- [ ] **Step 3: Update SettingsScreen copy**

In `src/app/components/SettingsScreen.tsx`, replace:

```tsx
<Text style={styles.premiumBadge}>RevenueCat準備中</Text>
```

with:

```tsx
<Text style={styles.premiumBadge}>RevenueCat連携済み</Text>
```

Replace the Plus description with:

```tsx
RevenueCatでPlus状態を確認します。無料時はOS標準の現在地アイコンを使います。
```

Replace locked message text in `showPremiumLockedMessage` in `src/app/App.tsx` if it still says "RevenueCat連携後":

```typescript
Alert.alert('Strollia Plus限定', `${label}はStrollia Plusで開放予定です。購入・復元フロー実装後に選択できるようにします。`);
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- src/app/components/__tests__/SettingsScreen.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit copy update**

```bash
git add src/app/components/SettingsScreen.tsx src/app/components/__tests__/SettingsScreen.test.tsx src/app/App.tsx
git commit -m "docs(premium): Plus表示文言をSDK導入後に更新"
```

## Task 6: Update Docs and Todo

**Files:**
- Modify: `docs/monetization.md`
- Modify: `docs/todo.md`

- [ ] **Step 1: Update monetization docs**

In `docs/monetization.md`, update section 7.4 so it says:

```markdown
### 7.4 RevenueCat SDK連携

RevenueCat SDKは `react-native-purchases` で導入する。アプリ側は以下の環境変数からプラットフォームごとのPublic SDK API keyを読み込む。

- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`

APIキーが未設定の場合、SDK初期化は行わず、既存の開発用Plusフラグへフォールバックする。

- `EXPO_PUBLIC_ENABLE_PREMIUM_ACCESS_WITHOUT_REVENUECAT=true`

Plus状態は `CustomerInfo.entitlements.active.strollia_plus` をもとに判定する。実購入、復元、Paywall、商品表示は次段階で実装する。

Expo Goでは実購入テストは行わない。RevenueCatの実SDK動作と購入確認にはExpo development build、RevenueCat Dashboard設定、App Store ConnectまたはGoogle Play Consoleの商品設定が必要である。
```

- [ ] **Step 2: Update todo**

In `docs/todo.md`, mark these complete:

```markdown
- [x] RevenueCat SDKを導入する
- [x] RevenueCatのCustomerInfoでPlus有効状態を判定する
```

Keep this incomplete:

```markdown
- [ ] 購入・復元フローを実装する
```

- [ ] **Step 3: Commit docs**

```bash
git add docs/monetization.md docs/todo.md
git commit -m "docs(premium): RevenueCat SDK連携方針を更新"
```

## Task 7: Final Verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 2: Run all tests**

Run:

```bash
npm test -- --runInBand
```

Expected: all suites PASS.

- [ ] **Step 3: Inspect final diff**

Run:

```bash
git status --short
git log --oneline main..HEAD
git diff --stat main...HEAD
```

Expected:

- Working tree is clean.
- Commits include the design commit plus dependency, premium config/client, App wiring, copy, and docs commits.
- Diff is limited to RevenueCat SDK integration and related tests/docs.
