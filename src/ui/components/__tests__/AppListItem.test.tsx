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
  it('タイトル・サブタイトル・補足を表示し、押下で通知する', async () => {
    const onPress = jest.fn();
    await render(
      <AppListItem
        accessibilityLabel="行を開く"
        detail="詳細"
        styles={styles}
        subtitle="サブ"
        theme={lightTheme}
        title="タイトル"
        onPress={onPress}
      />,
    );

    expect(screen.getByText('タイトル')).toBeTruthy();
    expect(screen.getByText('サブ')).toBeTruthy();
    expect(screen.getByText('詳細')).toBeTruthy();

    await act(async () => {
      await fireEvent.press(screen.getByLabelText('行を開く'));
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('leadingスロットの要素を先頭に表示する', async () => {
    await render(
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

  it('footerスロットの要素をタイトル・サブタイトルの下に表示する', async () => {
    await render(
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

  it('trailingスロットの要素をchevron-rightの手前に表示する', async () => {
    await render(
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

  it('trailingを指定しない場合は何も追加表示しない', async () => {
    await render(<AppListItem accessibilityLabel="行を開く" styles={styles} theme={lightTheme} title="タイトル" onPress={jest.fn()} />);

    expect(screen.queryByText('末尾要素')).toBeNull();
  });

  it('showChevronを指定しない場合はchevron-rightを表示する(既定true)', async () => {
    await render(<AppListItem accessibilityLabel="行を開く" styles={styles} theme={lightTheme} title="タイトル" onPress={jest.fn()} />);

    // Featherをテキストへモックしているため、name propで対象のアイコンを特定する
    // (RNTL v14 で UNSAFE_getByProps が廃止されたため、container からホスト要素を props で検索する)
    expect(screen.container.queryAll((node) => node.props.name === 'chevron-right')).toHaveLength(1);
  });

  it('showChevron={false}の場合はchevron-rightを表示しない(画面遷移しない行の誤誘導防止)', async () => {
    await render(
      <AppListItem
        accessibilityLabel="行を開く"
        showChevron={false}
        styles={styles}
        theme={lightTheme}
        title="タイトル"
        onPress={jest.fn()}
      />,
    );

    expect(screen.container.queryAll((node) => node.props.name === 'chevron-right')).toHaveLength(0);
  });
});
