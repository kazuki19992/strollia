import { Linking, Modal } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

import { lightTheme } from '@/theme/theme';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/config/legalLinks';
import { PremiumPaywallModal } from '@/ui/components/PremiumPaywallModal';
import { ActionPill } from '@/ui/components/ActionPill';

jest.mock('@expo/vector-icons', () => ({
  Feather: require('react-native').Text,
  MaterialCommunityIcons: require('react-native').Text,
}));

const mockPlusAdImage = jest.fn((_props: any) => null);

jest.mock('@/ui/components/PlusAdImage', () => ({
  PlusAdImage: (props: any) => mockPlusAdImage(props),
}));

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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('visible=true のとき Modal が表示される', async () => {
    render(<PremiumPaywallModal {...baseProps} visible={true} />);
    await act(async () => {
      await Promise.resolve();
    });

    // Modal の visible props を確認するために UNSAFE_getByType を使う
    // RTL のセマンティッククエリでは Modal の visible 属性が検証できないため
    const modal = screen.UNSAFE_getByType(Modal);
    expect(modal.props.visible).toBe(true);
  });

  test('visible=false のとき Modal が非表示になる', async () => {
    render(<PremiumPaywallModal {...baseProps} visible={false} />);
    await act(async () => {
      await Promise.resolve();
    });

    const modal = screen.UNSAFE_getByType(Modal);
    expect(modal.props.visible).toBe(false);
  });

  test('閉じるボタンを押すと onClose が呼ばれる', async () => {
    const onClose = jest.fn();
    render(<PremiumPaywallModal {...baseProps} onClose={onClose} />);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      fireEvent.press(screen.getByLabelText('ペイウォールを閉じる'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('月払いボタンを押すと onPurchaseMonthlyPremiumPackage が呼ばれる', async () => {
    const onPurchase = jest.fn();
    render(<PremiumPaywallModal {...baseProps} onPurchaseMonthlyPremiumPackage={onPurchase} />);
    await act(async () => {
      await Promise.resolve();
    });

    // ActionPill の label を確認するために UNSAFE_getAllByType を使う
    // ActionPill は RTL のセマンティッククエリで直接取得できないため
    const pills = screen.UNSAFE_getAllByType(ActionPill);
    const monthlyPill = pills.find((p) => p.props.label?.includes('月額300円'));
    act(() => {
      monthlyPill!.props.onPress();
    });
    expect(onPurchase).toHaveBeenCalledTimes(1);
  });

  test('年払いボタンを押すと onPurchaseYearlyPremiumPackage が呼ばれる', async () => {
    const onPurchase = jest.fn();
    render(<PremiumPaywallModal {...baseProps} onPurchaseYearlyPremiumPackage={onPurchase} />);
    await act(async () => {
      await Promise.resolve();
    });

    const pills = screen.UNSAFE_getAllByType(ActionPill);
    const yearlyPill = pills.find((p) => p.props.label?.includes('年額3300円'));
    act(() => {
      yearlyPill!.props.onPress();
    });
    expect(onPurchase).toHaveBeenCalledTimes(1);
  });

  test('購入復元ボタンを押すと onRestorePremiumPurchases が呼ばれる', async () => {
    const onRestore = jest.fn();
    render(<PremiumPaywallModal {...baseProps} onRestorePremiumPurchases={onRestore} />);
    await act(async () => {
      await Promise.resolve();
    });

    const pills = screen.UNSAFE_getAllByType(ActionPill);
    const restorePill = pills.find((p) => p.props.label?.includes('復元'));
    act(() => {
      restorePill!.props.onPress();
    });
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  test('購入ボタンは固定の月額300円・年額3300円を表示する', async () => {
    render(<PremiumPaywallModal {...baseProps} />);
    await act(async () => {
      await Promise.resolve();
    });

    const pills = screen.UNSAFE_getAllByType(ActionPill);
    const labels = pills.map((p) => p.props.label);
    expect(labels.some((l: string) => l?.includes('月額300円'))).toBe(true);
    expect(labels.some((l: string) => l?.includes('年額3300円'))).toBe(true);
  });

  test('Strollia Plusの機能比較広告画像を表示する', async () => {
    render(<PremiumPaywallModal {...baseProps} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockPlusAdImage).toHaveBeenCalledWith(
      expect.objectContaining({
        accessibilityLabel: 'Strollia Plusの機能比較広告',
        width: '100%',
      }),
    );
  });

  test('isPurchasingPremiumPackage=true のとき購入ボタンが無効化される', async () => {
    render(<PremiumPaywallModal {...baseProps} isPurchasingPremiumPackage={true} />);
    await act(async () => {
      await Promise.resolve();
    });

    const pills = screen.UNSAFE_getAllByType(ActionPill);
    const buyPills = pills.filter((p) => p.props.label?.includes('購入処理中'));
    expect(buyPills.length).toBeGreaterThanOrEqual(2);
  });

  test('isLoadingPremiumOffering=true のとき商品情報読み込み中テキストを表示する', async () => {
    render(<PremiumPaywallModal {...baseProps} isLoadingPremiumOffering={true} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('商品情報を確認しています...')).toBeTruthy();
  });

  test('isRestoringPremiumPurchases=true のとき購入復元ボタンが無効化される', async () => {
    render(<PremiumPaywallModal {...baseProps} isRestoringPremiumPurchases={true} />);
    await act(async () => {
      await Promise.resolve();
    });

    const pills = screen.UNSAFE_getAllByType(ActionPill);
    const restorePill = pills.find((p) => p.props.label?.includes('復元'));
    expect(restorePill!.props.disabled).toBe(true);
  });

  test('自動更新サブスクの定型開示文を表示する（App Store 3.1.2 対応）', async () => {
    render(<PremiumPaywallModal {...baseProps} />);
    await act(async () => {
      await Promise.resolve();
    });

    // 複数のテキスト要素を走査して自動更新を含む文を探す
    // UNSAFE_getAllByType を使うのは特定の文字列を含むテキストを検索するため
    const { Text } = require('react-native');
    const textNodes = screen.UNSAFE_getAllByType(Text);
    const disclosure = textNodes
      .map((node) => node.props.children)
      .find((t: any) => typeof t === 'string' && t.includes('自動更新'));
    expect(disclosure).toBeDefined();
    expect(disclosure).toContain('自動的に更新');
    expect(disclosure).toContain('解約');
  });

  test('利用規約とプライバシーポリシーのリンクをそれぞれ開ける', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    render(<PremiumPaywallModal {...baseProps} />);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      fireEvent.press(screen.getByLabelText('利用規約を開く'));
    });
    expect(openURL).toHaveBeenCalledWith(TERMS_OF_SERVICE_URL);

    act(() => {
      fireEvent.press(screen.getByLabelText('プライバシーポリシーを開く'));
    });
    expect(openURL).toHaveBeenCalledWith(PRIVACY_POLICY_URL);

    openURL.mockRestore();
  });
});
