# iOS Background Distance Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dynamic Island等のバックグラウンド表示を非表示のまま、iOSの継続的なバックグラウンド位置更新を回復する。

**Architecture:** 位置情報タスクoptionsをプラットフォーム別に組み立て、iOSだけ `distanceInterval` を省略する。Androidは既存の5m距離フィルターを維持し、保存側の5m判定は変更しない。

**Tech Stack:** TypeScript、React Native Platform、Expo Location、Jest

---

## 実装タスク

### Task 1: プラットフォーム別タスクoptions

**Files:**
- Modify: `src/features/location/locationTrackingConfig.ts`
- Test: `src/features/location/__tests__/locationTrackingConfig.test.ts`

- [ ] **Step 1: iOSの距離フィルター省略を示す失敗テストを書く**

`Platform.OS`をiOSとして `getLocationTaskOptions()` を呼び、`distanceInterval` が存在しないことを検証する。Androidでは5を維持することも検証する。

- [ ] **Step 2: 対象テストを実行してREDを確認する**

Run: `npm test -- --runInBand src/features/location/__tests__/locationTrackingConfig.test.ts`

Expected: iOSのoptionsに現在の `distanceInterval: 5` が含まれるためFAIL。

- [ ] **Step 3: iOSだけdistanceIntervalを省略する**

`Platform.OS !== 'ios'` の場合だけ `distanceInterval: LOCATION_UPDATE_DISTANCE_METERS` をoptionsへ追加する。`showsBackgroundLocationIndicator: false` と他の監視設定は維持する。

- [ ] **Step 4: 対象テストを実行してGREENを確認する**

Run: `npm test -- --runInBand src/features/location/__tests__/locationTrackingConfig.test.ts src/features/location/__tests__/updateBackgroundLocationTaskOptionsIfNeeded.test.ts`

Expected: 両suiteがPASS。

- [ ] **Step 5: 実装をコミットする**

```text
git add src/features/location/locationTrackingConfig.ts src/features/location/__tests__/locationTrackingConfig.test.ts
git commit -m "fix(location): iOSの背景位置更新で距離フィルターを外す"
```

### Task 2: ドキュメントと全体検証

**Files:**
- Modify: `docs/architecture.md`

- [ ] **Step 1: iOS固有の監視設定をarchitectureへ追記する**

iOSではインジケーター非表示時のバックグラウンド継続性を優先してネイティブ距離フィルターを使わず、保存側の5m判定を維持することを記載する。

- [ ] **Step 2: 型チェックと全テストを実行する**

Run: `npm run typecheck`

Expected: exit 0。

Run: `npm test -- --runInBand`

Expected: 全suiteがPASS。

- [ ] **Step 3: 差分検査を実行する**

Run: `git diff --check`

Expected: 出力なし、exit 0。

- [ ] **Step 4: ドキュメントをコミットする**

```text
git add docs/architecture.md docs/superpowers/specs/2026-06-20-ios-background-distance-filter-design.md docs/superpowers/plans/2026-06-20-ios-background-distance-filter.md
git commit -m "docs(location): iOS背景位置更新の検証方針を追加"
```
