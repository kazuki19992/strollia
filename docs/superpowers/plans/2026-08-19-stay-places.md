# 滞在場所設定 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 滞在場所ごとのGPS吸着補正と共有ルートのプライバシー除外を、無料版1件・Plus複数件、Twemojiアイコン付きで提供する。

**Architecture:** 生GPSは既存列に保持し、記録時の有効座標を追加列へ固定保存する。契約判定・吸着・共有範囲分割を純粋関数に分離し、共有画面だけが複数Polylineを描く。

**Tech Stack:** TypeScript、React Native、Expo Router、Expo SQLite、Expo Location、react-native-maps、Emojibase Data、Twemoji assets、RevenueCat、Jest

**Spec:** docs/superpowers/specs/2026-08-19-stay-places-design.md

## Global Constraints

- 実装開始前に using-git-worktrees、db-schema-change、add-screen、add-setting、premium-gate、test-driven-development を読む。
- 生座標は latitude / longitude に残す。過去ログを再計算しない。GPX出力は生座標、GPXインポートは非吸着で有効座標＝生座標。
- 無料版・解約中は作成日時順の先頭1件、Plus中は全件を有効にする。解約でレコードを変更・削除しない。
- icon_hexcode は生成済みカタログの許可値だけを保存する。ショートコード・Unicode文字列・URIを保存しない。
- Emojibaseはlockfile固定・ビルド時生成だけに使い、実行時CDNアクセスを禁止する。Twemoji画像は同梱し、帰属を追加する。
- 新規画面は薄いルート、components UI、AppStateProvider状態で構成する。日本語アクセシビリティラベルと既存テーマを使う。
- 最後に npm run typecheck、npm test -- --runInBand、npm run lint、npm run format:check を実行する。

---

## File Structure

- Create: scripts/generate-stay-place-emoji-catalog.mjs、src/features/stayPlaces/stayPlaceEmojiCatalog.generated.ts、stayPlaceEmojiCatalog.ts
- Create: src/features/stayPlaces/stayPlaceTypes.ts、stayPlaceRepository.ts、stayPlaceAccess.ts、stayPlaceSnapResolver.ts、privacyRouteSegments.ts
- Create: src/features/location/effectiveLocationPoint.ts
- Create: src/app/settings/stay-places/{index,new,[id]}.tsx、src/ui/components/{StayPlacesScreen,StayPlaceEditorScreen,StayPlaceIconPicker}.tsx
- Modify: package files、database.ts、gps.ts、log/import/export/recording/map repositories、AppStateProvider、settings/router/text/style/Sentry mapping、share components、licenses/docs and all related tests

### Task 1: Emojibase由来の固定Twemojiカタログ

**Files:** Create generator, generated catalog, catalog resolver, its test and 12 local Twemoji assets. Modify package files and generated licenses.

**Interfaces:**

    export type StayPlaceEmoji = { hexcode: string; label: string; unicode: string; asset: ImageSourcePropType };
    export const STAY_PLACE_EMOJIS: readonly StayPlaceEmoji[];
    export function isStayPlaceEmojiHexcode(value: string): boolean;
    export function getStayPlaceEmoji(value: string): StayPlaceEmoji | null;

- [ ] **Step 1: Write the failing test**

  ```ts
  test('固定カタログは重複しない完全修飾hexcodeだけを公開する', () => {
    expect(STAY_PLACE_EMOJIS).toHaveLength(12);
    expect(new Set(STAY_PLACE_EMOJIS.map((item) => item.hexcode)).size).toBe(12);
  });
  test('未知の値は保存対象にしない', () => expect(isStayPlaceEmojiHexcode('UNKNOWN')).toBe(false));
  ```

- [ ] **Step 2: Run RED** — `npm test -- --runInBand src/features/stayPlaces/__tests__/stayPlaceEmojiCatalog.test.ts`. Expected: module missing.
- [ ] **Step 3: Implement** — Add pinned emojibase-data devDependency. The generator reads only the emojibase shortcode preset, resolves the selected 12 icons, and fails for missing, duplicate, changed mappings or assets. Commit literal Metro require calls and local assets; run npm run generate:licenses.
- [ ] **Step 4: Run GREEN** — `node scripts/generate-stay-place-emoji-catalog.mjs`; `npm test -- --runInBand src/features/stayPlaces/__tests__/stayPlaceEmojiCatalog.test.ts`; `npm run generate:licenses`. Expected: pass and no generated diff.
- [ ] **Step 5: Commit** — git commit -m "feat(stay-places): Twemojiアイコンカタログを追加".

### Task 2: 滞在場所のSQLiteスキーマとCRUD

**Files:** Create stayPlaceTypes.ts, stayPlaceRepository.ts, repository test. Modify src/db/database.ts, logRepository.ts and database/log tests.

**Interfaces:**

    export type StayPlace = { id: number; name: string; iconHexcode: string; latitude: number; longitude: number; privacyRadiusMeters: number | null; createdAt: string; updatedAt: string };
    export type SaveStayPlaceInput = Omit<StayPlace, 'id' | 'createdAt' | 'updatedAt'>;
    export async function getStayPlaces(): Promise<StayPlace[]>;
    export async function createStayPlace(input: SaveStayPlaceInput): Promise<number>;
    export async function updateStayPlace(id: number, input: SaveStayPlaceInput): Promise<void>;
    export async function deleteStayPlace(id: number): Promise<void>;

- [ ] **Step 1: Write failing tests**

  ```ts
  await expect(
    createStayPlace({ name: '', iconHexcode: '1F3E0', latitude: 35, longitude: 139, privacyRadiusMeters: null }),
  ).rejects.toThrow('滞在場所名');
  expect(mockTxn.runAsync).not.toHaveBeenCalled();
  expect(await getStayPlaces()).toEqual([oldest, newest]);
  ```

  Cover allowed radius/icon/coordinates, created_at ASC then id ASC, transaction use, and deleteAllUserData deletion.

- [ ] **Step 2: Run RED** — `npm test -- --runInBand src/features/stayPlaces/__tests__/stayPlaceRepository.test.ts`.
- [ ] **Step 3: Implement** — Create stay_places and a created_at/id index. Use withExclusiveTransaction, validate before SQL, and do not create a sort order or contract flag.
- [ ] **Step 4: Run GREEN** — same test command. Expected: PASS.
- [ ] **Step 5: Commit** — git commit -m "feat(db): 滞在場所をSQLiteへ保存".

### Task 3: 契約有効化・吸着・有効座標の純粋ロジック

**Files:** Create stayPlaceAccess.ts, stayPlaceSnapResolver.ts, effectiveLocationPoint.ts and focused tests.

**Interfaces:**

    export function resolveActiveStayPlaces(stayPlaces: StayPlace[], isPlusActive: boolean): StayPlace[];
    export type StayPlaceSnapState = { activeStayPlaceId: number | null; candidateStayPlaceId: number | null; candidateCount: number; outsideCount: number };
    export const INITIAL_STAY_PLACE_SNAP_STATE: StayPlaceSnapState;
    export function resolveStayPlaceSnap(input: { state: StayPlaceSnapState; raw: RouteCoordinate; activeStayPlaces: StayPlace[] }): { state: StayPlaceSnapState; effective: RouteCoordinate; snappedStayPlaceId: number | null };
    export function toEffectiveLocationPoint(point: LocationPoint): LocationPoint;

- [ ] **Step 1: Write failing tests**

  ```ts
  expect(resolveActiveStayPlaces([newest, oldest], false)).toEqual([oldest]);
  expect(resolveStayPlaceSnap({ state: stateAfterTwoInside, raw: inside50m, activeStayPlaces: [home] }).effective).toEqual({
    latitude: home.latitude,
    longitude: home.longitude,
  });
  ```

  Cover entry/exit third point, 50m inclusive, overlap nearest centre and created/id tie break, entitlement removal, restart initial state, and invalid effective fallback.

- [ ] **Step 2: Run RED** — `npm test -- --runInBand src/features/stayPlaces/__tests__/stayPlaceAccess.test.ts src/features/stayPlaces/__tests__/stayPlaceSnapResolver.test.ts src/features/location/__tests__/effectiveLocationPoint.test.ts`.
- [ ] **Step 3: Implement** — Use distanceMeters. Never change preceding points. Entry and exit switch only at the third point. Effective mapper adopts both valid effective fields or raw fields.
- [ ] **Step 4: Run GREEN** — same command. Expected: PASS.
- [ ] **Step 5: Commit** — git commit -m "feat(location): 滞在場所の吸着判定を追加".

### Task 4: 記録・距離・Visited Gridへ有効座標を接続

**Files:** Modify database.ts, gps.ts, logRepository.ts, locationRecordingSession.ts, importRepository.ts, gpxExporter.ts and their tests.

**Interfaces:**

    type LocationPoint = { effectiveLatitude: number | null; effectiveLongitude: number | null; snappedStayPlaceId: number | null; /* existing fields */ };
    export async function createLocationRecordingSession(options?: { getActiveStayPlaces?: () => Promise<StayPlace[]> }): Promise<LocationRecordingSession>;

- [ ] **Step 1: Write failing tests**

  ```ts
  expect(mockInsertLocationPoint).toHaveBeenCalledWith(
    expect.objectContaining({
      latitude: raw.latitude,
      longitude: raw.longitude,
      effectiveLatitude: home.latitude,
      effectiveLongitude: home.longitude,
    }),
  );
  expect(gpxXml).toContain('lat="35.000000"');
  ```

  Also require GPX import not to call the resolver and to insert raw/effective equal; daily distance and grid must use effective coordinates.

- [ ] **Step 2: Run RED** — `npm test -- --runInBand src/features/location/__tests__/locationRecordingSession.test.ts src/features/logs/__tests__/logRepository.test.ts src/features/import/__tests__/importRepository.test.ts src/features/export/__tests__/gpxExporter.test.ts`.
- [ ] **Step 3: Implement** — Add three nullable columns with ensureColumn. Session obtains active places per point, keeps snap state in its closure, validates quality/time with raw points, and uses effective points for filter/distance/grid. GPX INSERT writes raw as effective with null snap ID. Do not change GPX exporter field references.
- [ ] **Step 4: Run GREEN** — same command. Expected: PASS.
- [ ] **Step 5: Commit** — git commit -m "feat(location): 有効座標でGPS記録を補正".

### Task 5: 共有専用のプライバシー区間分割

**Files:** Create privacyRouteSegments.ts and tests. Modify routeMapper.ts, RouteMapPanel.tsx, DailyLogShareCard.tsx, GifFrameRenderer.tsx, DailyLogDetailScreen.tsx, MonthlyReportScreen.tsx and tests.

**Interfaces:**

    export function toPrivacyRouteSegments(points: LocationPoint[], activeStayPlaces: StayPlace[]): RouteSegment[];

- [ ] **Step 1: Write failing tests**

  ```ts
  expect(
    toPrivacyRouteSegments([visibleA, visibleB, hidden, visibleC, visibleD], [home100m]).map((segment) => segment.coordinates),
  ).toEqual([
    [toCoordinate(visibleA), toCoordinate(visibleB)],
    [toCoordinate(visibleC), toCoordinate(visibleD)],
  ]);
  ```

  Cover null radius, boundary, multiple places, all points hidden, and existing abnormal gaps.

- [ ] **Step 2: Run RED** — `npm test -- --runInBand src/features/stayPlaces/__tests__/privacyRouteSegments.test.ts src/features/map/__tests__/routeMapper.test.ts`.
- [ ] **Step 3: Implement** — Convert normal routes through effective coordinates. First use existing abnormal-gap splitting, then split each segment when a point is inside any active non-null radius; drop segments shorter than two. Share image/GIF/monthly map renderers map segments to independent Polyline elements. Normal maps remain unredacted.
- [ ] **Step 4: Run GREEN** — `npm test -- --runInBand src/features/stayPlaces/__tests__/privacyRouteSegments.test.ts src/ui/components/__tests__/DailyLogDetailScreen.test.tsx src/ui/components/reports/__tests__/MonthlyReportScreen.test.tsx`.
- [ ] **Step 5: Commit** — git commit -m "feat(share): 滞在場所のプライバシー範囲を適用".

### Task 6: AppState・設定導線・Plus上限

**Files:** Modify AppStateProvider.tsx, app layout/settings index, SettingsScreen.tsx, pathnameToScreenMode.ts, appText.ts. Create provider/settings/router tests.

**Interfaces:**

    type AppStateContextValue = {
      stayPlaces: StayPlace[];
      activeStayPlaces: StayPlace[];
      openStayPlaces: () => void;
      createStayPlace: (input: SaveStayPlaceInput) => Promise<void>;
      updateStayPlace: (id: number, input: SaveStayPlaceInput) => Promise<void>;
      deleteStayPlace: (id: number) => Promise<void>;
    };

- [ ] **Step 1: Write failing tests**

  ```ts
  await result.current.createStayPlace(first);
  await result.current.createStayPlace(second);
  expect(mockCreateStayPlace).toHaveBeenCalledTimes(1);
  expect(mockOpenPremiumPaywall).toHaveBeenCalledTimes(1);
  ```

- [ ] **Step 2: Run RED** — `npm test -- --runInBand src/ui/state/__tests__/stayPlaceState.test.tsx src/ui/components/__tests__/SettingsScreen.test.tsx src/app/__tests__/routerLayout.test.tsx`.
- [ ] **Step 3: Implement** — Provider owns reload and active-list memoization from premiumAccessState.isPlusActive. Free second add opens existing paywall before DB. Add Settings row, navigator route and Sentry mapping. Contract state never writes/deletes rows.
- [ ] **Step 4: Run GREEN** — same command. Expected: PASS.
- [ ] **Step 5: Commit** — git commit -m "feat(settings): 滞在場所の設定導線を追加".

### Task 7: 一覧・編集・固定アイコン選択画面

**Files:** Create three route wrappers and StayPlacesScreen.tsx, StayPlaceEditorScreen.tsx, StayPlaceIconPicker.tsx with tests. Modify appStyles.ts and settings layout.

- [ ] **Step 1: Write failing tests**

  ```ts
  fireEvent.press(screen.getByLabelText('滞在場所を追加'));
  expect(onOpenPremiumPaywall).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByLabelText('家のアイコンを選択'));
  fireEvent.press(screen.getByLabelText('滞在場所を保存'));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ iconHexcode: '1F3E0' }));
  ```

  Test fixed centre marker, empty name rejection, delete, first-created active label and subsequent Plus label.

- [ ] **Step 2: Run RED** — `npm test -- --runInBand src/ui/components/__tests__/StayPlacesScreen.test.tsx src/ui/components/__tests__/StayPlaceEditorScreen.test.tsx src/app/__tests__/stayPlaceRoutes.test.tsx`.
- [ ] **Step 3: Implement** — Build list-style UI with no reorder control. Editor uses catalog picker and MapView with an overlay fixed centre marker; only onRegionChangeComplete writes the centre. Do not reverse-geocode. Use app styles/text and Japanese accessibility labels.
- [ ] **Step 4: Run GREEN** — same command. Expected: PASS.
- [ ] **Step 5: Commit** — git commit -m "feat(settings): 滞在場所の編集画面を追加".

### Task 8: 全体回帰・文書・実機検証

**Files:** Modify todo, monetization, plus features and affected product docs; add integration tests.

- [ ] **Step 1: Add final regressions** — normal maps use effective coordinates; only shares use privacy segments; cancel/re-subscribe preserves rows; GPX emits raw coordinates.
- [ ] **Step 2: Run targeted RED/GREEN** — `npm test -- --runInBand src/features/stayPlaces src/features/location src/features/map src/ui/components/__tests__/DailyLogDetailScreen.test.tsx src/ui/components/reports/__tests__/MonthlyReportScreen.test.tsx`. Fix failures without weakening assertions.
- [ ] **Step 3: Update docs/manual checklist** — document entitlement rules, raw GPS, GPX, privacy-only shares, licenses, and iOS/Android three-point 50m entry/exit, Plus cancel/re-subscribe, and daily image/GIF/monthly non-bridging validation.
- [ ] **Step 4: Run final verification**

  ```sh
  npm run typecheck
  npm test -- --runInBand
  npm run lint
  npm run format:check
  ```

  Expected: exit 0 for each command.

- [ ] **Step 5: Commit** — git commit -m "docs: 滞在場所設定の検証手順を追加".
