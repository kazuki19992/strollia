import { Image, ImageSourcePropType } from 'react-native';

/** 実績の分類。 */
export type AchievementCategory = 'distance' | 'logDays' | 'prefecture' | 'municipality';

/** 実績解除に使う条件。 */
export type AchievementCondition =
  | { type: 'totalDistanceMeters'; threshold: number }
  | { type: 'logDays'; threshold: number }
  | { type: 'prefectureCount'; threshold: number }
  | { type: 'municipalityCount'; threshold: number };

/** アプリに同梱する実績定義。 */
export type AchievementDefinition = {
  /** 実績を永続化するときに使う安定ID。 */
  id: string;
  /** 実績画面と解除モーダルに表示する名称。 */
  title: string;
  /** 達成条件の説明。 */
  description: string;
  /** 一覧表示でグルーピングするカテゴリ。 */
  category: AchievementCategory;
  /** 達成判定に使う条件。 */
  condition: AchievementCondition;
  /** トロフィー画像。 */
  trophyImage: ImageSourcePropType;
  /** 通知添付に使うトロフィー画像URI。 */
  trophyImageUri: string | null;
  /** X共有やOS共有で使う文言。 */
  shareText: string;
  /** 実績画面の表示順。 */
  sortOrder: number;
  /** 将来の段階公開に備えた有効フラグ。 */
  enabled: boolean;
};

/** App Store公開後に正式なアプリURLへ差し替える。 */
export const STROLLIA_APP_STORE_URL = 'https://apps.apple.com/app/strollia';

/** X投稿画面へ渡す共有文言テンプレート。 */
export const ACHIEVEMENT_SHARE_TEXT_TEMPLATE = `すとろりあで{achievementTitle}を達成しました！

今すぐダウンロード
{appStoreUrl}
#すとろりあ
#Strollia
#おさんぽログ`;

/** 実績名を共有テンプレートへ流し込む。 */
export function createAchievementShareText(achievementTitle: string): string {
  return ACHIEVEMENT_SHARE_TEXT_TEMPLATE.replace('{achievementTitle}', achievementTitle).replace('{appStoreUrl}', STROLLIA_APP_STORE_URL);
}

/** 距離実績の通常トロフィー定義。 */
const distanceSteps = [
  100,
  200,
  300,
  500,
  750,
  1_000,
  2_000,
  3_000,
  5_000,
  7_500,
  10_000,
  20_000,
  30_000,
  50_000,
  75_000,
  100_000,
  200_000,
  300_000,
  500_000,
  750_000,
  1_000_000,
  2_000_000,
  3_000_000,
  5_000_000,
  7_500_000,
  9_999_999,
] as const;

/** 地球一周系の特別距離実績。 */
const earthDistanceSteps = [40_000, 80_000, 120_000, 160_000, 200_000] as const;

/** ログ記録日数実績の閾値。 */
const logDaySteps = [1, 7, 31, 365, 730, 1_000] as const;

/** 都道府県訪問数実績の閾値。 */
const prefectureSteps = [5, 10, 20, 35, 47] as const;

/** 市区町村訪問数実績の閾値。 */
const citySteps = [50, 100, 250, 500, 1_000] as const;

/** 距離実績の画像を静的requireで解決する。 */
const distanceTrophyImages: Record<number, ImageSourcePropType> = {
  100: require('../../../assets/achievements/odo/odo-100.png'),
  200: require('../../../assets/achievements/odo/odo-200.png'),
  300: require('../../../assets/achievements/odo/odo-300.png'),
  500: require('../../../assets/achievements/odo/odo-500.png'),
  750: require('../../../assets/achievements/odo/odo-750.png'),
  1000: require('../../../assets/achievements/odo/odo-1000.png'),
  2000: require('../../../assets/achievements/odo/odo-2000.png'),
  3000: require('../../../assets/achievements/odo/odo-3000.png'),
  5000: require('../../../assets/achievements/odo/odo-5000.png'),
  7500: require('../../../assets/achievements/odo/odo-7500.png'),
  10000: require('../../../assets/achievements/odo/odo-10000.png'),
  20000: require('../../../assets/achievements/odo/odo-20000.png'),
  30000: require('../../../assets/achievements/odo/odo-30000.png'),
  50000: require('../../../assets/achievements/odo/odo-50000.png'),
  75000: require('../../../assets/achievements/odo/odo-75000.png'),
  100000: require('../../../assets/achievements/odo/odo-100000.png'),
  200000: require('../../../assets/achievements/odo/odo-200000.png'),
  300000: require('../../../assets/achievements/odo/odo-300000.png'),
  500000: require('../../../assets/achievements/odo/odo-500000.png'),
  750000: require('../../../assets/achievements/odo/odo-750000.png'),
  1000000: require('../../../assets/achievements/odo/odo-1000000.png'),
  2000000: require('../../../assets/achievements/odo/odo-2000000.png'),
  3000000: require('../../../assets/achievements/odo/odo-3000000.png'),
  5000000: require('../../../assets/achievements/odo/odo-5000000.png'),
  7500000: require('../../../assets/achievements/odo/odo-7500000.png'),
  9999999: require('../../../assets/achievements/odo/odo-9999999.png'),
};

/** 地球一周系距離実績の画像を静的requireで解決する。 */
const earthDistanceTrophyImages: Record<number, ImageSourcePropType> = {
  40000: require('../../../assets/achievements/odo/odo-earth-40000.png'),
  80000: require('../../../assets/achievements/odo/odo-earth-80000.png'),
  120000: require('../../../assets/achievements/odo/odo-earth-120000.png'),
  160000: require('../../../assets/achievements/odo/odo-earth-160000.png'),
  200000: require('../../../assets/achievements/odo/odo-earth-200000.png'),
};

/** ログ日数実績の画像を静的requireで解決する。 */
const logDayTrophyImages: Record<number, ImageSourcePropType> = {
  1: require('../../../assets/achievements/log-days/1.png'),
  7: require('../../../assets/achievements/log-days/7.png'),
  31: require('../../../assets/achievements/log-days/31.png'),
  365: require('../../../assets/achievements/log-days/365.png'),
  730: require('../../../assets/achievements/log-days/730.png'),
  1000: require('../../../assets/achievements/log-days/1000.png'),
};

/** 都道府県実績の画像を静的requireで解決する。 */
const prefectureTrophyImages: Record<number, ImageSourcePropType> = {
  5: require('../../../assets/achievements/prefectures/5.png'),
  10: require('../../../assets/achievements/prefectures/10.png'),
  20: require('../../../assets/achievements/prefectures/20.png'),
  35: require('../../../assets/achievements/prefectures/35.png'),
  47: require('../../../assets/achievements/prefectures/47.png'),
};

/** 市区町村実績の画像を静的requireで解決する。 */
const cityTrophyImages: Record<number, ImageSourcePropType> = {
  50: require('../../../assets/achievements/cities/50.png'),
  100: require('../../../assets/achievements/cities/100.png'),
  250: require('../../../assets/achievements/cities/250.png'),
  500: require('../../../assets/achievements/cities/500.png'),
  1000: require('../../../assets/achievements/cities/1000.png'),
};

/** km値をユーザー向け距離表記に変換する。 */
export function formatAchievementDistance(kilometers: number): string {
  return Number.isInteger(kilometers) ? `${kilometers}km` : `${kilometers.toFixed(1)}km`;
}

/** km単位の実績閾値を内部判定用のmへ変換する。 */
export function kilometersToMeters(kilometers: number): number {
  return kilometers * 1000;
}

/** 通知添付で使えるトロフィー画像URIを取得する。 */
export function getTrophyImageUri(source: ImageSourcePropType): string | null {
  return Image.resolveAssetSource(source)?.uri ?? null;
}

/**
 * 距離実績（通常の総距離 + 地球n周）をしきい値の昇順で並べ、表示順を振り直す。
 *
 * 地球n周実績は通常の総距離実績と同じ `distance` カテゴリのため、
 * しきい値（m）で連続的に並ぶよう sortOrder を採番する。
 */
const distanceDefinitions: AchievementDefinition[] = [
  ...distanceSteps.map((kilometers): AchievementDefinition => ({
    id: `distance-${kilometers}`,
    title: `${formatAchievementDistance(kilometers)}移動した`,
    description: `総移動距離が${formatAchievementDistance(kilometers)}に到達する`,
    category: 'distance',
    condition: { type: 'totalDistanceMeters', threshold: kilometersToMeters(kilometers) },
    trophyImage: distanceTrophyImages[kilometers],
    trophyImageUri: getTrophyImageUri(distanceTrophyImages[kilometers]),
    shareText: createAchievementShareText(`${formatAchievementDistance(kilometers)}移動した`),
    sortOrder: 0,
    enabled: true,
  })),
  ...earthDistanceSteps.map((kilometers, index): AchievementDefinition => {
    const lapCount = index + 1;
    const title = `地球${lapCount}周した`;

    return {
      id: `distance-earth-${kilometers}`,
      title,
      description: `総移動距離が地球${lapCount}周相当（${formatAchievementDistance(kilometers)}）に到達する`,
      category: 'distance',
      condition: { type: 'totalDistanceMeters', threshold: kilometersToMeters(kilometers) },
      trophyImage: earthDistanceTrophyImages[kilometers],
      trophyImageUri: getTrophyImageUri(earthDistanceTrophyImages[kilometers]),
      shareText: createAchievementShareText(title),
      sortOrder: 0,
      enabled: true,
    };
  }),
]
  .sort((a, b) => a.condition.threshold - b.condition.threshold)
  .map((definition, index): AchievementDefinition => ({ ...definition, sortOrder: 1000 + index }));

/** 初期実装で有効にする全実績定義。 */
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  ...distanceDefinitions,
  ...logDaySteps.map((days, index): AchievementDefinition => ({
    id: `log-days-${days}`,
    title: days === 1 ? 'はじめの一歩' : `${days}日記録`,
    description: days === 1 ? 'GPSログを1日分記録する' : `GPSログを${days}日分記録する`,
    category: 'logDays',
    condition: { type: 'logDays', threshold: days },
    trophyImage: logDayTrophyImages[days],
    trophyImageUri: getTrophyImageUri(logDayTrophyImages[days]),
    shareText: createAchievementShareText(days === 1 ? 'はじめの一歩' : `${days}日記録`),
    sortOrder: 3000 + index,
    enabled: true,
  })),
  ...prefectureSteps.map((count, index): AchievementDefinition => ({
    id: `prefectures-${count}`,
    title: `${count}都道府県を訪問`,
    description: `${count}都道府県の訪問を記録する`,
    category: 'prefecture',
    condition: { type: 'prefectureCount', threshold: count },
    trophyImage: prefectureTrophyImages[count],
    trophyImageUri: getTrophyImageUri(prefectureTrophyImages[count]),
    shareText: createAchievementShareText(`${count}都道府県を訪問`),
    sortOrder: 4000 + index,
    enabled: true,
  })),
  ...citySteps.map((count, index): AchievementDefinition => ({
    id: `cities-${count}`,
    title: `${count}市区町村を訪問`,
    description: `${count}市区町村の訪問を記録する`,
    category: 'municipality',
    condition: { type: 'municipalityCount', threshold: count },
    trophyImage: cityTrophyImages[count],
    trophyImageUri: getTrophyImageUri(cityTrophyImages[count]),
    shareText: createAchievementShareText(`${count}市区町村を訪問`),
    sortOrder: 5000 + index,
    enabled: true,
  })),
];

/** IDから実績定義を取得する。 */
export function getAchievementDefinition(id: string): AchievementDefinition | null {
  return ACHIEVEMENT_DEFINITIONS.find((definition) => definition.id === id) ?? null;
}
