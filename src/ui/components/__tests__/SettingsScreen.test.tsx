import { Image, StyleSheet, Text } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

import { AppColorPresetId } from '@/features/customization/colorPresets';

import { darkTheme, lightTheme } from '@/theme/theme';
import { getDefaultPremiumAccessState, PremiumOfferingSummary } from '@/features/premium/revenueCatAccess';
import { DEFAULT_USER_LOCATION_ICON_ID } from '@/features/customization/customizationOptions';
import { createStyles } from '@/ui/appStyles';

import { SettingsScreen, getSubscriptionStoreName } from '@/ui/components/SettingsScreen';

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
    crashReportingEnabled: true,
    mapType: 'standard' as const,
    showPhotosOnMap: false,
    isUpdatingPhotoSetting: false,
    isImportingGpx: false,
    premiumAccessState: getDefaultPremiumAccessState(),
    revenueCatAppUserId: null as string | null,
    appVersion: '1.1.0' as string | null,
    buildNumber: '21' as string | null,
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
    onUpdateCrashReportingEnabled: jest.fn().mockResolvedValue(undefined),
    onToggleMapType: jest.fn(),
    onUpdateShowPhotosOnMap: jest.fn().mockResolvedValue(undefined),
    onUpdateUserLocationIcon: jest.fn(),
    selectedAppColorPresetId: 'matcha' as AppColorPresetId,
    onUpdateAppColorPreset: jest.fn(),
    onOpenStayPlaces: jest.fn(),
    onOpenAboutAppScreen: jest.fn(),
    onOpenFirstLaunchTutorial: jest.fn(),
    onOpenFaqScreen: jest.fn(),
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

  test('アプリバージョンとビルド番号を表示する', () => {
    const props = { ...createProps(), appVersion: '1.1.0', buildNumber: '24' };
    render(<SettingsScreen {...props} />);

    expect(screen.getByText('バージョン 1.1.0 (Build 24)')).toBeTruthy();
  });

  test('GPS記録とデータ操作の項目を表示する', () => {
    render(<SettingsScreen {...createProps()} />);

    expect(screen.getByText('GPS記録中!')).toBeTruthy();
    expect(screen.getByText('あなたの位置情報はすとろりあがしっかりと記録しています！\n冒険にでかけましょう！')).toBeTruthy();
    expect(screen.getByText('GPXファイルのエクスポート')).toBeTruthy();
  });

  test('滞在場所設定を開く操作を表示してコールバックへ渡す', () => {
    const props = createProps();
    render(<SettingsScreen {...props} />);

    act(() => {
      fireEvent.press(screen.getByLabelText('滞在場所を設定する'));
    });

    expect(props.onOpenStayPlaces).toHaveBeenCalledTimes(1);
  });

  test('このアプリについての下にチュートリアルを表示して開ける', () => {
    const props = createProps();
    render(<SettingsScreen {...props} />);

    // UNSAFE_getAllByType を使うのはテキストの順序（インデックス）を検証するため
    const texts = screen.UNSAFE_getAllByType(Text).map((node) => node.props.children as unknown);
    const aboutIndex = texts.indexOf('このアプリについて');
    const tutorialIndex = texts.indexOf('チュートリアル');
    const licenseIndex = texts.indexOf('オープンソースライセンス');

    expect(aboutIndex).toBeGreaterThanOrEqual(0);
    expect(tutorialIndex).toBeGreaterThanOrEqual(0);
    expect(licenseIndex).toBeGreaterThanOrEqual(0);
    expect(aboutIndex).toBeLessThan(tutorialIndex);
    expect(tutorialIndex).toBeLessThan(licenseIndex);

    act(() => {
      fireEvent.press(screen.getByLabelText('このアプリについて'));
      fireEvent.press(screen.getByLabelText('チュートリアル'));
    });

    expect(props.onOpenAboutAppScreen).toHaveBeenCalledTimes(1);
    expect(props.onOpenFirstLaunchTutorial).toHaveBeenCalledTimes(1);
  });

  test('チュートリアルの下によくある質問を表示して開ける', () => {
    const props = createProps();
    render(<SettingsScreen {...props} />);

    // UNSAFE_getAllByType を使うのはテキストの順序（インデックス）を検証するため
    const texts = screen.UNSAFE_getAllByType(Text).map((node) => node.props.children as unknown);
    const tutorialIndex = texts.indexOf('チュートリアル');
    const faqIndex = texts.indexOf('よくある質問');
    const licenseIndex = texts.indexOf('オープンソースライセンス');

    expect(tutorialIndex).toBeGreaterThanOrEqual(0);
    expect(faqIndex).toBeGreaterThanOrEqual(0);
    expect(licenseIndex).toBeGreaterThanOrEqual(0);
    expect(tutorialIndex).toBeLessThan(faqIndex);
    expect(faqIndex).toBeLessThan(licenseIndex);

    act(() => {
      fireEvent.press(screen.getByLabelText('よくある質問'));
    });

    expect(props.onOpenFaqScreen).toHaveBeenCalledTimes(1);
  });

  test('ダークモードでもGPS正常パネルはライトモードと同じ白文字で表示する', () => {
    const props = { ...createProps(), styles: createStyles(darkTheme), theme: darkTheme };
    render(<SettingsScreen {...props} />);

    // UNSAFE_getAllByType を使うのは style.color という非セマンティックな props を検証するため
    const title = screen.UNSAFE_getAllByType(Text).find((node) => node.props.children === 'GPS記録中!');
    const description = screen
      .UNSAFE_getAllByType(Text)
      .find((node) => node.props.children === 'あなたの位置情報はすとろりあがしっかりと記録しています！\n冒険にでかけましょう！');

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
    render(<SettingsScreen {...props} />);

    expect(screen.getByText('アプリ起動中のみ記録')).toBeTruthy();
    expect(
      screen.getByText('アプリを画面に表示しているときのみ記録します。\n常に記録したいときは設定画面で変更してください。'),
    ).toBeTruthy();
    // 「位置情報の許可が必要です」エラーパネルは出さない
    expect(screen.queryByText('位置情報の許可が必要です')).toBeNull();

    act(() => {
      fireEvent.press(screen.getByLabelText('位置情報設定を開く'));
    });
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

    const { unmount: unmount1 } = render(<SettingsScreen {...permissionProps} />);
    const permissionButton = screen.getByLabelText('位置情報の許可を求める');
    const permissionText = screen.UNSAFE_getAllByType(Text).find((node) => node.props.children === '続ける');
    expect(flattenStyle(permissionButton.props.style).backgroundColor).toBe('#ffffff');
    expect(flattenStyle(permissionText?.props.style).color).toBe('#b0002f');
    unmount1();

    render(<SettingsScreen {...failedProps} />);
    const failedButton = screen.getByLabelText('GPSの記録を開始する');
    const failedText = screen.UNSAFE_getAllByType(Text).find((node) => node.props.children === 'GPSの記録を開始する');
    expect(flattenStyle(failedButton.props.style).backgroundColor).toBe('#ffffff');
    expect(flattenStyle(failedText?.props.style).color).toBe('#a36100');
  });

  test('選択項目の設定中ラベルは表示しない', () => {
    render(<SettingsScreen {...createProps()} />);

    // UNSAFE_getAllByType を使うのはすべての Text ノードの内容を検査するため
    const texts = screen
      .UNSAFE_getAllByType(Text)
      .map((node) => node.props.children)
      .filter((text): text is string => typeof text === 'string');

    expect(texts.some((text) => text.startsWith('設定中:'))).toBe(false);
  });

  test('サブスク有効時はPlusユーザー表示と現在地アイコン設定を表示する', () => {
    const props = {
      ...createProps(),
      premiumAccessState: {
        ...getDefaultPremiumAccessState(),
        isPlusActive: true,
      },
    };
    render(<SettingsScreen {...props} />);

    expect(screen.getByText('Plusユーザー')).toBeTruthy();
    expect(screen.getByText('退会する場合はApp Storeのサブスク設定から行ってください。')).toBeTruthy();
    expect(screen.getByText('現在地アイコン (Strollia Plus)')).toBeTruthy();
    expect(screen.getByText('サブスクを管理する')).toBeTruthy();
  });

  test('サブスク有効時はCustomer Centerを表示できる', () => {
    const props = {
      ...createProps(),
      premiumAccessState: {
        ...getDefaultPremiumAccessState(),
        isPlusActive: true,
      },
    };
    render(<SettingsScreen {...props} />);

    act(() => {
      fireEvent.press(screen.getByLabelText('サブスクを管理する'));
    });

    expect(props.onPresentPremiumCustomerCenter).toHaveBeenCalledTimes(1);
  });

  test('サブスク管理先はOSごとのストア名を表示する', () => {
    expect(getSubscriptionStoreName('android')).toBe('Playストア');
    expect(getSubscriptionStoreName('ios')).toBe('App Store');
  });

  test('サブスク未加入時は一般ユーザー表示、Plus広告、加入と復元ボタンを表示する', () => {
    const props = { ...createProps(), styles: createStyles(lightTheme) };
    render(<SettingsScreen {...props} />);

    expect(screen.getByText('一般ユーザー')).toBeTruthy();
    expect(screen.queryByText('退会する場合は${ストア名}のサブスク設定から行ってください。')).toBeNull();
    expect(screen.queryByText('退会する場合はApp Storeのサブスク設定から行ってください。')).toBeNull();
    expect(screen.getByText('Strollia Plus(有料サブスクリプション)のごあんない')).toBeTruthy();
    expect(screen.getByText('月額300円の有料サービスです。年払いにすると1か月分オトクです!')).toBeTruthy();
    expect(screen.getByText('いつでも解約できます。')).toBeTruthy();
    expect(screen.getByText('月額300円ではじめる！')).toBeTruthy();
    expect(screen.getByText('年額3300円ではじめる！')).toBeTruthy();
    expect(screen.getByText('Strollia Plusの購入を復元する')).toBeTruthy();
    // UNSAFE_getByType を使うのは Image という型で広告画像を検索するため
    const adImage = screen.UNSAFE_getAllByType(Image).find((node) => node.props.accessibilityLabel === 'Strollia Plusの機能比較広告');
    expect(adImage).toBeTruthy();
    expect(adImage?.parent?.props.style).toEqual(expect.objectContaining({ width: '100%' }));
  });

  test('サブスク未加入時は自動更新の開示文と規約/プライバシーリンクを購入導線に表示する', () => {
    const props = createProps();
    render(<SettingsScreen {...props} />);

    // UNSAFE_getAllByType を使うのはすべての Text から自動更新含む文字列を検索するため
    const texts = screen.UNSAFE_getAllByType(Text).map((node) => node.props.children);
    const disclosure = texts.find((t): t is string => typeof t === 'string' && t.includes('自動更新'));
    expect(disclosure).toBeDefined();
    expect(disclosure).toContain('自動的に更新');

    act(() => {
      fireEvent.press(screen.getByLabelText('利用規約を開く'));
      fireEvent.press(screen.getByLabelText('プライバシーポリシーを開く'));
    });
    expect(props.onOpenTermsOfService).toHaveBeenCalled();
    expect(props.onOpenPrivacyPolicy).toHaveBeenCalled();
  });

  test('購入ボタンは固定の月額300円・年額3300円を表示する', () => {
    render(<SettingsScreen {...createProps()} />);

    expect(screen.getByText('月額300円ではじめる！')).toBeTruthy();
    expect(screen.getByText('年額3300円ではじめる！')).toBeTruthy();
  });

  test('サブスク未加入時は加入と復元ボタンを呼び出す', () => {
    const props = createProps();
    render(<SettingsScreen {...props} />);

    act(() => {
      fireEvent.press(screen.getByLabelText('月額300円ではじめる！'));
      fireEvent.press(screen.getByLabelText('年額3300円ではじめる！'));
      fireEvent.press(screen.getByLabelText('Strollia Plusの購入を復元する'));
    });

    expect(props.onPurchaseMonthlyPremiumPackage).toHaveBeenCalledTimes(1);
    expect(props.onPurchaseYearlyPremiumPackage).toHaveBeenCalledTimes(1);
    expect(props.onRestorePremiumPurchases).toHaveBeenCalledTimes(1);
  });

  test('サブスク未加入時は現在地アイコン選択を表示しない', () => {
    render(<SettingsScreen {...createProps()} />);

    expect(screen.queryByText('現在地アイコン (Strollia Plus)')).toBeNull();
  });

  test('サブスク未加入でOffering取得中の表示を出す', () => {
    const props = {
      ...createProps(),
      isLoadingPremiumOffering: true,
    };
    render(<SettingsScreen {...props} />);

    expect(screen.getByText('商品情報を確認しています...')).toBeTruthy();
  });

  test('購入処理中は月払いと年払いボタンを無効化する', () => {
    const props = {
      ...createProps(),
      isPurchasingPremiumPackage: true,
    };
    render(<SettingsScreen {...props} />);

    // UNSAFE_getAllByProps を使うのは以下の理由による:
    // 1. isPurchasingPremiumPackage=true のとき月払い・年払い両方のラベルが「購入処理中...」になり
    //    getByLabelText で一意に識別できない
    // 2. disabled は Pressable の内部 accessibilityState にマッピングされるため
    //    getByLabelText で取得した要素の props.disabled が undefined になる
    const monthlyButton = screen.UNSAFE_getAllByProps({ onPress: props.onPurchaseMonthlyPremiumPackage })[0];
    const yearlyButton = screen.UNSAFE_getAllByProps({ onPress: props.onPurchaseYearlyPremiumPackage })[0];

    expect(monthlyButton.props.disabled).toBe(true);
    expect(yearlyButton.props.disabled).toBe(true);
  });

  test('購入復元中は復元ボタンを無効化する', () => {
    const props = {
      ...createProps(),
      isRestoringPremiumPurchases: true,
    };
    render(<SettingsScreen {...props} />);

    // UNSAFE_getAllByProps を使うのは disabled という非セマンティックな props を検証するため。
    // getByLabelText はホスト要素を返すが disabled は Pressable の内部 accessibilityState に
    // マッピングされるため、props.disabled が undefined になりアサーションが通らない。
    const restoreButton = screen.UNSAFE_getAllByProps({ onPress: props.onRestorePremiumPurchases })[0];

    expect(restoreButton.props.disabled).toBe(true);
  });

  test('GPXインポートと既存データ優先の説明を表示する', () => {
    render(<SettingsScreen {...createProps()} />);

    expect(
      screen.getByText(
        'GPSログファイルの一般的な規格のGPXファイルでエクスポート/インポートが可能です。\nインポート時にデータが競合する場合は既存データを優先します。',
      ),
    ).toBeTruthy();
    expect(screen.getByText('GPXファイルのインポート')).toBeTruthy();
  });

  test('GPXエクスポートとインポートのアイコンはデザインに合わせて逆向きにする', () => {
    const props = createProps();
    render(<SettingsScreen {...props} />);

    const exportButton = screen.getByLabelText('GPXファイルのエクスポート');
    const importButton = screen.getByLabelText('GPXファイルのインポート');
    // アイコンは Feather (Text) で name prop を持つ
    const exportIcon = exportButton.findAll((node: { props: { name?: string } }) => node.props.name != null)[0];
    const importIcon = importButton.findAll((node: { props: { name?: string } }) => node.props.name != null)[0];

    expect(exportIcon?.props.name).toBe('upload');
    expect(importIcon?.props.name).toBe('download');
  });

  test('データ管理の各ボタンは左揃えで表示する', () => {
    const props = { ...createProps(), styles: createStyles(lightTheme) };
    render(<SettingsScreen {...props} />);

    const buttons = ['GPXファイルのエクスポート', 'GPXファイルのインポート', 'すべてのデータの削除'].map((label) =>
      screen.getByLabelText(label),
    );

    for (const button of buttons) {
      const content = button.findAll((node: { props: { style?: unknown } }) => flattenStyle(node.props.style).width === '100%')[0];
      expect(flattenStyle(content.props.style).justifyContent).toBe('flex-start');
    }
  });

  test('サブスク未加入時の各ボタンは設定共通ピルとして左揃えで表示する', () => {
    const props = { ...createProps(), styles: createStyles(lightTheme) };
    render(<SettingsScreen {...props} />);

    const buttons = ['月額300円ではじめる！', '年額3300円ではじめる！', 'Strollia Plusの購入を復元する'].map((label) =>
      screen.getByLabelText(label),
    );

    expect(buttons).toHaveLength(3);

    for (const button of buttons) {
      const buttonStyle = flattenStyle(button.props.style);
      const content = button.findAll((node: { props: { style?: unknown } }) => flattenStyle(node.props.style).width === '100%')[0];

      expect(buttonStyle.minHeight).toBe(40);
      expect(buttonStyle.paddingVertical).toBe(10);
      expect(flattenStyle(content.props.style).justifyContent).toBe('flex-start');
    }
  });

  test('月払いと年払いのボタンはdollarアイコンを使用する', () => {
    const props = createProps();
    render(<SettingsScreen {...props} />);

    const purchaseButtons = ['月額300円ではじめる！', '年額3300円ではじめる！'].map((label) => screen.getByLabelText(label));

    expect(purchaseButtons).toHaveLength(2);
    for (const button of purchaseButtons) {
      const icon = button.findAll((node: { props: { name?: string } }) => node.props.name != null)[0];
      expect(icon?.props.name).toBe('currency-usd');
    }
  });

  test('OSSライセンス画面への導線を表示し、押下で開く', () => {
    const props = createProps();
    render(<SettingsScreen {...props} />);

    expect(screen.getByText('オープンソースライセンス')).toBeTruthy();

    act(() => {
      fireEvent.press(screen.getByLabelText('オープンソースライセンス'));
    });

    expect(props.onOpenLicenseScreen).toHaveBeenCalledTimes(1);
  });

  test('ライセンスの下に法務リンクを順番に表示して開ける', () => {
    const props = createProps();
    render(<SettingsScreen {...props} />);

    // UNSAFE_getAllByType を使うのはテキストの順序（lastIndexOf）を検証するため
    const texts = screen.UNSAFE_getAllByType(Text).map((node) => node.props.children as unknown);
    const licenseIndex = texts.indexOf('オープンソースライセンス');
    // 利用規約/プライバシーはサブスク導線にも表示されるため、アプリ情報セクション側（後方）を対象にする。
    const termsIndex = texts.lastIndexOf('利用規約');
    const privacyIndex = texts.lastIndexOf('プライバシーポリシー');
    const commercialIndex = texts.indexOf('特商法に基づく表記');

    expect(licenseIndex).toBeGreaterThanOrEqual(0);
    expect(termsIndex).toBeGreaterThan(licenseIndex);
    expect(privacyIndex).toBeGreaterThan(termsIndex);
    expect(commercialIndex).toBeGreaterThan(privacyIndex);

    // 利用規約・プライバシーポリシーはサブスク導線とアプリ情報の2か所に表示されるため、
    // 各セクションで異なる accessibilityLabel を使って区別する。
    act(() => {
      fireEvent.press(screen.getByLabelText('利用規約を開く'));
      fireEvent.press(screen.getByLabelText('プライバシーポリシーを開く'));
      fireEvent.press(screen.getByLabelText('特商法に基づく表記'));
    });

    expect(props.onOpenTermsOfService).toHaveBeenCalledTimes(1);
    expect(props.onOpenPrivacyPolicy).toHaveBeenCalledTimes(1);
    expect(props.onOpenSpecifiedCommercialTransactionAct).toHaveBeenCalledTimes(1);
  });

  test('GPXをインポート押下でonImportGpxを呼び出す', () => {
    const props = createProps();
    render(<SettingsScreen {...props} />);

    act(() => {
      fireEvent.press(screen.getByLabelText('GPXファイルのインポート'));
    });

    expect(props.onImportGpx).toHaveBeenCalledTimes(1);
  });

  test('GPXインポート中はインポートボタンを無効化する', () => {
    const props = {
      ...createProps(),
      isImportingGpx: true,
    };
    render(<SettingsScreen {...props} />);

    // UNSAFE_getAllByProps を使うのは disabled という非セマンティックな props を検証するため。
    // getByLabelText はホスト要素を返すが disabled は Pressable の内部 accessibilityState に
    // マッピングされるため、props.disabled が undefined になりアサーションが通らない。
    const importButton = screen.UNSAFE_getAllByProps({ onPress: props.onImportGpx })[0];

    expect(importButton.props.disabled).toBe(true);
  });

  test('ルート線の見た目設定を表示しない', () => {
    render(<SettingsScreen {...createProps()} />);

    expect(screen.queryByText('ルート線の見た目')).toBeNull();
  });

  test('通常時は記録開始と停止ボタンを表示しない', () => {
    render(<SettingsScreen {...createProps()} />);

    expect(screen.queryByText('GPSの記録を開始する')).toBeNull();
    expect(screen.queryByText('停止')).toBeNull();
  });

  test('自動開始失敗時だけ復旧用の記録開始ボタンを表示する', () => {
    const props = {
      ...createProps(),
      isRecording: false,
      autoStartStatus: 'failed' as const,
    };
    render(<SettingsScreen {...props} />);

    expect(screen.getByText('GPSの記録を開始する')).toBeTruthy();
    expect(screen.queryByText('停止')).toBeNull();
  });

  test('権限不足時は自動開始失敗でも復旧用の記録開始ボタンを表示せず、権限要求を表示する', () => {
    const props = {
      ...createProps(),
      isRecording: false,
      autoStartStatus: 'failed' as const,
      hasRequiredPermission: false,
    };
    render(<SettingsScreen {...props} />);

    expect(screen.queryByText('GPSの記録を開始する')).toBeNull();
    expect(screen.getByText('位置情報の許可が必要です')).toBeTruthy();
  });

  test('記録中でない待機状態のときはGPSパネルに準備中メッセージを表示する', () => {
    const props = {
      ...createProps(),
      isRecording: false,
      autoStartStatus: 'checking' as const,
    };
    render(<SettingsScreen {...props} />);

    expect(screen.getByText('準備中...')).toBeTruthy();
    expect(screen.queryByText('GPS記録中!')).toBeNull();
    expect(screen.queryByText('GPSの記録を開始する')).toBeNull();
  });

  describe('Plus会員向けカスタマイズ', () => {
    test('Plus会員はアプリカラーセクションを表示する', () => {
      const plusProps = {
        ...createProps(),
        premiumAccessState: { isPlusActive: true, entitlementId: 'strollia_plus' },
        selectedAppColorPresetId: 'matcha' as AppColorPresetId,
        onUpdateAppColorPreset: jest.fn(),
      };
      render(<SettingsScreen {...plusProps} />);
      expect(screen.getByText('アプリカラー (Strollia Plus)')).toBeTruthy();
    });

    test('アプリカラーセクションにカラー変更の説明を表示する', () => {
      const plusProps = {
        ...createProps(),
        premiumAccessState: { isPlusActive: true, entitlementId: 'strollia_plus' },
        selectedAppColorPresetId: 'matcha' as AppColorPresetId,
        onUpdateAppColorPreset: jest.fn(),
      };
      render(<SettingsScreen {...plusProps} />);
      expect(screen.getByText('現在地アイコンの背景・エリアの塗り色など、アプリ全体のカラーが変わります。')).toBeTruthy();
    });

    test('アプリカラーの選択中プリセット名をドロップダウンに表示する', () => {
      const plusProps = {
        ...createProps(),
        premiumAccessState: { isPlusActive: true, entitlementId: 'strollia_plus' },
        selectedAppColorPresetId: 'sakura' as AppColorPresetId,
        onUpdateAppColorPreset: jest.fn(),
      };
      render(<SettingsScreen {...plusProps} />);
      expect(screen.getByText('さくら')).toBeTruthy();
    });

    test('非Plus会員はアプリカラーセクションを表示しない', () => {
      const freeProps = {
        ...createProps(),
        premiumAccessState: { isPlusActive: false, entitlementId: 'strollia_plus' },
        selectedAppColorPresetId: 'matcha' as AppColorPresetId,
        onUpdateAppColorPreset: jest.fn(),
      };
      render(<SettingsScreen {...freeProps} />);
      expect(screen.queryByText('アプリカラー (Strollia Plus)')).toBeNull();
    });
  });

  test('地図テーマの航空写真ボタンから地図種別を切り替える', () => {
    const props = createProps();
    render(<SettingsScreen {...props} />);

    act(() => {
      fireEvent.press(screen.getByLabelText('航空写真'));
    });

    expect(props.onToggleMapType).toHaveBeenCalledTimes(1);
  });

  test('サポート用IDがあるとアプリ情報の末尾に表示し、タップでクリップボードへコピーする', async () => {
    const Clipboard = require('expo-clipboard');
    const { Alert } = require('react-native');
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const props = { ...createProps(), revenueCatAppUserId: '$RCAnonymousID:abc123' };
    render(<SettingsScreen {...props} />);

    expect(screen.getByText('$RCAnonymousID:abc123')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('サポート用IDをコピー'));
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
    render(<SettingsScreen {...props} />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('サポート用IDをコピー'));
    });

    expect(alertSpy).toHaveBeenCalledWith('コピーできませんでした', 'もう一度お試しください。');
    alertSpy.mockRestore();
  });

  test('サポート用IDがnullのときはサポート用ID行を表示しない', () => {
    const props = { ...createProps(), revenueCatAppUserId: null };
    render(<SettingsScreen {...props} />);

    expect(screen.queryByLabelText('サポート用IDをコピー')).toBeNull();
  });

  test('プライバシーセクションの不具合レポートトグルを切り替えると更新処理を呼ぶ', () => {
    const props = createProps();
    render(<SettingsScreen {...props} />);

    act(() => {
      fireEvent(screen.getByLabelText('不具合レポートを送る'), 'valueChange', false);
    });

    expect(props.onUpdateCrashReportingEnabled).toHaveBeenCalledWith(false);
  });

  test('不具合レポート設定の保存に失敗するとAlertで通知する', async () => {
    const { Alert } = require('react-native');
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const props = createProps();
    props.onUpdateCrashReportingEnabled = jest.fn().mockRejectedValue(new Error('保存に失敗しました'));
    render(<SettingsScreen {...props} />);

    await act(async () => {
      fireEvent(screen.getByLabelText('不具合レポートを送る'), 'valueChange', false);
    });

    expect(alertSpy).toHaveBeenCalledWith('設定保存失敗', '保存に失敗しました');
  });
});
