import { Text } from 'react-native';

import { lightTheme } from '../../../theme/theme';
import { getDefaultPremiumAccessState } from '../../../features/premium/revenueCatAccess';
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
    premiumAccessState: getDefaultPremiumAccessState(),
    selectedUserLocationIconId: DEFAULT_USER_LOCATION_ICON_ID,
    onBackToMap: jest.fn(),
    onStartRecording: jest.fn(),
    onRequestLocationPermission: jest.fn(),
    onUpdateKeepScreenAwake: jest.fn().mockResolvedValue(undefined),
    onUpdateShowPhotosOnMap: jest.fn().mockResolvedValue(undefined),
    onUpdateUserLocationIcon: jest.fn(),
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

    expect(texts).toContain('現在地アイコン変更などをPlus特典として用意します。無料時はOS標準の現在地アイコンを使います。');
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
});
