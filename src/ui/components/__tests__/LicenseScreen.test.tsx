import { StyleSheet } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

import { lightTheme } from '@/theme/theme';
import { LicenseDetailScreen, LicenseScreen } from '@/ui/components/LicenseScreen';
import { OSS_LICENSES } from '@/ui/generated/ossLicenses';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');

  return {
    Feather: Text,
  };
});

jest.mock('@/ui/generated/ossLicenses', () => ({
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
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('生成済みOSSライセンスをライブラリ名だけのリストで表示する', () => {
    render(<LicenseScreen styles={styles as never} theme={lightTheme} onBackToSettings={jest.fn()} onOpenLicenseDetail={jest.fn()} />);

    expect(screen.getByText('ライセンス')).toBeTruthy();
    expect(screen.getByText('react')).toBeTruthy();
    expect(screen.getByText('expo')).toBeTruthy();
    expect(screen.queryByText('19.1.0')).toBeNull();
    expect(screen.queryByText('MIT')).toBeNull();
    expect(screen.queryByText('MIT License text')).toBeNull();
  });

  test('画面タイトルは中央配置の共通ヘッダーで表示する', () => {
    const realStyles = require('../../appStyles').createStyles(lightTheme);

    render(<LicenseScreen styles={realStyles} theme={lightTheme} onBackToSettings={jest.fn()} onOpenLicenseDetail={jest.fn()} />);

    const title = screen.getByText('ライセンス');

    expect(flattenStyle(title.props.style).position).toBe('absolute');
    expect(flattenStyle(title.props.style).textAlign).toBe('center');
  });

  test('設定ボタンで設定画面に戻る', () => {
    const onBackToSettings = jest.fn();
    const realStyles = require('../../appStyles').createStyles(lightTheme);

    render(<LicenseScreen styles={realStyles} theme={lightTheme} onBackToSettings={onBackToSettings} onOpenLicenseDetail={jest.fn()} />);

    // SafeAreaView のスタイル確認
    // RTL では UNSAFE_getByType を使って SafeAreaView を取得する
    const container = screen.UNSAFE_getByType(require('react-native').SafeAreaView);
    const title = screen.getByText('ライセンス');

    act(() => {
      fireEvent.press(screen.getByLabelText('設定へ戻る'));
    });

    expect(container.props.style).toBe(realStyles.appScreen);
    expect(flattenStyle(title.props.style).position).toBe('absolute');
    expect(onBackToSettings).toHaveBeenCalledTimes(1);
  });

  test('リスト項目をタップすると選択したライセンス詳細へ遷移する', () => {
    const onOpenLicenseDetail = jest.fn();

    render(
      <LicenseScreen styles={styles as never} theme={lightTheme} onBackToSettings={jest.fn()} onOpenLicenseDetail={onOpenLicenseDetail} />,
    );

    act(() => {
      fireEvent.press(screen.getByLabelText('react のライセンス詳細を開く'));
    });

    expect(onOpenLicenseDetail).toHaveBeenCalledWith(OSS_LICENSES[0]);
  });

  test('ライセンス詳細からライセンス一覧へ戻れる', () => {
    const onBackToLicenseList = jest.fn();
    const realStyles = require('../../appStyles').createStyles(lightTheme);

    render(
      <LicenseDetailScreen license={OSS_LICENSES[0]} styles={realStyles} theme={lightTheme} onBackToLicenseList={onBackToLicenseList} />,
    );

    // SafeAreaView のスタイル確認
    // RTL では UNSAFE_getByType を使って SafeAreaView を取得する
    const container = screen.UNSAFE_getByType(require('react-native').SafeAreaView);
    const title = screen.getByText('詳細');

    expect(screen.getByText('react')).toBeTruthy();
    expect(screen.getByText('19.1.0')).toBeTruthy();
    expect(screen.getByText('MIT')).toBeTruthy();
    expect(screen.getByText('https://github.com/facebook/react')).toBeTruthy();
    expect(screen.getByText('MIT License text')).toBeTruthy();

    act(() => {
      fireEvent.press(screen.getByLabelText('ライセンスへ戻る'));
    });

    expect(container.props.style).toBe(realStyles.appScreen);
    expect(flattenStyle(title.props.style).position).toBe('absolute');
    expect(onBackToLicenseList).toHaveBeenCalledTimes(1);
  });
});
