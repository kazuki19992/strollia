import { NavigationContainer, NavigationIndependentTree } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Animated, SafeAreaView, Text, View } from 'react-native';

import { PRIVACY_POLICY_URL, SPECIFIED_COMMERCIAL_TRANSACTION_ACT_URL, TERMS_OF_SERVICE_URL } from '@/config/legalLinks';
import { updateSentryScreenContext } from '@/config/sentry';
import type { DailyLogSummary } from '@/types/gps';
import { AchievementDialog } from './components/AchievementDialog';
import { AchievementListScreen } from './components/AchievementListScreen';
import { AboutAppScreen } from './components/AboutAppScreen';
import { FaqScreen } from './components/FaqScreen';
import { DailyLogDetailScreen } from './components/DailyLogDetailScreen';
import { DailyLogsScreen } from './components/DailyLogsScreen';
import { AchievementUnlockModal } from './components/AchievementUnlockModal';
import { FirstLaunchTutorialDialog } from './components/FirstLaunchTutorialDialog';
import { LicenseDetailScreen, LicenseScreen } from './components/LicenseScreen';
import type { OssLicenseEntry } from './generated/ossLicenses';
import { GpxImportProgressDialog } from './components/GpxImportProgressDialog';
import { MapScreen } from './components/MapScreen';
import { PhotoPreviewModals } from './components/PhotoPreviewModals';
import { PremiumPaywallModal } from './components/PremiumPaywallModal';
import { MonthlyReportScreen } from './components/reports/MonthlyReportScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { TopToast } from './components/TopToast';
import { useAppState } from './state/AppStateProvider';

type SettingsStackParamList = {
  SettingsHome: undefined;
  AboutApp: undefined;
  Faq: undefined;
  LicenseList: undefined;
  LicenseDetail: { license: OssLicenseEntry };
};

type DailyLogStackParamList = {
  DailyLogList: undefined;
  DailyLogDetail: { log: DailyLogSummary };
};

const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();
const DailyLogStack = createNativeStackNavigator<DailyLogStackParamList>();

/**
 * App.tsx の JSX レンダリング部をそのまま移植した互換シェルコンポーネント。
 *
 * AppStateProvider から全状態・操作を useAppState() で取得し、
 * 旧 App.tsx と同一の screenMode ベースのレンダリングを行う。
 * expo-router 移行後のテスト互換維持および段階的解体を目的とする。
 */
export function AppCompatShell(): React.ReactElement {
  const s = useAppState();

  if (!s.isReady) {
    return (
      <SafeAreaView style={s.styles.loadingContainer}>
        <ActivityIndicator color={s.theme.colors.primary} />
        <Text style={s.styles.loadingText}>Strolliaを準備しています...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={s.styles.container}>
      <StatusBar style={s.theme.name === 'dark' ? 'light' : 'dark'} />
      <TopToast
        visible={s.isWhileInUseToastVisible}
        message="アプリが起動している場合のみ記録します！"
        styles={s.styles}
        theme={s.theme}
        onHide={() => s.setIsWhileInUseToastVisible(false)}
      />
      {s.shouldShowDevelopmentFlagBanner && (
        <SafeAreaView pointerEvents="none" style={s.styles.developmentFlagBannerContainer}>
          <Text style={s.styles.developmentFlagBannerText}>開発フラグ有効</Text>
        </SafeAreaView>
      )}
      <Animated.View
        style={[
          s.styles.screenTransition,
          {
            opacity: s.screenTransitionOpacity,
            transform: [{ translateY: s.screenTransitionOpacity.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          },
        ]}
      >
        {s.screenMode === 'map' && (
          <MapScreen
            mapRef={s.mapRef}
            styles={s.styles}
            theme={s.theme}
            initialRegion={s.initialRegion}
            mapType={s.mapType}
            userLocationIcon={s.userLocationIcon}
            onCustomIconError={s.handleCustomIconLoadError}
            isFollowingUserLocation={s.isFollowingUserLocation}
            userCoordinate={s.userCoordinate}
            visitedGridCells={s.visitedGridCells}
            gridOverlayOpacity={s.gridOverlayOpacity}
            showPhotosOnMap={s.showPhotosOnMap}
            isUpdatingPhotoSetting={s.isUpdatingPhotoSetting}
            photoClusters={s.photoClusters}
            points={s.points}
            hasRequiredPermission={s.hasRequiredPermission}
            shouldOpenSettingsForPermission={s.shouldOpenSettingsForPermission}
            isWhileInUseOnlyMode={s.isWhileInUseRecordingMode}
            photoErrorMessage={s.photoErrorMessage}
            isLoadingPhotos={s.isLoadingPhotos}
            distance={s.distance}
            todayDistance={s.todayDistanceMeters}
            currentSpeedKmh={s.currentSpeedKmh}
            currentAreaLabel={s.currentAreaLabel}
            recenterButtonOpacity={s.recenterButtonOpacity}
            onMapReady={s.handleMapReady}
            onUserLocationChange={s.handleUserLocationChange}
            onPanDrag={s.handleMapPanDrag}
            onRegionChangeComplete={s.handleRegionChangeComplete}
            onRegionChange={s.handleRegionChange}
            onPhotoClusterPress={s.handlePhotoClusterPress}
            onOpenDailyLogs={s.openDailyLogs}
            onOpenAchievements={s.openAchievements}
            onOpenMonthlyReport={s.openMonthlyReport}
            onToggleMapType={s.toggleMapType}
            onUpdateShowPhotosOnMap={s.updateShowPhotosOnMap}
            onOpenSettings={s.openSettings}
            onRequestLocationPermission={s.requestLocationPermission}
            onRecenterOnUserLocation={s.recenterOnUserLocation}
          />
        )}
        {s.screenMode === 'dailyLogs' && (
          <NavigationIndependentTree>
            <NavigationContainer
              // 日別記録スタック内の遷移をSentryの画面コンテキストへ反映する。
              onStateChange={(state) => {
                const route = state?.routes[state.index ?? 0];
                const nextScreenName = route ? `DailyLogs:${route.name}` : 'DailyLogs:DailyLogList';
                s.setDailyLogsSentryScreenName(nextScreenName);
                updateSentryScreenContext(nextScreenName);
              }}
            >
              <DailyLogStack.Navigator
                initialRouteName="DailyLogList"
                screenOptions={{
                  animation: 'slide_from_right',
                  gestureEnabled: true,
                  headerShown: false,
                }}
              >
                <DailyLogStack.Screen name="DailyLogList">
                  {({ navigation }) => (
                    <DailyLogsScreen
                      dailyLogs={s.dailyLogs}
                      styles={s.styles}
                      theme={s.theme}
                      onBackToMap={s.openMap}
                      onOpenDailyLogDetail={(log) => navigation.navigate('DailyLogDetail', { log })}
                    />
                  )}
                </DailyLogStack.Screen>
                <DailyLogStack.Screen name="DailyLogDetail">
                  {({ navigation, route }) => (
                    <DailyLogDetailScreen
                      log={route.params.log}
                      styles={s.styles}
                      theme={s.theme}
                      premiumAccessState={s.premiumAccessState}
                      onBackToDailyLogs={() => navigation.goBack()}
                      onOpenPremiumPaywall={s.openPremiumPaywall}
                    />
                  )}
                </DailyLogStack.Screen>
              </DailyLogStack.Navigator>
            </NavigationContainer>
          </NavigationIndependentTree>
        )}
        {s.screenMode === 'achievements' && (
          <AchievementListScreen
            items={s.achievementItems}
            styles={s.styles}
            theme={s.theme}
            onBackToMap={s.openMap}
            onSelectAchievement={s.setSelectedAchievement}
          />
        )}
        {s.screenMode === 'monthlyReport' && (
          <MonthlyReportScreen
            dailyLogs={s.dailyLogs}
            points={s.points}
            achievements={s.achievementItems}
            monthlyAreaReport={s.monthlyAreaReport}
            theme={s.theme}
            onBackToMap={s.openMap}
          />
        )}
        {s.screenMode === 'settings' && (
          <NavigationIndependentTree>
            <NavigationContainer
              // 設定スタック内の遷移をSentryの画面コンテキストへ反映する。
              onStateChange={(state) => {
                const route = state?.routes[state.index ?? 0];
                const nextScreenName = route ? `Settings:${route.name}` : 'Settings:SettingsHome';
                s.setSettingsSentryScreenName(nextScreenName);
                updateSentryScreenContext(nextScreenName);
              }}
            >
              <SettingsStack.Navigator
                initialRouteName="SettingsHome"
                screenOptions={{
                  animation: 'slide_from_right',
                  gestureEnabled: true,
                  headerShown: false,
                }}
              >
                <SettingsStack.Screen name="SettingsHome">
                  {({ navigation }) => (
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
                      onBackToMap={s.openMap}
                      onStartRecording={() => s.startRecording('manual')}
                      onRequestLocationPermission={s.requestLocationPermission}
                      onOpenLocationSettings={s.openLocationSettings}
                      onUpdateKeepScreenAwake={s.updateKeepScreenAwake}
                      onToggleMapType={s.toggleMapType}
                      onUpdateShowPhotosOnMap={s.updateShowPhotosOnMap}
                      selectedAppColorPresetId={s.selectedAppColorPresetId}
                      onUpdateAppColorPreset={s.updateAppColorPreset}
                      onUpdateUserLocationIcon={(iconId) =>
                        s.updateUserLocationIcon(iconId, s.premiumAccessState, s.showPremiumLockedMessage)
                      }
                      onOpenAboutAppScreen={() => navigation.navigate('AboutApp')}
                      onOpenFirstLaunchTutorial={s.openFirstLaunchTutorial}
                      onOpenFaqScreen={() => navigation.navigate('Faq')}
                      onOpenLicenseScreen={() => navigation.navigate('LicenseList')}
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
                  )}
                </SettingsStack.Screen>
                <SettingsStack.Screen name="AboutApp">
                  {({ navigation }) => <AboutAppScreen styles={s.styles} theme={s.theme} onBackToSettings={() => navigation.goBack()} />}
                </SettingsStack.Screen>
                <SettingsStack.Screen name="Faq">
                  {({ navigation }) => <FaqScreen styles={s.styles} theme={s.theme} onBackToSettings={() => navigation.goBack()} />}
                </SettingsStack.Screen>
                <SettingsStack.Screen name="LicenseList">
                  {({ navigation }) => (
                    <LicenseScreen
                      styles={s.styles}
                      theme={s.theme}
                      onBackToSettings={() => navigation.goBack()}
                      onOpenLicenseDetail={(license) => navigation.navigate('LicenseDetail', { license })}
                    />
                  )}
                </SettingsStack.Screen>
                <SettingsStack.Screen name="LicenseDetail">
                  {({ navigation, route }) => (
                    <LicenseDetailScreen
                      license={route.params.license}
                      styles={s.styles}
                      theme={s.theme}
                      onBackToLicenseList={() => navigation.goBack()}
                    />
                  )}
                </SettingsStack.Screen>
              </SettingsStack.Navigator>
            </NavigationContainer>
          </NavigationIndependentTree>
        )}
      </Animated.View>

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
    </View>
  );
}
