# GPS Recording Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** バックグラウンドを含むライブGPS記録で吸着状態を永続化し、GPS点・日別距離・Visited Gridを原子的に更新して異常な距離加算を防ぐ。

**Architecture:** `location_recording_state` の単一行をSQLiteへ保存し、前景・背景・セッション再生成で同じ吸着状態とVisited Grid補間起点を共有する。1観測の吸着判定、保存判定、GPS点、日別集計、Visited Grid、状態更新を1つの排他トランザクションへまとめ、セッションはバッファ・順序・実績処理だけを調整する。端末時計の巻き戻り、GPS点の重複、既存NULL距離をそれぞれ明示的な安全側の契約で扱う。

**Tech Stack:** Expo 57、React Native 0.86、TypeScript 6 strict、expo-location、expo-task-manager、expo-sqlite、Jest 29 / jest-expo

**Spec:** `docs/superpowers/specs/2026-08-22-location-recording-integrity-design.md`

## Global Constraints

- 既存の `daily_logs.distance_meters` は再計算・修復しない。
- `achievement_unlocks` と `achievement_notification_queue` は変更しない。
- 既存の83.37kmなど、すでに保存された日別距離は維持する。
- 修正はアップデート後のライブ `expo-location` 観測だけへ適用する。
- GPXインポートの保存・距離計算経路は変更しない。
- 吸着範囲は中心から50m以内、入場・退出はいずれも3点連続の3点目で切り替える。
- `location_recording_state` はID `1` の単一行とし、滞在ポイントIDへ外部キーを設定しない。
- GPSログ保存対象外の観測でも吸着状態とVisited Gridを更新する。
- 距離、保存判定、Visited Gridには有効座標を使い、生座標は `latitude` / `longitude` へ維持する。
- 滞在ポイント・課金状態の取得失敗時は生座標を使い、永続吸着状態を変更しない。
- 古いライブ観測は保存せず、吸着状態も巻き戻さない。
- 新しいnpm依存を追加しない。
- Visited Grid補間起点は最後にセル更新へ利用できた有効座標・観測日時をSQLiteへ保存し、既存行を埋め戻さない。
- `last_observed_at` が処理時刻より1時間を超えて未来なら単調増加ガードを無効として扱い、正常観測で上書きする。
- GPS点の重複観測は吸着状態とVisited Gridを進めず、一意制約以外の制約違反は例外として伝播する。
- 既存の `daily_logs.distance_meters` がNULLなら、ライブ差分で非NULLへ変換しない。
- 関数・型・自明でない変数へ日本語JSDocを付け、テスト説明文は日本語にする。
- Task 1開始時に `.agents/skills/db-schema-change/SKILL.md` を読み、DB変更手順を守る。

---

### Task 1: 吸着状態のSQLiteスキーマとリポジトリ

**Files:**

- Modify: `src/db/database.ts:53-229`
- Modify: `src/db/__tests__/database.test.ts`
- Create: `src/features/location/locationRecordingStateRepository.ts`
- Create: `src/features/location/__tests__/locationRecordingStateRepository.test.ts`
- Modify: `src/features/logs/logRepository.ts:228-240`
- Modify: `src/features/logs/__tests__/logRepository.test.ts:109-126`

**Interfaces:**

- Consumes: `StayPlaceSnapState` と `INITIAL_STAY_PLACE_SNAP_STATE` from `@/features/stayPlaces/stayPlaceSnapResolver`
- Produces: `PersistedLocationRecordingState`
- Produces: `INITIAL_PERSISTED_LOCATION_RECORDING_STATE`
- Produces: `getLocationRecordingStateInCurrentTransaction(runner: SQLite.SQLiteDatabase): Promise<PersistedLocationRecordingState>`
- Produces: `upsertLocationRecordingStateInCurrentTransaction(state: PersistedLocationRecordingState, updatedAt: string, runner: SQLite.SQLiteDatabase): Promise<void>`

- [ ] **Step 1: DBスキーマの失敗テストを書く**

`src/db/__tests__/database.test.ts` に、CREATE文が含まれ、既存集計を更新するSQLが追加されないことを検証する。

```typescript
it('ライブ記録の吸着状態を保持する単一行テーブルを作成する', async () => {
  (db.getAllAsync as jest.Mock).mockResolvedValue([]);

  await initializeDatabase();

  const createSql = (db.execAsync as jest.Mock).mock.calls[0][0] as string;
  expect(createSql).toContain('CREATE TABLE IF NOT EXISTS location_recording_state');
  expect(createSql).toContain('CHECK (id = 1)');
  expect(createSql).toContain('last_observed_at TEXT NULL');
});

it('記録状態テーブル追加時に既存距離と実績を更新しない', async () => {
  (db.getAllAsync as jest.Mock).mockResolvedValue([]);

  await initializeDatabase();

  const sql = [...(db.execAsync as jest.Mock).mock.calls, ...(db.runAsync as jest.Mock).mock.calls]
    .map(([statement]) => String(statement))
    .join('\n');
  expect(sql).not.toMatch(/UPDATE\s+daily_logs/i);
  expect(sql).not.toMatch(/UPDATE\s+achievement_unlocks[\s\S]*progress_value/i);
});
```

- [ ] **Step 2: DBテストを実行してREDを確認する**

Run: `npm test -- --runInBand src/db/__tests__/database.test.ts`

Expected: `location_recording_state` がCREATE SQLに存在せずFAIL。

- [ ] **Step 3: `location_recording_state` を作成する**

`src/db/database.ts` のCREATE TABLEブロックへ次を追加する。既存テーブルへのUPDATEや初期行INSERTは追加しない。

```sql
CREATE TABLE IF NOT EXISTS location_recording_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active_stay_place_id INTEGER NULL,
  candidate_stay_place_id INTEGER NULL,
  candidate_count INTEGER NOT NULL DEFAULT 0,
  outside_count INTEGER NOT NULL DEFAULT 0,
  last_observed_at TEXT NULL,
  updated_at TEXT NOT NULL
);
```

- [ ] **Step 4: 状態リポジトリの失敗テストを書く**

`src/features/location/__tests__/locationRecordingStateRepository.test.ts` で、行なしの初期値、行変換、UPSERT引数を検証する。

```typescript
it('状態行がない場合は未吸着の初期状態を返す', async () => {
  mockRunner.getFirstAsync.mockResolvedValue(null);

  await expect(getLocationRecordingStateInCurrentTransaction(mockRunner)).resolves.toEqual({
    ...INITIAL_STAY_PLACE_SNAP_STATE,
    lastObservedAt: null,
  });
});

it('単一行へ吸着状態と最終観測日時を保存する', async () => {
  const state = {
    activeStayPlaceId: 7,
    candidateStayPlaceId: null,
    candidateCount: 0,
    outsideCount: 1,
    lastObservedAt: '2026-08-23T00:00:10.000Z',
  };

  await upsertLocationRecordingStateInCurrentTransaction(state, '2026-08-23T00:00:11.000Z', mockRunner);

  expect(mockRunner.runAsync).toHaveBeenCalledWith(
    expect.stringContaining('ON CONFLICT(id) DO UPDATE SET'),
    1,
    7,
    null,
    0,
    1,
    '2026-08-23T00:00:10.000Z',
    '2026-08-23T00:00:11.000Z',
  );
});
```

- [ ] **Step 5: 状態リポジトリテストを実行してREDを確認する**

Run: `npm test -- --runInBand src/features/location/__tests__/locationRecordingStateRepository.test.ts`

Expected: モジュールが存在せずFAIL。

- [ ] **Step 6: 状態リポジトリを実装する**

`src/features/location/locationRecordingStateRepository.ts` に次の型と関数を実装する。SELECTは `WHERE id = 1`、UPSERTは常にID `1` を使う。

```typescript
export type PersistedLocationRecordingState = StayPlaceSnapState & {
  /** 吸着状態へ反映済みの最新ライブ観測日時。 */
  lastObservedAt: string | null;
};

export const INITIAL_PERSISTED_LOCATION_RECORDING_STATE: PersistedLocationRecordingState = {
  ...INITIAL_STAY_PLACE_SNAP_STATE,
  lastObservedAt: null,
};
```

DB行のsnake_caseはSELECT aliasでcamelCaseへ変換し、行がなければオブジェクトを複製して返す。

- [ ] **Step 7: 全データ削除の失敗テストを追加する**

`src/features/logs/__tests__/logRepository.test.ts` の削除順期待値先頭へ次を追加し、既存のnth番号を1つずつ後ろへずらす。

```typescript
expect(mockTxn.runAsync).toHaveBeenNthCalledWith(1, 'DELETE FROM location_recording_state');
expect(mockTxn.runAsync).toHaveBeenNthCalledWith(2, 'DELETE FROM visited_cells');
```

- [ ] **Step 8: 全データ削除へ状態テーブルを追加する**

`deleteAllUserData()` の最初に次を追加する。

```typescript
await txn.runAsync('DELETE FROM location_recording_state');
```

- [ ] **Step 9: Task 1のテストを通す**

Run: `npm test -- --runInBand src/db/__tests__/database.test.ts src/features/location/__tests__/locationRecordingStateRepository.test.ts src/features/logs/__tests__/logRepository.test.ts`

Expected: 3 suites PASS。

- [ ] **Step 10: Task 1をコミットする**

```bash
git add src/db/database.ts src/db/__tests__/database.test.ts src/features/location/locationRecordingStateRepository.ts src/features/location/__tests__/locationRecordingStateRepository.test.ts src/features/logs/logRepository.ts src/features/logs/__tests__/logRepository.test.ts
git commit -m "feat(db): GPS吸着状態の永続化基盤を追加"
```

---

### Task 2: 原子的なGPS点・日別距離更新

**Files:**

- Create: `src/features/logs/locationDistanceDelta.ts`
- Create: `src/features/logs/__tests__/locationDistanceDelta.test.ts`
- Modify: `src/features/logs/logRepository.ts:1-100`
- Modify: `src/features/logs/__tests__/logRepository.test.ts:1-77`

**Interfaces:**

- Consumes: `toEffectiveLocationPoint(point)` and `distanceMeters(a, b)`
- Produces: `calculateInsertedPointDistanceDeltaMeters(previousPoint: LocationPoint | null, point: NewLocationPoint, nextPoint: LocationPoint | null): number`
- Produces: `getLatestLocationPointInCurrentTransaction(runner: SQLite.SQLiteDatabase): Promise<LocationPoint | null>`
- Produces: `InsertedLocationPointResult`
- Produces: `insertLocationPointInCurrentTransaction(point: NewLocationPoint, now: string, runner: SQLite.SQLiteDatabase): Promise<InsertedLocationPointResult | null>`
- Preserves: `insertLocationPoint(point: NewLocationPoint): Promise<number>` as an atomic wrapper for existing callers

- [ ] **Step 1: 距離差分の失敗テストを書く**

`src/features/logs/__tests__/locationDistanceDelta.test.ts` に末尾・先頭・途中挿入と丸めを追加する。

```typescript
it('途中挿入では既存区間を置き換える差分だけを返す', () => {
  const previous = savedPoint(1, 35, 139);
  const inserted = newPoint(35.001, 139.001);
  const next = savedPoint(2, 35.002, 139.002);

  const expected =
    distanceMeters(toEffectiveLocationPoint(previous), toEffectiveLocationPoint(inserted)) +
    distanceMeters(toEffectiveLocationPoint(inserted), toEffectiveLocationPoint(next)) -
    distanceMeters(toEffectiveLocationPoint(previous), toEffectiveLocationPoint(next));

  expect(calculateInsertedPointDistanceDeltaMeters(previous, inserted, next)).toBeCloseTo(Math.max(0, expected));
});

it('同日の最初の1点は距離を増やさない', () => {
  expect(calculateInsertedPointDistanceDeltaMeters(null, newPoint(35, 139), null)).toBe(0);
});
```

- [ ] **Step 2: 距離差分テストを実行してREDを確認する**

Run: `npm test -- --runInBand src/features/logs/__tests__/locationDistanceDelta.test.ts`

Expected: `calculateInsertedPointDistanceDeltaMeters` が存在せずFAIL。

- [ ] **Step 3: 距離差分関数を実装する**

```typescript
export function calculateInsertedPointDistanceDeltaMeters(
  previousPoint: LocationPoint | null,
  point: NewLocationPoint,
  nextPoint: LocationPoint | null,
): number {
  const effectivePoint = toEffectiveLocationPoint(point);
  const previousDistance = previousPoint ? distanceMeters(toEffectiveLocationPoint(previousPoint), effectivePoint) : 0;
  const nextDistance = nextPoint ? distanceMeters(effectivePoint, toEffectiveLocationPoint(nextPoint)) : 0;
  const replacedDistance =
    previousPoint && nextPoint ? distanceMeters(toEffectiveLocationPoint(previousPoint), toEffectiveLocationPoint(nextPoint)) : 0;

  return Math.max(0, previousDistance + nextDistance - replacedDistance);
}
```

- [ ] **Step 4: トランザクション内保存の失敗テストを書く**

`mockTxn` に `getFirstAsync` を追加する。テストではINSERT後のIDを使って前後点を検索し、日別UPSERTへ差分を渡すことを検証する。

```typescript
it('前後点の読取・GPS挿入・日別距離更新を同じrunnerで行う', async () => {
  mockTxn.runAsync.mockResolvedValueOnce({ lastInsertRowId: 100, changes: 1 }).mockResolvedValueOnce({ changes: 1 });
  mockTxn.getFirstAsync.mockResolvedValueOnce(previousPoint).mockResolvedValueOnce(nextPoint);

  const result = await insertLocationPointInCurrentTransaction(newPoint, '2026-08-23T00:00:30.000Z', mockTxn);

  expect(result).toEqual(expect.objectContaining({ locationPointId: 100, previousPoint, nextPoint }));
  expect(mockTxn.getFirstAsync).toHaveBeenCalledTimes(2);
  expect(mockTxn.runAsync.mock.calls[1][0]).toContain('distance_meters = COALESCE');
  expect(mockTxn.runAsync.mock.calls[1][4]).toBe(result?.distanceDeltaMeters);
  expect(db.getFirstAsync).not.toHaveBeenCalled();
});

it('重複点のINSERTが無視された場合は日別集計を更新しない', async () => {
  mockTxn.runAsync.mockResolvedValueOnce({ lastInsertRowId: 0, changes: 0 });

  await expect(insertLocationPointInCurrentTransaction(newPoint, now, mockTxn)).resolves.toBeNull();

  expect(mockTxn.runAsync).toHaveBeenCalledTimes(1);
  expect(mockTxn.getFirstAsync).not.toHaveBeenCalled();
});
```

- [ ] **Step 5: リポジトリテストを実行してREDを確認する**

Run: `npm test -- --runInBand src/features/logs/__tests__/logRepository.test.ts`

Expected: 新しいin-transaction関数がexportされておらずFAIL。

- [ ] **Step 6: トランザクション内保存を実装する**

`InsertedLocationPointResult` を次の形で定義する。

```typescript
export type InsertedLocationPointResult = {
  locationPointId: number;
  previousPoint: LocationPoint | null;
  nextPoint: LocationPoint | null;
  distanceDeltaMeters: number;
};
```

GPS点は `INSERT OR IGNORE` で挿入する。挿入後、同日かつ `(recorded_at, id)` が新規点より前・後になる点をそれぞれ取得する。

```sql
WHERE local_date = ?
  AND (recorded_at < ? OR (recorded_at = ? AND id < ?))
ORDER BY recorded_at DESC, id DESC
LIMIT 1
```

直後点は比較演算子とORDERを反転する。距離差分を求め、既存の `daily_logs` UPSERTへ渡す。`insertLocationPoint()` は `withExclusiveTransaction` 内からこの関数を呼ぶ薄いラッパーに変更し、トランザクション外の `getLatestLocationPointByDate()` を削除する。

薄いラッパーで重複が返った場合は、既存の `Promise<number>` を維持して曖昧なIDを返さないため、次のエラーを投げる。

```typescript
if (!inserted) {
  throw new Error('Location point already exists.');
}
return inserted.locationPointId;
```

- [ ] **Step 7: Task 2のテストを通す**

Run: `npm test -- --runInBand src/features/logs/__tests__/locationDistanceDelta.test.ts src/features/logs/__tests__/logRepository.test.ts src/features/import/__tests__/importRepository.test.ts src/features/import/__tests__/importRepositoryTransaction.test.ts`

Expected: 4 suites PASS。GPXインポートテストの期待値は変更しない。

- [ ] **Step 8: Task 2をコミットする**

```bash
git add src/features/logs/locationDistanceDelta.ts src/features/logs/__tests__/locationDistanceDelta.test.ts src/features/logs/logRepository.ts src/features/logs/__tests__/logRepository.test.ts
git commit -m "fix(logs): GPS距離更新を排他トランザクション内へ移動"
```

---

### Task 3: 1観測を原子的に処理する記録サービス

**Files:**

- Create: `src/features/location/locationObservationRecorder.ts`
- Create: `src/features/location/__tests__/locationObservationRecorder.test.ts`

**Interfaces:**

- Consumes: Task 1の状態リポジトリ
- Consumes: Task 2の `getLatestLocationPointInCurrentTransaction` と `insertLocationPointInCurrentTransaction`
- Consumes: `resolveStayPlaceSnap`, `shouldSaveLocationPoint`, `getVisitedCellsForLocationPoint`, `upsertVisitedCellsInCurrentTransaction`
- Produces: `ActiveStayPlacesSnapshot = { status: 'ready'; stayPlaces: StayPlace[] } | { status: 'unavailable' }`
- Produces: `RecordLocationObservationInput`
- Produces: `RecordLocationObservationResult`
- Produces: `recordLocationObservation(input: RecordLocationObservationInput): Promise<RecordLocationObservationResult>`

- [ ] **Step 1: 状態永続化と3点吸着の失敗テストを書く**

状態リポジトリのモックは書込み時にメモリ変数を更新し、`recordLocationObservation` 自体は3回とも新しく呼ぶ。

```typescript
it('別々の呼び出しでも永続状態を引き継ぎ3点目から吸着する', async () => {
  let persistedState = { ...INITIAL_PERSISTED_LOCATION_RECORDING_STATE };
  mockGetState.mockImplementation(async () => persistedState);
  mockUpsertState.mockImplementation(async (state) => {
    persistedState = state;
  });
  mockShouldSave.mockReturnValue(true);
  mockInsert.mockResolvedValue({ locationPointId: 1, previousPoint: null, nextPoint: null, distanceDeltaMeters: 0 });

  const first = await recordLocationObservation(input(pointAtHome('2026-08-23T00:00:10.000Z')));
  const second = await recordLocationObservation(input(pointAtHome('2026-08-23T00:00:20.000Z')));
  const third = await recordLocationObservation(input(pointAtHome('2026-08-23T00:00:30.000Z')));

  expect(first.status).toBe('saved');
  expect(second.status).toBe('saved');
  expect(third).toEqual(
    expect.objectContaining({
      status: 'saved',
      point: expect.objectContaining({
        effectiveLatitude: home.latitude,
        effectiveLongitude: home.longitude,
        snappedStayPlaceId: home.id,
      }),
    }),
  );
});

it('吸着中の範囲外観測も別々の呼び出しで数え3点目に退出する', async () => {
  let persistedState = {
    activeStayPlaceId: home.id,
    candidateStayPlaceId: null,
    candidateCount: 0,
    outsideCount: 0,
    lastObservedAt: '2026-08-23T00:00:00.000Z',
  };
  mockGetState.mockImplementation(async () => persistedState);
  mockUpsertState.mockImplementation(async (state) => {
    persistedState = state;
  });

  const first = await recordLocationObservation(input(pointOutsideHome('2026-08-23T00:00:10.000Z')));
  const second = await recordLocationObservation(input(pointOutsideHome('2026-08-23T00:00:20.000Z')));
  const third = await recordLocationObservation(input(pointOutsideHome('2026-08-23T00:00:30.000Z')));

  expect(first).toEqual(expect.objectContaining({ point: expect.objectContaining({ snappedStayPlaceId: home.id }) }));
  expect(second).toEqual(expect.objectContaining({ point: expect.objectContaining({ snappedStayPlaceId: home.id }) }));
  expect(third).toEqual(expect.objectContaining({ point: expect.objectContaining({ snappedStayPlaceId: null }) }));
  expect(persistedState.activeStayPlaceId).toBeNull();
});
```

- [ ] **Step 2: 保存対象外、古い観測、取得失敗の失敗テストを書く**

```typescript
it('GPSログ保存対象外でも状態とVisited Gridを同じtransactionで更新する', async () => {
  mockShouldSave.mockReturnValue(false);
  mockGetVisitedCells.mockReturnValue([cell]);

  await expect(recordLocationObservation(input(rawPoint))).resolves.toEqual(
    expect.objectContaining({ status: 'not-saved', visitedCellPoint: expect.any(Object) }),
  );

  expect(mockInsert).not.toHaveBeenCalled();
  expect(mockUpsertVisitedCells).toHaveBeenCalledWith([cell], rawPoint.recordedAt, mockTxn);
  expect(mockUpsertState).toHaveBeenCalledWith(
    expect.objectContaining({ lastObservedAt: rawPoint.recordedAt }),
    expect.any(String),
    mockTxn,
  );
});

it('最終処理日時以前の観測は状態・GPS・Gridへ反映しない', async () => {
  mockGetState.mockResolvedValue({
    ...INITIAL_PERSISTED_LOCATION_RECORDING_STATE,
    candidateStayPlaceId: home.id,
    candidateCount: 2,
    lastObservedAt: '2026-08-23T00:00:30.000Z',
  });

  await expect(recordLocationObservation(input(pointAtHome('2026-08-23T00:00:20.000Z')))).resolves.toEqual({
    status: 'stale',
    visitedCellPoint: null,
  });
  expect(mockUpsertState).not.toHaveBeenCalled();
  expect(mockInsert).not.toHaveBeenCalled();
  expect(mockUpsertVisitedCells).not.toHaveBeenCalled();
});

it('滞在場所取得失敗時は生座標を使い吸着状態を維持する', async () => {
  mockGetState.mockResolvedValue(activePersistedState);

  const result = await recordLocationObservation({
    ...input(rawPoint),
    activeStayPlaces: { status: 'unavailable' },
  });

  expect(result).toEqual(expect.objectContaining({ point: expect.objectContaining({ effectiveLatitude: rawPoint.latitude }) }));
  expect(mockUpsertState).toHaveBeenCalledWith(
    expect.objectContaining({ activeStayPlaceId: activePersistedState.activeStayPlaceId, lastObservedAt: rawPoint.recordedAt }),
    expect.any(String),
    mockTxn,
  );
});

it('保存済み吸着先が有効一覧から外れた場合は次の正常観測で解除する', async () => {
  mockGetState.mockResolvedValue(activePersistedState);

  const result = await recordLocationObservation({
    ...input(rawPoint),
    activeStayPlaces: { status: 'ready', stayPlaces: [] },
  });

  expect(result).toEqual(expect.objectContaining({ point: expect.objectContaining({ snappedStayPlaceId: null }) }));
  expect(mockUpsertState).toHaveBeenCalledWith(
    expect.objectContaining({ activeStayPlaceId: null, candidateCount: 0, outsideCount: 0 }),
    expect.any(String),
    mockTxn,
  );
});
```

- [ ] **Step 3: 原子的ロールバック境界の失敗テストを書く**

`withExclusiveTransaction` のモックが1つの `mockTxn` を渡すことを利用し、全更新が同じrunnerを受け取ることと、エラーが呼出元へ伝播することを確認する。

```typescript
it('GPS点・日別集計後にGrid更新が失敗した場合はtransactionのエラーを伝播する', async () => {
  mockShouldSave.mockReturnValue(true);
  mockInsert.mockResolvedValue(insertedResult);
  mockGetVisitedCells.mockReturnValue([cell]);
  mockUpsertVisitedCells.mockRejectedValue(new Error('grid write failed'));

  await expect(recordLocationObservation(input(rawPoint))).rejects.toThrow('grid write failed');

  expect(withExclusiveTransaction).toHaveBeenCalledTimes(1);
  expect(mockInsert).toHaveBeenCalledWith(expect.any(Object), expect.any(String), mockTxn);
  expect(mockUpsertVisitedCells).toHaveBeenCalledWith([cell], rawPoint.recordedAt, mockTxn);
  expect(mockUpsertState).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: Recorderテストを実行してREDを確認する**

Run: `npm test -- --runInBand src/features/location/__tests__/locationObservationRecorder.test.ts`

Expected: `locationObservationRecorder` が存在せずFAIL。

- [ ] **Step 5: 入出力型を実装する**

```typescript
export type ActiveStayPlacesSnapshot = { status: 'ready'; stayPlaces: StayPlace[] } | { status: 'unavailable' };

export type RecordLocationObservationInput = {
  rawPoint: NewLocationPoint;
  activeStayPlaces: ActiveStayPlacesSnapshot;
  previousVisitedCellPoint: NewLocationPoint | null;
  now?: string;
};

export type RecordLocationObservationResult =
  | { status: 'saved'; point: NewLocationPoint; locationPointId: number; visitedCellPoint: NewLocationPoint | null }
  | { status: 'not-saved'; visitedCellPoint: NewLocationPoint | null }
  | { status: 'stale' | 'duplicate'; visitedCellPoint: null };
```

- [ ] **Step 6: 1観測の原子的処理を実装する**

`recordLocationObservation()` は `withExclusiveTransaction` を1回だけ呼び、コールバック内で次の順に処理する。

1. 状態を読む。
2. `lastObservedAt != null && rawPoint.recordedAt <= lastObservedAt` なら `stale` を返す。
3. `ready` ならresolverを実行し、`unavailable` なら生座標と既存snap stateを使う。
4. transaction内で最新保存点を読み、`shouldSaveLocationPoint` を実行する。
5. `previousVisitedCellPoint` と現在の有効観測からGridセルを求める。
6. 保存対象ならTask 2のin-transaction挿入を呼ぶ。重複なら状態・Gridを更新せず `duplicate` を返す。
7. Gridセルがあれば `upsertVisitedCellsInCurrentTransaction` を同じrunnerで呼ぶ。
8. 状態と `lastObservedAt` をUPSERTする。
9. transaction完了後に結果を返す。

`visitedCellPoint` はGridセルを1件以上更新したときだけ現在の有効観測を返し、それ以外はNULLとする。これにより既存セッションの補間起点更新条件を維持する。

- [ ] **Step 7: Task 3のテストを通す**

Run: `npm test -- --runInBand src/features/location/__tests__/locationObservationRecorder.test.ts src/features/location/__tests__/visitedCellRepository.test.ts src/features/stayPlaces/__tests__/stayPlaceSnapResolver.test.ts`

Expected: 3 suites PASS。

- [ ] **Step 8: Task 3をコミットする**

```bash
git add src/features/location/locationObservationRecorder.ts src/features/location/__tests__/locationObservationRecorder.test.ts
git commit -m "feat(location): 位置観測を原子的に記録"
```

---

### Task 4: 前景・背景セッションを永続状態へ接続

**Files:**

- Modify: `src/features/location/locationRecordingSession.ts:1-163`
- Modify: `src/features/location/__tests__/locationRecordingSession.test.ts`
- Modify: `src/features/location/__tests__/backgroundLocationTask.test.ts`
- Verify: `src/ui/hooks/useForegroundUserLocation.ts`
- Verify: `src/ui/hooks/__tests__/useForegroundUserLocation.test.tsx`

**Interfaces:**

- Consumes: Task 3の `recordLocationObservation` と `ActiveStayPlacesSnapshot`
- Preserves: `createLocationRecordingSession(options?: LocationRecordingSessionOptions): Promise<LocationRecordingSession>`
- Preserves: `flushLocationsBufferedDuringGpxImport(options?: LocationRecordingSessionOptions): Promise<void>`
- Preserves: `LocationRecordingSession.recordLocations(locations: Location.LocationObject[]): Promise<void>`

- [ ] **Step 1: バッチ順序とRecorder委譲の失敗テストを書く**

既存のresolver、保存判定、logRepository、Visited GridモックをTask 3のRecorderモックへ置き換える。

```typescript
it('受信順が前後したバッチを観測日時順にRecorderへ渡す', async () => {
  mockToLocationPoint.mockImplementation((location) => point(String(location.timestamp).padStart(3, '0')));
  mockRecordLocationObservation.mockResolvedValue({ status: 'not-saved', visitedCellPoint: null });
  const session = await createLocationRecordingSession();

  await session.recordLocations([location(30), location(10), location(20)]);

  expect(mockRecordLocationObservation.mock.calls.map(([input]) => input.rawPoint.recordedAt)).toEqual([
    point('010').recordedAt,
    point('020').recordedAt,
    point('030').recordedAt,
  ]);
});

it('滞在場所取得失敗をunavailableとしてRecorderへ渡す', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const session = await createLocationRecordingSession({
    getActiveStayPlaces: async () => {
      throw new Error('RevenueCat unavailable');
    },
  });

  await session.recordLocations([firstLocation]);

  expect(mockRecordLocationObservation).toHaveBeenCalledWith(expect.objectContaining({ activeStayPlaces: { status: 'unavailable' } }));
  expect(warn).toHaveBeenCalledWith('Stay place loading failed:', expect.any(Error));
});
```

- [ ] **Step 2: Grid補間起点と実績処理の失敗テストを書く**

```typescript
it('Recorderが返したセル開放済み観測を次の補間起点へ渡す', async () => {
  mockRecordLocationObservation
    .mockResolvedValueOnce({ status: 'not-saved', visitedCellPoint: firstPoint })
    .mockResolvedValueOnce({ status: 'not-saved', visitedCellPoint: secondPoint });
  const session = await createLocationRecordingSession();

  await session.recordLocations([firstLocation, secondLocation]);

  expect(mockRecordLocationObservation).toHaveBeenNthCalledWith(2, expect.objectContaining({ previousVisitedCellPoint: firstPoint }));
});

it('保存確定した点だけを実績処理へ渡す', async () => {
  mockRecordLocationObservation.mockResolvedValue({
    status: 'saved',
    point: effectivePoint,
    locationPointId: 11,
    visitedCellPoint: effectivePoint,
  });
  const session = await createLocationRecordingSession();

  await session.recordLocations([firstLocation]);

  expect(mockProcessAchievementsForSavedPoint).toHaveBeenCalledWith(effectivePoint, 11);
});
```

- [ ] **Step 3: 再キュー境界の失敗テストを書く**

ソート後2件目のRecorderを失敗させ、成功済み1件目を戻さず、2件目以降だけが次回に再処理されることを検証する。

```typescript
it('ソート後の未処理観測だけを失敗時に再キューする', async () => {
  mockRecordLocationObservation
    .mockResolvedValueOnce({ status: 'not-saved', visitedCellPoint: null })
    .mockRejectedValueOnce(new Error('database is locked'))
    .mockResolvedValue({ status: 'not-saved', visitedCellPoint: null });
  const session = await createLocationRecordingSession();

  await expect(session.recordLocations([location(20), location(10)])).rejects.toThrow('database is locked');
  await session.recordLocations([]);

  expect(mockRecordLocationObservation).toHaveBeenCalledTimes(3);
  expect(mockRecordLocationObservation.mock.calls[2][0].rawPoint.recordedAt).toBe(point('020').recordedAt);
});
```

- [ ] **Step 4: Sessionテストを実行してREDを確認する**

Run: `npm test -- --runInBand src/features/location/__tests__/locationRecordingSession.test.ts src/features/location/__tests__/backgroundLocationTask.test.ts`

Expected: セッションがRecorderを利用しておらず、新しい期待がFAIL。

- [ ] **Step 5: セッションをRecorderへ接続する**

`createLocationRecordingSession()` は初期化時に最新保存点を1回読み、Visited Grid補間起点だけを保持する。セッション内の `snapState` と `previousSavedPoint` は削除する。

`recordLocations()` では、バッファ分と新着分を合わせた後、`LocationObject.timestamp` 昇順・元index昇順で安定ソートする。有効滞在ポイント取得結果を次の判別共用体へ変換する。

```typescript
const activeStayPlaces: ActiveStayPlacesSnapshot = await getActiveStayPlacesSnapshot(options.getActiveStayPlaces);
```

各観測を `toLocationPoint()` で変換してRecorderへ渡す。`saved` だけを実績処理配列へ追加し、`visitedCellPoint` が非NULLならセッションの補間起点を更新する。失敗時はソート済み配列の `processedCount` 以降だけを既存バッファへ戻す。

- [ ] **Step 6: バックグラウンド回帰テストを更新する**

`backgroundLocationTask.test.ts` では、別々の3回のtask invocationが毎回セッションを作成し、各観測を `recordLocations` へ渡すことを明示する。吸着状態そのものはTask 3の永続状態テストで保証する。

```typescript
it('別々のバックグラウンド配信も共通記録セッションへ順番に渡す', async () => {
  const locations = [location(10), location(20), location(30)];

  for (const item of locations) {
    await definedTask!({ data: { locations: [item] }, error: null });
  }

  expect(mockCreateLocationRecordingSession).toHaveBeenCalledTimes(3);
  expect(mockRecordLocations).toHaveBeenNthCalledWith(1, [locations[0]]);
  expect(mockRecordLocations).toHaveBeenNthCalledWith(2, [locations[1]]);
  expect(mockRecordLocations).toHaveBeenNthCalledWith(3, [locations[2]]);
});
```

- [ ] **Step 7: Task 4の対象テストを通す**

Run: `npm test -- --runInBand src/features/location/__tests__/locationRecordingSession.test.ts src/features/location/__tests__/backgroundLocationTask.test.ts src/features/location/__tests__/locationObservationRecorder.test.ts src/ui/hooks/__tests__/useForegroundUserLocation.test.tsx`

Expected: 4 suites PASS。

- [ ] **Step 8: 自宅付近の密集観測回帰を追加する**

`locationObservationRecorder.test.ts` に、50m以内の合成観測を1件ずつ独立呼出しし、3点目以降の保存点が同じ中心有効座標になるケースを追加する。個人GPXはfixtureへ含めない。

```typescript
it('自宅付近の密集観測を別配信相当で処理しても中心と生座標を往復しない', async () => {
  const observations = Array.from({ length: 12 }, (_, index) =>
    pointAtDistanceFromHome(index % 2 === 0 ? 12 : 18, `2026-08-23T00:${String(index).padStart(2, '0')}:00.000Z`),
  );

  const results = [];
  for (const rawPoint of observations) {
    results.push(await recordLocationObservation(input(rawPoint)));
  }

  const saved = results.filter(
    (result): result is Extract<RecordLocationObservationResult, { status: 'saved' }> => result.status === 'saved',
  );
  expect(saved.slice(2).every((result) => result.point.snappedStayPlaceId === home.id)).toBe(true);
  expect(saved.slice(2).every((result) => result.point.effectiveLatitude === home.latitude)).toBe(true);
});
```

- [ ] **Step 9: Task 4をコミットする**

```bash
git add src/features/location/locationRecordingSession.ts src/features/location/__tests__/locationRecordingSession.test.ts src/features/location/__tests__/backgroundLocationTask.test.ts src/features/location/__tests__/locationObservationRecorder.test.ts
git commit -m "fix(location): 前景と背景でGPS吸着状態を共有"
```

---

### Task 5: 仕様同期と最終検証

**Files:**

- Modify: `docs/data-storage.md:38-74,315-338`
- Modify: `docs/stay-places.md:3-13,25-36`
- Modify: `docs/achievements.md:220-230`
- Modify: `docs/architecture.md:92-140`

**Interfaces:**

- Consumes: Task 1〜4の確定したスキーマとライブ記録フロー
- Produces: 実装と一致する保存・吸着・実績・実機確認ドキュメント

- [ ] **Step 1: データ保存仕様を更新する**

`docs/data-storage.md` に `location_recording_state` の7列と次の規則を記載する。

```text
ライブ位置情報の吸着状態はID=1の単一行へ保存する。GPS点が保存対象外でも連続観測数と最終観測日時を更新し、前景・背景・JSプロセス再生成で共有する。

日別距離は前後点の検索、GPS点挿入、Visited Grid、吸着状態と同じ排他トランザクションで差分加算する。既存の日別距離はマイグレーションで再計算しない。
```

- [ ] **Step 2: 滞在ポイントと実機チェックを更新する**

`docs/stay-places.md` の「アプリ再起動時に再び3点必要」という説明とチェック項目を削除し、次へ置き換える。

```text
入場・退出の連続観測状態は端末内SQLiteへ保存し、前景・背景の切替およびJSプロセス再生成後も引き継ぐ。バックグラウンド配信が1点ずつの場合も3点目から吸着する。
```

実機チェックには「候補2点後にバックグラウンドまたは再起動相当を挟み、次の1点で吸着する」と「吸着後に画面消灯しても維持する」を追加する。

- [ ] **Step 3: 実績とアーキテクチャを更新する**

`docs/achievements.md` に、今回の修正は既存距離・解除履歴・通知履歴を再計算しないことを追記する。`docs/architecture.md` のGPS記録フローへ、永続状態読取から原子的コミットまでの境界を追加する。

- [ ] **Step 4: ドキュメント整形を確認する**

Run: `npm run format:check`

Expected: `All matched files use Prettier code style!`

- [ ] **Step 5: 対象テストをまとめて実行する**

Run:

```bash
npm test -- --runInBand \
  src/db/__tests__/database.test.ts \
  src/features/logs/__tests__/locationDistanceDelta.test.ts \
  src/features/logs/__tests__/logRepository.test.ts \
  src/features/location/__tests__/locationRecordingStateRepository.test.ts \
  src/features/location/__tests__/locationObservationRecorder.test.ts \
  src/features/location/__tests__/locationRecordingSession.test.ts \
  src/features/location/__tests__/backgroundLocationTask.test.ts \
  src/features/location/__tests__/visitedCellRepository.test.ts \
  src/features/stayPlaces/__tests__/stayPlaceSnapResolver.test.ts \
  src/ui/hooks/__tests__/useForegroundUserLocation.test.tsx \
  src/features/import/__tests__/importRepository.test.ts \
  src/features/import/__tests__/importRepositoryTransaction.test.ts
```

Expected: 全対象suite PASS。

- [ ] **Step 6: 静的検証を実行する**

Run:

```bash
npm run typecheck
npm run lint
npm run format:check
git diff --check
```

Expected: typecheck PASS、lint error 0、format PASS、`git diff --check` 出力なし。

- [ ] **Step 7: 全Jestを実行する**

Run: `npm test -- --runInBand --silent`

Expected: 全suite / 全test PASS、exit 0。

- [ ] **Step 8: ドキュメントをコミットする**

```bash
git add docs/data-storage.md docs/stay-places.md docs/achievements.md docs/architecture.md
git commit -m "docs(location): GPS吸着状態と距離更新仕様を同期"
```

- [ ] **Step 9: 実機確認項目をPR本文へ転記する**

PR本文の検証欄へ次を未確認チェックとして記載し、実機確認後だけチェックする。

```markdown
- [ ] iOS: バックグラウンド1点配信でも3点目から吸着する
- [ ] iOS: 画面消灯・JSプロセス再生成相当後も吸着を維持する
- [ ] Android: バックグラウンド1点配信でも3点目から吸着する
- [ ] Android: 画面消灯・JSプロセス再生成相当後も吸着を維持する
- [ ] 両OS: 長時間静止しても日別距離が異常増加しない
- [ ] 両OS: Plus解約時は無料版で有効な1件だけへ吸着する
```

---

## PR #163 レビュー対応

### Task 6: Visited Grid補間起点をSQLiteへ永続化

**Files:**

- Modify: `src/db/database.ts`
- Modify: `src/db/__tests__/database.test.ts`
- Modify: `src/features/location/locationRecordingStateRepository.ts`
- Modify: `src/features/location/__tests__/locationRecordingStateRepository.test.ts`
- Modify: `src/features/location/grid/gridInterpolation.ts`
- Modify: `src/features/location/grid/__tests__/gridInterpolation.test.ts`
- Modify: `src/features/location/locationObservationRecorder.ts`
- Modify: `src/features/location/__tests__/locationObservationRecorder.test.ts`
- Modify: `src/features/location/locationRecordingSession.ts`
- Modify: `src/features/location/__tests__/locationRecordingSession.test.ts`
- Modify: `src/features/location/__tests__/backgroundLocationTask.test.ts`
- Modify: `docs/data-storage.md`
- Modify: `docs/architecture.md`

**Interfaces:**

- Produces: `VisitedGridInterpolationPoint = Pick<NewLocationPoint, 'recordedAt' | 'latitude' | 'longitude'>`
- Changes: `getVisitedCellsForLocationPoint(previous: VisitedGridInterpolationPoint | null, next: NewLocationPoint): GridCell[]`
- Extends: `PersistedLocationRecordingState.lastVisitedGridPoint: VisitedGridInterpolationPoint | null`
- Changes: `RecordLocationObservationInput` から `previousVisitedCellPoint` を削除
- Changes: `RecordLocationObservationResult` から `visitedCellPoint` を削除
- Removes: セッションの `getLatestLocationPoint()` と `previousVisitedCellPoint`

- [ ] **Step 1: スキーマと状態リポジトリの失敗テストを書く**

`database.test.ts` で新規CREATEに3列が含まれ、既存DBでは `ensureColumn` 相当の `ALTER TABLE` が各列へ1回だけ実行されることを検証する。`locationRecordingStateRepository.test.ts` では3列が揃う行を点へ変換し、いずれかがNULLなら補間起点をNULLとして扱い、UPSERTで3値を保存することを検証する。

```typescript
expect(createSql).toContain('last_visited_grid_recorded_at TEXT NULL');
expect(createSql).toContain('last_visited_grid_latitude REAL NULL');
expect(createSql).toContain('last_visited_grid_longitude REAL NULL');

expect(state.lastVisitedGridPoint).toEqual({
  recordedAt: '2026-08-23T00:00:10.000Z',
  latitude: 35,
  longitude: 139,
});
```

- [ ] **Step 2: 状態テストを実行してREDを確認する**

Run:

```bash
npm test -- --runInBand src/db/__tests__/database.test.ts src/features/location/__tests__/locationRecordingStateRepository.test.ts
```

Expected: 新しい3列と `lastVisitedGridPoint` が存在せずFAIL。

- [ ] **Step 3: 冪等な列追加と状態変換を実装する**

`location_recording_state` のCREATEへ次を追加し、CREATE後にも `ensureColumn` で既存DBへ追加する。埋め戻しUPDATEは行わない。

```sql
last_visited_grid_recorded_at TEXT NULL,
last_visited_grid_latitude REAL NULL,
last_visited_grid_longitude REAL NULL
```

リポジトリでは3値がすべて非NULLで緯度経度が有限かつ範囲内の場合だけ `lastVisitedGridPoint` を返す。UPSERTではオブジェクトを3列へ展開し、NULLなら3列すべてNULLにする。`gridInterpolation.ts` では補間起点を `VisitedGridInterpolationPoint` として公開し、現在点だけにaccuracy上限を適用する。永続化する起点は、過去にセル更新へ利用できた有効点だけなので再検証不要とする。

`gridInterpolation.test.ts` にはaccuracyを持たない永続補間起点から高速移動セルを補間できるケースを追加する。

- [ ] **Step 4: 別セッションの保存対象外観測を再現するRecorder失敗テストを書く**

1回目の `recordLocationObservation` を保存対象外にし、そのUPSERT状態を次の独立呼び出しの読取値へ渡す。2回目が、最初の有効座標をGrid補間起点に使うことを検証する。

```typescript
expect(mockGetVisitedCells).toHaveBeenNthCalledWith(
  2,
  { recordedAt: first.recordedAt, latitude: first.latitude, longitude: first.longitude },
  expect.objectContaining({ recordedAt: second.recordedAt }),
);
```

同時に、セル生成が0件の観測では以前の補間起点を保持し、stale・duplicateでは状態を書かないテストを維持する。

- [ ] **Step 5: Recorderテストを実行してREDを確認する**

Run: `npm test -- --runInBand src/features/location/__tests__/locationObservationRecorder.test.ts`

Expected: Recorderが入力引数のセッション点を使い、状態へ補間起点を保存しないためFAIL。

- [ ] **Step 6: Recorderを永続補間起点へ接続する**

`previousVisitedCellPoint` 入力を削除し、`persistedState.lastVisitedGridPoint` を `getVisitedCellsForLocationPoint` へ渡す。セル更新できた観測だけ、次の状態へ現在の有効座標と観測日時を保存する。

```typescript
const visitedCells = getVisitedCellsForLocationPoint(persistedState.lastVisitedGridPoint, effectivePoint);
const lastVisitedGridPoint =
  visitedCells.length > 0
    ? { recordedAt: effectivePoint.recordedAt, latitude: effectivePoint.latitude, longitude: effectivePoint.longitude }
    : persistedState.lastVisitedGridPoint;
```

- [ ] **Step 7: セッション状態削除の失敗テストを書く**

`locationRecordingSession.test.ts` でセッション生成時に最新GPS点を取得せず、Recorderへ `previousVisitedCellPoint` を渡さないことを検証する。`backgroundLocationTask.test.ts` は1点ずつ別セッションでもRecorderへ委譲する契約を維持する。

- [ ] **Step 8: セッションからGrid cursorを削除する**

`getLatestLocationPoint` / `toEffectiveLocationPoint` のimport、初期SELECT、`previousVisitedCellPoint` 変数、Recorder結果からの更新を削除する。セッションはバッファ、安定ソート、滞在場所スナップショット、実績処理だけを担当する。

- [ ] **Step 9: ドキュメントを同期する**

`docs/data-storage.md` の状態テーブルへ3列と「既存行を埋め戻さない」規則を追加する。`docs/architecture.md` は、保存判定用最新点とGrid補間起点の両方を観測ごとの排他トランザクション内で読むと記載する。

- [ ] **Step 10: Task 6を検証してコミットする**

Run:

```bash
npm test -- --runInBand src/db/__tests__/database.test.ts src/features/location/__tests__/locationRecordingStateRepository.test.ts src/features/location/grid/__tests__/gridInterpolation.test.ts src/features/location/__tests__/locationObservationRecorder.test.ts src/features/location/__tests__/locationRecordingSession.test.ts src/features/location/__tests__/backgroundLocationTask.test.ts
npm run typecheck
npm run format:check
git diff --check
```

Commit:

```bash
git add src/db/database.ts src/db/__tests__/database.test.ts src/features/location/locationRecordingStateRepository.ts src/features/location/__tests__/locationRecordingStateRepository.test.ts src/features/location/grid/gridInterpolation.ts src/features/location/grid/__tests__/gridInterpolation.test.ts src/features/location/locationObservationRecorder.ts src/features/location/__tests__/locationObservationRecorder.test.ts src/features/location/locationRecordingSession.ts src/features/location/__tests__/locationRecordingSession.test.ts src/features/location/__tests__/backgroundLocationTask.test.ts docs/data-storage.md docs/architecture.md
git commit -m "fix(location): Visited Grid補間起点を永続化"
```

### Task 7: 端末時計巻き戻り後の観測記録を復旧

**Files:**

- Create: `src/features/location/locationObservationOrder.ts`
- Create: `src/features/location/__tests__/locationObservationOrder.test.ts`
- Modify: `src/features/location/locationObservationRecorder.ts`
- Modify: `src/features/location/__tests__/locationObservationRecorder.test.ts`
- Modify: `docs/data-storage.md`

**Interfaces:**

- Produces: `MAX_FUTURE_OBSERVATION_SKEW_MS = 60 * 60 * 1000`
- Produces: `isStaleLocationObservation(lastObservedAt: string | null, recordedAt: string, processedAt: string): boolean`
- Preserves: 信頼できる同時刻・過去観測はstale、未来へ進みすぎた永続ガードは無効

- [ ] **Step 1: 観測順序の失敗テストを書く**

```typescript
it('最終観測日時が処理時刻より1時間を超えて未来ならガードを無効にする', () => {
  expect(isStaleLocationObservation('2026-08-24T12:00:00.000Z', '2026-08-23T12:00:00.000Z', '2026-08-23T12:00:01.000Z')).toBe(false);
});

it('信頼できる最終観測日時以前の観測は古いと判定する', () => {
  expect(isStaleLocationObservation('2026-08-23T12:00:00.000Z', '2026-08-23T11:59:59.000Z', '2026-08-23T12:00:01.000Z')).toBe(true);
});
```

- [ ] **Step 2: 観測順序テストを実行してREDを確認する**

Run: `npm test -- --runInBand src/features/location/__tests__/locationObservationOrder.test.ts`

Expected: モジュールが存在せずFAIL。

- [ ] **Step 3: 純粋な観測順序判定を実装する**

3日時を `Date.parse` し、永続ガードと処理時刻が有限で差が1時間以内の場合だけ、ISO日時の単調増加判定を適用する。不正または1時間超の未来ガードは記録を恒久停止させないため無効とする。

- [ ] **Step 4: Recorder復旧の失敗テストを書く**

未来の `lastObservedAt` と現在の `rawPoint` / `now` を渡し、`stale` にならずGPS点・Grid・状態を更新し、状態の `lastObservedAt` が現在観測へ戻ることを検証する。通常のstaleテストは維持する。

- [ ] **Step 5: Recorderへ観測順序判定を接続する**

直接の文字列比較を `isStaleLocationObservation` へ置き換える。重複観測は同じ配信を3点として数えないため状態・Gridを進めない契約をJSDocへ明記し、既存duplicateテストを維持する。

- [ ] **Step 6: Task 7を検証してコミットする**

Run:

```bash
npm test -- --runInBand src/features/location/__tests__/locationObservationOrder.test.ts src/features/location/__tests__/locationObservationRecorder.test.ts
npm run typecheck
npm run format:check
git diff --check
```

Commit:

```bash
git add src/features/location/locationObservationOrder.ts src/features/location/__tests__/locationObservationOrder.test.ts src/features/location/locationObservationRecorder.ts src/features/location/__tests__/locationObservationRecorder.test.ts docs/data-storage.md
git commit -m "fix(location): 端末時計巻き戻り後の記録を復旧"
```

### Task 8: GPS点挿入と日別距離更新を安全側へ統一

**Files:**

- Modify: `src/features/logs/logRepository.ts`
- Modify: `src/features/logs/__tests__/logRepository.test.ts`
- Modify: `docs/data-storage.md`

**Interfaces:**

- Preserves: `insertLocationPointInCurrentTransaction(...): Promise<InsertedLocationPointResult | null>`
- Removes: 未使用の `insertLocationPoint(point): Promise<number>`
- Changes: 重複だけ `null`、他のSQLite制約違反はreject
- Changes: 既存NULL距離はNULLを維持

- [ ] **Step 1: 制約・NULL距離・不明changesの失敗テストを書く**

`logRepository.test.ts` に次を追加・更新する。

```typescript
expect(insertSql).not.toContain('INSERT OR IGNORE');
expect(insertSql).toContain('ON CONFLICT(recorded_at, latitude, longitude) DO NOTHING');

mockTxn.runAsync.mockRejectedValueOnce(new Error('NOT NULL constraint failed'));
const invalidPoint = { ...point(35, 139), latitude: null as unknown as number };
await expect(insertLocationPointInCurrentTransaction(invalidPoint, '2026-08-23T00:00:30.000Z', mockTxn as never)).rejects.toThrow(
  'NOT NULL constraint failed',
);

expect(dailySql).toContain('WHEN daily_logs.distance_meters IS NULL THEN NULL');
```

`changes` が `undefined` の結果では前後点と日別集計へ進まずNULLを返すこと、前後点SELECTの2回目が1回目の解決後に呼ばれることも検証する。

- [ ] **Step 2: Repositoryテストを実行してREDを確認する**

Run: `npm test -- --runInBand src/features/logs/__tests__/logRepository.test.ts`

Expected: `INSERT OR IGNORE`、COALESCE、成功側フォールバック、並行SELECTのためFAIL。

- [ ] **Step 3: 挿入SQLと結果判定を修正する**

```sql
INSERT INTO location_points (...) VALUES (...)
ON CONFLICT(recorded_at, latitude, longitude) DO NOTHING
```

`(insertResult.changes ?? 0) === 0` ならNULLを返す。これにより一意制約だけ既存データ優先とし、NOT NULLなど他の失敗は例外として呼び出し元へ伝える。

- [ ] **Step 4: 前後点を逐次取得しNULL距離を維持する**

`Promise.all` を2つの `await runner.getFirstAsync` へ置き換える。日別集計の競合更新は次に変更する。

```sql
distance_meters = CASE
  WHEN daily_logs.distance_meters IS NULL THEN NULL
  ELSE daily_logs.distance_meters + excluded.distance_meters
END
```

- [ ] **Step 5: 未使用の単発挿入APIを削除する**

`insertLocationPoint` と、それだけを対象にした例外契約を削除する。距離計算テストは `insertLocationPointInCurrentTransaction` を直接呼ぶ形へ維持し、時系列途中挿入が将来の利用でも壊れない安全網であることをJSDocへ記載する。

- [ ] **Step 6: ドキュメントを同期する**

`docs/data-storage.md` に、一意制約だけが既存データ優先であることと、NULL距離は全点フォールバックのためNULLを維持することを明記する。

- [ ] **Step 7: Task 8を検証してコミットする**

Run:

```bash
npm test -- --runInBand src/features/logs/__tests__/logRepository.test.ts src/features/logs/__tests__/locationDistanceDelta.test.ts src/features/location/__tests__/locationRecordingSession.test.ts
npm run typecheck
npm run format:check
git diff --check
```

Commit:

```bash
git add src/features/logs/logRepository.ts src/features/logs/__tests__/logRepository.test.ts docs/data-storage.md
git commit -m "fix(logs): GPS点挿入とNULL距離更新を安全化"
```

### Task 9: PRレビュー対応の最終検証とスレッド解決

**Files:**

- None: コードとドキュメントはTask 6〜8で確定し、このTaskはread-only検証とGitHubスレッド操作だけを行う

**Interfaces:**

- Consumes: Task 6〜8の確定したスキーマ・観測・GPS保存契約
- Produces: PR #163 headの全体検証証跡と9スレッドへの技術的返信

- [ ] **Step 1: 対象テストをまとめて実行する**

Run:

```bash
npm test -- --runInBand src/db/__tests__/database.test.ts src/features/location/__tests__/locationRecordingStateRepository.test.ts src/features/location/__tests__/locationObservationOrder.test.ts src/features/location/__tests__/locationObservationRecorder.test.ts src/features/location/__tests__/locationRecordingSession.test.ts src/features/location/__tests__/backgroundLocationTask.test.ts src/features/logs/__tests__/logRepository.test.ts src/features/logs/__tests__/locationDistanceDelta.test.ts src/features/location/__tests__/visitedCellRepository.test.ts
```

- [ ] **Step 2: 静的検証と全Jestを実行する**

Run:

```bash
npm run typecheck
npm run lint
npm run format:check
git diff --check
npm test -- --runInBand --silent
```

Expected: 全コマンドexit 0、lint error 0、全suite / test PASS。

- [ ] **Step 3: pushして各レビューへ返信する**

Task 6〜8のコミットを `codex/location-recording-integrity` へpushする。各スレッドへ対応コミットと検証内容を返信する。重複観測のスレッドには、同一観測の再配信だけで3点連続を満たさないため現行挙動を維持し、JSDocとテストで契約を明記したことを説明する。

- [ ] **Step 4: 対応済みスレッドをresolveする**

返信済みの9スレッドだけをresolveし、GraphQLで `isResolved: false` が0件、PR headとローカル/remote headが一致することを確認する。
