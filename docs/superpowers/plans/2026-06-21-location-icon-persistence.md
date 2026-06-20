# 現在地アイコン永続化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** アプリ更新後も「さんぽ」「コンパス」「カスタム写真」の選択を維持し、写真ライブラリや一時キャッシュから独立したカスタム写真保存を実現する。

**Architecture:** カスタム写真のファイル操作を `customIconStorage.ts`、安全な置き換え順序を `customIconSelection.ts` に分離する。AppはSQLiteへ管理ファイル参照を原子的に保存し、起動時に旧絶対URIを移行してからPlus状態と一緒に表示状態を確定する。画像読込エラーはセッション内だけOS標準へフォールバックし、永続設定を変更しない。

**Tech Stack:** React Native 0.81、Expo SDK 54、TypeScript、`expo-image-picker`、`expo-file-system/legacy`、Expo SQLite、Jest、React Test Renderer

---

## 実装同期（2026-06-21）

以下はレビュー反映後の最終実装を表す。後続タスク内のコード断片と当初の期待件数はTDD着手時点の履歴として残し、差異がある場合はこの節を正とする。

### 最終APIと保存方式

- `customIconStorage.ts`
  - `persistCustomIconImage(sourceUri, idFactory?)` は画像を `documentDirectory/strollia-custom-icons/` へコピーし、`managed:<filename>` と表示URIを返す。
  - 許可する拡張子を `bmp`、`gif`、`heic`、`heif`、`jpeg`、`jpg`、`png`、`webp` に限定し、不明な拡張子は `jpg` とする。IDはファイル名に安全な文字へ正規化する。
  - `resolveCustomIconReference(reference, idFactory?)` は安全な管理参照だけを現在の `documentDirectory` から解決する。従来の絶対URIは存在する通常ファイルに限って管理領域へ移行し、空値、不正な管理参照、相対参照、存在しないファイル、ディレクトリは `null` とする。
  - `deleteManagedCustomIcon(reference)` は検証済みの管理参照だけを冪等削除し、従来URIや走査パスには触れない。
- `settingsRepository.ts`
  - `setSettings(entries)` は空配列なら何もせず、非空なら `db.withExclusiveTransactionAsync` が渡すトランザクションrunner上で全UPSERTを実行する。全エントリは同じ `updated_at` を使う。
  - `setSetting` と `setSettings` はrunnerを受け取る共通UPSERT helperを利用する。
- `customIconSelection.ts`
  - `replaceCustomIconSelection({ sourceUri, previousReference, persistSelection })` は「新規ファイル保存 → 設定の排他的トランザクション保存 → 旧管理ファイル削除」の順で置き換える。
  - 設定保存に失敗した場合は新規管理ファイルを掃除して元のエラーを再送出する。掃除失敗は警告だけに留める。同一参照を返した場合は新旧どちらも削除しない。
- `initialPremiumAccess.ts`
  - `resolveInitialPremiumAccess(request, fallback, { timeoutMs?, signal? })` は `{ state, timedOut }` を返す。既定の待機上限は3秒で、取得失敗時は `timedOut: false` のfallback、上限到達時は `timedOut: true` のfallbackを返す。
  - `AbortSignal` による中止では `AbortError` を送出し、成功・失敗・タイムアウト・中止のすべてでタイマーとabort listenerを掃除する。

### App統合の最終挙動

- 起動時は設定読み込みと初回Plus状態取得を並行し、その結果を受けてカスタム参照を解決する。Plus取得を無期限に待たず、タイムアウト後も保存済みPlusアイコンを一時的なOS標準へ落とさない。
- 初回Plus取得が遅延した場合は元のPromiseを継続監視して後から確定状態を反映する。ただしRevenueCat購読更新のgenerationが進んでいれば、遅延した初回結果で新しい状態を上書きしない。
- Plus状態が未確定の間だけアイコン解決をPlus利用可能として扱う。確定後は通常の権限制御へ戻すため、未加入ユーザーへPlusアイコンを恒久表示しない。
- 旧絶対URIの移行は、新しい管理参照のDB保存に成功してから表示参照へ採用する。DB保存失敗時は移行先ファイルを削除し、従来参照と表示を維持する。
- 初期化effectは `AbortController` を所有し、アンマウント後のstate更新を止める。移行コピー直後に中止された場合は未保存の管理ファイルを削除する。
- カスタム画像選択はin-flight guardで多重起動を防ぐ。選択、コピー、排他的な2設定保存が完了した後だけUIを切り替え、失敗時は以前の選択を維持する。完了・失敗・キャンセルのすべてでguardを解除する。
- カスタム画像の読込失敗はセッション内表示だけOS標準へフォールバックし、`customIconImageUri` と `userLocationIcon` の永続値を変更しない。写真ライブラリ削除に関する旧alertは表示しない。

### 最終テスト範囲

- `customIconStorage.test.ts`: 永続コピー、許可拡張子、不明拡張子、ID正規化、管理参照復元、従来URI移行、欠損・空値・不正参照・走査パス拒否、管理ファイル限定削除、保存先欠損。
- `settingsRepository.test.ts`: 排他的トランザクションrunner、共通更新日時、空配列no-op。
- `customIconSelection.test.ts`: 成功順序、設定失敗時rollback、cleanup失敗時の元エラー維持、旧ファイル削除失敗の非致命化、同一参照の非削除。
- `initialPremiumAccess.test.ts`: 成功、取得失敗、3秒タイムアウト、中止、および各経路のタイマー掃除。
- `AppMapReturn.test.tsx`: 管理参照復元、旧URI移行と保存失敗rollback、Plus初期取得・タイムアウト後復元・購読generation guard、アイコンだけの未確定表示継続、選択in-flight guard、排他的な設定保存、非破壊画像エラー、アンマウント時の中止と移行ファイルcleanup。
- 既存の `customizationResolver.test.ts`、`AppCustomIconCentering.test.tsx`、`MapScreen.test.tsx` も回帰対象に含める。

### 完了時の検証基準

- 集中テスト: 指定8スイートを `--runInBand` で実行する。
- 型チェック: `npm run typecheck`。
- 全テスト: `npm test -- --runInBand`。
- 差分健全性: `git diff --check origin/develop...HEAD`。

---

### Task 1: カスタム写真の永続ファイル管理

**Files:**
- Create: `src/features/customization/customIconStorage.ts`
- Create: `src/features/customization/__tests__/customIconStorage.test.ts`

- [x] **Step 1: 永続保存・参照解決・旧URI移行の失敗テストを書く**

`src/features/customization/__tests__/customIconStorage.test.ts` を作成する。

```ts
import * as FileSystem from 'expo-file-system/legacy';

import {
  deleteManagedCustomIcon,
  persistCustomIconImage,
  resolveCustomIconReference,
} from '../customIconStorage';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
}));

describe('カスタム現在地アイコンの永続ファイル管理', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, isDirectory: false });
  });

  it('選択画像をdocument領域へコピーし、管理参照と表示URIを返す', async () => {
    await expect(persistCustomIconImage('file:///cache/cropped.jpg', () => 'icon-1')).resolves.toEqual({
      reference: 'managed:icon-1.jpg',
      uri: 'file:///documents/strollia-custom-icons/icon-1.jpg',
    });
    expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
      'file:///documents/strollia-custom-icons/',
      { intermediates: true },
    );
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: 'file:///cache/cropped.jpg',
      to: 'file:///documents/strollia-custom-icons/icon-1.jpg',
    });
  });

  it('管理参照を現在のdocument領域のURIへ解決する', async () => {
    await expect(resolveCustomIconReference('managed:icon-1.jpg', () => 'unused')).resolves.toEqual({
      reference: 'managed:icon-1.jpg',
      uri: 'file:///documents/strollia-custom-icons/icon-1.jpg',
      migrated: false,
    });
  });

  it('読み込める旧絶対URIをdocument領域へ移行する', async () => {
    await expect(resolveCustomIconReference('file:///cache/legacy.png', () => 'migrated')).resolves.toEqual({
      reference: 'managed:migrated.png',
      uri: 'file:///documents/strollia-custom-icons/migrated.png',
      migrated: true,
    });
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: 'file:///cache/legacy.png',
      to: 'file:///documents/strollia-custom-icons/migrated.png',
    });
  });

  it('旧絶対URIが消えている場合はnullを返し、設定削除処理を行わない', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false, isDirectory: false });

    await expect(resolveCustomIconReference('file:///cache/missing.png', () => 'unused')).resolves.toBeNull();
    expect(FileSystem.copyAsync).not.toHaveBeenCalled();
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  it('管理参照だけを冪等に削除する', async () => {
    await deleteManagedCustomIcon('managed:icon-1.jpg');
    await deleteManagedCustomIcon('file:///cache/legacy.jpg');

    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///documents/strollia-custom-icons/icon-1.jpg',
      { idempotent: true },
    );
  });
});
```

- [x] **Step 2: テストが未実装APIで失敗することを確認する**

Run:

```bash
npm test -- --runInBand src/features/customization/__tests__/customIconStorage.test.ts
```

Expected: FAIL with `Cannot find module '../customIconStorage'`.

- [x] **Step 3: 最小限の永続ファイル管理を実装する**

`src/features/customization/customIconStorage.ts` を作成する。

```ts
import * as FileSystem from 'expo-file-system/legacy';

const CUSTOM_ICON_DIRECTORY_NAME = 'strollia-custom-icons';
const MANAGED_REFERENCE_PREFIX = 'managed:';

export type StoredCustomIcon = {
  reference: string;
  uri: string;
};

export type ResolvedCustomIcon = StoredCustomIcon & {
  migrated: boolean;
};

type CustomIconIdFactory = () => string;

/** 一意な管理ファイル名に使うIDを生成する。 */
function createCustomIconId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** コピー元URIの拡張子を返す。判別できない場合はjpgを使う。 */
function getImageExtension(uri: string): string {
  const path = uri.split(/[?#]/, 1)[0];
  return path.match(/\.([a-z0-9]{1,5})$/i)?.[1]?.toLowerCase() ?? 'jpg';
}

/** document領域のカスタムアイコンディレクトリを返す。 */
function getCustomIconDirectoryUri(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error('カスタムアイコンの保存先を利用できません。');
  }
  return `${FileSystem.documentDirectory}${CUSTOM_ICON_DIRECTORY_NAME}/`;
}

/** 管理参照を現在のアプリコンテナ内URIへ変換する。 */
function getManagedCustomIconUri(reference: string): string | null {
  if (!reference.startsWith(MANAGED_REFERENCE_PREFIX)) {
    return null;
  }
  const fileName = reference.slice(MANAGED_REFERENCE_PREFIX.length);
  return fileName ? `${getCustomIconDirectoryUri()}${fileName}` : null;
}

/** 選択画像を永続領域へコピーする。 */
export async function persistCustomIconImage(
  sourceUri: string,
  createId: CustomIconIdFactory = createCustomIconId,
): Promise<StoredCustomIcon> {
  const directoryUri = getCustomIconDirectoryUri();
  const fileName = `${createId()}.${getImageExtension(sourceUri)}`;
  const uri = `${directoryUri}${fileName}`;
  await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });
  await FileSystem.copyAsync({ from: sourceUri, to: uri });
  return { reference: `${MANAGED_REFERENCE_PREFIX}${fileName}`, uri };
}

/** 保存値を表示URIへ解決し、旧絶対URIなら永続領域へ移行する。 */
export async function resolveCustomIconReference(
  reference: string,
  createId: CustomIconIdFactory = createCustomIconId,
): Promise<ResolvedCustomIcon | null> {
  if (!reference) {
    return null;
  }
  const managedUri = getManagedCustomIconUri(reference);
  if (managedUri) {
    const info = await FileSystem.getInfoAsync(managedUri);
    return info.exists ? { reference, uri: managedUri, migrated: false } : null;
  }
  const legacyInfo = await FileSystem.getInfoAsync(reference);
  if (!legacyInfo.exists) {
    return null;
  }
  const migrated = await persistCustomIconImage(reference, createId);
  return { ...migrated, migrated: true };
}

/** 管理対象のカスタムアイコンだけを削除する。 */
export async function deleteManagedCustomIcon(reference: string): Promise<void> {
  const uri = getManagedCustomIconUri(reference);
  if (uri) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}
```

- [x] **Step 4: ファイル管理テストを成功させる**

Run:

```bash
npm test -- --runInBand src/features/customization/__tests__/customIconStorage.test.ts
```

Expected: PASS, 5 tests.

- [x] **Step 5: ファイル管理をコミットする**

```bash
git add src/features/customization/customIconStorage.ts src/features/customization/__tests__/customIconStorage.test.ts
git commit -m "feat(icon): カスタム画像を永続領域へ保存"
```

### Task 2: 複数設定の原子的保存

**Files:**
- Modify: `src/features/settings/settingsRepository.ts`
- Modify: `src/features/settings/__tests__/settingsRepository.test.ts`

- [x] **Step 1: 複数設定を同一トランザクションで保存する失敗テストを書く**

DBモックへ `withTransactionAsync` を追加し、次のテストを `settingsRepository.test.ts` へ追加する。

```ts
import { getStringSetting, setSettings } from '../settingsRepository';

jest.mock('../../../db/database', () => ({
  db: {
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
    withTransactionAsync: jest.fn(async (operation: () => Promise<void>) => operation()),
  },
}));

it('複数設定を同一トランザクション内で保存する', async () => {
  await setSettings([
    { key: 'customIconImageUri', value: 'managed:icon-1.jpg' },
    { key: 'userLocationIcon', value: 'custom' },
  ]);

  expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
  expect(db.runAsync).toHaveBeenCalledTimes(2);
  expect(db.runAsync).toHaveBeenNthCalledWith(
    1,
    expect.stringContaining('INSERT INTO app_settings'),
    'customIconImageUri',
    JSON.stringify('managed:icon-1.jpg'),
    expect.any(String),
  );
  expect(db.runAsync).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining('INSERT INTO app_settings'),
    'userLocationIcon',
    JSON.stringify('custom'),
    expect.any(String),
  );
});
```

- [x] **Step 2: 新APIがないため失敗することを確認する**

Run:

```bash
npm test -- --runInBand src/features/settings/__tests__/settingsRepository.test.ts
```

Expected: FAIL because `setSettings` is not exported.

- [x] **Step 3: 単一設定と複数設定で共有するUPSERT処理を実装する**

`settingsRepository.ts` に次を追加し、既存 `setSetting` も同じhelperを利用する。

```ts
export type AppSettingEntry = {
  key: string;
  value: AppSettingValue;
};

async function upsertSetting({ key, value }: AppSettingEntry, now: string): Promise<void> {
  await db.runAsync(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    key,
    JSON.stringify(value),
    now,
  );
}

export async function setSetting(key: string, value: AppSettingValue): Promise<void> {
  await upsertSetting({ key, value }, new Date().toISOString());
}

/** 複数の関連設定を同一トランザクションで保存する。 */
export async function setSettings(entries: AppSettingEntry[]): Promise<void> {
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const entry of entries) {
      await upsertSetting(entry, now);
    }
  });
}
```

- [x] **Step 4: 設定リポジトリテストを成功させる**

Run:

```bash
npm test -- --runInBand src/features/settings/__tests__/settingsRepository.test.ts
```

Expected: PASS, including the new transaction test.

- [x] **Step 5: 原子的設定保存をコミットする**

```bash
git add src/features/settings/settingsRepository.ts src/features/settings/__tests__/settingsRepository.test.ts
git commit -m "feat(settings): 関連設定の原子的保存を追加"
```

### Task 3: カスタム写真を安全に置き換えるサービス

**Files:**
- Create: `src/features/customization/customIconSelection.ts`
- Create: `src/features/customization/__tests__/customIconSelection.test.ts`

- [x] **Step 1: 成功順序と失敗時ロールバックのテストを書く**

`src/features/customization/__tests__/customIconSelection.test.ts` を作成する。

```ts
import { deleteManagedCustomIcon, persistCustomIconImage } from '../customIconStorage';
import { replaceCustomIconSelection } from '../customIconSelection';

jest.mock('../customIconStorage', () => ({
  persistCustomIconImage: jest.fn(),
  deleteManagedCustomIcon: jest.fn(),
}));

describe('カスタム現在地アイコンの置き換え', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (persistCustomIconImage as jest.Mock).mockResolvedValue({
      reference: 'managed:new.jpg',
      uri: 'file:///documents/strollia-custom-icons/new.jpg',
    });
    (deleteManagedCustomIcon as jest.Mock).mockResolvedValue(undefined);
  });

  it('新規ファイルの保存と設定保存後に旧ファイルを削除する', async () => {
    const persistSelection = jest.fn().mockResolvedValue(undefined);

    await expect(replaceCustomIconSelection({
      sourceUri: 'file:///cache/new.jpg',
      previousReference: 'managed:old.jpg',
      persistSelection,
    })).resolves.toEqual({
      reference: 'managed:new.jpg',
      uri: 'file:///documents/strollia-custom-icons/new.jpg',
    });

    expect(persistSelection).toHaveBeenCalledWith('managed:new.jpg');
    expect(persistSelection.mock.invocationCallOrder[0]).toBeLessThan(
      (deleteManagedCustomIcon as jest.Mock).mock.invocationCallOrder[0],
    );
    expect(deleteManagedCustomIcon).toHaveBeenCalledWith('managed:old.jpg');
  });

  it('設定保存に失敗した場合は新規ファイルだけを削除して旧ファイルを維持する', async () => {
    const persistSelection = jest.fn().mockRejectedValue(new Error('DB error'));

    await expect(replaceCustomIconSelection({
      sourceUri: 'file:///cache/new.jpg',
      previousReference: 'managed:old.jpg',
      persistSelection,
    })).rejects.toThrow('DB error');

    expect(deleteManagedCustomIcon).toHaveBeenCalledWith('managed:new.jpg');
    expect(deleteManagedCustomIcon).not.toHaveBeenCalledWith('managed:old.jpg');
  });
});
```

- [x] **Step 2: 未実装サービスで失敗することを確認する**

Run:

```bash
npm test -- --runInBand src/features/customization/__tests__/customIconSelection.test.ts
```

Expected: FAIL with `Cannot find module '../customIconSelection'`.

- [x] **Step 3: 安全な置き換え順序を実装する**

`src/features/customization/customIconSelection.ts` を作成する。

```ts
import {
  deleteManagedCustomIcon,
  persistCustomIconImage,
  StoredCustomIcon,
} from './customIconStorage';

export type ReplaceCustomIconSelectionOptions = {
  sourceUri: string;
  previousReference: string;
  persistSelection: (reference: string) => Promise<void>;
};

/** 新しい写真と設定を保存できた場合だけ旧管理ファイルを削除する。 */
export async function replaceCustomIconSelection({
  sourceUri,
  previousReference,
  persistSelection,
}: ReplaceCustomIconSelectionOptions): Promise<StoredCustomIcon> {
  const next = await persistCustomIconImage(sourceUri);
  try {
    await persistSelection(next.reference);
  } catch (error: unknown) {
    await deleteManagedCustomIcon(next.reference).catch(() => undefined);
    throw error;
  }
  await deleteManagedCustomIcon(previousReference).catch((error: unknown) => {
    console.warn('Failed to delete previous custom icon:', error);
  });
  return next;
}
```

- [x] **Step 4: 置き換えサービステストを成功させる**

Run:

```bash
npm test -- --runInBand src/features/customization/__tests__/customIconSelection.test.ts
```

Expected: PASS, 2 tests.

- [x] **Step 5: 置き換えサービスをコミットする**

```bash
git add src/features/customization/customIconSelection.ts src/features/customization/__tests__/customIconSelection.test.ts
git commit -m "feat(icon): カスタム画像を安全に置き換え"
```

### Task 4: Appの復元・選択・非破壊フォールバック

**Files:**
- Modify: `src/app/App.tsx:69-84, 156, 199-312, 620-665, 1330-1408, 1569`
- Modify: `src/app/__tests__/AppMapReturn.test.tsx`
- Modify: `src/app/components/__tests__/MapScreen.test.tsx`
- Modify: `docs/data-storage.md`

- [x] **Step 1: 起動時復元と非破壊エラーの失敗テストを追加する**

`AppMapReturn.test.tsx` のモックへ `customIconStorage`、`customIconSelection`、`setSettings` を追加し、MapScreenモックに画像エラー発火ボタンを追加する。

```ts
import { getStringSetting, setSetting, setSettings } from '../../features/settings/settingsRepository';
import { resolveCustomIconReference } from '../../features/customization/customIconStorage';

jest.mock('../../features/customization/customIconStorage', () => ({
  deleteManagedCustomIcon: jest.fn().mockResolvedValue(undefined),
  resolveCustomIconReference: jest.fn().mockResolvedValue({
    reference: 'managed:saved.jpg',
    uri: 'file:///documents/strollia-custom-icons/saved.jpg',
    migrated: false,
  }),
}));

jest.mock('../../features/customization/customIconSelection', () => ({
  replaceCustomIconSelection: jest.fn().mockResolvedValue({
    reference: 'managed:new.jpg',
    uri: 'file:///documents/strollia-custom-icons/new.jpg',
  }),
}));

jest.mock('../../features/settings/settingsRepository', () => ({
  getBooleanSetting: jest.fn(),
  getStringSetting: jest.fn(),
  setSetting: jest.fn().mockResolvedValue(undefined),
  setSettings: jest.fn().mockResolvedValue(undefined),
}));
```

MapScreenモックの返り値へ次を追加する。

```tsx
<Pressable accessibilityLabel="カスタム画像読込失敗" onPress={props.onCustomIconError}>
  <Text>カスタム画像読込失敗</Text>
</Pressable>
```

次のテストを追加する。`resolveUserLocationIcon` のモックは引数を反映する実装へ変更する。

```ts
(resolveUserLocationIcon as jest.Mock).mockImplementation((selectedId, isPlusActive, customImageUri) => {
  if (selectedId === 'default' || !isPlusActive) {
    return { useNativeUserLocation: true, customIconId: null, customImageUri: null };
  }
  if (selectedId === 'custom') {
    return {
      useNativeUserLocation: !customImageUri,
      customIconId: null,
      customImageUri: customImageUri ?? null,
    };
  }
  return { useNativeUserLocation: false, customIconId: selectedId, customImageUri: null };
});

(getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
  if (key === 'userLocationIcon') {
    return Promise.resolve('custom');
  }
  if (key === 'customIconImageUri') {
    return Promise.resolve('managed:saved.jpg');
  }
  return Promise.resolve(fallback);
});

test('Plus状態と管理画像の解決後に保存済みカスタムアイコンを表示する', async () => {
  (getPremiumAccessState as jest.Mock).mockResolvedValue({
    isPlusActive: true,
    entitlementId: 'strollia_plus',
  });
  (resolveCustomIconReference as jest.Mock).mockResolvedValue({
    reference: 'managed:saved.jpg',
    uri: 'file:///documents/strollia-custom-icons/saved.jpg',
    migrated: false,
  });

  await act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await flushPromises();

  expect(mockLatestMapScreenProps.userLocationIcon.customImageUri).toBe(
    'file:///documents/strollia-custom-icons/saved.jpg',
  );
});

test('画像読込失敗時はセッション内だけOS標準へ戻し永続設定を変更しない', async () => {
  await act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await flushPromises();

  await act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'カスタム画像読込失敗' }).props.onPress();
  });

  expect(mockLatestMapScreenProps.userLocationIcon.useNativeUserLocation).toBe(true);
  expect(setSetting).not.toHaveBeenCalledWith('userLocationIcon', 'default');
  expect(setSettings).not.toHaveBeenCalledWith(expect.arrayContaining([
    expect.objectContaining({ key: 'userLocationIcon', value: 'default' }),
  ]));
});

test('Plus状態の解決前は地図を描画せず、解決後に保存済みアイコンを表示する', async () => {
  let resolvePremium: ((value: { isPlusActive: boolean; entitlementId: string }) => void) | null = null;
  (getPremiumAccessState as jest.Mock).mockReturnValue(new Promise((resolve) => {
    resolvePremium = resolve;
  }));

  await act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await flushPromises();
  expect(mockLatestMapScreenProps).toBeNull();

  await act(async () => {
    resolvePremium?.({ isPlusActive: true, entitlementId: 'strollia_plus' });
  });
  await flushPromises();

  expect(mockLatestMapScreenProps.userLocationIcon.customImageUri).toBe(
    'file:///documents/strollia-custom-icons/saved.jpg',
  );
});
```

`MapScreen.test.tsx` の既存「カスタム画像エラー時に onCustomIconError を呼ぶ」は維持し、App側で非破壊になる責務分担を明示するためテスト名を「カスタム画像エラーをAppへ通知し、永続設定の扱いを委譲する」へ変更する。

- [x] **Step 2: Appテストが旧URI・破壊的フォールバックのため失敗することを確認する**

Run:

```bash
npm test -- --runInBand src/app/__tests__/AppMapReturn.test.tsx src/app/components/__tests__/MapScreen.test.tsx
```

Expected: FAIL because App does not resolve managed references and `clearCustomIcon()` writes `default`.

- [x] **Step 3: 起動時にPlus状態とカスタム画像を確定してから描画する**

`App.tsx` へ次を反映する。

```ts
import {
  deleteManagedCustomIcon,
  resolveCustomIconReference,
} from '../features/customization/customIconStorage';
import { replaceCustomIconSelection } from '../features/customization/customIconSelection';
import { getBooleanSetting, getStringSetting, setSetting, setSettings } from '../features/settings/settingsRepository';
```

状態を追加する。

```ts
const [customIconImageReference, setCustomIconImageReference] = useState('');
const [hasCustomIconLoadFailed, setHasCustomIconLoadFailed] = useState(false);
const effectiveCustomIconImageUri = hasCustomIconLoadFailed ? null : customIconImageUri;
```

resolverには `effectiveCustomIconImageUri` を渡す。

初期化時の最初の `Promise.all` に `getPremiumAccessState()` を加え、結果を `initialPremiumAccessState` として `setPremiumAccessState` する。現在のfire-and-forgetな `getPremiumAccessState().then(setPremiumAccessState)` は削除する。

保存値の読込後に次を実行する。

```ts
let resolvedCustomIcon = await resolveCustomIconReference(savedCustomIconImageUri);

if (resolvedCustomIcon?.migrated) {
  try {
    await setSetting(CUSTOM_ICON_IMAGE_URI_SETTING_KEY, resolvedCustomIcon.reference);
  } catch (error: unknown) {
    await deleteManagedCustomIcon(resolvedCustomIcon.reference).catch(() => undefined);
    resolvedCustomIcon = {
      reference: savedCustomIconImageUri,
      uri: savedCustomIconImageUri,
      migrated: false,
    };
    console.warn('Failed to persist migrated custom icon reference:', error);
  }
}

setCustomIconImageReference(resolvedCustomIcon?.reference ?? savedCustomIconImageUri);
setCustomIconImageUri(resolvedCustomIcon?.uri ?? null);
setPremiumAccessState(initialPremiumAccessState);
```

旧URIが無効な場合も `savedCustomIconImageUri` と `savedUserLocationIcon` をSQLiteへ書き戻さない。

- [x] **Step 4: 写真選択を永続保存と安全な上書きへ切り替える**

`pickCustomIcon()` の画像選択成功後を次へ置き換える。

```ts
const nextIcon = await replaceCustomIconSelection({
  sourceUri: result.assets[0].uri,
  previousReference: customIconImageReference,
  persistSelection: async (reference) => {
    await setSettings([
      { key: CUSTOM_ICON_IMAGE_URI_SETTING_KEY, value: reference },
      { key: USER_LOCATION_ICON_SETTING_KEY, value: 'custom' },
    ]);
  },
});

setCustomIconImageReference(nextIcon.reference);
setCustomIconImageUri(nextIcon.uri);
setHasCustomIconLoadFailed(false);
setSelectedUserLocationIconId('custom');
```

成功時の次のAlertは削除する。

```ts
Alert.alert('カスタムアイコン', '写真をアルバムから削除するとOS標準に戻ります。');
```

catch時は以前の選択が維持されたことを示す。

```ts
Alert.alert(
  'カスタムアイコンを変更できませんでした',
  error instanceof Error ? error.message : '以前のカスタムアイコンを維持します。',
);
```

- [x] **Step 5: 画像エラーを非破壊なセッション内フォールバックへ変更する**

`clearCustomIcon()` を削除し、次へ置き換える。

```ts
/** 画像読込失敗時は保存設定を維持し、このセッションだけOS標準へ戻す。 */
function handleCustomIconLoadError(): void {
  setHasCustomIconLoadFailed(true);
}
```

MapScreenへ `onCustomIconError={handleCustomIconLoadError}` を渡す。新しい写真選択時はStep 4のとおり失敗状態を解除する。

- [x] **Step 6: 永続化仕様をデータ保存ドキュメントへ追記する**

`docs/data-storage.md` の設定保存節へ次を追加する。

```md
### カスタム現在地アイコン画像

カスタム現在地アイコンへ使用する写真は、選択時にアプリのdocument領域へ複製する。`app_settings` にはアプリコンテナの絶対URIではなく管理ファイル名を保存し、起動時に現在のdocument領域から表示URIを再構築する。

別の写真へ変更する場合は、新画像のコピーと設定保存が成功してから旧管理ファイルを削除する。画像読込エラー時はセッション内だけOS標準表示へフォールバックし、保存済み設定は削除しない。
```

- [x] **Step 7: App関連テストを成功させる**

Run:

```bash
npm test -- --runInBand src/app/__tests__/AppMapReturn.test.tsx src/app/__tests__/AppCustomIconCentering.test.tsx src/app/components/__tests__/MapScreen.test.tsx
```

Expected: PASS.

- [x] **Step 8: App統合をコミットする**

```bash
git add src/app/App.tsx src/app/__tests__/AppMapReturn.test.tsx src/app/components/__tests__/MapScreen.test.tsx docs/data-storage.md
git commit -m "fix(icon): 更新後も現在地アイコン設定を維持"
```

### Task 5: 全体検証と仕様整合

**Files:**
- Verify: `docs/superpowers/specs/2026-06-19-location-icon-persistence-design.md`
- Verify: `docs/superpowers/plans/2026-06-21-location-icon-persistence.md`
- Verify: all changed source and test files

- [x] **Step 1: 対象テストをまとめて実行する**

Run:

```bash
npm test -- --runInBand \
  src/features/customization/__tests__/customIconStorage.test.ts \
  src/features/customization/__tests__/customIconSelection.test.ts \
  src/features/customization/__tests__/customizationResolver.test.ts \
  src/features/settings/__tests__/settingsRepository.test.ts \
  src/app/__tests__/AppMapReturn.test.tsx \
  src/app/__tests__/AppCustomIconCentering.test.tsx \
  src/app/components/__tests__/MapScreen.test.tsx
```

Expected: PASS.

- [x] **Step 2: 型チェックを実行する**

Run:

```bash
npm run typecheck
```

Expected: exit 0, no TypeScript errors.

- [x] **Step 3: 全テストを実行する**

Run:

```bash
npm test -- --runInBand
```

Expected: all suites PASS.

- [x] **Step 4: 差分と作業ツリーを確認する**

Run:

```bash
git diff --check origin/develop...HEAD
git status --short
git log --oneline origin/develop..HEAD
```

Expected: `git diff --check` has no output; status is clean; commits are separated into design, storage, settings, replacement orchestration, and App integration purposes.

- [x] **Step 5: 実装中に計画修正が生じた場合だけ計画書を更新してコミットする**

実装が計画どおりならこのStepは変更なしで完了する。API名や責務境界を変更した場合は、実装と一致するよう本計画書を修正し、次でコミットする。

```bash
git add docs/superpowers/plans/2026-06-21-location-icon-persistence.md
git commit -m "docs(icon): 現在地アイコン永続化計画を実装へ同期"
```
