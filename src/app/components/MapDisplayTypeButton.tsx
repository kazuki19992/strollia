import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import type { AppStyles } from '@/app/appStyles';
import { FIXED_MAP_UI_TEXT_PROPS } from './dashboardScaling';

export type MapDisplayTypeButtonProps = {
  /** MaterialCommunityIconsのアイコン名。 */
  icon: 'map-outline' | 'satellite-variant';
  /** 現在選択中かどうか。 */
  isSelected: boolean;
  /** 表示ラベル。アクセシビリティラベルを兼ねる。 */
  label: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 押下処理。 */
  onPress: () => void;
};

/** 地図表示ポップオーバーの地図種別ボタンを描画する。 */
export function MapDisplayTypeButton({ icon, isSelected, label, onPress, styles }: MapDisplayTypeButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.mapDisplayTypeButton, isSelected && styles.mapDisplayTypeButtonSelected]}
    >
      <MaterialCommunityIcons name={icon} size={36} color="#ffffff" />
      {isSelected && (
        <View style={styles.mapDisplayTypeSelectedBadge}>
          <Text {...FIXED_MAP_UI_TEXT_PROPS} style={styles.mapDisplayTypeSelectedBadgeText}>
            ✓ 選択中
          </Text>
        </View>
      )}
      <Text {...FIXED_MAP_UI_TEXT_PROPS} style={styles.mapDisplayTypeLabel}>
        {label}
      </Text>
    </Pressable>
  );
}
