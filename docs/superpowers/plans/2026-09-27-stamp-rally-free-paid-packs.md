# スタンプラリー 無料/有料パック区分 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スポット訪問実績（ユーザー向け表示名「スタンプラリー」）のパックに `isFree` フラグを追加し、無料パックは Plus 加入の有無に関わらず誰でも検知・完走できるようにする。有料パックは従来どおり Strollia Plus 限定のまま。パイロットパック「日本三名瀑」を無料パックへ変更する。

**Architecture:** 課金ゲートを「機能全体（Plus か否かの二値）」から「パック単位（`isFree` フラグ × Plus 加入状況）」へ組み替える。検知境界（`landmarkRecordingService.ts`）・UI（`useLandmarkPackState` / `AchievementListScreen`）の両方でこの判定基準を統一する。`LandmarkDetectionSnapshot` から `'disabled'` 状態を廃止し、`'enabled'` の `spots` を「無料パックのスポット ∪（Plus有効なら）有料パックのスポット」というフィルタ結果にする。

**Tech Stack:** Expo ~57 / React Native 0.86 / TypeScript ~6.0 (strict) / expo-router / jest + jest-expo + @testing-library/react-native

**Spec:** `docs/superpowers/specs/2026-09-27-stamp-rally-free-paid-packs-design.md`（前提設計書: `docs/superpowers/specs/2026-09-23-landmark-spot-achievements-design.md`）

## Global Constraints

- コミットは Semantic Commit Message（`type(scope): 日本語の説明`）。type は英語、説明は日本語
- JSDoc は日本語。「何をするか」に加え必要なら「なぜその設計か」も書く
- `describe` / `test` / `it` の説明文は日本語
- import は `@/` エイリアス。`../` を含む相対 import は ESLint error（同一ディレクトリ内は `./`）
- TypeScript strict。`any` を使わない
- **テストで `react-native` モジュール全体を `jest.mock` しないこと**（jest-expo の設定を壊す）
- `src/ui/components/**` での `StyleSheet.create` は ESLint error（本計画では新規スタイル追加なし）
- 各タスクの最後に `npm run typecheck` / `npm test` / `npm run lint` を通してからコミットする。lint は error 0 が合格条件
- 作業ディレクトリは worktree `/Users/kazuki19992/gits/footspot/.worktrees/claude-stamp-rally-free-paid-packs`（ブランチ `claude/stamp-rally-free-paid-packs`）
- 到達通知タイトル「スポットに到達しました！」は変更しない（設計書 §2.2 非対象）
- 個々のパック名（「日本三名瀑」等）は変更しない

---

## File Structure

| ファイル | 変更内容 |
|----------|----------|
| `data/landmarks/landmarkPacks.schema.json` | `isFree: boolean` を必須項目として追加 |
| `data/landmarks/landmarkPacks.json` | 「日本三名瀑」に `"isFree": true` を追加 |
| `scripts/generate-landmark-catalog.mjs` | 生成テンプレートで `isFree` を通す |
| `src/features/landmarks/landmarkCatalog.generated.ts` | 生成物（`npm run generate:landmarks` で再生成） |
| `src/features/landmarks/landmarkCatalog.ts` | `isLandmarkSpotInFreePack` を追加 |
| `src/features/landmarks/landmarkRecordingService.ts` | `LandmarkDetectionSnapshot` から `'disabled'` 廃止。パック単位フィルタへ |
| `src/features/location/locationObservationRecorder.ts` | `'disabled'` 分岐を削除 |
| `src/ui/hooks/useLandmarkPackState.ts` | 全パック表示＋パック単位施錠 |
| `src/ui/components/AchievementListScreen.tsx` | 画面側の先頭1件切り詰めを削除。誘導文の表示条件変更 |
| `src/ui/appText.ts` | セクション見出し・誘導文の文言変更 |
| `docs/achievements.md` / `docs/plus-features.md` / `docs/landmark-spot-packs.md` / `docs/superpowers/specs/2026-09-23-landmark-spot-achievements-design.md` | 記述更新 |

---

## Task 1: `isFree` フラグの追加とスポット単位の無料判定

**Files:**
- Modify: `data/landmarks/landmarkPacks.schema.json`
- Modify: `data/landmarks/landmarkPacks.json`
- Modify: `scripts/generate-landmark-catalog.mjs`
- Modify: `src/features/landmarks/landmarkCatalog.generated.ts`（生成物。手動編集せず Step 4 で再生成する）
- Modify: `src/features/landmarks/landmarkCatalog.ts`
- Test: `src/features/landmarks/__tests__/landmarkCatalog.test.ts`
- Test: `src/features/landmarks/__tests__/landmarkCatalogFreePaid.test.ts`（新規）

**Interfaces:**
- Produces:
  - `GeneratedLandmarkPack.isFree: boolean`（生成物の型）
  - `LandmarkPack.isFree: boolean`（`GeneratedLandmarkPack & { trophyImageUri }` の合成型に自動で乗る。追加の型定義は不要）
  - `isLandmarkSpotInFreePack(spot: LandmarkSpot): boolean`

- [ ] **Step 1: スキーマへ `isFree` を必須項目として追加する**

`data/landmarks/landmarkPacks.schema.json` を以下へ置き換える。

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://strollia.app/schemas/landmarkPacks.schema.json",
  "title": "Strollia landmark packs",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["id", "name", "description", "trophyImage", "sortOrder", "isFree"],
    "additionalProperties": false,
    "properties": {
      "id": {
        "type": "string",
        "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
      },
      "name": { "type": "string", "minLength": 1 },
      "description": { "type": "string", "minLength": 1 },
      "trophyImage": { "type": "string", "pattern": "^[a-z0-9-]+\\.png$" },
      "sortOrder": { "type": "integer", "minimum": 1 },
      "isFree": {
        "type": "boolean",
        "description": "trueなら無料で誰でも到達検知・完走できる。falseならStrollia Plusのサブスクが必要"
      }
    }
  }
}
```

- [ ] **Step 2: パイロットパックを無料に設定する**

`data/landmarks/landmarkPacks.json` を以下へ置き換える。

```json
[
  {
    "id": "01a0c450-6c00-7000-8000-000000000001",
    "name": "日本三名瀑",
    "description": "日本を代表する3つの名瀑",
    "trophyImage": "spots-japan-falls-3.png",
    "sortOrder": 100,
    "isFree": true
  }
]
```

- [ ] **Step 3: 生成スクリプトのテンプレートへ `isFree` を通す**

`scripts/generate-landmark-catalog.mjs` の `packEntries` 生成部分（`packs.map((pack) => { ... })` 内のテンプレート文字列）を編集する。既存の該当ブロックは以下の形。

```js
    return `  {
    id: ${toLiteral(pack.id)},
    name: ${toLiteral(pack.name)},
    description: ${toLiteral(pack.description)},
    // 所属スポット: ${memberNames}
    trophyImage: require('../../../assets/achievements/spots/${pack.trophyImage}'),
    sortOrder: ${pack.sortOrder},
  },`;
```

`sortOrder` の行の直後に `isFree` の行を追加する。

```js
    return `  {
    id: ${toLiteral(pack.id)},
    name: ${toLiteral(pack.name)},
    description: ${toLiteral(pack.description)},
    // 所属スポット: ${memberNames}
    trophyImage: require('../../../assets/achievements/spots/${pack.trophyImage}'),
    sortOrder: ${pack.sortOrder},
    isFree: ${pack.isFree},
  },`;
```

`GeneratedLandmarkPack` 型定義ブロック（同ファイル内、`export type GeneratedLandmarkPack = { ... }`）にも `isFree` を追加する。既存は以下の形。

```js
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
```

`sortOrder` の直後に追加する。

```js
  /** 一覧の表示順。 */
  sortOrder: number;
  /** trueなら無料で誰でも到達検知・完走できる。falseならStrollia Plusのサブスクが必要。 */
  isFree: boolean;
};
```

- [ ] **Step 4: カタログを再生成する**

```bash
npm run generate:landmarks
```

Expected: `landmark catalog を生成しました: ...` と出力され、`src/features/landmarks/landmarkCatalog.generated.ts` の `GENERATED_LANDMARK_PACKS` に `isFree: true` が含まれる。`git diff src/features/landmarks/landmarkCatalog.generated.ts` で確認する。

- [ ] **Step 5: `isLandmarkSpotInFreePack` の失敗するテストを書く**

`src/features/landmarks/__tests__/landmarkCatalogFreePaid.test.ts`（新規）:

```typescript
import { isLandmarkSpotInFreePack } from '@/features/landmarks/landmarkCatalog';

/**
 * 無料パック1件・有料パック1件を差し込んで検証する。
 *
 * パイロットの実マスタには無料パックしか無いため(2026-09-27時点)、
 * 生成物をモックしないと「有料パックのみに属するスポットは無料判定されない」経路をテストできない。
 */
jest.mock('@/features/landmarks/landmarkCatalog.generated', () => ({
  GENERATED_LANDMARK_PACKS: [
    { id: 'pack-free', name: '無料パック', description: '説明', trophyImage: 1, sortOrder: 1, isFree: true },
    { id: 'pack-paid', name: '有料パック', description: '説明', trophyImage: 1, sortOrder: 2, isFree: false },
  ],
  GENERATED_LANDMARK_SPOTS: [
    {
      id: 'spot-free-only',
      name: '無料パックのみに属するスポット',
      prefectures: ['TOKYO'],
      latitude: 35.0,
      longitude: 139.0,
      radiusMeters: 200,
      dwellSeconds: 180,
      packs: [{ packId: 'pack-free', order: 1 }],
    },
    {
      id: 'spot-paid-only',
      name: '有料パックのみに属するスポット',
      prefectures: ['TOKYO'],
      latitude: 35.1,
      longitude: 139.1,
      radiusMeters: 200,
      dwellSeconds: 180,
      packs: [{ packId: 'pack-paid', order: 1 }],
    },
    {
      id: 'spot-both',
      name: '両方のパックに属するスポット',
      prefectures: ['TOKYO'],
      latitude: 35.2,
      longitude: 139.2,
      radiusMeters: 200,
      dwellSeconds: 180,
      packs: [
        { packId: 'pack-free', order: 2 },
        { packId: 'pack-paid', order: 2 },
      ],
    },
  ],
}));

describe('スポットの無料判定 isLandmarkSpotInFreePack', () => {
  it('無料パックのみに属するスポットは無料', () => {
    const { getLandmarkSpotById } = jest.requireActual('@/features/landmarks/landmarkCatalog');
    const spot = getLandmarkSpotById('spot-free-only');

    expect(isLandmarkSpotInFreePack(spot)).toBe(true);
  });

  it('有料パックのみに属するスポットは無料ではない', () => {
    const { getLandmarkSpotById } = jest.requireActual('@/features/landmarks/landmarkCatalog');
    const spot = getLandmarkSpotById('spot-paid-only');

    expect(isLandmarkSpotInFreePack(spot)).toBe(false);
  });

  it('無料パックと有料パックの両方に属するスポットは無料(1つでも無料なら無料)', () => {
    const { getLandmarkSpotById } = jest.requireActual('@/features/landmarks/landmarkCatalog');
    const spot = getLandmarkSpotById('spot-both');

    expect(isLandmarkSpotInFreePack(spot)).toBe(true);
  });
});
```

- [ ] **Step 6: テストを実行して失敗を確認する**

Run: `npm test -- landmarkCatalogFreePaid`
Expected: FAIL（`isLandmarkSpotInFreePack` が存在しない）

- [ ] **Step 7: `isLandmarkSpotInFreePack` を実装する**

`src/features/landmarks/landmarkCatalog.ts` の末尾（`getPackOrder` 関数の前、`parseLandmarkPackCompletionAchievementId` の直後）に追加する。

```typescript
/**
 * スポットが少なくとも1つの無料パックに属するか。
 *
 * スポットは複数パックに属しうる。物理的な場所そのものは1つであり、
 * 無料パックの一部でもある以上、そこへ到達したという事実自体は無料ユーザーにも開いてよい
 * という考え方により、1つでも無料パックに属していれば無料として扱う。
 */
export function isLandmarkSpotInFreePack(spot: LandmarkSpot): boolean {
  return spot.packs.some((membership) => getLandmarkPackById(membership.packId)?.isFree === true);
}
```

- [ ] **Step 8: テストを実行して成功を確認する**

Run: `npm test -- landmarkCatalogFreePaid`
Expected: PASS（3件）

- [ ] **Step 9: 既存の `landmarkCatalog.test.ts` に `isFree` の検証を追加する**

`src/features/landmarks/__tests__/landmarkCatalog.test.ts` を開き、既存のテスト群の末尾（最後の `it` ブロックの直後、`describe` の閉じ括弧の前）に追加する。

```typescript
  it('全パックがisFreeを持つ', () => {
    for (const pack of LANDMARK_PACKS) {
      expect(typeof pack.isFree).toBe('boolean');
    }
  });
```

`LANDMARK_PACKS` が既にこのファイルでimportされていない場合は、既存のimport文へ追加する（既存のimport元は `@/features/landmarks/landmarkCatalog`）。

- [ ] **Step 10: 型チェック・テスト・lintを通す**

```bash
npm run typecheck && npm test && npm run lint
```

- [ ] **Step 11: コミット**

```bash
git add data/landmarks scripts/generate-landmark-catalog.mjs src/features/landmarks
git commit -m "feat(landmarks): パックにisFreeフラグを追加し日本三名瀑を無料化"
```

---

## Task 2: 到達検知ロジックをパック単位のゲートへ組み替え

**Files:**
- Modify: `src/features/landmarks/landmarkRecordingService.ts`
- Test: `src/features/landmarks/__tests__/landmarkRecordingService.test.ts`

**Interfaces:**
- Consumes: Task 1 の `isLandmarkSpotInFreePack`
- Produces:
  - `LandmarkDetectionSnapshot = { status: 'enabled'; spots: readonly LandmarkSpot[]; visitedSpotIds: ReadonlySet<string> } | { status: 'unavailable' }`（`'disabled'` を削除した2値型）

- [ ] **Step 1: 失敗するテストを書く（既存ファイルを全面差し替え）**

`src/features/landmarks/__tests__/landmarkRecordingService.test.ts` を以下へ置き換える。

```typescript
import { getLandmarkDetectionSnapshotForRecording } from '@/features/landmarks/landmarkRecordingService';
import { getVisitedLandmarkSpotIds } from '@/features/landmarks/landmarkVisitRepository';
import { getConfirmedPremiumAccessState } from '@/features/premium/revenueCatAccess';

jest.mock('@/features/premium/revenueCatAccess', () => ({
  getConfirmedPremiumAccessState: jest.fn(),
}));

jest.mock('@/features/landmarks/landmarkVisitRepository', () => ({
  getVisitedLandmarkSpotIds: jest.fn(),
}));

describe('スポット検知の記録境界 landmarkRecordingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getVisitedLandmarkSpotIds as jest.Mock).mockResolvedValue(new Set());
  });

  it('Plus有効なら検知対象のスポットと到達済みIDを返す', async () => {
    (getConfirmedPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: true, entitlementId: 'strollia_plus' });
    (getVisitedLandmarkSpotIds as jest.Mock).mockResolvedValue(new Set(['01a0c450-6c00-7000-8000-000000000101']));

    const snapshot = await getLandmarkDetectionSnapshotForRecording();

    expect(snapshot.status).toBe('enabled');
    if (snapshot.status === 'enabled') {
      expect(snapshot.spots.length).toBeGreaterThan(0);
      expect(snapshot.visitedSpotIds.has('01a0c450-6c00-7000-8000-000000000101')).toBe(true);
    }
  });

  it('Plus無効でも無料パックのスポットは検知対象に含める', async () => {
    // 2026-09-27時点、実マスタのパックは全て無料(日本三名瀑)なので、Plus無効でも空にならない
    (getConfirmedPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: false, entitlementId: 'strollia_plus' });

    const snapshot = await getLandmarkDetectionSnapshotForRecording();

    expect(snapshot.status).toBe('enabled');
    if (snapshot.status === 'enabled') {
      expect(snapshot.spots.length).toBeGreaterThan(0);
    }
  });

  it('取得に失敗した場合はunavailableを返す', async () => {
    (getConfirmedPremiumAccessState as jest.Mock).mockRejectedValue(new Error('offline'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(getLandmarkDetectionSnapshotForRecording()).resolves.toEqual({ status: 'unavailable' });

    expect(warn).toHaveBeenCalledWith('Landmark detection snapshot loading failed:', expect.any(Error));
    warn.mockRestore();
  });

  it('課金状態の取得失敗をPlus無効へ丸めない', async () => {
    // getPremiumAccessState は失敗時に既定状態(本番ではPlus無効)を返すため、
    // そちらを使うと一時的な通信失敗が「無料パックのみ検知」と区別できず誤った制限になる。
    (getConfirmedPremiumAccessState as jest.Mock).mockRejectedValue(new Error('network unreachable'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const snapshot = await getLandmarkDetectionSnapshotForRecording();

    expect(snapshot.status).toBe('unavailable');
    warn.mockRestore();
  });

  describe('無料/有料パックが混在する場合', () => {
    /**
     * 無料パック1件・有料パック1件を差し込んで検証する。
     *
     * 実マスタは全パックが無料のため、有料パックのスポットを除外する経路を
     * テストするには生成物をモックする必要がある。
     */
    beforeEach(() => {
      jest.doMock('@/features/landmarks/landmarkCatalog.generated', () => ({
        GENERATED_LANDMARK_PACKS: [
          { id: 'pack-free', name: '無料パック', description: '説明', trophyImage: 1, sortOrder: 1, isFree: true },
          { id: 'pack-paid', name: '有料パック', description: '説明', trophyImage: 1, sortOrder: 2, isFree: false },
        ],
        GENERATED_LANDMARK_SPOTS: [
          {
            id: 'spot-free',
            name: '無料スポット',
            prefectures: ['TOKYO'],
            latitude: 35.0,
            longitude: 139.0,
            radiusMeters: 200,
            dwellSeconds: 180,
            packs: [{ packId: 'pack-free', order: 1 }],
          },
          {
            id: 'spot-paid',
            name: '有料スポット',
            prefectures: ['TOKYO'],
            latitude: 35.1,
            longitude: 139.1,
            radiusMeters: 200,
            dwellSeconds: 180,
            packs: [{ packId: 'pack-paid', order: 1 }],
          },
        ],
      }));
    });

    afterEach(() => {
      jest.dontMock('@/features/landmarks/landmarkCatalog.generated');
      jest.resetModules();
    });

    it('Plus無効なら無料スポットだけを返し、有料スポットは除く', async () => {
      jest.resetModules();
      const { getLandmarkDetectionSnapshotForRecording: freshFn } = await import('@/features/landmarks/landmarkRecordingService');
      const { getConfirmedPremiumAccessState: freshGetConfirmed } = await import('@/features/premium/revenueCatAccess');
      const { getVisitedLandmarkSpotIds: freshGetVisited } = await import('@/features/landmarks/landmarkVisitRepository');
      (freshGetConfirmed as jest.Mock).mockResolvedValue({ isPlusActive: false, entitlementId: 'strollia_plus' });
      (freshGetVisited as jest.Mock).mockResolvedValue(new Set());

      const snapshot = await freshFn();

      expect(snapshot.status).toBe('enabled');
      if (snapshot.status === 'enabled') {
        const ids = snapshot.spots.map((spot) => spot.id);
        expect(ids).toContain('spot-free');
        expect(ids).not.toContain('spot-paid');
      }
    });

    it('Plus有効なら有料スポットも含める', async () => {
      jest.resetModules();
      const { getLandmarkDetectionSnapshotForRecording: freshFn } = await import('@/features/landmarks/landmarkRecordingService');
      const { getConfirmedPremiumAccessState: freshGetConfirmed } = await import('@/features/premium/revenueCatAccess');
      const { getVisitedLandmarkSpotIds: freshGetVisited } = await import('@/features/landmarks/landmarkVisitRepository');
      (freshGetConfirmed as jest.Mock).mockResolvedValue({ isPlusActive: true, entitlementId: 'strollia_plus' });
      (freshGetVisited as jest.Mock).mockResolvedValue(new Set());

      const snapshot = await freshFn();

      expect(snapshot.status).toBe('enabled');
      if (snapshot.status === 'enabled') {
        const ids = snapshot.spots.map((spot) => spot.id);
        expect(ids).toContain('spot-free');
        expect(ids).toContain('spot-paid');
      }
    });
  });
});
```

**注記（実装者向け）**: `describe('無料/有料パックが混在する場合', ...)` 内は `jest.doMock` + 動的 `import()` + `jest.resetModules()` を使う。ファイル先頭の `jest.mock('@/features/landmarks/landmarkCatalog.generated', ...)` を静的に使うと、ファイル内の他のテスト（実マスタを使う3件）にも同じモックが適用されてしまうため、この1 describeブロックだけ動的にモジュールを切り替える。`jest.resetModules()` によりモジュールキャッシュがクリアされ、`import()` で再読み込みされたモジュールが `doMock` した内容を使う。この手法が初見の場合、Step 2 で必ず実際に PASS することを確認してから次へ進むこと（構文の書き間違いに気づくため）。

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- landmarkRecordingService`
Expected: 既存の `'Plus無効なら検知を行わない'` 相当のテストが無くなり、新テストは実装が古いままなので一部 FAIL する（`'Plus無効でも無料パックのスポットは検知対象に含める'` で `snapshot.status` が `'disabled'` になり FAIL）

- [ ] **Step 3: `LandmarkDetectionSnapshot` と `getLandmarkDetectionSnapshotForRecording` を書き換える**

`src/features/landmarks/landmarkRecordingService.ts` を以下へ全面置き換える。

```typescript
import { getConfirmedPremiumAccessState } from '@/features/premium/revenueCatAccess';

import { getDetectableLandmarkSpots, isLandmarkSpotInFreePack, type LandmarkSpot } from './landmarkCatalog';
import { getVisitedLandmarkSpotIds } from './landmarkVisitRepository';

/**
 * 1配信バッチぶんのスポット検知の対象。
 *
 * `enabled` の `spots` は「無料パックのスポット」∪「Plus有効なら有料パックのスポットも含む」で
 * フィルタ済み。検知の可否はパック単位(`isFree`)で決まるため、機能全体を止める `disabled` 状態は
 * 存在しない。`unavailable` は課金状態取得の一時的失敗を表し、次の正常取得まで滞在状態を保持する。
 */
export type LandmarkDetectionSnapshot =
  | { status: 'enabled'; spots: readonly LandmarkSpot[]; visitedSpotIds: ReadonlySet<string> }
  | { status: 'unavailable' };

/**
 * 記録時点の契約状態に対応するスポット検知の対象を取得する。
 *
 * ProviderやバックグラウンドTaskがDB・課金実装を直接組み合わせないよう、境界をここへ集約する。
 * 無料パックのスポットはPlus加入状況に関わらず常に検知対象へ含め、有料パックのスポットは
 * Plus有効時のみ含める。
 */
export async function getLandmarkDetectionSnapshotForRecording(): Promise<LandmarkDetectionSnapshot> {
  try {
    // getPremiumAccessState ではなく confirmed 版を使う。前者はRevenueCatの取得失敗を
    // 既定状態(本番ではPlus無効)へ丸めるため、一時的な通信失敗と「Plus無効」が区別できず、
    // 有料パックの滞在計測を誤ってリセットしてしまう。ここでは失敗を例外のまま受け取り、
    // 下の catch で unavailable(状態を保持)へ落とす。
    const premiumAccessState = await getConfirmedPremiumAccessState();
    const spots = getDetectableLandmarkSpots().filter(
      (spot) => premiumAccessState.isPlusActive || isLandmarkSpotInFreePack(spot),
    );

    return { status: 'enabled', spots, visitedSpotIds: await getVisitedLandmarkSpotIds() };
  } catch (error: unknown) {
    console.warn('Landmark detection snapshot loading failed:', error);
    return { status: 'unavailable' };
  }
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npm test -- landmarkRecordingService`
Expected: PASS（6件）

- [ ] **Step 5: 型チェック・テスト・lintを通してコミット**

```bash
npm run typecheck && npm test && npm run lint
git add src/features/landmarks
git commit -m "feat(landmarks): 到達検知の可否をパック単位のisFreeで判定するよう変更"
```

---

## Task 3: 記録経路の `disabled` 分岐を削除

**Files:**
- Modify: `src/features/location/locationObservationRecorder.ts`
- Test: `src/features/location/__tests__/locationObservationRecorder.test.ts`
- Test: `src/features/location/__tests__/backgroundLocationTask.test.ts`

**Interfaces:**
- Consumes: Task 2 の `LandmarkDetectionSnapshot`（2値化）

- [ ] **Step 1: `resolveLandmarkArrivalForObservation` から `disabled` 分岐を削除する**

`src/features/location/locationObservationRecorder.ts` 内の該当関数（現状）:

```typescript
function resolveLandmarkArrivalForObservation(
  persistedState: PersistedLocationRecordingState,
  rawPoint: NewLocationPoint,
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
    observation: { latitude: rawPoint.latitude, longitude: rawPoint.longitude, recordedAt: rawPoint.recordedAt },
    spots: detection.spots,
    visitedSpotIds: detection.visitedSpotIds,
  });
}
```

以下へ置き換える（`disabled` の分岐を削除するだけ）。

```typescript
function resolveLandmarkArrivalForObservation(
  persistedState: PersistedLocationRecordingState,
  rawPoint: NewLocationPoint,
  detection: LandmarkDetectionSnapshot,
): { state: LandmarkArrivalState; arrivedSpotId: string | null } {
  if (detection.status === 'unavailable') {
    return { state: toLandmarkArrivalState(persistedState), arrivedSpotId: null };
  }

  return resolveLandmarkArrival({
    state: toLandmarkArrivalState(persistedState),
    observation: { latitude: rawPoint.latitude, longitude: rawPoint.longitude, recordedAt: rawPoint.recordedAt },
    spots: detection.spots,
    visitedSpotIds: detection.visitedSpotIds,
  });
}
```

`INITIAL_LANDMARK_ARRIVAL_STATE` の import がこの関数以外で使われていない場合、未使用importとしてlintエラーになる。`grep -n "INITIAL_LANDMARK_ARRIVAL_STATE" src/features/location/locationObservationRecorder.ts` で他の使用箇所を確認し、無ければimport文からも削除すること。

- [ ] **Step 2: 共有テストヘルパー `input()` の既定値を直す（最重要・最初に行うこと）**

`src/features/location/__tests__/locationObservationRecorder.test.ts` 内、ファイル全体の大半のテスト（スポットと無関係な滞在場所吸着・GPS保存フィルタ・Visited Grid等のテスト）が呼び出す共有ヘルパー関数がある。現状は以下の形。

```typescript
/**
 * 通常の有効滞在場所取得結果を持つ記録入力を作る。
 *
 * スポット検知はPlus限定のため、既定はPlus無効相当の `disabled` とする。
 */
function input(rawPoint: NewLocationPoint): RecordLocationObservationInput {
  return {
    rawPoint,
    activeStayPlaces: { status: 'ready', stayPlaces: [home] },
    landmarkDetection: { status: 'disabled' },
    now: '2026-08-23T01:00:00.000Z',
  };
}
```

**`'disabled'` が型から消えるため、この既定値を直さないとファイル全体がコンパイルエラーになる。** 以下へ置き換える。

```typescript
/**
 * 通常の有効滞在場所取得結果を持つ記録入力を作る。
 *
 * landmarkDetection の既定値は「検知対象のスポットが無い」状態にする。スポットと無関係な
 * テスト(滞在場所吸着・GPS保存フィルタ等)がこの既定値を暗黙に使うため、`enabledLandmarkDetection()`
 * (固定のテスト用スポットを1件含む)を流用せず、必ず spots: [] にして到達判定へ一切干渉しないようにする。
 */
function input(rawPoint: NewLocationPoint): RecordLocationObservationInput {
  return {
    rawPoint,
    activeStayPlaces: { status: 'ready', stayPlaces: [home] },
    landmarkDetection: { status: 'enabled', spots: [], visitedSpotIds: new Set() },
    now: '2026-08-23T01:00:00.000Z',
  };
}
```

このファイル内で `landmarkDetection:` を明示的に上書きしているテスト（`enabledLandmarkDetection()` を使う箇所や `{ status: 'unavailable' }` を渡す箇所など）は、既に個別に上書きしているため今回の変更の影響を受けない。`grep -n "landmarkDetection:" src/features/location/__tests__/locationObservationRecorder.test.ts` で全箇所を確認し、この `input()` 関数定義の1箇所（既定値）以外に `{ status: 'disabled' }` が残っていないことを確認すること。

- [ ] **Step 3: `'Plus無効なら到達を記録せず滞在状態をリセットする'` テストを置き換える**

`src/features/location/__tests__/locationObservationRecorder.test.ts` 内、`describe('スポット到達の記録', ...)` ブロック内の `beforeEach(() => { resetMocksToDefaults(); });` の直後にある以下のテストを探す。

```typescript
  it('Plus無効なら到達を記録せず滞在状態をリセットする', async () => {
    mockGetState.mockResolvedValue({ ...dwellingPersistedState });

    await recordLocationObservation({
      ...input(pointAtHome('2026-08-23T00:05:00.000Z')),
      landmarkDetection: { status: 'disabled' },
    });

    expect(mockInsertLandmarkVisit).not.toHaveBeenCalled();
    expect(mockUpsertState).toHaveBeenCalledWith(
      expect.objectContaining({
        landmarkCandidateSpotId: null,
        landmarkCandidateEnteredAt: null,
        landmarkOutsideCount: 0,
      }),
      '2026-08-23T01:00:00.000Z',
      mockTxn,
    );
  });
```

以下へ置き換える。

```typescript
  it('検知対象のspotsが空なら、2回連続で圏外扱いを経て滞在状態がリセットされる', async () => {
    // 有料パックのスポットしか滞在中でなくPlusが無効になった場合など、
    // spotsからそのスポットが消えると findClosestSpotInRadius が候補を見つけられなくなり、
    // resolveWhileOutside の「2回連続で圏外ならリセット」経路を通る(resolveLandmarkArrival側で
    // 既にテスト済みのため、ここではその経路へ正しく到達することだけを確認する)。
    mockGetState.mockResolvedValue({
      ...dwellingPersistedState,
      landmarkOutsideCount: 1,
    });

    await recordLocationObservation({
      ...input(pointAtHome('2026-08-23T00:05:00.000Z')),
      landmarkDetection: { status: 'enabled', spots: [], visitedSpotIds: new Set() },
    });

    expect(mockInsertLandmarkVisit).not.toHaveBeenCalled();
    expect(mockUpsertState).toHaveBeenCalledWith(
      expect.objectContaining({
        landmarkCandidateSpotId: null,
        landmarkCandidateEnteredAt: null,
        landmarkOutsideCount: 0,
      }),
      '2026-08-23T01:00:00.000Z',
      mockTxn,
    );
  });
```

`dwellingPersistedState` は `landmarkOutsideCount: 0` を前提に定義されている可能性がある。ファイル内で `dwellingPersistedState` の定義を確認し、既に `landmarkOutsideCount` を含んでいる場合は上記の `...dwellingPersistedState, landmarkOutsideCount: 1` のスプレッドで正しく上書きされる。

- [ ] **Step 4: テストを実行して確認する**

Run: `npm test -- locationObservationRecorder`
Expected: PASS（既存件数を維持、新テストも含めて全件成功）

- [ ] **Step 5: `backgroundLocationTask.test.ts` を更新する**

`src/features/location/__tests__/backgroundLocationTask.test.ts` の `jest.mock('@/db/database', () => ({ db: {} }));` を以下へ置き換える。

```typescript
jest.mock('@/db/database', () => ({ db: { getAllAsync: jest.fn().mockResolvedValue([]) } }));
```

**理由**: 旧実装は Plus無効時に `getVisitedLandmarkSpotIds()`（内部で `db.getAllAsync` を呼ぶ）へ到達する前に early return していたため `db: {}` で問題なかった。新実装は Plus無効でも `spots` のフィルタと `getVisitedLandmarkSpotIds()` の呼び出しまで必ず進むため、`db.getAllAsync` が未定義だと例外になり `catch` 節で `unavailable` に化けてテストの期待値と食い違う結果になる。

次に、`'Plus無効ならスポット検知を行わないスナップショットを保存セッションへ渡す'` というテスト（`options.getLandmarkDetection()` が `{ status: 'disabled' }` を期待している箇所）を以下へ置き換える。

```typescript
  it('Plus無効でも無料パックのスポットは検知対象に含めたスナップショットを保存セッションへ渡す', async () => {
    mockGetPremiumAccessState.mockResolvedValue({ isPlusActive: false });

    await definedTask!({ data: { locations: [{ timestamp: 1, coords: {} } as LocationObject] }, error: null });

    const options = mockCreateLocationRecordingSession.mock.calls[0][0] as { getLandmarkDetection: () => Promise<unknown> };
    const snapshot = (await options.getLandmarkDetection()) as { status: string; spots?: unknown[] };

    // 2026-09-27時点、実マスタのパックは全て無料(日本三名瀑)なので、Plus無効でも空にならない
    expect(snapshot.status).toBe('enabled');
    expect(snapshot.spots?.length).toBeGreaterThan(0);
  });
```

- [ ] **Step 6: テストを実行して成功を確認する**

Run: `npm test -- backgroundLocationTask`
Expected: PASS

- [ ] **Step 7: 全体テストと型チェック・lintを通してコミット**

```bash
npm run typecheck && npm test && npm run lint
git add src/features/location
git commit -m "refactor(location): スポット検知のdisabled分岐を削除"
```

---

## Task 4: `useLandmarkPackState` を全パック表示・パック単位施錠へ変更

**Files:**
- Modify: `src/ui/hooks/useLandmarkPackState.ts`
- Modify: `src/ui/hooks/__tests__/useLandmarkPackState.test.tsx`
- Test: `src/ui/hooks/__tests__/useLandmarkPackStateFreePaid.test.tsx`（新規）

**Interfaces:**
- Consumes: Task 1 の `LANDMARK_PACKS[].isFree`

- [ ] **Step 1: `useLandmarkPackState.ts` を書き換える**

`src/ui/hooks/useLandmarkPackState.ts` 内、`landmarkPackItems` を組み立てている `useMemo` ブロック（現状）:

```typescript
  const landmarkPackItems = useMemo<LandmarkPackListItem[]>(() => {
    const progressByPackId = new Map(
      resolveLandmarkPackProgress(new Set(visitedLocalDateBySpotId.keys())).map((progress) => [progress.packId, progress]),
    );
    // 施錠時に表示するパックを表示順の先頭へ固定し、起動ごとに内容が変わらないようにする
    const visiblePacks = isPlusActive ? LANDMARK_PACKS : LANDMARK_PACKS.slice(0, 1);

    return visiblePacks.map((pack) => {
      const progress = progressByPackId.get(pack.id);

      return {
        pack,
        visitedCount: isPlusActive ? (progress?.visitedCount ?? 0) : 0,
        totalCount: progress?.totalCount ?? 0,
        isLocked: !isPlusActive,
      };
    });
  }, [isPlusActive, visitedLocalDateBySpotId]);
```

以下へ置き換える。

```typescript
  const landmarkPackItems = useMemo<LandmarkPackListItem[]>(() => {
    const progressByPackId = new Map(
      resolveLandmarkPackProgress(new Set(visitedLocalDateBySpotId.keys())).map((progress) => [progress.packId, progress]),
    );

    return LANDMARK_PACKS.map((pack) => {
      const progress = progressByPackId.get(pack.id);
      const isLocked = !pack.isFree && !isPlusActive;

      return {
        pack,
        visitedCount: isLocked ? 0 : (progress?.visitedCount ?? 0),
        totalCount: progress?.totalCount ?? 0,
        isLocked,
      };
    });
  }, [isPlusActive, visitedLocalDateBySpotId]);
```

同ファイル内、`useLandmarkPackState` 関数の直前のJSDoc（現状）:

```typescript
/**
 * スポットパックの到達状況を読み込み、実績画面と詳細画面向けの表示データへ組み立てるフック。
 *
 * マスタ(`LANDMARK_PACKS`)を起点に数えるため、マスタから消えたスポットの到達記録が
 * DBに残っていても分子が分母を超えない。
 *
 * @param isPlusActive - Strollia Plusが有効かどうか。無効ならスポット到達を検知していないため、
 *   先頭1パックだけを施錠状態・進捗なしで返す(設計書 §9.8)。
 */
```

以下へ置き換える。

```typescript
/**
 * スポットパックの到達状況を読み込み、実績画面と詳細画面向けの表示データへ組み立てるフック。
 *
 * マスタ(`LANDMARK_PACKS`)を起点に数えるため、マスタから消えたスポットの到達記録が
 * DBに残っていても分子が分母を超えない。
 *
 * @param isPlusActive - Strollia Plusが有効かどうか。無料パック(`pack.isFree`)は常に施錠しない。
 *   有料パックは無効時のみ施錠状態・進捗なしで返す
 *   (`docs/superpowers/specs/2026-09-27-stamp-rally-free-paid-packs-design.md` §6.1)。
 */
```

- [ ] **Step 2: 既存テストのうち「先頭1件だけ施錠」の前提を書き換える**

`src/ui/hooks/__tests__/useLandmarkPackState.test.tsx` 内の以下のテストを探す。

```typescript
  it('Plus無効なら先頭1件だけを施錠状態で返す', async () => {
    const { result } = renderHook(() => useLandmarkPackState(false));

    await waitFor(() => {
      expect(result.current.landmarkPackItems.length).toBe(1);
    });

    expect(result.current.landmarkPackItems[0]?.isLocked).toBe(true);
    // 検知していない期間の進捗を出すと誤解を招くため、到達数は0で返す
    expect(result.current.landmarkPackItems[0]?.visitedCount).toBe(0);
  });
```

以下へ置き換える（実マスタのパックは無料のため、Plus無効でも施錠されず進捗が返る）。

```typescript
  it('Plus無効でも無料パックは施錠されず進捗つきで返る', async () => {
    // 2026-09-27時点、実マスタのパック「日本三名瀑」は無料(isFree: true)
    const { result } = renderHook(() => useLandmarkPackState(false));

    await waitFor(() => {
      expect(result.current.landmarkPackItems[0]?.visitedCount).toBe(1);
    });

    expect(result.current.landmarkPackItems.length).toBe(1);
    expect(result.current.landmarkPackItems[0]?.isLocked).toBe(false);
    expect(result.current.landmarkPackItems[0]?.totalCount).toBe(3);
  });
```

- [ ] **Step 3: テストを実行して確認する**

Run: `npm test -- useLandmarkPackState`
Expected: PASS。`useLandmarkPackStateRetired.test.tsx`（同ディレクトリの既存ファイル）も一緒に流れるが、そちらは無料/有料と無関係なテスト用パックを使っているため影響なし（念のため確認すること）

- [ ] **Step 4: 有料パックの施錠を検証する新規テストを書く**

`src/ui/hooks/__tests__/useLandmarkPackStateFreePaid.test.tsx`（新規）:

```typescript
import { renderHook, waitFor } from '@testing-library/react-native';

import { getLandmarkSpotVisits } from '@/features/landmarks/landmarkVisitRepository';
import { useLandmarkPackState } from '@/ui/hooks/useLandmarkPackState';

jest.mock('@/features/landmarks/landmarkVisitRepository', () => ({
  getLandmarkSpotVisits: jest.fn(),
}));

/**
 * 無料パック1件・有料パック1件を差し込んで検証する。
 *
 * 実マスタは全パックが無料のため(2026-09-27時点)、有料パックの施錠経路をテストするには
 * 生成物をモックする必要がある。
 */
jest.mock('@/features/landmarks/landmarkCatalog.generated', () => ({
  GENERATED_LANDMARK_PACKS: [
    { id: 'pack-free', name: '無料パック', description: '説明', trophyImage: 1, sortOrder: 1, isFree: true },
    { id: 'pack-paid', name: '有料パック', description: '説明', trophyImage: 1, sortOrder: 2, isFree: false },
  ],
  GENERATED_LANDMARK_SPOTS: [
    {
      id: 'spot-free',
      name: '無料スポット',
      prefectures: ['TOKYO'],
      latitude: 35.0,
      longitude: 139.0,
      radiusMeters: 200,
      dwellSeconds: 180,
      packs: [{ packId: 'pack-free', order: 1 }],
    },
    {
      id: 'spot-paid',
      name: '有料スポット',
      prefectures: ['TOKYO'],
      latitude: 35.1,
      longitude: 139.1,
      radiusMeters: 200,
      dwellSeconds: 180,
      packs: [{ packId: 'pack-paid', order: 1 }],
    },
  ],
}));

describe('無料/有料パックが混在するときのuseLandmarkPackState', () => {
  beforeEach(() => {
    (getLandmarkSpotVisits as jest.Mock).mockResolvedValue([]);
  });

  it('Plus無効なら無料パックは施錠されず、有料パックは施錠される', async () => {
    const { result } = renderHook(() => useLandmarkPackState(false));

    await waitFor(() => {
      expect(result.current.landmarkPackItems.length).toBe(2);
    });

    const freeItem = result.current.landmarkPackItems.find((item) => item.pack.id === 'pack-free');
    const paidItem = result.current.landmarkPackItems.find((item) => item.pack.id === 'pack-paid');

    expect(freeItem?.isLocked).toBe(false);
    expect(paidItem?.isLocked).toBe(true);
  });

  it('Plus有効ならどちらも施錠されない', async () => {
    const { result } = renderHook(() => useLandmarkPackState(true));

    await waitFor(() => {
      expect(result.current.landmarkPackItems.length).toBe(2);
    });

    expect(result.current.landmarkPackItems.every((item) => !item.isLocked)).toBe(true);
  });
});
```

- [ ] **Step 5: テストを実行して成功を確認する**

Run: `npm test -- useLandmarkPackStateFreePaid`
Expected: PASS（2件）

- [ ] **Step 6: 型チェック・テスト・lintを通してコミット**

```bash
npm run typecheck && npm test && npm run lint
git add src/ui/hooks
git commit -m "feat(achievements): useLandmarkPackStateを全パック表示+パック単位施錠へ変更"
```

---

## Task 5: `AchievementListScreen` の先頭1件切り詰めと誘導文の表示条件を変更

**Files:**
- Modify: `src/ui/components/AchievementListScreen.tsx`
- Modify: `src/ui/components/__tests__/AchievementListScreenLandmarkPacks.test.tsx`

**Interfaces:**
- Consumes: Task 4 の `LandmarkPackListItem`（フィールドは変更なし）

- [ ] **Step 1: 画面側の先頭1件切り詰めを削除する**

`src/ui/components/AchievementListScreen.tsx` 内、以下の行を探す。

```typescript
  // 施錠中は先頭1件だけを見せる(設計書 §9.8)。表示するパックを固定して起動ごとのブレを避ける
  const visibleLandmarkPackItems = isPlusActive ? landmarkPackItems : landmarkPackItems.slice(0, 1);
```

削除し、以降のJSX内で `visibleLandmarkPackItems` と書かれている箇所（`{visibleLandmarkPackItems.length > 0 ? (` と `{visibleLandmarkPackItems.map((item) => {`）を `landmarkPackItems` へ置き換える。`isLocked` に応じた行の見た目（鍵バッジ・進捗非表示等）は Task 4 でフック側が各パックへ正しく設定するため、この画面のJSX自体（`item.isLocked` を参照している箇所）は変更不要。

- [ ] **Step 2: 誘導文の表示条件を変更する**

同ファイル内、以下の行を探す。

```typescript
              {!isPlusActive ? <DescriptionText styles={styles}>{LANDMARK_PACK_PLUS_PROMOTION_NOTE}</DescriptionText> : null}
```

以下へ置き換える。

```typescript
              {landmarkPackItems.some((item) => item.isLocked) ? (
                <DescriptionText styles={styles}>{LANDMARK_PACK_PLUS_PROMOTION_NOTE}</DescriptionText>
              ) : null}
```

`isLocked` は `!pack.isFree && !isPlusActive` からしか true にならないため、`some(...)` の条件は暗黙に「Plus無効かつ施錠中の有料パックが存在する」場合だけ真になる。`!isPlusActive` を明示的に併記する必要はない。

- [ ] **Step 3: 既存テストを更新する**

`src/ui/components/__tests__/AchievementListScreenLandmarkPacks.test.tsx` 内、`describe('Plus未加入時', ...)` ブロック内の以下のテストを探す。

```typescript
    it('2件以上渡されても先頭1件だけを表示する', () => {
      const secondPackItem: LandmarkPackListItem = {
        ...lockedPackItem,
        pack: { ...lockedPackItem.pack, id: '01a0c450-6c00-7000-8000-000000000002', name: '日本本土四極' },
      };
      renderScreen({ landmarkPackItems: [lockedPackItem, secondPackItem], isPlusActive: false });

      expect(screen.getByText('日本三名瀑')).toBeTruthy();
      expect(screen.queryByText('日本本土四極')).toBeNull();
    });
```

以下へ置き換える（画面側の切り詰めを廃止したため、渡された全件が表示される）。

```typescript
    it('無料パックと有料パックが混在する場合、両方を表示する', () => {
      const freePackItem: LandmarkPackListItem = {
        ...fallsPackItem,
        pack: { ...fallsPackItem.pack, id: '01a0c450-6c00-7000-8000-000000000002', name: '日本本土四極' },
        isLocked: false,
      };
      renderScreen({ landmarkPackItems: [lockedPackItem, freePackItem], isPlusActive: false });

      expect(screen.getByText('日本三名瀑')).toBeTruthy();
      expect(screen.getByText('日本本土四極')).toBeTruthy();
    });

    it('施錠中のパックが1件も無ければ誘導文を表示しない', () => {
      const freePackItem: LandmarkPackListItem = { ...fallsPackItem, isLocked: false };
      renderScreen({ landmarkPackItems: [freePackItem], isPlusActive: false });

      expect(screen.queryByText(LANDMARK_PACK_PLUS_PROMOTION_NOTE)).toBeNull();
    });
```

同じ `describe` 内の既存テスト `'他のパックの存在を伝える誘導文を表示する'` はそのまま残す（`lockedPackItem` 1件だけを渡しているので `isLocked: true` が1件存在し、誘導文が出る挙動は変わらない）。

- [ ] **Step 4: テストを実行して確認する**

Run: `npm test -- AchievementListScreenLandmarkPacks`
Expected: PASS

- [ ] **Step 5: 型チェック・テスト・lintを通してコミット**

```bash
npm run typecheck && npm test && npm run lint
git add src/ui/components
git commit -m "feat(achievements): 実績画面のスポットセクションを全パック表示へ変更"
```

---

## Task 6: 表示文言の変更とドキュメント更新

**Files:**
- Modify: `src/ui/appText.ts`
- Modify: `src/ui/components/__tests__/AchievementListScreenLandmarkPacks.test.tsx`（見出し文言の期待値。必要な場合のみ）
- Modify: `docs/achievements.md`
- Modify: `docs/plus-features.md`
- Modify: `docs/landmark-spot-packs.md`
- Modify: `docs/superpowers/specs/2026-09-23-landmark-spot-achievements-design.md`

**Interfaces:**
- Consumes: なし（文言・ドキュメントのみ）

- [ ] **Step 1: `appText.ts` の文言を変更する**

`src/ui/appText.ts` 内、以下のブロックを探す。

```typescript
/**
 * 実績画面のスポットセクション見出し。
 *
 * Plus限定機能であることを見出しで示し、無料ユーザーが施錠の理由を推測しなくて済むようにする。
 */
export const LANDMARK_PACK_SECTION_TITLE = 'スポット (Strollia Plus)';

/**
 * Plus未加入時にスポットセクションの下へ出す誘導文。
 *
 * 表示しているのは先頭1パックだけなので、他にもパックがあることを伝える。
 * 現時点で提供しているのは1パックのみのため、具体的なパック名や総数は書かない。
 */
export const LANDMARK_PACK_PLUS_PROMOTION_NOTE = 'Strollia Plus なら、今後追加されるスポットパックもすべて集められます';
```

以下へ置き換える。

```typescript
/**
 * 実績画面のスポットセクション見出し。
 *
 * 「スタンプラリー」は機能全体のユーザー向けブランド名。無料パックと有料パックが混在するため、
 * セクション全体にPlus限定のラベルは付けない(施錠有無は行ごとの鍵アイコンで示す)。
 */
export const LANDMARK_PACK_SECTION_TITLE = 'スタンプラリー';

/**
 * Plus未加入時、施錠中のパックが1件以上あるときだけスポットセクションの下へ出す誘導文。
 *
 * 無料パックしか無い(施錠中のパックが0件の)ときはこの誘導文自体を表示しない。
 */
export const LANDMARK_PACK_PLUS_PROMOTION_NOTE = 'Strollia Plus なら、有料のスタンプラリーもすべて集められます';
```

- [ ] **Step 2: テストを実行し、文言変更で壊れたテストを直す**

Run: `npm test -- AchievementListScreenLandmarkPacks`

`LANDMARK_PACK_SECTION_TITLE` / `LANDMARK_PACK_PLUS_PROMOTION_NOTE` は定数importで参照しているテストなので、文言自体を変えても多くは自動的に追従する。もし `'Plus限定であることを示す見出しを表示する'` のようなテストタイトルが新しい文言の意味と食い違う場合は、タイトルだけ以下のように直す（アサーション自体は `LANDMARK_PACK_SECTION_TITLE` を参照しているので変更不要）。

```typescript
  it('セクション見出しを表示する', () => {
    renderScreen();

    expect(screen.getByText(LANDMARK_PACK_SECTION_TITLE)).toBeTruthy();
  });
```

- [ ] **Step 3: `docs/achievements.md` を更新する**

`docs/achievements.md` の `### 14.1 位置づけ` を以下へ置き換える。

```markdown
### 14.1 位置づけ

スポット実績（ユーザー向け表示名「スタンプラリー」）は、パック単位で無料/有料を分ける。
パックの `isFree` フラグが true なら誰でも到達検知・完走できる。false なら Strollia Plus のサブスクが必要。
詳細は `docs/superpowers/specs/2026-09-27-stamp-rally-free-paid-packs-design.md` を参照する。

無料パックは Plus 加入状況に関わらず常に検知する。有料パックは Plus が無効な間は検知しない。
到達記録は解約後も削除せず、再加入すればそのまま続きから集められる。
```

`### 14.5 画面` 内の以下の行を探す。

```markdown
- 実績一覧(`/achievements`)の既存グリッドの下に「スポット (Strollia Plus)」セクションをリスト形式で追加する
```

以下へ置き換える。

```markdown
- 実績一覧(`/achievements`)の既存グリッドの下に「スタンプラリー」セクションをリスト形式で追加する
```

同じ `### 14.5 画面` 内の以下の行を探す。

```markdown
- Plus未加入時は表示順の先頭1パックだけを施錠表示し、進捗は出さない。行タップでペイウォールへ遷移する
```

以下へ置き換える。

```markdown
- Plus未加入時は全パックを表示し、有料パック(`isFree: false`)だけを施錠表示にする。無料パックは進捗つきで通常表示する。施錠中の行タップでペイウォールへ遷移する
```

同じ `### 14.5 画面` 内、以下の行（既に埋め込み地図PR以降の実装と食い違っている、この変更とは別の既存の記述ずれ。ついでに直す）を探す。

```markdown
- パック詳細の行タップは、到達済みならその日の日別記録詳細へ、未到達なら地図画面でそのスポットを中心表示する
  - 未到達スポットの地図表示では現在地追従をOFFにする(現在地へ引き戻されないようにするため)
```

以下へ置き換える。

```markdown
- パック詳細の行タップは、到達済みならその日の日別記録詳細へ、未到達なら画面内の埋め込み地図がそのスポットへズームする(メイン地図への画面遷移はしない)
```

- [ ] **Step 4: `docs/plus-features.md` を更新する**

`### 2.3 スポット訪問実績` を以下へ置き換える。

```markdown
### 2.3 スポット訪問実績(スタンプラリー)

日本三名瀑や現存天守十二城といった「スポットの集合(パック)」を集めて完走する実績。ユーザーには「スタンプラリー」という名称で見せる。
パック単位で無料/有料を分け、無料パックは誰でも使える(客寄せ・将来の企業コラボの受け皿)。仕様は `docs/achievements.md` §14、設計判断は `docs/superpowers/specs/2026-09-23-landmark-spot-achievements-design.md` と `docs/superpowers/specs/2026-09-27-stamp-rally-free-paid-packs-design.md` を参照する。

Plus限定にする範囲は**有料パックのスポット到達の検知**である。無料パックはPlus加入状況に関わらず常に検知する。有料パックはPlusが無効な間はGPS観測時の到達判定を行わないため、進捗も増えない。

解約時の扱いは以下とする。

- すでに記録した到達(`landmark_spot_visits`)と解除済みの完走実績は削除しない
```

（末尾の箇条書きが続く場合は、既存の後続行をそのまま残すこと。上記の最後の1行以降に既存の内容が続いていれば削除しないこと。ファイルを実際に読んで確認してから編集すること。）

- [ ] **Step 5: `docs/landmark-spot-packs.md` へ無料/有料パックの選定方針を追記する**

`## 3. 採用可否の判断基準` の節の末尾（`## 4. 候補カタログ` の直前）に以下を追加する。

```markdown
### 3.1 無料/有料パックの選定方針

パックは `isFree` フラグで無料/有料を分ける。

- **既定は有料**とする。新しいパックを追加するときは、明示的な理由が無い限り `isFree: false` にする
- 無料パックは**1〜2個の客寄せ目的に留める**。無料の点数を増やしすぎるとPlus加入の動機が薄れる
- 将来の企業コラボ・広告タイアップのスタンプラリー企画は、無料パックの一形態として追加する想定(新しい仕組みは不要)
- 一度有料で公開したパックを無料へ切り替えることはできるが、逆(無料→有料)は既存ユーザーの不利益になるため避ける
```

- [ ] **Step 6: 初版設計書へ相互参照を追記する**

`docs/superpowers/specs/2026-09-23-landmark-spot-achievements-design.md` の `### 3.2 非対象` テーブル内、以下の行を探す。

```markdown
| 無料ユーザーへの到達検知     | Plus限定機能のため、検知自体を行わない                                                     |
```

以下へ置き換える。

```markdown
| 無料ユーザーへの到達検知     | Plus限定機能のため、検知自体を行わない。**2026-09-27にパック単位の無料/有料区分を導入し、無料パックは検知するよう変更した。詳細は `docs/superpowers/specs/2026-09-27-stamp-rally-free-paid-packs-design.md` を参照** |
```

`### 4.1 Plus限定` の節の末尾に以下を追記する。

```markdown
**2026-09-27 追記**: パック単位の `isFree` フラグを導入し、無料パックは上記の限定から外れる。詳細は `docs/superpowers/specs/2026-09-27-stamp-rally-free-paid-packs-design.md` を参照する。
```

- [ ] **Step 7: 全体の検証**

```bash
npm run generate:landmarks
npm run typecheck
npm test
npm run lint
npm run format:check
```

すべて成功すること。`npm run format:check` で差分が出た場合は `npx prettier --write <該当ファイル>` を実行してから再確認する。

- [ ] **Step 8: コミット**

```bash
git add src/ui/appText.ts src/ui/components/__tests__ docs
git commit -m "docs: スタンプラリーの文言変更とisFree区分をドキュメントへ反映"
```

- [ ] **Step 9: PRを作成する**

```bash
git push -u origin claude/stamp-rally-free-paid-packs
```

`develop` をベースに Open PR として作成する。description は日本語で、変更内容・理由・影響範囲・検証結果を含める。

---

## Self-Review

**Spec coverage:**

| 設計書の節 | 実装タスク |
|------------|-----------|
| §3 表示文言 | Task 6 |
| §4 `isFree` フラグ | Task 1 |
| §5 検知ロジックの組み替え | Task 2・Task 3 |
| §6 UI(全パック表示・パック単位施錠) | Task 4・Task 5 |
| §7 将来構想 | 実装対象外（設計書に記録済み、追加作業なし） |
| §8 ドキュメント更新 | Task 6 |
| §9 テスト方針 | 各タスクのテストステップ |

**既知の制約:**
- 実マスタには現時点で有料パックが1件も無い（既存パックは全て無料化した唯一の「日本三名瀑」のみ）。有料パックの施錠経路は Task 2・Task 4 でモック化したテストのみが検証しており、実データでの動作確認は今後有料パックを追加した時点で行うことになる
- Task 2 Step 1 の `jest.doMock` + 動的 `import()` パターンは、既存テストが `LandmarkDetectionSnapshot` を静的 import で使っているファイル内で「一部のテストだけ別カタログを使う」ための対応。実装者は他の類似ファイル（`landmarkCatalogFreePaid.test.ts`・`useLandmarkPackStateFreePaid.test.tsx`）のような**ファイルを分ける**方式のほうが単純だと判断すれば、そちらへ変更してよい（テスト内容が同等であれば構造は問わない）
