import { Linking } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

import { lightTheme } from '@/theme/theme';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/config/legalLinks';
import { PremiumPaywallModal } from '@/ui/components/PremiumPaywallModal';

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
    await render(<PremiumPaywallModal {...baseProps} visible={true} />);
    await act(async () => {
      await Promise.resolve();
    });

    // RTL のセマンティッククエリでは Modal の visible 属性が検証できないため、ホスト要素の型で取得する
    const modals = screen.container.queryAll((node) => node.type === 'Modal');
    expect(modals).toHaveLength(1);
    expect(modals[0].props.visible).toBe(true);
    expect(screen.getByLabelText('ペイウォールを閉じる')).toBeTruthy();
  });

  test('visible=false のとき Modal が非表示になる', async () => {
    await render(<PremiumPaywallModal {...baseProps} visible={false} />);
    await act(async () => {
      await Promise.resolve();
    });

    // visible=false の Modal はホスト要素も中身も描画されない
    expect(screen.container.queryAll((node) => node.type === 'Modal')).toHaveLength(0);
    expect(screen.queryByLabelText('ペイウォールを閉じる')).toBeNull();
  });

  test('閉じるボタンを押すと onClose が呼ばれる', async () => {
    const onClose = jest.fn();
    await render(<PremiumPaywallModal {...baseProps} onClose={onClose} />);
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await fireEvent.press(screen.getByLabelText('ペイウォールを閉じる'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('月払いボタンを押すと onPurchaseMonthlyPremiumPackage が呼ばれる', async () => {
    const onPurchase = jest.fn();
    await render(<PremiumPaywallModal {...baseProps} onPurchaseMonthlyPremiumPackage={onPurchase} />);
    await act(async () => {
      await Promise.resolve();
    });

    // ActionPill は label をアクセシビリティラベルに使うため、ラベルで取得して押下する
    await fireEvent.press(screen.getByLabelText(/月額300円/));
    expect(onPurchase).toHaveBeenCalledTimes(1);
  });

  test('年払いボタンを押すと onPurchaseYearlyPremiumPackage が呼ばれる', async () => {
    const onPurchase = jest.fn();
    await render(<PremiumPaywallModal {...baseProps} onPurchaseYearlyPremiumPackage={onPurchase} />);
    await act(async () => {
      await Promise.resolve();
    });

    await fireEvent.press(screen.getByLabelText(/年額3300円/));
    expect(onPurchase).toHaveBeenCalledTimes(1);
  });

  test('購入復元ボタンを押すと onRestorePremiumPurchases が呼ばれる', async () => {
    const onRestore = jest.fn();
    await render(<PremiumPaywallModal {...baseProps} onRestorePremiumPurchases={onRestore} />);
    await act(async () => {
      await Promise.resolve();
    });

    await fireEvent.press(screen.getByLabelText(/復元/));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  test('購入ボタンは固定の月額300円・年額3300円を表示する', async () => {
    await render(<PremiumPaywallModal {...baseProps} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: /月額300円/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /年額3300円/ })).toBeTruthy();
  });

  test('Strollia Plusの機能比較広告画像を表示する', async () => {
    await render(<PremiumPaywallModal {...baseProps} />);
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
    await render(<PremiumPaywallModal {...baseProps} isPurchasingPremiumPackage={true} />);
    await act(async () => {
      await Promise.resolve();
    });

    const buyPills = screen.getAllByRole('button', { name: /購入処理中/ });
    expect(buyPills.length).toBeGreaterThanOrEqual(2);
    buyPills.forEach((pill) => expect(pill).toBeDisabled());
  });

  test('isLoadingPremiumOffering=true のとき商品情報読み込み中テキストを表示する', async () => {
    await render(<PremiumPaywallModal {...baseProps} isLoadingPremiumOffering={true} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('商品情報を確認しています...')).toBeTruthy();
  });

  test('isRestoringPremiumPurchases=true のとき購入復元ボタンが無効化される', async () => {
    await render(<PremiumPaywallModal {...baseProps} isRestoringPremiumPurchases={true} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: /復元/ })).toBeDisabled();
  });

  test('自動更新サブスクの定型開示文を表示する（App Store 3.1.2 対応）', async () => {
    await render(<PremiumPaywallModal {...baseProps} />);
    await act(async () => {
      await Promise.resolve();
    });

    // 複数のテキスト要素を走査して自動更新を含む文を探す
    // 特定の文字列を含むテキストを検索するため Text ホスト要素を走査する
    const textNodes = screen.container.queryAll((node) => node.type === 'Text');
    const disclosure = textNodes.map((node) => node.props.children).find((t: any) => typeof t === 'string' && t.includes('自動更新'));
    expect(disclosure).toBeDefined();
    expect(disclosure).toContain('自動的に更新');
    expect(disclosure).toContain('解約');
  });

  test('利用規約とプライバシーポリシーのリンクをそれぞれ開ける', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    await render(<PremiumPaywallModal {...baseProps} />);
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await fireEvent.press(screen.getByLabelText('利用規約を開く'));
    });
    expect(openURL).toHaveBeenCalledWith(TERMS_OF_SERVICE_URL);

    await act(async () => {
      await fireEvent.press(screen.getByLabelText('プライバシーポリシーを開く'));
    });
    expect(openURL).toHaveBeenCalledWith(PRIVACY_POLICY_URL);

    openURL.mockRestore();
  });
});
