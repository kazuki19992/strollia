# スポット訪問実績（日本三名瀑パイロット）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 日本三名瀑パック（スポット3件）をパイロットとして、スポット到達の検知・記録・パック完走実績・UIまでの機能一式を Strollia Plus 限定機能として実装する。

**Architecture:** マスタは `data/landmarks/` のJSON（JSON Schemaで型定義）に置き、生成スクリプトで型付きTSへ変換してバンドルに載せる。到達判定はGPS観測ごとに走る `recordLocationObservation` の中で行い（保存点だけでは滞在時間が進まないため）、到達を `landmark_spot_visits` へ記録する。パック完走は既存の実績システム（`achievement_unlocks`）へ乗せる。

**Tech Stack:** Expo ~57 / React Native 0.86 / TypeScript ~6.0 (strict) / expo-sqlite / expo-router / jest + jest-expo + @testing-library/react-native / ajv（devDependency・新規）

**Spec:** `docs/superpowers/specs/2026-09-23-landmark-spot-achievements-design.md`

## Global Constraints

- コミットは Semantic Commit Message（`type(scope): 日本語の説明`）。type は英語、説明は日本語
- JSDoc は日本語。「何をするか」に加え必要なら「なぜその設計か」も書く
- `describe` / `test` / `it` の説明文は日本語
- import は `@/` エイリアス。`../` を含む相対 import は ESLint error（`jest.mock` のパス文字列も同様）
- `src/ui/components/**` での `StyleSheet.create` は ESLint error。スタイルは `src/ui/appStyles.ts` の `createStyles(theme)` へ追加する
- 押下可能な要素には `accessibilityLabel` + `accessibilityRole` を必ず付ける
- テキストは太字をデフォルトにしない
- UIコンポーネント内でDB操作・端末APIを直接呼ばない。データと操作は props で受け取る
- 各タスクの最後に `npm run typecheck` / `npm test` / `npm run lint`（error 0）を通してからコミットする
- 作業ディレクトリは worktree `/Users/kazuki19992/gits/footspot/.worktrees/claude-landmark-spot-achievements`（ブランチ `claude/landmark-spot-achievements`）

### パイロットの確定データ

| 項目                     | 値                                                              |
| ------------------------ | --------------------------------------------------------------- |
| パックUUID（日本三名瀑） | `01a0c450-6c00-7000-8000-000000000001`                          |
| 華厳の滝 UUID            | `01a0c450-6c00-7000-8000-000000000101`                          |
| 那智の滝 UUID            | `01a0c450-6c00-7000-8000-000000000102`                          |
| 袋田の滝 UUID            | `01a0c450-6c00-7000-8000-000000000103`                          |
| トロフィー画像           | `assets/achievements/spots/spots-japan-falls-3.png`（配置済み） |

| スポット | 緯度      | 経度       | 半径 | 滞在秒 | order |
| -------- | --------- | ---------- | ---- | ------ | ----- |
| 華厳の滝 | 36.737917 | 139.501972 | 200  | 180    | 1     |
| 那智の滝 | 33.675278 | 135.887500 | 150  | 180    | 2     |
| 袋田の滝 | 36.764194 | 140.407361 | 200  | 180    | 3     |

---

## File Structure

| ファイル                                                | 責務                                                |
| ------------------------------------------------------- | --------------------------------------------------- |
| `data/landmarks/landmarkSpots.schema.json`              | スポットのJSON Schema（型の正）                     |
| `data/landmarks/landmarkPacks.schema.json`              | パックのJSON Schema                                 |
| `data/landmarks/landmarkSpots.json`                     | スポット実体                                        |
| `data/landmarks/landmarkPacks.json`                     | パック定義                                          |
| `scripts/generate-landmark-catalog.mjs`                 | スキーマ検証・参照整合性チェック・TS生成            |
| `src/features/landmarks/landmarkCatalog.generated.ts`   | 生成物。型とマスタ配列                              |
| `src/features/landmarks/landmarkCatalog.ts`             | 生成物を読む公開API（パック進捗の導出など純粋関数） |
| `src/features/landmarks/landmarkArrivalResolver.ts`     | 到達判定の純粋関数                                  |
| `src/features/landmarks/landmarkVisitRepository.ts`     | `landmark_spot_visits` のDB操作                     |
| `src/features/landmarks/landmarkRecordingService.ts`    | Plus判定を含む記録時の境界                          |
| `src/features/landmarks/landmarkNotificationService.ts` | スポット到達のローカル通知                          |
| `src/features/landmarks/landmarkTrophyDisplayState.ts`  | 到達率からトロフィー表示状態を解決する純粋関数      |
| `src/ui/components/AppProgressBar.tsx`                  | 汎用プログレスバー                                  |
| `src/app/achievements/_layout.tsx`                      | 実績スタックのレイアウト                            |
| `src/app/achievements/index.tsx`                        | 実績一覧ルート（既存 `achievements.tsx` を移動）    |
| `src/app/achievements/[packId].tsx`                     | パック詳細ルート                                    |
| `src/ui/components/LandmarkPackScreen.tsx`              | パック詳細画面                                      |

---

## Task 1: マスタデータとカタログ生成

**Files:**

- Create: `data/landmarks/landmarkSpots.schema.json`
- Create: `data/landmarks/landmarkPacks.schema.json`
- Create: `data/landmarks/landmarkSpots.json`
- Create: `data/landmarks/landmarkPacks.json`
- Create: `scripts/generate-landmark-catalog.mjs`
- Create: `src/features/landmarks/landmarkCatalog.generated.ts`（生成物）
- Create: `src/features/landmarks/landmarkCatalog.ts`
- Test: `src/features/landmarks/__tests__/landmarkCatalog.test.ts`
- Modify: `package.json`（`generate:landmarks` スクリプトと `ajv` devDependency）
- Modify: `.prettierignore`（生成物を除外）

**Interfaces:**

- Produces:
  - `LandmarkSpot = { id: string; name: string; prefecture: string; latitude: number; longitude: number; radiusMeters: number; dwellSeconds: number; retired?: boolean; note?: string; packs: readonly { packId: string; order: number }[] }`
  - `LandmarkPack = { id: string; name: string; description: string; trophyImage: ImageSourcePropType; trophyImageUri: string \| null; sortOrder: number }`
  - `LANDMARK_SPOTS: readonly LandmarkSpot[]`
  - `LANDMARK_PACKS: readonly LandmarkPack[]`
  - `getLandmarkSpotById(id: string): LandmarkSpot | null`
  - `getLandmarkPackById(id: string): LandmarkPack | null`
  - `getActiveSpotsForPack(packId: string): readonly LandmarkSpot[]`（`retired` を除き `order` 昇順）
  - `getLandmarkPackCompletionAchievementId(packId: string): string`

- [ ] **Step 1: ajv を devDependency として追加する**

```bash
npm install --save-dev ajv
```

- [ ] **Step 2: スポットのJSON Schemaを作る**

`data/landmarks/landmarkSpots.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://strollia.app/schemas/landmarkSpots.schema.json",
  "title": "Strollia landmark spots",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["id", "name", "prefecture", "latitude", "longitude", "radiusMeters", "dwellSeconds", "packs"],
    "additionalProperties": false,
    "properties": {
      "id": {
        "type": "string",
        "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        "description": "UUIDv7。landmark_spot_visits.spot_id に保存する安定識別子"
      },
      "name": { "type": "string", "minLength": 1 },
      "prefecture": {
        "type": "string",
        "enum": [
          "HOKKAIDO",
          "AOMORI",
          "IWATE",
          "MIYAGI",
          "AKITA",
          "YAMAGATA",
          "FUKUSHIMA",
          "IBARAKI",
          "TOCHIGI",
          "GUNMA",
          "SAITAMA",
          "CHIBA",
          "TOKYO",
          "KANAGAWA",
          "NIIGATA",
          "TOYAMA",
          "ISHIKAWA",
          "FUKUI",
          "YAMANASHI",
          "NAGANO",
          "GIFU",
          "SHIZUOKA",
          "AICHI",
          "MIE",
          "SHIGA",
          "KYOTO",
          "OSAKA",
          "HYOGO",
          "NARA",
          "WAKAYAMA",
          "TOTTORI",
          "SHIMANE",
          "OKAYAMA",
          "HIROSHIMA",
          "YAMAGUCHI",
          "TOKUSHIMA",
          "KAGAWA",
          "EHIME",
          "KOCHI",
          "FUKUOKA",
          "SAGA",
          "NAGASAKI",
          "KUMAMOTO",
          "OITA",
          "MIYAZAKI",
          "KAGOSHIMA",
          "OKINAWA"
        ]
      },
      "latitude": { "type": "number", "minimum": 20, "maximum": 46 },
      "longitude": { "type": "number", "minimum": 122, "maximum": 154 },
      "radiusMeters": { "type": "number", "exclusiveMinimum": 0, "maximum": 2000 },
      "dwellSeconds": { "type": "integer", "minimum": 0, "maximum": 3600 },
      "packs": {
        "type": "array",
        "minItems": 1,
        "items": {
          "type": "object",
          "required": ["packId", "order"],
          "additionalProperties": false,
          "properties": {
            "packId": {
              "type": "string",
              "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
            },
            "order": { "type": "integer", "minimum": 1 }
          }
        }
      },
      "retired": { "type": "boolean" },
      "note": { "type": "string" }
    }
  }
}
```

緯度経度の範囲を日本国内に制限しているのは、緯度と経度の取り違えをエディタ上で検出するため。

- [ ] **Step 3: パックのJSON Schemaを作る**

`data/landmarks/landmarkPacks.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://strollia.app/schemas/landmarkPacks.schema.json",
  "title": "Strollia landmark packs",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["id", "name", "description", "trophyImage", "sortOrder"],
    "additionalProperties": false,
    "properties": {
      "id": {
        "type": "string",
        "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
      },
      "name": { "type": "string", "minLength": 1 },
      "description": { "type": "string", "minLength": 1 },
      "trophyImage": { "type": "string", "pattern": "^[a-z0-9-]+\\.png$" },
      "sortOrder": { "type": "integer", "minimum": 1 }
    }
  }
}
```

- [ ] **Step 4: マスタデータを作る**

`data/landmarks/landmarkPacks.json`:

```json
[
  {
    "id": "01a0c450-6c00-7000-8000-000000000001",
    "name": "日本三名瀑",
    "description": "日本を代表する3つの名瀑",
    "trophyImage": "spots-japan-falls-3.png",
    "sortOrder": 100
  }
]
```

`data/landmarks/landmarkSpots.json`:

```json
[
  {
    "id": "01a0c450-6c00-7000-8000-000000000101",
    "name": "華厳の滝",
    "prefecture": "TOCHIGI",
    "latitude": 36.737917,
    "longitude": 139.501972,
    "radiusMeters": 200,
    "dwellSeconds": 180,
    "packs": [{ "packId": "01a0c450-6c00-7000-8000-000000000001", "order": 1 }],
    "note": "観瀑台と駐車場を含む半径。国道120号は300m以上離れており通過では入らない"
  },
  {
    "id": "01a0c450-6c00-7000-8000-000000000102",
    "name": "那智の滝",
    "prefecture": "WAKAYAMA",
    "latitude": 33.675278,
    "longitude": 135.8875,
    "radiusMeters": 150,
    "dwellSeconds": 180,
    "packs": [{ "packId": "01a0c450-6c00-7000-8000-000000000001", "order": 2 }],
    "note": "県道が滝のすぐ近くを通るため半径を他より絞る。那智大社は600m離れており混同しない"
  },
  {
    "id": "01a0c450-6c00-7000-8000-000000000103",
    "name": "袋田の滝",
    "prefecture": "IBARAKI",
    "latitude": 36.764194,
    "longitude": 140.407361,
    "radiusMeters": 200,
    "dwellSeconds": 180,
    "packs": [{ "packId": "01a0c450-6c00-7000-8000-000000000001", "order": 3 }],
    "note": "観瀑台とトンネル入口の料金所付近を含む。麓の駐車場は400m超で含まない"
  }
]
```

- [ ] **Step 5: 生成スクリプトを作る**

`scripts/generate-landmark-catalog.mjs`:

```js
// @ts-check
/**
 * data/landmarks のJSONを検証し、型付きの landmarkCatalog.generated.ts を生成する。
 *
 * 検証はここで落とす。参照の誤りは実行時に何のエラーも出ないまま
 * 「パックが永久に完走不能」という壊れ方をするため、生成時に止める必要がある。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

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

const ajv = new Ajv({ allErrors: true, strict: false });
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
    prefecture: ${toLiteral(spot.prefecture)},
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
  /** 都道府県。大文字スネークケースの固定値。 */
  prefecture: string;
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
```

- [ ] **Step 6: package.json にスクリプトを追加する**

`package.json` の `scripts` へ `generate:licenses` の次の行として追加:

```json
"generate:landmarks": "node scripts/generate-landmark-catalog.mjs",
```

- [ ] **Step 7: 生成を実行して成功を確認する**

Run: `npm run generate:landmarks`
Expected: `landmark catalog を生成しました: .../landmarkCatalog.generated.ts` と `スポット 3 件 / パック 1 件`

- [ ] **Step 8: 公開APIの失敗するテストを書く**

`src/features/landmarks/__tests__/landmarkCatalog.test.ts`:

```typescript
import {
  LANDMARK_PACKS,
  LANDMARK_SPOTS,
  getActiveSpotsForPack,
  getLandmarkPackById,
  getLandmarkPackCompletionAchievementId,
  getLandmarkSpotById,
} from '@/features/landmarks/landmarkCatalog';

jest.mock('react-native', () => ({
  Image: { resolveAssetSource: () => ({ uri: 'file://trophy.png' }) },
}));

/** パイロットの日本三名瀑パックID。 */
const FALLS_PACK_ID = '01a0c450-6c00-7000-8000-000000000001';

describe('スポット実績カタログ landmarkCatalog', () => {
  it('スポットIDが重複していない', () => {
    const ids = LANDMARK_SPOTS.map((spot) => spot.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('緯度経度が日本国内の範囲に収まっている', () => {
    for (const spot of LANDMARK_SPOTS) {
      expect(spot.latitude).toBeGreaterThanOrEqual(20);
      expect(spot.latitude).toBeLessThanOrEqual(46);
      expect(spot.longitude).toBeGreaterThanOrEqual(122);
      expect(spot.longitude).toBeLessThanOrEqual(154);
    }
  });

  it('半径は正の値、滞在時間は0以上である', () => {
    for (const spot of LANDMARK_SPOTS) {
      expect(spot.radiusMeters).toBeGreaterThan(0);
      expect(spot.dwellSeconds).toBeGreaterThanOrEqual(0);
    }
  });

  it('すべてのスポットが実在するパックを参照している', () => {
    const packIds = new Set(LANDMARK_PACKS.map((pack) => pack.id));

    for (const spot of LANDMARK_SPOTS) {
      for (const membership of spot.packs) {
        expect(packIds.has(membership.packId)).toBe(true);
      }
    }
  });

  it('スポットを1件も持たないパックが存在しない', () => {
    for (const pack of LANDMARK_PACKS) {
      expect(getActiveSpotsForPack(pack.id).length).toBeGreaterThan(0);
    }
  });

  it('パックのスポットはorder昇順で返る', () => {
    const names = getActiveSpotsForPack(FALLS_PACK_ID).map((spot) => spot.name);

    expect(names).toEqual(['華厳の滝', '那智の滝', '袋田の滝']);
  });

  it('IDからスポットとパックを引ける', () => {
    expect(getLandmarkSpotById('01a0c450-6c00-7000-8000-000000000101')?.name).toBe('華厳の滝');
    expect(getLandmarkPackById(FALLS_PACK_ID)?.name).toBe('日本三名瀑');
  });

  it('未知のIDにはnullを返す', () => {
    expect(getLandmarkSpotById('01a0c450-6c00-7000-8000-00000000ffff')).toBeNull();
    expect(getLandmarkPackById('01a0c450-6c00-7000-8000-00000000ffff')).toBeNull();
  });

  it('パックIDから完走実績IDを導出できる', () => {
    expect(getLandmarkPackCompletionAchievementId(FALLS_PACK_ID)).toBe(`landmark-pack-${FALLS_PACK_ID}`);
  });
});
```

- [ ] **Step 9: テストを実行して失敗を確認する**

Run: `npm test -- landmarkCatalog`
Expected: FAIL（`Cannot find module '@/features/landmarks/landmarkCatalog'`）

- [ ] **Step 10: 公開APIを実装する**

`src/features/landmarks/landmarkCatalog.ts`:

```typescript
import { Image } from 'react-native';

import {
  GENERATED_LANDMARK_PACKS,
  GENERATED_LANDMARK_SPOTS,
  type GeneratedLandmarkPack,
  type GeneratedLandmarkSpot,
} from './landmarkCatalog.generated';

/** 到達判定の対象となる1地点。 */
export type LandmarkSpot = GeneratedLandmarkSpot;

/** 完走トロフィーの通知添付URIを含むパック定義。 */
export type LandmarkPack = GeneratedLandmarkPack & {
  /** 通知添付に使うトロフィー画像URI。解決できない場合はnull。 */
  trophyImageUri: string | null;
};

/** アプリ全体で参照するスポット一覧。 */
export const LANDMARK_SPOTS: readonly LandmarkSpot[] = GENERATED_LANDMARK_SPOTS;

/** アプリ全体で参照するパック一覧。表示順で並べる。 */
export const LANDMARK_PACKS: readonly LandmarkPack[] = [...GENERATED_LANDMARK_PACKS]
  .sort((left, right) => left.sortOrder - right.sortOrder)
  .map((pack) => ({ ...pack, trophyImageUri: Image.resolveAssetSource(pack.trophyImage)?.uri ?? null }));

/** IDからスポットを取得する。未知のIDはnull。 */
export function getLandmarkSpotById(id: string): LandmarkSpot | null {
  return LANDMARK_SPOTS.find((spot) => spot.id === id) ?? null;
}

/** IDからパックを取得する。未知のIDはnull。 */
export function getLandmarkPackById(id: string): LandmarkPack | null {
  return LANDMARK_PACKS.find((pack) => pack.id === id) ?? null;
}

/**
 * パックに属する有効なスポットをorder昇順で返す。
 *
 * `retired` なスポットは完走判定の分母から外すため除外する。
 * 既に到達済みのユーザーの実績はルール1により取り消されないため、分母が減っても矛盾しない。
 */
export function getActiveSpotsForPack(packId: string): readonly LandmarkSpot[] {
  return LANDMARK_SPOTS.filter((spot) => !spot.retired && spot.packs.some((membership) => membership.packId === packId)).sort(
    (left, right) => getPackOrder(left, packId) - getPackOrder(right, packId),
  );
}

/** 到達判定の候補になる全スポット(retiredを除く)を返す。 */
export function getDetectableLandmarkSpots(): readonly LandmarkSpot[] {
  return LANDMARK_SPOTS.filter((spot) => !spot.retired);
}

/**
 * パック完走実績のIDをパックIDから導出する。
 *
 * achievement_unlocks へ保存されるため安定性が最優先であり、可読性は二の次でよい。
 * マスタから機械的に導くことで、パックと実績定義が食い違う余地をなくす。
 */
export function getLandmarkPackCompletionAchievementId(packId: string): string {
  return `landmark-pack-${packId}`;
}

/** 完走実績IDからパックIDを取り出す。形式が違う場合はnull。 */
export function parseLandmarkPackCompletionAchievementId(achievementId: string): string | null {
  const prefix = 'landmark-pack-';
  return achievementId.startsWith(prefix) ? achievementId.slice(prefix.length) : null;
}

/** 指定パック内での表示順を取り出す。所属していない場合は末尾扱い。 */
function getPackOrder(spot: LandmarkSpot, packId: string): number {
  return spot.packs.find((membership) => membership.packId === packId)?.order ?? Number.MAX_SAFE_INTEGER;
}
```

- [ ] **Step 11: テストを実行して成功を確認する**

Run: `npm test -- landmarkCatalog`
Expected: PASS（10件）

- [ ] **Step 12: 生成物を Prettier の対象外にする**

`.prettierignore` へ追記:

```
src/features/landmarks/landmarkCatalog.generated.ts
```

- [ ] **Step 13: 型チェック・テスト・lintを通す**

```bash
npm run typecheck && npm test && npm run lint
```

- [ ] **Step 14: コミット**

```bash
git add data/landmarks scripts/generate-landmark-catalog.mjs src/features/landmarks package.json package-lock.json .prettierignore
git commit -m "feat(landmarks): スポット実績マスタとカタログ生成を追加"
```

---

## Task 2: DBスキーマと訪問記録リポジトリ

**Files:**

- Modify: `src/db/database.ts`（`landmark_spot_visits` テーブル、`location_recording_state` への3列追加）
- Modify: `src/features/location/locationRecordingStateRepository.ts`（3列の読み書き）
- Create: `src/features/landmarks/landmarkVisitRepository.ts`
- Test: `src/features/landmarks/__tests__/landmarkVisitRepository.test.ts`

**Interfaces:**

- Consumes: Task 1 の `LANDMARK_SPOTS`
- Produces:
  - `LandmarkSpotVisit = { spotId: string; visitedAt: string; visitedLocalDate: string; locationPointId: number | null }`
  - `getLandmarkSpotVisits(): Promise<LandmarkSpotVisit[]>`
  - `getVisitedLandmarkSpotIds(): Promise<Set<string>>`
  - `insertLandmarkSpotVisitInCurrentTransaction(visit: LandmarkSpotVisit, createdAt: string, runner: SQLite.SQLiteDatabase): Promise<void>`
  - `PersistedLocationRecordingState` に `landmarkCandidateSpotId: string | null` / `landmarkCandidateEnteredAt: string | null` / `landmarkOutsideCount: number` が加わる

- [ ] **Step 1: テーブルと列を追加する**

`src/db/database.ts` の `runDatabaseInitialization` 内、`CREATE TABLE IF NOT EXISTS photo_assets (...)` の直後（`execAsync` テンプレート内）へ追加:

```sql
    CREATE TABLE IF NOT EXISTS landmark_spot_visits (
      spot_id TEXT PRIMARY KEY,
      visited_at TEXT NOT NULL,
      visited_local_date TEXT NOT NULL,
      location_point_id INTEGER NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_landmark_spot_visits_local_date
      ON landmark_spot_visits (visited_local_date);
```

同じ関数内で `ensureColumn` を呼んでいる箇所の並びへ、既存ユーザー向けの列追加を加える:

```typescript
await ensureColumn('location_recording_state', 'landmark_candidate_spot_id', 'TEXT NULL');
await ensureColumn('location_recording_state', 'landmark_candidate_entered_at', 'TEXT NULL');
await ensureColumn('location_recording_state', 'landmark_outside_count', 'INTEGER NOT NULL DEFAULT 0');
```

あわせて `CREATE TABLE IF NOT EXISTS location_recording_state` の定義にも同じ3列を追加する（新規インストール用）。`updated_at TEXT NOT NULL` の直前に置く:

```sql
      landmark_candidate_spot_id TEXT NULL,
      landmark_candidate_entered_at TEXT NULL,
      landmark_outside_count INTEGER NOT NULL DEFAULT 0,
```

- [ ] **Step 2: 記録状態リポジトリの失敗するテストを書く**

`src/features/location/__tests__/locationRecordingStateRepository.test.ts` に追記（ファイルが無ければ新規作成し、既存があれば `describe` を追加する）:

```typescript
import {
  INITIAL_PERSISTED_LOCATION_RECORDING_STATE,
  getLocationRecordingStateInCurrentTransaction,
} from '@/features/location/locationRecordingStateRepository';

describe('ライブ記録状態のスポット滞在列', () => {
  it('行が無い場合はスポット滞在状態も初期値になる', () => {
    expect(INITIAL_PERSISTED_LOCATION_RECORDING_STATE.landmarkCandidateSpotId).toBeNull();
    expect(INITIAL_PERSISTED_LOCATION_RECORDING_STATE.landmarkCandidateEnteredAt).toBeNull();
    expect(INITIAL_PERSISTED_LOCATION_RECORDING_STATE.landmarkOutsideCount).toBe(0);
  });

  it('保存済み行からスポット滞在状態を読み出す', async () => {
    const runner = {
      getFirstAsync: jest.fn().mockResolvedValue({
        activeStayPlaceId: null,
        candidateStayPlaceId: null,
        candidateCount: 0,
        outsideCount: 0,
        lastObservedAt: '2026-09-23T10:00:00.000Z',
        lastVisitedGridRecordedAt: null,
        lastVisitedGridLatitude: null,
        lastVisitedGridLongitude: null,
        landmarkCandidateSpotId: '01a0c450-6c00-7000-8000-000000000101',
        landmarkCandidateEnteredAt: '2026-09-23T09:58:00.000Z',
        landmarkOutsideCount: 1,
      }),
    } as unknown as Parameters<typeof getLocationRecordingStateInCurrentTransaction>[0];

    const state = await getLocationRecordingStateInCurrentTransaction(runner);

    expect(state.landmarkCandidateSpotId).toBe('01a0c450-6c00-7000-8000-000000000101');
    expect(state.landmarkCandidateEnteredAt).toBe('2026-09-23T09:58:00.000Z');
    expect(state.landmarkOutsideCount).toBe(1);
  });
});
```

- [ ] **Step 3: テストを実行して失敗を確認する**

Run: `npm test -- locationRecordingStateRepository`
Expected: FAIL（`landmarkCandidateSpotId` が存在しない）

- [ ] **Step 4: 記録状態リポジトリを拡張する**

`src/features/location/locationRecordingStateRepository.ts`:

1. `PersistedLocationRecordingState` に3フィールドを追加する

```typescript
export type PersistedLocationRecordingState = StayPlaceSnapState & {
  /** 吸着状態へ反映済みの最新ライブ観測日時。 */
  lastObservedAt: string | null;
  /** 最後にVisited Gridのセル更新へ利用できた有効座標。 */
  lastVisitedGridPoint: VisitedGridInterpolationPoint | null;
  /** 滞在時間を計測中のスポットID。半径内にいない間はnull。 */
  landmarkCandidateSpotId: string | null;
  /** 候補スポットの半径内で最初に観測した日時。 */
  landmarkCandidateEnteredAt: string | null;
  /** 候補スポットの半径外を連続観測した回数。 */
  landmarkOutsideCount: number;
};
```

2. `INITIAL_PERSISTED_LOCATION_RECORDING_STATE` に `landmarkCandidateSpotId: null, landmarkCandidateEnteredAt: null, landmarkOutsideCount: 0` を追加する
3. `LocationRecordingStateRow` に同名の3フィールドを追加する
4. SELECT文へ3列を追加する

```sql
            landmark_candidate_spot_id AS landmarkCandidateSpotId,
            landmark_candidate_entered_at AS landmarkCandidateEnteredAt,
            landmark_outside_count AS landmarkOutsideCount
```

5. 戻り値オブジェクトへ3フィールドを追加する。`landmarkOutsideCount` は既存行に列が無い場合 `null` が返りうるため `row.landmarkOutsideCount ?? 0` とする
6. INSERT文のカラムリスト・プレースホルダ・`ON CONFLICT DO UPDATE SET`・引数へ3列を追加する

- [ ] **Step 5: テストを実行して成功を確認する**

Run: `npm test -- locationRecordingStateRepository`
Expected: PASS

- [ ] **Step 6: 訪問リポジトリの失敗するテストを書く**

`src/features/landmarks/__tests__/landmarkVisitRepository.test.ts`:

```typescript
import { db } from '@/db/database';
import {
  getLandmarkSpotVisits,
  getVisitedLandmarkSpotIds,
  insertLandmarkSpotVisitInCurrentTransaction,
} from '@/features/landmarks/landmarkVisitRepository';

jest.mock('@/db/database', () => ({
  db: {
    getAllAsync: jest.fn(),
  },
}));

describe('スポット訪問リポジトリ landmarkVisitRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('保存済みの訪問を取得する', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([
      {
        spotId: '01a0c450-6c00-7000-8000-000000000101',
        visitedAt: '2026-04-12T02:00:00.000Z',
        visitedLocalDate: '2026-04-12',
        locationPointId: 42,
      },
    ]);

    await expect(getLandmarkSpotVisits()).resolves.toEqual([
      {
        spotId: '01a0c450-6c00-7000-8000-000000000101',
        visitedAt: '2026-04-12T02:00:00.000Z',
        visitedLocalDate: '2026-04-12',
        locationPointId: 42,
      },
    ]);
  });

  it('到達済みスポットIDの集合を返す', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([
      { spotId: '01a0c450-6c00-7000-8000-000000000101' },
      { spotId: '01a0c450-6c00-7000-8000-000000000103' },
    ]);

    const ids = await getVisitedLandmarkSpotIds();

    expect(ids.has('01a0c450-6c00-7000-8000-000000000101')).toBe(true);
    expect(ids.has('01a0c450-6c00-7000-8000-000000000102')).toBe(false);
  });

  it('同じスポットの再INSERTは既存行を書き換えない', async () => {
    const runner = { runAsync: jest.fn().mockResolvedValue({ changes: 0 }) } as never;

    await insertLandmarkSpotVisitInCurrentTransaction(
      {
        spotId: '01a0c450-6c00-7000-8000-000000000101',
        visitedAt: '2026-04-12T02:00:00.000Z',
        visitedLocalDate: '2026-04-12',
        locationPointId: null,
      },
      '2026-04-12T02:00:00.000Z',
      runner,
    );

    const [sql] = (runner as unknown as { runAsync: jest.Mock }).runAsync.mock.calls[0];
    expect(sql).toContain('INSERT OR IGNORE INTO landmark_spot_visits');
  });
});
```

- [ ] **Step 7: テストを実行して失敗を確認する**

Run: `npm test -- landmarkVisitRepository`
Expected: FAIL（モジュールが存在しない）

- [ ] **Step 8: 訪問リポジトリを実装する**

`src/features/landmarks/landmarkVisitRepository.ts`:

```typescript
import type * as SQLite from 'expo-sqlite';

import { db } from '@/db/database';

/** スポットへの到達記録1件。 */
export type LandmarkSpotVisit = {
  /** マスタのUUIDv7。 */
  spotId: string;
  /** 到達確定時刻(ISO8601)。 */
  visitedAt: string;
  /** 日別記録詳細への遷移に使うローカル日付。 */
  visitedLocalDate: string;
  /** 到達を確定した根拠GPSポイント。保存されない観測で確定した場合はnull。 */
  locationPointId: number | null;
};

/** 到達済みのスポットをすべて取得する。 */
export async function getLandmarkSpotVisits(): Promise<LandmarkSpotVisit[]> {
  return db.getAllAsync<LandmarkSpotVisit>(
    `SELECT spot_id AS spotId,
            visited_at AS visitedAt,
            visited_local_date AS visitedLocalDate,
            location_point_id AS locationPointId
     FROM landmark_spot_visits`,
  );
}

/** 到達済みスポットIDの集合を取得する。 */
export async function getVisitedLandmarkSpotIds(): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ spotId: string }>('SELECT spot_id AS spotId FROM landmark_spot_visits');
  return new Set(rows.map((row) => row.spotId));
}

/**
 * 現在の排他トランザクション内で到達を記録する。
 *
 * INSERT OR IGNORE とすることで、同じスポットの再到達で初回の到達日時を上書きしない。
 * 実績は「一度達成したら取り消さない」方針であり、初回の記録が正となる。
 */
export async function insertLandmarkSpotVisitInCurrentTransaction(
  visit: LandmarkSpotVisit,
  createdAt: string,
  runner: SQLite.SQLiteDatabase,
): Promise<void> {
  await runner.runAsync(
    `INSERT OR IGNORE INTO landmark_spot_visits (spot_id, visited_at, visited_local_date, location_point_id, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    visit.spotId,
    visit.visitedAt,
    visit.visitedLocalDate,
    visit.locationPointId,
    createdAt,
  );
}
```

- [ ] **Step 9: テストを実行して成功を確認する**

Run: `npm test -- landmarkVisitRepository`
Expected: PASS（3件）

- [ ] **Step 10: 型チェック・テスト・lintを通してコミット**

```bash
npm run typecheck && npm test && npm run lint
git add src/db/database.ts src/features/location/locationRecordingStateRepository.ts src/features/location/__tests__ src/features/landmarks
git commit -m "feat(db): スポット到達記録テーブルと滞在状態の列を追加"
```

---

## Task 3: 到達判定の純粋関数

**Files:**

- Create: `src/features/landmarks/landmarkArrivalResolver.ts`
- Test: `src/features/landmarks/__tests__/landmarkArrivalResolver.test.ts`

**Interfaces:**

- Consumes: Task 1 の `LandmarkSpot`
- Produces:
  - `LandmarkArrivalState = { candidateSpotId: string | null; candidateEnteredAt: string | null; outsideCount: number }`
  - `INITIAL_LANDMARK_ARRIVAL_STATE: LandmarkArrivalState`
  - `LandmarkArrivalResult = { state: LandmarkArrivalState; arrivedSpotId: string | null }`
  - `resolveLandmarkArrival(input: { state: LandmarkArrivalState; observation: { latitude: number; longitude: number; recordedAt: string }; spots: readonly LandmarkSpot[]; visitedSpotIds: ReadonlySet<string> }): LandmarkArrivalResult`

**設計上の要点（実装前に必ず読むこと）:**

- 判定は**観測回数ではなく時刻差**で行う。保存されないGPS観測も通る層で呼ばれるため、観測が疎でも動く必要がある
- 半径の**境界値は範囲内**として扱う（既存の滞在場所の吸着半径と同じ）
- 半径外の観測は**2回連続**でリセットする。1点の外れ値でGPSノイズによる滞在時間リセットが起きるのを避けるため
- 到達済みスポットは候補から除外する

- [ ] **Step 1: 失敗するテストを書く**

`src/features/landmarks/__tests__/landmarkArrivalResolver.test.ts`:

```typescript
import { INITIAL_LANDMARK_ARRIVAL_STATE, resolveLandmarkArrival } from '@/features/landmarks/landmarkArrivalResolver';
import type { LandmarkSpot } from '@/features/landmarks/landmarkCatalog';

/** テスト用の華厳の滝。半径200m・滞在180秒。 */
const kegon: LandmarkSpot = {
  id: 'spot-kegon',
  name: '華厳の滝',
  prefecture: 'TOCHIGI',
  latitude: 36.737917,
  longitude: 139.501972,
  radiusMeters: 200,
  dwellSeconds: 180,
  packs: [{ packId: 'pack-falls', order: 1 }],
};

/** 華厳の滝から約1.5km離れたテスト用スポット。 */
const nearby: LandmarkSpot = {
  ...kegon,
  id: 'spot-nearby',
  name: '近くの別スポット',
  latitude: 36.751,
  longitude: 139.501972,
};

/** 中心からちょうど指定メートル北へずらした座標を作る。緯度1度は約111,320m。 */
function northOf(spot: LandmarkSpot, meters: number): { latitude: number; longitude: number } {
  return { latitude: spot.latitude + meters / 111_320, longitude: spot.longitude };
}

/** 観測を組み立てる。 */
function observationAt(coordinate: { latitude: number; longitude: number }, recordedAt: string) {
  return { ...coordinate, recordedAt };
}

describe('スポット到達判定 resolveLandmarkArrival', () => {
  const spots = [kegon];
  const noVisits = new Set<string>();

  it('半径内に入った最初の観測では到達せず、入場時刻を記録する', () => {
    const result = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    expect(result.arrivedSpotId).toBeNull();
    expect(result.state.candidateSpotId).toBe('spot-kegon');
    expect(result.state.candidateEnteredAt).toBe('2026-04-12T02:00:00.000Z');
  });

  it('滞在時間に達した観測で到達が確定する', () => {
    const entered = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    const result = resolveLandmarkArrival({
      state: entered.state,
      observation: observationAt(northOf(kegon, 60), '2026-04-12T02:03:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    expect(result.arrivedSpotId).toBe('spot-kegon');
    expect(result.state).toEqual(INITIAL_LANDMARK_ARRIVAL_STATE);
  });

  it('滞在時間に1秒足りない観測では到達しない', () => {
    const entered = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    const result = resolveLandmarkArrival({
      state: entered.state,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:02:59.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    expect(result.arrivedSpotId).toBeNull();
  });

  it('観測が疎でも、入場から滞在時間が経っていれば到達する', () => {
    const entered = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 180), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    // 途中の観測が1件も無いまま10分後の観測が届くケース(トンネル通過など)
    const result = resolveLandmarkArrival({
      state: entered.state,
      observation: observationAt(northOf(kegon, 20), '2026-04-12T02:10:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    expect(result.arrivedSpotId).toBe('spot-kegon');
  });

  it('半径の境界ちょうどは範囲内として扱う', () => {
    const result = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 200), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    expect(result.state.candidateSpotId).toBe('spot-kegon');
  });

  it('半径外に1点だけ外れても滞在時間はリセットしない', () => {
    const entered = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    const outlier = resolveLandmarkArrival({
      state: entered.state,
      observation: observationAt(northOf(kegon, 400), '2026-04-12T02:01:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    expect(outlier.state.candidateSpotId).toBe('spot-kegon');
    expect(outlier.state.candidateEnteredAt).toBe('2026-04-12T02:00:00.000Z');
    expect(outlier.state.outsideCount).toBe(1);

    const result = resolveLandmarkArrival({
      state: outlier.state,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:03:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    expect(result.arrivedSpotId).toBe('spot-kegon');
  });

  it('半径外が2点連続すると状態をリセットする', () => {
    const entered = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    const first = resolveLandmarkArrival({
      state: entered.state,
      observation: observationAt(northOf(kegon, 400), '2026-04-12T02:01:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    const second = resolveLandmarkArrival({
      state: first.state,
      observation: observationAt(northOf(kegon, 500), '2026-04-12T02:02:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    expect(second.state).toEqual(INITIAL_LANDMARK_ARRIVAL_STATE);
  });

  it('別のスポットへ移ると入場時刻を取り直す', () => {
    const entered = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:00:00.000Z'),
      spots: [kegon, nearby],
      visitedSpotIds: noVisits,
    });

    const result = resolveLandmarkArrival({
      state: entered.state,
      observation: observationAt(northOf(nearby, 50), '2026-04-12T02:05:00.000Z'),
      spots: [kegon, nearby],
      visitedSpotIds: noVisits,
    });

    expect(result.arrivedSpotId).toBeNull();
    expect(result.state.candidateSpotId).toBe('spot-nearby');
    expect(result.state.candidateEnteredAt).toBe('2026-04-12T02:05:00.000Z');
  });

  it('到達済みスポットは候補にしない', () => {
    const result = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: new Set(['spot-kegon']),
    });

    expect(result.state).toEqual(INITIAL_LANDMARK_ARRIVAL_STATE);
    expect(result.arrivedSpotId).toBeNull();
  });

  it('滞在時間0のスポットは半径内の最初の観測で到達する', () => {
    const instant: LandmarkSpot = { ...kegon, id: 'spot-instant', dwellSeconds: 0 };

    const result = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(instant, 50), '2026-04-12T02:00:00.000Z'),
      spots: [instant],
      visitedSpotIds: noVisits,
    });

    expect(result.arrivedSpotId).toBe('spot-instant');
  });

  it('不正な座標の観測では状態を進めない', () => {
    const result = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: { latitude: Number.NaN, longitude: 139.5, recordedAt: '2026-04-12T02:00:00.000Z' },
      spots,
      visitedSpotIds: noVisits,
    });

    expect(result.state).toEqual(INITIAL_LANDMARK_ARRIVAL_STATE);
    expect(result.arrivedSpotId).toBeNull();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- landmarkArrivalResolver`
Expected: FAIL（モジュールが存在しない）

- [ ] **Step 3: 実装する**

`src/features/landmarks/landmarkArrivalResolver.ts`:

```typescript
import { distanceMeters } from '@/utils/distance';
import type { LandmarkSpot } from './landmarkCatalog';

/** 候補スポットの半径外を何回連続で観測したらリセットするか。1点の外れ値を許容する。 */
const REQUIRED_OUTSIDE_OBSERVATION_COUNT = 2;

/** 滞在時間を計測している途中状態。 */
export type LandmarkArrivalState = {
  /** 滞在時間を計測中のスポットID。半径内にいない間はnull。 */
  candidateSpotId: string | null;
  /** 候補スポットの半径内で最初に観測した日時。 */
  candidateEnteredAt: string | null;
  /** 候補スポットの半径外を連続観測した回数。 */
  outsideCount: number;
};

/** 未計測の初期状態。 */
export const INITIAL_LANDMARK_ARRIVAL_STATE: LandmarkArrivalState = {
  candidateSpotId: null,
  candidateEnteredAt: null,
  outsideCount: 0,
};

/** 到達判定へ渡すGPS観測。保存されない観測も含む。 */
export type LandmarkArrivalObservation = {
  latitude: number;
  longitude: number;
  /** 観測日時(ISO8601)。経過時間は端末の現在時刻ではなくこの値で計算する。 */
  recordedAt: string;
};

/** 到達判定の結果。 */
export type LandmarkArrivalResult = {
  /** 次の観測へ引き継ぐ状態。 */
  state: LandmarkArrivalState;
  /** この観測で到達が確定したスポットID。未確定ならnull。 */
  arrivedSpotId: string | null;
};

/**
 * 1観測ぶんのスポット到達を判定する。
 *
 * 判定は観測回数ではなく時刻差で行う。GPS保存フィルタは停止中の点をほとんど保存しないため、
 * 「滝の前で立ち止まる」ケースでは保存点がほぼ増えない。回数ベースにすると最も達成させたい
 * 状況で滞在時間が進まなくなるため、入場時刻と観測時刻の差で判定する。
 * この設計により、トンネル通過などで観測が数分空いても正しく到達が確定する。
 */
export function resolveLandmarkArrival(input: {
  state: LandmarkArrivalState;
  observation: LandmarkArrivalObservation;
  spots: readonly LandmarkSpot[];
  visitedSpotIds: ReadonlySet<string>;
}): LandmarkArrivalResult {
  const { state, observation, spots, visitedSpotIds } = input;

  if (!isValidCoordinate(observation)) {
    return { state, arrivedSpotId: null };
  }

  const candidate = findClosestSpotInRadius(observation, spots, visitedSpotIds);

  if (!candidate) {
    return resolveWhileOutside(state);
  }

  const isSameCandidate = state.candidateSpotId === candidate.id;
  const enteredAt = isSameCandidate && state.candidateEnteredAt ? state.candidateEnteredAt : observation.recordedAt;
  const elapsedSeconds = (Date.parse(observation.recordedAt) - Date.parse(enteredAt)) / 1000;

  if (Number.isFinite(elapsedSeconds) && elapsedSeconds >= candidate.dwellSeconds) {
    return { state: INITIAL_LANDMARK_ARRIVAL_STATE, arrivedSpotId: candidate.id };
  }

  return {
    state: { candidateSpotId: candidate.id, candidateEnteredAt: enteredAt, outsideCount: 0 },
    arrivedSpotId: null,
  };
}

/**
 * 候補の半径外を観測したときの状態を解決する。
 *
 * 1点の外れ値では滞在時間をリセットしない。GPSノイズで1点だけ半径外へ飛んだときに
 * 計測がゼロへ戻るのを避けるためで、到達は一度確定すれば取り消されない片方向の判定であり、
 * 誤って早く確定するリスクのほうが小さい。
 */
function resolveWhileOutside(state: LandmarkArrivalState): LandmarkArrivalResult {
  if (state.candidateSpotId == null) {
    return { state: INITIAL_LANDMARK_ARRIVAL_STATE, arrivedSpotId: null };
  }

  const outsideCount = state.outsideCount + 1;

  if (outsideCount >= REQUIRED_OUTSIDE_OBSERVATION_COUNT) {
    return { state: INITIAL_LANDMARK_ARRIVAL_STATE, arrivedSpotId: null };
  }

  return { state: { ...state, outsideCount }, arrivedSpotId: null };
}

/**
 * 観測地点の半径内にある未到達スポットのうち最寄りを返す。
 *
 * 同距離の場合はID昇順で安定させる。UUIDv7は生成順に単調増加するため、実質マスタへの登録順になる。
 */
function findClosestSpotInRadius(
  observation: LandmarkArrivalObservation,
  spots: readonly LandmarkSpot[],
  visitedSpotIds: ReadonlySet<string>,
): LandmarkSpot | null {
  let closest: { spot: LandmarkSpot; distance: number } | null = null;

  for (const spot of spots) {
    if (spot.retired || visitedSpotIds.has(spot.id)) {
      continue;
    }

    const distance = distanceMeters(observation, spot);

    // 境界値は範囲内として扱う(既存の滞在場所の吸着半径と同じ)
    if (distance > spot.radiusMeters) {
      continue;
    }

    if (!closest || distance < closest.distance || (distance === closest.distance && spot.id < closest.spot.id)) {
      closest = { spot, distance };
    }
  }

  return closest?.spot ?? null;
}

/** 有限値かつ地理座標として有効な緯度経度か判定する。 */
function isValidCoordinate(coordinate: { latitude: number; longitude: number }): boolean {
  return (
    Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180
  );
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npm test -- landmarkArrivalResolver`
Expected: PASS（11件）

- [ ] **Step 5: 型チェック・テスト・lintを通してコミット**

```bash
npm run typecheck && npm test && npm run lint
git add src/features/landmarks
git commit -m "feat(landmarks): 半径と滞在時間によるスポット到達判定を追加"
```

---

## Task 4: GPS観測への組み込みとPlusゲート

**Files:**

- Create: `src/features/landmarks/landmarkRecordingService.ts`
- Test: `src/features/landmarks/__tests__/landmarkRecordingService.test.ts`
- Modify: `src/features/location/locationObservationRecorder.ts`
- Modify: `src/features/location/locationRecordingSession.ts`
- Modify: `src/features/location/backgroundLocationTask.ts`
- Test: `src/features/location/__tests__/locationObservationRecorder.test.ts`（既存ファイルへ describe 追加）

**Interfaces:**

- Consumes: Task 1〜3 のすべて
- Produces:
  - `LandmarkDetectionSnapshot = { status: 'enabled'; spots: readonly LandmarkSpot[]; visitedSpotIds: ReadonlySet<string> } | { status: 'disabled' } | { status: 'unavailable' }`
  - `getLandmarkDetectionSnapshotForRecording(): Promise<LandmarkDetectionSnapshot>`
  - `RecordLocationObservationInput` に `landmarkDetection: LandmarkDetectionSnapshot` が加わる

- [ ] **Step 1: 記録サービスの失敗するテストを書く**

`src/features/landmarks/__tests__/landmarkRecordingService.test.ts`:

```typescript
import { getPremiumAccessState } from '@/features/premium/revenueCatAccess';
import { getLandmarkDetectionSnapshotForRecording } from '@/features/landmarks/landmarkRecordingService';
import { getVisitedLandmarkSpotIds } from '@/features/landmarks/landmarkVisitRepository';

jest.mock('@/features/premium/revenueCatAccess', () => ({
  getPremiumAccessState: jest.fn(),
}));

jest.mock('@/features/landmarks/landmarkVisitRepository', () => ({
  getVisitedLandmarkSpotIds: jest.fn(),
}));

jest.mock('react-native', () => ({
  Image: { resolveAssetSource: () => ({ uri: 'file://trophy.png' }) },
}));

describe('スポット検知の記録境界 landmarkRecordingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Plus有効なら検知対象のスポットと到達済みIDを返す', async () => {
    (getPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: true, entitlementId: 'strollia_plus' });
    (getVisitedLandmarkSpotIds as jest.Mock).mockResolvedValue(new Set(['01a0c450-6c00-7000-8000-000000000101']));

    const snapshot = await getLandmarkDetectionSnapshotForRecording();

    expect(snapshot.status).toBe('enabled');
    if (snapshot.status === 'enabled') {
      expect(snapshot.spots.length).toBeGreaterThan(0);
      expect(snapshot.visitedSpotIds.has('01a0c450-6c00-7000-8000-000000000101')).toBe(true);
    }
  });

  it('Plus無効なら検知を行わない', async () => {
    (getPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: false, entitlementId: 'strollia_plus' });

    const snapshot = await getLandmarkDetectionSnapshotForRecording();

    expect(snapshot.status).toBe('disabled');
    expect(getVisitedLandmarkSpotIds).not.toHaveBeenCalled();
  });

  it('取得に失敗した場合はunavailableを返す', async () => {
    (getPremiumAccessState as jest.Mock).mockRejectedValue(new Error('offline'));

    await expect(getLandmarkDetectionSnapshotForRecording()).resolves.toEqual({ status: 'unavailable' });
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- landmarkRecordingService`
Expected: FAIL（モジュールが存在しない）

- [ ] **Step 3: 記録サービスを実装する**

`src/features/landmarks/landmarkRecordingService.ts`:

```typescript
import { getPremiumAccessState } from '@/features/premium/revenueCatAccess';
import { getDetectableLandmarkSpots, type LandmarkSpot } from './landmarkCatalog';
import { getVisitedLandmarkSpotIds } from './landmarkVisitRepository';

/**
 * 1配信バッチぶんのスポット検知の可否と対象。
 *
 * `disabled` はPlus無効による明示的な権利消失、`unavailable` は取得の一時的失敗を表す。
 * 前者では滞在状態をリセットし、後者では既存の状態をそのまま保持する。
 */
export type LandmarkDetectionSnapshot =
  | { status: 'enabled'; spots: readonly LandmarkSpot[]; visitedSpotIds: ReadonlySet<string> }
  | { status: 'disabled' }
  | { status: 'unavailable' };

/**
 * 記録時点の契約状態に対応するスポット検知の対象を取得する。
 *
 * ProviderやバックグラウンドTaskがDB・課金実装を直接組み合わせないよう、境界をここへ集約する。
 * スポット実績はPlus限定であり、無料ユーザーでは到達検知自体を行わない。
 */
export async function getLandmarkDetectionSnapshotForRecording(): Promise<LandmarkDetectionSnapshot> {
  try {
    const premiumAccessState = await getPremiumAccessState();

    if (!premiumAccessState.isPlusActive) {
      return { status: 'disabled' };
    }

    return { status: 'enabled', spots: getDetectableLandmarkSpots(), visitedSpotIds: await getVisitedLandmarkSpotIds() };
  } catch (error: unknown) {
    console.warn('Landmark detection snapshot loading failed:', error);
    return { status: 'unavailable' };
  }
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npm test -- landmarkRecordingService`
Expected: PASS（3件）

- [ ] **Step 5: Recorder の失敗するテストを書く**

`src/features/location/__tests__/locationObservationRecorder.test.ts` へ describe を追加する。既存ファイルのモック構成に合わせること。追加するケース:

```typescript
describe('スポット到達の記録', () => {
  it('Plus無効なら到達を記録せず滞在状態をリセットする', async () => {
    // landmarkDetection: { status: 'disabled' } を渡し、
    // upsertLocationRecordingStateInCurrentTransaction へ渡る state の
    // landmarkCandidateSpotId が null、landmarkOutsideCount が 0 であることを検証する
  });

  it('取得失敗時は滞在状態を保持する', async () => {
    // landmarkDetection: { status: 'unavailable' } を渡し、
    // 既存の landmarkCandidateSpotId / landmarkCandidateEnteredAt が保持されることを検証する
  });

  it('到達が確定するとlandmark_spot_visitsへINSERTする', async () => {
    // 滞在時間を満たす2点目の観測で insertLandmarkSpotVisitInCurrentTransaction が
    // 呼ばれ、visitedLocalDate が観測のlocalDateであることを検証する
  });

  it('保存されない観測でも到達を確定できる', async () => {
    // shouldSaveLocationPoint が false になる近接点でも到達がINSERTされ、
    // locationPointId が null で記録されることを検証する
  });
});
```

各テストの中身は既存ファイルのヘルパーに合わせて具体化すること。既存テストが `jest.mock('@/features/logs/logRepository', ...)` 等をどう組んでいるかを読んでから書く。

- [ ] **Step 6: テストを実行して失敗を確認する**

Run: `npm test -- locationObservationRecorder`
Expected: FAIL

- [ ] **Step 7: Recorder を拡張する**

`src/features/location/locationObservationRecorder.ts`:

1. import を追加する

```typescript
import {
  INITIAL_LANDMARK_ARRIVAL_STATE,
  resolveLandmarkArrival,
  type LandmarkArrivalState,
} from '@/features/landmarks/landmarkArrivalResolver';
import type { LandmarkDetectionSnapshot } from '@/features/landmarks/landmarkRecordingService';
import { insertLandmarkSpotVisitInCurrentTransaction } from '@/features/landmarks/landmarkVisitRepository';
```

2. `RecordLocationObservationInput` へ追加する

```typescript
/** 当該配信バッチで利用できるスポット検知の対象、または無効・取得失敗。 */
landmarkDetection: LandmarkDetectionSnapshot;
```

3. 永続状態から到達判定状態を取り出すヘルパーを追加する

```typescript
/** 永続化された記録状態からスポット到達判定の状態を取り出す。 */
function toLandmarkArrivalState(state: PersistedLocationRecordingState): LandmarkArrivalState {
  return {
    candidateSpotId: state.landmarkCandidateSpotId,
    candidateEnteredAt: state.landmarkCandidateEnteredAt,
    outsideCount: state.landmarkOutsideCount,
  };
}
```

4. `withExclusiveTransaction` 内、`upsertLocationRecordingStateInCurrentTransaction` を呼ぶ直前でスポット到達を解決する

```typescript
// スポット到達は保存されない観測も対象にする。停止中はGPS保存フィルタがほとんどの点を
// 捨てるため、保存点だけを見ていると滞在時間が進まず到達が永久に確定しない。
const landmarkResult = resolveLandmarkArrivalForObservation(persistedState, rawPoint, activeStayPlaces, input.landmarkDetection);

if (landmarkResult.arrivedSpotId) {
  await insertLandmarkSpotVisitInCurrentTransaction(
    {
      spotId: landmarkResult.arrivedSpotId,
      visitedAt: rawPoint.recordedAt,
      visitedLocalDate: rawPoint.localDate,
      locationPointId,
    },
    now,
    txn,
  );
}
```

`locationPointId` は既存の変数をそのまま使う（保存されなかった観測では `null`）。

5. 到達判定の呼び分けを行うヘルパーを追加する

```typescript
/**
 * スポット検知の可否に応じて到達判定を行う。
 *
 * Plus無効(`disabled`)は明示的な権利消失のため滞在状態をリセットする。
 * 取得失敗(`unavailable`)は一時的な障害のため、次の正常取得まで滞在状態を保持する。
 */
function resolveLandmarkArrivalForObservation(
  persistedState: PersistedLocationRecordingState,
  rawPoint: NewLocationPoint,
  activeStayPlaces: ActiveStayPlacesSnapshot,
  detection: LandmarkDetectionSnapshot,
): { state: LandmarkArrivalState; arrivedSpotId: string | null } {
  if (detection.status === 'disabled') {
    return { state: INITIAL_LANDMARK_ARRIVAL_STATE, arrivedSpotId: null };
  }

  if (detection.status === 'unavailable') {
    return { state: toLandmarkArrivalState(persistedState), arrivedSpotId: null };
  }

  return resolveLandmarkArrival({
    state: toLandmarkArrivalState(persistedState),
    // 到達判定は生座標で行う。滞在場所への吸着座標を使うと、吸着中の位置が
    // スポット判定へ混入してしまうため。
    observation: { latitude: rawPoint.latitude, longitude: rawPoint.longitude, recordedAt: rawPoint.recordedAt },
    spots: detection.spots,
    visitedSpotIds: detection.visitedSpotIds,
  });
}
```

`activeStayPlaces` は引数から外してよい（未使用ならlintエラーになるため、シグネチャから削除する）。

6. `upsertLocationRecordingStateInCurrentTransaction` へ渡すオブジェクトへ3フィールドを足す

```typescript
await upsertLocationRecordingStateInCurrentTransaction(
  {
    ...snapResult.state,
    lastObservedAt: rawPoint.recordedAt,
    lastVisitedGridPoint,
    landmarkCandidateSpotId: landmarkResult.state.candidateSpotId,
    landmarkCandidateEnteredAt: landmarkResult.state.candidateEnteredAt,
    landmarkOutsideCount: landmarkResult.state.outsideCount,
  },
  now,
  txn,
);
```

- [ ] **Step 8: セッションとバックグラウンドタスクを結線する**

`src/features/location/locationRecordingSession.ts`:

1. `LocationRecordingSessionOptions` へ追加する

```typescript
  /** 課金状態・到達済みスポットを次の配信バッチから反映するため、配信バッチごとに取得する。 */
  getLandmarkDetection?: () => Promise<LandmarkDetectionSnapshot>;
```

2. `recordLocations` の中、`activeStayPlaces` を取得している行の直後で同様にスナップショットを取る

```typescript
const landmarkDetection: LandmarkDetectionSnapshot = options.getLandmarkDetection
  ? await options.getLandmarkDetection()
  : { status: 'disabled' };
```

3. `recordLocationObservation({ rawPoint, activeStayPlaces })` へ `landmarkDetection` を渡す

`src/features/location/backgroundLocationTask.ts` の `createLocationRecordingSession` 呼び出しへ追加する:

```typescript
const session = await createLocationRecordingSession({
  getActiveStayPlaces: getActiveStayPlacesForRecording,
  getLandmarkDetection: getLandmarkDetectionSnapshotForRecording,
});
```

同じ結線を、前景で `createLocationRecordingSession` / `flushLocationsBufferedDuringGpxImport` を呼んでいる箇所すべてに適用する。`grep -rn "createLocationRecordingSession\|flushLocationsBufferedDuringGpxImport" src --include=*.ts --include=*.tsx` で漏れがないか確認すること。

- [ ] **Step 9: テストを実行して成功を確認する**

Run: `npm test -- locationObservationRecorder locationRecordingSession`
Expected: PASS

- [ ] **Step 10: 型チェック・テスト・lintを通してコミット**

```bash
npm run typecheck && npm test && npm run lint
git add src/features/landmarks src/features/location
git commit -m "feat(landmarks): GPS観測ごとのスポット到達検知を記録へ組み込み"
```

---

## Task 5: パック完走実績

**Files:**

- Modify: `src/features/achievements/achievementDefinitions.ts`
- Modify: `src/features/achievements/achievementEvaluator.ts`
- Modify: `src/features/achievements/achievementRepository.ts`
- Test: `src/features/achievements/__tests__/achievementEvaluator.test.ts`（既存へ describe 追加）
- Test: `src/features/landmarks/__tests__/landmarkPackProgress.test.ts`
- Create: `src/features/landmarks/landmarkPackProgress.ts`

**Interfaces:**

- Consumes: Task 1・2
- Produces:
  - `LandmarkPackProgress = { packId: string; visitedCount: number; totalCount: number }`
  - `resolveLandmarkPackProgress(visitedSpotIds: ReadonlySet<string>): LandmarkPackProgress[]`
  - `AchievementCondition` に `{ type: 'landmarkPackCompletion'; packId: string; threshold: number }`
  - `AchievementCategory` に `'landmarkPack'`
  - `AchievementProgress` に `landmarkPackVisitedCounts: Readonly<Record<string, number>>`

- [ ] **Step 1: パック進捗の失敗するテストを書く**

`src/features/landmarks/__tests__/landmarkPackProgress.test.ts`:

```typescript
import { resolveLandmarkPackProgress } from '@/features/landmarks/landmarkPackProgress';

jest.mock('react-native', () => ({
  Image: { resolveAssetSource: () => ({ uri: 'file://trophy.png' }) },
}));

const FALLS_PACK_ID = '01a0c450-6c00-7000-8000-000000000001';
const KEGON_ID = '01a0c450-6c00-7000-8000-000000000101';
const NACHI_ID = '01a0c450-6c00-7000-8000-000000000102';

describe('パック進捗 resolveLandmarkPackProgress', () => {
  it('未到達なら0件として返す', () => {
    const [progress] = resolveLandmarkPackProgress(new Set());

    expect(progress).toEqual({ packId: FALLS_PACK_ID, visitedCount: 0, totalCount: 3 });
  });

  it('到達済みスポット数を数える', () => {
    const [progress] = resolveLandmarkPackProgress(new Set([KEGON_ID, NACHI_ID]));

    expect(progress.visitedCount).toBe(2);
    expect(progress.totalCount).toBe(3);
  });

  it('マスタに存在しない到達記録は数えない', () => {
    const [progress] = resolveLandmarkPackProgress(new Set(['01a0c450-6c00-7000-8000-00000000ffff']));

    expect(progress.visitedCount).toBe(0);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- landmarkPackProgress`
Expected: FAIL

- [ ] **Step 3: パック進捗を実装する**

`src/features/landmarks/landmarkPackProgress.ts`:

```typescript
import { LANDMARK_PACKS, getActiveSpotsForPack } from './landmarkCatalog';

/** パック1件の到達進捗。 */
export type LandmarkPackProgress = {
  packId: string;
  /** 到達済みスポット数。 */
  visitedCount: number;
  /** 完走に必要なスポット数(retiredを除く)。 */
  totalCount: number;
};

/**
 * 到達済みスポットIDからパックごとの進捗を求める。
 *
 * 同一スポットが複数パックに属する場合、1回の到達で該当する全パックの進捗が進む。
 */
export function resolveLandmarkPackProgress(visitedSpotIds: ReadonlySet<string>): LandmarkPackProgress[] {
  return LANDMARK_PACKS.map((pack) => {
    const spots = getActiveSpotsForPack(pack.id);

    return {
      packId: pack.id,
      visitedCount: spots.filter((spot) => visitedSpotIds.has(spot.id)).length,
      totalCount: spots.length,
    };
  });
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npm test -- landmarkPackProgress`
Expected: PASS（3件）

- [ ] **Step 5: 実績定義へパック完走を追加する**

`src/features/achievements/achievementDefinitions.ts`:

1. カテゴリと条件の型を広げる

```typescript
export type AchievementCategory = 'distance' | 'logDays' | 'prefecture' | 'municipality' | 'landmarkPack';

export type AchievementCondition =
  | { type: 'totalDistanceMeters'; threshold: number }
  | { type: 'logDays'; threshold: number }
  | { type: 'prefectureCount'; threshold: number }
  | { type: 'municipalityCount'; threshold: number }
  | { type: 'landmarkPackCompletion'; packId: string; threshold: number };
```

2. パック完走定義をマスタから導出する関数を追加する

```typescript
/**
 * スポットパックの完走実績をマスタから導出する。
 *
 * パックを追加するたびに実績定義を手で書き足さずに済み、
 * マスタと実績定義が食い違う余地がなくなる。
 */
function createLandmarkPackDefinitions(): AchievementDefinition[] {
  return LANDMARK_PACKS.map((pack, index) => ({
    id: getLandmarkPackCompletionAchievementId(pack.id),
    title: `${pack.name}を制覇`,
    description: `${pack.name}のすべてのスポットへ到達する`,
    category: 'landmarkPack',
    condition: { type: 'landmarkPackCompletion', packId: pack.id, threshold: getActiveSpotsForPack(pack.id).length },
    trophyImage: pack.trophyImage,
    trophyImageUri: pack.trophyImageUri,
    shareText: createAchievementShareText(`${pack.name}を制覇`),
    sortOrder: 6000 + index,
    enabled: true,
  }));
}
```

3. `ACHIEVEMENT_DEFINITIONS` の末尾へ `...createLandmarkPackDefinitions(),` を追加する

- [ ] **Step 6: 評価器へ条件を追加する**

`src/features/achievements/achievementEvaluator.ts`:

1. `AchievementProgress` へ追加する

```typescript
/** パックIDごとの到達済みスポット数。 */
landmarkPackVisitedCounts: Readonly<Record<string, number>>;
```

2. `getProgressValueForCondition` の switch へ追加する

```typescript
    case 'landmarkPackCompletion':
      return progress.landmarkPackVisitedCounts[condition.packId] ?? 0;
```

- [ ] **Step 7: 進捗取得へパック到達数を足す**

`src/features/achievements/achievementRepository.ts` の `getAchievementProgress` で、
`getVisitedLandmarkSpotIds()` と `resolveLandmarkPackProgress()` を使って
`landmarkPackVisitedCounts` を組み立て、戻り値へ含める。

```typescript
const visitedLandmarkSpotIds = await getVisitedLandmarkSpotIds();
const landmarkPackVisitedCounts = Object.fromEntries(
  resolveLandmarkPackProgress(visitedLandmarkSpotIds).map((progress) => [progress.packId, progress.visitedCount]),
);
```

`Promise.all` の配列へ `getVisitedLandmarkSpotIds()` を足して並列化してよい。

- [ ] **Step 8: 評価器のテストを追加する**

`src/features/achievements/__tests__/achievementEvaluator.test.ts` へ追記:

```typescript
describe('スポットパック完走の判定', () => {
  it('全スポット到達で完走条件を満たす', () => {
    const condition = { type: 'landmarkPackCompletion' as const, packId: 'pack-falls', threshold: 3 };

    expect(
      isAchievementConditionMet(condition, {
        totalDistanceMeters: 0,
        logDays: 0,
        prefectureCount: 0,
        municipalityCount: 0,
        landmarkPackVisitedCounts: { 'pack-falls': 3 },
      }),
    ).toBe(true);
  });

  it('1件でも未到達なら完走しない', () => {
    const condition = { type: 'landmarkPackCompletion' as const, packId: 'pack-falls', threshold: 3 };

    expect(
      isAchievementConditionMet(condition, {
        totalDistanceMeters: 0,
        logDays: 0,
        prefectureCount: 0,
        municipalityCount: 0,
        landmarkPackVisitedCounts: { 'pack-falls': 2 },
      }),
    ).toBe(false);
  });

  it('未知のパックIDは0件として扱う', () => {
    const condition = { type: 'landmarkPackCompletion' as const, packId: 'pack-unknown', threshold: 3 };

    expect(
      isAchievementConditionMet(condition, {
        totalDistanceMeters: 0,
        logDays: 0,
        prefectureCount: 0,
        municipalityCount: 0,
        landmarkPackVisitedCounts: {},
      }),
    ).toBe(false);
  });
});
```

既存テストの `AchievementProgress` を組み立てている箇所すべてに `landmarkPackVisitedCounts: {}` を足す必要がある。型エラーが出る箇所を `npm run typecheck` で洗い出して修正すること。

- [ ] **Step 9: テストを実行して成功を確認する**

Run: `npm test -- achievementEvaluator achievementRepository`
Expected: PASS

- [ ] **Step 10: 型チェック・テスト・lintを通してコミット**

```bash
npm run typecheck && npm test && npm run lint
git add src/features/achievements src/features/landmarks
git commit -m "feat(achievements): スポットパック完走実績を追加"
```

---

## Task 6: スポット到達通知

**Files:**

- Create: `src/features/landmarks/landmarkNotificationService.ts`
- Test: `src/features/landmarks/__tests__/landmarkNotificationService.test.ts`
- Modify: `src/features/achievements/achievementService.ts`
- Modify: `src/features/location/locationObservationRecorder.ts`（到達したスポットIDを戻り値へ含める）
- Modify: `src/features/location/locationRecordingSession.ts`（到達通知の呼び出し）

**Interfaces:**

- Produces:
  - `notifyLandmarkSpotArrival(spotId: string): Promise<void>`
  - `RecordLocationObservationResult` の `saved` / `not-saved` に `arrivedLandmarkSpotId: string | null` が加わる

- [ ] **Step 1: 失敗するテストを書く**

`src/features/landmarks/__tests__/landmarkNotificationService.test.ts`:

```typescript
import * as Notifications from 'expo-notifications';

import { notifyLandmarkSpotArrival } from '@/features/landmarks/landmarkNotificationService';
import { getVisitedLandmarkSpotIds } from '@/features/landmarks/landmarkVisitRepository';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));

jest.mock('@/features/landmarks/landmarkVisitRepository', () => ({
  getVisitedLandmarkSpotIds: jest.fn(),
}));

jest.mock('react-native', () => ({
  Image: { resolveAssetSource: () => ({ uri: 'file://trophy.png' }) },
  Platform: { OS: 'ios' },
}));

const KEGON_ID = '01a0c450-6c00-7000-8000-000000000101';

describe('スポット到達通知 landmarkNotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getVisitedLandmarkSpotIds as jest.Mock).mockResolvedValue(new Set([KEGON_ID]));
  });

  it('通知が許可されていなければ何も送らない', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

    await notifyLandmarkSpotArrival(KEGON_ID);

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('スポット名とパック進捗を本文に含める', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });

    await notifyLandmarkSpotArrival(KEGON_ID);

    const [[request]] = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
    expect(request.content.title).toBe('スポットに到達しました！');
    expect(request.content.body).toContain('華厳の滝');
    expect(request.content.body).toContain('日本三名瀑 1/3');
  });

  it('マスタに存在しないスポットIDでは何も送らない', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });

    await notifyLandmarkSpotArrival('01a0c450-6c00-7000-8000-00000000ffff');

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- landmarkNotificationService`
Expected: FAIL

- [ ] **Step 3: 実装する**

`src/features/landmarks/landmarkNotificationService.ts`:

```typescript
import * as Notifications from 'expo-notifications';

import { ACHIEVEMENT_NOTIFICATION_CHANNEL_ID } from '@/features/achievements/achievementNotificationService';
import { getLandmarkPackById, getLandmarkSpotById } from './landmarkCatalog';
import { resolveLandmarkPackProgress } from './landmarkPackProgress';
import { getVisitedLandmarkSpotIds } from './landmarkVisitRepository';

/**
 * スポット到達をローカル通知する。
 *
 * 到達はまだ実績ではないため、トロフィー演出(AchievementUnlockModal)は出さず通知のみとする。
 * パック完走時は既存の実績解除フローが別途トロフィー演出を行う。
 */
export async function notifyLandmarkSpotArrival(spotId: string): Promise<void> {
  const spot = getLandmarkSpotById(spotId);

  if (!spot) {
    return;
  }

  const permissions = await Notifications.getPermissionsAsync();

  if (!permissions.granted) {
    return;
  }

  const body = await createArrivalBody(spotId, spot.name);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'スポットに到達しました！',
      channelId: ACHIEVEMENT_NOTIFICATION_CHANNEL_ID,
      body,
      data: { landmarkSpotId: spotId },
      sound: true,
      vibrate: [0, 1000],
    } as Notifications.NotificationContentInput & { channelId: string },
    trigger: null,
  });
}

/** 「華厳の滝に到達しました（日本三名瀑 1/3）」形式の本文を作る。 */
async function createArrivalBody(spotId: string, spotName: string): Promise<string> {
  const spot = getLandmarkSpotById(spotId);
  const visitedSpotIds = await getVisitedLandmarkSpotIds();
  const progressByPackId = new Map(resolveLandmarkPackProgress(visitedSpotIds).map((progress) => [progress.packId, progress]));

  const packSummaries = (spot?.packs ?? [])
    .map((membership) => {
      const pack = getLandmarkPackById(membership.packId);
      const progress = progressByPackId.get(membership.packId);

      return pack && progress ? `${pack.name} ${progress.visitedCount}/${progress.totalCount}` : null;
    })
    .filter((summary): summary is string => summary != null);

  return packSummaries.length > 0 ? `${spotName}に到達しました（${packSummaries.join('・')}）` : `${spotName}に到達しました`;
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npm test -- landmarkNotificationService`
Expected: PASS（3件）

- [ ] **Step 5: 到達したスポットIDを記録結果へ乗せる**

`src/features/location/locationObservationRecorder.ts` の `RecordLocationObservationResult` を変更する:

```typescript
export type RecordLocationObservationResult =
  | { status: 'saved'; point: NewLocationPoint; locationPointId: number; arrivedLandmarkSpotId: string | null }
  | { status: 'not-saved'; arrivedLandmarkSpotId: string | null }
  | { status: 'stale' | 'duplicate' };
```

`result.value` へ代入している箇所で `arrivedLandmarkSpotId: landmarkResult.arrivedSpotId` を渡す。

- [ ] **Step 6: セッションで到達通知を呼ぶ**

`src/features/location/locationRecordingSession.ts` の `recordLocations` で、到達したスポットIDを集めて
保存点の実績処理と同じくループの後段で通知する。

```typescript
// 到達通知はGPSポイント確定後に行う。保存されない観測で確定した到達も対象にする。
for (const arrivedSpotId of arrivedLandmarkSpotIds) {
  await notifyLandmarkSpotArrival(arrivedSpotId).catch((error: unknown) => {
    console.warn('Landmark arrival notification failed:', error);
  });
}
```

`arrivedLandmarkSpotIds` は `result.status === 'saved' || result.status === 'not-saved'` のときに
`result.arrivedLandmarkSpotId` が非nullなら push する配列とする。

- [ ] **Step 7: テストを実行して成功を確認する**

Run: `npm test -- locationRecordingSession locationObservationRecorder`
Expected: PASS

- [ ] **Step 8: 型チェック・テスト・lintを通してコミット**

```bash
npm run typecheck && npm test && npm run lint
git add src/features/landmarks src/features/location
git commit -m "feat(landmarks): スポット到達のローカル通知を追加"
```

---

## Task 7: 汎用プログレスバーとリスト行の拡張

**Files:**

- Create: `src/ui/components/AppProgressBar.tsx`
- Test: `src/ui/components/__tests__/AppProgressBar.test.tsx`
- Modify: `src/ui/components/AppListItem.tsx`（`footer` スロット追加）
- Modify: `src/ui/appStyles.ts` または `src/ui/styles/commonStyles.ts`（スタイル追加）
- Create: `src/features/landmarks/landmarkTrophyDisplayState.ts`
- Test: `src/features/landmarks/__tests__/landmarkTrophyDisplayState.test.ts`

**Interfaces:**

- Produces:
  - `AppProgressBarProps = { ratio: number; styles: AppStyles; theme: AppTheme; accessibilityLabel: string }`
  - `AppListItemProps` に `footer?: ReactNode`
  - `LandmarkTrophyDisplayState = 'dim' | 'grayscale' | 'color'`
  - `resolveLandmarkTrophyDisplayState(ratio: number): LandmarkTrophyDisplayState`

- [ ] **Step 1: トロフィー表示状態の失敗するテストを書く**

`src/features/landmarks/__tests__/landmarkTrophyDisplayState.test.ts`:

```typescript
import { resolveLandmarkTrophyDisplayState } from '@/features/landmarks/landmarkTrophyDisplayState';

describe('トロフィー表示状態 resolveLandmarkTrophyDisplayState', () => {
  it('未到達は白黒+減光になる', () => {
    expect(resolveLandmarkTrophyDisplayState(0)).toBe('dim');
  });

  it('到達率50%ちょうどは白黒+減光のまま', () => {
    expect(resolveLandmarkTrophyDisplayState(0.5)).toBe('dim');
  });

  it('過半数を超えると白黒になる', () => {
    expect(resolveLandmarkTrophyDisplayState(2 / 3)).toBe('grayscale');
  });

  it('完走でフルカラーになる', () => {
    expect(resolveLandmarkTrophyDisplayState(1)).toBe('color');
  });

  it('分母0や不正値は白黒+減光として扱う', () => {
    expect(resolveLandmarkTrophyDisplayState(Number.NaN)).toBe('dim');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- landmarkTrophyDisplayState`
Expected: FAIL

- [ ] **Step 3: 実装する**

`src/features/landmarks/landmarkTrophyDisplayState.ts`:

```typescript
/** パックトロフィーの表示状態。 */
export type LandmarkTrophyDisplayState = 'dim' | 'grayscale' | 'color';

/** 過半数の境界。50%ちょうどは減光のままとする。 */
const MAJORITY_RATIO = 0.5;

/**
 * 到達率からトロフィーの表示状態を解決する。
 *
 * シルエット(tintColor)は使わない。スポットトロフィーは円の内側が全面不透明なため、
 * tintColorでは単色の丸になりどのパックか判別できなくなる。
 * 減光した白黒 → 白黒 → フルカラーの3段階なら、円形の絵柄でも進行が読み取れる。
 */
export function resolveLandmarkTrophyDisplayState(ratio: number): LandmarkTrophyDisplayState {
  if (!Number.isFinite(ratio) || ratio <= MAJORITY_RATIO) {
    return 'dim';
  }

  return ratio >= 1 ? 'color' : 'grayscale';
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npm test -- landmarkTrophyDisplayState`
Expected: PASS（5件）

- [ ] **Step 5: プログレスバーの失敗するテストを書く**

`src/ui/components/__tests__/AppProgressBar.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react-native';

import { AppProgressBar } from '@/ui/components/AppProgressBar';
import { createStyles } from '@/ui/appStyles';
import { getTheme } from '@/theme/theme';

/** テスト用のライトテーマとスタイル。 */
const theme = getTheme('light');
const styles = createStyles(theme);

describe('汎用プログレスバー AppProgressBar', () => {
  it('割合に応じた幅で塗りを描画する', () => {
    render(<AppProgressBar ratio={0.75} styles={styles} theme={theme} accessibilityLabel="日本三名瀑の進捗" />);

    // 進捗バーは accessibilityValue で割合を公開する
    const bar = screen.getByLabelText('日本三名瀑の進捗');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 75 });
  });

  it('範囲外の割合は0〜1へ丸める', () => {
    render(<AppProgressBar ratio={1.4} styles={styles} theme={theme} accessibilityLabel="進捗" />);

    expect(screen.getByLabelText('進捗').props.accessibilityValue.now).toBe(100);
  });

  it('不正な割合は0として扱う', () => {
    render(<AppProgressBar ratio={Number.NaN} styles={styles} theme={theme} accessibilityLabel="進捗" />);

    expect(screen.getByLabelText('進捗').props.accessibilityValue.now).toBe(0);
  });
});
```

`getTheme` の正確な名前は `src/theme/theme.ts` を読んで合わせること（`createStyles` の引数として使える形にする）。

- [ ] **Step 6: テストを実行して失敗を確認する**

Run: `npm test -- AppProgressBar`
Expected: FAIL

- [ ] **Step 7: プログレスバーを実装する**

`src/ui/components/AppProgressBar.tsx`:

```typescript
import { View } from 'react-native';

import type { AppTheme } from '@/theme/theme';
import type { AppStyles } from '@/ui/appStyles';

export type AppProgressBarProps = {
  /** 進捗の割合。0〜1の範囲外は丸める。 */
  ratio: number;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** スクリーンリーダー向けのラベル。 */
  accessibilityLabel: string;
};

/**
 * 割合だけを受け取る汎用プログレスバー。
 *
 * 呼び出し側の型に依存させない。スポット実績は分数、将来の高速道路走破実績は
 * パーセントというようにラベル表記が異なるため、表記は呼び出し側が決める。
 */
export function AppProgressBar({ ratio, styles, theme, accessibilityLabel }: AppProgressBarProps) {
  const clampedRatio = Number.isFinite(ratio) ? Math.min(Math.max(ratio, 0), 1) : 0;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clampedRatio * 100) }}
      style={styles.appProgressBarTrack}
    >
      <View style={[styles.appProgressBarFill, { width: `${clampedRatio * 100}%`, backgroundColor: theme.colors.accent }]} />
    </View>
  );
}
```

`theme.colors.accent` は `src/theme/theme.ts` に存在するアクセント色のキー名へ合わせること。存在しない場合は既存のプライマリ色を使う。

`src/ui/styles/commonStyles.ts` へスタイルを追加する:

```typescript
  appProgressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.border,
    overflow: 'hidden',
  },
  appProgressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
```

- [ ] **Step 8: テストを実行して成功を確認する**

Run: `npm test -- AppProgressBar`
Expected: PASS（3件）

- [ ] **Step 9: AppListItem に footer スロットを追加する**

`src/ui/components/AppListItem.tsx`:

```typescript
  /** タイトル・サブタイトルの下に表示する追加要素。進捗バーなどを差す汎用スロット。 */
  footer?: ReactNode;
```

`appListItemTextColumn` の中、`detail` の描画直後へ追加する:

```typescript
        {footer ? <View style={styles.appListItemFooter}>{footer}</View> : null}
```

`src/ui/styles/commonStyles.ts` へ:

```typescript
  appListItemFooter: {
    marginTop: 8,
  },
```

- [ ] **Step 10: 型チェック・テスト・lintを通してコミット**

```bash
npm run typecheck && npm test && npm run lint
git add src/ui src/features/landmarks
git commit -m "feat(ui): 汎用プログレスバーとリスト行のfooterスロットを追加"
```

---

## Task 8: 実績画面のスタック化とスポットセクション

**Files:**

- Delete: `src/app/achievements.tsx`
- Create: `src/app/achievements/_layout.tsx`
- Create: `src/app/achievements/index.tsx`
- Modify: `src/ui/components/AchievementListScreen.tsx`
- Modify: `src/ui/pathnameToScreenMode.ts`
- Test: `src/ui/pathnameToScreenMode` の既存テストへ追記
- Test: `src/ui/components/__tests__/AchievementListScreen.test.tsx`

**Interfaces:**

- Consumes: Task 5・7
- Produces:
  - `LandmarkPackListItem = { pack: LandmarkPack; visitedCount: number; totalCount: number; isLocked: boolean }`
  - `AchievementListScreenProps` に `landmarkPackItems: LandmarkPackListItem[]` / `isPlusActive: boolean` / `onSelectLandmarkPack: (packId: string) => void` / `onRequestPremium: () => void`
  - `pathnameToAchievementsSentryScreenName(pathname: string): string`

- [ ] **Step 1: ルートをディレクトリ化する**

```bash
mkdir -p src/app/achievements
git mv src/app/achievements.tsx src/app/achievements/index.tsx
```

`src/app/achievements/_layout.tsx` を作る（`src/app/daily-logs/_layout.tsx` と同じ構造）:

```typescript
import { Stack } from 'expo-router';

/**
 * 実績スタックのレイアウト。
 *
 * 子ルート(index / [packId])に slide_from_right アニメーションと
 * iOS スワイプバックを適用する。
 */
export default function AchievementsLayout(): React.ReactElement {
  return (
    <Stack
      screenOptions={{
        animation: 'slide_from_right',
        gestureEnabled: true,
        headerShown: false,
      }}
    />
  );
}
```

- [ ] **Step 2: Sentry 画面名マッパーの失敗するテストを書く**

`src/ui/__tests__/pathnameToScreenMode.test.ts`（既存ファイルへ追記。無ければ新規作成）:

```typescript
import { pathnameToAchievementsSentryScreenName, pathnameToScreenMode } from '@/ui/pathnameToScreenMode';

describe('実績スタックのSentry画面名', () => {
  it('実績一覧は Achievements:AchievementList を返す', () => {
    expect(pathnameToAchievementsSentryScreenName('/achievements')).toBe('Achievements:AchievementList');
  });

  it('パック詳細は Achievements:LandmarkPackDetail を返す', () => {
    expect(pathnameToAchievementsSentryScreenName('/achievements/01a0c450-6c00-7000-8000-000000000001')).toBe(
      'Achievements:LandmarkPackDetail',
    );
  });

  it('パック詳細でも ScreenMode は achievements のままになる', () => {
    expect(pathnameToScreenMode('/achievements/01a0c450-6c00-7000-8000-000000000001')).toBe('achievements');
  });
});
```

- [ ] **Step 3: テストを実行して失敗を確認する**

Run: `npm test -- pathnameToScreenMode`
Expected: FAIL

- [ ] **Step 4: マッパーを実装する**

`src/ui/pathnameToScreenMode.ts` へ追加する:

```typescript
/**
 * expo-router のパス名から Sentry 用の実績系子画面名を解決する。
 *
 * 実績スタック内の子ルートは `Achievements:ルート名` の形式で Sentry へ送る。
 */
export function pathnameToAchievementsSentryScreenName(pathname: string): string {
  if (!pathname.startsWith('/achievements')) {
    return 'Achievements:AchievementList';
  }

  const after = pathname.slice('/achievements'.length);

  if (after === '' || after === '/') {
    return 'Achievements:AchievementList';
  }

  // /achievements/[packId] → Achievements:LandmarkPackDetail
  return 'Achievements:LandmarkPackDetail';
}
```

`src/app/_layout.tsx` の Sentry 画面名解決で、`/achievements` 配下のときにこの関数を使うよう分岐を追加する。既存の `pathnameToSettingsSentryScreenName` / `pathnameToDailyLogsSentryScreenName` の呼び分けと同じ場所に足すこと。

- [ ] **Step 5: 実績画面のスポットセクションの失敗するテストを書く**

`src/ui/components/__tests__/AchievementListScreen.test.tsx`（新規。既存があれば describe 追加）:

```typescript
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { AchievementListScreen } from '@/ui/components/AchievementListScreen';
import { createStyles } from '@/ui/appStyles';
import { getTheme } from '@/theme/theme';

jest.mock('@expo/vector-icons', () => ({
  Feather: require('react-native').Text,
}));

jest.mock('react-native-color-matrix-image-filters', () => {
  const { View } = require('react-native');
  return { Grayscale: View };
});

const theme = getTheme('light');
const styles = createStyles(theme);

/** テスト用のパック行。 */
const fallsPackItem = {
  pack: {
    id: '01a0c450-6c00-7000-8000-000000000001',
    name: '日本三名瀑',
    description: '日本を代表する3つの名瀑',
    trophyImage: 1,
    trophyImageUri: null,
    sortOrder: 100,
  },
  visitedCount: 2,
  totalCount: 3,
  isLocked: false,
};

describe('実績画面のスポットセクション', () => {
  it('パック名・説明・分数の進捗を表示する', () => {
    render(
      <AchievementListScreen
        items={[]}
        landmarkPackItems={[fallsPackItem]}
        isPlusActive
        styles={styles}
        theme={theme}
        onBackToMap={jest.fn()}
        onSelectAchievement={jest.fn()}
        onSelectLandmarkPack={jest.fn()}
        onRequestPremium={jest.fn()}
      />,
    );

    expect(screen.getByText('日本三名瀑')).toBeTruthy();
    expect(screen.getByText('日本を代表する3つの名瀑')).toBeTruthy();
    expect(screen.getByText('2/3')).toBeTruthy();
  });

  it('パック行を押すと詳細を開く', () => {
    const onSelect = jest.fn();
    render(
      <AchievementListScreen
        items={[]}
        landmarkPackItems={[fallsPackItem]}
        isPlusActive
        styles={styles}
        theme={theme}
        onBackToMap={jest.fn()}
        onSelectAchievement={jest.fn()}
        onSelectLandmarkPack={onSelect}
        onRequestPremium={jest.fn()}
      />,
    );

    act(() => {
      fireEvent.press(screen.getByLabelText('日本三名瀑の詳細を開く'));
    });

    expect(onSelect).toHaveBeenCalledWith('01a0c450-6c00-7000-8000-000000000001');
  });

  it('Plus未加入では進捗を表示せずPaywallへ誘導する', () => {
    const onRequestPremium = jest.fn();
    render(
      <AchievementListScreen
        items={[]}
        landmarkPackItems={[{ ...fallsPackItem, visitedCount: 0, isLocked: true }]}
        isPlusActive={false}
        styles={styles}
        theme={theme}
        onBackToMap={jest.fn()}
        onSelectAchievement={jest.fn()}
        onSelectLandmarkPack={jest.fn()}
        onRequestPremium={onRequestPremium}
      />,
    );

    expect(screen.queryByText('0/3')).toBeNull();

    act(() => {
      fireEvent.press(screen.getByLabelText('日本三名瀑はStrollia Plus限定です'));
    });

    expect(onRequestPremium).toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: テストを実行して失敗を確認する**

Run: `npm test -- AchievementListScreen`
Expected: FAIL

- [ ] **Step 7: 実績画面へスポットセクションを追加する**

`src/ui/components/AchievementListScreen.tsx`:

1. props を拡張する

```typescript
/** 実績画面のスポットセクションに表示するパック行。 */
export type LandmarkPackListItem = {
  /** パック定義。 */
  pack: LandmarkPack;
  /** 到達済みスポット数。 */
  visitedCount: number;
  /** 完走に必要なスポット数。 */
  totalCount: number;
  /** Plus未加入で施錠されているか。 */
  isLocked: boolean;
};
```

`AchievementListScreenProps` へ `landmarkPackItems: LandmarkPackListItem[]`、`isPlusActive: boolean`、
`onSelectLandmarkPack: (packId: string) => void`、`onRequestPremium: () => void` を追加する。

2. 既存グリッドの後ろへ `ScreenSection title="スポット (Strollia Plus)"` を追加し、`AppListItem` を並べる

| 表示要素           | 実装                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| 行タイトル         | `title={item.pack.name}`。`prominent` は指定しない（既存のリストタイトルに揃える）                                             |
| 説明               | `subtitle={item.pack.description}`                                                                                             |
| 進捗               | 施錠時は表示しない。非施錠時は `footer` へ `<Text>{visitedCount}/{totalCount}</Text>` と `AppProgressBar` を横並びで置く       |
| トロフィー         | `leading` に画像。`resolveLandmarkTrophyDisplayState(visitedCount / totalCount)` で `dim` / `grayscale` / `color` を切り替える |
| 施錠               | `isLocked` なら `leading` に鍵アイコン（`Feather name="lock"`）を重ね、`onPress={onRequestPremium}` にする                     |
| accessibilityLabel | 非施錠は `${pack.name}の詳細を開く`、施錠は `${pack.name}はStrollia Plus限定です`                                              |

`dim` は `Grayscale` でラップしたうえで `style={{ opacity: 0.4 }}` を当てる。`grayscale` は `Grayscale` のみ。
`Grayscale` はネイティブフィルタの制約で数値の画像サイズを要求するため、既存グリッドと同じく
`useWindowDimensions()` から算出した数値を `width` / `height` に渡す。

3. Plus未加入時は `landmarkPackItems` の先頭1件だけを描画し、その下へ誘導文を置く

```typescript
{!isPlusActive ? <Text style={styles.screenSectionNote}>Strollia Plus なら、今後追加されるスポットパックもすべて集められます</Text> : null}
```

文言は `src/ui/appText.ts` へ定数として追加すること。

- [ ] **Step 8: ルートファイルを更新する**

`src/app/achievements/index.tsx` で `useAppState()` から新しい props を取得して渡す。
`landmarkPackItems` / `isPlusActive` / `onSelectLandmarkPack` / `onRequestPremium` は Task 10 で
`AppStateProvider` へ追加するため、この時点では型エラーになる。Task 10 と合わせて解消する。

- [ ] **Step 9: テストを実行して成功を確認する**

Run: `npm test -- AchievementListScreen pathnameToScreenMode`
Expected: PASS

- [ ] **Step 10: コミット**

```bash
npm run typecheck && npm test && npm run lint
git add src/app src/ui
git commit -m "feat(achievements): 実績画面をスタック化しスポットセクションを追加"
```

Task 10 まで型エラーが残る場合は、このコミットを Task 10 の後にまとめてもよい。

---

## Task 9: パック詳細画面

**Files:**

- Create: `src/app/achievements/[packId].tsx`
- Create: `src/ui/components/LandmarkPackScreen.tsx`
- Test: `src/ui/components/__tests__/LandmarkPackScreen.test.tsx`

**Interfaces:**

- Consumes: Task 1・2・7
- Produces:
  - `LandmarkSpotListItem = { spot: LandmarkSpot; visitedLocalDate: string | null }`
  - `LandmarkPackScreenProps = { pack: LandmarkPack; spotItems: LandmarkSpotListItem[]; styles: AppStyles; theme: AppTheme; onBack: () => void; onSelectVisitedSpot: (localDate: string) => void; onSelectUnvisitedSpot: (spot: LandmarkSpot) => void }`

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/components/__tests__/LandmarkPackScreen.test.tsx`:

```typescript
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { LandmarkPackScreen } from '@/ui/components/LandmarkPackScreen';
import { createStyles } from '@/ui/appStyles';
import { getTheme } from '@/theme/theme';

jest.mock('@expo/vector-icons', () => ({
  Feather: require('react-native').Text,
}));

const theme = getTheme('light');
const styles = createStyles(theme);

const pack = {
  id: '01a0c450-6c00-7000-8000-000000000001',
  name: '日本三名瀑',
  description: '日本を代表する3つの名瀑',
  trophyImage: 1,
  trophyImageUri: null,
  sortOrder: 100,
};

const spotItems = [
  {
    spot: {
      id: '01a0c450-6c00-7000-8000-000000000101',
      name: '華厳の滝',
      prefecture: 'TOCHIGI',
      latitude: 36.737917,
      longitude: 139.501972,
      radiusMeters: 200,
      dwellSeconds: 180,
      packs: [{ packId: pack.id, order: 1 }],
    },
    visitedLocalDate: '2026-04-12',
  },
  {
    spot: {
      id: '01a0c450-6c00-7000-8000-000000000102',
      name: '那智の滝',
      prefecture: 'WAKAYAMA',
      latitude: 33.675278,
      longitude: 135.8875,
      radiusMeters: 150,
      dwellSeconds: 180,
      packs: [{ packId: pack.id, order: 2 }],
    },
    visitedLocalDate: null,
  },
];

describe('パック詳細画面 LandmarkPackScreen', () => {
  it('ヘッダーに進捗を表示する', () => {
    render(
      <LandmarkPackScreen
        pack={pack}
        spotItems={spotItems}
        styles={styles}
        theme={theme}
        onBack={jest.fn()}
        onSelectVisitedSpot={jest.fn()}
        onSelectUnvisitedSpot={jest.fn()}
      />,
    );

    expect(screen.getByText('1/2')).toBeTruthy();
  });

  it('到達済みの行を押すとその日の記録へ遷移する', () => {
    const onSelectVisitedSpot = jest.fn();
    render(
      <LandmarkPackScreen
        pack={pack}
        spotItems={spotItems}
        styles={styles}
        theme={theme}
        onBack={jest.fn()}
        onSelectVisitedSpot={onSelectVisitedSpot}
        onSelectUnvisitedSpot={jest.fn()}
      />,
    );

    act(() => {
      fireEvent.press(screen.getByLabelText('華厳の滝の記録を開く'));
    });

    expect(onSelectVisitedSpot).toHaveBeenCalledWith('2026-04-12');
  });

  it('未到達の行を押すと地図で位置を表示する', () => {
    const onSelectUnvisitedSpot = jest.fn();
    render(
      <LandmarkPackScreen
        pack={pack}
        spotItems={spotItems}
        styles={styles}
        theme={theme}
        onBack={jest.fn()}
        onSelectVisitedSpot={jest.fn()}
        onSelectUnvisitedSpot={onSelectUnvisitedSpot}
      />,
    );

    act(() => {
      fireEvent.press(screen.getByLabelText('那智の滝を地図で見る'));
    });

    expect(onSelectUnvisitedSpot).toHaveBeenCalledWith(spotItems[1].spot);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- LandmarkPackScreen`
Expected: FAIL

- [ ] **Step 3: 画面を実装する**

`src/ui/components/LandmarkPackScreen.tsx`。構成は以下。

| 要素               | 実装                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| ヘッダー           | `AppScreenHeader` に `backLabel="実績"`、`title={pack.name}`、`subtitle={`${visitedCount}/${spotItems.length}`}` |
| 行                 | `AppListItem`。`title={spot.name}`、`subtitle` に都道府県の日本語名、`detail` に到達日（未到達は未指定）         |
| 行の先頭           | 到達済みは `Feather name="check"`、未到達は `Feather name="circle"`                                              |
| `retired`          | `subtitle` へ「現存せず」を併記し、押下時は未到達と同じ扱いにする                                                |
| タップ             | 到達済みは `onSelectVisitedSpot(visitedLocalDate)`、未到達は `onSelectUnvisitedSpot(spot)`                       |
| accessibilityLabel | 到達済みは `${spot.name}の記録を開く`、未到達は `${spot.name}を地図で見る`                                       |

都道府県の enum（`TOCHIGI`）から日本語名（栃木県）への変換表は
`src/features/landmarks/landmarkPrefectureLabel.ts` を新設して置き、単体テストを添える。

- [ ] **Step 4: ルートファイルを作る**

`src/app/achievements/[packId].tsx`:

```typescript
import { useLocalSearchParams } from 'expo-router';

import { LandmarkPackScreen } from '@/ui/components/LandmarkPackScreen';
import { useAppState } from '@/ui/state/AppStateProvider';

/**
 * スポットパック詳細ルート(/achievements/[packId])。
 *
 * AppStateProvider から到達状況を取得し LandmarkPackScreen を描画する。
 */
export default function LandmarkPackRoute(): React.ReactElement | null {
  const s = useAppState();
  const { packId } = useLocalSearchParams<{ packId: string }>();
  const detail = s.getLandmarkPackDetail(packId);

  if (!detail) {
    return null;
  }

  return (
    <LandmarkPackScreen
      pack={detail.pack}
      spotItems={detail.spotItems}
      styles={s.styles}
      theme={s.theme}
      onBack={() => s.closeLandmarkPack()}
      onSelectVisitedSpot={(localDate) => s.openDailyLogDetail(localDate)}
      onSelectUnvisitedSpot={(spot) => s.openMapAtLandmarkSpot(spot)}
    />
  );
}
```

`openDailyLogDetail` の正確な名前と引数は `AppStateProvider` を読んで合わせること。

- [ ] **Step 5: テストを実行して成功を確認する**

Run: `npm test -- LandmarkPackScreen`
Expected: PASS（3件）

- [ ] **Step 6: コミット**

```bash
npm run typecheck && npm test && npm run lint
git add src/app src/ui src/features/landmarks
git commit -m "feat(achievements): スポットパック詳細画面を追加"
```

---

## Task 10: AppStateProvider 結線と仕上げ

**Files:**

- Modify: `src/ui/state/AppStateProvider.tsx`
- Modify: `src/app/_layout.tsx`（`useRouterNavigator` へ遷移を追加）
- Create: `src/ui/hooks/useLandmarkPackState.ts`
- Test: `src/ui/hooks/__tests__/useLandmarkPackState.test.tsx`
- Modify: `docs/achievements.md` / `docs/plus-features.md` / `docs/todo.md`
- Modify: `.ai/context/architecture.md`（`src/features/landmarks/` の行を追加）

**Interfaces:**

- Consumes: Task 1〜9 のすべて
- Produces:
  - `AppStateContextValue` に `landmarkPackItems` / `getLandmarkPackDetail` / `openLandmarkPack` / `closeLandmarkPack` / `openMapAtLandmarkSpot` / `reloadLandmarkState`

- [ ] **Step 1: フックの失敗するテストを書く**

`src/ui/hooks/__tests__/useLandmarkPackState.test.tsx`:

```typescript
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useLandmarkPackState } from '@/ui/hooks/useLandmarkPackState';
import { getLandmarkSpotVisits } from '@/features/landmarks/landmarkVisitRepository';

jest.mock('@/features/landmarks/landmarkVisitRepository', () => ({
  getLandmarkSpotVisits: jest.fn(),
}));

jest.mock('react-native', () => ({
  Image: { resolveAssetSource: () => ({ uri: 'file://trophy.png' }) },
}));

const FALLS_PACK_ID = '01a0c450-6c00-7000-8000-000000000001';
const KEGON_ID = '01a0c450-6c00-7000-8000-000000000101';

describe('スポットパック状態 useLandmarkPackState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getLandmarkSpotVisits as jest.Mock).mockResolvedValue([
      { spotId: KEGON_ID, visitedAt: '2026-04-12T02:00:00.000Z', visitedLocalDate: '2026-04-12', locationPointId: 1 },
    ]);
  });

  it('Plus有効なら到達数つきのパック一覧を返す', async () => {
    const { result } = renderHook(() => useLandmarkPackState(true));

    await waitFor(() => {
      expect(result.current.landmarkPackItems[0]?.visitedCount).toBe(1);
    });
    expect(result.current.landmarkPackItems[0]?.isLocked).toBe(false);
  });

  it('Plus無効なら先頭1件だけを施錠状態で返す', async () => {
    const { result } = renderHook(() => useLandmarkPackState(false));

    await waitFor(() => {
      expect(result.current.landmarkPackItems.length).toBe(1);
    });
    expect(result.current.landmarkPackItems[0]?.isLocked).toBe(true);
    expect(result.current.landmarkPackItems[0]?.visitedCount).toBe(0);
  });

  it('パック詳細に到達日を含める', async () => {
    const { result } = renderHook(() => useLandmarkPackState(true));

    await waitFor(() => {
      expect(result.current.getLandmarkPackDetail(FALLS_PACK_ID)).not.toBeNull();
    });

    const detail = result.current.getLandmarkPackDetail(FALLS_PACK_ID);
    expect(detail?.spotItems[0]?.visitedLocalDate).toBe('2026-04-12');
    expect(detail?.spotItems[1]?.visitedLocalDate).toBeNull();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- useLandmarkPackState`
Expected: FAIL

- [ ] **Step 3: フックを実装する**

`src/ui/hooks/useLandmarkPackState.ts`。仕様は以下。

- `getLandmarkSpotVisits()` を読み、`visitedLocalDate` を `spotId` で引けるMapにする
- `resolveLandmarkPackProgress()` で進捗を求め、`LANDMARK_PACKS` と結合して `landmarkPackItems` を作る
- `isPlusActive` が false なら **先頭1件だけ**を返し、`isLocked: true` かつ `visitedCount: 0` にする（検知していないため進捗を出さない）
- `getLandmarkPackDetail(packId)` は `getActiveSpotsForPack(packId)` の順序で `spotItems` を作る
- `reloadLandmarkState()` で再読み込みできるようにする

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npm test -- useLandmarkPackState`
Expected: PASS（3件）

- [ ] **Step 5: AppStateProvider とナビゲーションを結線する**

1. `AppStateProvider` で `useLandmarkPackState(premiumAccessState.isPlusActive)` を呼び、戻り値を context へ載せる
2. `openLandmarkPack(packId)` / `closeLandmarkPack()` / `openMapAtLandmarkSpot(spot)` を実装する
   - `openMapAtLandmarkSpot` は既存の地図復帰処理（`mapFollowState.prepareMapRegionRestore()` と `animateToRegion`）を参考に、
     スポット座標を中心にした region へ移動させる。追従は OFF にする（`AGENTS.md` 10.3）
3. `src/app/_layout.tsx` の `useRouterNavigator` へ追加する

```typescript
    openLandmarkPack: (packId: string) => router.push(`/achievements/${packId}`),
    closeLandmarkPack: () => router.back(),
```

4. 実績が解除されたあと（`processAchievementsForSavedPoint` の後）に `reloadLandmarkState()` が呼ばれるよう、
   既存の実績再読み込み経路へ相乗りさせる

- [ ] **Step 6: ドキュメントを更新する**

| ファイル                      | 追記内容                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `docs/achievements.md`        | スポットパック完走実績の節を追加し、設計書へリンクする                         |
| `docs/plus-features.md`       | Plus限定機能としてスポット実績を追加する                                       |
| `docs/todo.md`                | 残り10パックのデータ作成・トロフィー画像・ヘルパーツールを残作業として記載する |
| `.ai/context/architecture.md` | ディレクトリマップへ `src/features/landmarks/` の行を追加する                  |

- [ ] **Step 7: 全体の検証**

```bash
npm run generate:landmarks
npm run typecheck
npm test
npm run lint
npm run format:check
```

すべて成功すること。`npm run lint` は error 0 が合格条件。

- [ ] **Step 8: コミット**

```bash
git add .
git commit -m "feat(achievements): スポット実績の状態管理とナビゲーションを結線"
```

- [ ] **Step 9: PR を作成する**

```bash
git push -u origin claude/landmark-spot-achievements
```

PR は `develop` をベースに Open PR として作成する。description は日本語で、変更内容・理由・影響範囲・検証結果を含める。

---

## Self-Review

**Spec coverage:**

| 設計書の節                          | 実装タスク                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| 4. 課金方針（Plus限定・解約時保持） | Task 4（検知ゲート）、Task 10（UI施錠）。データ削除は行わないため実装不要          |
| 5. データモデル                     | Task 1                                                                             |
| 6. DBスキーマ                       | Task 2                                                                             |
| 7. 到達判定                         | Task 3・4                                                                          |
| 8. パック完走実績                   | Task 5、通知は Task 6                                                              |
| 9. UI                               | Task 7・8・9・10                                                                   |
| 10. 初回ラインナップ                | Task 1（パイロットは三名瀑のみ。残り10パックは Task 10 Step 6 で残作業として記載） |
| 11. テスト方針                      | 各タスクのテストステップ                                                           |
| 12. 将来の拡張                      | `AppProgressBar` を汎用にすること（Task 7）で担保                                  |

**既知の制約:**

- 本計画は日本三名瀑1パックのパイロット。設計書 §10 の残り10パック・61スポットのデータ作成は含まない
- トロフィー画像は三名瀑の1枚のみ配置済み。残り10枚は未作成
