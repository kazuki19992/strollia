import { StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { lightTheme } from '@/theme/theme';
import { createStyles } from '@/ui/appStyles';
import { AboutAppScreen } from '@/ui/components/AboutAppScreen';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');

  return {
    Feather: Text,
  };
});

/** テスト用にstyle配列を単一オブジェクトへ畳み込む。 */
function flattenStyle(style: unknown): Record<string, unknown> {
  return (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
}

describe('このアプリについて画面 AboutAppScreen', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('設定へ戻れる共通ヘッダーとアプリアイコンを表示する', () => {
    const styles = createStyles(lightTheme);
    const onBackToSettings = jest.fn();

    render(<AboutAppScreen styles={styles} theme={lightTheme} onBackToSettings={onBackToSettings} />);

    // SafeAreaView のスタイル確認
    // RTL では UNSAFE_getByType を使って SafeAreaView を取得する
    const container = screen.UNSAFE_getByType(require('react-native').SafeAreaView);
    const title = screen.getByText('このアプリについて');
    // Image の accessibilityLabel で確認する
    const icon = screen.getByLabelText('すとろりあのアプリアイコン');

    fireEvent.press(screen.getByLabelText('設定へ戻る'));

    expect(container.props.style).toBe(styles.appScreen);
    expect(flattenStyle(title.props.style).position).toBe('absolute');
    // RTL ではホスト要素の type は文字列になる。Image コンポーネントとして描画されていることを確認する
    expect(icon.type).toBe('Image');
    expect(onBackToSettings).toHaveBeenCalledTimes(1);
  });

  test('ローカルファーストとプライバシーを含む本文初稿を表示する', () => {
    const styles = createStyles(lightTheme);

    render(<AboutAppScreen styles={styles} theme={lightTheme} onBackToSettings={jest.fn()} />);

    expect(screen.getByText('歩いた場所を、あなたの記録として残す')).toBeTruthy();
    expect(
      screen.getByText(
        'すとろりあは、毎日の移動や散歩の足あとを端末に残していくGPSロガーです。地図を埋めたり、日々の距離を振り返ったりしながら、自分だけの移動記録を育てていけます。',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('GPSログや移動履歴は端末内に保存します。ユーザーの明示操作なしに、移動履歴や写真メタデータを外部へ送信しません。'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        '現在地を利用する機能を追加する場合があります。その場合も、機能を明示的に有効にしたときだけ、必要な現在地情報を外部サービスへ送信する設計にします。移動履歴をサーバーに保存することはありません。',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Strollia Plusは、記録をもっと楽しく便利にするための追加機能です。基本の記録体験と、ユーザー自身がデータを扱えることを大切にします。',
      ),
    ).toBeTruthy();
  });
});
