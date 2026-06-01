import { Text } from 'react-native';

import { lightTheme } from '../../../theme/theme';
import { LicenseScreen } from '../LicenseScreen';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');

  return {
    Feather: Text,
  };
});

jest.mock('../../generated/ossLicenses', () => ({
  OSS_LICENSES: [
    {
      id: 'react@19.1.0',
      name: 'react',
      version: '19.1.0',
      licenses: 'MIT',
      repository: 'https://github.com/facebook/react',
      source: 'npm',
      licenseText: 'MIT License text',
    },
  ],
  OSS_LICENSES_GENERATED_AT: '2026-06-01T00:00:00.000Z',
}));

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const styles = new Proxy(
  {},
  {
    get: () => ({}),
  },
);

describe('ライセンス画面 LicenseScreen', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('生成済みOSSライセンスを表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<LicenseScreen styles={styles as never} theme={lightTheme} onBackToSettings={jest.fn()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('ライセンス');
    expect(texts).toContain('react');
    expect(texts).toContain('19.1.0');
    expect(texts).toContain('MIT');
    expect(texts).toContain('MIT License text');
  });

  test('戻るボタンで設定画面に戻る', () => {
    const onBackToSettings = jest.fn();
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<LicenseScreen styles={styles as never} theme={lightTheme} onBackToSettings={onBackToSettings} />);
    });

    const backButton = renderer.root.findByProps({ accessibilityLabel: 'ライセンス画面を閉じる' });

    act(() => {
      backButton.props.onPress();
    });

    expect(onBackToSettings).toHaveBeenCalledTimes(1);
  });
});
