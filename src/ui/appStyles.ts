import { StyleSheet } from 'react-native';

import { AppTheme } from '@/theme/theme';
import { createAchievementStyles } from './styles/achievementStyles';
import { createCommonStyles } from './styles/commonStyles';
import { createDailyLogStyles } from './styles/dailyLogStyles';
import { createMapStyles } from './styles/mapStyles';
import { createSettingsStyles } from './styles/settingsStyles';

/**
 * 現在のテーマから画面全体のStyleSheetを生成する。
 *
 * スタイルの定義は責務別に src/ui/styles/ 配下のファイルへ分割されており、
 * ここで全ファイルの結果を spread して単一の StyleSheet.create に渡す。
 * AppStyles 型は ReturnType<typeof createStyles> として全キーの集合を保持する。
 *
 * @param theme - OSカラースキームから選ばれたアプリテーマ。
 * @returns Appコンポーネントと子コンポーネントで共有するStyleSheet。
 */
export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    ...createAchievementStyles(theme),
    ...createMapStyles(theme),
    ...createSettingsStyles(theme),
    ...createDailyLogStyles(theme),
    ...createCommonStyles(theme),
  });
}

/** App画面群で共有するStyleSheetの型。 */
export type AppStyles = ReturnType<typeof createStyles>;
