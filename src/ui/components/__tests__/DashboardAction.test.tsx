import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { createStyles } from '@/ui/appStyles';
import { lightTheme } from '@/theme/theme';
import { DashboardAction } from '@/ui/components/DashboardAction';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');

  return { Feather: Text };
});

const styles = createStyles(lightTheme);

describe('DashboardAction', () => {
  test('アクセシビリティラベルとロールを付与して描画する', () => {
    render(<DashboardAction icon={<Text>icon</Text>} label="日ごとの記録" scale={1} styles={styles} onPress={jest.fn()} />);

    const pressable = screen.getByLabelText('日ごとの記録');
    expect(pressable).toBeTruthy();
    expect(pressable.props.accessibilityRole).toBe('button');
  });

  test('onPressを呼び出す', () => {
    const onPress = jest.fn();

    render(<DashboardAction icon={<Text>icon</Text>} label="設定" scale={1} styles={styles} onPress={onPress} />);

    fireEvent.press(screen.getByLabelText('設定'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
