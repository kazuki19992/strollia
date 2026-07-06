import { getAppColorPreset } from '@/features/customization/colorPresets';
import type { AppTheme } from '@/theme/theme';

/** #rrggbbの色をrgba表記へ変換する。 */
function hexToRgba(hex: string, alpha: number): string {
  const normalizedHex = hex.replace('#', '');
  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(2)})`;
}

/**
 * 設定画面・共通ヘッダー・リスト行・フォーム項目・色プリセット・アバウト・ライセンス関連のスタイルを生成する。
 *
 * @param theme - アプリテーマ。
 */
export function createSettingsStyles(theme: AppTheme) {
  const { colors } = theme;
  // Plusバッジはアプリカラープリセットに関わらず常に「まっちゃ」色を使う。
  // 文字色もまっちゃプリセットのprimaryTextを使い、両モードでコントラストを保つ。
  const matchaPreset = getAppColorPreset('matcha');
  const matchaColors = theme.name === 'dark' ? matchaPreset.dark : matchaPreset.light;
  const plusBadgeColor = matchaColors.primary;
  const plusBadgeTextColor = matchaColors.primaryText;
  const settingsText = theme.name === 'dark' ? '#ffffff' : '#333333';
  const settingsMuted = theme.name === 'dark' ? 'rgba(255, 255, 255, 0.62)' : '#767676';
  const settingsBorder = theme.name === 'dark' ? 'rgba(255, 255, 255, 0.28)' : 'rgba(51, 51, 51, 0.20)';
  const settingsBackButtonText = theme.name === 'dark' ? '#333333' : settingsText;
  const selectionSurface = hexToRgba(colors.primary, 0.1);
  const settingsDanger = theme.name === 'dark' ? colors.danger : '#b0002f';
  const settingsDangerSurface = theme.name === 'dark' ? 'rgba(255, 136, 153, 0.12)' : 'rgba(176, 0, 47, 0.05)';
  const settingsGpsActive = '#00b035';
  const settingsGpsDanger = '#b0002f';
  const settingsWarning = '#a36100';

  return {
    // App screen container
    appScreen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    screenList: {
      gap: 16,
      paddingBottom: 34,
      paddingHorizontal: 24,
      paddingTop: 0,
    },
    screenSection: {
      gap: 10,
    },
    screenSectionBody: {
      gap: 14,
    },
    screenSectionHeading: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    screenSectionTitle: {
      color: settingsText,
      fontSize: 16,
      fontWeight: '900',
      lineHeight: 20,
    },
    sectionTitle: {
      color: settingsText,
      fontSize: 18,
      fontWeight: '900',
      lineHeight: 23,
    },

    // App screen header (back button + title)
    appHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'flex-start',
      minHeight: 68,
      paddingBottom: 16,
      paddingHorizontal: 24,
      paddingTop: 18,
      position: 'relative',
    },
    appHeaderBackButton: {
      alignItems: 'center',
      backgroundColor: theme.name === 'dark' ? '#ffffff' : '#d9d9d9',
      borderRadius: 999,
      flexDirection: 'row',
      gap: 2,
      height: 34,
      justifyContent: 'center',
      minWidth: 81,
      paddingLeft: 12,
      paddingRight: 18,
      zIndex: 1,
    },
    appHeaderBackButtonText: {
      color: settingsBackButtonText,
      fontSize: 13,
      fontWeight: '400',
    },
    appHeaderSubtitle: {
      color: settingsText,
      fontSize: 11,
      fontWeight: '400',
      lineHeight: 14,
      textAlign: 'center',
    },
    appHeaderTitle: {
      color: settingsText,
      fontSize: 14,
      fontWeight: '900',
      left: 0,
      lineHeight: 18,
      position: 'absolute',
      right: 0,
      textAlign: 'center',
      top: 26,
    },
    appHeaderTitleInStack: {
      color: settingsText,
      fontSize: 14,
      fontWeight: '900',
      lineHeight: 18,
      textAlign: 'center',
    },
    appHeaderTitleStack: {
      alignItems: 'center',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 22,
    },

    // List rows
    appListItem: {
      alignItems: 'center',
      borderTopColor: settingsBorder,
      borderTopWidth: 1,
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
      minHeight: 56,
      paddingVertical: 13,
    },
    appListItemDetail: {
      color: settingsMuted,
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 20,
    },
    appListItemSubtitle: {
      color: settingsMuted,
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 19,
    },
    appListItemTextColumn: {
      flex: 1,
      gap: 1,
    },
    appListItemTitle: {
      color: settingsText,
      flex: 1,
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 20,
    },
    appListItemTitleProminent: {
      fontSize: 23,
      lineHeight: 30,
    },

    // Settings card / rows
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
    settingsActionTextColumn: {
      flex: 1,
      gap: 5,
    },
    settingsActionTitleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
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
    settingsFreeBadge: {
      backgroundColor: settingsGpsDanger,
    },
    settingsIconTileContent: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 5,
      justifyContent: 'center',
      minHeight: 34,
    },
    settingsInlineRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
      justifyContent: 'space-between',
    },
    settingsInlineText: {
      flex: 1,
      gap: 3,
      minWidth: 0,
    },
    settingsPlusBadge: {
      backgroundColor: plusBadgeColor,
      borderRadius: 6,
      color: plusBadgeTextColor,
      fontSize: 11,
      fontWeight: '400',
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingVertical: 7,
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
    settingsSubscriptionActions: {
      gap: 16,
    },
    settingsSubscriptionRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
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

    // GPS recording status panel
    settingsGpsPanel: {
      borderRadius: 10,
      gap: 28,
      minHeight: 96,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    settingsGpsPanelActive: {
      backgroundColor: settingsGpsActive,
    },
    settingsGpsPanelButton: {
      alignItems: 'center',
      backgroundColor: '#ffffff',
      borderRadius: 999,
      justifyContent: 'center',
      marginTop: 8,
      minHeight: 34,
      paddingHorizontal: 18,
      paddingVertical: 8,
    },
    settingsGpsPanelButtonDangerText: {
      color: settingsGpsDanger,
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
    },
    settingsGpsPanelButtonWarningText: {
      color: settingsWarning,
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
    },
    settingsGpsPanelDanger: {
      backgroundColor: settingsGpsDanger,
    },
    settingsGpsPanelText: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '400',
      lineHeight: 14,
    },
    settingsGpsPanelTitle: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '900',
      lineHeight: 23,
    },
    settingsGpsPanelWarning: {
      backgroundColor: settingsWarning,
    },
    settingsGpsPanelWithAction: {
      gap: 4,
    },

    // Danger action row
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

    // Action pill (outline button)
    actionPill: {
      alignItems: 'center',
      backgroundColor: 'transparent',
      borderColor: settingsText,
      borderRadius: 999,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 40,
      paddingHorizontal: 22,
      paddingVertical: 10,
    },
    actionPillContent: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'center',
    },
    actionPillContentLeft: {
      justifyContent: 'flex-start',
      width: '100%',
    },
    actionPillDanger: {
      backgroundColor: settingsDangerSurface,
      borderColor: settingsDanger,
    },
    actionPillDangerText: {
      color: settingsDanger,
    },
    actionPillLeft: {
      alignItems: 'stretch',
      paddingHorizontal: 22,
    },
    actionPillText: {
      color: settingsText,
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
      textAlign: 'center',
    },

    // Form items
    formItemDescription: {
      color: settingsMuted,
      fontSize: 11,
      fontWeight: '400',
      lineHeight: 14,
    },
    formItemTitle: {
      color: settingsText,
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
    },
    infoBlock: {
      gap: 4,
    },

    // Option group / selection tile
    optionGroup: {
      gap: 8,
    },
    optionGroupGrid: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      gap: 10,
    },
    optionGroupHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
    },
    selectionTile: {
      alignItems: 'center',
      backgroundColor: 'transparent',
      borderColor: settingsBorder,
      borderWidth: 1,
      flex: 1,
      gap: 8,
      justifyContent: 'center',
      minHeight: 66,
      minWidth: 0,
      paddingHorizontal: 8,
      paddingVertical: 7,
    },
    selectionTileSelected: {
      backgroundColor: selectionSurface,
      borderColor: colors.primary,
      borderWidth: 4,
    },
    selectionTileSwatch: {
      borderColor: settingsMuted,
      borderWidth: 2,
      height: 28,
      width: 84,
    },
    selectionTileText: {
      color: settingsText,
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 17,
      textAlign: 'center',
    },
    selectionTileWide: {
      minWidth: 0,
    },

    // Color preset picker
    colorPresetDot: {
      borderRadius: 999,
      height: 16,
      width: 16,
    },
    colorPresetDropdownButton: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    colorPresetLabel: {
      color: colors.text,
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
    },
    colorPresetModalBackdrop: {
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      flex: 1,
      justifyContent: 'flex-end',
    },
    colorPresetModalSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 34,
      paddingTop: 8,
    },
    colorPresetRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    colorPresetRowLabel: {
      color: colors.text,
      flex: 1,
      fontSize: 16,
    },

    // Customization (location icon / color preset tile)
    customizationOption: {
      backgroundColor: colors.cardStrong,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flex: 1,
      gap: 8,
      minWidth: 96,
      padding: 12,
    },
    customizationOptionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    customizationOptionSelected: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    customizationOptionText: {
      color: colors.text,
      fontWeight: '900',
    },
    customizationSection: {
      gap: 10,
    },

    // Support user ID
    supportUserIdLabel: {
      color: settingsMuted,
      fontSize: 11,
    },
    supportUserIdRow: {
      gap: 2,
      paddingHorizontal: 4,
      paddingTop: 4,
    },
    supportUserIdValue: {
      color: settingsMuted,
      flexShrink: 1,
      fontSize: 11,
    },
    supportUserIdValueRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
    },

    // About app / license screens
    aboutAppBodyText: {
      color: settingsText,
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 22,
    },
    aboutAppContent: {
      gap: 22,
      paddingBottom: 34,
      paddingHorizontal: 24,
      paddingTop: 2,
    },
    aboutAppIcon: {
      borderRadius: 24,
      height: 112,
      width: 112,
    },
    aboutAppIconWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 6,
      paddingTop: 4,
    },
    licenseBodyText: {
      color: settingsText,
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 18,
    },
    licenseDetail: {
      gap: 20,
      paddingBottom: 34,
      paddingHorizontal: 24,
      paddingTop: 2,
    },
    licenseDetailTitle: {
      color: settingsText,
      fontSize: 22,
      fontWeight: '900',
      lineHeight: 28,
    },
    licenseList: {
      paddingBottom: 34,
      paddingHorizontal: 24,
      paddingTop: 0,
    },
    licenseMetaLabel: {
      color: settingsMuted,
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 16,
      width: 92,
    },
    licenseMetaList: {
      borderBottomColor: settingsBorder,
      borderBottomWidth: 1,
      borderTopColor: settingsBorder,
      borderTopWidth: 1,
    },
    licenseMetaRow: {
      alignItems: 'flex-start',
      borderBottomColor: settingsBorder,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 12,
      paddingVertical: 12,
    },
    licenseMetaValue: {
      color: settingsText,
      flex: 1,
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 18,
    },

    // Paywall / premium
    paywallLegal: {
      gap: 8,
      marginTop: 4,
    },
    paywallLegalLink: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
      textDecorationLine: 'underline',
    },
    paywallLegalLinks: {
      flexDirection: 'row',
      gap: 16,
    },
    premiumBadge: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      color: colors.primaryText,
      fontSize: 11,
      fontWeight: '900',
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
  } as const;
}
