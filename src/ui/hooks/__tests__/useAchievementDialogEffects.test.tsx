import { MutableRefObject } from 'react';
import { Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useAchievementDialogEffects, UseAchievementDialogEffectsArgs } from '@/ui/hooks/useAchievementDialogEffects';
import { PendingAchievementNotification } from '@/features/achievements/achievementRepository';
import { AchievementDefinition } from '@/features/achievements/achievementDefinitions';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success' },
}));

/** テスト用の最小 AchievementDefinition を作る。 */
function makeDefinition(): AchievementDefinition {
  return {
    id: 'first_step',
    title: 'ファーストステップ',
    description: '初めての記録',
    category: 'distance',
    condition: { type: 'totalDistanceKm', threshold: 1 },
    trophyImage: 0,
    trophyImageUri: null,
    shareText: 'テスト',
    sortOrder: 0,
    enabled: true,
  } as unknown as AchievementDefinition;
}

/** テスト用の最小 PendingAchievementNotification を作る。 */
function makeNotification(): PendingAchievementNotification {
  return {
    queueId: 1,
    definition: makeDefinition(),
  };
}

/** hookを実行するための最小コンポーネント。 */
function HookProbe(props: UseAchievementDialogEffectsArgs) {
  useAchievementDialogEffects(props);
  return null;
}

describe('実績ダイアログ副作用 useAchievementDialogEffects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
    jest.spyOn(Vibration, 'cancel').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('isAchievementDialogVisibleRef の更新', () => {
    it('activeAchievementNotification があるときは ref が true になる', () => {
      const isAchievementDialogVisibleRef: MutableRefObject<boolean> = { current: false };
      const wasAchievementEvaluationPausedRef: MutableRefObject<boolean> = { current: false };

      act(() => {
        ReactTestRenderer.create(
          <HookProbe
            activeAchievementNotification={makeNotification()}
            isReady
            appState="active"
            isAchievementDialogVisibleRef={isAchievementDialogVisibleRef}
            wasAchievementEvaluationPausedRef={wasAchievementEvaluationPausedRef}
            refreshDataAndEvaluateAchievementsIfDialogIdle={jest.fn().mockResolvedValue(undefined)}
            setMessage={jest.fn()}
          />,
        );
      });

      expect(isAchievementDialogVisibleRef.current).toBe(true);
    });

    it('activeAchievementNotification が null のときは ref が false になる', () => {
      const isAchievementDialogVisibleRef: MutableRefObject<boolean> = { current: true };
      const wasAchievementEvaluationPausedRef: MutableRefObject<boolean> = { current: false };

      act(() => {
        ReactTestRenderer.create(
          <HookProbe
            activeAchievementNotification={null}
            isReady
            appState="active"
            isAchievementDialogVisibleRef={isAchievementDialogVisibleRef}
            wasAchievementEvaluationPausedRef={wasAchievementEvaluationPausedRef}
            refreshDataAndEvaluateAchievementsIfDialogIdle={jest.fn().mockResolvedValue(undefined)}
            setMessage={jest.fn()}
          />,
        );
      });

      expect(isAchievementDialogVisibleRef.current).toBe(false);
    });
  });

  describe('通知時の Haptics / Vibration', () => {
    it('activeAchievementNotification が設定されると Haptics.notificationAsync を呼ぶ', () => {
      const isAchievementDialogVisibleRef: MutableRefObject<boolean> = { current: false };
      const wasAchievementEvaluationPausedRef: MutableRefObject<boolean> = { current: false };

      act(() => {
        ReactTestRenderer.create(
          <HookProbe
            activeAchievementNotification={makeNotification()}
            isReady
            appState="active"
            isAchievementDialogVisibleRef={isAchievementDialogVisibleRef}
            wasAchievementEvaluationPausedRef={wasAchievementEvaluationPausedRef}
            refreshDataAndEvaluateAchievementsIfDialogIdle={jest.fn().mockResolvedValue(undefined)}
            setMessage={jest.fn()}
          />,
        );
      });

      expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    });

    it('activeAchievementNotification が設定されると Vibration.vibrate を呼ぶ', () => {
      const isAchievementDialogVisibleRef: MutableRefObject<boolean> = { current: false };
      const wasAchievementEvaluationPausedRef: MutableRefObject<boolean> = { current: false };

      act(() => {
        ReactTestRenderer.create(
          <HookProbe
            activeAchievementNotification={makeNotification()}
            isReady
            appState="active"
            isAchievementDialogVisibleRef={isAchievementDialogVisibleRef}
            wasAchievementEvaluationPausedRef={wasAchievementEvaluationPausedRef}
            refreshDataAndEvaluateAchievementsIfDialogIdle={jest.fn().mockResolvedValue(undefined)}
            setMessage={jest.fn()}
          />,
        );
      });

      expect(Vibration.vibrate).toHaveBeenCalledWith(1000);
    });

    it('activeAchievementNotification が null のときは Haptics を呼ばない', () => {
      const isAchievementDialogVisibleRef: MutableRefObject<boolean> = { current: false };
      const wasAchievementEvaluationPausedRef: MutableRefObject<boolean> = { current: false };

      act(() => {
        ReactTestRenderer.create(
          <HookProbe
            activeAchievementNotification={null}
            isReady
            appState="active"
            isAchievementDialogVisibleRef={isAchievementDialogVisibleRef}
            wasAchievementEvaluationPausedRef={wasAchievementEvaluationPausedRef}
            refreshDataAndEvaluateAchievementsIfDialogIdle={jest.fn().mockResolvedValue(undefined)}
            setMessage={jest.fn()}
          />,
        );
      });

      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('ダイアログが消えた後の評価再開', () => {
    it('ダイアログが消えて isReady=true かつ active 状態なら refreshData を呼ぶ', async () => {
      const isAchievementDialogVisibleRef: MutableRefObject<boolean> = { current: false };
      const wasAchievementEvaluationPausedRef: MutableRefObject<boolean> = { current: true };
      const refreshData = jest.fn().mockResolvedValue(undefined);

      await act(async () => {
        ReactTestRenderer.create(
          <HookProbe
            activeAchievementNotification={null}
            isReady
            appState="active"
            isAchievementDialogVisibleRef={isAchievementDialogVisibleRef}
            wasAchievementEvaluationPausedRef={wasAchievementEvaluationPausedRef}
            refreshDataAndEvaluateAchievementsIfDialogIdle={refreshData}
            setMessage={jest.fn()}
          />,
        );
        await Promise.resolve();
      });

      expect(refreshData).toHaveBeenCalledTimes(1);
    });

    it('ダイアログ表示中は refreshData を呼ばない', async () => {
      const isAchievementDialogVisibleRef: MutableRefObject<boolean> = { current: false };
      const wasAchievementEvaluationPausedRef: MutableRefObject<boolean> = { current: true };
      const refreshData = jest.fn().mockResolvedValue(undefined);

      await act(async () => {
        ReactTestRenderer.create(
          <HookProbe
            activeAchievementNotification={makeNotification()}
            isReady
            appState="active"
            isAchievementDialogVisibleRef={isAchievementDialogVisibleRef}
            wasAchievementEvaluationPausedRef={wasAchievementEvaluationPausedRef}
            refreshDataAndEvaluateAchievementsIfDialogIdle={refreshData}
            setMessage={jest.fn()}
          />,
        );
        await Promise.resolve();
      });

      expect(refreshData).not.toHaveBeenCalled();
    });

    it('isReady=false のときは refreshData を呼ばない', async () => {
      const isAchievementDialogVisibleRef: MutableRefObject<boolean> = { current: false };
      const wasAchievementEvaluationPausedRef: MutableRefObject<boolean> = { current: true };
      const refreshData = jest.fn().mockResolvedValue(undefined);

      await act(async () => {
        ReactTestRenderer.create(
          <HookProbe
            activeAchievementNotification={null}
            isReady={false}
            appState="active"
            isAchievementDialogVisibleRef={isAchievementDialogVisibleRef}
            wasAchievementEvaluationPausedRef={wasAchievementEvaluationPausedRef}
            refreshDataAndEvaluateAchievementsIfDialogIdle={refreshData}
            setMessage={jest.fn()}
          />,
        );
        await Promise.resolve();
      });

      expect(refreshData).not.toHaveBeenCalled();
    });

    it('refreshData が失敗した場合は setMessage にエラーメッセージが渡される', async () => {
      const isAchievementDialogVisibleRef: MutableRefObject<boolean> = { current: false };
      const wasAchievementEvaluationPausedRef: MutableRefObject<boolean> = { current: true };
      const setMessage = jest.fn();
      const refreshData = jest.fn().mockRejectedValue(new Error('load failed'));

      await act(async () => {
        ReactTestRenderer.create(
          <HookProbe
            activeAchievementNotification={null}
            isReady
            appState="active"
            isAchievementDialogVisibleRef={isAchievementDialogVisibleRef}
            wasAchievementEvaluationPausedRef={wasAchievementEvaluationPausedRef}
            refreshDataAndEvaluateAchievementsIfDialogIdle={refreshData}
            setMessage={setMessage}
          />,
        );
        await Promise.resolve();
      });

      expect(setMessage).toHaveBeenCalledWith('load failed');
    });
  });
});
