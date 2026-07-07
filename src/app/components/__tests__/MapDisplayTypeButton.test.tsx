import { Text } from 'react-native';

import { createStyles } from '@/app/appStyles';
import { lightTheme } from '@/theme/theme';
import { MapDisplayTypeButton } from '@/app/components/MapDisplayTypeButton';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');

  return { MaterialCommunityIcons: Text };
});

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;
const styles = createStyles(lightTheme);

describe('MapDisplayTypeButton', () => {
  test('選択中の場合にmapDisplayTypeButtonSelectedスタイルを付与する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <MapDisplayTypeButton icon="map-outline" isSelected={true} label="標準マップ" styles={styles} onPress={jest.fn()} />,
      );
    });

    const pressable = renderer.root.find((node: any) => node.props.accessibilityRole === 'button');
    const flatStyle = Array.isArray(pressable.props.style) ? pressable.props.style : [pressable.props.style];
    expect(flatStyle).toContain(styles.mapDisplayTypeButtonSelected);
  });

  test('未選択の場合にmapDisplayTypeButtonSelectedスタイルを付与しない', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <MapDisplayTypeButton icon="satellite-variant" isSelected={false} label="航空写真" styles={styles} onPress={jest.fn()} />,
      );
    });

    const pressable = renderer.root.find((node: any) => node.props.accessibilityRole === 'button');
    const flatStyle = Array.isArray(pressable.props.style) ? pressable.props.style : [pressable.props.style];
    expect(flatStyle).not.toContain(styles.mapDisplayTypeButtonSelected);
  });

  test('選択中バッジを選択時だけ表示する', () => {
    let selectedRenderer: any;
    let unselectedRenderer: any;

    act(() => {
      selectedRenderer = ReactTestRenderer.create(
        <MapDisplayTypeButton icon="map-outline" isSelected={true} label="標準マップ" styles={styles} onPress={jest.fn()} />,
      );
      unselectedRenderer = ReactTestRenderer.create(
        <MapDisplayTypeButton icon="satellite-variant" isSelected={false} label="航空写真" styles={styles} onPress={jest.fn()} />,
      );
    });

    const selectedTexts = selectedRenderer.root.findAllByType(Text).map((n: any) => n.props.children);
    const unselectedTexts = unselectedRenderer.root.findAllByType(Text).map((n: any) => n.props.children);

    expect(selectedTexts).toContain('✓ 選択中');
    expect(unselectedTexts).not.toContain('✓ 選択中');
  });

  test('onPressを呼び出す', () => {
    const onPress = jest.fn();
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <MapDisplayTypeButton icon="map-outline" isSelected={false} label="標準マップ" styles={styles} onPress={onPress} />,
      );
    });

    const pressable = renderer.root.find((node: any) => node.props.accessibilityRole === 'button');
    act(() => pressable.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
