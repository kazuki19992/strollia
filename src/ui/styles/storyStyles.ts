import type { AppTheme } from '@/theme/theme';

/**
 * ストーリー再生の汎用部品（進行バー）のスタイルを生成する。
 *
 * ストーリーはOSのライト/ダークに関わらず固定ダーク配色のため、白の半透明を直接使う。
 *
 * @param _theme - アプリテーマ（固定配色のため未使用。他のスタイルファイルとシグネチャを揃える）。
 */
export function createStoryStyles(_theme: AppTheme) {
  return {
    storyProgressRow: {
      flexDirection: 'row',
      gap: 4,
    },
    storyProgressSegment: {
      flex: 1,
      height: 3,
      borderRadius: 2,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.28)',
    },
    storyProgressFill: {
      height: '100%',
      backgroundColor: '#FFFFFF',
    },
  } as const;
}
