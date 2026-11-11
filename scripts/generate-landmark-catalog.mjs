/**
 * data/landmarks のJSONを検証し、型付きの landmarkCatalog.generated.ts を生成する。
 *
 * 検証はここで落とす。参照の誤りは実行時に何のエラーも出ないまま
 * 「パックが永久に完走不能」という壊れ方をするため、生成時に止める必要がある。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// スキーマが `$schema: .../2020-12/schema` を宣言しているため、draft-07までしか知らない既定の
// Ajv ではなく 2020-12 対応の Ajv2020 を使う必要がある(既定の Ajv だと "no schema with key or ref" で落ちる)。
import Ajv2020 from 'ajv/dist/2020.js';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// テストから入出力先を差し替えられるよう環境変数を受け付ける
const dataDir = process.env.LANDMARK_DATA_DIR ? resolve(process.env.LANDMARK_DATA_DIR) : resolve(rootDir, 'data/landmarks');
const outputPath = process.env.LANDMARK_CATALOG_OUTPUT
  ? resolve(process.env.LANDMARK_CATALOG_OUTPUT)
  : resolve(rootDir, 'src/features/landmarks/landmarkCatalog.generated.ts');

/** JSONファイルを読み込む。 */
function readJson(fileName) {
  return JSON.parse(readFileSync(resolve(dataDir, fileName), 'utf8'));
}

/** 検証エラーをまとめて報告してから終了する。 */
function fail(messages) {
  console.error('landmark catalog の生成に失敗しました:');
  for (const message of messages) {
    console.error(`  - ${message}`);
  }
  process.exit(1);
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
const spotsSchema = readJson('landmarkSpots.schema.json');
const packsSchema = readJson('landmarkPacks.schema.json');
const spots = readJson('landmarkSpots.json');
const packs = readJson('landmarkPacks.json');

const errors = [];

const validateSpots = ajv.compile(spotsSchema);
if (!validateSpots(spots)) {
  for (const error of validateSpots.errors ?? []) {
    errors.push(`landmarkSpots.json${error.instancePath} ${error.message}`);
  }
}

const validatePacks = ajv.compile(packsSchema);
if (!validatePacks(packs)) {
  for (const error of validatePacks.errors ?? []) {
    errors.push(`landmarkPacks.json${error.instancePath} ${error.message}`);
  }
}

if (errors.length > 0) {
  fail(errors);
}

// ID重複
const packIds = new Set();
for (const pack of packs) {
  if (packIds.has(pack.id)) {
    errors.push(`パックIDが重複しています: ${pack.id}`);
  }
  packIds.add(pack.id);
}

const spotIds = new Set();
for (const spot of spots) {
  if (spotIds.has(spot.id)) {
    errors.push(`スポットIDが重複しています: ${spot.id} (${spot.name})`);
  }
  spotIds.add(spot.id);
}

/**
 * スポットは常に areas(1件以上)を持つ。1件なら円1つのスポット、2件以上なら複数地点スポット。
 *
 * 円1つのスポットの地点は id/name を省略させ、スポットの id/name を補う。
 * 地点IDをスポットIDと同じにすることで、計測中状態(landmark_candidate_spot_id)に
 * スポットIDを保存していた既存データをそのまま地点IDとして読める。
 * 複数地点スポットの地点は到達記録に保存するため、id/name を必須にする。
 */
for (const spot of spots) {
  spot.isMultiArea = spot.areas.length >= 2;
  if (spot.isMultiArea) {
    for (const area of spot.areas) {
      if (area.id === undefined || area.name === undefined) {
        errors.push(`複数地点スポットの地点には id と name が必要です: ${spot.name}`);
      }
    }
  } else {
    const [area] = spot.areas;
    if (area.id !== undefined || area.name !== undefined) {
      errors.push(`地点が1件のスポットでは地点の id と name を省略してください(スポットの id/name を使います): ${spot.name}`);
    }
    spot.areas = [{ ...area, id: spot.id, name: spot.name }];
  }
}

if (errors.length > 0) {
  fail(errors);
}

// 地点IDはスポットID・他の地点IDと全体で一意(landmark_area_visits.area_id が単独でキーになるため)
const areaIds = new Map();
for (const spot of spots) {
  for (const area of spot.areas) {
    if (spot.isMultiArea && spotIds.has(area.id)) {
      errors.push(`地点IDがスポットIDと重複しています: ${area.id} (${spot.name} / ${area.name})`);
    } else if (areaIds.has(area.id) && !(areaIds.get(area.id) === spot && !spot.isMultiArea)) {
      errors.push(`地点IDが重複しています: ${area.id} (${spot.name} / ${area.name})`);
    }
    areaIds.set(area.id, spot);
  }
}

/** 2点間のハバーサイン距離(メートル)。 */
function haversineMeters(a, b) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const h =
    Math.sin(toRad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(toRad(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// 円の重なり検証(retired を除く)。重なると最寄り判定で片方が選ばれ続け、到達の取り逃しが起きうる
const activeAreas = spots.filter((spot) => !spot.retired).flatMap((spot) => spot.areas.map((area) => ({ spot, area })));
for (let i = 0; i < activeAreas.length; i += 1) {
  for (let j = i + 1; j < activeAreas.length; j += 1) {
    const left = activeAreas[i];
    const right = activeAreas[j];
    if (haversineMeters(left.area, right.area) < left.area.radiusMeters + right.area.radiusMeters) {
      errors.push(`円が重なっています: ${left.spot.name} / ${left.area.name} と ${right.spot.name} / ${right.area.name}`);
    }
  }
}

// 参照整合性・order重複・空パック
const membersByPackId = new Map(packs.map((pack) => [pack.id, []]));
for (const spot of spots) {
  const seenPackIds = new Set();

  for (const membership of spot.packs) {
    if (!packIds.has(membership.packId)) {
      errors.push(`${spot.name} が実在しないパックを参照しています: ${membership.packId}`);
      continue;
    }

    if (seenPackIds.has(membership.packId)) {
      errors.push(`${spot.name} が同じパックを重複して参照しています: ${membership.packId}`);
      continue;
    }
    seenPackIds.add(membership.packId);

    membersByPackId.get(membership.packId).push({ spot, order: membership.order });
  }
}

for (const pack of packs) {
  const members = membersByPackId.get(pack.id);

  // trophyImageはSVG(trophyIcon)から自動生成するPNGを指すため、ベース名が食い違うと
  // 生成モジュールがこのパイプラインで作られていないアセットを require してしまう。
  const expectedTrophyImage = `${pack.trophyIcon}.png`;
  if (pack.trophyImage !== expectedTrophyImage) {
    errors.push(
      `パック「${pack.name}」の trophyImage(${pack.trophyImage})が trophyIcon から期待される名前(${expectedTrophyImage})と一致しません`,
    );
  }

  if (members.length === 0) {
    errors.push(`パック「${pack.name}」にスポットが1件もありません（完走不能になります）`);
    continue;
  }

  const seenOrders = new Set();
  for (const member of members) {
    if (seenOrders.has(member.order)) {
      errors.push(`パック「${pack.name}」で order が重複しています: ${member.order}`);
    }
    seenOrders.add(member.order);
  }
}

if (errors.length > 0) {
  fail(errors);
}

for (const members of membersByPackId.values()) {
  members.sort((left, right) => left.order - right.order);
}

/** TSのリテラルとして安全な文字列へ変換する。 */
function toLiteral(value) {
  return JSON.stringify(value);
}

const spotEntries = spots
  .map(
    (spot) => `  {
    id: ${toLiteral(spot.id)},
    name: ${toLiteral(spot.name)},
    prefectures: [${spot.prefectures.map((prefecture) => toLiteral(prefecture)).join(', ')}],
    areas: [
${spot.areas
  .map(
    (area) => `      {
        id: ${toLiteral(area.id)},
        name: ${toLiteral(area.name)},
        latitude: ${area.latitude},
        longitude: ${area.longitude},
        radiusMeters: ${area.radiusMeters},
        dwellSeconds: ${area.dwellSeconds},${area.note ? `\n        note: ${toLiteral(area.note)},` : ''}
      },`,
  )
  .join('\n')}
    ],
    isMultiArea: ${spot.isMultiArea},${spot.retired ? '\n    retired: true,' : ''}${spot.note ? `\n    note: ${toLiteral(spot.note)},` : ''}
    packs: [${spot.packs.map((membership) => `{ packId: ${toLiteral(membership.packId)}, order: ${membership.order} }`).join(', ')}],
  },`,
  )
  .join('\n');

const packEntries = packs
  .map((pack) => {
    const memberNames = membersByPackId
      .get(pack.id)
      .map((member) => member.spot.name)
      .join(', ');

    return `  {
    id: ${toLiteral(pack.id)},
    name: ${toLiteral(pack.name)},
    description: ${toLiteral(pack.description)},
    // 所属スポット: ${memberNames}
    trophyImage: require('../../../assets/achievements/spots/${pack.trophyImage}'),
    trophyIcon: require('../../../assets/achievements/spots/svg/${pack.trophyIcon}.svg').default,
    sortOrder: ${pack.sortOrder},
    isFree: ${pack.isFree},${pack.notice ? `\n    notice: ${toLiteral(pack.notice)},` : ''}
  },`;
  })
  .join('\n');

const output = `/**
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

/** スポットを構成する1つの到達地点(円)。 */
export type GeneratedLandmarkArea = {
  /** UUIDv7。円1つのスポットではスポットIDと同じ。 */
  id: string;
  /** 地点の表示名。円1つのスポットではスポット名と同じ。 */
  name: string;
  latitude: number;
  longitude: number;
  /** 到達判定の半径(メートル)。境界値は範囲内として扱う。 */
  radiusMeters: number;
  /** 到達確定に必要な滞在時間(秒)。 */
  dwellSeconds: number;
  /** 座標や半径をその値にした理由のメモ。 */
  note?: string;
};

/** 到達判定の対象となるスポット。全地点に到達すると到達済みになる。 */
export type GeneratedLandmarkSpot = {
  /** UUIDv7。landmark_spot_visits.spot_id に保存する安定識別子。 */
  id: string;
  /** 表示名。 */
  name: string;
  /** 所属都道府県。大文字スネークケースの固定値の配列。富士山のように複数県にまたがるスポットは複数件持つ(1件以上、重複なし)。 */
  prefectures: readonly string[];
  /** 到達地点。1件以上。円1つのスポットは id/name がスポットと同じ1件に正規化済み。 */
  areas: readonly GeneratedLandmarkArea[];
  /** マスタで areas を持つスポットなら true。 */
  isMultiArea: boolean;
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
${spotEntries}
];

export const GENERATED_LANDMARK_PACKS: readonly GeneratedLandmarkPack[] = [
${packEntries}
];
`;

writeFileSync(outputPath, output, 'utf8');
console.log(`landmark catalog を生成しました: ${outputPath}`);
console.log(`  スポット ${spots.length} 件 / パック ${packs.length} 件`);
