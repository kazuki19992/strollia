import { Text } from 'react-native';
import { StyleSheet } from 'react-native';

import { createStyles } from '../../appStyles';
import { darkTheme, lightTheme } from '../../../theme/theme';
import { SettingsActionPill, SettingsInfoBlock, SettingsScreenHeader, SettingsSelectionTile } from '../SettingsControls';

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

describe('設定UI共通コンポーネント SettingsControls', () => {
  test('選択中タイルはプライマリー枠と10%塗りで表示する', () => {
    const styles = createStyles(lightTheme);
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsSelectionTile isSelected label={'スマホの設定に\n合わせる'} styles={styles} />);
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
      renderer = ReactTestRenderer.create(<SettingsSelectionTile label="いつもダーク" styles={styles} />);
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
      renderer = ReactTestRenderer.create(<SettingsActionPill alignLeft label="オープンソースライセンス" styles={styles} onPress={jest.fn()} />);
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
      renderer = ReactTestRenderer.create(<SettingsActionPill danger label="すべてのデータの削除" styles={styles} onPress={jest.fn()} />);
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
        <SettingsActionPill
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
      renderer = ReactTestRenderer.create(<SettingsInfoBlock description="説明文" styles={styles} title="項目名" />);
    });

    const title = renderer.root.findAllByType(Text).find((node: any) => node.props.children === '項目名');
    const description = renderer.root.findAllByType(Text).find((node: any) => node.props.children === '説明文');

    expect(flattenStyle(title?.props.style).fontWeight).toBe('400');
    expect(flattenStyle(description?.props.style).color).toBe('#a0a0a0');
  });

  test('画面ヘッダーのタイトルは戻るボタン幅に影響されない中央配置にする', () => {
    const styles = createStyles(lightTheme);
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreenHeader backLabel="長い戻り先" styles={styles} theme={lightTheme} title="設定" onBack={jest.fn()} />);
    });

    const title = renderer.root.findAllByType(Text).find((node: any) => node.props.children === '設定');
    const titleStyle = flattenStyle(title?.props.style);

    expect(titleStyle.position).toBe('absolute');
    expect(titleStyle.left).toBe(0);
    expect(titleStyle.right).toBe(0);
    expect(titleStyle.textAlign).toBe('center');
  });
});
