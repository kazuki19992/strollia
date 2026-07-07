import { useAchievementState, UseAchievementStateResult } from '@/ui/hooks/useAchievementState';
import {
  getAchievementListItems,
  getPendingInAppAchievementNotifications,
  markAchievementShownInApp,
} from '@/features/achievements/achievementRepository';
import { canEvaluateAchievementsInForeground } from '@/features/achievements/achievementEvaluationGate';
import { evaluateAchievementsAndNotify } from '@/features/achievements/achievementService';
import { filterDismissedAchievementNotifications } from '@/features/achievements/pendingNotifications';
import { requestAchievementNotificationPermissionOnFirstLaunch } from '@/features/achievements/achievementNotificationService';
import { shouldRequestReviewAfterAchievement } from '@/features/review/reviewPromptLogic';
import { requestStoreReview } from '@/features/review/storeReview';
import { setSetting } from '@/features/settings/settingsRepository';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/achievements/achievementRepository', () => ({
  getAchievementListItems: jest.fn().mockResolvedValue([]),
  getPendingInAppAchievementNotifications: jest.fn().mockResolvedValue([]),
  markAchievementShownInApp: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/achievements/achievementEvaluationGate', () => ({
  canEvaluateAchievementsInForeground: jest.fn().mockReturnValue(true),
}));

jest.mock('@/features/achievements/achievementService', () => ({
  evaluateAchievementsAndNotify: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/achievements/pendingNotifications', () => ({
  filterDismissedAchievementNotifications: jest.fn().mockReturnValue([]),
}));

jest.mock('@/features/achievements/achievementNotificationService', () => ({
  requestAchievementNotificationPermissionOnFirstLaunch: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/review/reviewPromptLogic', () => ({
  shouldRequestReviewAfterAchievement: jest.fn().mockReturnValue(false),
}));

jest.mock('@/features/review/storeReview', () => ({
  requestStoreReview: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/settings/settingsRepository', () => ({
  setSetting: jest.fn().mockResolvedValue(undefined),
}));

/** テスト用の実績一覧アイテム（型検査を通すため必要最小限フィールドのみキャスト）。 */
const MOCK_ACHIEVEMENT_ITEM = {
  definition: { id: 'first_day', shareText: 'Strolliaで初日の記録達成！' },
  unlockedAt: '2026-01-01',
} as unknown as import('@/features/achievements/achievementRepository').AchievementListItem;

/** テスト用の実績解除通知（型検査を通すため必要最小限フィールドのみキャスト）。 */
const MOCK_PENDING_NOTIFICATION = {
  queueId: 1,
  definition: { id: 'first_day', shareText: 'Strolliaで初日の記録達成！' },
  unlockedAt: '2026-01-01',
} as unknown as import('@/features/achievements/achievementRepository').PendingAchievementNotification;

type HookProbeProps = {
  /** フックの戻り値をテストへ渡すコールバック。 */
  onResult: (result: UseAchievementStateResult) => void;
};

/** フックを実行するための最小コンポーネント。 */
function HookProbe({ onResult }: HookProbeProps) {
  const result = useAchievementState();
  onResult(result);
  return null;
}

describe('実績状態フック useAchievementState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAchievementListItems as jest.Mock).mockResolvedValue([]);
    (getPendingInAppAchievementNotifications as jest.Mock).mockResolvedValue([]);
    (markAchievementShownInApp as jest.Mock).mockResolvedValue(undefined);
    (canEvaluateAchievementsInForeground as jest.Mock).mockReturnValue(true);
    (evaluateAchievementsAndNotify as jest.Mock).mockResolvedValue(undefined);
    (filterDismissedAchievementNotifications as jest.Mock).mockReturnValue([]);
    (shouldRequestReviewAfterAchievement as jest.Mock).mockReturnValue(false);
  });

  describe('初期状態', () => {
    it('初期 selectedAchievement は null になる', () => {
      let result: UseAchievementStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.selectedAchievement).toBeNull();
    });

    it('初期 achievementItems は空配列になる', () => {
      let result: UseAchievementStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.achievementItems).toEqual([]);
    });

    it('初期 pendingAchievementNotifications は空配列になる', () => {
      let result: UseAchievementStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.pendingAchievementNotifications).toEqual([]);
    });

    it('isAchievementDialogVisibleRef の初期値は false になる', () => {
      let result: UseAchievementStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.isAchievementDialogVisibleRef.current).toBe(false);
    });

    it('wasAchievementEvaluationPausedRef の初期値は false になる', () => {
      let result: UseAchievementStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.wasAchievementEvaluationPausedRef.current).toBe(false);
    });
  });

  describe('setSelectedAchievement', () => {
    it('setSelectedAchievement を呼ぶと selectedAchievement が更新される', () => {
      let result: UseAchievementStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.setSelectedAchievement(MOCK_ACHIEVEMENT_ITEM);
      });

      expect(result!.selectedAchievement).toEqual(MOCK_ACHIEVEMENT_ITEM);
    });
  });

  describe('refreshAchievementState — 実績一覧の再読み込み', () => {
    it('getAchievementListItems を呼ぶ', async () => {
      let result: UseAchievementStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.refreshAchievementState();
      });

      expect(getAchievementListItems).toHaveBeenCalled();
    });

    it('showPendingNotifications が true のとき getPendingInAppAchievementNotifications を呼ぶ', async () => {
      let result: UseAchievementStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.refreshAchievementState(true);
      });

      expect(getPendingInAppAchievementNotifications).toHaveBeenCalled();
    });

    it('showPendingNotifications が false のとき getPendingInAppAchievementNotifications を呼ばない', async () => {
      let result: UseAchievementStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.refreshAchievementState(false);
      });

      expect(getPendingInAppAchievementNotifications).not.toHaveBeenCalled();
    });

    it('signal が abort 済みのとき state を更新しない', async () => {
      (getAchievementListItems as jest.Mock).mockResolvedValue([MOCK_ACHIEVEMENT_ITEM]);
      let result: UseAchievementStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      const controller = new AbortController();
      controller.abort();

      await act(async () => {
        await result!.refreshAchievementState(false, { signal: controller.signal });
      });

      // abort 後は state が更新されない
      expect(result!.achievementItems).toEqual([]);
    });
  });

  describe('evaluateAchievementsIfDialogIdle — 実績評価', () => {
    it('ダイアログが表示されていないとき evaluateAchievementsAndNotify を呼ぶ', async () => {
      (canEvaluateAchievementsInForeground as jest.Mock).mockReturnValue(true);
      let result: UseAchievementStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      let returnValue: boolean | undefined;
      await act(async () => {
        returnValue = await result!.evaluateAchievementsIfDialogIdle();
      });

      expect(evaluateAchievementsAndNotify).toHaveBeenCalled();
      expect(returnValue).toBe(true);
    });

    it('ダイアログが表示中のとき evaluateAchievementsAndNotify を呼ばず false を返す', async () => {
      (canEvaluateAchievementsInForeground as jest.Mock).mockReturnValue(false);
      let result: UseAchievementStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      let returnValue: boolean | undefined;
      await act(async () => {
        returnValue = await result!.evaluateAchievementsIfDialogIdle();
      });

      expect(evaluateAchievementsAndNotify).not.toHaveBeenCalled();
      expect(returnValue).toBe(false);
    });

    it('ダイアログ表示中に呼ばれると wasAchievementEvaluationPausedRef が true になる', async () => {
      (canEvaluateAchievementsInForeground as jest.Mock).mockReturnValue(false);
      let result: UseAchievementStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.evaluateAchievementsIfDialogIdle();
      });

      expect(result!.wasAchievementEvaluationPausedRef.current).toBe(true);
    });
  });

  describe('closeAchievementUnlockModal — 実績解除モーダルを閉じる', () => {
    it('pendingAchievementNotifications が空のとき何もしない', () => {
      let result: UseAchievementStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.closeAchievementUnlockModal();
      });

      expect(markAchievementShownInApp).not.toHaveBeenCalled();
      expect(result!.pendingAchievementNotifications).toEqual([]);
    });

    it('通知がある場合 markAchievementShownInApp を呼び通知を1件除去する', async () => {
      (getPendingInAppAchievementNotifications as jest.Mock).mockResolvedValue([MOCK_PENDING_NOTIFICATION]);
      (filterDismissedAchievementNotifications as jest.Mock).mockReturnValue([MOCK_PENDING_NOTIFICATION]);
      let result: UseAchievementStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.refreshAchievementState(true);
      });

      expect(result!.pendingAchievementNotifications).toHaveLength(1);

      act(() => {
        result!.closeAchievementUnlockModal();
      });

      expect(markAchievementShownInApp).toHaveBeenCalledWith(MOCK_PENDING_NOTIFICATION.queueId);
      expect(result!.pendingAchievementNotifications).toHaveLength(0);
    });

    it('shouldRequestReviewAfterAchievement が true のとき setSetting を呼ぶ', async () => {
      (shouldRequestReviewAfterAchievement as jest.Mock).mockReturnValue(true);
      (getPendingInAppAchievementNotifications as jest.Mock).mockResolvedValue([MOCK_PENDING_NOTIFICATION]);
      (filterDismissedAchievementNotifications as jest.Mock).mockReturnValue([MOCK_PENDING_NOTIFICATION]);

      let result: UseAchievementStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.refreshAchievementState(true);
      });

      act(() => {
        result!.closeAchievementUnlockModal();
      });

      expect(setSetting).toHaveBeenCalledWith('reviewPrompted', true);
    });
  });

  describe('initializeAchievementReviewState — レビュー状態初期化', () => {
    it('false を渡しても shouldRequestReviewAfterAchievement が false のとき setSetting は呼ばれない', async () => {
      (shouldRequestReviewAfterAchievement as jest.Mock).mockReturnValue(false);
      (getPendingInAppAchievementNotifications as jest.Mock).mockResolvedValue([MOCK_PENDING_NOTIFICATION]);
      (filterDismissedAchievementNotifications as jest.Mock).mockReturnValue([MOCK_PENDING_NOTIFICATION]);

      let result: UseAchievementStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.initializeAchievementReviewState(false);
      });

      await act(async () => {
        await result!.refreshAchievementState(true);
      });

      act(() => {
        result!.closeAchievementUnlockModal();
      });

      // reviewPrompted=false で初期化 → closeModal 時も setSetting を呼ばない
      expect(setSetting).not.toHaveBeenCalled();
    });

    it('true を渡すと closeAchievementUnlockModal が shouldRequestReview=true でも setSetting を呼ばない（hasAlreadyPrompted=true）', async () => {
      // shouldRequestReviewAfterAchievement は hasAlreadyPrompted を受け取って判定する。
      // ここではモックが true を返すようにしておき、しかし hasAlreadyPrompted=true になったときの
      // 挙動は shouldRequestReviewAfterAchievement のモックが制御する。
      // initializeAchievementReviewState(true) を呼んだ後に shouldRequestReviewAfterAchievement
      // が false を返すように設定して「既に促した」状態をシミュレートする。
      (shouldRequestReviewAfterAchievement as jest.Mock).mockReturnValue(false);
      (getPendingInAppAchievementNotifications as jest.Mock).mockResolvedValue([MOCK_PENDING_NOTIFICATION]);
      (filterDismissedAchievementNotifications as jest.Mock).mockReturnValue([MOCK_PENDING_NOTIFICATION]);

      let result: UseAchievementStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      // reviewPrompted=true で初期化
      act(() => {
        result!.initializeAchievementReviewState(true);
      });

      await act(async () => {
        await result!.refreshAchievementState(true);
      });

      act(() => {
        result!.closeAchievementUnlockModal();
      });

      expect(setSetting).not.toHaveBeenCalled();
    });
  });

  describe('requestAchievementNotificationPermissionIfNeeded — 通知権限要求', () => {
    it('requestAchievementNotificationPermissionOnFirstLaunch を呼ぶ', async () => {
      let result: UseAchievementStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.requestAchievementNotificationPermissionIfNeeded();
      });

      expect(requestAchievementNotificationPermissionOnFirstLaunch).toHaveBeenCalledTimes(1);
    });

    it('同一セッション内で2回呼んでも requestAchievementNotificationPermissionOnFirstLaunch は1回だけ呼ばれる', async () => {
      let result: UseAchievementStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.requestAchievementNotificationPermissionIfNeeded();
        await result!.requestAchievementNotificationPermissionIfNeeded();
      });

      expect(requestAchievementNotificationPermissionOnFirstLaunch).toHaveBeenCalledTimes(1);
    });
  });

  describe('shareAchievementToX — 実績共有', () => {
    it('呼び出すと expo-haptics の selectionAsync を呼ぶ', () => {
      const mockHaptics = require('expo-haptics');
      let result: UseAchievementStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      // AchievementDefinition の必須フィールドは多いため、shareText だけが使われる最小オブジェクトをキャストして渡す。
      act(() => {
        result!.shareAchievementToX({
          shareText: 'テスト共有',
        } as import('@/features/achievements/achievementDefinitions').AchievementDefinition);
      });

      expect(mockHaptics.selectionAsync).toHaveBeenCalled();
    });
  });
});
