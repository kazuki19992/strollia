import { StyleSheet } from 'react-native';

import { AppTheme } from '../theme/theme';

/**
 * 現在のテーマから画面全体のStyleSheetを生成する。
 *
 * @param theme - OSカラースキームから選ばれたアプリテーマ。
 * @returns Appコンポーネントと子コンポーネントで共有するStyleSheet。
 */
export function createStyles(theme: AppTheme) {
  const { colors } = theme;

  return StyleSheet.create({
    actions: {
      flexDirection: 'row',
      gap: 10,
    },
    autoRecordNote: {
      color: colors.mutedText,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    backButton: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    backButtonText: {
      color: colors.primary,
      fontWeight: '900',
    },
    bottomBar: {
      alignItems: 'center',
      bottom: 26,
      flexDirection: 'row',
      gap: 12,
      left: 16,
      position: 'absolute',
      right: 16,
      zIndex: 2,
    },
    bottomSideSpacer: {
      width: 50,
    },
    buttonDisabled: {
      opacity: 0.38,
    },
    container: {
      backgroundColor: colors.background,
      flex: 1,
    },
    dangerAction: {
      alignItems: 'center',
      backgroundColor: colors.dangerSurface,
      borderColor: colors.danger,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    dangerActionText: {
      color: colors.danger,
      fontWeight: '900',
    },
    dailyCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      gap: 10,
      padding: 16,
    },
    dailyContainer: {
      backgroundColor: colors.background,
      flex: 1,
    },
    dailyDate: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
    },
    dailyEmptyCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      gap: 8,
      margin: 16,
      padding: 18,
    },
    dailyHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
      padding: 16,
    },
    dailyList: {
      gap: 12,
      padding: 16,
      paddingTop: 0,
    },
    dailyMap: {
      height: 180,
      width: '100%',
    },
    dailyMapFrame: {
      borderRadius: 20,
      marginTop: 4,
      overflow: 'hidden',
    },
    dailyStat: {
      color: colors.text,
      fontWeight: '800',
    },
    dailyStatsRow: {
      flexDirection: 'row',
      gap: 16,
    },
    dailyTime: {
      color: colors.mutedText,
      fontWeight: '700',
    },
    dailyTitle: {
      color: colors.text,
      flex: 1,
      fontSize: 20,
      fontWeight: '900',
      textAlign: 'center',
    },
    endpointMarker: {
      borderColor: colors.card,
      borderRadius: 999,
      borderWidth: 2,
      paddingHorizontal: 10,
      paddingVertical: 6,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
    },
    endpointMarkerText: {
      color: colors.primaryText,
      fontSize: 12,
      fontWeight: '900',
    },
    emptyCard: {
      alignSelf: 'center',
      backgroundColor: colors.surfaceOverlay,
      borderRadius: 24,
      gap: 6,
      marginHorizontal: 24,
      marginTop: 92,
      padding: 18,
    },
    emptyText: {
      color: colors.mutedText,
      lineHeight: 20,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    iconButton: {
      backgroundColor: colors.surfaceOverlay,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    iconButtonText: {
      color: colors.text,
      fontWeight: '800',
    },
    headerSpacer: {
      width: 70,
    },
    locationMeta: {
      color: colors.mutedText,
      fontSize: 12,
      fontWeight: '800',
    },
    locationName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
    locationPill: {
      alignItems: 'center',
      backgroundColor: colors.surfaceOverlay,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      gap: 2,
      flex: 1,
      maxWidth: 260,
      paddingHorizontal: 18,
      paddingVertical: 10,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
    },
    loadingContainer: {
      alignItems: 'center',
      backgroundColor: colors.background,
      flex: 1,
      justifyContent: 'center',
    },
    loadingText: {
      color: colors.text,
      marginTop: 12,
    },
    map: {
      ...StyleSheet.absoluteFillObject,
    },
    menuButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceOverlay,
      borderRadius: 999,
      height: 42,
      justifyContent: 'center',
      width: 42,
    },

    menuCard: {
      backgroundColor: colors.cardStrong,
      borderColor: colors.border,
      borderRadius: 26,
      borderWidth: 1,
      overflow: 'hidden',
      position: 'absolute',
      right: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.2,
      shadowRadius: 28,
      top: 70,
      width: 248,
      zIndex: 3,
    },
    menuScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.name === 'dark' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(45, 36, 22, 0.24)',
      zIndex: 1,
    },
    menuScrimPressable: {
      flex: 1,
    },
    menuItem: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 14,
      paddingHorizontal: 20,
      paddingVertical: 18,
    },
    menuItemText: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '900',
    },
    message: {
      color: colors.mutedText,
      lineHeight: 20,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
    },

    photoMarkerBubble: {
      backgroundColor: colors.surfaceOverlay,
      borderColor: colors.card,
      borderRadius: 10,
      borderWidth: 2,
      height: 46,
      overflow: 'hidden',
      padding: 2,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      width: 46,
    },
    photoMarkerImage: {
      borderRadius: 7,
      height: '100%',
      width: '100%',
    },
    photoPreviewBackdrop: {
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.92)',
      flex: 1,
      justifyContent: 'center',
    },
    photoPreviewCloseArea: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: 18,
      width: '100%',
    },
    photoPreviewHint: {
      bottom: 42,
      color: '#ffffff',
      fontWeight: '800',
      position: 'absolute',
    },
    photoPreviewImage: {
      height: '88%',
      width: '100%',
    },
    photoStatusCard: {
      alignSelf: 'center',
      backgroundColor: colors.surfaceOverlay,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      marginHorizontal: 24,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    permissionButton: {
      alignItems: 'center',
      backgroundColor: colors.danger,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    permissionButtonText: {
      color: colors.primaryText,
      fontWeight: '900',
    },
    permissionCard: {
      alignSelf: 'center',
      backgroundColor: colors.dangerSurface,
      borderColor: colors.danger,
      borderRadius: 24,
      borderWidth: 1,
      gap: 10,
      marginHorizontal: 20,
      marginTop: 92,
      padding: 16,
    },
    permissionSettingsBox: {
      backgroundColor: colors.dangerSurface,
      borderColor: colors.danger,
      borderRadius: 20,
      borderWidth: 1,
      gap: 10,
      padding: 14,
    },
    permissionText: {
      color: colors.mutedText,
      lineHeight: 20,
    },
    permissionTitle: {
      color: colors.danger,
      fontSize: 17,
      fontWeight: '900',
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      flex: 1,
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    primaryButtonText: {
      color: colors.primaryText,
      fontWeight: '900',
    },
    screenTransition: {
      flex: 1,
    },
    secondaryButton: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.primary,
      borderRadius: 999,
      borderWidth: 1,
      minWidth: 92,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontWeight: '900',
    },
    recenterButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceOverlay,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 50,
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 16,
      width: 50,
    },
    recenterButtonContainer: {
      alignItems: 'flex-end',
      width: 50,
    },
    rightControls: {
      flexDirection: 'row',
      gap: 10,
    },
    settingsAction: {
      alignItems: 'center',
      backgroundColor: colors.cardStrong,
      borderRadius: 18,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    settingsActionText: {
      color: colors.primary,
      fontWeight: '900',
    },
    settingsCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      gap: 14,
      padding: 16,
    },
    settingsDescription: {
      color: colors.mutedText,
      lineHeight: 20,
    },
    settingsList: {
      gap: 12,
      padding: 16,
      paddingTop: 0,
    },
    settingsStatusRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    settingsStatusText: {
      color: colors.text,
      fontWeight: '900',
    },
    settingsTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
    },
    settingsToggleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
    },
    settingsToggleTextColumn: {
      flex: 1,
      gap: 8,
    },
    stat: {
      color: colors.text,
      fontWeight: '800',
    },
    statsRow: {
      flexDirection: 'row',
      gap: 16,
    },
    statusDot: {
      backgroundColor: colors.border,
      borderRadius: 999,
      height: 9,
      width: 9,
    },
    statusDotActive: {
      backgroundColor: colors.primary,
    },
    statusPill: {
      alignItems: 'center',
      backgroundColor: colors.surfaceOverlay,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    statusText: {
      color: colors.text,
      fontWeight: '900',
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 8,
      zIndex: 2,
    },
  });
}

/** App画面群で共有するStyleSheetの型。 */
export type AppStyles = ReturnType<typeof createStyles>;
