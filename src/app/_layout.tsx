import { Stack, usePathname } from 'expo-router';
import { useEffect } from 'react';

import { wrapWithSentry } from '@/config/sentry';
import { updateSentryScreenContext } from '@/config/sentry';
import { AchievementDialog } from '@/ui/components/AchievementDialog';
import { AchievementUnlockModal } from '@/ui/components/AchievementUnlockModal';
import { FirstLaunchTutorialDialog } from '@/ui/components/FirstLaunchTutorialDialog';
import { GpxImportProgressDialog } from '@/ui/components/GpxImportProgressDialog';
import { PhotoPreviewModals } from '@/ui/components/PhotoPreviewModals';
import { PremiumPaywallModal } from '@/ui/components/PremiumPaywallModal';
import { TopToast } from '@/ui/components/TopToast';
import { AppStateProvider, useAppState } from '@/ui/state/AppStateProvider';
import { pathnameToScreenMode, pathnameToDailyLogsSentryScreenName, pathnameToSettingsSentryScreenName } from '@/ui/pathnameToScreenMode';
import { resolveSentryScreenName } from '@/ui/sentryScreen';

/**
 * グローバルモーダル群と AppStateProvider を組み合わせたルートレイアウト内部コンポーネント。
 *
 * RootLayout はこのコンポーネントを AppStateProvider で包んで export する。
 * useAppState() を呼ぶためには Provider の内側にいる必要があるため分離している。
 */
function RootLayoutContent(): React.ReactElement {
  const s = useAppState();
  const pathname = usePathname();

  /**
   * expo-router のパス名変化を監視して Sentry の画面コンテキストを更新する。
   * 旧実装の NavigationContainer#onStateChange と等価な役割を担う。
   */
  useEffect(() => {
    const screenMode = pathnameToScreenMode(pathname);
    let screenName: string;

    if (screenMode === 'dailyLogs') {
      screenName = pathnameToDailyLogsSentryScreenName(pathname);
    } else if (screenMode === 'settings') {
      screenName = pathnameToSettingsSentryScreenName(pathname);
    } else {
      screenName = resolveSentryScreenName({
        dailyLogsScreenName: pathnameToDailyLogsSentryScreenName(pathname),
        firstLaunchTutorialMode: s.isFirstLaunchTutorialVisible
          ? s.firstLaunchTutorialMode === 'replay'
            ? 'replay'
            : 'firstLaunch'
          : 'hidden',
        isFirstLaunchTutorialVisible: s.isFirstLaunchTutorialVisible,
        isPhotoPreviewVisible: Boolean(s.selectedPhoto || s.selectedPhotoCluster),
        isPremiumPaywallVisible: s.isPremiumPaywallVisible,
        screenMode,
        settingsScreenName: pathnameToSettingsSentryScreenName(pathname),
      });
    }

    updateSentryScreenContext(screenName);
  }, [
    pathname,
    s.isFirstLaunchTutorialVisible,
    s.firstLaunchTutorialMode,
    s.selectedPhoto,
    s.selectedPhotoCluster,
    s.isPremiumPaywallVisible,
  ]);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
        }}
      />

      {/* グローバルモーダル群 — 全ルートの上に表示される */}
      <TopToast
        visible={s.isWhileInUseToastVisible}
        message="アプリが起動している場合のみ記録します！"
        styles={s.styles}
        theme={s.theme}
        onHide={() => s.setIsWhileInUseToastVisible(false)}
      />

      <AchievementUnlockModal
        achievement={s.activeAchievementNotification?.definition ?? null}
        animationKey={
          s.activeAchievementNotification
            ? `${s.activeAchievementNotification.queueId}:${s.activeAchievementNotification.definition.id}`
            : null
        }
        styles={s.styles}
        onShareToX={s.shareAchievementToX}
        onClose={s.closeAchievementUnlockModal}
      />

      <AchievementDialog item={s.selectedAchievement} styles={s.styles} theme={s.theme} onClose={() => s.setSelectedAchievement(null)} />

      <PremiumPaywallModal
        visible={s.isPremiumPaywallVisible}
        styles={s.styles}
        theme={s.theme}
        premiumOfferingSummary={s.premiumOfferingSummary}
        isLoadingPremiumOffering={s.isLoadingPremiumOffering}
        isPurchasingPremiumPackage={s.isPurchasingPremiumPackage}
        isRestoringPremiumPurchases={s.isRestoringPremiumPurchases}
        onClose={s.closePremiumPaywall}
        onPurchaseMonthlyPremiumPackage={() => {
          s.purchasePremiumPackageFromSettings('monthly').catch((error: unknown) => {
            console.warn('purchasePremiumPackageFromSettings (monthly) failed:', error);
          });
        }}
        onPurchaseYearlyPremiumPackage={() => {
          s.purchasePremiumPackageFromSettings('yearly').catch((error: unknown) => {
            console.warn('purchasePremiumPackageFromSettings (yearly) failed:', error);
          });
        }}
        onRestorePremiumPurchases={() => {
          s.restorePurchasesFromSettings().catch((error: unknown) => {
            console.warn('restorePurchasesFromSettings failed:', error);
          });
        }}
      />

      <FirstLaunchTutorialDialog
        visible={s.isFirstLaunchTutorialVisible}
        styles={s.styles}
        completionButtonLabel={s.firstLaunchTutorialMode === 'replay' ? '閉じる' : '地図で確認する'}
        onComplete={s.completeFirstLaunchTutorial}
      />

      <PhotoPreviewModals
        selectedPhotoCluster={s.selectedPhotoCluster}
        selectedPhotoClusterPages={s.selectedPhotoClusterPages}
        selectedPhoto={s.selectedPhoto}
        styles={s.styles}
        onSelectPhotoCluster={s.setSelectedPhotoCluster}
        onSelectPhoto={s.setSelectedPhoto}
      />

      <GpxImportProgressDialog visible={s.isProcessingGpxImport} styles={s.styles} theme={s.theme} />
    </>
  );
}

/**
 * expo-router のルートレイアウト。
 *
 * - Sentry.wrap を適用する
 * - AppStateProvider でアプリ全体の状態を提供する
 * - Stack ナビゲーターとグローバルモーダル群を配置する
 */
function RootLayout(): React.ReactElement {
  return (
    <AppStateProvider>
      <RootLayoutContent />
    </AppStateProvider>
  );
}

export default wrapWithSentry(RootLayout);
