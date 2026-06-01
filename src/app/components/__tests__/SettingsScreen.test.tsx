import { Text } from 'react-native';

import { lightTheme } from '../../../theme/theme';
import { getDefaultPremiumAccessState, PremiumOfferingSummary } from '../../../features/premium/revenueCatAccess';
import { DEFAULT_USER_LOCATION_ICON_ID } from '../../../features/customization/customizationOptions';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');

  return {
    Feather: Text,
    MaterialCommunityIcons: Text,
  };
});

import { SettingsScreen } from '../SettingsScreen';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const styles = new Proxy(
  {},
  {
    get: () => ({}),
  },
);

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
    expect(texts).toContain('GPXのエクスポート');
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
    expect(texts).toContain('現在地アイコン (Strollia Plus)');
  });

  test('サブスク未加入時は加入と復元ボタンを表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...createProps()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('加入する');
    expect(texts).toContain('サブスクを復元する');
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

    expect(texts).toContain('データが競合する場合は既存データを優先します');
    expect(texts).toContain('GPXのインポート');
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
