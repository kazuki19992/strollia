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

/** 指定値が固定カタログに含まれる保存可能なhexcodeかを返す。 */
export function isStayPlaceEmojiHexcode(value: string): boolean {
  return stayPlaceEmojiByHexcode.has(value);
}

/** 指定hexcodeの同梱Twemoji情報を返し、未知の値はfail closedでnullにする。 */
export function getStayPlaceEmoji(value: string): StayPlaceEmoji | null {
  return stayPlaceEmojiByHexcode.get(value) ?? null;
}
