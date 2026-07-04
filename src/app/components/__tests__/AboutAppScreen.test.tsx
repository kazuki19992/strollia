import { Image, SafeAreaView, StyleSheet, Text } from 'react-native';

import { lightTheme } from '@/theme/theme';
import { createStyles } from '@/app/appStyles';
import { AboutAppScreen } from '@/app/components/AboutAppScreen';

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

describe('このアプリについて画面 AboutAppScreen', () => {
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

  test('設定へ戻れる共通ヘッダーとアプリアイコンを表示する', () => {
    const styles = createStyles(lightTheme);
    const onBackToSettings = jest.fn();

    act(() => {
      renderer = ReactTestRenderer.create(<AboutAppScreen styles={styles} theme={lightTheme} onBackToSettings={onBackToSettings} />);
    });

    const container = renderer.root.findByType(SafeAreaView);
    const title = renderer.root.findAllByType(Text).find((node: any) => node.props.children === 'このアプリについて');
    const icon = renderer.root.findByProps({ accessibilityLabel: 'すとろりあのアプリアイコン' });
    const backButton = renderer.root.findByProps({ accessibilityLabel: '設定へ戻る' });

    act(() => {
      backButton.props.onPress();
    });

    expect(container.props.style).toBe(styles.appScreen);
    expect(flattenStyle(title?.props.style).position).toBe('absolute');
    expect(icon.type).toBe(Image);
    expect(onBackToSettings).toHaveBeenCalledTimes(1);
  });

  test('ローカルファーストとプライバシーを含む本文初稿を表示する', () => {
    const styles = createStyles(lightTheme);

    act(() => {
      renderer = ReactTestRenderer.create(<AboutAppScreen styles={styles} theme={lightTheme} onBackToSettings={jest.fn()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('歩いた場所を、あなたの記録として残す');
    expect(texts).toContain(
      'すとろりあは、毎日の移動や散歩の足あとを端末に残していくGPSロガーです。地図を埋めたり、日々の距離を振り返ったりしながら、自分だけの移動記録を育てていけます。',
    );
    expect(texts).toContain(
      'GPSログや移動履歴は端末内に保存します。ユーザーの明示操作なしに、移動履歴や写真メタデータを外部へ送信しません。',
    );
    expect(texts).toContain(
      '現在地を利用する機能を追加する場合があります。その場合も、機能を明示的に有効にしたときだけ、必要な現在地情報を外部サービスへ送信する設計にします。移動履歴をサーバーに保存することはありません。',
    );
    expect(texts).toContain(
      'Strollia Plusは、記録をもっと楽しく便利にするための追加機能です。基本の記録体験と、ユーザー自身がデータを扱えることを大切にします。',
    );
  });
});
