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
    {
      id: 'expo@54.0.35',
      name: 'expo',
      version: '54.0.35',
      licenses: 'MIT',
      repository: null,
      source: 'npm',
      licenseText: 'Expo license text',
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
  let renderer: any;

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderer = null;
  });

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer.unmount();
      });
    }
    jest.restoreAllMocks();
  });

  test('生成済みOSSライセンスをライブラリ名だけのリストで表示する', () => {
    act(() => {
      renderer = ReactTestRenderer.create(<LicenseScreen styles={styles as never} theme={lightTheme} onBackToSettings={jest.fn()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('ライセンス');
    expect(texts).toContain('react');
    expect(texts).toContain('expo');
    expect(texts).not.toContain('19.1.0');
    expect(texts).not.toContain('MIT');
    expect(texts).not.toContain('MIT License text');
  });

  test('設定ボタンで設定画面に戻る', () => {
    const onBackToSettings = jest.fn();

    act(() => {
      renderer = ReactTestRenderer.create(<LicenseScreen styles={styles as never} theme={lightTheme} onBackToSettings={onBackToSettings} />);
    });

    const backButton = renderer.root.findByProps({ accessibilityLabel: '設定画面へ戻る' });

    act(() => {
      backButton.props.onPress();
    });

    expect(onBackToSettings).toHaveBeenCalledTimes(1);
  });

  test('リスト項目をタップすると全画面詳細を開き、閉じると一覧に戻る', () => {
    act(() => {
      renderer = ReactTestRenderer.create(<LicenseScreen styles={styles as never} theme={lightTheme} onBackToSettings={jest.fn()} />);
    });

    const reactRow = renderer.root.findByProps({ accessibilityLabel: 'react のライセンス詳細を開く' });

    act(() => {
      reactRow.props.onPress();
    });

    let texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('react');
    expect(texts).toContain('19.1.0');
    expect(texts).toContain('MIT');
    expect(texts).toContain('https://github.com/facebook/react');
    expect(texts).toContain('MIT License text');

    const closeButton = renderer.root.findByProps({ accessibilityLabel: 'ライセンス詳細を閉じる' });

    act(() => {
      closeButton.props.onPress();
    });

    texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('react');
    expect(texts).not.toContain('MIT License text');
  });
});
