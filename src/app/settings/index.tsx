import { useRouter } from 'expo-router';

import { PRIVACY_POLICY_URL, SPECIFIED_COMMERCIAL_TRANSACTION_ACT_URL, TERMS_OF_SERVICE_URL } from '@/config/legalLinks';
import { SettingsScreen } from '@/ui/components/SettingsScreen';
import { useAppState } from '@/ui/state/AppStateProvider';

/**
 * 設定トップルート(/settings)。
 *
 * AppStateProvider から設定関連状態・操作を取得し SettingsScreen を描画する。
 */
export default function SettingsRoute(): React.ReactElement {
  const s = useAppState();
  const router = useRouter();

  return (
    <SettingsScreen
      styles={s.styles}
      theme={s.theme}
      isRecording={s.isRecording}
      autoStartStatus={s.autoStartStatus}
      hasRequiredPermission={s.hasRequiredPermission}
      shouldOpenSettingsForPermission={s.shouldOpenSettingsForPermission}
      isWhileInUseOnlyMode={s.isWhileInUseRecordingMode}
      keepScreenAwake={s.keepScreenAwake}
      mapType={s.mapType}
      showPhotosOnMap={s.showPhotosOnMap}
      isUpdatingPhotoSetting={s.isUpdatingPhotoSetting}
      isImportingGpx={s.isImportingGpx}
      premiumAccessState={s.premiumAccessState}
      revenueCatAppUserId={s.revenueCatAppUserId}
      appVersion={s.appVersion}
      buildNumber={s.buildNumber}
      premiumOfferingSummary={s.premiumOfferingSummary}
      isLoadingPremiumOffering={s.isLoadingPremiumOffering}
      isPurchasingPremiumPackage={s.isPurchasingPremiumPackage}
      isPresentingPremiumCustomerCenter={s.isPresentingPremiumCustomerCenter}
      isRestoringPremiumPurchases={s.isRestoringPremiumPurchases}
      selectedUserLocationIconId={s.selectedUserLocationIconId}
      onBackToMap={() => s.openMap()}
      onStartRecording={() => s.startRecording('manual')}
      onRequestLocationPermission={s.requestLocationPermission}
      onOpenLocationSettings={s.openLocationSettings}
      onUpdateKeepScreenAwake={s.updateKeepScreenAwake}
      crashReportingEnabled={s.crashReportingEnabled}
      onUpdateCrashReportingEnabled={s.updateCrashReportingEnabled}
      onToggleMapType={s.toggleMapType}
      onUpdateShowPhotosOnMap={s.updateShowPhotosOnMap}
      photoDisplayLimitId={s.photoDisplayLimitId}
      onUpdatePhotoDisplayLimitId={s.updatePhotoDisplayLimitId}
      isSyncingPhotoLibrary={s.isSyncingPhotoLibrary}
      onReloadPhotoLibrary={() => {
        s.startPhotoLibrarySync().catch((error: unknown) => {
          console.warn('Failed to start photo library sync:', error);
        });
      }}
      selectedAppColorPresetId={s.selectedAppColorPresetId}
      onUpdateAppColorPreset={s.updateAppColorPreset}
      onUpdateUserLocationIcon={(iconId) => s.updateUserLocationIcon(iconId, s.premiumAccessState, s.showPremiumLockedMessage)}
      onOpenStayPlaces={s.openStayPlaces}
      onOpenAboutAppScreen={() => router.push('/settings/about')}
      onOpenFirstLaunchTutorial={s.openFirstLaunchTutorial}
      onOpenFaqScreen={() => router.push('/settings/faq')}
      onOpenLicenseScreen={() => router.push('/settings/licenses')}
      onOpenTermsOfService={() => s.openLegalLink(TERMS_OF_SERVICE_URL)}
      onOpenPrivacyPolicy={() => s.openLegalLink(PRIVACY_POLICY_URL)}
      onOpenSpecifiedCommercialTransactionAct={() => s.openLegalLink(SPECIFIED_COMMERCIAL_TRANSACTION_ACT_URL)}
      onPurchaseMonthlyPremiumPackage={() => {
        s.purchasePremiumPackageFromSettings('monthly').catch((error: unknown) => {
          console.warn('Failed to purchase monthly premium package:', error);
        });
      }}
      onPurchaseYearlyPremiumPackage={() => {
        s.purchasePremiumPackageFromSettings('yearly').catch((error: unknown) => {
          console.warn('Failed to purchase yearly premium package:', error);
        });
      }}
      onPresentPremiumCustomerCenter={() => {
        s.openPremiumCustomerCenter().catch((error: unknown) => {
          console.warn('Failed to open premium customer center:', error);
        });
      }}
      onRestorePremiumPurchases={() => {
        s.restorePurchasesFromSettings().catch((error: unknown) => {
          console.warn('Failed to restore premium purchases:', error);
        });
      }}
      onExportAllLogs={s.exportAllLogs}
      onImportGpx={s.importGpx}
      onDeleteAllData={s.deleteAllData}
    />
  );
}
