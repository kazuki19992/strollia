import { Image, StyleSheet, Text } from 'react-native';

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
    keepScreenAwake: false,
    appThemePreference: 'system' as const,
    mapType: 'standard' as const,
    showPhotosOnMap: false,
    isUpdatingPhotoSetting: false,
    isImportingGpx: false,
    premiumAccessState: getDefaultPremiumAccessState(),
    premiumOfferingSummary: null as PremiumOfferingSummary | null,
    isLoadingPremiumOffering: false,
    isPresentingPremiumPaywall: false,
    isRestoringPremiumPurchases: false,
    selectedUserLocationIconId: DEFAULT_USER_LOCATION_ICON_ID,
    onBackToMap: jest.fn(),
    onStartRecording: jest.fn(),
    onRequestLocationPermission: jest.fn(),
    onUpdateKeepScreenAwake: jest.fn().mockResolvedValue(undefined),
    onUpdateAppThemePreference: jest.fn().mockResolvedValue(undefined),
    onToggleMapType: jest.fn(),
    onUpdateShowPhotosOnMap: jest.fn().mockResolvedValue(undefined),
    onUpdateUserLocationIcon: jest.fn(),
    onOpenLicenseScreen: jest.fn(),
    onPresentPremiumPaywall: jest.fn(),
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
    expect(flattenStyle(lightStyles.settingsGpsPanelWarning).backgroundColor).toBe('#e98300');
    expect(flattenStyle(darkStyles.settingsGpsPanelWarning).backgroundColor).toBe('#e98300');
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
    const permissionText = permissionRenderer.root.findAllByType(Text).find((node: any) => node.props.children === '権限を付与する');
    const failedText = failedRenderer.root.findAllByType(Text).find((node: any) => node.props.children === 'GPSの記録を開始する');

    expect(flattenStyle(permissionButton.props.style).backgroundColor).toBe('#ffffff');
    expect(flattenStyle(failedButton.props.style).backgroundColor).toBe('#ffffff');
    expect(flattenStyle(permissionText?.props.style).color).toBe('#b0002f');
    expect(flattenStyle(failedText?.props.style).color).toBe('#e98300');
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
    const adImage = renderer.root.findByType(Image);

    expect(texts).toContain('一般ユーザー');
    expect(texts).not.toContain('退会する場合は${ストア名}のサブスク設定から行ってください。');
    expect(texts).not.toContain('退会する場合はApp Storeのサブスク設定から行ってください。');
    expect(texts).toContain('Strollia Plus(有料サブスクリプション)のごあんない');
    expect(texts).toContain('月額300円の有料サービスです。年払いにすると1か月分オトクです!');
    expect(texts).toContain('月払い(300円)ではじめる！');
    expect(texts).toContain('年払い(3300円)ではじめる！');
    expect(texts).toContain('Strollia Plusの購入を復元する');
    expect(adImage.props.accessibilityLabel).toBe('Strollia Plusの機能比較広告');
    expect(adImage.props.resizeMode).toBe('contain');
    expect(flattenStyle(adImage.props.style).aspectRatio).toBe(1044 / 1233);
    expect(flattenStyle(adImage.props.style).maxWidth).toBe('100%');
  });

  test('サブスク未加入時は加入と復元ボタンを呼び出す', () => {
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

  test('Paywall表示中はPaywallボタンを無効化する', () => {
    const props = {
      ...createProps(),
      isPresentingPremiumPaywall: true,
    };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const paywallButton = renderer.root.findAll((node: any) => node.props.onPress === props.onPresentPremiumPaywall)[0];

    expect(paywallButton.props.disabled).toBe(true);
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

    const buttons = [props.onPresentPremiumPaywall, props.onRestorePremiumPurchases].flatMap((handler) =>
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

    const paywallButtons = renderer.root.findAll((node: any) => node.props.accessibilityRole === 'button' && node.props.onPress === props.onPresentPremiumPaywall);

    expect(paywallButtons).toHaveLength(2);
    for (const button of paywallButtons) {
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
    expect(texts).toContain('GPSの権限をください!');
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

  test('画面テーマの選択ボタンからテーマ設定を保存する', () => {
    const props = createProps();
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const darkThemeButton = renderer.root.findByProps({ accessibilityLabel: 'いつもダーク' });

    act(() => {
      darkThemeButton.props.onPress();
    });

    expect(props.onUpdateAppThemePreference).toHaveBeenCalledWith('dark');
  });
});
