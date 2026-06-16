import { Image, StyleSheet, Text } from 'react-native';
import { AppColorPresetId } from '../../../features/customization/colorPresets';

import { darkTheme, lightTheme } from '../../../theme/theme';
import { getDefaultPremiumAccessState, PremiumOfferingSummary } from '../../../features/premium/revenueCatAccess';
import { DEFAULT_USER_LOCATION_ICON_ID } from '../../../features/customization/customizationOptions';
import { createStyles } from '../../appStyles';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');

  return {
    Feather: Text,
    MaterialCommunityIcons: Text,
  };
});

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: View,
    SvgXml: View,
  };
});

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
}));


import { SettingsScreen, getSubscriptionStoreName } from '../SettingsScreen';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const styles = new Proxy(
  {},
  {
    get: () => ({}),
  },
);

/** テスト用にstyle配列を単一オブジェクトへ畳み込む。 */
function flattenStyle(style: unknown): Record<string, unknown> {
  return (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
}

/** 設定画面テスト用の既定propsを作る。 */
function createProps() {
  return {
    styles: styles as never,
    theme: lightTheme,
    isRecording: true,
    autoStartStatus: 'recording' as const,
    hasRequiredPermission: true,
    shouldOpenSettingsForPermission: false,
    isWhileInUseOnlyMode: false,
    keepScreenAwake: false,
    mapType: 'standard' as const,
    showPhotosOnMap: false,
    isUpdatingPhotoSetting: false,
    isImportingGpx: false,
    premiumAccessState: getDefaultPremiumAccessState(),
    revenueCatAppUserId: null as string | null,
    premiumOfferingSummary: null as PremiumOfferingSummary | null,
    isLoadingPremiumOffering: false,
    isPurchasingPremiumPackage: false,
    isPresentingPremiumCustomerCenter: false,
    isRestoringPremiumPurchases: false,
    selectedUserLocationIconId: DEFAULT_USER_LOCATION_ICON_ID,
    onBackToMap: jest.fn(),
    onStartRecording: jest.fn(),
    onRequestLocationPermission: jest.fn(),
    onOpenLocationSettings: jest.fn(),
    onUpdateKeepScreenAwake: jest.fn().mockResolvedValue(undefined),
    onToggleMapType: jest.fn(),
    onUpdateShowPhotosOnMap: jest.fn().mockResolvedValue(undefined),
    onUpdateUserLocationIcon: jest.fn(),
    selectedAppColorPresetId: 'matcha' as AppColorPresetId,
    onUpdateAppColorPreset: jest.fn(),
    onOpenAboutAppScreen: jest.fn(),
    onOpenFirstLaunchTutorial: jest.fn(),
    onOpenLicenseScreen: jest.fn(),
    onOpenTermsOfService: jest.fn(),
    onOpenPrivacyPolicy: jest.fn(),
    onOpenSpecifiedCommercialTransactionAct: jest.fn(),
    onPurchaseMonthlyPremiumPackage: jest.fn(),
    onPurchaseYearlyPremiumPackage: jest.fn(),
    onPresentPremiumCustomerCenter: jest.fn(),
    onRestorePremiumPurchases: jest.fn(),
    onExportAllLogs: jest.fn(),
    onImportGpx: jest.fn(),
    onDeleteAllData: jest.fn(),
  };
}

describe('設定画面 SettingsScreen', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('GPS記録とデータ操作の項目を表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...createProps()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('GPS記録中!');
    expect(texts).toContain('あなたの位置情報はすとろりあがしっかりと記録しています！\n冒険にでかけましょう！');
    expect(texts).toContain('GPXファイルのエクスポート');
  });

  test('このアプリについての下にチュートリアルを表示して開ける', () => {
    const props = createProps();
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    const aboutIndex = texts.indexOf('このアプリについて');
    const tutorialIndex = texts.indexOf('チュートリアル');
    const licenseIndex = texts.indexOf('オープンソースライセンス');

    expect(aboutIndex).toBeGreaterThanOrEqual(0);
    expect(tutorialIndex).toBeGreaterThanOrEqual(0);
    expect(licenseIndex).toBeGreaterThanOrEqual(0);
    expect(aboutIndex).toBeLessThan(tutorialIndex);
    expect(tutorialIndex).toBeLessThan(licenseIndex);

    const aboutButton = renderer.root.findAll((node: any) => node.props.onPress === props.onOpenAboutAppScreen)[0];
    const tutorialButton = renderer.root.findAll((node: any) => node.props.onPress === props.onOpenFirstLaunchTutorial)[0];

    act(() => {
      aboutButton.props.onPress();
      tutorialButton.props.onPress();
    });

    expect(props.onOpenAboutAppScreen).toHaveBeenCalledTimes(1);
    expect(props.onOpenFirstLaunchTutorial).toHaveBeenCalledTimes(1);
  });

  test('ダークモードでもGPS正常パネルはライトモードと同じ白文字で表示する', () => {
    const props = { ...createProps(), styles: createStyles(darkTheme), theme: darkTheme };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const title = renderer.root.findAllByType(Text).find((node: any) => node.props.children === 'GPS記録中!');
    const description = renderer.root.findAllByType(Text).find((node: any) => node.props.children === 'あなたの位置情報はすとろりあがしっかりと記録しています！\n冒険にでかけましょう！');

    expect(flattenStyle(title?.props.style).color).toBe('#ffffff');
    expect(flattenStyle(description?.props.style).color).toBe('#ffffff');
  });

  test('GPSパネルの背景色はライトモードとダークモードで変えない', () => {
    const lightStyles = createStyles(lightTheme);
    const darkStyles = createStyles(darkTheme);

    expect(flattenStyle(lightStyles.settingsGpsPanelActive).backgroundColor).toBe('#00b035');
    expect(flattenStyle(darkStyles.settingsGpsPanelActive).backgroundColor).toBe('#00b035');
    expect(flattenStyle(lightStyles.settingsGpsPanelDanger).backgroundColor).toBe('#b0002f');
    expect(flattenStyle(darkStyles.settingsGpsPanelDanger).backgroundColor).toBe('#b0002f');
    expect(flattenStyle(lightStyles.settingsGpsPanelWarning).backgroundColor).toBe('#a36100');
    expect(flattenStyle(darkStyles.settingsGpsPanelWarning).backgroundColor).toBe('#a36100');
  });

  test('アプリ起動中のみ記録モードでは専用パネルを表示し、ボタンでOS設定を開く', () => {
    const props = {
      ...createProps(),
      hasRequiredPermission: false,
      isWhileInUseOnlyMode: true,
    };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('アプリ起動中のみ記録');
    expect(texts).toContain('アプリが起動しているときのみ記録します。\n常に記録したいときは設定画面で変更してください。');
    // 「位置情報の許可が必要です」エラーパネルは出さない
    expect(texts).not.toContain('位置情報の許可が必要です');

    const button = renderer.root.findAll((node: any) => node.props.onPress === props.onOpenLocationSettings)[0];
    expect(button).toBeDefined();
    act(() => { button.props.onPress(); });
    expect(props.onOpenLocationSettings).toHaveBeenCalledTimes(1);
  });

  test('ダークモードでもGPS操作ボタンはライトモードと同じ白背景で表示する', () => {
    const permissionProps = {
      ...createProps(),
      styles: createStyles(darkTheme),
      theme: darkTheme,
      hasRequiredPermission: false,
    };
    const failedProps = {
      ...createProps(),
      styles: createStyles(darkTheme),
      theme: darkTheme,
      isRecording: false,
      autoStartStatus: 'failed' as const,
    };
    let permissionRenderer: any;
    let failedRenderer: any;

    act(() => {
      permissionRenderer = ReactTestRenderer.create(<SettingsScreen {...permissionProps} />);
      failedRenderer = ReactTestRenderer.create(<SettingsScreen {...failedProps} />);
    });

    const permissionButton = permissionRenderer.root.findAll((node: any) => node.props.onPress === permissionProps.onRequestLocationPermission)[0];
    const failedButton = failedRenderer.root.findAll((node: any) => node.props.onPress === failedProps.onStartRecording)[0];
    const permissionText = permissionRenderer.root.findAllByType(Text).find((node: any) => node.props.children === '続ける');
    const failedText = failedRenderer.root.findAllByType(Text).find((node: any) => node.props.children === 'GPSの記録を開始する');

    expect(flattenStyle(permissionButton.props.style).backgroundColor).toBe('#ffffff');
    expect(flattenStyle(failedButton.props.style).backgroundColor).toBe('#ffffff');
    expect(flattenStyle(permissionText?.props.style).color).toBe('#b0002f');
    expect(flattenStyle(failedText?.props.style).color).toBe('#a36100');
  });

  test('選択項目の設定中ラベルは表示しない', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...createProps()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children).filter((text: unknown) => typeof text === 'string');

    expect(texts.some((text: string) => text.startsWith('設定中:'))).toBe(false);
  });

  test('サブスク有効時はPlusユーザー表示と現在地アイコン設定を表示する', () => {
    const props = {
      ...createProps(),
      premiumAccessState: {
        ...getDefaultPremiumAccessState(),
        isPlusActive: true,
      },
    };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('Plusユーザー');
    expect(texts).toContain('退会する場合はApp Storeのサブスク設定から行ってください。');
    expect(texts).toContain('現在地アイコン (Strollia Plus)');
    expect(texts).toContain('サブスクを管理する');
  });

  test('サブスク有効時はCustomer Centerを表示できる', () => {
    const props = {
      ...createProps(),
      premiumAccessState: {
        ...getDefaultPremiumAccessState(),
        isPlusActive: true,
      },
    };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const customerCenterButton = renderer.root.findAll((node: any) => node.props.onPress === props.onPresentPremiumCustomerCenter)[0];

    act(() => {
      customerCenterButton.props.onPress();
    });

    expect(props.onPresentPremiumCustomerCenter).toHaveBeenCalledTimes(1);
  });

  test('サブスク管理先はOSごとのストア名を表示する', () => {
    expect(getSubscriptionStoreName('android')).toBe('Playストア');
    expect(getSubscriptionStoreName('ios')).toBe('App Store');
  });

  test('サブスク未加入時は一般ユーザー表示、Plus広告、加入と復元ボタンを表示する', () => {
    const props = { ...createProps(), styles: createStyles(lightTheme) };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    const adImage = renderer.root.findAllByType(Image).find(
      (node: any) => node.props.accessibilityLabel === 'Strollia Plusの機能比較広告',
    );

    expect(texts).toContain('一般ユーザー');
    expect(texts).not.toContain('退会する場合は${ストア名}のサブスク設定から行ってください。');
    expect(texts).not.toContain('退会する場合はApp Storeのサブスク設定から行ってください。');
    expect(texts).toContain('Strollia Plus(有料サブスクリプション)のごあんない');
    expect(texts).toContain('月額300円の有料サービスです。年払いにすると1か月分オトクです!');
    expect(texts).toContain('いつでも解約できます。');
    expect(texts).toContain('月額300円ではじめる！');
    expect(texts).toContain('年額3300円ではじめる！');
    expect(texts).toContain('Strollia Plusの購入を復元する');
    expect(adImage).toBeTruthy();
    expect(adImage?.parent?.props.style).toEqual(expect.objectContaining({ width: '100%' }));
  });

  test('サブスク未加入時は自動更新の開示文と規約/プライバシーリンクを購入導線に表示する', () => {
    const props = createProps();
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    const disclosure = texts.find((t: any) => typeof t === 'string' && t.includes('自動更新'));
    expect(disclosure).toBeDefined();
    expect(disclosure).toContain('自動的に更新');

    const termsLink = renderer.root.findByProps({ accessibilityLabel: '利用規約を開く' });
    const privacyLink = renderer.root.findByProps({ accessibilityLabel: 'プライバシーポリシーを開く' });
    act(() => {
      termsLink.props.onPress();
      privacyLink.props.onPress();
    });
    expect(props.onOpenTermsOfService).toHaveBeenCalled();
    expect(props.onOpenPrivacyPolicy).toHaveBeenCalled();
  });

  test('購入ボタンは固定の月額300円・年額3300円を表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...createProps()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('月額300円ではじめる！');
    expect(texts).toContain('年額3300円ではじめる！');
  });

  test('サブスク未加入時は加入と復元ボタンを呼び出す', () => {
    const props = createProps();
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const monthlyButton = renderer.root.findAll((node: any) => node.props.onPress === props.onPurchaseMonthlyPremiumPackage)[0];
    const yearlyButton = renderer.root.findAll((node: any) => node.props.onPress === props.onPurchaseYearlyPremiumPackage)[0];
    const restoreButton = renderer.root.findAll((node: any) => node.props.onPress === props.onRestorePremiumPurchases)[0];

    act(() => {
      monthlyButton.props.onPress();
      yearlyButton.props.onPress();
      restoreButton.props.onPress();
    });

    expect(props.onPurchaseMonthlyPremiumPackage).toHaveBeenCalledTimes(1);
    expect(props.onPurchaseYearlyPremiumPackage).toHaveBeenCalledTimes(1);
    expect(props.onRestorePremiumPurchases).toHaveBeenCalledTimes(1);
  });

  test('サブスク未加入時は現在地アイコン選択を表示しない', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...createProps()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).not.toContain('現在地アイコン (Strollia Plus)');
  });

  test('サブスク未加入でOffering取得中の表示を出す', () => {
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

  test('購入処理中は月払いと年払いボタンを無効化する', () => {
    const props = {
      ...createProps(),
      isPurchasingPremiumPackage: true,
    };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const purchaseButtons = [
      renderer.root.findAll((node: any) => node.props.onPress === props.onPurchaseMonthlyPremiumPackage)[0],
      renderer.root.findAll((node: any) => node.props.onPress === props.onPurchaseYearlyPremiumPackage)[0],
    ];

    expect(purchaseButtons).toHaveLength(2);
    expect(purchaseButtons[0].props.disabled).toBe(true);
    expect(purchaseButtons[1].props.disabled).toBe(true);
  });

  test('購入復元中は復元ボタンを無効化する', () => {
    const props = {
      ...createProps(),
      isRestoringPremiumPurchases: true,
    };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const restoreButton = renderer.root.findAll((node: any) => node.props.onPress === props.onRestorePremiumPurchases)[0];

    expect(restoreButton.props.disabled).toBe(true);
  });

  test('GPXインポートと既存データ優先の説明を表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...createProps()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('GPSログファイルの一般的な規格のGPXファイルでエクスポート/インポートが可能です。\nインポート時にデータが競合する場合は既存データを優先します。');
    expect(texts).toContain('GPXファイルのインポート');
  });

  test('GPXエクスポートとインポートのアイコンはデザインに合わせて逆向きにする', () => {
    const props = createProps();
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const exportButton = renderer.root.findAll((node: any) => node.props.onPress === props.onExportAllLogs)[0];
    const importButton = renderer.root.findAll((node: any) => node.props.onPress === props.onImportGpx)[0];
    const exportIcon = exportButton.findAllByType(Text).find((node: any) => node.props.name);
    const importIcon = importButton.findAllByType(Text).find((node: any) => node.props.name);

    expect(exportIcon?.props.name).toBe('upload');
    expect(importIcon?.props.name).toBe('download');
  });

  test('データ管理の各ボタンは左揃えで表示する', () => {
    const props = { ...createProps(), styles: createStyles(lightTheme) };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const buttons = [props.onExportAllLogs, props.onImportGpx, props.onDeleteAllData].map((handler) => renderer.root.findAll((node: any) => node.props.onPress === handler)[0]);

    for (const button of buttons) {
      const content = button.findAll((node: any) => flattenStyle(node.props.style).width === '100%')[0];

      expect(flattenStyle(content.props.style).justifyContent).toBe('flex-start');
    }
  });

  test('サブスク未加入時の各ボタンは設定共通ピルとして左揃えで表示する', () => {
    const props = { ...createProps(), styles: createStyles(lightTheme) };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const buttons = [props.onPurchaseMonthlyPremiumPackage, props.onPurchaseYearlyPremiumPackage, props.onRestorePremiumPurchases].flatMap((handler) =>
      renderer.root.findAll((node: any) => node.props.accessibilityRole === 'button' && node.props.onPress === handler),
    );

    expect(buttons).toHaveLength(3);

    for (const button of buttons) {
      const buttonStyle = flattenStyle(button.props.style);
      const content = button.findAll((node: any) => flattenStyle(node.props.style).width === '100%')[0];

      expect(buttonStyle.minHeight).toBe(40);
      expect(buttonStyle.paddingVertical).toBe(10);
      expect(flattenStyle(content.props.style).justifyContent).toBe('flex-start');
    }
  });

  test('月払いと年払いのボタンはdollarアイコンを使用する', () => {
    const props = createProps();
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const purchaseButtons = [
      ...renderer.root.findAll((node: any) => node.props.accessibilityRole === 'button' && node.props.onPress === props.onPurchaseMonthlyPremiumPackage),
      ...renderer.root.findAll((node: any) => node.props.accessibilityRole === 'button' && node.props.onPress === props.onPurchaseYearlyPremiumPackage),
    ];

    expect(purchaseButtons).toHaveLength(2);
    for (const button of purchaseButtons) {
      const icon = button.findAllByType(Text).find((node: any) => node.props.name);

      expect(icon?.props.name).toBe('currency-usd');
    }
  });

  test('OSSライセンス画面への導線を表示し、押下で開く', () => {
    const props = createProps();
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    const licenseButton = renderer.root.findAll(
      (node: any) => node.props.onPress === props.onOpenLicenseScreen,
    )[0];

    expect(texts).toContain('オープンソースライセンス');

    act(() => {
      licenseButton.props.onPress();
    });

    expect(props.onOpenLicenseScreen).toHaveBeenCalledTimes(1);
  });

  test('ライセンスの下に法務リンクを順番に表示して開ける', () => {
    const props = createProps();
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    const licenseIndex = texts.indexOf('オープンソースライセンス');
    // 利用規約/プライバシーはサブスク導線にも表示されるため、アプリ情報セクション側（後方）を対象にする。
    const termsIndex = texts.lastIndexOf('利用規約');
    const privacyIndex = texts.lastIndexOf('プライバシーポリシー');
    const commercialIndex = texts.indexOf('特商法に基づく表記');

    expect(licenseIndex).toBeGreaterThanOrEqual(0);
    expect(termsIndex).toBeGreaterThan(licenseIndex);
    expect(privacyIndex).toBeGreaterThan(termsIndex);
    expect(commercialIndex).toBeGreaterThan(privacyIndex);

    const termsButton = renderer.root.findAll((node: any) => node.props.onPress === props.onOpenTermsOfService)[0];
    const privacyButton = renderer.root.findAll((node: any) => node.props.onPress === props.onOpenPrivacyPolicy)[0];
    const commercialButton = renderer.root.findAll(
      (node: any) => node.props.onPress === props.onOpenSpecifiedCommercialTransactionAct,
    )[0];

    act(() => {
      termsButton.props.onPress();
      privacyButton.props.onPress();
      commercialButton.props.onPress();
    });

    expect(props.onOpenTermsOfService).toHaveBeenCalledTimes(1);
    expect(props.onOpenPrivacyPolicy).toHaveBeenCalledTimes(1);
    expect(props.onOpenSpecifiedCommercialTransactionAct).toHaveBeenCalledTimes(1);
  });

  test('GPXをインポート押下でonImportGpxを呼び出す', () => {
    const props = createProps();
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const importButton = renderer.root.findAll(
      (node: any) => node.props.onPress === props.onImportGpx,
    )[0];

    act(() => {
      importButton.props.onPress();
    });

    expect(props.onImportGpx).toHaveBeenCalledTimes(1);
  });

  test('GPXインポート中はインポートボタンを無効化する', () => {
    const props = {
      ...createProps(),
      isImportingGpx: true,
    };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const importButton = renderer.root.findAll(
      (node: any) => node.props.onPress === props.onImportGpx,
    )[0];

    expect(importButton.props.disabled).toBe(true);
  });

  test('ルート線の見た目設定を表示しない', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...createProps()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).not.toContain('ルート線の見た目');
  });

  test('通常時は記録開始と停止ボタンを表示しない', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...createProps()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).not.toContain('GPSの記録を開始する');
    expect(texts).not.toContain('停止');
  });

  test('自動開始失敗時だけ復旧用の記録開始ボタンを表示する', () => {
    const props = {
      ...createProps(),
      isRecording: false,
      autoStartStatus: 'failed' as const,
    };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('GPSの記録を開始する');
    expect(texts).not.toContain('停止');
  });

  test('権限不足時は自動開始失敗でも復旧用の記録開始ボタンを表示せず、権限要求を表示する', () => {
    const props = {
      ...createProps(),
      isRecording: false,
      autoStartStatus: 'failed' as const,
      hasRequiredPermission: false,
    };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).not.toContain('GPSの記録を開始する');
    expect(texts).toContain('位置情報の許可が必要です');
  });

  test('記録中でない待機状態のときはGPSパネルに準備中メッセージを表示する', () => {
    const props = {
      ...createProps(),
      isRecording: false,
      autoStartStatus: 'checking' as const,
    };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('準備中...');
    expect(texts).not.toContain('GPS記録中!');
    expect(texts).not.toContain('GPSの記録を開始する');
  });


  describe('Plus会員向けカスタマイズ', () => {
    test('Plus会員はアプリカラーセクションを表示する', async () => {
      const plusProps = {
        ...createProps(),
        premiumAccessState: { isPlusActive: true, entitlementId: 'strollia_plus' },
        selectedAppColorPresetId: 'matcha' as AppColorPresetId,
        onUpdateAppColorPreset: jest.fn(),
      };
      let renderer: any;
      await act(async () => {
        renderer = ReactTestRenderer.create(<SettingsScreen {...plusProps} />);
      });
      const texts = renderer.root.findAllByType(Text).map((n: any) => n.props.children);
      expect(texts).toContain('アプリカラー (Strollia Plus)');
    });

    test('アプリカラーセクションにカラー変更の説明を表示する', async () => {
      const plusProps = {
        ...createProps(),
        premiumAccessState: { isPlusActive: true, entitlementId: 'strollia_plus' },
        selectedAppColorPresetId: 'matcha' as AppColorPresetId,
        onUpdateAppColorPreset: jest.fn(),
      };
      let renderer: any;
      await act(async () => {
        renderer = ReactTestRenderer.create(<SettingsScreen {...plusProps} />);
      });
      const texts = renderer.root.findAllByType(Text).map((n: any) => n.props.children);
      expect(texts).toContain('現在地アイコンの背景・エリアの塗り色など、アプリ全体のカラーが変わります。');
    });

    test('アプリカラーの選択中プリセット名をドロップダウンに表示する', async () => {
      const plusProps = {
        ...createProps(),
        premiumAccessState: { isPlusActive: true, entitlementId: 'strollia_plus' },
        selectedAppColorPresetId: 'sakura' as AppColorPresetId,
        onUpdateAppColorPreset: jest.fn(),
      };
      let renderer: any;
      await act(async () => {
        renderer = ReactTestRenderer.create(<SettingsScreen {...plusProps} />);
      });
      const texts = renderer.root.findAllByType(Text).map((n: any) => n.props.children);
      expect(texts).toContain('さくら');
    });

    test('非Plus会員はアプリカラーセクションを表示しない', async () => {
      const freeProps = {
        ...createProps(),
        premiumAccessState: { isPlusActive: false, entitlementId: 'strollia_plus' },
        selectedAppColorPresetId: 'matcha' as AppColorPresetId,
        onUpdateAppColorPreset: jest.fn(),
      };
      let renderer: any;
      await act(async () => {
        renderer = ReactTestRenderer.create(<SettingsScreen {...freeProps} />);
      });
      const texts = renderer.root.findAllByType(Text).map((n: any) => n.props.children);
      expect(texts).not.toContain('アプリカラー (Strollia Plus)');
    });
  });

  test('地図テーマの航空写真ボタンから地図種別を切り替える', () => {
    const props = createProps();
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const satelliteButton = renderer.root.findByProps({ accessibilityLabel: '航空写真' });

    act(() => {
      satelliteButton.props.onPress();
    });

    expect(props.onToggleMapType).toHaveBeenCalledTimes(1);
  });

  test('サポート用IDがあるとアプリ情報の末尾に表示し、タップでクリップボードへコピーする', async () => {
    const Clipboard = require('expo-clipboard');
    const { Alert } = require('react-native');
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const props = { ...createProps(), revenueCatAppUserId: '$RCAnonymousID:abc123' };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('$RCAnonymousID:abc123');

    const copyButton = renderer.root.findByProps({ accessibilityLabel: 'サポート用IDをコピー' });
    await act(async () => {
      copyButton.props.onPress();
    });

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('$RCAnonymousID:abc123');
    expect(alertSpy).toHaveBeenCalledWith('コピーしました', 'サポート用IDをクリップボードにコピーしました。');
    alertSpy.mockRestore();
  });

  test('サポート用IDのコピーに失敗したときは失敗アラートを表示する', async () => {
    const Clipboard = require('expo-clipboard');
    const { Alert } = require('react-native');
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    (Clipboard.setStringAsync as jest.Mock).mockRejectedValueOnce(new Error('copy failed'));
    const props = { ...createProps(), revenueCatAppUserId: '$RCAnonymousID:abc123' };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const copyButton = renderer.root.findByProps({ accessibilityLabel: 'サポート用IDをコピー' });
    await act(async () => {
      copyButton.props.onPress();
    });

    expect(alertSpy).toHaveBeenCalledWith('コピーできませんでした', 'もう一度お試しください。');
    alertSpy.mockRestore();
  });

  test('サポート用IDがnullのときはサポート用ID行を表示しない', () => {
    const props = { ...createProps(), revenueCatAppUserId: null };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const labels = renderer.root.findAll((node: any) => node.props.accessibilityLabel === 'サポート用IDをコピー');
    expect(labels).toHaveLength(0);
  });

});
