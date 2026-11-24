import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import type { AppStyles } from '@/ui/appStyles';
import { FIXED_MAP_UI_TEXT_PROPS } from './dashboardScaling';

export type BadgeFloatingButtonProps = {
  /** ボタンに表示するラベル。 */
  label: string;
  /** ラベルの右上に重ねるバッジの文言。表示しない場合はnull。 */
  badgeText: string | null;
  /** スクリーンリーダー向けのラベル。バッジの内容も含めて伝える。 */
  accessibilityLabel: string;
  /** 操作を受け付けない状態か(地図表示設定パネルを開いている間など)。 */
  disabled?: boolean;
  /** 押下処理。 */
  onPress: () => void;
  /** 画面共通スタイル。 */
  styles: AppStyles;
};

/**
 * 地図の上に浮かせる、バッジ付きのピル型ボタンを描画する。
 *
 * 位置は呼び出し側で決める(このコンポーネントは配置を持たない)。OS文字サイズで地図表示を
 * 覆わないよう、文字は拡大させない。
 */
export function BadgeFloatingButton({ label, badgeText, accessibilityLabel, disabled = false, onPress, styles }: BadgeFloatingButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.badgeFloatingButton, disabled && styles.mapDisplayBackgroundControlsDimmed]}
    >
      <MaterialCommunityIcons name="history" size={18} color="#ffffff" />
      <Text {...FIXED_MAP_UI_TEXT_PROPS} style={styles.badgeFloatingButtonLabel}>
        {label}
      </Text>
      {badgeText !== null && (
        <View style={styles.badgeFloatingButtonBadge}>
          <Text {...FIXED_MAP_UI_TEXT_PROPS} style={styles.badgeFloatingButtonBadgeText}>
            {badgeText}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
