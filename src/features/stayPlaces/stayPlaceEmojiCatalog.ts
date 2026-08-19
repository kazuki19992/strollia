import type { ImageSourcePropType } from 'react-native';

import { GENERATED_STAY_PLACE_EMOJIS } from '@/features/stayPlaces/stayPlaceEmojiCatalog.generated';

/** 滞在場所で選べる、静的に同梱されたTwemojiアイコン。 */
export type StayPlaceEmoji = {
  /** Emojibase由来の完全修飾Unicode hexcode。 */
  hexcode: string;
  /** Emojibase日本語データ由来の表示ラベル。 */
  label: string;
  /** Emojibase由来のUnicode文字列。DBへは保存しない。 */
  unicode: string;
  /** Metroが解決する同梱Twemoji画像。 */
  asset: ImageSourcePropType;
};

/** 実行時に全Emojibase辞書を読み込まずに使える、固定の滞在場所アイコン一覧。 */
export const STAY_PLACE_EMOJIS: readonly StayPlaceEmoji[] = GENERATED_STAY_PLACE_EMOJIS;

/** 未知の保存値を許可しないための、固定カタログのhexcode索引。 */
const stayPlaceEmojiByHexcode = new Map(STAY_PLACE_EMOJIS.map((emoji) => [emoji.hexcode, emoji]));

/**
 * Determines whether a hexcode is included in the stay-place emoji catalog.
 *
 * @param value - The emoji hexcode to check
 * @returns `true` if the hexcode is included in the catalog, `false` otherwise.
 */
export function isStayPlaceEmojiHexcode(value: string): boolean {
  return stayPlaceEmojiByHexcode.has(value);
}

/**
 * Finds the stay-place emoji associated with a hexcode.
 *
 * @param value - The emoji hexcode to look up
 * @returns The matching emoji entry, or `null` if the hexcode is unknown
 */
export function getStayPlaceEmoji(value: string): StayPlaceEmoji | null {
  return stayPlaceEmojiByHexcode.get(value) ?? null;
}
