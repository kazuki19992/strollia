import { SafeAreaView } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { lightTheme } from '@/theme/theme';
import { createStyles } from '@/ui/appStyles';
import { FaqScreen } from '@/ui/components/FaqScreen';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');

  return {
    Feather: Text,
  };
});

describe('よくある質問画面 FaqScreen', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('設定へ戻れる共通ヘッダーを表示する', () => {
    const styles = createStyles(lightTheme);
    const onBackToSettings = jest.fn();

    render(<FaqScreen styles={styles} theme={lightTheme} onBackToSettings={onBackToSettings} />);

    // SafeAreaView のスタイル確認
    // RTL では UNSAFE_getByType を使って SafeAreaView を取得する
    const container = screen.UNSAFE_getByType(SafeAreaView);
    const title = screen.getByText('よくある質問');

    fireEvent.press(screen.getByLabelText('設定へ戻る'));

    expect(container.props.style).toBe(styles.appScreen);
    expect(title).toBeTruthy();
    expect(onBackToSettings).toHaveBeenCalledTimes(1);
  });

  test('5項目の質問タイトルをすべて表示する', () => {
    const styles = createStyles(lightTheme);

    render(<FaqScreen styles={styles} theme={lightTheme} onBackToSettings={jest.fn()} />);

    expect(screen.getByText('止まっているのに距離や軌跡が記録されることがあります')).toBeTruthy();
    expect(screen.getByText('アプリを閉じても記録されますか？')).toBeTruthy();
    expect(screen.getByText('GPXファイルとは何ですか？')).toBeTruthy();
    expect(screen.getByText('記録したデータはサーバーに送られますか？')).toBeTruthy();
    expect(screen.getByText('機種変更するとデータはどうなりますか？')).toBeTruthy();
  });
});
