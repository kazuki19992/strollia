import { render, screen, fireEvent } from '@testing-library/react-native';

import { createStyles } from '@/ui/appStyles';
import { lightTheme } from '@/theme/theme';
import { BadgeFloatingButton } from '@/ui/components/BadgeFloatingButton';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');

  return { MaterialCommunityIcons: Text };
});

const styles = createStyles(lightTheme);

describe('バッジ付きフローティングボタン BadgeFloatingButton', () => {
  test('ラベルとバッジを表示し、ボタンとして読み上げられる', async () => {
    await render(
      <BadgeFloatingButton
        label="ふりかえり"
        badgeText="あと5日"
        accessibilityLabel="年間レポートをふりかえる（あと5日）"
        onPress={jest.fn()}
        styles={styles}
      />,
    );

    expect(screen.getByText('ふりかえり')).toBeTruthy();
    expect(screen.getByText('あと5日')).toBeTruthy();
    expect(screen.getByLabelText('年間レポートをふりかえる（あと5日）').props.accessibilityRole).toBe('button');
  });

  test('badgeTextがnullのときはバッジを描画しない', async () => {
    await render(
      <BadgeFloatingButton label="ふりかえり" badgeText={null} accessibilityLabel="ふりかえる" onPress={jest.fn()} styles={styles} />,
    );

    expect(screen.queryByText('あと5日')).toBeNull();
    expect(screen.getByText('ふりかえり')).toBeTruthy();
  });

  test('押すとonPressを呼ぶ', async () => {
    const onPress = jest.fn();
    await render(
      <BadgeFloatingButton label="ふりかえり" badgeText="あと1日" accessibilityLabel="ふりかえる" onPress={onPress} styles={styles} />,
    );

    await fireEvent.press(screen.getByLabelText('ふりかえる'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('disabledのときは押してもonPressを呼ばない', async () => {
    const onPress = jest.fn();
    await render(
      <BadgeFloatingButton
        label="ふりかえり"
        badgeText="あと1日"
        accessibilityLabel="ふりかえる"
        disabled
        onPress={onPress}
        styles={styles}
      />,
    );

    await fireEvent.press(screen.getByLabelText('ふりかえる'));

    expect(onPress).not.toHaveBeenCalled();
  });
});
