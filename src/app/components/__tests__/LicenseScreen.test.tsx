import { StyleSheet, Text } from 'react-native';

import { lightTheme } from '../../../theme/theme';
import { LicenseDetailScreen, LicenseScreen } from '../LicenseScreen';
import { OSS_LICENSES } from '../../generated/ossLicenses';

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

/** テスト用にstyle配列を単一オブジェクトへ畳み込む。 */
function flattenStyle(style: unknown): Record<string, unknown> {
  return (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
}

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
      renderer = ReactTestRenderer.create(<LicenseScreen styles={styles as never} theme={lightTheme} onBackToSettings={jest.fn()} onOpenLicenseDetail={jest.fn()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('ライセンス');
    expect(texts).toContain('react');
    expect(texts).toContain('expo');
    expect(texts).not.toContain('19.1.0');
    expect(texts).not.toContain('MIT');
    expect(texts).not.toContain('MIT License text');
  });

  test('画面タイトルは中央配置の共通ヘッダーで表示する', () => {
    const realStyles = require('../../appStyles').createStyles(lightTheme);

    act(() => {
      renderer = ReactTestRenderer.create(<LicenseScreen styles={realStyles} theme={lightTheme} onBackToSettings={jest.fn()} onOpenLicenseDetail={jest.fn()} />);
    });

    const title = renderer.root.findAllByType(Text).find((node: any) => node.props.children === 'ライセンス');

    expect(flattenStyle(title?.props.style).position).toBe('absolute');
    expect(flattenStyle(title?.props.style).textAlign).toBe('center');
  });

  test('設定ボタンで設定画面に戻る', () => {
    const onBackToSettings = jest.fn();

    act(() => {
      renderer = ReactTestRenderer.create(<LicenseScreen styles={styles as never} theme={lightTheme} onBackToSettings={onBackToSettings} onOpenLicenseDetail={jest.fn()} />);
    });

    const backButton = renderer.root.findByProps({ accessibilityLabel: '設定へ戻る' });

    act(() => {
      backButton.props.onPress();
    });

    expect(onBackToSettings).toHaveBeenCalledTimes(1);
  });

  test('リスト項目をタップすると選択したライセンス詳細へ遷移する', () => {
    const onOpenLicenseDetail = jest.fn();

    act(() => {
      renderer = ReactTestRenderer.create(<LicenseScreen styles={styles as never} theme={lightTheme} onBackToSettings={jest.fn()} onOpenLicenseDetail={onOpenLicenseDetail} />);
    });

    const reactRow = renderer.root.findByProps({ accessibilityLabel: 'react のライセンス詳細を開く' });

    act(() => {
      reactRow.props.onPress();
    });

    expect(onOpenLicenseDetail).toHaveBeenCalledWith(OSS_LICENSES[0]);
  });

  test('ライセンス詳細からライセンス一覧へ戻れる', () => {
    const onBackToLicenseList = jest.fn();

    act(() => {
      renderer = ReactTestRenderer.create(<LicenseDetailScreen license={OSS_LICENSES[0]} styles={styles as never} theme={lightTheme} onBackToLicenseList={onBackToLicenseList} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('react');
    expect(texts).toContain('19.1.0');
    expect(texts).toContain('MIT');
    expect(texts).toContain('https://github.com/facebook/react');
    expect(texts).toContain('MIT License text');

    const backButton = renderer.root.findByProps({ accessibilityLabel: 'ライセンスへ戻る' });

    act(() => {
      backButton.props.onPress();
    });

    expect(onBackToLicenseList).toHaveBeenCalledTimes(1);
  });
});
