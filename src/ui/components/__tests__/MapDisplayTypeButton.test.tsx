import { render, screen, fireEvent, act } from '@testing-library/react-native';

import { createStyles } from '@/ui/appStyles';
import { lightTheme } from '@/theme/theme';
import { MapDisplayTypeButton } from '@/ui/components/MapDisplayTypeButton';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');

  return { MaterialCommunityIcons: Text };
});

const styles = createStyles(lightTheme);

describe('MapDisplayTypeButton', () => {
  test('選択中の場合にmapDisplayTypeButtonSelectedスタイルを付与する', () => {
    render(<MapDisplayTypeButton icon="map-outline" isSelected={true} label="標準マップ" styles={styles} onPress={jest.fn()} />);

    const pressable = screen.getByRole('button');
    const flatStyle = Array.isArray(pressable.props.style) ? pressable.props.style : [pressable.props.style];
    expect(flatStyle).toContain(styles.mapDisplayTypeButtonSelected);
  });

  test('未選択の場合にmapDisplayTypeButtonSelectedスタイルを付与しない', () => {
    render(<MapDisplayTypeButton icon="satellite-variant" isSelected={false} label="航空写真" styles={styles} onPress={jest.fn()} />);

    const pressable = screen.getByRole('button');
    const flatStyle = Array.isArray(pressable.props.style) ? pressable.props.style : [pressable.props.style];
    expect(flatStyle).not.toContain(styles.mapDisplayTypeButtonSelected);
  });

  test('選択中バッジを選択時だけ表示する', () => {
    const { unmount } = render(
      <MapDisplayTypeButton icon="map-outline" isSelected={true} label="標準マップ" styles={styles} onPress={jest.fn()} />,
    );

    expect(screen.getByText('✓ 選択中')).toBeTruthy();
    unmount();

    render(<MapDisplayTypeButton icon="satellite-variant" isSelected={false} label="航空写真" styles={styles} onPress={jest.fn()} />);
    expect(screen.queryByText('✓ 選択中')).toBeNull();
  });

  test('onPressを呼び出す', () => {
    const onPress = jest.fn();
    render(<MapDisplayTypeButton icon="map-outline" isSelected={false} label="標準マップ" styles={styles} onPress={onPress} />);

    act(() => {
      fireEvent.press(screen.getByRole('button'));
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
