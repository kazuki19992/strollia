import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import type { AppStyles } from '@/ui/appStyles';
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
  /** 操作を受け付けない状態か。 */
  disabled?: boolean;
  /** 押下処理。 */
  onPress: () => void;
};

/** 下部ナビゲーションのアイコンボタンを描画する。 */
export function DashboardAction({ icon, label, onPress, scale, styles, disabled = false }: DashboardActionProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.dashboardAction, getScaledDashboardActionStyle(scale)]}
    >
      {icon}
    </Pressable>
  );
}
