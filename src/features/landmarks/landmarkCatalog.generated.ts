/**
 * data/landmarks のJSONから生成したスポット実績カタログ。
 * 手動編集せず、npm run generate:landmarks で再生成する。
 */
import type { ComponentType } from 'react';
import type { ImageSourcePropType } from 'react-native';
import type { SvgProps } from 'react-native-svg';

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
  /** 完走トロフィー画像(通知添付・汎用実績システム互換用のPNG。trophyIconのSVGから生成する)。 */
  trophyImage: ImageSourcePropType;
  /** 一覧行に表示するSVGトロフィーアイコン(表示用のマスタ)。 */
  trophyIcon: ComponentType<SvgProps>;
  /** 一覧の表示順。 */
  sortOrder: number;
  /** trueなら無料で誰でも到達検知・完走できる。falseならStrollia Plusのサブスクが必要。 */
  isFree: boolean;
  /** パック詳細画面のスポット一覧の最下部に小さく表示する特記事項。持たないパックは何も表示しない。 */
  notice?: string;
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
  {
    id: "01a0c450-6c00-7000-8000-000000000201",
    name: "札幌競馬場",
    prefectures: ["HOKKAIDO"],
    latitude: 43.077501,
    longitude: 141.3258793,
    radiusMeters: 450,
    dwellSeconds: 3600,
    note: "OSM施設ポリゴン(敷地約870m×770m)の重心をそのまま使用。半径は敷地長辺の半分を確保し、中心がコースでも第4〜第1コーナーの直線(スタンド)側まで届くようにした。到達確定には1時間以上の滞在を要求し、駐車場の通過や周辺道路の通行では入らないようにする",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000002", order: 1 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000202",
    name: "函館競馬場",
    prefectures: ["HOKKAIDO"],
    latitude: 41.7812014,
    longitude: 140.7747998,
    radiusMeters: 500,
    dwellSeconds: 3600,
    note: "OSM施設ポリゴン(敷地約760m×680m)の重心をそのまま使用。半径は敷地長辺の半分を確保しスタンド側まで届く。到達確定には1時間以上の滞在を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000002", order: 2 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000203",
    name: "福島競馬場",
    prefectures: ["FUKUSHIMA"],
    latitude: 37.7648272,
    longitude: 140.4821846,
    radiusMeters: 400,
    dwellSeconds: 3600,
    note: "OSM施設ポリゴン(敷地約790m×570m)の重心をそのまま使用。半径は敷地長辺の半分を確保しスタンド側まで届く。到達確定には1時間以上の滞在を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000002", order: 3 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000204",
    name: "新潟競馬場",
    prefectures: ["NIIGATA"],
    latitude: 37.9483599,
    longitude: 139.1883607,
    radiusMeters: 600,
    dwellSeconds: 3600,
    note: "OSM施設ポリゴン(敷地約960m×960m)の重心をそのまま使用。他場より大規模なため半径を広めに取り、スタンド側まで届く。到達確定には1時間以上の滞在を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000002", order: 4 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000205",
    name: "東京競馬場",
    prefectures: ["TOKYO"],
    latitude: 35.6636986,
    longitude: 139.4854585,
    radiusMeters: 600,
    dwellSeconds: 3600,
    note: "OSM施設ポリゴン(敷地約730m×1230m)の重心をそのまま使用。半径は敷地長辺の半分を確保しスタンド側まで届く。府中本町駅は600m超離れている。到達確定には1時間以上の滞在を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000002", order: 5 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000206",
    name: "中山競馬場",
    prefectures: ["CHIBA"],
    latitude: 35.7250771,
    longitude: 139.9636061,
    radiusMeters: 600,
    dwellSeconds: 3600,
    note: "OSM施設ポリゴン(敷地約840m×970m)の重心をそのまま使用。半径は敷地長辺の半分を確保しスタンド側まで届く。到達確定には1時間以上の滞在を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000002", order: 6 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000207",
    name: "中京競馬場",
    prefectures: ["AICHI"],
    latitude: 35.0679176,
    longitude: 136.9888021,
    radiusMeters: 650,
    dwellSeconds: 3600,
    note: "OSM施設ポリゴン(敷地約1230m×980m)の重心をそのまま使用。他場より大規模なため半径を広めに取り、スタンド側まで届く。到達確定には1時間以上の滞在を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000002", order: 7 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000208",
    name: "京都競馬場",
    prefectures: ["KYOTO"],
    latitude: 34.9061739,
    longitude: 135.7263938,
    radiusMeters: 600,
    dwellSeconds: 3600,
    note: "OSM施設ポリゴン(敷地約960m×990m)の重心をそのまま使用。他場より大規模なため半径を広めに取り、スタンド側まで届く。到達確定には1時間以上の滞在を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000002", order: 8 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000209",
    name: "阪神競馬場",
    prefectures: ["HYOGO"],
    latitude: 34.7801348,
    longitude: 135.363534,
    radiusMeters: 550,
    dwellSeconds: 3600,
    note: "OSM施設ポリゴン(敷地約720m×880m)の重心をそのまま使用。半径は敷地長辺の半分を確保しスタンド側まで届く。到達確定には1時間以上の滞在を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000002", order: 9 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000210",
    name: "小倉競馬場",
    prefectures: ["FUKUOKA"],
    latitude: 33.8429592,
    longitude: 130.8729927,
    radiusMeters: 450,
    dwellSeconds: 3600,
    note: "OSM施設ポリゴン(敷地約880m×710m)の重心をそのまま使用。半径は敷地長辺の半分を確保しスタンド側まで届く。到達確定には1時間以上の滞在を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000002", order: 10 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000301",
    name: "鉄道博物館",
    prefectures: ["SAITAMA"],
    latitude: 35.920776,
    longitude: 139.618347,
    radiusMeters: 180,
    dwellSeconds: 1800,
    note: "JR東日本系の財団が運営。国土地理院の住所検索(大成町3-47)の点が館の建物上にあることを地理院地図で確認。館は線路沿いに南北約300mあるため半径180m。隣接する高崎線・東北本線・新幹線の通過や、ニューシャトル鉄道博物館駅の乗降で入らないよう滞在30分を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000003", order: 1 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000302",
    name: "リニア・鉄道館",
    prefectures: ["AICHI"],
    latitude: 35.0487,
    longitude: 136.851,
    radiusMeters: 150,
    dwellSeconds: 1800,
    note: "JR東海が運営。住所(金城ふ頭3-2-2)の住所点は駅南側の空地に落ちるため、地理院地図の航空写真で金城ふ頭駅北東の館の建物中央を目視で選んだ。メキシコ大通の通過で入らないよう滞在30分を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000003", order: 2 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000303",
    name: "京都鉄道博物館",
    prefectures: ["KYOTO"],
    latitude: 34.98645,
    longitude: 135.7424,
    radiusMeters: 200,
    dwellSeconds: 1800,
    note: "JR西日本系の財団が運営。地理院地図で本館(博物館記号)と扇形車庫の中間を中心に選び、両方が半径内に入るよう200mとした。南側を通るJR線の乗車中に入らないよう滞在30分を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000003", order: 3 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000401",
    name: "尻屋埼灯台",
    prefectures: ["AOMORI"],
    latitude: 41.430278,
    longitude: 141.462222,
    radiusMeters: 150,
    dwellSeconds: 300,
    note: "座標は燈光会の灯台紹介ページに掲載された灯台位置(度分秒)を換算。秒単位の丸め(約30m)を吸収できる半径150mとし、岬の道路を車で通過しただけで入らないよう滞在5分を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000004", order: 1 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000402",
    name: "入道埼灯台",
    prefectures: ["AKITA"],
    latitude: 40.005,
    longitude: 139.701667,
    radiusMeters: 150,
    dwellSeconds: 300,
    note: "座標は燈光会の灯台紹介ページに掲載された灯台位置(度分秒)を換算。秒単位の丸め(約30m)を吸収できる半径150mとし、岬の道路を車で通過しただけで入らないよう滞在5分を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000004", order: 2 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000403",
    name: "塩屋埼灯台",
    prefectures: ["FUKUSHIMA"],
    latitude: 36.995,
    longitude: 140.981944,
    radiusMeters: 150,
    dwellSeconds: 300,
    note: "座標は燈光会の灯台紹介ページに掲載された灯台位置(度分秒)を換算。秒単位の丸め(約30m)を吸収できる半径150mとし、岬の道路を車で通過しただけで入らないよう滞在5分を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000004", order: 3 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000404",
    name: "犬吠埼灯台",
    prefectures: ["CHIBA"],
    latitude: 35.707778,
    longitude: 140.868611,
    radiusMeters: 150,
    dwellSeconds: 300,
    note: "座標は燈光会の灯台紹介ページに掲載された灯台位置(度分秒)を換算。秒単位の丸め(約30m)を吸収できる半径150mとし、岬の道路を車で通過しただけで入らないよう滞在5分を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000004", order: 4 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000405",
    name: "野島埼灯台",
    prefectures: ["CHIBA"],
    latitude: 34.901667,
    longitude: 139.888333,
    radiusMeters: 150,
    dwellSeconds: 300,
    note: "座標は燈光会の灯台紹介ページに掲載された灯台位置(度分秒)を換算。秒単位の丸め(約30m)を吸収できる半径150mとし、岬の道路を車で通過しただけで入らないよう滞在5分を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000004", order: 5 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000406",
    name: "観音埼灯台",
    prefectures: ["KANAGAWA"],
    latitude: 35.256111,
    longitude: 139.745278,
    radiusMeters: 150,
    dwellSeconds: 300,
    note: "座標は燈光会の灯台紹介ページに掲載された灯台位置(度分秒)を換算。秒単位の丸め(約30m)を吸収できる半径150mとし、岬の道路を車で通過しただけで入らないよう滞在5分を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000004", order: 6 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000407",
    name: "初島灯台",
    prefectures: ["SHIZUOKA"],
    latitude: 35.038333,
    longitude: 139.172778,
    radiusMeters: 150,
    dwellSeconds: 300,
    note: "座標は燈光会の灯台紹介ページに掲載された灯台位置(度分秒)を換算。秒単位の丸め(約30m)を吸収できる半径150mとし、岬の道路を車で通過しただけで入らないよう滞在5分を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000004", order: 7 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000408",
    name: "御前埼灯台",
    prefectures: ["SHIZUOKA"],
    latitude: 34.595833,
    longitude: 138.225833,
    radiusMeters: 150,
    dwellSeconds: 300,
    note: "座標は燈光会の灯台紹介ページに掲載された灯台位置(度分秒)を換算。秒単位の丸め(約30m)を吸収できる半径150mとし、岬の道路を車で通過しただけで入らないよう滞在5分を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000004", order: 8 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000409",
    name: "安乗埼灯台",
    prefectures: ["MIE"],
    latitude: 34.365,
    longitude: 136.908333,
    radiusMeters: 150,
    dwellSeconds: 300,
    note: "座標は燈光会の灯台紹介ページに掲載された灯台位置(度分秒)を換算。秒単位の丸め(約30m)を吸収できる半径150mとし、岬の道路を車で通過しただけで入らないよう滞在5分を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000004", order: 9 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000410",
    name: "大王埼灯台",
    prefectures: ["MIE"],
    latitude: 34.276111,
    longitude: 136.899444,
    radiusMeters: 150,
    dwellSeconds: 300,
    note: "座標は燈光会の灯台紹介ページに掲載された灯台位置(度分秒)を換算。秒単位の丸め(約30m)を吸収できる半径150mとし、岬の道路を車で通過しただけで入らないよう滞在5分を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000004", order: 10 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000411",
    name: "潮岬灯台",
    prefectures: ["WAKAYAMA"],
    latitude: 33.4375,
    longitude: 135.754444,
    radiusMeters: 150,
    dwellSeconds: 300,
    note: "座標は燈光会の灯台紹介ページに掲載された灯台位置(度分秒)を換算。秒単位の丸め(約30m)を吸収できる半径150mとし、岬の道路を車で通過しただけで入らないよう滞在5分を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000004", order: 11 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000412",
    name: "角島灯台",
    prefectures: ["YAMAGUCHI"],
    latitude: 34.3525,
    longitude: 130.841111,
    radiusMeters: 150,
    dwellSeconds: 300,
    note: "座標は燈光会の灯台紹介ページに掲載された灯台位置(度分秒)を換算。秒単位の丸め(約30m)を吸収できる半径150mとし、岬の道路を車で通過しただけで入らないよう滞在5分を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000004", order: 12 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000413",
    name: "出雲日御碕灯台",
    prefectures: ["SHIMANE"],
    latitude: 35.433889,
    longitude: 132.629167,
    radiusMeters: 150,
    dwellSeconds: 300,
    note: "座標は燈光会の灯台紹介ページに掲載された灯台位置(度分秒)を換算。秒単位の丸め(約30m)を吸収できる半径150mとし、岬の道路を車で通過しただけで入らないよう滞在5分を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000004", order: 13 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000414",
    name: "都井岬灯台",
    prefectures: ["MIYAZAKI"],
    latitude: 31.3675,
    longitude: 131.345833,
    radiusMeters: 150,
    dwellSeconds: 300,
    note: "座標は燈光会の灯台紹介ページに掲載された灯台位置(度分秒)を換算。秒単位の丸め(約30m)を吸収できる半径150mとし、岬の道路を車で通過しただけで入らないよう滞在5分を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000004", order: 14 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000415",
    name: "残波岬灯台",
    prefectures: ["OKINAWA"],
    latitude: 26.441111,
    longitude: 127.713611,
    radiusMeters: 150,
    dwellSeconds: 300,
    note: "座標は燈光会の灯台紹介ページに掲載された灯台位置(度分秒)を換算。秒単位の丸め(約30m)を吸収できる半径150mとし、岬の道路を車で通過しただけで入らないよう滞在5分を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000004", order: 15 }],
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000416",
    name: "平安名埼灯台",
    prefectures: ["OKINAWA"],
    latitude: 24.719444,
    longitude: 125.468611,
    radiusMeters: 150,
    dwellSeconds: 300,
    note: "座標は燈光会の灯台紹介ページに掲載された灯台位置(度分秒)を換算。秒単位の丸め(約30m)を吸収できる半径150mとし、岬の道路を車で通過しただけで入らないよう滞在5分を要求する",
    packs: [{ packId: "01a0c450-6c00-7000-8000-000000000004", order: 16 }],
  },
];

export const GENERATED_LANDMARK_PACKS: readonly GeneratedLandmarkPack[] = [
  {
    id: "01a0c450-6c00-7000-8000-000000000001",
    name: "日本三名瀑",
    description: "日本を代表する3つの名瀑",
    // 所属スポット: 華厳の滝, 那智の滝, 袋田の滝
    trophyImage: require('../../../assets/achievements/spots/japan-falls-3.png'),
    trophyIcon: require('../../../assets/achievements/spots/svg/japan-falls-3.svg').default,
    sortOrder: 100,
    isFree: true,
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000002",
    name: "JRA競馬場",
    description: "JRAが開催する全国10箇所の競馬場を巡る",
    // 所属スポット: 札幌競馬場, 函館競馬場, 福島競馬場, 新潟競馬場, 東京競馬場, 中山競馬場, 中京競馬場, 京都競馬場, 阪神競馬場, 小倉競馬場
    trophyImage: require('../../../assets/achievements/spots/jra-racecourses-10.png'),
    trophyIcon: require('../../../assets/achievements/spots/svg/jra-racecourses-10.svg').default,
    sortOrder: 200,
    isFree: false,
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000003",
    name: "JR鉄道博物館",
    description: "JR3社が運営する3つの大型鉄道博物館を巡る",
    // 所属スポット: 鉄道博物館, リニア・鉄道館, 京都鉄道博物館
    trophyImage: require('../../../assets/achievements/spots/jr-railway-museums-3.png'),
    trophyIcon: require('../../../assets/achievements/spots/svg/jr-railway-museums-3.svg').default,
    sortOrder: 300,
    isFree: false,
  },
  {
    id: "01a0c450-6c00-7000-8000-000000000004",
    name: "のぼれる灯台",
    description: "内部を一般公開している全国16基の参観灯台を巡る",
    // 所属スポット: 尻屋埼灯台, 入道埼灯台, 塩屋埼灯台, 犬吠埼灯台, 野島埼灯台, 観音埼灯台, 初島灯台, 御前埼灯台, 安乗埼灯台, 大王埼灯台, 潮岬灯台, 角島灯台, 出雲日御碕灯台, 都井岬灯台, 残波岬灯台, 平安名埼灯台
    trophyImage: require('../../../assets/achievements/spots/climbable-lighthouses-16.png'),
    trophyIcon: require('../../../assets/achievements/spots/svg/climbable-lighthouses-16.svg').default,
    sortOrder: 400,
    isFree: false,
    notice: "工事・点検・天候などで灯台に登れない日があるほか、季節によって公開していない灯台もあります。",
  },
];
