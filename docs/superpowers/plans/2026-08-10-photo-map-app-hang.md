# 写真マップ App Hang 解消(Phase 1)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 写真ライブラリからの `getAssetInfoAsync` 一斉並列呼び出し(200並列)を少数の同時実行数へ制限し、メインスレッドが JPEG デコードで2秒以上ブロックされる App Hang を解消する。

**Architecture:** `src/utils/concurrency.ts` に純粋な汎用ヘルパー `mapWithConcurrency` を新設し、`src/features/photos/photoLibrary.ts` の `loadGeotaggedPhotos` 内の `Promise.allSettled` をこのヘルパー経由の呼び出しへ差し替える。ネイティブコードには触れない。

**Tech Stack:** TypeScript / Jest / expo-media-library(モック対象)

## Global Constraints

- コミットメッセージは Semantic Commit Message(`type(scope): 日本語の説明`)。type は英語、説明は日本語(`AGENTS.md` §1)
- コード追加・変更には対応するテストを必ず用意する(`AGENTS.md` §2)
- 関数・型・自明でない変数には日本語 JSDoc を付ける。「なぜその設計にしているか」も書く(`AGENTS.md` §8)
- テストの `describe`/`test`/`it` 説明文は日本語(`AGENTS.md` §9)
- `../` を含む相対 import は禁止。`@/` パスエイリアスを使う(`.ai/context/conventions.md`)
- 各タスクのコミット前に `npm run typecheck` と該当テストを実行する
- 対象は `docs/superpowers/specs/2026-08-10-photo-map-app-hang-design.md` の Phase 1 のみ。Phase 2(表示上限撤廃)・ネイティブパッチは対象外
- `PHOTO_INFO_CONCURRENCY` の値は 4 に固定する(設計書 §8 で確定済み)

---

### Task 1: `mapWithConcurrency` 汎用ヘルパーの新設

**Files:**

- Create: `src/utils/concurrency.ts`
- Test: `src/utils/__tests__/concurrency.test.ts`

**Interfaces:**

- Produces: `mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>): Promise<PromiseSettledResult<R>[]>`
  - 戻り値は `Promise.allSettled` と同じ形(`{ status: 'fulfilled', value }` または `{ status: 'rejected', reason }`)の配列。**入力順と同じ順序**で返す
  - `concurrency` が `items.length` 以上の場合は事実上 `Promise.allSettled` と同じ挙動になる
  - `concurrency <= 0` の場合は 1 として扱う(0件処理で固まらないようにするため)

- [ ] **Step 1: 失敗するテストを書く(基本の並び順・要素数)**

`src/utils/__tests__/concurrency.test.ts` を新規作成する。

```typescript
import { mapWithConcurrency } from '@/utils/concurrency';

describe('並列数制限付きmap mapWithConcurrency', () => {
  it('入力順と同じ順序で結果を返す', async () => {
    const items = [1, 2, 3, 4, 5];

    const results = await mapWithConcurrency(items, 2, async (item) => item * 10);

    expect(results).toEqual([
      { status: 'fulfilled', value: 10 },
      { status: 'fulfilled', value: 20 },
      { status: 'fulfilled', value: 30 },
      { status: 'fulfilled', value: 40 },
      { status: 'fulfilled', value: 50 },
    ]);
  });

  it('空配列の場合は空配列を返す', async () => {
    const results = await mapWithConcurrency<number, number>([], 4, async (item) => item);

    expect(results).toEqual([]);
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npm test -- src/utils/__tests__/concurrency.test.ts`
Expected: FAIL(`Cannot find module '@/utils/concurrency'`)

- [ ] **Step 3: 最小実装を書く**

`src/utils/concurrency.ts` を新規作成する。

```typescript
/**
 * 指定した同時実行数を超えないよう制限しながら、配列の各要素に非同期処理を適用する。
 *
 * `Promise.allSettled(items.map(mapper))` は全要素を一斉並列実行するため、
 * mapper が重い処理(メインスレッドを使うネイティブ処理など)を伴う場合に
 * 実行元スレッドを一時に飽和させてしまう。concurrency 件ずつに区切って
 * 実行することでピーク負荷を抑える。
 *
 * @param items - 処理対象の配列。
 * @param concurrency - 同時に実行する処理の最大数。1未満は1として扱う。
 * @param mapper - 各要素に適用する非同期処理。
 * @returns 入力順を保った `Promise.allSettled` 相当の結果配列。
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  const effectiveConcurrency = Math.max(1, concurrency);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      try {
        const value = await mapper(items[currentIndex], currentIndex);
        results[currentIndex] = { status: 'fulfilled', value };
      } catch (reason: unknown) {
        results[currentIndex] = { status: 'rejected', reason };
      }
    }
  }

  const workerCount = Math.min(effectiveConcurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  return results;
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npm test -- src/utils/__tests__/concurrency.test.ts`
Expected: PASS(2件)

- [ ] **Step 5: 同時実行数の上限を守るテストを追加する(TDD継続)**

`src/utils/__tests__/concurrency.test.ts` に追記する。実行中カウンタの最大値を計測し、`concurrency` を超えないことを検証する。

```typescript
it('同時に実行される処理数がconcurrencyを超えない', async () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8];
  let runningCount = 0;
  let maxRunningCount = 0;

  await mapWithConcurrency(items, 3, async (item) => {
    runningCount += 1;
    maxRunningCount = Math.max(maxRunningCount, runningCount);
    await new Promise((resolve) => setTimeout(resolve, 5));
    runningCount -= 1;
    return item;
  });

  expect(maxRunningCount).toBeLessThanOrEqual(3);
});
```

- [ ] **Step 6: テストを実行し成功を確認する**

Run: `npm test -- src/utils/__tests__/concurrency.test.ts`
Expected: PASS(3件)

- [ ] **Step 7: 一部が失敗しても全体が完了し、rejectedとして結果に残るテストを追加する**

```typescript
it('一部の処理が失敗しても残りの結果と合わせて返す', async () => {
  const items = [1, 2, 3];

  const results = await mapWithConcurrency(items, 2, async (item) => {
    if (item === 2) {
      throw new Error('failed for 2');
    }
    return item * 100;
  });

  expect(results).toEqual([
    { status: 'fulfilled', value: 100 },
    { status: 'rejected', reason: new Error('failed for 2') },
    { status: 'fulfilled', value: 300 },
  ]);
});

it('concurrencyが要素数より多い場合も全要素を処理する', async () => {
  const items = [1, 2];

  const results = await mapWithConcurrency(items, 10, async (item) => item);

  expect(results).toEqual([
    { status: 'fulfilled', value: 1 },
    { status: 'fulfilled', value: 2 },
  ]);
});

it('concurrencyが0以下でも1として扱い処理が完了する', async () => {
  const items = [1, 2];

  const results = await mapWithConcurrency(items, 0, async (item) => item);

  expect(results).toEqual([
    { status: 'fulfilled', value: 1 },
    { status: 'fulfilled', value: 2 },
  ]);
});
```

- [ ] **Step 8: テストを実行し全件成功を確認する**

Run: `npm test -- src/utils/__tests__/concurrency.test.ts`
Expected: PASS(6件)

- [ ] **Step 9: 型チェックを実行する**

Run: `npm run typecheck`
Expected: エラー0件

- [ ] **Step 10: コミット**

```bash
git add src/utils/concurrency.ts src/utils/__tests__/concurrency.test.ts
git commit -m "feat(utils): 並列数制限付きmapヘルパーmapWithConcurrencyを追加する"
```

---

### Task 2: `loadGeotaggedPhotos` の並列数を制限する

**Files:**

- Modify: `src/features/photos/photoLibrary.ts`
- Test: `src/features/photos/__tests__/photoLibrary.test.ts`(既存ファイルに追記)

**Interfaces:**

- Consumes: `mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>): Promise<PromiseSettledResult<R>[]>`(Task 1 で定義)
- `loadGeotaggedPhotos` のシグネチャ・戻り値・既存の公開 API は変更しない

現状の実装(変更前):

```typescript
const details = await Promise.allSettled(
  page.assets.map((asset) => MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: false })),
);
```

- [ ] **Step 1: 失敗するテストを書く(同時実行数の上限を守ること)**

`src/features/photos/__tests__/photoLibrary.test.ts` の `describe('ジオタグ付き写真読み込み loadGeotaggedPhotos', ...)` ブロック内に追記する。

既存の `createAssetInfo` ヘルパーをそのまま使う。`getAssetInfoAsync` の呼び出しごとに実行中カウンタを増減させ、ピーク値が `PHOTO_INFO_CONCURRENCY`(4)を超えないことを検証する。

```typescript
it('getAssetInfoAsyncの同時実行数がPHOTO_INFO_CONCURRENCYを超えない', async () => {
  const assetCount = 10;
  (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
    assets: Array.from({ length: assetCount }, (_, index) => ({ id: `asset-${index}` })),
  });

  let runningCount = 0;
  let maxRunningCount = 0;
  (MediaLibrary.getAssetInfoAsync as jest.Mock).mockImplementation(async (asset: { id: string }) => {
    runningCount += 1;
    maxRunningCount = Math.max(maxRunningCount, runningCount);
    await new Promise((resolve) => setTimeout(resolve, 5));
    runningCount -= 1;
    return createAssetInfo(asset.id, { latitude: 35, longitude: 139 });
  });

  await loadGeotaggedPhotos();

  expect(maxRunningCount).toBeLessThanOrEqual(PHOTO_INFO_CONCURRENCY);
  expect(MediaLibrary.getAssetInfoAsync).toHaveBeenCalledTimes(assetCount);
});
```

このテストが `PHOTO_INFO_CONCURRENCY` を import できるよう、ファイル冒頭の import 文を以下に変更する。

```typescript
import { loadGeotaggedPhotos, hasFullPhotoAccess, toMapPhoto, PHOTO_INFO_CONCURRENCY } from '@/features/photos/photoLibrary';
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npm test -- src/features/photos/__tests__/photoLibrary.test.ts`
Expected: FAIL(`PHOTO_INFO_CONCURRENCY` が未エクスポート、かつ現行実装は200並列で実行されるため `maxRunningCount` が10になり `toBeLessThanOrEqual(4)` に失敗する)

- [ ] **Step 3: `photoLibrary.ts` を修正する**

`src/features/photos/photoLibrary.ts` の import 文と `loadGeotaggedPhotos` を変更する。

```typescript
import * as MediaLibrary from 'expo-media-library/legacy';

import { mapWithConcurrency } from '@/utils/concurrency';
```

`DEFAULT_PHOTO_SCAN_LIMIT` の定義の下に定数を追加する。テストから参照するため `export` する。

```typescript
const DEFAULT_PHOTO_SCAN_LIMIT = 200;

/**
 * getAssetInfoAsync の同時実行数。
 *
 * ネイティブ実装(iOS)は完了ブロック内でフル解像度画像をメインキュー上でデコードするため、
 * 一斉並列で発行するとメインスレッドが長時間ブロックされ App Hang を引き起こす
 * (2026-08-08 Sentry 観測: 200並列でメインスレッドが2秒以上停止)。
 * 同時実行数を絞ることでメインキューへ一度に積まれるデコード量を抑える。
 */
export const PHOTO_INFO_CONCURRENCY = 4;
```

`loadGeotaggedPhotos` 内の該当箇所を変更する。

```typescript
export async function loadGeotaggedPhotos(limit = DEFAULT_PHOTO_SCAN_LIMIT): Promise<MapPhoto[]> {
  const page = await MediaLibrary.getAssetsAsync({
    first: limit,
    mediaType: MediaLibrary.MediaType.photo,
    sortBy: [[MediaLibrary.SortBy.creationTime, false]],
  });

  const details = await mapWithConcurrency(page.assets, PHOTO_INFO_CONCURRENCY, (asset) =>
    MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: false }),
  );

  return details.flatMap((result) => {
    if (result.status !== 'fulfilled') {
      return [];
    }

    const photo = toMapPhoto(result.value);
    return photo ? [photo] : [];
  });
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npm test -- src/features/photos/__tests__/photoLibrary.test.ts`
Expected: PASS(既存6件 + 新規1件 = 7件)

- [ ] **Step 5: 型チェックを実行する**

Run: `npm run typecheck`
Expected: エラー0件

- [ ] **Step 6: コミット**

```bash
git add src/features/photos/photoLibrary.ts src/features/photos/__tests__/photoLibrary.test.ts
git commit -m "fix(photos): 写真詳細取得の並列数を制限しApp Hangを解消する"
```

---

### Task 3: ドキュメント更新と最終検証

**Files:**

- Modify: `docs/photo-geotag.md`

- [ ] **Step 1: `docs/photo-geotag.md` の「10. パフォーマンス方針」に並列数制限の記述を追加する**

`## 10. パフォーマンス方針` セクションの箇条書きの下に追記する。

```markdown
## 10. パフォーマンス方針

写真ライブラリ全体を毎回走査すると重くなる可能性があるため、以下を検討する。

- 初回のみ写真ライブラリをスキャンする
- 以後は差分更新する
- 表示中の期間に関係する写真だけ読み込む
- マップ表示範囲内の写真だけ表示する
- ズームレベルに応じて近接写真をクラスタリングする。拡大時は狭い範囲、縮小時は広い範囲でまとめる
- サムネイルを遅延読み込みする

### 写真詳細取得の並列数制限

`expo-media-library` の `getAssetInfoAsync`(iOS)は、完了コールバック内でフル解像度画像を
メインキュー上でデコードする。走査対象(最大200件)へ一斉並列で発行すると、メインスレッドが
長時間ブロックされアプリがフリーズする(2026-08-08 Sentry で App Hang を観測)。

このため `loadGeotaggedPhotos` は `getAssetInfoAsync` の同時実行数を 4 に制限して呼び出す。
メインスレッドを塞がない範囲で走査するための暫定対応であり、走査上限(200件)自体の撤廃は
別途対応する。
```

- [ ] **Step 2: 全体テストを実行する**

Run: `npm test`
Expected: 既存テストを含めて全件 PASS

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run typecheck`
Expected: エラー0件

- [ ] **Step 4: lintを実行する**

Run: `npm run lint`
Expected: error 0件

- [ ] **Step 5: formatチェックを実行する**

Run: `npm run format:check`
Expected: 全ファイル通過(通過しない場合は `npm run format` を実行してから再度確認する)

- [ ] **Step 6: コミット**

```bash
git add docs/photo-geotag.md
git commit -m "docs(photos): 写真詳細取得の並列数制限について追記する"
```

---

## Self-Review 用チェックリスト(実行者向け参考情報)

- 設計書 §5(変更対象ファイル)との対応: `src/utils/concurrency.ts`(Task 1)、`src/features/photos/photoLibrary.ts`(Task 2)、`docs/photo-geotag.md`(Task 3)を全てカバーしている
- 設計書 §6(テスト方針)との対応: `mapWithConcurrency` の同時実行数上限・順序保証・失敗時挙動(Task 1)、`loadGeotaggedPhotos` の同時実行数上限(Task 2)を全てカバーしている
- ネイティブパッチ(1-B)・Phase 2(表示上限撤廃)は本計画のスコープ外。着手しない
