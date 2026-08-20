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
    label: 'オフィスビル',
    unicode: '🏢',
    asset: require('../../../assets/stayPlaces/twemoji/1f3e2.png'),
  },
  {
    hexcode: '1F4BC',
    label: 'ブリーフケース',
    unicode: '💼',
    asset: require('../../../assets/stayPlaces/twemoji/1f4bc.png'),
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
    label: '紙袋',
    unicode: '🛍️',
    asset: require('../../../assets/stayPlaces/twemoji/1f6cd.png'),
  },
  {
    hexcode: '2615',
    label: '温かい飲み物',
    unicode: '☕️',
    asset: require('../../../assets/stayPlaces/twemoji/2615.png'),
  },
  {
    hexcode: '1F374',
    label: 'ナイフとフォーク',
    unicode: '🍴',
    asset: require('../../../assets/stayPlaces/twemoji/1f374.png'),
  },
  {
    hexcode: '1F3DE',
    label: '国立公園',
    unicode: '🏞️',
    asset: require('../../../assets/stayPlaces/twemoji/1f3de.png'),
  },
  {
    hexcode: '1F3CB',
    label: '重量挙げをする人',
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
];
