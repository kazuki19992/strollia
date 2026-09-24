import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { lightTheme } from '@/theme/theme';
import { createStyles } from '@/ui/appStyles';
import { AppListItem } from '@/ui/components/AppListItem';

jest.mock('@expo/vector-icons', () => ({
  Feather: require('react-native').Text,
}));

const styles = createStyles(lightTheme);

describe('共通リスト行 AppListItem', () => {
  it('タイトル・サブタイトル・補足を表示し、押下で通知する', () => {
    const onPress = jest.fn();
    render(
      <AppListItem accessibilityLabel="行を開く" detail="詳細" styles={styles} subtitle="サブ" theme={lightTheme} title="タイトル" onPress={onPress} />,
    );

    expect(screen.getByText('タイトル')).toBeTruthy();
    expect(screen.getByText('サブ')).toBeTruthy();
    expect(screen.getByText('詳細')).toBeTruthy();

    act(() => {
      fireEvent.press(screen.getByLabelText('行を開く'));
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('leadingスロットの要素を先頭に表示する', () => {
    render(
      <AppListItem
        accessibilityLabel="行を開く"
        leading={<Text>先頭要素</Text>}
        styles={styles}
        theme={lightTheme}
        title="タイトル"
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText('先頭要素')).toBeTruthy();
  });

  it('footerスロットの要素をタイトル・サブタイトルの下に表示する', () => {
    render(
      <AppListItem
        accessibilityLabel="行を開く"
        footer={<Text>フッター要素</Text>}
        styles={styles}
        theme={lightTheme}
        title="タイトル"
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText('フッター要素')).toBeTruthy();
  });

  it('trailingスロットの要素をchevron-rightの手前に表示する', () => {
    render(
      <AppListItem
        accessibilityLabel="行を開く"
        styles={styles}
        theme={lightTheme}
        title="タイトル"
        trailing={<Text>末尾要素</Text>}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText('末尾要素')).toBeTruthy();
  });

  it('trailingを指定しない場合は何も追加表示しない', () => {
    render(<AppListItem accessibilityLabel="行を開く" styles={styles} theme={lightTheme} title="タイトル" onPress={jest.fn()} />);

    expect(screen.queryByText('末尾要素')).toBeNull();
  });
});
