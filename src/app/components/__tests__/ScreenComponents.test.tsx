import { Text } from 'react-native';
import { StyleSheet } from 'react-native';

import { createStyles } from '../../appStyles';
import { darkTheme, lightTheme } from '../../../theme/theme';
import { ActionPill } from '../ActionPill';
import { AppBackButton } from '../AppBackButton';
import { AppScreenHeader } from '../AppScreenHeader';
import { InfoBlock } from '../InfoBlock';
import { SelectionTile } from '../SelectionTile';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');

  return {
    Feather: Text,
  };
});

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

/** 配列指定されたstyleを単一オブジェクトへ畳み込む。 */
function flattenStyle(style: unknown): Record<string, unknown> {
  return (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
}

describe('画面共通コンポーネント', () => {
  test('選択中タイルはプライマリー枠と10%塗りで表示する', () => {
    const styles = createStyles(lightTheme);
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SelectionTile isSelected label={'スマホの設定に\n合わせる'} styles={styles} />);
    });

    const tile = renderer.root.findByProps({ accessibilityRole: 'button' });
    const text = renderer.root.findByType(Text);
    const tileStyle = flattenStyle(tile.props.style);

    expect(tileStyle.borderColor).toBe(lightTheme.colors.primary);
    expect(tileStyle.backgroundColor).toBe('rgba(31, 122, 92, 0.10)');
    expect(tileStyle.borderWidth).toBe(4);
    expect(text.props.children).toBe('スマホの設定に\n合わせる');
  });

  test('未選択タイルはダークモードでも塗りではなくアウトライン表示にする', () => {
    const styles = createStyles(darkTheme);
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SelectionTile label="いつもダーク" styles={styles} />);
    });

    const tile = renderer.root.findByProps({ accessibilityRole: 'button' });
    const tileStyle = flattenStyle(tile.props.style);

    expect(tileStyle.backgroundColor).toBe('transparent');
    expect(tileStyle.borderColor).toBe('rgba(255, 255, 255, 0.28)');
    expect(tileStyle.borderWidth).toBe(1);
  });

  test('通常アクションはアウトラインピルとして表示し、アイコンとラベルを左寄せできる', () => {
    const styles = createStyles(lightTheme);
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<ActionPill alignLeft label="オープンソースライセンス" styles={styles} onPress={jest.fn()} />);
    });

    const pill = renderer.root.findByProps({ accessibilityRole: 'button' });
    const content = renderer.root.findAll((node: any) => flattenStyle(node.props.style).width === '100%')[0];
    const pillStyle = flattenStyle(pill.props.style);
    const contentStyle = flattenStyle(content.props.style);

    expect(pillStyle.backgroundColor).toBe('transparent');
    expect(pillStyle.borderColor).toBe('#333333');
    expect(pillStyle.borderWidth).toBe(1);
    expect(contentStyle.justifyContent).toBe('flex-start');
  });

  test('危険操作ピルは赤のアウトラインと薄い赤塗りで表示する', () => {
    const styles = createStyles(lightTheme);
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<ActionPill danger label="すべてのデータの削除" styles={styles} onPress={jest.fn()} />);
    });

    const pill = renderer.root.findByProps({ accessibilityRole: 'button' });
    const text = renderer.root.findByType(Text);
    const pillStyle = flattenStyle(pill.props.style);
    const textStyle = flattenStyle(text.props.style);

    expect(pillStyle.backgroundColor).toBe('rgba(176, 0, 47, 0.05)');
    expect(pillStyle.borderColor).toBe('#b0002f');
    expect(textStyle.color).toBe('#b0002f');
  });

  test('アクションピルは外部から背景色と文字色を指定できる', () => {
    const styles = createStyles(lightTheme);
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
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
    });

    const pill = renderer.root.findByProps({ accessibilityRole: 'button' });
    const text = renderer.root.findByType(Text);
    const pillStyle = flattenStyle(pill.props.style);
    const textStyle = flattenStyle(text.props.style);

    expect(pillStyle.backgroundColor).toBe('rgba(31, 122, 92, 0.08)');
    expect(pillStyle.borderColor).toBe(lightTheme.colors.primary);
    expect(textStyle.color).toBe(lightTheme.colors.primary);
  });

  test('説明ブロックは設定項目のタイトルと説明スタイルを共通利用する', () => {
    const styles = createStyles(lightTheme);
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<InfoBlock description="説明文" styles={styles} title="項目名" />);
    });

    const title = renderer.root.findAllByType(Text).find((node: any) => node.props.children === '項目名');
    const description = renderer.root.findAllByType(Text).find((node: any) => node.props.children === '説明文');

    expect(flattenStyle(title?.props.style).fontWeight).toBe('400');
    expect(flattenStyle(description?.props.style).color).toBe('#767676');
  });

  test('画面ヘッダーのタイトルは戻るボタン幅に影響されない中央配置にする', () => {
    const styles = createStyles(lightTheme);
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<AppScreenHeader backLabel="長い戻り先" styles={styles} theme={lightTheme} title="設定" onBack={jest.fn()} />);
    });

    const title = renderer.root.findAllByType(Text).find((node: any) => node.props.children === '設定');
    const titleStyle = flattenStyle(title?.props.style);

    expect(titleStyle.position).toBe('absolute');
    expect(titleStyle.left).toBe(0);
    expect(titleStyle.right).toBe(0);
    expect(titleStyle.textAlign).toBe('center');
  });

  test('戻るボタンは単体の共通コンポーネントとして使える', () => {
    const styles = createStyles(lightTheme);
    const onBack = jest.fn();
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<AppBackButton label="地図" styles={styles} theme={lightTheme} onPress={onBack} />);
    });

    const backButton = renderer.root.findByProps({ accessibilityLabel: '地図へ戻る' });
    const label = renderer.root.findAllByType(Text).find((node: any) => node.props.children === '地図');

    expect(flattenStyle(backButton.props.style).backgroundColor).toBe('#d9d9d9');
    expect(flattenStyle(label?.props.style).color).toBe('#333333');
  });

  test('全画面共通ヘッダーは設定画面と同じ戻るリボンと中央タイトルを使える', () => {
    const styles = createStyles(lightTheme);
    const onBack = jest.fn();
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<AppScreenHeader backLabel="地図" styles={styles} theme={lightTheme} title="実績" onBack={onBack} />);
    });

    const backButton = renderer.root.findByProps({ accessibilityLabel: '地図へ戻る' });
    const title = renderer.root.findAllByType(Text).find((node: any) => node.props.children === '実績');

    expect(flattenStyle(backButton.props.style).backgroundColor).toBe('#d9d9d9');
    expect(flattenStyle(title?.props.style).textAlign).toBe('center');
  });
});
