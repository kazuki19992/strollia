import { getStayPlaceEmoji, isStayPlaceEmojiHexcode, STAY_PLACE_EMOJIS } from '@/features/stayPlaces/stayPlaceEmojiCatalog';

describe('滞在場所アイコンカタログ', () => {
  test('固定カタログは重複しない完全修飾hexcodeだけを公開する', () => {
    expect(STAY_PLACE_EMOJIS).toHaveLength(12);
    expect(new Set(STAY_PLACE_EMOJIS.map((item) => item.hexcode)).size).toBe(12);
    expect(STAY_PLACE_EMOJIS.every((item) => /^[0-9A-F]+(?:-[0-9A-F]+)*$/.test(item.hexcode))).toBe(true);
  });

  test('既知のhexcodeから表示用アイコンを解決する', () => {
    const emoji = STAY_PLACE_EMOJIS[0];

    expect(getStayPlaceEmoji(emoji.hexcode)).toBe(emoji);
  });

  test('未知の値は保存対象にしない', () => {
    expect(isStayPlaceEmojiHexcode('UNKNOWN')).toBe(false);
    expect(getStayPlaceEmoji('UNKNOWN')).toBeNull();
  });
});
