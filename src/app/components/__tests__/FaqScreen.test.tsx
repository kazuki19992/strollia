import { SafeAreaView, StyleSheet, Text } from 'react-native';

import { lightTheme } from '../../../theme/theme';
import { createStyles } from '../../appStyles';
import { FaqScreen } from '../FaqScreen';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');

  return {
    Feather: Text,
  };
});

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

/** テスト用にstyle配列を単一オブジェクトへ畳み込む。 */
function flattenStyle(style: unknown): Record<string, unknown> {
  return (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
}

describe('よくある質問画面 FaqScreen', () => {
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

  test('設定へ戻れる共通ヘッダーを表示する', () => {
    const styles = createStyles(lightTheme);
    const onBackToSettings = jest.fn();

    act(() => {
      renderer = ReactTestRenderer.create(<FaqScreen styles={styles} theme={lightTheme} onBackToSettings={onBackToSettings} />);
    });

    const container = renderer.root.findByType(SafeAreaView);
    const title = renderer.root.findAllByType(Text).find((node: any) => node.props.children === 'よくある質問');
    const backButton = renderer.root.findByProps({ accessibilityLabel: '設定へ戻る' });

    act(() => {
      backButton.props.onPress();
    });

    expect(container.props.style).toBe(styles.appScreen);
    expect(flattenStyle(title?.props.style).position).toBe('absolute');
    expect(onBackToSettings).toHaveBeenCalledTimes(1);
  });

  test('5項目の質問タイトルをすべて表示する', () => {
    const styles = createStyles(lightTheme);

    act(() => {
      renderer = ReactTestRenderer.create(<FaqScreen styles={styles} theme={lightTheme} onBackToSettings={jest.fn()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('止まっているのに距離や軌跡が記録されることがあります');
    expect(texts).toContain('アプリを閉じても記録されますか？');
    expect(texts).toContain('GPXファイルとは何ですか？');
    expect(texts).toContain('記録したデータはサーバーに送られますか？');
    expect(texts).toContain('機種変更するとデータはどうなりますか？');
  });
});
