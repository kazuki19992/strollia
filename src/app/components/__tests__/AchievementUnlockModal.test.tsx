import { AchievementDefinition } from '../../../features/achievements/achievementDefinitions';
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
  create: (element: React.ReactElement) => { unmount: () => void };
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

const styles = {
  achievementModalBackdrop: {},
  achievementModalCard: {},
  achievementCloseButton: {},
  achievementCloseButtonIcon: { color: '#111111' },
  achievementAutoCloseTrack: {},
  achievementAutoCloseProgress: {},
  achievementModalEyebrow: {},
  achievementModalImage: {},
  achievementModalTitle: {},
  achievementModalDescription: {},
  achievementModalActions: {},
  achievementPrimaryButton: {},
  primaryButtonText: { color: '#ffffff' },
  achievementSwipeHint: {},
};

let renderer: { unmount: () => void } | null = null;

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
          styles={styles as never}
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
});
