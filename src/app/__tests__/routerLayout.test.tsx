import { render, screen } from '@testing-library/react-native';
import RootLayout from '@/app/_layout';

/** usePathname スタブが返す現在パス。各テストで書き換える。 */
let mockPathname = '/';
const mockPush = jest.fn();
const mockBack = jest.fn();

// expo-router の Stack / usePathname / useRouter をスタブ化する
jest.mock('expo-router', () => ({
  Stack: () => null,
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

// RootLayout がセーフエリア情報を全画面へ提供することを確認する。
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => <View testID="root-safe-area-provider">{children}</View>,
  };
});

/** AppStateProvider が受け取った props の記録。配線検証に使う。 */
const mockProviderProps: Record<string, unknown>[] = [];

/** useAppState の戻り値へ当てる差分。写真の案内の出し分けなど、状態依存の配線検証に使う。 */
let mockAppStateOverrides: Record<string, unknown> = {};

/** グローバルモーダルが受け取った props の記録。 */
const mockPhotoPreviewModalsProps: Record<string, unknown>[] = [];
const mockPhotoDeletedDialogProps: Record<string, unknown>[] = [];

// wrapWithSentry はコンポーネントをそのまま返すスタブ
jest.mock('@/config/sentry', () => ({
  wrapWithSentry: (component: unknown) => component,
  updateSentryScreenContext: jest.fn(),
}));

// AppStateProvider の依存をスタブ化し、軽量な View でレンダリングを確認する
jest.mock('@/ui/state/AppStateProvider', () => {
  const { View } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
  return {
    AppStateProvider: (props: { children: React.ReactNode } & Record<string, unknown>) => {
      mockProviderProps.push(props);
      return <View>{props.children}</View>;
    },
    useAppState: () => ({
      isReady: true,
      styles: { container: {} },
      theme: { name: 'light', colors: { primary: '#000' } },
      isWhileInUseToastVisible: false,
      setIsWhileInUseToastVisible: jest.fn(),
      activeAchievementNotification: null,
      closeAchievementUnlockModal: jest.fn(),
      shareAchievementToX: jest.fn(),
      selectedAchievement: null,
      setSelectedAchievement: jest.fn(),
      isPremiumPaywallVisible: false,
      premiumOfferingSummary: null,
      isLoadingPremiumOffering: false,
      isPurchasingPremiumPackage: false,
      isRestoringPremiumPurchases: false,
      closePremiumPaywall: jest.fn(),
      purchasePremiumPackageFromSettings: jest.fn(),
      restorePurchasesFromSettings: jest.fn(),
      isFirstLaunchTutorialVisible: false,
      firstLaunchTutorialMode: 'firstLaunch',
      completeFirstLaunchTutorial: jest.fn(),
      selectedPhoto: null,
      selectedPhotoCluster: null,
      selectedPhotoClusterPages: [],
      setSelectedPhotoCluster: jest.fn(),
      setSelectedPhoto: jest.fn(),
      isProcessingGpxImport: false,
      isSyncingPhotoLibrary: false,
      photoLibrarySyncProgress: null,
      photoUnavailableReason: null,
      dismissPhotoDeletedDialog: jest.fn(),
      reloadPhotoLibraryFromDeletedDialog: jest.fn().mockResolvedValue(undefined),
      openPremiumCustomerCenter: jest.fn(),
      ...mockAppStateOverrides,
    }),
  };
});

// グローバルモーダルコンポーネントをスタブ化する
jest.mock('@/ui/components/TopToast', () => ({ TopToast: () => null }));
jest.mock('@/ui/components/AchievementUnlockModal', () => ({ AchievementUnlockModal: () => null }));
jest.mock('@/ui/components/AchievementDialog', () => ({ AchievementDialog: () => null }));
jest.mock('@/ui/components/PremiumPaywallModal', () => ({ PremiumPaywallModal: () => null }));
jest.mock('@/ui/components/FirstLaunchTutorialDialog', () => ({ FirstLaunchTutorialDialog: () => null }));
jest.mock('@/ui/components/PhotoPreviewModals', () => ({
  PhotoPreviewModals: (props: Record<string, unknown>) => {
    mockPhotoPreviewModalsProps.push(props);
    return null;
  },
}));
jest.mock('@/ui/components/PhotoDeletedDialog', () => ({
  PhotoDeletedDialog: (props: Record<string, unknown>) => {
    mockPhotoDeletedDialogProps.push(props);
    return null;
  },
}));
jest.mock('@/ui/components/GpxImportProgressDialog', () => ({ GpxImportProgressDialog: () => null }));

describe('expo-router ルートレイアウト (_layout)', () => {
  beforeEach(() => {
    mockPathname = '/';
    mockProviderProps.length = 0;
    mockPhotoPreviewModalsProps.length = 0;
    mockPhotoDeletedDialogProps.length = 0;
    mockAppStateOverrides = {};
    mockPush.mockClear();
    mockBack.mockClear();
  });

  test('default export が存在しレンダリングできること', () => {
    render(<RootLayout />);

    expect(screen.toJSON()).not.toBeNull();
  });

  test('全画面がセーフエリア情報を参照できるようSafeAreaProviderで包む', () => {
    render(<RootLayout />);

    expect(screen.getByTestId('root-safe-area-provider')).toBeTruthy();
  });

  test('現在パスから導出した currentScreenMode を AppStateProvider へ渡す(設定画面)', () => {
    mockPathname = '/settings/about';

    render(<RootLayout />);

    // navigator 経由の遷移では内部 state が更新されないため、
    // パス由来の ScreenMode が単一ソースとして Provider へ渡ることを固定する
    expect(mockProviderProps.at(-1)?.currentScreenMode).toBe('settings');
  });

  test('地図(/)では currentScreenMode が map になる', () => {
    mockPathname = '/';

    render(<RootLayout />);

    expect(mockProviderProps.at(-1)?.currentScreenMode).toBe('map');
  });

  test('削除済みと判定した写真ではモーダルで案内する', () => {
    mockAppStateOverrides = { photoUnavailableReason: 'deleted' };

    render(<RootLayout />);

    expect(mockPhotoDeletedDialogProps.at(-1)?.visible).toBe(true);
    expect(mockPhotoPreviewModalsProps.at(-1)?.isSelectedPhotoUnavailable).toBe(false);
  });

  test('端末に本体が無い写真ではモーダルを出さず拡大表示の中で案内する', () => {
    mockAppStateOverrides = { photoUnavailableReason: 'unavailable' };

    render(<RootLayout />);

    // 未ダウンロードの写真を開くたびにモーダルが出ると操作の邪魔になる
    expect(mockPhotoDeletedDialogProps.at(-1)?.visible).toBe(false);
    expect(mockPhotoPreviewModalsProps.at(-1)?.isSelectedPhotoUnavailable).toBe(true);
  });

  test('滞在場所設定へのナビゲーターをAppStateProviderへ渡す', () => {
    render(<RootLayout />);

    const navigator = mockProviderProps.at(-1)?.navigator as { openStayPlaces: () => void };
    navigator.openStayPlaces();

    expect(mockPush).toHaveBeenCalledWith('/settings/stay-places');
  });
});
