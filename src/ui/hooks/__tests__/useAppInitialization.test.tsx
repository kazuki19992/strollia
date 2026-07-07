import { useAppInitialization, UseAppInitializationOptions } from '@/ui/hooks/useAppInitialization';
import { initializeDatabase } from '@/db/database';
import { loadAppFonts } from '@/theme/fonts';
import { getConfirmedPremiumAccessState, getDefaultPremiumAccessState } from '@/features/premium/revenueCatAccess';
import { resolveInitialPremiumAccess } from '@/features/premium/initialPremiumAccess';
import { getBooleanSetting, getStringSetting, setSetting } from '@/features/settings/settingsRepository';
import {
  initializeAchievementNotificationHandler,
  setupAchievementNotificationChannel,
} from '@/features/achievements/achievementNotificationService';
import { setupMonthlyReportNotificationChannel } from '@/features/reports/monthlyReportNotificationService';
import { evaluateAchievementsAndNotify } from '@/features/achievements/achievementService';
import { isWhileInUseOnlyMode } from '@/features/location/locationPermission';
import { shouldResetAchievementsOnLaunch } from '@/config/developmentFlags';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

jest.mock('@/db/database', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/theme/fonts', () => ({
  loadAppFonts: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/premium/revenueCatAccess', () => ({
  getConfirmedPremiumAccessState: jest.fn(),
  getDefaultPremiumAccessState: jest.fn(() => ({ isPlusActive: false, entitlementId: 'strollia_plus' })),
}));

jest.mock('@/features/premium/initialPremiumAccess', () => ({
  resolveInitialPremiumAccess: jest.fn().mockResolvedValue({ isPlusActive: false, entitlementId: 'strollia_plus' }),
}));

jest.mock('@/features/settings/settingsRepository', () => ({
  getBooleanSetting: jest.fn().mockResolvedValue(false),
  getStringSetting: jest.fn().mockResolvedValue('default'),
  setSetting: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/achievements/achievementNotificationService', () => ({
  initializeAchievementNotificationHandler: jest.fn(),
  setupAchievementNotificationChannel: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/reports/monthlyReportNotificationService', () => ({
  setupMonthlyReportNotificationChannel: jest.fn().mockResolvedValue(undefined),
  syncMonthlyReportNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/achievements/achievementService', () => ({
  evaluateAchievementsAndNotify: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/location/locationPermission', () => ({
  isWhileInUseOnlyMode: jest.fn().mockReturnValue(false),
}));

jest.mock('@/config/developmentFlags', () => ({
  shouldResetAchievementsOnLaunch: jest.fn().mockReturnValue(false),
  hasEnabledDevelopmentFlags: jest.fn().mockReturnValue(false),
}));

/** テスト用のデフォルト権限状態（バックグラウンド許可済み）。 */
const DEFAULT_PERMISSION_STATE = {
  foregroundGranted: true,
  backgroundGranted: true,
  canAskForeground: false,
  canAskBackground: false,
};

/** テスト用のデフォルト refreshData 戻り値。 */
const DEFAULT_REFRESH_RESULT = {
  logs: [],
  allPoints: [],
  recording: false,
  permissions: DEFAULT_PERMISSION_STATE,
};

/** テスト用の初期化オプションを生成する（各テストでオーバーライド可能）。 */
function makeOptions(overrides: Partial<UseAppInitializationOptions> = {}): UseAppInitializationOptions {
  return {
    initializePremiumAccess: jest.fn(),
    applySavedIconSettings: jest.fn().mockResolvedValue(undefined),
    initializePhotoSetting: jest.fn(),
    refreshData: jest.fn().mockResolvedValue(DEFAULT_REFRESH_RESULT),
    synchronizeLocationRecordingMode: jest.fn().mockResolvedValue(undefined),
    initializeAchievementReviewState: jest.fn(),
    refreshAchievementState: jest.fn().mockResolvedValue(undefined),
    requestAchievementNotificationPermissionIfNeeded: jest.fn().mockResolvedValue(undefined),
    snapshotPremiumAccessUpdateVersion: jest.fn().mockReturnValue(0),
    setKeepScreenAwake: jest.fn(),
    setMessage: jest.fn(),
    setIsWhileInUseToastVisible: jest.fn(),
    setIsReady: jest.fn(),
    setFirstLaunchTutorialMode: jest.fn(),
    setIsFirstLaunchTutorialVisible: jest.fn(),
    ...overrides,
  };
}

/** フックを実行するための最小コンポーネント。 */
function HookProbe({ options }: { options: UseAppInitializationOptions }) {
  useAppInitialization(options);
  return null;
}

/** テスト間で安定した非同期フラッシュ。 */
const flushPromises = async () => {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
  });
};

describe('起動初期化フック useAppInitialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (initializeDatabase as jest.Mock).mockResolvedValue(undefined);
    (loadAppFonts as jest.Mock).mockResolvedValue(undefined);
    (getBooleanSetting as jest.Mock).mockResolvedValue(false);
    (getStringSetting as jest.Mock).mockResolvedValue('default');
    (setSetting as jest.Mock).mockResolvedValue(undefined);
    (initializeAchievementNotificationHandler as jest.Mock).mockImplementation(() => undefined);
    (setupAchievementNotificationChannel as jest.Mock).mockResolvedValue(undefined);
    (setupMonthlyReportNotificationChannel as jest.Mock).mockResolvedValue(undefined);
    (evaluateAchievementsAndNotify as jest.Mock).mockResolvedValue(undefined);
    (isWhileInUseOnlyMode as jest.Mock).mockReturnValue(false);
    (shouldResetAchievementsOnLaunch as jest.Mock).mockReturnValue(false);
    // getConfirmedPremiumAccessState はPromiseを返す
    (getConfirmedPremiumAccessState as jest.Mock).mockReturnValue(Promise.resolve({ isPlusActive: false, entitlementId: 'strollia_plus' }));
    (resolveInitialPremiumAccess as jest.Mock).mockResolvedValue({ isPlusActive: false, entitlementId: 'strollia_plus' });
  });

  describe('初期化の順序', () => {
    it('initializeDatabase → loadAppFonts → initializePremiumAccess → applySavedIconSettings の順で呼ばれる', async () => {
      const callOrder: string[] = [];
      (initializeDatabase as jest.Mock).mockImplementation(async () => {
        callOrder.push('initializeDatabase');
      });
      (loadAppFonts as jest.Mock).mockImplementation(async () => {
        callOrder.push('loadAppFonts');
      });

      const options = makeOptions({
        initializePremiumAccess: jest.fn((..._args) => {
          callOrder.push('initializePremiumAccess');
        }),
        applySavedIconSettings: jest.fn(async (..._args) => {
          callOrder.push('applySavedIconSettings');
        }),
      });

      await act(async () => {
        ReactTestRenderer.create(<HookProbe options={options} />);
      });
      await flushPromises();

      const dbIndex = callOrder.indexOf('initializeDatabase');
      const fontsIndex = callOrder.indexOf('loadAppFonts');
      const premiumIndex = callOrder.indexOf('initializePremiumAccess');
      const iconIndex = callOrder.indexOf('applySavedIconSettings');

      expect(dbIndex).toBeGreaterThanOrEqual(0);
      expect(fontsIndex).toBeGreaterThan(dbIndex);
      expect(premiumIndex).toBeGreaterThan(fontsIndex);
      expect(iconIndex).toBeGreaterThan(premiumIndex);
    });

    it('refreshData → synchronizeLocationRecordingMode → evaluateAchievementsAndNotify → refreshAchievementState の順で呼ばれる', async () => {
      const callOrder: string[] = [];
      const options = makeOptions({
        refreshData: jest.fn(async () => {
          callOrder.push('refreshData');
          return DEFAULT_REFRESH_RESULT;
        }),
        synchronizeLocationRecordingMode: jest.fn(async () => {
          callOrder.push('synchronizeLocationRecordingMode');
        }),
        refreshAchievementState: jest.fn(async () => {
          callOrder.push('refreshAchievementState');
        }),
      });
      (evaluateAchievementsAndNotify as jest.Mock).mockImplementation(async () => {
        callOrder.push('evaluateAchievementsAndNotify');
      });

      await act(async () => {
        ReactTestRenderer.create(<HookProbe options={options} />);
      });
      await flushPromises();

      const refreshDataIndex = callOrder.indexOf('refreshData');
      const syncIndex = callOrder.indexOf('synchronizeLocationRecordingMode');
      const evalIndex = callOrder.indexOf('evaluateAchievementsAndNotify');
      const refreshAchievementIndex = callOrder.indexOf('refreshAchievementState');

      expect(refreshDataIndex).toBeGreaterThanOrEqual(0);
      expect(syncIndex).toBeGreaterThan(refreshDataIndex);
      expect(evalIndex).toBeGreaterThan(syncIndex);
      expect(refreshAchievementIndex).toBeGreaterThan(evalIndex);
    });
  });

  describe('初期化完了通知', () => {
    it('初期化完了後に setIsReady(true) が呼ばれる', async () => {
      const setIsReady = jest.fn();
      const options = makeOptions({ setIsReady });

      await act(async () => {
        ReactTestRenderer.create(<HookProbe options={options} />);
      });
      await flushPromises();

      expect(setIsReady).toHaveBeenCalledWith(true);
    });

    it('initializeDatabase が失敗したとき setMessage を呼び setIsReady(true) になる', async () => {
      (initializeDatabase as jest.Mock).mockRejectedValue(new Error('DB初期化失敗'));
      const setMessage = jest.fn();
      const setIsReady = jest.fn();
      const options = makeOptions({ setMessage, setIsReady });

      await act(async () => {
        ReactTestRenderer.create(<HookProbe options={options} />);
      });
      await flushPromises();

      expect(setMessage).toHaveBeenCalledWith('DB初期化失敗');
      expect(setIsReady).toHaveBeenCalledWith(true);
    });
  });

  describe('設定の読み込みと適用', () => {
    it('keepScreenAwake が true で保存されている場合 setKeepScreenAwake(true) が呼ばれる', async () => {
      (getBooleanSetting as jest.Mock).mockImplementation(async (key: string) => {
        return key === 'keepScreenAwake' ? true : false;
      });
      const setKeepScreenAwake = jest.fn();
      const options = makeOptions({ setKeepScreenAwake });

      await act(async () => {
        ReactTestRenderer.create(<HookProbe options={options} />);
      });
      await flushPromises();

      expect(setKeepScreenAwake).toHaveBeenCalledWith(true);
    });

    it('initializeAchievementReviewState が呼ばれる', async () => {
      const initializeAchievementReviewState = jest.fn();
      const options = makeOptions({ initializeAchievementReviewState });

      await act(async () => {
        ReactTestRenderer.create(<HookProbe options={options} />);
      });
      await flushPromises();

      expect(initializeAchievementReviewState).toHaveBeenCalled();
    });
  });

  describe('前景限定記録のトースト表示', () => {
    it('権限が前景のみのとき setIsWhileInUseToastVisible(true) が呼ばれる', async () => {
      (isWhileInUseOnlyMode as jest.Mock).mockReturnValue(true);
      const setIsWhileInUseToastVisible = jest.fn();
      const options = makeOptions({ setIsWhileInUseToastVisible });

      await act(async () => {
        ReactTestRenderer.create(<HookProbe options={options} />);
      });
      await flushPromises();

      expect(setIsWhileInUseToastVisible).toHaveBeenCalledWith(true);
    });
  });

  describe('初回チュートリアル表示', () => {
    it('firstLaunchTutorialCompleted が false のとき setIsFirstLaunchTutorialVisible(true) が呼ばれる', async () => {
      (getBooleanSetting as jest.Mock).mockImplementation(async (key: string) => {
        return key === 'firstLaunchTutorialCompleted' ? false : false;
      });
      const setIsFirstLaunchTutorialVisible = jest.fn();
      const setFirstLaunchTutorialMode = jest.fn();
      const options = makeOptions({ setIsFirstLaunchTutorialVisible, setFirstLaunchTutorialMode });

      await act(async () => {
        ReactTestRenderer.create(<HookProbe options={options} />);
      });
      await flushPromises();

      expect(setFirstLaunchTutorialMode).toHaveBeenCalledWith('firstLaunch');
      expect(setIsFirstLaunchTutorialVisible).toHaveBeenCalledWith(true);
    });

    it('firstLaunchTutorialCompleted が true のとき setIsFirstLaunchTutorialVisible は呼ばれない', async () => {
      (getBooleanSetting as jest.Mock).mockImplementation(async (key: string) => {
        return key === 'firstLaunchTutorialCompleted' ? true : false;
      });
      const setIsFirstLaunchTutorialVisible = jest.fn();
      const options = makeOptions({ setIsFirstLaunchTutorialVisible });

      await act(async () => {
        ReactTestRenderer.create(<HookProbe options={options} />);
      });
      await flushPromises();

      expect(setIsFirstLaunchTutorialVisible).not.toHaveBeenCalled();
    });

    it('firstLaunchTutorialCompleted が true のとき requestAchievementNotificationPermissionIfNeeded が呼ばれる', async () => {
      (getBooleanSetting as jest.Mock).mockImplementation(async (key: string) => {
        return key === 'firstLaunchTutorialCompleted' ? true : false;
      });
      const requestAchievementNotificationPermissionIfNeeded = jest.fn().mockResolvedValue(undefined);
      const options = makeOptions({ requestAchievementNotificationPermissionIfNeeded });

      await act(async () => {
        ReactTestRenderer.create(<HookProbe options={options} />);
      });
      await flushPromises();

      expect(requestAchievementNotificationPermissionIfNeeded).toHaveBeenCalled();
    });
  });

  describe('写真表示クラッシュブレーカー', () => {
    it('savedShowPhotosOnMapEnablePending が true のとき setSetting で SHOW_PHOTOS_ON_MAP_SETTING_KEY を false にする', async () => {
      (getBooleanSetting as jest.Mock).mockImplementation(async (key: string) => {
        return key === 'showPhotosOnMapEnablePending' ? true : false;
      });
      const setMessage = jest.fn();
      const options = makeOptions({ setMessage });

      await act(async () => {
        ReactTestRenderer.create(<HookProbe options={options} />);
      });
      await flushPromises();

      expect(setSetting).toHaveBeenCalledWith('showPhotosOnMap', false);
      expect(setMessage).toHaveBeenCalledWith(expect.stringContaining('写真表示をOFFに戻しました'));
    });
  });
});
