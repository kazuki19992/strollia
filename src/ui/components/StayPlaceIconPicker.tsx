import { Image, Modal, Pressable, SafeAreaView, ScrollView } from 'react-native';

import { STAY_PLACE_EMOJIS } from '@/features/stayPlaces/stayPlaceEmojiCatalog';
import type { AppTheme } from '@/theme/theme';
import type { AppStyles } from '@/ui/appStyles';
import { AppScreenHeader } from './AppScreenHeader';

/** 滞在場所アイコン選択画面のprops。 */
export type StayPlaceIconPickerProps = {
  /** 選択中の絵文字hexcode。 */
  selectedHexcode: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** ピッカーを閉じる。 */
  onClose: () => void;
  /** 選んだ絵文字hexcodeを反映する。 */
  onSelect: (hexcode: string) => void;
  /** ピッカーを表示するか。 */
  visible: boolean;
};

/**
 * Displays a modal for selecting a stay-place icon from the bundled emoji catalog.
 *
 * @param selectedHexcode - The hexcode of the currently selected icon
 * @param onClose - Called when the modal should close
 * @param onSelect - Called with the selected icon's hexcode
 */
export function StayPlaceIconPicker({ selectedHexcode, styles, theme, visible, onClose, onSelect }: StayPlaceIconPickerProps) {
  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.stayPlaceEmojiPickerModal}>
        <AppScreenHeader backLabel="編集" styles={styles} theme={theme} title="アイコンを選択" onBack={onClose} />
        <ScrollView contentContainerStyle={styles.stayPlaceEmojiPickerGrid}>
          {STAY_PLACE_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji.hexcode}
              accessibilityLabel={`${emoji.label}のアイコンを選択`}
              accessibilityRole="button"
              style={[styles.stayPlaceEmojiPickerButton, emoji.hexcode === selectedHexcode && styles.stayPlaceEmojiPickerButtonSelected]}
              onPress={() => {
                onSelect(emoji.hexcode);
                onClose();
              }}
            >
              <Image accessibilityLabel={emoji.label} source={emoji.asset} style={styles.stayPlaceEmojiPickerImage} />
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
