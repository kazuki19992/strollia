import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import type { AppStyles } from '@/app/appStyles';
import { getScaledDashboardActionStyle } from './dashboardScaling';

export type DashboardActionProps = {
  /** アイコン要素。 */
  icon: ReactNode;
  /** アクセシビリティラベルとタップ領域のラベル。 */
  label: string;
  /** ダッシュボードの縮小倍率。 */
  scale: number;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 押下処理。 */
  onPress: () => void;
};

/** 下部ナビゲーションのアイコンボタンを描画する。 */
export function DashboardAction({ icon, label, onPress, scale, styles }: DashboardActionProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.dashboardAction, getScaledDashboardActionStyle(scale)]}
    >
      {icon}
    </Pressable>
  );
}
