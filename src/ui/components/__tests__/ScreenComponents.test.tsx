import { StyleSheet } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

import { createStyles } from '@/ui/appStyles';
import { darkTheme, lightTheme } from '@/theme/theme';
import { ActionPill } from '@/ui/components/ActionPill';
import { AppBackButton } from '@/ui/components/AppBackButton';
import { AppScreenHeader } from '@/ui/components/AppScreenHeader';
import { InfoBlock } from '@/ui/components/InfoBlock';
import { SelectionTile } from '@/ui/components/SelectionTile';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');

  return {
    Feather: Text,
  };
});

/** 配列指定されたstyleを単一オブジェクトへ畳み込む。 */
function flattenStyle(style: unknown): Record<string, unknown> {
  return (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
}

describe('画面共通コンポーネント', () => {
  test('選択中タイルはプライマリー枠と10%塗りで表示する', () => {
    const styles = createStyles(lightTheme);
    render(<SelectionTile isSelected label={'スマホの設定に\n合わせる'} styles={styles} />);

    const tile = screen.getByLabelText('スマホの設定に 合わせる');
    const text = screen.getByText('スマホの設定に\n合わせる');
    const tileStyle = flattenStyle(tile.props.style);

    expect(tile.props.accessibilityRole).toBe('button');
    expect(tile.props.accessibilityState).toEqual({ disabled: true, selected: true });
    expect(tileStyle.borderColor).toBe(lightTheme.colors.primary);
    expect(tileStyle.backgroundColor).toBe('rgba(31, 122, 92, 0.10)');
    expect(tileStyle.borderWidth).toBe(4);
    expect(text.props.children).toBe('スマホの設定に\n合わせる');
  });

  test('未選択タイルはダークモードでも塗りではなくアウトライン表示にする', () => {
    const styles = createStyles(darkTheme);
    render(<SelectionTile label="いつもダーク" styles={styles} />);

    const tile = screen.getByLabelText('いつもダーク');
    const tileStyle = flattenStyle(tile.props.style);

    expect(tile.props.accessibilityState).toEqual({ disabled: true, selected: false });
    expect(tileStyle.backgroundColor).toBe('transparent');
    expect(tileStyle.borderColor).toBe('rgba(255, 255, 255, 0.28)');
    expect(tileStyle.borderWidth).toBe(1);
  });

  test('通常アクションはアウトラインピルとして表示し、アイコンとラベルを左寄せできる', () => {
    const styles = createStyles(lightTheme);
    render(<ActionPill alignLeft label="オープンソースライセンス" styles={styles} onPress={jest.fn()} />);

    const pill = screen.getByRole('button');
    // width='100%' の View コンテナを UNSAFE_getAllByProps で探す
    // justifyContent という非セマンティックな props を確認するため UNSAFE を使う
    const content = screen
      .UNSAFE_getAllByProps({})
      .find((node) => flattenStyle(node.props.style).width === '100%' && flattenStyle(node.props.style).justifyContent !== undefined);
    const pillStyle = flattenStyle(pill.props.style);
    const contentStyle = content ? flattenStyle(content.props.style) : {};

    expect(pillStyle.backgroundColor).toBe('transparent');
    expect(pillStyle.borderColor).toBe('#333333');
    expect(pillStyle.borderWidth).toBe(1);
    expect(contentStyle.justifyContent).toBe('flex-start');
  });

  test('危険操作ピルは赤のアウトラインと薄い赤塗りで表示する', () => {
    const styles = createStyles(lightTheme);
    render(<ActionPill danger label="すべてのデータの削除" styles={styles} onPress={jest.fn()} />);

    const pill = screen.getByRole('button');
    const text = screen.getByText('すべてのデータの削除');
    const pillStyle = flattenStyle(pill.props.style);
    const textStyle = flattenStyle(text.props.style);

    expect(pillStyle.backgroundColor).toBe('rgba(176, 0, 47, 0.05)');
    expect(pillStyle.borderColor).toBe('#b0002f');
    expect(textStyle.color).toBe('#b0002f');
  });

  test('アクションピルは外部から背景色と文字色を指定できる', () => {
    const styles = createStyles(lightTheme);
    render(
      <ActionPill
        alignLeft
        backgroundColor="rgba(31, 122, 92, 0.08)"
        borderColor={lightTheme.colors.primary}
        label="月払い(300円)ではじめる！"
        styles={styles}
        textColor={lightTheme.colors.primary}
        onPress={jest.fn()}
      />,
    );

    const pill = screen.getByRole('button');
    const text = screen.getByText('月払い(300円)ではじめる！');
    const pillStyle = flattenStyle(pill.props.style);
    const textStyle = flattenStyle(text.props.style);

    expect(pillStyle.backgroundColor).toBe('rgba(31, 122, 92, 0.08)');
    expect(pillStyle.borderColor).toBe(lightTheme.colors.primary);
    expect(textStyle.color).toBe(lightTheme.colors.primary);
  });

  test('説明ブロックは設定項目のタイトルと説明スタイルを共通利用する', () => {
    const styles = createStyles(lightTheme);
    render(<InfoBlock description="説明文" styles={styles} title="項目名" />);

    const title = screen.getByText('項目名');
    const description = screen.getByText('説明文');

    expect(flattenStyle(title.props.style).fontWeight).toBe('400');
    expect(flattenStyle(description.props.style).color).toBe('#767676');
  });

  test('画面ヘッダーのタイトルは戻るボタン幅に影響されない中央配置にする', () => {
    const styles = createStyles(lightTheme);
    render(<AppScreenHeader backLabel="長い戻り先" styles={styles} theme={lightTheme} title="設定" onBack={jest.fn()} />);

    const title = screen.getByText('設定');
    const titleStyle = flattenStyle(title.props.style);

    expect(titleStyle.position).toBe('absolute');
    expect(titleStyle.left).toBe(0);
    expect(titleStyle.right).toBe(0);
    expect(titleStyle.textAlign).toBe('center');
  });

  test('戻るボタンは単体の共通コンポーネントとして使える', () => {
    const styles = createStyles(lightTheme);
    const onBack = jest.fn();
    render(<AppBackButton label="地図" styles={styles} theme={lightTheme} onPress={onBack} />);

    const backButton = screen.getByLabelText('地図へ戻る');
    const label = screen.getByText('地図');

    act(() => {
      fireEvent.press(backButton);
    });

    expect(flattenStyle(backButton.props.style).backgroundColor).toBe('#d9d9d9');
    expect(flattenStyle(label.props.style).color).toBe('#333333');
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('全画面共通ヘッダーは設定画面と同じ戻るリボンと中央タイトルを使える', () => {
    const styles = createStyles(lightTheme);
    const onBack = jest.fn();
    render(<AppScreenHeader backLabel="地図" styles={styles} theme={lightTheme} title="実績" onBack={onBack} />);

    const backButton = screen.getByLabelText('地図へ戻る');
    const title = screen.getByText('実績');

    act(() => {
      fireEvent.press(backButton);
    });

    expect(flattenStyle(backButton.props.style).backgroundColor).toBe('#d9d9d9');
    expect(flattenStyle(title.props.style).textAlign).toBe('center');
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
