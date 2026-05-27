# GPX Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GPX-only import from the Settings screen, preserving existing data on conflicts and refreshing local map/log state after import.

**Architecture:** Parse GPX XML into `NewLocationPoint[]` in a pure importer module, persist imported points through an import repository that skips existing points and updates `daily_logs` plus `visited_cells`, and keep file picking/reading in a small service. `SettingsScreen` remains presentational; `App.tsx` owns the import flow and user alerts.

**Tech Stack:** Expo React Native, TypeScript, Jest, `expo-document-picker`, `expo-file-system/legacy`, `fast-xml-parser`, `expo-sqlite`.

---

## File Structure

- Create `src/features/import/gpxImporter.ts`: pure GPX string parser using `fast-xml-parser`.
- Create `src/features/import/importRepository.ts`: DB import persistence, conflict skip, `daily_logs` and `visited_cells` updates.
- Create `src/features/import/gpxImportService.ts`: document picker and file text reading.
- Create tests under `src/features/import/__tests__/`.
- Modify `src/db/database.ts`: create `import_history` table and import indexes if needed.
- Modify `src/app/components/SettingsScreen.tsx`: rename import prop and show GPX-only / existing-data-priority explanation.
- Modify `src/app/App.tsx`: replace import placeholder with GPX import flow.
- Modify docs: `docs/todo.md`, `docs/mvp.md`, `docs/data-storage.md`.

## Task 1: Add Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install dependencies**

Run:

```bash
npm install fast-xml-parser
npx expo install expo-document-picker
```

Expected: `package.json` contains `fast-xml-parser` and `expo-document-picker`; `package-lock.json` is updated.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: GPXインポート依存関係を追加"
```

## Task 2: GPX Parser

**Files:**
- Create: `src/features/import/gpxImporter.ts`
- Create: `src/features/import/__tests__/gpxImporter.test.ts`

- [ ] **Step 1: Write failing parser tests**

Create `src/features/import/__tests__/gpxImporter.test.ts`:

```typescript
import { parseGpxToLocationPoints } from '../gpxImporter';

describe('GPXインポート gpxImporter', () => {
  it('trkptからGPSポイントを作成する', () => {
    const points = parseGpxToLocationPoints(`<?xml version="1.0"?>
      <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
        <trk><trkseg>
          <trkpt lat="35.681236" lon="139.767125">
            <ele>12.5</ele>
            <time>2026-05-01T01:02:03.000Z</time>
          </trkpt>
        </trkseg></trk>
      </gpx>`);

    expect(points).toEqual([
      {
        recordedAt: '2026-05-01T01:02:03.000Z',
        localDate: '2026-05-01',
        latitude: 35.681236,
        longitude: 139.767125,
        altitude: 12.5,
        speed: null,
        heading: null,
        accuracy: null,
        altitudeAccuracy: null,
      },
    ]);
  });

  it('eleがないtrkptは高度nullとして扱う', () => {
    const points = parseGpxToLocationPoints(`<gpx><trk><trkseg>
      <trkpt lat="35" lon="139"><time>2026-05-01T00:00:00.000Z</time></trkpt>
    </trkseg></trk></gpx>`);

    expect(points[0].altitude).toBeNull();
  });

  it('timeがないtrkptと緯度経度が不正なtrkptはスキップする', () => {
    const points = parseGpxToLocationPoints(`<gpx><trk><trkseg>
      <trkpt lat="35" lon="139"></trkpt>
      <trkpt lat="abc" lon="139"><time>2026-05-01T00:00:00.000Z</time></trkpt>
      <trkpt lat="35.1" lon="139.1"><time>2026-05-01T00:01:00.000Z</time></trkpt>
    </trkseg></trk></gpx>`);

    expect(points).toHaveLength(1);
    expect(points[0].latitude).toBe(35.1);
  });

  it('名前空間prefix付きGPXもtrkptとして扱う', () => {
    const points = parseGpxToLocationPoints(`<gpx:gpx xmlns:gpx="http://www.topografix.com/GPX/1/1">
      <gpx:trk><gpx:trkseg>
        <gpx:trkpt lat="35" lon="139"><gpx:time>2026-05-01T00:00:00.000Z</gpx:time></gpx:trkpt>
      </gpx:trkseg></gpx:trk>
    </gpx:gpx>`);

    expect(points).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/features/import/__tests__/gpxImporter.test.ts
```

Expected: FAIL because `../gpxImporter` does not exist.

- [ ] **Step 3: Implement parser**

Create `src/features/import/gpxImporter.ts` with:

```typescript
import { XMLParser } from 'fast-xml-parser';

import { NewLocationPoint } from '../../types/gps';
import { toLocalDate } from '../../utils/date';

type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
});

/** GPX文字列からStrolliaへ取り込めるGPSポイントを抽出する。 */
export function parseGpxToLocationPoints(gpx: string): NewLocationPoint[] {
  const parsed = parser.parse(gpx) as XmlNode;
  const trkpts = findNodesByName(parsed, 'trkpt');

  return trkpts.flatMap((trkpt) => toLocationPoint(trkpt));
}

function toLocationPoint(trkpt: XmlNode): NewLocationPoint[] {
  const latitude = toFiniteNumber(trkpt['@_lat']);
  const longitude = toFiniteNumber(trkpt['@_lon']);
  const time = getTextValue(trkpt.time);

  if (latitude == null || longitude == null || !time) {
    return [];
  }

  const recordedAt = new Date(time).toISOString();

  if (Number.isNaN(new Date(recordedAt).getTime())) {
    return [];
  }

  return [{
    recordedAt,
    localDate: toLocalDate(new Date(recordedAt)),
    latitude,
    longitude,
    altitude: toFiniteNumber(getTextValue(trkpt.ele)),
    speed: null,
    heading: null,
    accuracy: null,
    altitudeAccuracy: null,
  }];
}

function findNodesByName(value: unknown, name: string): XmlNode[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => findNodesByName(item, name));
  }

  if (!isXmlNode(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const current = key === name ? toArray(child).filter(isXmlNode) : [];
    return [...current, ...findNodesByName(child, name)];
  });
}

function isXmlNode(value: unknown): value is XmlNode {
  return typeof value === 'object' && value !== null;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function getTextValue(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  return null;
}

function toFiniteNumber(value: unknown): number | null {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : null;
  return numberValue != null && Number.isFinite(numberValue) ? numberValue : null;
}
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- src/features/import/__tests__/gpxImporter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/import/gpxImporter.ts src/features/import/__tests__/gpxImporter.test.ts
git commit -m "feat(import): GPXパーサを追加"
```

## Task 3: Import Repository

**Files:**
- Create: `src/features/import/importRepository.ts`
- Create: `src/features/import/__tests__/importRepository.test.ts`
- Modify: `src/db/database.ts`

- [ ] **Step 1: Write failing repository tests**

Create `src/features/import/__tests__/importRepository.test.ts`:

```typescript
import { db } from '../../../db/database';
import { importLocationPointsFromGpx } from '../importRepository';

jest.mock('../../../db/database', () => ({
  db: {
    getFirstAsync: jest.fn(),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 101 }),
    withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
  },
}));

jest.mock('../../location/visitedCellRepository', () => ({
  upsertVisitedCells: jest.fn(),
}));

jest.mock('../../location/grid/gridInterpolation', () => ({
  getVisitedCellsForLocationPoint: jest.fn(() => [{ cellId: '100:1:1', cellSizeMeters: 100, x: 1, y: 1 }]),
}));

const point = {
  recordedAt: '2026-05-01T00:00:00.000Z',
  localDate: '2026-05-01',
  latitude: 35,
  longitude: 139,
  altitude: null,
  speed: null,
  heading: null,
  accuracy: null,
  altitudeAccuracy: null,
};

describe('GPXインポート保存 importRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('既存データと同じ時刻・座標の点は既存データを優先してスキップする', async () => {
    (db.getFirstAsync as jest.Mock).mockResolvedValue({ id: 1 });

    const result = await importLocationPointsFromGpx([point], 'walk.gpx');

    expect(result).toEqual({ importedPointCount: 0, skippedPointCount: 1 });
    expect(db.runAsync).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO location_points'), expect.anything());
  });

  it('重複しない点はgpx-importソースで保存し日別ログを更新する', async () => {
    (db.getFirstAsync as jest.Mock).mockResolvedValue(null);

    const result = await importLocationPointsFromGpx([point], 'walk.gpx');

    expect(result.importedPointCount).toBe(1);
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining("'gpx-import'"), expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything());
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO daily_logs'), expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything());
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO import_history'), 'gpx', 'walk.gpx', point.recordedAt, point.recordedAt, 1, 0, expect.any(String));
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/features/import/__tests__/importRepository.test.ts
```

Expected: FAIL because `../importRepository` does not exist.

- [ ] **Step 3: Add import history table**

Modify `src/db/database.ts` inside `initializeDatabase()`:

```sql
    CREATE TABLE IF NOT EXISTS import_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      format TEXT NOT NULL,
      file_name TEXT NOT NULL,
      range_from TEXT NULL,
      range_to TEXT NULL,
      imported_point_count INTEGER NOT NULL,
      skipped_point_count INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
```

- [ ] **Step 4: Implement repository**

Create `src/features/import/importRepository.ts` with:

```typescript
import { db } from '../../db/database';
import { NewLocationPoint } from '../../types/gps';
import { distanceMeters } from '../../utils/distance';
import { getVisitedCellsForLocationPoint } from '../location/grid/gridInterpolation';
import { upsertVisitedCells } from '../location/visitedCellRepository';

export type GpxImportResult = {
  importedPointCount: number;
  skippedPointCount: number;
};

/** GPX由来のGPSポイントを既存データ優先でSQLiteへ取り込む。 */
export async function importLocationPointsFromGpx(points: NewLocationPoint[], fileName: string): Promise<GpxImportResult> {
  const sortedPoints = [...points].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const now = new Date().toISOString();
  let importedPointCount = 0;
  let skippedPointCount = 0;
  let previousImportedPoint: NewLocationPoint | null = null;

  await db.withTransactionAsync(async () => {
    for (const point of sortedPoints) {
      if (await hasExistingPoint(point)) {
        skippedPointCount += 1;
        continue;
      }

      await insertImportedLocationPoint(point, previousImportedPoint, now);
      const visitedCells = getVisitedCellsForLocationPoint(previousImportedPoint, point);
      await upsertVisitedCells(visitedCells, point.recordedAt);
      previousImportedPoint = point;
      importedPointCount += 1;
    }

    await insertImportHistory(sortedPoints, fileName, importedPointCount, skippedPointCount, now);
  });

  return { importedPointCount, skippedPointCount };
}

async function hasExistingPoint(point: NewLocationPoint): Promise<boolean> {
  const existing = await db.getFirstAsync<{ id: number }>(
    `SELECT id
     FROM location_points
     WHERE recorded_at = ?
       AND latitude = ?
       AND longitude = ?
     LIMIT 1`,
    point.recordedAt,
    point.latitude,
    point.longitude,
  );

  return existing != null;
}

async function insertImportedLocationPoint(point: NewLocationPoint, previousPoint: NewLocationPoint | null, now: string): Promise<void> {
  const segmentDistanceMeters = previousPoint?.localDate === point.localDate ? distanceMeters(previousPoint, point) : 0;

  await db.runAsync(
    `INSERT INTO location_points (
      recorded_at,
      local_date,
      latitude,
      longitude,
      altitude,
      speed,
      heading,
      accuracy,
      altitude_accuracy,
      source,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'gpx-import', ?)`,
    point.recordedAt,
    point.localDate,
    point.latitude,
    point.longitude,
    point.altitude,
    point.speed,
    point.heading,
    point.accuracy,
    point.altitudeAccuracy,
    now,
  );

  await db.runAsync(
    `INSERT INTO daily_logs (
      local_date,
      started_at,
      ended_at,
      point_count,
      distance_meters,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, 1, ?, ?, ?)
    ON CONFLICT(local_date) DO UPDATE SET
      started_at = CASE
        WHEN daily_logs.started_at IS NULL OR excluded.started_at < daily_logs.started_at THEN excluded.started_at
        ELSE daily_logs.started_at
      END,
      ended_at = CASE
        WHEN daily_logs.ended_at IS NULL OR excluded.ended_at > daily_logs.ended_at THEN excluded.ended_at
        ELSE daily_logs.ended_at
      END,
      point_count = daily_logs.point_count + 1,
      distance_meters = COALESCE(daily_logs.distance_meters, 0) + excluded.distance_meters,
      updated_at = excluded.updated_at`,
    point.localDate,
    point.recordedAt,
    point.recordedAt,
    segmentDistanceMeters,
    now,
    now,
  );
}

async function insertImportHistory(points: NewLocationPoint[], fileName: string, importedPointCount: number, skippedPointCount: number, now: string): Promise<void> {
  const rangeFrom = points[0]?.recordedAt ?? null;
  const rangeTo = points.at(-1)?.recordedAt ?? null;

  await db.runAsync(
    `INSERT INTO import_history (
      format,
      file_name,
      range_from,
      range_to,
      imported_point_count,
      skipped_point_count,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    'gpx',
    fileName,
    rangeFrom,
    rangeTo,
    importedPointCount,
    skippedPointCount,
    now,
  );
}
```

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npm test -- src/features/import/__tests__/importRepository.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/db/database.ts src/features/import/importRepository.ts src/features/import/__tests__/importRepository.test.ts
git commit -m "feat(import): GPXログの保存処理を追加"
```

## Task 4: File Picker Service

**Files:**
- Create: `src/features/import/gpxImportService.ts`
- Create: `src/features/import/__tests__/gpxImportService.test.ts`

- [ ] **Step 1: Write failing service tests**

Create `src/features/import/__tests__/gpxImportService.test.ts`:

```typescript
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { pickAndReadGpxFile } from '../gpxImportService';

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: { UTF8: 'utf8' },
}));

describe('GPXファイル選択 gpxImportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('キャンセル時はnullを返す', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: [] });

    await expect(pickAndReadGpxFile()).resolves.toBeNull();
  });

  it('選択したGPXファイルをUTF-8文字列として読む', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://walk.gpx', name: 'walk.gpx' }],
    });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('<gpx />');

    await expect(pickAndReadGpxFile()).resolves.toEqual({ fileName: 'walk.gpx', content: '<gpx />' });
    expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledWith({
      type: ['application/gpx+xml', 'application/octet-stream', 'text/xml', '*/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/features/import/__tests__/gpxImportService.test.ts
```

Expected: FAIL because `../gpxImportService` does not exist.

- [ ] **Step 3: Implement service**

Create `src/features/import/gpxImportService.ts` with:

```typescript
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

export type PickedGpxFile = {
  fileName: string;
  content: string;
};

/** ユーザーにGPXファイルを選んでもらい、内容をUTF-8文字列として読み込む。 */
export async function pickAndReadGpxFile(): Promise<PickedGpxFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/gpx+xml', 'application/octet-stream', 'text/xml', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const content = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return {
    fileName: asset.name ?? 'import.gpx',
    content,
  };
}
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- src/features/import/__tests__/gpxImportService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/import/gpxImportService.ts src/features/import/__tests__/gpxImportService.test.ts
git commit -m "feat(import): GPXファイル選択を追加"
```

## Task 5: Settings and App Integration

**Files:**
- Modify: `src/app/components/SettingsScreen.tsx`
- Modify: `src/app/components/__tests__/SettingsScreen.test.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write failing SettingsScreen test**

Modify `src/app/components/__tests__/SettingsScreen.test.tsx` and add:

```typescript
  test('GPXインポートと既存データ優先の説明を表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<SettingsScreen {...createProps()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('GPXファイルを端末内に取り込みます。KMLは未対応です。同じ時刻と座標の点がある場合は既存データを優先します。');
    expect(texts).toContain('GPXをインポート');
  });
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/app/components/__tests__/SettingsScreen.test.tsx
```

Expected: FAIL because the new text is not present.

- [ ] **Step 3: Update SettingsScreen props and text**

In `src/app/components/SettingsScreen.tsx`, rename:

```typescript
onShowImportPlaceholder: () => void;
```

to:

```typescript
onImportGpx: () => void;
```

Update destructuring and the data card:

```tsx
          <Text style={styles.settingsDescription}>
            GPXファイルを端末内に取り込みます。KMLは未対応です。同じ時刻と座標の点がある場合は既存データを優先します。
          </Text>
          <Pressable onPress={onImportGpx} style={styles.settingsAction}>
            <Feather name="download" size={18} color={theme.colors.primary} />
            <Text style={styles.settingsActionText}>GPXをインポート</Text>
          </Pressable>
```

Update the test `createProps()` prop name to `onImportGpx: jest.fn()`.

- [ ] **Step 4: Verify SettingsScreen GREEN**

Run:

```bash
npm test -- src/app/components/__tests__/SettingsScreen.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Integrate App flow**

In `src/app/App.tsx`, import:

```typescript
import { parseGpxToLocationPoints } from '../features/import/gpxImporter';
import { pickAndReadGpxFile } from '../features/import/gpxImportService';
import { importLocationPointsFromGpx } from '../features/import/importRepository';
```

Replace `showImportPlaceholder` with:

```typescript
  const [isImportingGpx, setIsImportingGpx] = useState(false);

  /** GPXファイルを選択し、既存データ優先で端末内DBへ取り込む。 */
  async function importGpx(): Promise<void> {
    if (isImportingGpx) {
      return;
    }

    triggerSelectionHaptic();
    setIsImportingGpx(true);

    try {
      const pickedFile = await pickAndReadGpxFile();

      if (!pickedFile) {
        return;
      }

      const points = parseGpxToLocationPoints(pickedFile.content);

      if (points.length === 0) {
        Alert.alert('GPXインポート', '取り込めるGPSポイントがありませんでした。');
        return;
      }

      const result = await importLocationPointsFromGpx(points, pickedFile.fileName);
      await refreshLogs();
      await refreshRoute();
      Alert.alert('GPXインポート完了', `${result.importedPointCount}件を取り込みました。${result.skippedPointCount}件は既存データを優先してスキップしました。`);
    } catch (error: unknown) {
      console.warn('GPX import failed:', error);
      Alert.alert('GPXインポート失敗', error instanceof Error ? error.message : 'GPXインポートに失敗しました。');
    } finally {
      setIsImportingGpx(false);
    }
  }
```

Pass `onImportGpx={importGpx}` to `SettingsScreen`.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- src/app/components/__tests__/SettingsScreen.test.tsx src/features/import/__tests__/gpxImporter.test.ts src/features/import/__tests__/importRepository.test.ts src/features/import/__tests__/gpxImportService.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/App.tsx src/app/components/SettingsScreen.tsx src/app/components/__tests__/SettingsScreen.test.tsx
git commit -m "feat(import): 設定画面からGPXインポートを実行"
```

## Task 6: Documentation

**Files:**
- Modify: `docs/todo.md`
- Modify: `docs/mvp.md`
- Modify: `docs/data-storage.md`

- [ ] **Step 1: Update docs**

In `docs/todo.md`, add an MVP item under data import or update the existing deferred entry so the current state is explicit:

```markdown
- [x] GPXインポート
- [ ] KMLインポート
```

In `docs/mvp.md`, update the non-target import line from:

```markdown
- インポート
```

to:

```markdown
- KMLインポート
```

In `docs/data-storage.md`, add this paragraph under `4.6 import_history`:

```markdown
初期実装ではGPXのみインポート対象とする。既存の `recorded_at`、`latitude`、`longitude` と一致する点がある場合は既存データを優先し、GPX側の点はスキップする。KMLインポートは後続対応とする。
```

- [ ] **Step 2: Verify docs**

Run:

```bash
rg -n "GPX / KML インポート|インポート|GPXのみ|既存データ" docs/todo.md docs/mvp.md docs/data-storage.md
```

Expected: GPX import is represented as implemented or current scope; KML remains clearly deferred.

- [ ] **Step 3: Commit**

```bash
git add docs/todo.md docs/mvp.md docs/data-storage.md
git commit -m "docs: GPXインポート仕様を反映"
```

## Task 7: Final Verification and PR

**Files:**
- All changed files.

- [ ] **Step 1: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 2: Run tests**

```bash
npm test -- --runInBand
```

Expected: PASS.

- [ ] **Step 3: Inspect status**

```bash
git status --short
git log --oneline --decorate -5
```

Expected: clean worktree and recent GPX import commits on `codex/import-gpx-kml`.

- [ ] **Step 4: Push and create ready PR**

Use the GitHub publish flow, but create a ready-for-review PR, not a draft PR.

```bash
git push -u origin codex/import-gpx-kml
gh pr create --title "[codex] GPXインポートを追加" --body-file /tmp/strollia-gpx-import-pr.md --base main --head codex/import-gpx-kml
```

If the default branch is not `main`, use the repository default branch.

## Plan Self-Review

- Spec coverage: parser, repository, file picker, settings copy, conflict priority, docs, validation, PR are covered.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: parser returns `NewLocationPoint[]`; repository accepts `NewLocationPoint[]`; service returns `{ fileName, content }`; App composes all three.
