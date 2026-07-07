import { Linking, Modal, Text } from 'react-native';
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('visible=true のとき Modal が表示される', async () => {
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(<PremiumPaywallModal {...baseProps} visible={true} />);
    });
    expect(renderer.root.findByType(Modal).props.visible).toBe(true);
  });

  test('visible=false のとき Modal が非表示になる', async () => {
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(<PremiumPaywallModal {...baseProps} visible={false} />);
    });
    expect(renderer.root.findByType(Modal).props.visible).toBe(false);
  });

  test('閉じるボタンを押すと onClose が呼ばれる', async () => {
    const onClose = jest.fn();
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(<PremiumPaywallModal {...baseProps} onClose={onClose} />);
    });
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: 'ペイウォールを閉じる' }).props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('月払いボタンを押すと onPurchaseMonthlyPremiumPackage が呼ばれる', async () => {
    const onPurchase = jest.fn();
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(<PremiumPaywallModal {...baseProps} onPurchaseMonthlyPremiumPackage={onPurchase} />);
    });
    const pills = renderer.root.findAllByType(ActionPill);
    const monthlyPill = pills.find((p: any) => p.props.label?.includes('月額300円'));
    act(() => {
      monthlyPill.props.onPress();
    });
    expect(onPurchase).toHaveBeenCalledTimes(1);
  });

  test('年払いボタンを押すと onPurchaseYearlyPremiumPackage が呼ばれる', async () => {
    const onPurchase = jest.fn();
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(<PremiumPaywallModal {...baseProps} onPurchaseYearlyPremiumPackage={onPurchase} />);
    });
    const pills = renderer.root.findAllByType(ActionPill);
    const yearlyPill = pills.find((p: any) => p.props.label?.includes('年額3300円'));
    act(() => {
      yearlyPill.props.onPress();
    });
    expect(onPurchase).toHaveBeenCalledTimes(1);
  });

  test('購入復元ボタンを押すと onRestorePremiumPurchases が呼ばれる', async () => {
    const onRestore = jest.fn();
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(<PremiumPaywallModal {...baseProps} onRestorePremiumPurchases={onRestore} />);
    });
    const pills = renderer.root.findAllByType(ActionPill);
    const restorePill = pills.find((p: any) => p.props.label?.includes('復元'));
    act(() => {
      restorePill.props.onPress();
    });
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  test('購入ボタンは固定の月額300円・年額3300円を表示する', async () => {
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(<PremiumPaywallModal {...baseProps} />);
    });
    const pills = renderer.root.findAllByType(ActionPill);
    const labels = pills.map((p: any) => p.props.label);
    expect(labels.some((l: string) => l?.includes('月額300円'))).toBe(true);
    expect(labels.some((l: string) => l?.includes('年額3300円'))).toBe(true);
  });

  test('Strollia Plusの機能比較広告画像を表示する', async () => {
    await act(async () => {
      ReactTestRenderer.create(<PremiumPaywallModal {...baseProps} />);
    });

    expect(mockPlusAdImage).toHaveBeenCalledWith(
      expect.objectContaining({
        accessibilityLabel: 'Strollia Plusの機能比較広告',
        width: '100%',
      }),
    );
  });

  test('isPurchasingPremiumPackage=true のとき購入ボタンが無効化される', async () => {
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(<PremiumPaywallModal {...baseProps} isPurchasingPremiumPackage={true} />);
    });
    const pills = renderer.root.findAllByType(ActionPill);
    const buyPills = pills.filter((p: any) => p.props.label?.includes('購入処理中'));
    expect(buyPills.length).toBeGreaterThanOrEqual(2);
  });

  test('isLoadingPremiumOffering=true のとき商品情報読み込み中テキストを表示する', async () => {
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(<PremiumPaywallModal {...baseProps} isLoadingPremiumOffering={true} />);
    });
    const texts = renderer.root.findAllByType(Text).map((n: any) => n.props.children);
    expect(texts).toContain('商品情報を確認しています...');
  });

  test('isRestoringPremiumPurchases=true のとき購入復元ボタンが無効化される', async () => {
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(<PremiumPaywallModal {...baseProps} isRestoringPremiumPurchases={true} />);
    });
    const pills = renderer.root.findAllByType(ActionPill);
    const restorePill = pills.find((p: any) => p.props.label?.includes('復元'));
    expect(restorePill.props.disabled).toBe(true);
  });

  test('自動更新サブスクの定型開示文を表示する（App Store 3.1.2 対応）', async () => {
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(<PremiumPaywallModal {...baseProps} />);
    });
    const texts = renderer.root.findAllByType(Text).map((n: any) => n.props.children);
    const disclosure = texts.find((t: any) => typeof t === 'string' && t.includes('自動更新'));
    expect(disclosure).toBeDefined();
    expect(disclosure).toContain('自動的に更新');
    expect(disclosure).toContain('解約');
  });

  test('利用規約とプライバシーポリシーのリンクをそれぞれ開ける', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(<PremiumPaywallModal {...baseProps} />);
    });

    act(() => {
      renderer.root.findByProps({ accessibilityLabel: '利用規約を開く' }).props.onPress();
    });
    expect(openURL).toHaveBeenCalledWith(TERMS_OF_SERVICE_URL);

    act(() => {
      renderer.root.findByProps({ accessibilityLabel: 'プライバシーポリシーを開く' }).props.onPress();
    });
    expect(openURL).toHaveBeenCalledWith(PRIVACY_POLICY_URL);

    openURL.mockRestore();
  });
});
