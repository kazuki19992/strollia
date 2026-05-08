import { Text } from 'react-native';

import { lightTheme } from '../../../theme/theme';
import { getDefaultPremiumAccessState } from '../../../features/premium/revenueCatAccess';
import { DEFAULT_ROUTE_LINE_STYLE_ID, DEFAULT_USER_LOCATION_ICON_ID } from '../../../features/customization/customizationOptions';

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
    selectedRouteLineStyleId: DEFAULT_ROUTE_LINE_STYLE_ID,
    selectedUserLocationIconId: DEFAULT_USER_LOCATION_ICON_ID,
    onBackToMap: jest.fn(),
    onStartRecording: jest.fn(),
    onStopRecording: jest.fn(),
    onRequestLocationPermission: jest.fn(),
    onUpdateKeepScreenAwake: jest.fn().mockResolvedValue(undefined),
    onUpdateShowPhotosOnMap: jest.fn().mockResolvedValue(undefined),
    onUpdateRouteLineStyle: jest.fn(),
    onUpdateUserLocationIcon: jest.fn(),
    onExportAllLogs: jest.fn(),
    onShowImportPlaceholder: jest.fn(),
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
});
