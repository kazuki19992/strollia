import { StyleSheet } from 'react-native';

import { NUMERIC_DISPLAY_FONT } from '@/theme/fonts';

/**
 * 年間レポートのストーリー専用の固定配色。
 *
 * ストーリーは共有画像の見栄えを優先し、OSのライト/ダークに関係なく常にダークで描く(spec §5)。
 * そのためテーマ値ではなく、月次レポートの reportStyles.ts と同じく専用の固定色を持つ。
 */
export const annualReportColors = {
  background: '#0d0d10',
  accent: '#73c7a2',
  accentDeep: '#3e8a6b',
  accentText: '#102018',
  text: '#f0f0f0',
  heading: 'rgba(255,255,255,0.7)',
  muted: 'rgba(255,255,255,0.55)',
  subtle: '#999999',
  calendarOff: '#222222',
  barDefault: '#3a3a3a',
  barLow: '#6b6b6b',
  barLowLabel: '#444444',
  cellOld: '#2f5a4a',
  chip: '#2e2e2e',
  mapOverlay: 'rgba(10,14,20,0.45)',
  routeFaint: 'rgba(115,199,162,0.25)',
  trophyOuter: '#b08000',
  trophyInner: '#ffe9a0',
  tile: 'rgba(255,255,255,0.06)',
  footprint: 'rgba(115,199,162,0.5)',
} as const;

/** ページ本文の左右の余白。 */
export const ANNUAL_REPORT_PAGE_HORIZONTAL_PADDING = 24;
/** セーフエリア上端から本文までの距離(進行バーとヘッダーの下)。 */
export const ANNUAL_REPORT_PAGE_TOP_OFFSET = 92;

/** 年間レポートのストーリーUI専用スタイル。 */
export const annualReportStyles = StyleSheet.create({
  // ---- 画面全体 ----
  screen: {
    backgroundColor: annualReportColors.background,
    flex: 1,
  },
  capture: {
    backgroundColor: annualReportColors.background,
    flex: 1,
    overflow: 'hidden',
  },
  progress: {
    left: 14,
    position: 'absolute',
    right: 14,
    zIndex: 20,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    left: 16,
    position: 'absolute',
    right: 56,
    zIndex: 20,
  },
  headerIcon: {
    borderRadius: 7,
    height: 26,
    width: 26,
  },
  headerTitle: {
    color: annualReportColors.text,
    fontSize: 12,
    lineHeight: 14,
  },
  headerSubtitle: {
    color: annualReportColors.muted,
    fontSize: 10,
    lineHeight: 12,
  },
  closeButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    width: 40,
    zIndex: 30,
  },
  tapZoneLeft: {
    left: 0,
    position: 'absolute',
    width: '35%',
    zIndex: 15,
  },
  tapZoneRight: {
    position: 'absolute',
    right: 0,
    width: '65%',
    zIndex: 15,
  },
  shareButton: {
    backgroundColor: annualReportColors.text,
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 16,
    position: 'absolute',
    right: 16,
    zIndex: 20,
  },
  shareButtonText: {
    color: '#111111',
    fontSize: 13,
    lineHeight: 18,
  },
  dialogContent: {
    gap: 10,
  },

  // ---- ページ共通 ----
  page: {
    backgroundColor: annualReportColors.background,
    flex: 1,
    overflow: 'hidden',
  },
  pageContent: {
    paddingHorizontal: ANNUAL_REPORT_PAGE_HORIZONTAL_PADDING,
  },
  pageHeading: {
    color: annualReportColors.heading,
    fontSize: 15,
    letterSpacing: 0.75,
    lineHeight: 22,
  },
  pageMessage: {
    color: annualReportColors.text,
    fontSize: 30,
    fontWeight: '600',
    lineHeight: 40,
    marginTop: 8,
  },
  pageMessageSmall: {
    fontSize: 24,
    lineHeight: 34,
  },
  accentText: {
    color: annualReportColors.accent,
  },
  accentNumber: {
    color: annualReportColors.accent,
    fontFamily: NUMERIC_DISPLAY_FONT,
    fontWeight: '400',
  },
  absoluteFill: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  // ---- 1 オープニング ----
  openingContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: ANNUAL_REPORT_PAGE_HORIZONTAL_PADDING,
  },
  openingYear: {
    color: annualReportColors.accent,
    fontFamily: NUMERIC_DISPLAY_FONT,
    fontSize: 84,
    lineHeight: 110,
  },
  openingPeriod: {
    color: annualReportColors.muted,
    fontSize: 12,
    marginTop: 14,
  },
  footprint: {
    backgroundColor: annualReportColors.footprint,
    borderRadius: 8,
    height: 16,
    position: 'absolute',
    width: 10,
  },

  // ---- 2 カレンダー ----
  calendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: 26,
  },
  calendarCell: {
    backgroundColor: annualReportColors.calendarOff,
    borderRadius: 2,
    overflow: 'hidden',
  },

  // ---- 3 総移動距離 ----
  distanceValueRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    marginBottom: 4,
    marginTop: 30,
  },
  distanceValue: {
    color: annualReportColors.text,
    flexShrink: 1,
    fontFamily: NUMERIC_DISPLAY_FONT,
    fontSize: 54,
  },
  distanceUnit: {
    color: annualReportColors.text,
    fontSize: 20,
    marginBottom: 6,
    marginLeft: 6,
  },
  comparison: {
    marginTop: 28,
  },
  comparisonText: {
    color: '#cccccc',
    fontSize: 14,
  },
  comparisonValue: {
    color: annualReportColors.accent,
    fontSize: 22,
    fontWeight: '600',
  },
  shuttleTrack: {
    borderBottomWidth: 2,
    borderColor: '#444444',
    borderStyle: 'dashed',
    height: 40,
    marginTop: 12,
  },
  shuttleLabelLeft: {
    bottom: 8,
    color: annualReportColors.subtle,
    fontSize: 11,
    left: 0,
    position: 'absolute',
  },
  shuttleLabelRight: {
    bottom: 8,
    color: annualReportColors.subtle,
    fontSize: 11,
    position: 'absolute',
    right: 0,
  },
  shuttleDot: {
    backgroundColor: annualReportColors.accent,
    borderRadius: 6,
    bottom: -7,
    height: 12,
    left: 0,
    position: 'absolute',
    width: 12,
  },

  // ---- 地図ページ ----
  mapOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: annualReportColors.mapOverlay,
  },
  mapDot: {
    backgroundColor: '#ffffff',
    borderColor: annualReportColors.accent,
    borderRadius: 8,
    borderWidth: 3,
    height: 16,
    width: 16,
  },
  dayCard: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    flexDirection: 'row',
    left: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'absolute',
    right: 20,
  },
  /** パネル内の1項目。項目どうしで幅を等分し、各項目を中央に置いて左寄りに見えないようにする。 */
  dayCardItem: {
    alignItems: 'center',
    flex: 1,
  },
  dayCardLabel: {
    color: '#cccccc',
    fontSize: 12,
  },
  dayCardValue: {
    color: '#ffffff',
    fontFamily: NUMERIC_DISPLAY_FONT,
    fontSize: 22,
    marginTop: 2,
  },
  dayCardValueRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
  },
  dayCardUnit: {
    color: '#cccccc',
    fontSize: 12,
    marginBottom: 3,
  },

  // ---- 5 月別 ----
  monthBars: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 6,
    marginTop: 40,
  },
  monthColumn: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  monthBar: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    width: '100%',
  },
  monthNumber: {
    color: '#888888',
    fontSize: 10,
    marginTop: 4,
  },
  monthLabel: {
    borderRadius: 6,
    fontSize: 11,
    marginBottom: 6,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  monthLabelWrapper: {
    alignItems: 'center',
    bottom: '100%',
    left: -30,
    position: 'absolute',
    right: -30,
  },

  // ---- 7 初訪問 ----
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 24,
  },
  chip: {
    backgroundColor: annualReportColors.chip,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipNew: {
    backgroundColor: annualReportColors.accent,
  },
  chipText: {
    color: annualReportColors.text,
    fontSize: 15,
  },
  chipTextNew: {
    color: annualReportColors.accentText,
  },

  // ---- 8 エリア ----
  /** 地図の下端に置く凡例の帯。bottom は画面側で共有ボタンの上に合わせる。 */
  areaLegend: {
    left: ANNUAL_REPORT_PAGE_HORIZONTAL_PADDING,
    position: 'absolute',
    right: ANNUAL_REPORT_PAGE_HORIZONTAL_PADDING,
  },
  legend: {
    color: '#888888',
    fontSize: 11,
  },

  // ---- 9 実績 ----
  trophies: {
    gap: 14,
    marginTop: 26,
  },
  trophyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  trophyIcon: {
    alignItems: 'center',
    backgroundColor: annualReportColors.trophyOuter,
    borderColor: annualReportColors.trophyInner,
    borderRadius: 28,
    borderWidth: 2,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  trophyGlow: {
    borderColor: 'rgba(240,192,64,0.6)',
    borderRadius: 28,
    borderWidth: 6,
    height: 56,
    position: 'absolute',
    width: 56,
  },
  trophyImage: {
    height: 40,
    width: 40,
  },
  trophyTitle: {
    color: annualReportColors.text,
    fontSize: 15,
  },
  trophyCaption: {
    color: annualReportColors.subtle,
    fontSize: 11,
  },

  // ---- 10 まとめ ----
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  summaryTile: {
    backgroundColor: annualReportColors.tile,
    borderRadius: 12,
    padding: 12,
  },
  summaryMapTile: {
    backgroundColor: annualReportColors.tile,
    borderRadius: 12,
    height: 120,
    overflow: 'hidden',
    width: '100%',
  },
  summaryLabel: {
    color: '#aaaaaa',
    fontSize: 11,
  },
  summaryValue: {
    color: '#ffffff',
    fontSize: 22,
    marginTop: 2,
  },
});
