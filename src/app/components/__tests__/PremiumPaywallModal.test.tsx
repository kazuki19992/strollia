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
      renderer = ReactTestRenderer.create(
        <PremiumPaywallModal {...baseProps} onPurchaseMonthlyPremiumPackage={onPurchase} />,
      );
    });
    const pills = renderer.root.findAllByType(ActionPill);
    const monthlyPill = pills.find((p: any) => p.props.label?.includes('月払い'));
    act(() => { monthlyPill.props.onPress(); });
    expect(onPurchase).toHaveBeenCalledTimes(1);
  });

  test('年払いボタンを押すと onPurchaseYearlyPremiumPackage が呼ばれる', async () => {
    const onPurchase = jest.fn();
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <PremiumPaywallModal {...baseProps} onPurchaseYearlyPremiumPackage={onPurchase} />,
      );
    });
    const pills = renderer.root.findAllByType(ActionPill);
    const yearlyPill = pills.find((p: any) => p.props.label?.includes('年払い'));
    act(() => { yearlyPill.props.onPress(); });
    expect(onPurchase).toHaveBeenCalledTimes(1);
  });

  test('購入復元ボタンを押すと onRestorePremiumPurchases が呼ばれる', async () => {
    const onRestore = jest.fn();
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <PremiumPaywallModal {...baseProps} onRestorePremiumPurchases={onRestore} />,
      );
    });
    const pills = renderer.root.findAllByType(ActionPill);
    const restorePill = pills.find((p: any) => p.props.label?.includes('復元'));
    act(() => { restorePill.props.onPress(); });
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  test('premiumOfferingSummary がある場合は実際の価格を表示する', async () => {
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(
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
    });
    const texts = renderer.root.findAllByType(Text).map((n: any) => n.props.children);
    expect(texts.some((t: any) => typeof t === 'string' && t.includes('¥300'))).toBe(true);
    expect(texts.some((t: any) => typeof t === 'string' && t.includes('¥3,300'))).toBe(true);
  });

  test('isPurchasingPremiumPackage=true のとき購入ボタンが無効化される', async () => {
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <PremiumPaywallModal {...baseProps} isPurchasingPremiumPackage={true} />,
      );
    });
    const pills = renderer.root.findAllByType(ActionPill);
    const buyPills = pills.filter((p: any) => p.props.label?.includes('購入処理中'));
    expect(buyPills.length).toBeGreaterThanOrEqual(2);
  });
});
