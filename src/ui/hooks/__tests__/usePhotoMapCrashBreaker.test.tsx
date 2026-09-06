import { act, renderHook } from '@testing-library/react-native';
import { reportPhotoMapDiagnostics } from '@/config/sentry';
import { usePhotoMapCrashBreaker, UsePhotoMapCrashBreakerParams, UsePhotoMapCrashBreakerResult } from '@/ui/hooks/usePhotoMapCrashBreaker';

/** 写真表示が復元可能な状態のフック引数。写真の検索範囲は usePhotoMapOverlay をモックしているため影響しない。 */
const crashBreakerParams: UsePhotoMapCrashBreakerParams = {
  isReady: true,
  isMapReady: true,
  photoOverlayRegion: { latitude: 35, longitude: 139, latitudeDelta: 0.1, longitudeDelta: 0.1 },
};

jest.mock('@/config/sentry', () => ({
  reportPhotoMapDiagnostics: jest.fn(),
}));

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, accessPrivileges: 'all' }),
  // 復元経路は権限を「参照するだけ」で確認する(ダイアログを出さない)
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, accessPrivileges: 'all' }),
}));

jest.mock('@/features/settings/settingsRepository', () => ({
  setSetting: jest.fn().mockResolvedValue(undefined),
}));

// photoLibrary(hasFullPhotoAccess の import 元)が写真メタデータの保存でリポジトリを参照するため、
// SQLiteのネイティブモジュールを読み込まないようリポジトリごとモックする
jest.mock('@/features/photos/photoAssetRepository', () => ({
  savePhotoAssets: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/ui/hooks/usePhotoMapOverlay', () => ({
  usePhotoMapOverlay: jest.fn().mockReturnValue({
    photos: [],
    isLoadingPhotos: false,
    photoErrorMessage: null,
  }),
}));

describe('写真表示クラッシュブレーカーフック usePhotoMapCrashBreaker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // usePhotoMapOverlay のデフォルト戻り値をリセット
    const { usePhotoMapOverlay } = require('@/ui/hooks/usePhotoMapOverlay');
    (usePhotoMapOverlay as jest.Mock).mockReturnValue({
      photos: [],
      isLoadingPhotos: false,
      photoErrorMessage: null,
    });
  });

  describe('初期状態', () => {
    it('初期 showPhotosOnMap は false になる', () => {
      const { result } = renderHook(() => usePhotoMapCrashBreaker(crashBreakerParams));

      expect(result.current.showPhotosOnMap).toBe(false);
    });

    it('初期 isUpdatingPhotoSetting は false になる', () => {
      const { result } = renderHook(() => usePhotoMapCrashBreaker(crashBreakerParams));

      expect(result.current.isUpdatingPhotoSetting).toBe(false);
    });

    it('photos は空配列になる', () => {
      const { result } = renderHook(() => usePhotoMapCrashBreaker(crashBreakerParams));

      expect(result.current.photos).toEqual([]);
    });
  });

  describe('initializePhotoSetting — 起動時の初期化', () => {
    it('savedShowPhotosOnMapEnablePending が false で savedShowPhotosOnMap が false のとき showPhotosOnMap は false のまま', () => {
      const { result } = renderHook(() => usePhotoMapCrashBreaker(crashBreakerParams));

      act(() => {
        result.current.initializePhotoSetting({ savedShowPhotosOnMap: false, savedShowPhotosOnMapEnablePending: false });
      });

      expect(result.current.showPhotosOnMap).toBe(false);
    });

    it('savedShowPhotosOnMapEnablePending が true のとき showPhotosOnMap は false になる（クラッシュブレーカー発動）', () => {
      const { result } = renderHook(() => usePhotoMapCrashBreaker(crashBreakerParams));

      act(() => {
        // 前回クラッシュした可能性があるため pending フラグが残っている
        result.current.initializePhotoSetting({ savedShowPhotosOnMap: true, savedShowPhotosOnMapEnablePending: true });
      });

      // クラッシュブレーカーが発動し showPhotosOnMap は false になる
      expect(result.current.showPhotosOnMap).toBe(false);
    });
  });

  describe('updateShowPhotosOnMap — 写真表示の切り替え', () => {
    it('false を渡すと showPhotosOnMap が false になる', async () => {
      const { result } = renderHook(() => usePhotoMapCrashBreaker(crashBreakerParams));

      await act(async () => {
        await result.current.updateShowPhotosOnMap(false);
      });

      expect(result.current.showPhotosOnMap).toBe(false);
    });

    it('写真ライブラリのフルアクセスが許可されているとき true を渡すと showPhotosOnMap が true になる', async () => {
      const { requestPermissionsAsync } = require('expo-media-library');
      (requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, accessPrivileges: 'all' });

      const { result } = renderHook(() => usePhotoMapCrashBreaker(crashBreakerParams));

      await act(async () => {
        await result.current.updateShowPhotosOnMap(true);
      });

      expect(result.current.showPhotosOnMap).toBe(true);
    });

    it('写真ライブラリのアクセスが限定的なとき true を渡しても showPhotosOnMap は false のまま', async () => {
      const { requestPermissionsAsync } = require('expo-media-library');
      (requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, accessPrivileges: 'limited' });

      const { result } = renderHook(() => usePhotoMapCrashBreaker(crashBreakerParams));

      await act(async () => {
        await result.current.updateShowPhotosOnMap(true);
      });

      expect(result.current.showPhotosOnMap).toBe(false);
    });

    it('有効化中に setSetting が reject した場合、showPhotosOnMap が false に戻り設定キーがクリアされる', async () => {
      const { requestPermissionsAsync } = require('expo-media-library');
      const { setSetting } = require('@/features/settings/settingsRepository');
      (requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, accessPrivileges: 'all' });
      // pending フラグ保存(1回目)は reject させて enableShowPhotosOnMapWithCrashBreaker を失敗させる
      (setSetting as jest.Mock).mockRejectedValueOnce(new Error('SQLite error'));

      const { result } = renderHook(() => usePhotoMapCrashBreaker(crashBreakerParams));

      await act(async () => {
        await result.current.updateShowPhotosOnMap(true);
      });

      // setSetting が reject しても showPhotosOnMap は false に戻る
      expect(result.current.showPhotosOnMap).toBe(false);
      // エラー後の後始末として setSetting が呼ばれる（巻き戻し処理）
      // 1回目: setSetting(PENDING, true) -> reject (enableCrashBreaker の最初の呼び出し)
      // 2回目以降: catch ブロック内で setSetting(MAP, false) と setSetting(PENDING, false) を呼ぶ
      expect(setSetting).toHaveBeenCalledTimes(3);
    });

    it('有効化に失敗してOFFへ巻き戻したとき、理由をAlertでユーザーへ通知する', async () => {
      const { requestPermissionsAsync } = require('expo-media-library');
      const { setSetting } = require('@/features/settings/settingsRepository');
      const { Alert } = require('react-native');
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      (requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, accessPrivileges: 'all' });
      (setSetting as jest.Mock).mockRejectedValueOnce(new Error('SQLite error'));

      const { result } = renderHook(() => usePhotoMapCrashBreaker(crashBreakerParams));

      await act(async () => {
        await result.current.updateShowPhotosOnMap(true);
      });

      // サイレントにOFFへ戻すのではなく、巻き戻した理由をユーザーへ通知する
      expect(alertSpy).toHaveBeenCalledWith('写真表示を有効化できませんでした', '設定の保存に失敗したため、写真表示をOFFに戻しました。');
    });
  });

  describe('保存済み設定からの復元 — 権限の再確認', () => {
    /**
     * 保存済みの写真表示ONを復元させる。
     *
     * `initializePhotoSetting` の後に復元 effect が非同期で走るため、その完了まで待つ。
     *
     * @param result - `renderHook` の戻り値。
     * @returns なし。
     */
    async function restoreSavedPhotoSetting(result: { current: UsePhotoMapCrashBreakerResult }): Promise<void> {
      await act(async () => {
        result.current.initializePhotoSetting({ savedShowPhotosOnMap: true, savedShowPhotosOnMapEnablePending: false });
      });
      await act(async () => {
        await Promise.resolve();
      });
    }

    it('フルアクセスのままなら保存済みの写真表示ONを復元する', async () => {
      const { getPermissionsAsync } = require('expo-media-library');
      (getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, accessPrivileges: 'all' });

      const { result } = renderHook(() => usePhotoMapCrashBreaker(crashBreakerParams));
      await restoreSavedPhotoSetting(result);

      expect(result.current.showPhotosOnMap).toBe(true);
    });

    it('フルアクセスから限定アクセスへ変更されていた場合は写真表示をOFFへ戻す', async () => {
      const { getPermissionsAsync } = require('expo-media-library');
      const { setSetting } = require('@/features/settings/settingsRepository');
      (getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, accessPrivileges: 'limited' });

      const { result } = renderHook(() => usePhotoMapCrashBreaker(crashBreakerParams));
      await restoreSavedPhotoSetting(result);

      // 選択されていない写真の保存済み行が地図に出てしまうため、復元せずOFFへ倒す
      expect(result.current.showPhotosOnMap).toBe(false);
      expect(setSetting).toHaveBeenCalledWith('showPhotosOnMap', false);
      expect(setSetting).toHaveBeenCalledWith('showPhotosOnMapEnablePending', false);
    });

    it('権限が取り消されていた場合も写真表示をOFFへ戻す', async () => {
      const { getPermissionsAsync } = require('expo-media-library');
      (getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false, accessPrivileges: 'none' });

      const { result } = renderHook(() => usePhotoMapCrashBreaker(crashBreakerParams));
      await restoreSavedPhotoSetting(result);

      expect(result.current.showPhotosOnMap).toBe(false);
    });

    it('復元経路では権限ダイアログを出さず、参照のみで確認する', async () => {
      const { getPermissionsAsync, requestPermissionsAsync } = require('expo-media-library');
      (getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, accessPrivileges: 'all' });

      const { result } = renderHook(() => usePhotoMapCrashBreaker(crashBreakerParams));
      await restoreSavedPhotoSetting(result);

      expect(getPermissionsAsync).toHaveBeenCalled();
      expect(requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('復元経路でOFFへ戻すときはAlertを出さない', async () => {
      const { getPermissionsAsync } = require('expo-media-library');
      const { Alert } = require('react-native');
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      (getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, accessPrivileges: 'limited' });

      const { result } = renderHook(() => usePhotoMapCrashBreaker(crashBreakerParams));
      await restoreSavedPhotoSetting(result);

      // 起動直後に突然ダイアログが出るのは不親切なため、復元経路では通知しない
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('復元経路では権限の診断計装を送らない', async () => {
      const { getPermissionsAsync } = require('expo-media-library');
      (getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, accessPrivileges: 'all' });

      const { result } = renderHook(() => usePhotoMapCrashBreaker(crashBreakerParams));
      await restoreSavedPhotoSetting(result);

      expect(reportPhotoMapDiagnostics).not.toHaveBeenCalledWith('permission', expect.anything());
    });
  });

  describe('権限取得結果の診断計装', () => {
    it('フルアクセスのとき hasFullAccess: true で permission ステージを送る', async () => {
      const { requestPermissionsAsync } = require('expo-media-library');
      (requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, accessPrivileges: 'all' });

      const { result } = renderHook(() => usePhotoMapCrashBreaker(crashBreakerParams));

      await act(async () => {
        await result.current.updateShowPhotosOnMap(true);
      });

      expect(reportPhotoMapDiagnostics).toHaveBeenCalledWith('permission', {
        granted: true,
        accessPrivileges: 'all',
        hasFullAccess: true,
      });
    });

    it('限定アクセスのとき hasFullAccess: false で送り、既存のAlert挙動は変えない', async () => {
      const { requestPermissionsAsync } = require('expo-media-library');
      const { Alert } = require('react-native');
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      (requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, accessPrivileges: 'limited' });

      const { result } = renderHook(() => usePhotoMapCrashBreaker(crashBreakerParams));

      await act(async () => {
        await result.current.updateShowPhotosOnMap(true);
      });

      expect(reportPhotoMapDiagnostics).toHaveBeenCalledWith('permission', {
        granted: true,
        accessPrivileges: 'limited',
        hasFullAccess: false,
      });
      expect(alertSpy).toHaveBeenCalledWith('写真のフルアクセスが必要です', expect.any(String));
    });

    it('accessPrivileges が未定義の場合は null として送る', async () => {
      const { requestPermissionsAsync } = require('expo-media-library');
      (requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });

      const { result } = renderHook(() => usePhotoMapCrashBreaker(crashBreakerParams));

      await act(async () => {
        await result.current.updateShowPhotosOnMap(true);
      });

      expect(reportPhotoMapDiagnostics).toHaveBeenCalledWith(
        'permission',
        expect.objectContaining({ accessPrivileges: null, hasFullAccess: true }),
      );
    });

    it('写真表示をOFFにするときは権限要求を通らないため送らない', async () => {
      const { result } = renderHook(() => usePhotoMapCrashBreaker(crashBreakerParams));

      await act(async () => {
        await result.current.updateShowPhotosOnMap(false);
      });

      expect(reportPhotoMapDiagnostics).not.toHaveBeenCalled();
    });
  });
});
