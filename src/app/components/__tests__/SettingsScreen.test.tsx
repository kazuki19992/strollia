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
    onUpdateShowPhotosOnMap: jest.fn().mockResolvedValue(undefined),
    onUpdateUserLocationIcon: jest.fn(),
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

    expect(texts).toContain('GPS記録');
    expect(texts).toContain('データのエクスポート');
  });

  test('Strollia Plusカードは現在地アイコン特典の説明を表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...createProps()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('RevenueCat連携済み');
    expect(texts).toContain('RevenueCatでPlus状態を確認します。無料時はOS標準の現在地アイコンを使います。');
  });

  test('Strollia Plusカードは取得した商品概要を表示する', () => {
    const props = {
      ...createProps(),
      premiumOfferingSummary: {
        offeringId: 'default',
        packages: [
          {
            identifier: '$rc_monthly',
            packageType: 'MONTHLY',
            productIdentifier: 'strollia_plus_monthly',
            title: 'Strollia Plus Monthly',
            description: 'Monthly plan',
            priceText: '¥300',
          },
        ],
      },
    };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('Strollia Plus Monthly');
    expect(texts).toContain('¥300');
    expect(texts).toContain('strollia_plus_monthly');
  });

  test('Strollia PlusカードはPaywall表示と復元ボタンを呼び出す', () => {
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

  test('Strollia PlusカードはOffering取得中の表示を出す', () => {
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

  test('GPXインポートと既存データ優先の説明を表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...createProps()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('GPXファイルを端末内に取り込みます。KMLは未対応です。同じ時刻と座標の点がある場合は既存データを優先します。');
    expect(texts).toContain('GPXをインポート');
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

    expect(texts).not.toContain('記録開始');
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

    expect(texts).toContain('記録開始');
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

    expect(texts).not.toContain('記録開始');
    expect(texts).toContain('位置情報の常時許可が必要です');
  });
});
