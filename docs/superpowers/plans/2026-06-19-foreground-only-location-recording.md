# Foreground-Only Location Recording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** フォアグラウンド権限のみのユーザーについて、AppStateがactiveの間だけGPSログ・Visited Grid・実績を保存し、常時許可時のバックグラウンド記録とカスタムアイコン表示を回帰させない。

**Architecture:** 背景タスク内の保存処理を、前回点をメモリ保持する位置情報保存セッションへ分離する。前景位置監視は表示と保存で1つのExpo Location購読を共有し、Appが権限とバックグラウンドタスクを同期した後だけ前景保存を有効にする。常時許可時は前景購読を表示専用とし、保存元を固定名のバックグラウンドタスク1件に限定する。

**Tech Stack:** TypeScript、React Native、Expo Location、Expo TaskManager、SQLite、Jest、react-test-renderer

---

## ファイル構成

- Create: `src/features/location/locationRecordingSession.ts` — 前景・背景で共有する、前回点を保持した保存セッション
- Create: `src/features/location/__tests__/locationRecordingSession.test.ts` — 保存順序、前回点、失敗時の契約
- Create: `src/features/location/__tests__/backgroundLocationTask.test.ts` — 背景タスクから共通セッションへの委譲
- Modify: `src/features/location/backgroundLocationTask.ts` — DB保存処理をセッション呼び出しへ置換
- Modify: `src/app/hooks/useForegroundUserLocation.ts` — 表示と保存を共有する単一の前景購読
- Modify: `src/app/hooks/__tests__/useForegroundUserLocation.test.tsx` — 表示専用、保存、直列化、解除のテスト
- Modify: `src/app/App.tsx` — 権限取得後のタスク同期と前景保存の有効化
- Modify: `src/app/__tests__/AppMapReturn.test.tsx` — AppState、権限、常時許可＋カスタムアイコンの回帰テスト
- Modify: `src/app/components/SettingsScreen.tsx` — フォアグラウンド限定記録の説明を正確化
- Modify: `src/app/components/__tests__/SettingsScreen.test.tsx` — 説明文の回帰テスト
- Modify: `docs/architecture.md` — 権限別の保存元と二重保存防止を記録

### Task 1: 状態付き位置情報保存セッション

**Files:**

- Create: `src/features/location/locationRecordingSession.ts`
- Create: `src/features/location/__tests__/locationRecordingSession.test.ts`

- [ ] **Step 1: セッションの失敗テストを書く**

モジュール依存をmockし、次の契約を日本語テストで定義する。

```typescript
const session = await createLocationRecordingSession();

await session.recordLocations([firstLocation]);
await session.recordLocations([secondLocation]);

expect(mockGetLatestLocationPoint).toHaveBeenCalledTimes(1);
expect(mockShouldSaveLocationPoint).toHaveBeenNthCalledWith(1, firstPoint, latestPoint);
expect(mockShouldSaveLocationPoint).toHaveBeenNthCalledWith(2, secondPoint, firstPoint);
expect(mockInsertLocationPoint).toHaveBeenCalledTimes(2);
```

併せて、保存対象外の位置でもVisited Gridを更新すること、実績失敗を握りつぶすこと、空配列では保存処理をしないことを定義する。

- [ ] **Step 2: テストを実行してREDを確認する**

Run:

```text
npm test -- --runInBand src/features/location/__tests__/locationRecordingSession.test.ts
```

Expected: `locationRecordingSession` が存在しないためFAIL。

- [ ] **Step 3: 最小の保存セッションを実装する**

以下の公開契約を実装する。

```typescript
export type LocationRecordingSession = {
  recordLocations: (locations: Location.LocationObject[]) => Promise<void>;
};

export async function createLocationRecordingSession(): Promise<LocationRecordingSession> {
  await initializeDatabase();
  const latestSavedPoint = await getLatestLocationPoint();
  let previousSavedPoint = latestSavedPoint;
  let previousVisitedCellPoint = latestSavedPoint;

  return {
    async recordLocations(locations) {
      // backgroundLocationTaskにある既存順序を移し、成功した前回点を次回呼び出しへ保持する。
    },
  };
}
```

実績処理は既存どおり各GPSポイント保存後に行い、実績エラーだけを警告してGPS保存を維持する。DB・Visited Grid・GPS保存エラーは呼び出し元へ伝播させる。

- [ ] **Step 4: セッションテストをGREENにする**

Run:

```text
npm test -- --runInBand src/features/location/__tests__/locationRecordingSession.test.ts
```

Expected: PASS。

- [ ] **Step 5: 保存セッションをコミットする**

```text
git add src/features/location/locationRecordingSession.ts src/features/location/__tests__/locationRecordingSession.test.ts
git commit -m "refactor(location): 位置情報保存処理をセッション化"
```

### Task 2: バックグラウンドタスクを共通セッションへ移行

**Files:**

- Create: `src/features/location/__tests__/backgroundLocationTask.test.ts`
- Modify: `src/features/location/backgroundLocationTask.ts`

- [ ] **Step 1: 背景タスク委譲の失敗テストを書く**

`TaskManager.defineTask` へ渡されたhandlerを取得し、次を検証する。

```typescript
await definedTask({ data: { locations: [location] }, error: null });

expect(mockCreateLocationRecordingSession).toHaveBeenCalledTimes(1);
expect(mockRecordLocations).toHaveBeenCalledWith([location]);
```

空配列、`data` なし、TaskManagerエラーの場合はセッションを作らないテストも追加する。

- [ ] **Step 2: テストを実行してREDを確認する**

Run:

```text
npm test -- --runInBand src/features/location/__tests__/backgroundLocationTask.test.ts
```

Expected: 背景タスクがまだ共通セッションを呼ばないためFAIL。

- [ ] **Step 3: 背景タスクをセッション呼び出しへ置換する**

handlerの保存部分を以下の責務まで縮小する。

```typescript
const locations = data?.locations ?? [];
if (locations.length === 0) {
  return;
}

const session = await createLocationRecordingSession();
await session.recordLocations(locations);
```

タスクエラーと空配列の早期return、トップレベルの `defineTask` は維持する。

- [ ] **Step 4: 背景タスクと保存セッションのテストをGREENにする**

Run:

```text
npm test -- --runInBand src/features/location/__tests__/backgroundLocationTask.test.ts src/features/location/__tests__/locationRecordingSession.test.ts
```

Expected: PASS。

- [ ] **Step 5: 背景タスク移行をコミットする**

```text
git add src/features/location/backgroundLocationTask.ts src/features/location/__tests__/backgroundLocationTask.test.ts
git commit -m "refactor(location): 背景タスクから共通保存セッションを使う"
```

### Task 3: 単一の前景位置監視から保存する

**Files:**

- Modify: `src/app/hooks/useForegroundUserLocation.ts`
- Modify: `src/app/hooks/__tests__/useForegroundUserLocation.test.tsx`

- [ ] **Step 1: 新しいフック契約の失敗テストを書く**

Harnessをオブジェクト引数へ変更する。

```typescript
useForegroundUserLocation({
  enabled,
  shouldPersist,
  onLocation,
  onError,
});
```

次を日本語テストで定義する。

- `shouldPersist=false` はBalanced、`true` はHighで1つだけ購読する
- 最終取得位置は `onLocation` へ渡すが保存しない
- 新しい位置は `onLocation` と保存セッションへ渡す
- `onLocation` が未指定でも保存する
- 連続更新は前の保存完了後に次を保存する
- 保存失敗時は `onError` を呼び、セッションを破棄して次の更新で再作成する
- enabledがfalseになった場合とアンマウント時に購読を解除する

- [ ] **Step 2: フックテストを実行してREDを確認する**

Run:

```text
npm test -- --runInBand src/app/hooks/__tests__/useForegroundUserLocation.test.tsx
```

Expected: 既存フックの引数と保存機能が新契約を満たさないためFAIL。

- [ ] **Step 3: 前景位置監視を最小実装する**

公開型を以下に変更する。

```typescript
export type ForegroundUserLocationOptions = {
  enabled: boolean;
  shouldPersist: boolean;
  onLocation?: ForegroundUserLocationCallback;
  onError?: (error: unknown) => void;
};
```

effect内では `shouldPersist` に応じてAccuracyを選び、購読は常に1つにする。最終取得位置は `onLocation` だけへ渡す。watch callbackは表示更新後、Promiseチェーンへ保存処理を積む。保存失敗時はセッション参照を破棄し、エラー通知後もチェーンを継続する。

- [ ] **Step 4: フックテストをGREENにする**

Run:

```text
npm test -- --runInBand src/app/hooks/__tests__/useForegroundUserLocation.test.tsx
```

Expected: PASS。

- [ ] **Step 5: 前景監視をコミットする**

```text
git add src/app/hooks/useForegroundUserLocation.ts src/app/hooks/__tests__/useForegroundUserLocation.test.tsx
git commit -m "feat(location): 前景位置監視からGPSログを保存する"
```

### Task 4: Appで権限・AppState・タスクを同期する

**Files:**

- Modify: `src/app/App.tsx`
- Modify: `src/app/__tests__/AppMapReturn.test.tsx`

- [ ] **Step 1: App連携の失敗テストを書く**

既存mockへ `stopBackgroundLocationRecording` と新しいフック引数の記録を追加し、次を検証する。

```typescript
expect(mockGetLocationPermissionState.mock.invocationCallOrder[0]).toBeLessThan(
  mockUpdateBackgroundLocationTaskOptionsIfNeeded.mock.invocationCallOrder[0],
);
expect(mockStopBackgroundLocationRecording).toHaveBeenCalledTimes(1);
expect(lastForegroundOptions).toMatchObject({ enabled: true, shouldPersist: true });
```

テストケースは以下を分ける。

- フォアグラウンド権限のみでは既存背景タスクを停止してから前景保存を有効にする
- `inactive` と `background` では `enabled=false` になる
- `active` 復帰後にタスク同期完了を待って再度 `enabled=true` になる
- 常時許可＋OS標準アイコンでは表示用前景購読も保存も有効にしない
- 常時許可＋カスタムアイコンでは `enabled=true`、`shouldPersist=false` であり、タスク更新は1回だけ行う
- 背景タスク停止失敗時は `shouldPersist=false` のままにする

- [ ] **Step 2: Appテストを実行してREDを確認する**

Run:

```text
npm test -- --runInBand src/app/__tests__/AppMapReturn.test.tsx src/app/__tests__/AppCustomIconCentering.test.tsx
```

Expected: 起動時更新順序と前景保存条件が未実装のためFAIL。

- [ ] **Step 3: 記録モード同期処理を実装する**

Appへ同期状態を追加する。

```typescript
const [isLocationRecordingModeSynchronized, setIsLocationRecordingModeSynchronized] = useState(false);
```

起動時とactive復帰時は、先に同期状態をfalseにして `refreshData()` を実行する。バックグラウンド権限がある場合だけ設定更新と自動開始を行い、ない場合は `stopBackgroundLocationRecording()` をawaitする。停止成功後に `setIsRecording(false)` と同期済み状態を反映する。停止失敗時は同期済みにせず、メッセージを表示する。

フック入力は以下で構成する。

```typescript
const shouldDisplayCustomLocation = !userLocationIcon.useNativeUserLocation;
const shouldPersistForegroundLocation = appState === 'active' && isWhileInUseRecordingMode && isLocationRecordingModeSynchronized;
const foregroundWatchEnabled = appState === 'active' && (shouldDisplayCustomLocation || shouldPersistForegroundLocation);

useForegroundUserLocation({
  enabled: foregroundWatchEnabled,
  shouldPersist: shouldPersistForegroundLocation,
  onLocation: shouldDisplayCustomLocation ? applyUserLocation : undefined,
  onError: handleForegroundLocationError,
});
```

- [ ] **Step 4: AppテストをGREENにする**

Run:

```text
npm test -- --runInBand src/app/__tests__/AppMapReturn.test.tsx src/app/__tests__/AppCustomIconCentering.test.tsx src/app/hooks/__tests__/useForegroundUserLocation.test.tsx
```

Expected: PASS。常時許可＋カスタムアイコンでも前景保存はfalse、TaskManagerタスクは既存の固定名1件だけを扱う。

- [ ] **Step 5: App連携をコミットする**

```text
git add src/app/App.tsx src/app/__tests__/AppMapReturn.test.tsx src/app/__tests__/AppCustomIconCentering.test.tsx
git commit -m "fix(location): 権限に応じて前景と背景の記録を同期する"
```

### Task 5: UI説明とアーキテクチャ文書を更新する

**Files:**

- Modify: `src/app/components/SettingsScreen.tsx`
- Modify: `src/app/components/__tests__/SettingsScreen.test.tsx`
- Modify: `docs/architecture.md`

- [ ] **Step 1: UI文言の失敗テストを書く**

フォアグラウンド限定モードの説明について次を期待する。

```typescript
expect(texts).toContain('アプリを画面に表示しているときのみ記録します。\n常に記録したいときは設定画面で変更してください。');
```

- [ ] **Step 2: UIテストを実行してREDを確認する**

Run:

```text
npm test -- --runInBand src/app/components/__tests__/SettingsScreen.test.tsx
```

Expected: 現在の「アプリが起動しているとき」と不一致でFAIL。

- [ ] **Step 3: 説明文とarchitectureを更新する**

設定画面の説明を設計書どおり変更する。`docs/architecture.md` へ、権限別の保存元、active限定、保存セッション共有、常時許可時の二重保存防止、権限低下時のタスク停止を追記する。

- [ ] **Step 4: UIテストをGREENにする**

Run:

```text
npm test -- --runInBand src/app/components/__tests__/SettingsScreen.test.tsx
```

Expected: PASS。

- [ ] **Step 5: UIと文書をコミットする**

```text
git add src/app/components/SettingsScreen.tsx src/app/components/__tests__/SettingsScreen.test.tsx docs/architecture.md
git commit -m "docs(location): 前景限定記録の動作を明記"
```

### Task 6: 全体検証とPR作成

**Files:**

- Verify: 全変更ファイル

- [ ] **Step 1: 位置情報関連の集中テストを実行する**

```text
npm test -- --runInBand src/features/location/__tests__/locationRecordingSession.test.ts src/features/location/__tests__/backgroundLocationTask.test.ts src/app/hooks/__tests__/useForegroundUserLocation.test.tsx src/app/__tests__/AppMapReturn.test.tsx src/app/__tests__/AppCustomIconCentering.test.tsx src/app/components/__tests__/SettingsScreen.test.tsx
```

Expected: 全suite PASS。

- [ ] **Step 2: 型チェックと全テストを実行する**

```text
npm run typecheck
npm test -- --runInBand
git diff --check codex/issue-89-location-task-options...HEAD
```

Expected: typecheck成功、全suite PASS、diff check出力なし。

- [ ] **Step 3: ブランチをpushする**

```text
git push -u origin codex/foreground-only-location-recording
```

- [ ] **Step 4: 親ブランチ向けOpen PRを作成する**

Baseは `codex/issue-89-location-task-options`、headは `codex/foreground-only-location-recording` とする。PR本文は日本語で変更内容、理由、影響範囲、検証結果、PR #90への依存を記載する。
