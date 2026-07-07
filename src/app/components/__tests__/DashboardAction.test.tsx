import { Text } from 'react-native';

import { createStyles } from '@/app/appStyles';
import { lightTheme } from '@/theme/theme';
import { DashboardAction } from '@/app/components/DashboardAction';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');

  return { Feather: Text };
});

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;
const styles = createStyles(lightTheme);

describe('DashboardAction', () => {
  test('アクセシビリティラベルとロールを付与して描画する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <DashboardAction icon={<Text>icon</Text>} label="日ごとの記録" scale={1} styles={styles} onPress={jest.fn()} />,
      );
    });

    const pressable = renderer.root.find((node: any) => node.props.accessibilityLabel === '日ごとの記録');
    expect(pressable).toBeTruthy();
    expect(pressable.props.accessibilityRole).toBe('button');
  });

  test('onPressを呼び出す', () => {
    const onPress = jest.fn();
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <DashboardAction icon={<Text>icon</Text>} label="設定" scale={1} styles={styles} onPress={onPress} />,
      );
    });

    const pressable = renderer.root.find((node: any) => node.props.accessibilityLabel === '設定');
    act(() => pressable.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
