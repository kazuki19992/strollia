/**
 * data/landmarks のJSONから生成したスポット実績カタログ。
 * 手動編集せず、npm run generate:landmarks で再生成する。
 */
import type { ImageSourcePropType } from 'react-native';

/** スポットが所属するパックと、そのパック内での表示順。 */
export type LandmarkPackMembership = {
  /** 所属パックのUUIDv7。 */
  packId: string;
  /** パック内の表示順。1始まり。 */
  order: number;
};

/** 到達判定の対象となる1地点。 */
export type GeneratedLandmarkSpot = {
  /** UUIDv7。landmark_spot_visits.spot_id に保存する安定識別子。 */
  id: string;
  /** 表示名。 */
  name: string;
  /** 所属都道府県。大文字スネークケースの固定値の配列。富士山のように複数県にまたがるスポットは複数件持つ(1件以上、重複なし)。 */
  prefectures: readonly string[];
  latitude: number;
  longitude: number;
  /** 到達判定の半径(メートル)。境界値は範囲内として扱う。 */
  radiusMeters: number;
  /** 到達確定に必要な滞在時間(秒)。 */
  dwellSeconds: number;
  /** 現存しなくなったスポット。完走判定の分母から外す。 */
  retired?: boolean;
  /** 座標や半径をその値にした理由のメモ。 */
  note?: string;
  /** 所属パック。 */
  packs: readonly LandmarkPackMembership[];
};

/** スポットの集合。完走で実績が解除される単位。 */
export type GeneratedLandmarkPack = {
  /** UUIDv7。 */
  id: string;
  /** 表示名。 */
  name: string;
  /** 一覧行のサブタイトルに表示する説明。 */
  description: string;
  /** 完走トロフィー画像。 */
  trophyImage: ImageSourcePropType;
  /** 一覧の表示順。 */
  sortOrder: number;
};

export const GENERATED_LANDMARK_SPOTS: readonly GeneratedLandmarkSpot[] = [
  {
    id: "01a0c450-6c00-7000-8000-000000000101",
    name: "華厳の滝",
    prefectures: ["TOCHIGI"],
    latitude: 36.737917,
    longitude: 139.501972,
    radiusMeters: 200,
    dwellSeconds: 180,
    note: "観瀑台と駐車場を含む半径。国道120号は300m以上離れており通過では入らない",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000001", order: 1 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000102",
    name: "那智の滝",
    prefectures: ["WAKAYAMA"],
    latitude: 33.675278,
    longitude: 135.8875,
    radiusMeters: 150,
    dwellSeconds: 180,
    note: "県道が滝のすぐ近くを通るため半径を他より絞る。那智大社は600m離れており混同しない",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000001", order: 2 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000103",
    name: "袋田の滝",
    prefectures: ["IBARAKI"],
    latitude: 36.764194,
    longitude: 140.407361,
    radiusMeters: 200,
    dwellSeconds: 180,
    note: "観瀑台とトンネル入口の料金所付近を含む。麓の駐車場は400m超で含まない",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000001", order: 3 }],
  },
];

export const GENERATED_LANDMARK_PACKS: readonly GeneratedLandmarkPack[] = [
  {
    id: "01a0c450-6c00-7000-8000-000000000001",
    name: "日本三名瀑",
    description: "日本を代表する3つの名瀑",
    // 所属スポット: 華厳の滝, 那智の滝, 袋田の滝
    trophyImage: require('../../../assets/achievements/spots/spots-japan-falls-3.png'),
    sortOrder: 100,
  },
];
