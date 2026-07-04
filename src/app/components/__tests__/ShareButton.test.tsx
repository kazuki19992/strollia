import { Text } from 'react-native';

import { ShareButton } from '@/app/components/ShareButton';

jest.mock('@expo/vector-icons', () => ({
  Feather: require('react-native').Text,
}));

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

describe('共有ボタン ShareButton', () => {
  it('ラベル付き共有ボタンを押すとonPressを呼ぶ', () => {
    const onPress = jest.fn();
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ShareButton accessibilityLabel="共有する" iconColor="#ffffff" label="共有" style={{}} textStyle={{}} onPress={onPress} />,
      );
    });

    act(() => {
      renderer.root.findByProps({ accessibilityLabel: '共有する' }).props.onPress();
    });

    expect(renderer.root.findAllByType(Text).map((node: any) => node.props.children)).toContain('共有');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ラベルなしのアイコン共有ボタンとしても表示できる', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ShareButton accessibilityLabel="レポートを共有" iconColor="#777777" style={{}} onPress={jest.fn()} />,
      );
    });

    expect(renderer.root.findByProps({ accessibilityLabel: 'レポートを共有' })).toBeTruthy();
  });
});
