# 日別詳細 Strollia Plus ペイウォール実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 日ごとの記録詳細ページに Plus 限定コンテンツのブラーマスキングと全画面ペイウォールモーダルを追加する。

**Architecture:** `PremiumPaywallModal` を新規作成し App.tsx のルートでレンダリングすることでどの画面からでも開ける。`DailyLogDetailScreen` に `premiumAccessState` と `onOpenPremiumPaywall` prop を追加し、一般ユーザーにはスライダー非表示・訪問エリア非表示・おもいでを BlurView でマスクし、キャプチャ範囲外にペイウォールボタンを配置する。

**Tech Stack:** React Native (`Modal`), `expo-blur` (`BlurView`), 既存の `ActionPill` / `DescriptionText` / `InfoBlock` / `PlusAdImage`

---

## ファイル構成

| 操作 | パス |
|------|------|
| 新規作成 | `src/app/components/PremiumPaywallModal.tsx` |
| 新規作成 | `src/app/components/__tests__/PremiumPaywallModal.test.tsx` |
| 変更 | `src/app/components/DailyLogDetailScreen.tsx` |
| 変更 | `src/app/components/__tests__/DailyLogDetailScreen.test.tsx` |
| 変更 | `src/app/App.tsx` |
| 変更 | `src/app/__tests__/AppMapReturn.test.tsx` |
| 変更 | `src/app/components/ActionPill.tsx` |
| 変更 | `src/app/appStyles.ts` |

---

## Task 1: expo-blur のインストール

**Files:**
- Modify: `package.json`

- [ ] **Step 1: expo-blur をインストール**

```bash
cd /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall
npx expo install expo-blur
```

Expected: `package.json` に `"expo-blur"` が追加される。

- [ ] **Step 2: インストール確認**

```bash
grep "expo-blur" package.json
```

Expected: `"expo-blur": "~x.x.x"` が出力される。

- [ ] **Step 3: Commit**

```bash
git -C /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall add package.json package-lock.json
git -C /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall commit -m "chore: expo-blur を追加"
```

---

## Task 2: ActionPill に accessibilityLabel prop を追加

**Files:**
- Modify: `src/app/components/ActionPill.tsx`

- [ ] **Step 1: ActionPillProps に accessibilityLabel を追加し Pressable に渡す**

`src/app/components/ActionPill.tsx` を以下のように変更する:

```tsx
export type ActionPillProps = {
  /** アクセシビリティ用ラベル。未指定の場合は label を使用。 */
  accessibilityLabel?: string;
  // ... 既存の props はそのまま
  label: string;
  // ...
};

export function ActionPill({
  accessibilityLabel,
  // ... 既存の引数
  label,
  // ...
}: ActionPillProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      // ... 残りはそのまま
    >
```

- [ ] **Step 2: 既存テストを実行して壊れていないことを確認**

```bash
cd /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall
npx jest --testPathPattern="SettingsScreen|ScreenComponents" --no-coverage 2>&1 | tail -10
```

Expected: `Tests: X passed`

- [ ] **Step 3: Commit**

```bash
git -C /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall add src/app/components/ActionPill.tsx
git -C /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall commit -m "feat(action-pill): accessibilityLabel prop を追加"
```

---

## Task 4: appStyles に新スタイルを追加

**Files:**
- Modify: `src/app/appStyles.ts`

- [ ] **Step 1: `dailyLogDetailActions` / `dailyLogDetailPlusSection` / `dailyLogDetailPlusLabel` を追加**

`src/app/appStyles.ts` の `dailyLogDetailSubTitle` ブロックの直後に以下を追加する:

```ts
    dailyLogDetailActions: {
      gap: 12,
      paddingHorizontal: 24,
    },
    dailyLogDetailPlusSection: {
      borderRadius: 12,
      marginHorizontal: 24,
      overflow: 'hidden',
    },
    dailyLogDetailPlusLabel: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '700' as const,
    },
```

- [ ] **Step 2: テストを実行して既存が壊れていないことを確認**

```bash
cd /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall
npx jest --testPathPattern="DailyLogDetailScreen" --no-coverage 2>&1 | tail -10
```

Expected: `Tests: X passed`

- [ ] **Step 3: Commit**

```bash
git -C /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall add src/app/appStyles.ts
git -C /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall commit -m "style: 日別詳細Plus用スタイルを追加"
```

---

## Task 5: PremiumPaywallModal を作成

**Files:**
- Create: `src/app/components/PremiumPaywallModal.tsx`
- Create: `src/app/components/__tests__/PremiumPaywallModal.test.tsx`

- [ ] **Step 1: テストファイルを作成**

`src/app/components/__tests__/PremiumPaywallModal.test.tsx`:

```tsx
import { Modal, Text } from 'react-native';
import { lightTheme } from '../../../theme/theme';
import { PremiumPaywallModal } from '../PremiumPaywallModal';
import { ActionPill } from '../ActionPill';

jest.mock('@expo/vector-icons', () => ({
  Feather: require('react-native').Text,
  MaterialCommunityIcons: require('react-native').Text,
}));

jest.mock('../PlusAdImage', () => ({
  PlusAdImage: () => null,
}));

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const styles = new Proxy({}, { get: (_target, prop) => prop });

const baseProps = {
  visible: true,
  styles: styles as never,
  theme: lightTheme,
  premiumOfferingSummary: null,
  isLoadingPremiumOffering: false,
  isPurchasingPremiumPackage: false,
  isRestoringPremiumPurchases: false,
  onClose: jest.fn(),
  onPurchaseMonthlyPremiumPackage: jest.fn(),
  onPurchaseYearlyPremiumPackage: jest.fn(),
  onRestorePremiumPurchases: jest.fn(),
};

describe('PremiumPaywallModal', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('visible=true のとき Modal が表示される', () => {
    const renderer = ReactTestRenderer.create(<PremiumPaywallModal {...baseProps} visible={true} />);
    expect(renderer.root.findByType(Modal).props.visible).toBe(true);
  });

  test('visible=false のとき Modal が非表示になる', () => {
    const renderer = ReactTestRenderer.create(<PremiumPaywallModal {...baseProps} visible={false} />);
    expect(renderer.root.findByType(Modal).props.visible).toBe(false);
  });

  test('閉じるボタンを押すと onClose が呼ばれる', () => {
    const onClose = jest.fn();
    const renderer = ReactTestRenderer.create(<PremiumPaywallModal {...baseProps} onClose={onClose} />);
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: 'ペイウォールを閉じる' }).props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('月払いボタンを押すと onPurchaseMonthlyPremiumPackage が呼ばれる', () => {
    const onPurchase = jest.fn();
    const renderer = ReactTestRenderer.create(
      <PremiumPaywallModal {...baseProps} onPurchaseMonthlyPremiumPackage={onPurchase} />,
    );
    const pills = renderer.root.findAllByType(ActionPill);
    const monthlyPill = pills.find((p: any) => p.props.label?.includes('月払い'));
    act(() => { monthlyPill.props.onPress(); });
    expect(onPurchase).toHaveBeenCalledTimes(1);
  });

  test('年払いボタンを押すと onPurchaseYearlyPremiumPackage が呼ばれる', () => {
    const onPurchase = jest.fn();
    const renderer = ReactTestRenderer.create(
      <PremiumPaywallModal {...baseProps} onPurchaseYearlyPremiumPackage={onPurchase} />,
    );
    const pills = renderer.root.findAllByType(ActionPill);
    const yearlyPill = pills.find((p: any) => p.props.label?.includes('年払い'));
    act(() => { yearlyPill.props.onPress(); });
    expect(onPurchase).toHaveBeenCalledTimes(1);
  });

  test('購入復元ボタンを押すと onRestorePremiumPurchases が呼ばれる', () => {
    const onRestore = jest.fn();
    const renderer = ReactTestRenderer.create(
      <PremiumPaywallModal {...baseProps} onRestorePremiumPurchases={onRestore} />,
    );
    const pills = renderer.root.findAllByType(ActionPill);
    const restorePill = pills.find((p: any) => p.props.label?.includes('復元'));
    act(() => { restorePill.props.onPress(); });
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  test('premiumOfferingSummary がある場合は実際の価格を表示する', () => {
    const renderer = ReactTestRenderer.create(
      <PremiumPaywallModal
        {...baseProps}
        premiumOfferingSummary={{
          offeringId: 'default',
          packages: [
            { identifier: '$rc_monthly', packageType: 'MONTHLY', productIdentifier: 'monthly', title: '月払い', description: '', priceText: '¥300' },
            { identifier: '$rc_annual', packageType: 'ANNUAL', productIdentifier: 'yearly', title: '年払い', description: '', priceText: '¥3,300' },
          ],
        }}
      />,
    );
    const texts = renderer.root.findAllByType(Text).map((n: any) => n.props.children);
    expect(texts.some((t: string) => typeof t === 'string' && t.includes('¥300'))).toBe(true);
    expect(texts.some((t: string) => typeof t === 'string' && t.includes('¥3,300'))).toBe(true);
  });

  test('isPurchasingPremiumPackage=true のとき購入ボタンが無効化される', () => {
    const renderer = ReactTestRenderer.create(
      <PremiumPaywallModal {...baseProps} isPurchasingPremiumPackage={true} />,
    );
    const pills = renderer.root.findAllByType(ActionPill);
    const buyPills = pills.filter((p: any) => p.props.label?.includes('購入処理中'));
    expect(buyPills.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall
npx jest --testPathPattern="PremiumPaywallModal" --no-coverage 2>&1 | tail -5
```

Expected: `Cannot find module '../PremiumPaywallModal'` エラー

- [ ] **Step 3: PremiumPaywallModal コンポーネントを実装**

`src/app/components/PremiumPaywallModal.tsx`:

```tsx
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons';
import { Modal, Pressable, SafeAreaView, ScrollView, View } from 'react-native';

import type { PremiumOfferingSummary } from '../../features/premium/revenueCatAccess';
import type { AppTheme } from '../../theme/theme';
import type { AppStyles } from '../appStyles';
import { ActionPill } from './ActionPill';
import { DescriptionText } from './DescriptionText';
import { InfoBlock } from './InfoBlock';
import { PlusAdImage } from './PlusAdImage';

export type PremiumPaywallModalProps = {
  /** モーダルの表示状態。 */
  visible: boolean;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** RevenueCat Offering概要。 */
  premiumOfferingSummary: PremiumOfferingSummary | null;
  /** 商品情報読み込み中か。 */
  isLoadingPremiumOffering: boolean;
  /** サブスク購入処理中か。 */
  isPurchasingPremiumPackage: boolean;
  /** 購入復元処理中か。 */
  isRestoringPremiumPurchases: boolean;
  /** 閉じる処理。 */
  onClose: () => void;
  /** 月払い購入処理。 */
  onPurchaseMonthlyPremiumPackage: () => void;
  /** 年払い購入処理。 */
  onPurchaseYearlyPremiumPackage: () => void;
  /** 購入復元処理。 */
  onRestorePremiumPurchases: () => void;
};

/** Strollia Plus への加入を促す全画面モーダル。 */
export function PremiumPaywallModal({
  visible,
  styles,
  theme,
  premiumOfferingSummary,
  isLoadingPremiumOffering,
  isPurchasingPremiumPackage,
  isRestoringPremiumPurchases,
  onClose,
  onPurchaseMonthlyPremiumPackage,
  onPurchaseYearlyPremiumPackage,
  onRestorePremiumPurchases,
}: PremiumPaywallModalProps) {
  const monthlyPriceText =
    premiumOfferingSummary?.packages.find((p) => p.packageType === 'MONTHLY')?.priceText ?? '300円';
  const yearlyPriceText =
    premiumOfferingSummary?.packages.find((p) => p.packageType === 'ANNUAL')?.priceText ?? '3300円';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.appScreen}>
        <View style={styles.appHeader}>
          <Pressable
            accessibilityLabel="ペイウォールを閉じる"
            accessibilityRole="button"
            onPress={onClose}
          >
            <Feather name="x" size={24} color={theme.colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.screenList}>
          <InfoBlock
            description="月額300円の有料サービスです。年払いにすると1か月分オトクです!"
            styles={styles}
            title="Strollia Plus(有料サブスクリプション)のごあんない"
          />
          <PlusAdImage accessibilityLabel="Strollia Plusの機能比較広告" width="100%" />
          <DescriptionText styles={styles}>いつでも解約できます。</DescriptionText>
          <ActionPill
            alignLeft
            backgroundColor={theme.name === 'dark' ? 'rgba(115, 199, 162, 0.08)' : 'rgba(31, 122, 92, 0.08)'}
            borderColor={theme.colors.primary}
            disabled={isPurchasingPremiumPackage}
            icon={<MaterialCommunityIcons name="currency-usd" size={21} color={theme.colors.primary} />}
            label={isPurchasingPremiumPackage ? '購入処理中...' : `月払い(${monthlyPriceText})ではじめる！`}
            styles={styles}
            textColor={theme.colors.primary}
            onPress={onPurchaseMonthlyPremiumPackage}
          />
          <ActionPill
            alignLeft
            backgroundColor={theme.name === 'dark' ? 'rgba(115, 199, 162, 0.08)' : 'rgba(31, 122, 92, 0.08)'}
            borderColor={theme.colors.primary}
            disabled={isPurchasingPremiumPackage}
            icon={<MaterialCommunityIcons name="currency-usd" size={21} color={theme.colors.primary} />}
            label={isPurchasingPremiumPackage ? '購入処理中...' : `年払い(${yearlyPriceText})ではじめる！`}
            styles={styles}
            textColor={theme.colors.primary}
            onPress={onPurchaseYearlyPremiumPackage}
          />
          <ActionPill
            alignLeft
            disabled={isRestoringPremiumPurchases}
            icon={<MaterialCommunityIcons name="restore" size={24} color={theme.colors.text} />}
            label={isRestoringPremiumPurchases ? '復元中...' : 'Strollia Plusの購入を復元する'}
            styles={styles}
            onPress={onRestorePremiumPurchases}
          />
          {isLoadingPremiumOffering && (
            <DescriptionText styles={styles}>商品情報を確認しています...</DescriptionText>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
```

- [ ] **Step 4: テストを実行して通ることを確認**

```bash
cd /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall
npx jest --testPathPattern="PremiumPaywallModal" --no-coverage 2>&1 | tail -10
```

Expected: `Tests: 6 passed`

- [ ] **Step 5: Commit**

```bash
git -C /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall add src/app/components/PremiumPaywallModal.tsx src/app/components/__tests__/PremiumPaywallModal.test.tsx
git -C /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall commit -m "feat(premium): PremiumPaywallModal を追加"
```

---

## Task 6: App.tsx にペイウォールモーダルを組み込む

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/__tests__/AppMapReturn.test.tsx`

- [ ] **Step 1: AppMapReturn.test.tsx に PremiumPaywallModal のモックを追加**

`src/app/__tests__/AppMapReturn.test.tsx` のモック群に追加する:

```ts
jest.mock('../components/PremiumPaywallModal', () => ({
  PremiumPaywallModal: () => null,
}));
```

- [ ] **Step 2: テストが現状で通ることを確認**

```bash
cd /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall
npx jest --testPathPattern="AppMapReturn" --no-coverage 2>&1 | tail -10
```

Expected: `Tests: XX passed`

- [ ] **Step 3: App.tsx にペイウォール state・ハンドラ・インポートを追加**

`src/app/App.tsx` で以下の変更を行う。

インポート追加（既存の import ブロックの末尾付近）:
```ts
import { PremiumPaywallModal } from './components/PremiumPaywallModal';
```

state 追加（`isPresentingPremiumCustomerCenter` の直後）:
```ts
const [isPremiumPaywallVisible, setIsPremiumPaywallVisible] = useState(false);
const isPremiumPaywallVisibleRef = useRef(false);
```

ハンドラ追加（`openPremiumCustomerCenter` の直後）:
```ts
function openPremiumPaywall(): void {
  if (isPremiumPaywallVisibleRef.current) {
    return;
  }
  isPremiumPaywallVisibleRef.current = true;
  setIsPremiumPaywallVisible(true);
}

function closePremiumPaywall(): void {
  isPremiumPaywallVisibleRef.current = false;
  setIsPremiumPaywallVisible(false);
}
```

- [ ] **Step 4: DailyLogDetailScreen に新 props を渡す**

App.tsx の DailyLogDetailScreen レンダリング箇所を変更:

```tsx
<DailyLogDetailScreen
  log={route.params.log}
  styles={styles}
  theme={theme}
  premiumAccessState={premiumAccessState}
  onBackToDailyLogs={() => navigation.goBack()}
  onOpenPremiumPaywall={openPremiumPaywall}
/>
```

- [ ] **Step 5: PremiumPaywallModal を App ルートにレンダリング**

`AchievementUnlockModal` の直後に追加:

```tsx
<PremiumPaywallModal
  visible={isPremiumPaywallVisible}
  styles={styles}
  theme={theme}
  premiumOfferingSummary={premiumOfferingSummary}
  isLoadingPremiumOffering={isLoadingPremiumOffering}
  isPurchasingPremiumPackage={isPurchasingPremiumPackage}
  isRestoringPremiumPurchases={isRestoringPremiumPurchases}
  onClose={closePremiumPaywall}
  onPurchaseMonthlyPremiumPackage={() => {
    purchasePremiumPackageFromSettings('monthly').catch(() => undefined);
  }}
  onPurchaseYearlyPremiumPackage={() => {
    purchasePremiumPackageFromSettings('yearly').catch(() => undefined);
  }}
  onRestorePremiumPurchases={() => {
    restorePurchasesFromSettings().catch(() => undefined);
  }}
/>
```

- [ ] **Step 6: テストを実行して通ることを確認**

```bash
cd /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall
npx jest --testPathPattern="AppMapReturn" --no-coverage 2>&1 | tail -10
```

Expected: `Tests: XX passed`

- [ ] **Step 7: Commit**

```bash
git -C /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall add src/app/App.tsx src/app/__tests__/AppMapReturn.test.tsx
git -C /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall commit -m "feat(premium): PremiumPaywallModal を App ルートに組み込む"
```

---

## Task 7: DailyLogDetailScreen を更新

**Files:**
- Modify: `src/app/components/DailyLogDetailScreen.tsx`
- Modify: `src/app/components/__tests__/DailyLogDetailScreen.test.tsx`

- [ ] **Step 1: テストを先に更新**

`src/app/components/__tests__/DailyLogDetailScreen.test.tsx` を以下のように更新する:

**モック追加**（既存の `jest.mock('@expo/vector-icons', ...)` を置き換え）:
```ts
jest.mock('@expo/vector-icons', () => ({
  Feather: require('react-native').Text,
  MaterialCommunityIcons: require('react-native').Text,
}));

jest.mock('expo-blur', () => ({
  BlurView: require('react-native').View,
}));
```

**ヘルパー props を追加**（`const log = {...}` の直後）:
```ts
const plusAccessState = { isPlusActive: true, entitlementId: 'Strollia Plus' };
const freeAccessState = { isPlusActive: false, entitlementId: 'Strollia Plus' };
const onOpenPremiumPaywall = jest.fn();
```

**既存テストに新 props を追加**（全ての `DailyLogDetailScreen` レンダリング箇所）:
```tsx
// 既存の全テストで以下のように props を追加する
<DailyLogDetailScreen
  log={log}
  styles={styles as never}
  theme={lightTheme}
  premiumAccessState={plusAccessState}
  onBackToDailyLogs={jest.fn()}
  onOpenPremiumPaywall={onOpenPremiumPaywall}
/>
```

**`ShareButton` → `ActionPill` への参照変更**:

`findByType(ShareButton)` を使っているテストを `findByProps({ accessibilityLabel: 'この日の記録を共有' })` に変更:

```ts
// 変更前:
const shareButton = renderer.root.findByType(ShareButton);
expect(shareButton.props.style).toBe('shareButtonWide');
expect(shareButton.props.textStyle).toBe('shareButtonWideText');

// 変更後:
const shareButton = renderer.root.findByProps({ accessibilityLabel: 'この日の記録を共有' });
expect(shareButton).toBeTruthy();
```

```ts
// 変更前:
const shareButton = renderer.root.findByType(ShareButton);
await act(async () => {
  shareButton.props.onPress();
});

// 変更後:
const shareButton = renderer.root.findByProps({ accessibilityLabel: 'この日の記録を共有' });
await act(async () => {
  shareButton.props.onPress();
});
```

```ts
// 変更前 (共有処理中テスト):
expect(renderer.root.findByType(ShareButton).props.disabled).toBeFalsy();
act(() => {
  renderer.root.findByType(ShareButton).props.onPress();
});
expect(renderer.root.findByType(ShareButton).props.disabled).toBe(true);
...
expect(renderer.root.findByType(ShareButton).props.disabled).toBeFalsy();

// 変更後:
expect(renderer.root.findByProps({ accessibilityLabel: 'この日の記録を共有' }).props.disabled).toBeFalsy();
act(() => {
  renderer.root.findByProps({ accessibilityLabel: 'この日の記録を共有' }).props.onPress();
});
expect(renderer.root.findByProps({ accessibilityLabel: 'この日の記録を共有' }).props.disabled).toBe(true);
...
expect(renderer.root.findByProps({ accessibilityLabel: 'この日の記録を共有' }).props.disabled).toBeFalsy();
```

**新しいテストケースを追加**（`describe` ブロックの末尾）:

```ts
test('Plusユーザーの場合はスライダー・訪問エリア・おもいでが表示される', async () => {
  let renderer: any;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={jest.fn()}
      />,
    );
  });

  await act(async () => {});

  const texts = renderer.root.findAllByType(Text).map((n: any) => n.props.children);
  expect(texts).toEqual(expect.arrayContaining(['おもいで', '訪問したエリア数', '新しく訪問したエリア数']));
  expect(renderer.root.findAllByType(StepSlider).length).toBeGreaterThan(0);
  expect(texts).not.toContain('Plusでもっと詳しく！');
});

test('一般ユーザーの場合はスライダー・訪問エリアが非表示でおもいでがブラーされる', async () => {
  let renderer: any;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={freeAccessState}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={jest.fn()}
      />,
    );
  });

  await act(async () => {});

  const texts = renderer.root.findAllByType(Text).map((n: any) => n.props.children);
  expect(renderer.root.findAllByType(StepSlider)).toHaveLength(0);
  expect(texts).not.toContain('訪問したエリア数');
  expect(texts).not.toContain('新しく訪問したエリア数');
  expect(texts).toEqual(expect.arrayContaining(['Plusでくわしく！']));
  expect(texts).toEqual(expect.arrayContaining(['Plusでもっと詳しく！']));
});

test('一般ユーザーの場合「移動距離は〜」テキストが「移動のデータ」タイトル直下に表示される', async () => {
  let renderer: any;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={freeAccessState}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={jest.fn()}
      />,
    );
  });

  await act(async () => {});

  const texts = renderer.root.findAllByType(Text).map((n: any) => n.props.children);
  expect(texts).toEqual(expect.arrayContaining(['移動距離はGPSのブレにより本来の距離より多く記録される場合があります。']));
});

test('一般ユーザーの場合「Plusでもっと詳しく！」ボタンを押すと onOpenPremiumPaywall が呼ばれる', async () => {
  const onOpen = jest.fn();
  let renderer: any;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={freeAccessState}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={onOpen}
      />,
    );
  });

  await act(async () => {});

  await act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Plusでもっと詳しく！' }).props.onPress();
  });

  expect(onOpen).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall
npx jest --testPathPattern="DailyLogDetailScreen" --no-coverage 2>&1 | tail -15
```

Expected: 複数テストが FAIL（新 props が存在しないため）

- [ ] **Step 3: DailyLogDetailScreen を実装**

`src/app/components/DailyLogDetailScreen.tsx` を以下のように全面更新する:

```tsx
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { getLocationPointAdminAreaName } from '../../features/achievements/adminAreaRepository';
import { getAchievementDefinition } from '../../features/achievements/achievementDefinitions';
import { getAchievementUnlocksByDate } from '../../features/achievements/achievementRepository';
import { coordinateToGridCell } from '../../features/location/grid/gridCell';
import { getVisitedCellsByIds } from '../../features/location/visitedCellRepository';
import { getLocationPointsByDate } from '../../features/logs/logRepository';
import { createDailyDetailReport, DailyDetailReport } from '../../features/reports/dailyReport';
import type { PremiumAccessState } from '../../features/premium/revenueCatAccess';
import type { AppTheme } from '../../theme/theme';
import type { DailyLogSummary, LocationPoint } from '../../types/gps';
import {
  computeRouteMaxEndMinutes,
  DAILY_ROUTE_START_MINUTES,
  DAILY_ROUTE_TIME_STEP_MINUTES,
  filterLocationPointsUntilMinute,
  formatTimelineHourLabel,
  formatTimelineTimeLabel,
  getCurrentMinutesOfDay,
  getTodayLocalDate,
} from '../dailyRouteTimeline';
import { formatDailyLogDetailTitle, formatDistanceKm, formatRouteEndpoints } from '../dailyLogDisplay';
import { totalDistanceMeters } from '../../utils/distance';
import type { AppStyles } from '../appStyles';
import { AchievementScroller } from './AchievementScroller';
import { ActionPill } from './ActionPill';
import { AppScreenHeader } from './AppScreenHeader';
import { DataSummaryRow } from './DataSummaryRow';
import { DescriptionText } from './DescriptionText';
import { RouteMapPanel } from './RouteMapPanel';
import { SectionTitle } from './SectionTitle';
import { StepSlider } from './StepSlider';

export type DailyLogDetailScreenProps = {
  /** 表示対象の日別サマリー。 */
  log: DailyLogSummary;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** Plus課金状態。 */
  premiumAccessState: PremiumAccessState;
  /** 日別ログ一覧へ戻る処理。 */
  onBackToDailyLogs: () => void;
  /** ペイウォールモーダルを開く処理。 */
  onOpenPremiumPaywall: () => void;
};

/** 日ごとの記録の詳細画面を描画する。 */
export function DailyLogDetailScreen({ log, styles, theme, premiumAccessState, onBackToDailyLogs, onOpenPremiumPaywall }: DailyLogDetailScreenProps) {
  const isPlusActive = premiumAccessState.isPlusActive;
  const [dailyPoints, setDailyPoints] = useState<LocationPoint[]>([]);
  const [dailyDetailReport, setDailyDetailReport] = useState<DailyDetailReport | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [routeEndpointsLabel, setRouteEndpointsLabel] = useState(formatRouteEndpoints());
  const [routeMaxMinutes, setRouteMaxMinutes] = useState(() =>
    computeRouteMaxEndMinutes(log.localDate, getTodayLocalDate(), getCurrentMinutesOfDay()),
  );
  const [routeEndMinutes, setRouteEndMinutes] = useState(() =>
    computeRouteMaxEndMinutes(log.localDate, getTodayLocalDate(), getCurrentMinutesOfDay()),
  );
  const [isSharingDetail, setIsSharingDetail] = useState(false);
  const [isSliderDragging, setIsSliderDragging] = useState(false);
  const captureViewRef = useRef<View>(null);
  const title = formatDailyLogDetailTitle(log.localDate);
  const distanceLabel = formatDistanceKm(log.distanceMeters ?? totalDistanceMeters(dailyPoints));
  const showSlider = isPlusActive && routeMaxMinutes >= DAILY_ROUTE_TIME_STEP_MINUTES;
  const visibleRoutePoints = useMemo(
    () => (showSlider ? filterLocationPointsUntilMinute(dailyPoints, routeEndMinutes) : dailyPoints),
    [dailyPoints, routeEndMinutes, showSlider],
  );

  useEffect(() => {
    let isCancelled = false;
    const maxMinutes = computeRouteMaxEndMinutes(log.localDate, getTodayLocalDate(), getCurrentMinutesOfDay());
    setRouteMaxMinutes(maxMinutes);

    async function loadDetail(): Promise<void> {
      setIsLoadingDetail(true);
      setRouteEndMinutes(maxMinutes);

      try {
        const points = await getLocationPointsByDate(log.localDate);
        const firstPoint = points[0] ?? null;
        const lastPoint = points.at(-1) ?? null;
        const cellIds = [...new Set(points.map((point) => coordinateToGridCell(point).cellId))];
        const [visitedCells, achievementUnlocks, startArea, endArea] = await Promise.all([
          getVisitedCellsByIds(cellIds),
          getAchievementUnlocksByDate(log.localDate),
          firstPoint ? getLocationPointAdminAreaName(firstPoint.id) : Promise.resolve(null),
          lastPoint ? getLocationPointAdminAreaName(lastPoint.id) : Promise.resolve(null),
        ]);
        const unlockedAchievements = achievementUnlocks.flatMap((unlock) => {
          const definition = getAchievementDefinition(unlock.achievementId);
          return definition
            ? [{ id: definition.id, title: definition.title, unlockedAt: unlock.unlockedAt, trophyImage: definition.trophyImage }]
            : [];
        });
        const report = createDailyDetailReport({ localDate: log.localDate, points, visitedCells, unlockedAchievements });

        if (!isCancelled) {
          setDailyPoints(points);
          setDailyDetailReport(report);
          setRouteEndpointsLabel(formatRouteEndpoints(startArea?.areaName, endArea?.areaName));
        }
      } catch {
        if (!isCancelled) {
          setDailyPoints([]);
          setDailyDetailReport(null);
          setRouteEndpointsLabel(formatRouteEndpoints());
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingDetail(false);
        }
      }
    }

    loadDetail().catch(() => undefined);

    return () => {
      isCancelled = true;
    };
  }, [log]);

  async function shareDailyLogImage(): Promise<void> {
    if (!captureViewRef.current || isSharingDetail) {
      return;
    }

    setIsSharingDetail(true);

    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('共有できません', 'この環境では共有シートを利用できません。');
        return;
      }

      const uri = await captureRef(captureViewRef.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      await Sharing.shareAsync(uri, {
        dialogTitle: `すとろりあ 日別記録 ${title.subtitle}${title.title}`,
        mimeType: 'image/png',
        UTI: 'public.png',
      });
    } catch (error: unknown) {
      Alert.alert('共有失敗', error instanceof Error ? error.message : 'この日の記録を共有できませんでした。');
    } finally {
      setIsSharingDetail(false);
    }
  }

  return (
    <SafeAreaView style={styles.appScreen}>
      <AppScreenHeader backLabel="日ごとの記録" styles={styles} theme={theme} title={title.title} subtitle={title.subtitle} onBack={onBackToDailyLogs} />
      <ScrollView scrollEnabled={!isSliderDragging} contentContainerStyle={styles.dailyLogDetailContent}>

        {/* キャプチャ範囲 */}
        <View ref={captureViewRef} collapsable={false} style={[styles.dailyLogDetailCapture, { backgroundColor: theme.colors.background }]}>
          <View style={styles.routeTimeline}>
            <RouteMapPanel emptyLabel="移動地図を表示できません" points={visibleRoutePoints} regionPoints={dailyPoints} styles={styles} theme={theme} />
            {showSlider && (
              <StepSlider
                accessibilityLabel="移動地図の表示時刻"
                minValue={DAILY_ROUTE_START_MINUTES}
                maxValue={routeMaxMinutes}
                stepValue={DAILY_ROUTE_TIME_STEP_MINUTES}
                startLabel={formatTimelineHourLabel(DAILY_ROUTE_START_MINUTES)}
                endLabel={routeMaxMinutes % 60 === 0 ? formatTimelineHourLabel(routeMaxMinutes) : formatTimelineTimeLabel(routeMaxMinutes)}
                value={routeEndMinutes}
                valueLabel={formatTimelineTimeLabel(routeEndMinutes)}
                styles={styles}
                theme={theme}
                onDragStart={() => setIsSliderDragging(true)}
                onDragEnd={() => setIsSliderDragging(false)}
                onValueChange={setRouteEndMinutes}
              />
            )}
          </View>

          <View style={styles.dailyLogDetailSection}>
            <SectionTitle styles={styles}>移動のデータ</SectionTitle>
            {!isPlusActive && (
              <DescriptionText styles={styles}>移動距離はGPSのブレにより本来の距離より多く記録される場合があります。</DescriptionText>
            )}
            <View style={styles.dataSummaryList}>
              <DataSummaryRow label="移動距離" value={distanceLabel} styles={styles} />
              <DataSummaryRow label="開始地点と終了地点" value={routeEndpointsLabel} styles={styles} />
              {isPlusActive && (
                <>
                  <DataSummaryRow label="訪問したエリア数" value={`${dailyDetailReport?.visitedAreaCount ?? 0}エリア`} styles={styles} />
                  <DataSummaryRow label="新しく訪問したエリア数" value={`${dailyDetailReport?.newAreaCount ?? 0}エリア`} styles={styles} />
                </>
              )}
            </View>
            {isPlusActive && (
              <DescriptionText styles={styles}>移動距離はGPSのブレにより本来の距離より多く記録される場合があります。</DescriptionText>
            )}
          </View>

          {isPlusActive && (
            <View style={styles.dailyLogDetailSection}>
              <SectionTitle styles={styles}>おもいで</SectionTitle>
              <Text style={styles.dailyLogDetailSubTitle}>{isLoadingDetail ? 'この日に獲得した実績を読み込み中' : 'この日に獲得した実績'}</Text>
              <AchievementScroller achievements={dailyDetailReport?.unlockedAchievements ?? []} styles={styles} />
            </View>
          )}
        </View>

        {/* ブラーセクション（一般ユーザーのみ、キャプチャ範囲外） */}
        {!isPlusActive && (
          <View style={[styles.dailyLogDetailSection, styles.dailyLogDetailPlusSection]}>
            <SectionTitle styles={styles}>おもいで</SectionTitle>
            <Text style={styles.dailyLogDetailSubTitle}>{isLoadingDetail ? 'この日に獲得した実績を読み込み中' : 'この日に獲得した実績'}</Text>
            <AchievementScroller achievements={dailyDetailReport?.unlockedAchievements ?? []} styles={styles} />
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, lockedOverlayStyles.overlay]}>
              <Text style={styles.dailyLogDetailPlusLabel}>Plusでくわしく！</Text>
            </View>
          </View>
        )}

        {/* アクションボタン群（キャプチャ範囲外） */}
        <View style={styles.dailyLogDetailActions}>
          <ActionPill
            accessibilityLabel="この日の記録を共有"
            disabled={isSharingDetail}
            icon={<Feather name="share-2" size={20} color={theme.colors.text} />}
            label="この日の記録を共有"
            styles={styles}
            onPress={() => {
              shareDailyLogImage().catch(() => undefined);
            }}
          />
          {!isPlusActive && (
            <>
              <ActionPill
                accessibilityLabel="Plusでもっと詳しく！"
                backgroundColor={theme.name === 'dark' ? 'rgba(115, 199, 162, 0.08)' : 'rgba(31, 122, 92, 0.08)'}
                borderColor={theme.colors.primary}
                icon={<MaterialCommunityIcons name="chevron-right" size={21} color={theme.colors.primary} />}
                label="Plusでもっと詳しく！"
                styles={styles}
                textColor={theme.colors.primary}
                onPress={onOpenPremiumPaywall}
              />
              <DescriptionText styles={styles}>移動軌跡を時系列でふりかえられたり、獲得した実績、エリア数などもみることができます！</DescriptionText>
            </>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const lockedOverlayStyles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

（`ActionPill` への `accessibilityLabel` prop 追加は Task 2 で対応済み。）

- [ ] **Step 4: テストを実行して通ることを確認**

```bash
cd /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall
npx jest --testPathPattern="DailyLogDetailScreen" --no-coverage 2>&1 | tail -15
```

Expected: 全テスト PASS

- [ ] **Step 5: 全テストを実行して回帰がないことを確認**

```bash
cd /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall
npx jest --no-coverage 2>&1 | tail -15
```

Expected: 全テスト PASS

- [ ] **Step 6: Commit**

```bash
git -C /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall add \
  src/app/components/DailyLogDetailScreen.tsx \
  src/app/components/ActionPill.tsx \
  src/app/components/__tests__/DailyLogDetailScreen.test.tsx
git -C /Users/kazuki19992/gits/footspot/.worktrees/daily-log-plus-paywall commit -m "feat(daily-log): Plus限定コンテンツのマスキングとペイウォールボタンを追加"
```
