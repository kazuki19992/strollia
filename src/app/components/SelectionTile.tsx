import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { AppStyles } from '../appStyles';

export type SelectionTileProps = {
  /** アイコン表示。 */
  icon?: ReactNode;
  /** 選択中かどうか。 */
  isSelected?: boolean;
  /** 表示名。改行を含めてよい。 */
  label: string;
  /** 押下処理。 */
  onPress?: () => void;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 色見本。 */
  swatchColor?: string;
  /** 2列幅にするか。 */
  wide?: boolean;
};

/** primary枠と10%塗りで選択状態を表すアウトライン選択ボタン。 */
export function SelectionTile({ icon, isSelected = false, label, onPress, styles, swatchColor, wide = false }: SelectionTileProps) {
  return (
    <Pressable
      accessibilityLabel={label.replace(/\n/g, '')}
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={[styles.selectionTile, wide && styles.selectionTileWide, isSelected && styles.selectionTileSelected]}
    >
      {swatchColor ? <View style={[styles.selectionTileSwatch, { backgroundColor: swatchColor }]} /> : icon}
      <Text style={styles.selectionTileText}>{label}</Text>
    </Pressable>
  );
}
