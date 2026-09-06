/**
 * Emojibaseのemojibase shortcode presetと日本語データから生成した固定Twemojiカタログ。
 * 手動編集せず、node scripts/generate-stay-place-emoji-catalog.mjs で再生成する。
 */
import type { ImageSourcePropType } from 'react-native';

export type GeneratedStayPlaceEmoji = {
  hexcode: string;
  label: string;
  unicode: string;
  asset: ImageSourcePropType;
};

export const GENERATED_STAY_PLACE_EMOJIS: readonly GeneratedStayPlaceEmoji[] = [
  {
    hexcode: '1F3E0',
    label: '家',
    unicode: '🏠️',
    asset: require('../../../assets/stayPlaces/twemoji/1f3e0.png'),
  },
  {
    hexcode: '1F3E2',
    label: '仕事場',
    unicode: '🏢',
    asset: require('../../../assets/stayPlaces/twemoji/1f3e2.png'),
  },
  {
    hexcode: '1F3EB',
    label: '学校',
    unicode: '🏫',
    asset: require('../../../assets/stayPlaces/twemoji/1f3eb.png'),
  },
  {
    hexcode: '1F3E5',
    label: '病院',
    unicode: '🏥',
    asset: require('../../../assets/stayPlaces/twemoji/1f3e5.png'),
  },
  {
    hexcode: '1F6CD',
    label: 'ショッピング',
    unicode: '🛍️',
    asset: require('../../../assets/stayPlaces/twemoji/1f6cd.png'),
  },
  {
    hexcode: '2615',
    label: 'カフェ',
    unicode: '☕️',
    asset: require('../../../assets/stayPlaces/twemoji/2615.png'),
  },
  {
    hexcode: '1F374',
    label: 'レストラン',
    unicode: '🍴',
    asset: require('../../../assets/stayPlaces/twemoji/1f374.png'),
  },
  {
    hexcode: '1F3DE',
    label: '公園・観光地',
    unicode: '🏞️',
    asset: require('../../../assets/stayPlaces/twemoji/1f3de.png'),
  },
  {
    hexcode: '1F3CB',
    label: 'ジム',
    unicode: '🏋️',
    asset: require('../../../assets/stayPlaces/twemoji/1f3cb.png'),
  },
  {
    hexcode: '1F689',
    label: '駅',
    unicode: '🚉',
    asset: require('../../../assets/stayPlaces/twemoji/1f689.png'),
  },
  {
    hexcode: '1F3E8',
    label: 'ホテル',
    unicode: '🏨',
    asset: require('../../../assets/stayPlaces/twemoji/1f3e8.png'),
  },
  {
    hexcode: '1F3DF',
    label: '観戦施設',
    unicode: '🏟️',
    asset: require('../../../assets/stayPlaces/twemoji/1f3df.png'),
  },
  {
    hexcode: '1F3AD',
    label: 'ホール・映画館',
    unicode: '🎭️',
    asset: require('../../../assets/stayPlaces/twemoji/1f3ad.png'),
  },
  {
    hexcode: '1F3DB',
    label: '公共施設',
    unicode: '🏛️',
    asset: require('../../../assets/stayPlaces/twemoji/1f3db.png'),
  },
];
