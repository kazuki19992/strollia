import { StyleSheet } from 'react-native';

import type { AppTheme } from '@/theme/theme';

/**
 * アプリ全体で共有する汎用スタイル（ボタン・空状態・ローディング・ステータス等）を生成する。
 *
 * @param theme - アプリテーマ。
 */
export function createCommonStyles(theme: AppTheme) {
  const { colors } = theme;

  return {
    // General layout
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
    buttonDisabled: {
      opacity: 0.38,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
    },
    screenTransition: {
      flex: 1,
    },

    // Empty states
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

    // Icon button
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

    // Loading
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

    // Message / muted text
    message: {
      color: colors.mutedText,
      lineHeight: 20,
    },

    // Primary / secondary buttons
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

    // Stats
    stat: {
      color: colors.text,
      fontWeight: '800',
    },
    statsRow: {
      flexDirection: 'row',
      gap: 16,
    },

    // Status indicators
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

    // Development flag banner
    developmentFlagBannerContainer: {
      alignItems: 'center',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 20,
    },
    developmentFlagBannerText: {
      backgroundColor: colors.danger,
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
      color: colors.primaryText,
      fontSize: 12,
      fontWeight: '900',
      overflow: 'hidden',
      paddingHorizontal: 12,
      paddingVertical: 5,
    },

    // Monthly report navigation (used in report screens)
    reportNavigationOverlay: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: 'row',
      zIndex: 8,
    },
    reportNextZone: {
      flex: 1,
    },
    reportPreviousZone: {
      flex: 1,
    },
  } as const;
}
