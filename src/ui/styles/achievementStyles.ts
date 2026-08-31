import { StyleSheet } from 'react-native';

import type { AppTheme } from '@/theme/theme';

import { getSettingsDerivedColors, hexToRgba } from './styleHelpers';

/**
 * 実績・アンロックモーダル・チュートリアルダイアログ・コンフェッティ関連のスタイルを生成する。
 *
 * @param theme - アプリテーマ。
 */
export function createAchievementStyles(theme: AppTheme) {
  const { colors } = theme;

  return {
    achievementCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      flexBasis: '48%',
      gap: 8,
      padding: 12,
    },
    achievementCardLocked: {
      opacity: 0.62,
    },
    achievementDescription: {
      color: colors.mutedText,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
    },
    achievementGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    achievementGridTile: {
      flexBasis: '30%',
      gap: 6,
    },
    achievementTileImageWrap: {
      alignItems: 'center',
      alignSelf: 'stretch',
      aspectRatio: 1,
      justifyContent: 'center',
    },
    achievementTileImage: {
      height: '86%',
      width: '86%',
    },
    achievementTileImageNext: {
      opacity: 0.45,
    },
    achievementTileTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '900',
      lineHeight: 17,
      textAlign: 'center',
    },
    achievementTileProgress: {
      color: colors.mutedText,
      fontSize: 11,
      fontWeight: '800',
      textAlign: 'center',
    },
    achievementDialogDate: {
      color: colors.mutedText,
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'center',
    },
    achievementDialogShareButton: {
      alignItems: 'center',
      backgroundColor: colors.shareButtonBackground,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    achievementDialogShareButtonText: {
      color: colors.shareButtonText,
      fontSize: 15,
      fontWeight: '900',
    },
    achievementCloseButton: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 32,
      justifyContent: 'center',
      position: 'absolute',
      right: 12,
      top: 22,
      width: 32,
      zIndex: 3,
    },
    achievementCloseButtonIcon: {
      color: colors.text,
    },
    achievementImage: {
      height: 78,
      width: 78,
    },
    achievementImageFrame: {
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: colors.cardStrong,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      height: 96,
      justifyContent: 'center',
      width: 96,
    },
    achievementImageLocked: {
      opacity: 0.34,
    },
    achievementLockBadge: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderColor: colors.card,
      borderRadius: 999,
      borderWidth: 2,
      bottom: 6,
      height: 28,
      justifyContent: 'center',
      position: 'absolute',
      right: 6,
      width: 28,
    },
    achievementAutoCloseProgress: {
      backgroundColor: colors.primary,
      height: '100%',
      transformOrigin: 'left',
      width: '100%',
    },
    achievementAutoCloseTrack: {
      backgroundColor: colors.border,
      borderRadius: 999,
      height: 4,
      left: 18,
      opacity: 0.75,
      overflow: 'hidden',
      position: 'absolute',
      right: 18,
      top: 12,
    },
    achievementModalActions: {
      alignSelf: 'stretch',
      gap: 10,
    },
    achievementModalBackdrop: {
      alignItems: 'center',
      backgroundColor: hexToRgba(colors.background, 0.92),
      flex: 1,
      justifyContent: 'center',
      padding: 24,
    },
    achievementModalCard: {
      alignItems: 'center',
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderRadius: 30,
      borderWidth: 1,
      gap: 12,
      maxWidth: 360,
      padding: 22,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 24 },
      shadowOpacity: 0.26,
      shadowRadius: 32,
      width: '100%',
      zIndex: 2,
    },
    achievementModalDescription: {
      color: colors.mutedText,
      fontWeight: '800',
      lineHeight: 20,
      textAlign: 'center',
    },
    achievementModalEyebrow: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 1,
    },
    achievementModalImage: {
      height: 140,
      width: 140,
    },
    achievementModalTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
      lineHeight: 28,
      textAlign: 'center',
    },
    achievementPrimaryButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    achievementProgress: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '900',
    },
    achievementSecondaryButton: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.primary,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    achievementScroller: {
      gap: 18,
      paddingRight: 24,
    },
    achievementScrollerEmpty: {
      color: getSettingsDerivedColors(theme).settingsMuted,
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 20,
    },
    achievementScrollerImage: {
      height: 78,
      width: 78,
    },
    achievementScrollerItem: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 78,
    },
    achievementSection: {
      gap: 12,
    },
    achievementTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
      lineHeight: 19,
    },
    // App update notice dialog
    appUpdateNoticeDialogContent: {
      alignItems: 'center',
      alignSelf: 'stretch',
      gap: 12,
      paddingTop: 22,
    },
    // Dialog
    dialogSwipeHint: {
      color: colors.mutedText,
      fontSize: 12,
      fontWeight: '900',
      textAlign: 'center',
    },
    // First launch tutorial
    firstLaunchTutorialStepText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '400',
      textAlign: 'center',
    },
    firstLaunchTutorialTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '400',
      lineHeight: 28,
      textAlign: 'center',
    },
    firstLaunchTutorialDescription: {
      color: colors.mutedText,
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 22,
      textAlign: 'center',
    },
    firstLaunchTutorialDescriptionGroup: {
      gap: 8,
    },
    firstLaunchTutorialInstructionImageFrame: {
      alignSelf: 'stretch',
      paddingHorizontal: 16,
    },
    firstLaunchTutorialInstructionImage: {
      resizeMode: 'contain',
    },
    firstLaunchTutorialActions: {
      alignSelf: 'stretch',
      gap: 10,
      paddingTop: 4,
    },
    firstLaunchTutorialBulletList: {
      alignSelf: 'stretch',
      gap: 8,
      paddingTop: 2,
    },
    firstLaunchTutorialBulletRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 8,
    },
    firstLaunchTutorialBulletMark: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 22,
    },
    firstLaunchTutorialBulletText: {
      color: colors.mutedText,
      flex: 1,
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 22,
    },
    firstLaunchTutorialButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      justifyContent: 'center',
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    firstLaunchTutorialButtonText: {
      color: colors.primaryText,
      fontSize: 15,
      fontWeight: '400',
    },
    // Confetti
    confettiLayer: {
      ...StyleSheet.absoluteFill,
      overflow: 'hidden',
      zIndex: 1,
    },
    confettiPiece: {
      borderRadius: 1,
      height: 13,
      position: 'absolute',
      width: 9,
    },
  } as const;
}
