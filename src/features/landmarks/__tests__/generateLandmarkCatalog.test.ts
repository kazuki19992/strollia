import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** リポジトリルート。生成スクリプトと実スキーマの参照に使う。 */
const ROOT = resolve(__dirname, '../../../..');

const PACK_ID = '01a0c450-6c00-7000-8000-0000000000a1';
const SPOT_A = '01a0c450-6c00-7000-8000-0000000000b1';
const SPOT_B = '01a0c450-6c00-7000-8000-0000000000b2';
const AREA_1 = '01a0c450-6c00-7000-8000-0000000000c1';
const AREA_2 = '01a0c450-6c00-7000-8000-0000000000c2';

/** 最小のパックJSON。 */
const PACKS = [
  {
    id: PACK_ID,
    name: 'テストパック',
    description: '説明',
    trophyImage: 'japan-falls-3.png',
    trophyIcon: 'japan-falls-3',
    sortOrder: 1,
    isFree: true,
  },
];

type SpotJson = Record<string, unknown>;

/** 円1つのスポットJSONを作る。地点が1件の areas を持ち、地点の id・name は省略する。 */
function singleSpot(id: string, name: string, latitude: number, order = 1): SpotJson {
  return {
    id,
    name,
    prefectures: ['TOKYO'],
    areas: [{ latitude, longitude: 139.7, radiusMeters: 100, dwellSeconds: 60 }],
    packs: [{ packId: PACK_ID, order }],
  };
}

/** 複数地点スポットJSONを作る。地点は北へ約1km(緯度0.009度)離す。 */
function multiSpot(id: string, name: string, areaLatitudes: [number, number], radiusMeters = 100): SpotJson {
  return {
    id,
    name,
    prefectures: ['TOKYO'],
    areas: [
      { id: AREA_1, name: '地点1', latitude: areaLatitudes[0], longitude: 139.7, radiusMeters, dwellSeconds: 60 },
      { id: AREA_2, name: '地点2', latitude: areaLatitudes[1], longitude: 139.7, radiusMeters, dwellSeconds: 120 },
    ],
    packs: [{ packId: PACK_ID, order: 1 }],
  };
}

/** 一時ディレクトリへマスタを書いて生成スクリプトを実行し、結果と生成物を返す。 */
function runGenerator(spots: SpotJson[]) {
  const dir = mkdtempSync(join(tmpdir(), 'landmark-catalog-'));
  try {
    copyFileSync(join(ROOT, 'data/landmarks/landmarkSpots.schema.json'), join(dir, 'landmarkSpots.schema.json'));
    copyFileSync(join(ROOT, 'data/landmarks/landmarkPacks.schema.json'), join(dir, 'landmarkPacks.schema.json'));
    writeFileSync(join(dir, 'landmarkPacks.json'), JSON.stringify(PACKS));
    writeFileSync(join(dir, 'landmarkSpots.json'), JSON.stringify(spots));
    const output = join(dir, 'out.generated.ts');
    const result = spawnSync('node', ['scripts/generate-landmark-catalog.mjs'], {
      cwd: ROOT,
      env: { ...process.env, LANDMARK_DATA_DIR: dir, LANDMARK_CATALOG_OUTPUT: output },
      encoding: 'utf8',
    });
    let generated = '';
    try {
      generated = readFileSync(output, 'utf8');
    } catch {
      // 失敗時は生成物が無い
    }
    return { status: result.status, stderr: result.stderr, generated };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('スポットカタログ生成スクリプト', () => {
  it('areas を2件持つスポットは成功し、生成物に isMultiArea: true と2件の areas を出力する', () => {
    const result = runGenerator([multiSpot(SPOT_A, '複数スポット', [35.0, 35.009])]);

    expect(result.status).toBe(0);
    expect(result.generated).toContain('isMultiArea: true');
    expect(result.generated).toContain(AREA_1);
    expect(result.generated).toContain(AREA_2);
  });

  it('円1つのスポットは地点ID・地点名がスポットと同じ1件の areas に正規化される', () => {
    const result = runGenerator([singleSpot(SPOT_A, '単一スポット', 35.0)]);

    expect(result.status).toBe(0);
    expect(result.generated).toContain('isMultiArea: false');
    expect(result.generated).toContain(`id: "${SPOT_A}",\n        name: "単一スポット",`);
    expect(result.generated.split(SPOT_A).length - 1).toBe(2);
  });

  it('スポット直下に latitude などの判定値を持つとエラーになる', () => {
    const spot = { ...singleSpot(SPOT_A, '単一スポット', 35.0), latitude: 35.0 };

    expect(runGenerator([spot]).status).not.toBe(0);
  });

  it('areas を持たないスポットはエラーになる', () => {
    const spot = singleSpot(SPOT_A, '単一スポット', 35.0);
    delete spot.areas;

    expect(runGenerator([spot]).status).not.toBe(0);
  });

  it('areas が0件のスポットはエラーになる', () => {
    const spot = singleSpot(SPOT_A, '単一スポット', 35.0);
    spot.areas = [];

    expect(runGenerator([spot]).status).not.toBe(0);
  });

  it('地点が1件のスポットで地点に id を書くとエラーになる', () => {
    const spot = singleSpot(SPOT_A, '単一スポット', 35.0);
    spot.areas = [{ ...(spot.areas as SpotJson[])[0], id: AREA_1 }];

    const result = runGenerator([spot]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('単一スポット');
  });

  it('地点が1件のスポットで地点に name を書くとエラーになる', () => {
    const spot = singleSpot(SPOT_A, '単一スポット', 35.0);
    spot.areas = [{ ...(spot.areas as SpotJson[])[0], name: '地点名' }];

    expect(runGenerator([spot]).status).not.toBe(0);
  });

  it('地点が2件以上のスポットで id の無い地点があるとエラーになる', () => {
    const spot = multiSpot(SPOT_A, '複数スポット', [35.0, 35.009]);
    const [first, second] = spot.areas as SpotJson[];
    const { id: _omittedId, ...secondWithoutId } = second;
    spot.areas = [first, secondWithoutId];

    const result = runGenerator([spot]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('複数スポット');
  });

  it('地点が2件以上のスポットで name の無い地点があるとエラーになる', () => {
    const spot = multiSpot(SPOT_A, '複数スポット', [35.0, 35.009]);
    const [first, second] = spot.areas as SpotJson[];
    const { name: _omittedName, ...secondWithoutName } = second;
    spot.areas = [first, secondWithoutName];

    expect(runGenerator([spot]).status).not.toBe(0);
  });

  it('地点IDが他のスポットIDと重複するとエラーになる', () => {
    const result = runGenerator([multiSpot(SPOT_A, '複数スポット', [35.0, 35.009]), singleSpot(AREA_1, '別スポット', 36.0, 2)]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(AREA_1);
  });

  it('地点の円が別スポットの円と重なるとエラーになる', () => {
    const result = runGenerator([singleSpot(SPOT_A, '単一スポット', 35.0), singleSpot(SPOT_B, '重なるスポット', 35.0005, 2)]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('単一スポット');
    expect(result.stderr).toContain('重なるスポット');
  });

  it('同じスポットの地点同士の円が重なるとエラーになる', () => {
    const result = runGenerator([multiSpot(SPOT_A, '複数スポット', [35.0, 35.0005])]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('地点1');
    expect(result.stderr).toContain('地点2');
  });
});
