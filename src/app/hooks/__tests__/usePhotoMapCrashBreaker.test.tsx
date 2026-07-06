import { usePhotoMapCrashBreaker, UsePhotoMapCrashBreakerResult } from '@/app/hooks/usePhotoMapCrashBreaker';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, accessPrivileges: 'all' }),
}));

jest.mock('@/features/settings/settingsRepository', () => ({
  setSetting: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/app/hooks/usePhotoMapOverlay', () => ({
  usePhotoMapOverlay: jest.fn().mockReturnValue({
    photos: [],
    isLoadingPhotos: false,
    photoErrorMessage: null,
  }),
}));

type HookProbeProps = {
  /** フックの戻り値をテストへ渡すコールバック。 */
  onResult: (result: UsePhotoMapCrashBreakerResult) => void;
  /** アプリの初期化完了フラグ。 */
  isReady?: boolean;
  /** ネイティブ地図の初期化完了フラグ。 */
  isMapReady?: boolean;
};

/** フックを実行するための最小コンポーネント。 */
function HookProbe({ onResult, isReady = true, isMapReady = true }: HookProbeProps) {
  const result = usePhotoMapCrashBreaker({ isReady, isMapReady });
  onResult(result);
  return null;
}

describe('写真表示クラッシュブレーカーフック usePhotoMapCrashBreaker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // usePhotoMapOverlay のデフォルト戻り値をリセット
    const { usePhotoMapOverlay } = require('@/app/hooks/usePhotoMapOverlay');
    (usePhotoMapOverlay as jest.Mock).mockReturnValue({
      photos: [],
      isLoadingPhotos: false,
      photoErrorMessage: null,
    });
  });

  describe('初期状態', () => {
    it('初期 showPhotosOnMap は false になる', () => {
      let result: UsePhotoMapCrashBreakerResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.showPhotosOnMap).toBe(false);
    });

    it('初期 isUpdatingPhotoSetting は false になる', () => {
      let result: UsePhotoMapCrashBreakerResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.isUpdatingPhotoSetting).toBe(false);
    });

    it('photos は空配列になる', () => {
      let result: UsePhotoMapCrashBreakerResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.photos).toEqual([]);
    });
  });

  describe('initializePhotoSetting — 起動時の初期化', () => {
    it('savedShowPhotosOnMapEnablePending が false で savedShowPhotosOnMap が false のとき showPhotosOnMap は false のまま', () => {
      let result: UsePhotoMapCrashBreakerResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.initializePhotoSetting({ savedShowPhotosOnMap: false, savedShowPhotosOnMapEnablePending: false });
      });

      expect(result!.showPhotosOnMap).toBe(false);
    });

    it('savedShowPhotosOnMapEnablePending が true のとき showPhotosOnMap は false になる（クラッシュブレーカー発動）', () => {
      let result: UsePhotoMapCrashBreakerResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        // 前回クラッシュした可能性があるため pending フラグが残っている
        result!.initializePhotoSetting({ savedShowPhotosOnMap: true, savedShowPhotosOnMapEnablePending: true });
      });

      // クラッシュブレーカーが発動し showPhotosOnMap は false になる
      expect(result!.showPhotosOnMap).toBe(false);
    });
  });

  describe('updateShowPhotosOnMap — 写真表示の切り替え', () => {
    it('false を渡すと showPhotosOnMap が false になる', async () => {
      let result: UsePhotoMapCrashBreakerResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.updateShowPhotosOnMap(false);
      });

      expect(result!.showPhotosOnMap).toBe(false);
    });

    it('写真ライブラリのフルアクセスが許可されているとき true を渡すと showPhotosOnMap が true になる', async () => {
      const { requestPermissionsAsync } = require('expo-media-library');
      (requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, accessPrivileges: 'all' });

      let result: UsePhotoMapCrashBreakerResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.updateShowPhotosOnMap(true);
      });

      expect(result!.showPhotosOnMap).toBe(true);
    });

    it('写真ライブラリのアクセスが限定的なとき true を渡しても showPhotosOnMap は false のまま', async () => {
      const { requestPermissionsAsync } = require('expo-media-library');
      (requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, accessPrivileges: 'limited' });

      let result: UsePhotoMapCrashBreakerResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.updateShowPhotosOnMap(true);
      });

      expect(result!.showPhotosOnMap).toBe(false);
    });
  });
});
