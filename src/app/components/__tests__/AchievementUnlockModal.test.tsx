import { AchievementDefinition } from '../../../features/achievements/achievementDefinitions';
import { createStyles } from '../../appStyles';
import { darkTheme, lightTheme } from '../../../theme/theme';
import { AchievementUnlockModal } from '../AchievementUnlockModal';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');

  return {
    Feather: Text,
    MaterialCommunityIcons: Text,
  };
});

const { act, create } = require('react-test-renderer') as {
  act: (callback: () => void) => void;
  create: (element: React.ReactElement) => { root: any; unmount: () => void };
};

jest.mock('../ConfettiOverlay', () => ({
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

let renderer: { root: any; unmount: () => void } | null = null;

describe('実績解除ダイアログ AchievementUnlockModal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = null;
    jest.useRealTimers();
  });

  test('10秒経過すると自動で閉じる', () => {
    const onClose = jest.fn();
    act(() => {
      renderer = create(
        <AchievementUnlockModal
          achievement={achievement}
          animationKey="1:odo-1"
          styles={styles}
          theme={lightTheme}
          onShareToX={jest.fn()}
          onClose={onClose}
        />,
      );
    });

    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('共有ボタンを押すと onShareToX を呼び自動クローズが止まる', () => {
    const onShareToX = jest.fn();
    const onClose = jest.fn();
    act(() => {
      renderer = create(
        <AchievementUnlockModal
          achievement={achievement}
          animationKey="1:odo-1"
          styles={styles}
          theme={lightTheme}
          onShareToX={onShareToX}
          onClose={onClose}
        />,
      );
    });

    const shareButton = renderer!.root.findByProps({ accessibilityLabel: 'ともだちに自慢する' });
    act(() => {
      shareButton.props.onPress();
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
