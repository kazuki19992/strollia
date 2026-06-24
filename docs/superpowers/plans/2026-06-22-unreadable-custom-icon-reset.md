# 復旧不能なカスタム現在地アイコンのリセット Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 起動時に消失が確定した旧URIまたは管理画像参照をOS標準設定へ戻し、旧URIの場合は再設定を促すAlertを表示する。

**Architecture:** ファイル参照形式の判定は `customIconStorage.ts` に閉じ込め、Appの起動処理は参照解決の「消失確定」と「端末APIエラー」を区別する。消失確定時だけ `setSettings` で画像参照とアイコンIDを原子的にリセットし、描画時エラーと端末APIエラーでは従来どおりセッション内フォールバックに留める。

**Tech Stack:** TypeScript、React Native 0.81、Expo SDK 54、expo-file-system、expo-sqlite、Jest、react-test-renderer

---

## Task 1: 旧URI判定をストレージ層へ追加

**Files:**
- Modify: `src/features/customization/customIconStorage.ts`
- Test: `src/features/customization/__tests__/customIconStorage.test.ts`

- [ ] **Step 1: 旧URI判定の失敗テストを書く**

`customIconStorage.test.ts` のimportへ `isLegacyCustomIconReference` を加え、次のテストを追加する。

```ts
it('従来の絶対URIだけを旧参照として判定する', () => {
  expect(isLegacyCustomIconReference('file:///legacy/photo.jpg')).toBe(true);
  expect(isLegacyCustomIconReference('ph://asset-id')).toBe(true);
  expect(isLegacyCustomIconReference('managed:saved.jpg')).toBe(false);
  expect(isLegacyCustomIconReference('')).toBe(false);
});
```

- [ ] **Step 2: テストが未実装で失敗することを確認する**

Run: `npm test -- --runInBand src/features/customization/__tests__/customIconStorage.test.ts`

Expected: `isLegacyCustomIconReference` がexportされていないためFAIL。

- [ ] **Step 3: 最小実装を追加する**

`customIconStorage.ts` に参照形式を外部へ漏らさない判定関数を追加する。

```ts
/** 旧バージョンが保存した絶対URI形式かどうかを返す。 */
export function isLegacyCustomIconReference(reference: string): boolean {
  return isAbsoluteUri(reference);
}
```

- [ ] **Step 4: 対象テストが通ることを確認する**

Run: `npm test -- --runInBand src/features/customization/__tests__/customIconStorage.test.ts`

Expected: 対象suiteがPASS。

- [ ] **Step 5: コミットする**

```bash
git add src/features/customization/customIconStorage.ts src/features/customization/__tests__/customIconStorage.test.ts
git commit -m "feat(icon): 旧カスタム画像参照の判定を追加"
```

## Task 2: 復旧不能な参照をOS標準へ原子的に戻す

**Files:**
- Modify: `src/app/App.tsx:70,720-760`
- Test: `src/app/__tests__/AppMapReturn.test.tsx:1347-1369,1527-1541`

- [ ] **Step 1: 消失した旧URIの期待動作へ既存テストを書き換える**

既存の「消えた旧URI」テストを次の期待へ変更する。

```ts
test('消えた旧URIはOS標準設定へ戻して再設定を案内する', async () => {
  (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
    if (key === 'userLocationIcon') return Promise.resolve('custom');
    if (key === 'customIconImageUri') return Promise.resolve('file:///missing.jpg');
    return Promise.resolve(fallback);
  });
  (resolveCustomIconReference as jest.Mock).mockResolvedValue(null);

  await act(async () => { renderer = ReactTestRenderer.create(<App />); });
  await flushPromises();

  expect(setSettings).toHaveBeenCalledWith([
    { key: 'customIconImageUri', value: '' },
    { key: 'userLocationIcon', value: 'default' },
  ]);
  expect(mockLatestSettingsScreenProps.selectedUserLocationIconId).toBe('default');
  expect(Alert.alert).toHaveBeenCalledWith(
    'カスタムアイコンを読み込めませんでした',
    '保存されていた画像を読み込めなかったため、現在地アイコンをOS標準に戻しました。カスタムアイコンを使用する場合は、設定画面から画像を再設定してください。',
  );
});
```

- [ ] **Step 2: 管理ファイル消失と一時的解決エラーのテストを追加する**

```ts
test('管理ファイルの消失はOS標準設定へ戻すが旧URI向けAlertは表示しない', async () => {
  (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
    if (key === 'userLocationIcon') return Promise.resolve('custom');
    if (key === 'customIconImageUri') return Promise.resolve('managed:missing.jpg');
    return Promise.resolve(fallback);
  });
  (resolveCustomIconReference as jest.Mock).mockResolvedValue(null);

  await act(async () => { renderer = ReactTestRenderer.create(<App />); });
  await flushPromises();

  expect(setSettings).toHaveBeenCalledWith([
    { key: 'customIconImageUri', value: '' },
    { key: 'userLocationIcon', value: 'default' },
  ]);
  expect(Alert.alert).not.toHaveBeenCalledWith(
    'カスタムアイコンを読み込めませんでした',
    expect.any(String),
  );
});

test('カスタム選択に画像参照がない場合はOS標準設定へ戻す', async () => {
  (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
    if (key === 'userLocationIcon') return Promise.resolve('custom');
    if (key === 'customIconImageUri') return Promise.resolve('');
    return Promise.resolve(fallback);
  });
  (resolveCustomIconReference as jest.Mock).mockResolvedValue(null);

  await act(async () => { renderer = ReactTestRenderer.create(<App />); });
  await flushPromises();

  expect(setSettings).toHaveBeenCalledWith([
    { key: 'customIconImageUri', value: '' },
    { key: 'userLocationIcon', value: 'default' },
  ]);
});

test('参照解決APIの一時エラーでは保存設定を変更しない', async () => {
  (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
    if (key === 'userLocationIcon') return Promise.resolve('custom');
    if (key === 'customIconImageUri') return Promise.resolve('managed:saved.jpg');
    return Promise.resolve(fallback);
  });
  (resolveCustomIconReference as jest.Mock).mockRejectedValue(new Error('一時エラー'));

  await act(async () => { renderer = ReactTestRenderer.create(<App />); });
  await flushPromises();

  expect(setSettings).not.toHaveBeenCalled();
  expect(mockLatestMapScreenProps.userLocationIcon.useNativeUserLocation).toBe(true);
});

test('旧URIのリセット保存に失敗してもセッション表示をOS標準へ戻す', async () => {
  (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
    if (key === 'userLocationIcon') return Promise.resolve('custom');
    if (key === 'customIconImageUri') return Promise.resolve('file:///missing.jpg');
    return Promise.resolve(fallback);
  });
  (resolveCustomIconReference as jest.Mock).mockResolvedValue(null);
  (setSettings as jest.Mock).mockRejectedValue(new Error('DB失敗'));

  await act(async () => { renderer = ReactTestRenderer.create(<App />); });
  await flushPromises();

  expect(mockLatestSettingsScreenProps.selectedUserLocationIconId).toBe('default');
  expect(mockLatestMapScreenProps.userLocationIcon.useNativeUserLocation).toBe(true);
  expect(console.warn).toHaveBeenCalledWith(
    'Failed to reset missing custom icon reference:',
    expect.any(Error),
  );
});
```

- [ ] **Step 3: Appテストが現在の非破壊挙動に対して失敗することを確認する**

Run: `npm test -- --runInBand src/app/__tests__/AppMapReturn.test.tsx`

Expected: 消失時に `setSettings` とAlertが呼ばれずFAIL。APIエラーの非破壊テストはPASSしてよい。

- [ ] **Step 4: 消失確定時だけ設定と画面状態をリセットする**

`App.tsx` のimportへ `isLegacyCustomIconReference` を追加する。Appテストの `customIconStorage` mockにも次を追加する。

```ts
isLegacyCustomIconReference: jest.fn((reference: string) => /^[A-Za-z][A-Za-z\d+.-]*:\/\//.test(reference)),
```

参照解決失敗は `undefined`、参照を解決できないことが確定した場合は `null` として区別し、`savedUserLocationIcon === 'custom'` の場合だけリセットする。これにより旧URI、管理参照、空または不正な参照のいずれでも設定画面との不一致を残さない。既存の `if (resolvedCustomIcon?.migrated)` を次の条件ブロックと `else if` へ変更し、移行成功時の既存bodyはそのまま維持する。

```ts
const resolvedCustomIcon = await resolveCustomIconReference(savedCustomIconImageUri).catch((error: unknown) => {
  console.warn('Failed to resolve custom icon reference:', error);
  return undefined;
});
```

この直後にある `signal.aborted` 時の移行ファイル掃除は維持する。その後、既存の移行分岐を次のように開始する。

```ts
if (
  resolvedCustomIcon === null
  && savedUserLocationIcon === 'custom'
) {
  try {
    await setSettings([
      { key: CUSTOM_ICON_IMAGE_URI_SETTING_KEY, value: '' },
      { key: USER_LOCATION_ICON_SETTING_KEY, value: DEFAULT_USER_LOCATION_ICON_ID },
    ]);
  } catch (error: unknown) {
    console.warn('Failed to reset missing custom icon reference:', error);
  }
  if (signal.aborted) return;
  setSelectedUserLocationIconId(DEFAULT_USER_LOCATION_ICON_ID);
  setCustomIconReference('');
  setCustomIconImageUri(null);
  if (isLegacyCustomIconReference(savedCustomIconImageUri)) {
    Alert.alert(
      'カスタムアイコンを読み込めませんでした',
      '保存されていた画像を読み込めなかったため、現在地アイコンをOS標準に戻しました。カスタムアイコンを使用する場合は、設定画面から画像を再設定してください。',
    );
  }
} else if (resolvedCustomIcon?.migrated) {
```

既存の移行成功時bodyと末尾の `else { setCustomIconImageUri(resolvedCustomIcon?.uri ?? null); }` は変更しない。

- [ ] **Step 5: Appの対象テストが通ることを確認する**

Run: `npm test -- --runInBand src/app/__tests__/AppMapReturn.test.tsx`

Expected: 追加・変更したテストを含むsuiteがPASS。

- [ ] **Step 6: コミットする**

```bash
git add src/app/App.tsx src/app/__tests__/AppMapReturn.test.tsx
git commit -m "fix(icon): 復旧不能な画像参照をOS標準へ戻す"
```

## Task 3: 保存仕様を同期して全体検証する

**Files:**
- Modify: `docs/data-storage.md:166-178`

- [ ] **Step 1: データ保存仕様を実装後の挙動へ更新する**

`docs/data-storage.md` のカスタム現在地アイコン節にある、参照先消失時も設定を削除しない記述を次の内容へ置き換える。

```md
旧バージョンが保存した読み込み可能な絶対URIは起動時に管理領域へ移行する。移行後の設定保存に失敗した場合は移行ファイルを削除し、そのセッションでは有効な旧URIを引き続き表示する。

起動時に旧URIまたは管理参照先ファイルの消失が確認できた場合は、`customIconImageUri` を空文字、`userLocationIcon` を `default` として原子的に保存し、画面と設定選択をOS標準へ戻す。旧URIの消失時はAlertで理由と画像の再設定が必要なことを案内する。ファイル存在確認APIの一時エラーや、存在する管理画像の描画時エラーでは設定を書き換えず、そのセッションの表示だけOS標準へフォールバックして次回起動時に再試行する。
```

- [ ] **Step 2: ドキュメント差分を検証する**

Run: `git diff --check`

Expected: 出力なし、exit 0。

- [ ] **Step 3: 型チェックと全テストを実行する**

Run: `npm run typecheck`

Expected: TypeScriptエラーなし、exit 0。

Run: `npm test -- --runInBand`

Expected: 全suite・全testがPASS。

- [ ] **Step 4: ドキュメントをコミットする**

```bash
git add docs/data-storage.md
git commit -m "docs(icon): 復旧不能な画像参照の扱いを更新"
```

- [ ] **Step 5: 最終状態を確認する**

Run: `git status --short --branch && git log -5 --oneline`

Expected: worktreeがcleanで、設計・実装・ドキュメントの目的別コミットが並ぶ。
