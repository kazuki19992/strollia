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
const dataDir = resolve(rootDir, 'data/landmarks');
const outputPath = resolve(rootDir, 'src/features/landmarks/landmarkCatalog.generated.ts');

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
    latitude: ${spot.latitude},
    longitude: ${spot.longitude},
    radiusMeters: ${spot.radiusMeters},
    dwellSeconds: ${spot.dwellSeconds},${spot.retired ? '\n    retired: true,' : ''}${spot.note ? `\n    note: ${toLiteral(spot.note)},` : ''}
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
    sortOrder: ${pack.sortOrder},
  },`;
  })
  .join('\n');

const output = `/**
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
${spotEntries}
];

export const GENERATED_LANDMARK_PACKS: readonly GeneratedLandmarkPack[] = [
${packEntries}
];
`;

writeFileSync(outputPath, output, 'utf8');
console.log(`landmark catalog を生成しました: ${outputPath}`);
console.log(`  スポット ${spots.length} 件 / パック ${packs.length} 件`);
