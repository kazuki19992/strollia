import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { lightTheme } from '@/theme/theme';
import { createStyles } from '@/ui/appStyles';
import { AppListItem } from '@/ui/components/AppListItem';

jest.mock('@expo/vector-icons', () => ({
  Feather: require('react-native').Text,
}));

const styles = createStyles(lightTheme);

/** モックした Feather(Text)をアイコン名で検索する。標準クエリでは特定できないホスト要素のため container を使う。 */
const iconsNamed = (name: string) => screen.container.queryAll((node) => node.props.name === name);

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

  it('titleAccessoryスロットの要素をタイトルの横に表示する', async () => {
    await render(
      <AppListItem
        accessibilityLabel="行を開く"
        styles={styles}
        theme={lightTheme}
        title="タイトル"
        titleAccessory={<Text>ラベル要素</Text>}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText('タイトル')).toBeTruthy();
    expect(screen.getByText('ラベル要素')).toBeTruthy();
  });

  it('expandedを指定しない場合は右向きの矢印のままで、開閉状態を持たない', async () => {
    await render(<AppListItem accessibilityLabel="行" styles={styles} theme={lightTheme} title="タイトル" onPress={jest.fn()} />);

    expect(iconsNamed('chevron-right')).toHaveLength(1);
    expect(iconsNamed('chevron-down')).toHaveLength(0);
    expect(screen.getByLabelText('行').props.accessibilityState?.expanded).toBeUndefined();
  });

  it('expanded=falseなら下向きの矢印を出し、右向きの矢印は出さない', async () => {
    await render(
      <AppListItem accessibilityLabel="行" expanded={false} styles={styles} theme={lightTheme} title="タイトル" onPress={jest.fn()} />,
    );

    expect(iconsNamed('chevron-down')).toHaveLength(1);
    expect(iconsNamed('chevron-right')).toHaveLength(0);
    expect(screen.getByLabelText('行').props.accessibilityState).toEqual(expect.objectContaining({ expanded: false }));
  });

  it('expanded=trueなら上向きの矢印を出し、accessibilityState.expandedがtrueになる', async () => {
    await render(<AppListItem accessibilityLabel="行" expanded styles={styles} theme={lightTheme} title="タイトル" onPress={jest.fn()} />);

    expect(iconsNamed('chevron-up')).toHaveLength(1);
    expect(iconsNamed('chevron-right')).toHaveLength(0);
    expect(screen.getByLabelText('行').props.accessibilityState).toEqual(expect.objectContaining({ expanded: true }));
  });
});
