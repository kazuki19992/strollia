import { getStayPlaceEmoji, isStayPlaceEmojiHexcode, STAY_PLACE_EMOJIS } from '@/features/stayPlaces/stayPlaceEmojiCatalog';

describe('滞在場所アイコンカタログ', () => {
  test('固定カタログは重複しない完全修飾hexcodeだけを公開する', () => {
    expect(STAY_PLACE_EMOJIS).toHaveLength(14);
    expect(new Set(STAY_PLACE_EMOJIS.map((item) => item.hexcode)).size).toBe(14);
    expect(STAY_PLACE_EMOJIS.every((item) => /^[0-9A-F]+(?:-[0-9A-F]+)*$/.test(item.hexcode))).toBe(true);
  });

  test('既知のhexcodeから表示用アイコンを解決する', () => {
    const emoji = STAY_PLACE_EMOJIS[0];

    expect(getStayPlaceEmoji(emoji.hexcode)).toBe(emoji);
  });

  test('固定候補は絵文字の辞書名ではなく、滞在場所の用途名を表示する', () => {
    const labelsByHexcode = new Map(STAY_PLACE_EMOJIS.map((item) => [item.hexcode, item.label]));

    expect(labelsByHexcode.get('1F3E2')).toBe('仕事場');
    expect(labelsByHexcode.has('1F4BC')).toBe(false);
    expect(labelsByHexcode.get('1F6CD')).toBe('ショッピング');
    expect(labelsByHexcode.get('2615')).toBe('カフェ');
    expect(labelsByHexcode.get('1F374')).toBe('レストラン');
    expect(labelsByHexcode.get('1F3DE')).toBe('公園・観光地');
    expect(labelsByHexcode.get('1F3CB')).toBe('ジム');
    expect(labelsByHexcode.get('1F3DF')).toBe('観戦施設');
    expect(labelsByHexcode.get('1F3AD')).toBe('ホール・映画館');
    expect(labelsByHexcode.get('1F3DB')).toBe('公共施設');
  });

  test('未知の値は保存対象にしない', () => {
    expect(isStayPlaceEmojiHexcode('UNKNOWN')).toBe(false);
    expect(getStayPlaceEmoji('UNKNOWN')).toBeNull();
  });
});
