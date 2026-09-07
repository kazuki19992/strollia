import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AppTheme } from '@/theme/theme';
import type { AppStyles } from '@/ui/appStyles';

/** 設定画面で使う、ボトムシート型の単一選択ドロップダウンのprops。 */
export type SelectionDropdownProps<T> = {
  /** 開閉ボタンのアクセシビリティラベル。 */
  accessibilityLabel: string;
  /** 現在選択中の値。 */
  selectedValue: T;
  /** 選択肢一覧。 */
  options: readonly T[];
  /** 選択肢の安定したキー。 */
  getKey: (option: T) => string;
  /** 選択肢の表示名。 */
  getLabel: (option: T) => string;
  /** 選択肢の左側に出す補助表示。 */
  renderLeading?: (option: T) => ReactNode;
  /** 選択を反映する。 */
  onSelect: (option: T) => void;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
};

/** テーマカラーと同じ操作感を設定値へ再利用する単一選択ドロップダウン。 */
export function SelectionDropdown<T>({
  accessibilityLabel,
  selectedValue,
  options,
  getKey,
  getLabel,
  renderLeading,
  onSelect,
  styles,
  theme,
}: SelectionDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // シートの上端をセーフエリアより少し下に保ち、長い候補は内部でスクロールさせる。
  const maximumSheetHeight = Math.max(0, height - insets.top - 16);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => setIsOpen(true)}
        style={styles.colorPresetDropdownButton}
      >
        {renderLeading?.(selectedValue)}
        <Text style={styles.colorPresetLabel}>{getLabel(selectedValue)}</Text>
        <MaterialCommunityIcons name="chevron-down" size={18} color={theme.colors.mutedText} />
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <View style={styles.colorPresetModalBackdrop}>
          <Pressable
            accessibilityLabel="選択を閉じる"
            accessibilityRole="button"
            style={StyleSheet.absoluteFill}
            onPress={() => setIsOpen(false)}
          />
          <View testID="selection-dropdown-sheet" style={[styles.colorPresetModalSheet, { maxHeight: maximumSheetHeight }]}>
            <ScrollView testID="selection-dropdown-options" style={styles.colorPresetModalScroll}>
              {options.map((option) => {
                const isSelected = option === selectedValue;

                return (
                  <Pressable
                    key={getKey(option)}
                    accessibilityRole="button"
                    accessibilityLabel={getLabel(option)}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      onSelect(option);
                      setIsOpen(false);
                    }}
                    style={styles.colorPresetRow}
                  >
                    {renderLeading?.(option)}
                    <Text style={styles.colorPresetRowLabel}>{getLabel(option)}</Text>
                    {isSelected ? <MaterialCommunityIcons name="check" size={18} color={theme.colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
