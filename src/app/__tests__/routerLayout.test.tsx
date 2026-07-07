import RootLayout from '@/app/_layout';

// expo-router の Stack と usePathname をスタブ化する
jest.mock('expo-router', () => ({
  Stack: () => null,
  usePathname: () => '/',
}));

// wrapWithSentry はコンポーネントをそのまま返すスタブ
jest.mock('@/config/sentry', () => ({
  wrapWithSentry: (component: unknown) => component,
  updateSentryScreenContext: jest.fn(),
}));

// AppStateProvider の依存をスタブ化し、軽量な View でレンダリングを確認する
jest.mock('@/ui/state/AppStateProvider', () => {
  const { View } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
  return {
    AppStateProvider: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
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
      openPremiumCustomerCenter: jest.fn(),
    }),
  };
});

// グローバルモーダルコンポーネントをスタブ化する
jest.mock('@/ui/components/TopToast', () => ({ TopToast: () => null }));
jest.mock('@/ui/components/AchievementUnlockModal', () => ({ AchievementUnlockModal: () => null }));
jest.mock('@/ui/components/AchievementDialog', () => ({ AchievementDialog: () => null }));
jest.mock('@/ui/components/PremiumPaywallModal', () => ({ PremiumPaywallModal: () => null }));
jest.mock('@/ui/components/FirstLaunchTutorialDialog', () => ({ FirstLaunchTutorialDialog: () => null }));
jest.mock('@/ui/components/PhotoPreviewModals', () => ({ PhotoPreviewModals: () => null }));
jest.mock('@/ui/components/GpxImportProgressDialog', () => ({ GpxImportProgressDialog: () => null }));

const ReactTestRenderer = require('react-test-renderer'); // eslint-disable-line @typescript-eslint/no-require-imports
const { act } = ReactTestRenderer;

describe('expo-router ルートレイアウト (_layout)', () => {
  test('default export が存在しレンダリングできること', async () => {
    let renderer: ReturnType<typeof ReactTestRenderer.create>;
    await act(async () => {
      renderer = ReactTestRenderer.create(<RootLayout />);
    });

    expect(renderer!.toJSON()).not.toBeNull();
  });
});
