import { render, screen, fireEvent, act } from '@testing-library/react-native';

import { AchievementDefinition } from '@/features/achievements/achievementDefinitions';
import { createStyles } from '@/ui/appStyles';
import { darkTheme, lightTheme } from '@/theme/theme';
import { AchievementUnlockModal } from '@/ui/components/AchievementUnlockModal';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');

  return {
    Feather: Text,
    MaterialCommunityIcons: Text,
  };
});

jest.mock('@/ui/components/ConfettiOverlay', () => ({
  ConfettiOverlay: () => null,
}));

const achievement = {
  id: 'odo-1',
  title: '1km移動した',
  description: '総移動距離が1kmに到達しました。',
  category: 'distance',
  condition: { type: 'totalDistanceMeters', threshold: 1_000 },
  trophyImage: 1,
  trophyImageUri: null,
  shareText: 'すとろりあで1km移動したを達成しました！',
  sortOrder: 1,
  enabled: true,
} satisfies AchievementDefinition;

const styles = createStyles(lightTheme);

describe('実績解除ダイアログ AchievementUnlockModal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('10秒経過すると自動で閉じる', () => {
    const onClose = jest.fn();
    render(
      <AchievementUnlockModal achievement={achievement} animationKey="1:odo-1" styles={styles} onShareToX={jest.fn()} onClose={onClose} />,
    );

    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('共有ボタンを押すと onShareToX を呼び自動クローズが止まる', () => {
    const onShareToX = jest.fn();
    const onClose = jest.fn();
    render(
      <AchievementUnlockModal achievement={achievement} animationKey="1:odo-1" styles={styles} onShareToX={onShareToX} onClose={onClose} />,
    );

    act(() => {
      fireEvent.press(screen.getByLabelText('ともだちに自慢する'));
    });

    expect(onShareToX).toHaveBeenCalledWith(achievement);

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  test('モーダル本体の背景色は画面背景色を参照する', () => {
    const lightStyles = createStyles(lightTheme);
    const darkStyles = createStyles(darkTheme);

    expect(lightStyles.achievementModalCard.backgroundColor).toBe(lightTheme.colors.background);
    expect(darkStyles.achievementModalCard.backgroundColor).toBe(darkTheme.colors.background);
  });

  test('モーダル背面の色は画面背景色を半透明化して使う', () => {
    const lightStyles = createStyles(lightTheme);
    const darkStyles = createStyles(darkTheme);

    expect(lightStyles.achievementModalBackdrop.backgroundColor).toBe('rgba(255, 255, 255, 0.92)');
    expect(darkStyles.achievementModalBackdrop.backgroundColor).toBe('rgba(32, 32, 32, 0.92)');
  });
});
