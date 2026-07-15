import { act, renderHook } from '@testing-library/react-native';
import { usePhotoMapCrashBreaker, UsePhotoMapCrashBreakerResult } from '@/ui/hooks/usePhotoMapCrashBreaker';

jest.mock('expo-media-library/legacy', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, accessPrivileges: 'all' }),
}));

jest.mock('@/features/settings/settingsRepository', () => ({
  setSetting: jest.fn().mockResolvedValue(undefined),
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
      const { result } = renderHook(() => usePhotoMapCrashBreaker({ isReady: true, isMapReady: true }));

      expect(result.current.showPhotosOnMap).toBe(false);
    });

    it('初期 isUpdatingPhotoSetting は false になる', () => {
      const { result } = renderHook(() => usePhotoMapCrashBreaker({ isReady: true, isMapReady: true }));

      expect(result.current.isUpdatingPhotoSetting).toBe(false);
    });

    it('photos は空配列になる', () => {
      const { result } = renderHook(() => usePhotoMapCrashBreaker({ isReady: true, isMapReady: true }));

      expect(result.current.photos).toEqual([]);
    });
  });

  describe('initializePhotoSetting — 起動時の初期化', () => {
    it('savedShowPhotosOnMapEnablePending が false で savedShowPhotosOnMap が false のとき showPhotosOnMap は false のまま', () => {
      const { result } = renderHook(() => usePhotoMapCrashBreaker({ isReady: true, isMapReady: true }));

      act(() => {
        result.current.initializePhotoSetting({ savedShowPhotosOnMap: false, savedShowPhotosOnMapEnablePending: false });
      });

      expect(result.current.showPhotosOnMap).toBe(false);
    });

    it('savedShowPhotosOnMapEnablePending が true のとき showPhotosOnMap は false になる（クラッシュブレーカー発動）', () => {
      const { result } = renderHook(() => usePhotoMapCrashBreaker({ isReady: true, isMapReady: true }));

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
      const { result } = renderHook(() => usePhotoMapCrashBreaker({ isReady: true, isMapReady: true }));

      await act(async () => {
        await result.current.updateShowPhotosOnMap(false);
      });

      expect(result.current.showPhotosOnMap).toBe(false);
    });

    it('写真ライブラリのフルアクセスが許可されているとき true を渡すと showPhotosOnMap が true になる', async () => {
      const { requestPermissionsAsync } = require('expo-media-library/legacy');
      (requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, accessPrivileges: 'all' });

      const { result } = renderHook(() => usePhotoMapCrashBreaker({ isReady: true, isMapReady: true }));

      await act(async () => {
        await result.current.updateShowPhotosOnMap(true);
      });

      expect(result.current.showPhotosOnMap).toBe(true);
    });

    it('写真ライブラリのアクセスが限定的なとき true を渡しても showPhotosOnMap は false のまま', async () => {
      const { requestPermissionsAsync } = require('expo-media-library/legacy');
      (requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, accessPrivileges: 'limited' });

      const { result } = renderHook(() => usePhotoMapCrashBreaker({ isReady: true, isMapReady: true }));

      await act(async () => {
        await result.current.updateShowPhotosOnMap(true);
      });

      expect(result.current.showPhotosOnMap).toBe(false);
    });

    it('有効化中に setSetting が reject した場合、showPhotosOnMap が false に戻り設定キーがクリアされる', async () => {
      const { requestPermissionsAsync } = require('expo-media-library/legacy');
      const { setSetting } = require('@/features/settings/settingsRepository');
      (requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, accessPrivileges: 'all' });
      // pending フラグ保存(1回目)は reject させて enableShowPhotosOnMapWithCrashBreaker を失敗させる
      (setSetting as jest.Mock).mockRejectedValueOnce(new Error('SQLite error'));

      const { result } = renderHook(() => usePhotoMapCrashBreaker({ isReady: true, isMapReady: true }));

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
      const { requestPermissionsAsync } = require('expo-media-library/legacy');
      const { setSetting } = require('@/features/settings/settingsRepository');
      const { Alert } = require('react-native');
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      (requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, accessPrivileges: 'all' });
      (setSetting as jest.Mock).mockRejectedValueOnce(new Error('SQLite error'));

      const { result } = renderHook(() => usePhotoMapCrashBreaker({ isReady: true, isMapReady: true }));

      await act(async () => {
        await result.current.updateShowPhotosOnMap(true);
      });

      // サイレントにOFFへ戻すのではなく、巻き戻した理由をユーザーへ通知する
      expect(alertSpy).toHaveBeenCalledWith('写真表示を有効化できませんでした', '設定の保存に失敗したため、写真表示をOFFに戻しました。');
    });
  });
});
