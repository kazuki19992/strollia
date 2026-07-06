import { NUMERIC_DISPLAY_FONT } from '@/theme/fonts';
import type { AppTheme } from '@/theme/theme';

/**
 * 日別ログ画面・ルートマップ・スライダー・GIF生成・共有カード関連のスタイルを生成する。
 *
 * @param theme - アプリテーマ。
 */
export function createDailyLogStyles(theme: AppTheme) {
  const { colors } = theme;
  const settingsText = theme.name === 'dark' ? '#ffffff' : '#333333';
  const settingsMuted = theme.name === 'dark' ? 'rgba(255, 255, 255, 0.62)' : '#767676';
  const settingsBorder = theme.name === 'dark' ? 'rgba(255, 255, 255, 0.28)' : 'rgba(51, 51, 51, 0.20)';
  return {
    // Daily log list
    dailyEmptyCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      gap: 8,
      margin: 16,
      padding: 18,
    },
    dailyLogDetailActions: {
      gap: 12,
      paddingHorizontal: 24,
    },
    dailyLogDetailCapture: {
      gap: 28,
      paddingBottom: 24,
      paddingHorizontal: 24,
      paddingTop: 24,
    },
    dailyLogDetailContent: {
      gap: 28,
      paddingBottom: 34,
    },
    dailyLogDetailPlusLabel: {
      color: theme.colors.routeMapEmptyText,
      fontSize: 16,
      fontWeight: '700',
    },
    dailyLogDetailPlusSection: {
      borderRadius: 12,
      marginHorizontal: 24,
      overflow: 'hidden',
    },
    dailyLogDetailSection: {
      gap: 18,
    },
    dailyLogDetailSubTitle: {
      color: settingsText,
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 20,
    },
    dailyLogList: {
      gap: 34,
      paddingBottom: 34,
      paddingHorizontal: 24,
      paddingTop: 36,
    },
    dailyLogListGroup: {
      borderBottomColor: settingsBorder,
      borderBottomWidth: 1,
    },
    dailyLogMonthSection: {
      gap: 18,
    },
    dailyLogShareCardOffscreen: {
      left: -10000,
      position: 'absolute',
      top: 0,
    },
    dailyLogShareDate: {
      color: colors.mutedText,
      fontSize: 13,
      fontWeight: '700',
    },
    dailyLogShareFooter: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 16,
    },
    dailyLogShareFooterBranding: {
      marginTop: 0,
    },

    // Data summary rows
    dataSummaryLabel: {
      color: settingsText,
      flex: 1,
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 21,
    },
    dataSummaryList: {
      borderBottomColor: settingsBorder,
      borderBottomWidth: 1,
    },
    dataSummaryRow: {
      alignItems: 'center',
      borderTopColor: settingsBorder,
      borderTopWidth: 1,
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
      minHeight: 42,
      paddingVertical: 9,
    },
    dataSummaryValue: {
      color: settingsText,
      flexShrink: 1,
      fontSize: 19,
      fontWeight: '400',
      lineHeight: 25,
      textAlign: 'right',
    },

    // Route map panel
    routeMap: {
      height: '100%',
      width: '100%',
    },
    routeMapEmptyPanel: {
      alignItems: 'center',
      backgroundColor: colors.routeMapEmptyBackground,
      borderRadius: 8,
      height: 332,
      justifyContent: 'center',
      overflow: 'hidden',
      width: '100%',
    },
    routeMapEmptyText: {
      color: colors.routeMapEmptyText,
      fontSize: 28,
      fontWeight: '900',
      lineHeight: 34,
      textAlign: 'center',
    },
    routeMapFrame: {
      borderRadius: 8,
      height: 332,
      overflow: 'hidden',
      width: '100%',
    },
    routeTimeline: {
      gap: 18,
    },

    // Share button (callsite-specific styles for daily log context)
    shareButtonWide: {
      backgroundColor: colors.shareButtonBackground,
      marginHorizontal: 24,
    },
    shareButtonWideText: {
      color: colors.shareButtonText,
    },

    // Locked overlay (Plus gate blur overlay)
    lockedOverlay: {
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Step / range sliders
    stepSlider: {
      gap: 2,
      paddingHorizontal: 6,
    },
    stepSliderEdgeLabel: {
      color: settingsMuted,
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
    },
    stepSliderFill: {
      backgroundColor: theme.name === 'dark' ? '#f2f2f2' : '#172b63',
      borderRadius: 999,
      height: '100%' as unknown as number,
    },
    stepSliderRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    stepSliderThumb: {
      backgroundColor: theme.name === 'dark' ? '#f2f2f2' : '#ffffff',
      borderRadius: 999,
      elevation: 2,
      height: 16,
      left: 0,
      position: 'absolute',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      top: 8,
      width: 28,
    },
    stepSliderTouchArea: {
      flex: 1,
      height: 32,
      justifyContent: 'center',
    },
    stepSliderTrack: {
      backgroundColor: theme.name === 'dark' ? '#4b4b4b' : '#e0e0e0',
      borderRadius: 999,
      height: 4,
      overflow: 'hidden',
    },
    stepSliderValueLabel: {
      color: settingsText,
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
      textAlign: 'center',
    },
    rangeSlider: {
      gap: 2,
      paddingHorizontal: 6,
    },
    rangeSliderEdgeLabel: {
      color: settingsMuted,
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
    },
    rangeSliderFill: {
      backgroundColor: theme.name === 'dark' ? '#f2f2f2' : '#172b63',
      borderRadius: 999,
      height: '100%' as unknown as number,
      position: 'absolute',
      top: 0,
    },
    rangeSliderRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    rangeSliderThumb: {
      backgroundColor: theme.name === 'dark' ? '#f2f2f2' : '#ffffff',
      borderRadius: 999,
      elevation: 2,
      height: 16,
      left: 0,
      position: 'absolute',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      top: 8,
      width: 28,
    },
    rangeSliderTouchArea: {
      flex: 1,
      height: 32,
      justifyContent: 'center',
    },
    rangeSliderTrack: {
      backgroundColor: theme.name === 'dark' ? '#4b4b4b' : '#e0e0e0',
      borderRadius: 999,
      height: 4,
    },
    rangeSliderValueLabel: {
      color: settingsText,
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
      textAlign: 'center',
    },

    // GIF export
    gifFrameBranding: {
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderRadius: 8,
      bottom: 12,
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
      position: 'absolute',
      right: 12,
    },
    gifFrameBrandingIcon: {
      borderRadius: 6,
      height: 34,
      width: 34,
    },
    gifFrameBrandingName: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '900',
      lineHeight: 16,
    },
    gifFrameBrandingTagline: {
      color: '#ffffff',
      fontSize: 9,
      lineHeight: 11,
    },
    gifFrameBrandingTextWrap: {
      justifyContent: 'center',
    },
    gifFrameContainer: {
      height: 480,
      left: -10000,
      position: 'absolute',
      top: 0,
      width: 480,
    },
    gifFrameDateText: {
      color: '#ffffff',
      fontSize: 11,
      marginTop: 2,
      opacity: 0.9,
    },
    gifFrameMap: {
      height: 480,
      width: 480,
    },
    gifFrameTimeBadge: {
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: 8,
      left: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
      position: 'absolute',
      top: 12,
    },
    gifFrameTimeText: {
      color: '#ffffff',
      fontFamily: NUMERIC_DISPLAY_FONT,
      fontSize: 26,
    },
    gifProgressBody: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 16,
      opacity: 0.8,
      textAlign: 'center',
    },
    gifProgressCancel: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      paddingVertical: 10,
      width: '100%' as unknown as number,
    },
    gifProgressCancelText: {
      color: colors.text,
      fontWeight: '700',
    },
    gifProgressFill: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      height: '100%' as unknown as number,
    },
    gifProgressTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
      marginBottom: 8,
      textAlign: 'center',
    },
    gifProgressTrack: {
      backgroundColor: theme.name === 'dark' ? '#4b4b4b' : '#e0e0e0',
      borderRadius: 999,
      height: 8,
      marginBottom: 16,
      overflow: 'hidden',
      width: '100%' as unknown as number,
    },
    gifRangeBody: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
      opacity: 0.8,
      textAlign: 'center',
    },
    gifRangeContent: {
      gap: 12,
      width: '100%' as unknown as number,
    },
    gifRangeTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
      textAlign: 'center',
    },

    // Top toast notification
    topToastContainer: {
      borderRadius: 12,
      elevation: 6,
      left: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      position: 'absolute',
      right: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      top: 60,
      zIndex: 1000,
    },
    topToastMessage: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
  } as const;
}
