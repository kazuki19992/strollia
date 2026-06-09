# カスタムアイコン画像 + アプリカラープリセット Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plus会員向けにフォトライブラリからの現在地アイコン画像設定と、12色アプリカラープリセット選択を追加する。

**Architecture:** アプリカラーは `colorPresets.ts` でプリセット定義し `applyColorPreset` でランタイムテーマ上書き。カスタムアイコンは `UserLocationIconId` に `'custom'` を追加し `resolveUserLocationIcon` を URI 対応に拡張。どちらも Plus 非加入時は設定セクション非表示・デフォルト強制。

**Tech Stack:** React Native / Expo (expo-image-picker 新規インストール必要), TypeScript, Jest

---

## File Structure

- **新規** `src/features/customization/colorPresets.ts` — 12色プリセット定義・lookup
- **改修** `src/features/customization/customizationOptions.ts` — `'custom'` ID追加
- **改修** `src/features/customization/customizationResolver.ts` — URI対応・`resolveAppColorPreset`
- **改修** `src/theme/theme.ts` — `applyColorPreset` 追加
- **改修** `src/app/App.tsx` — state/設定読込/テーマ適用/picker呼び出し
- **改修** `src/app/components/SettingsScreen.tsx` — AppColorPicker・カスタムアイコンタイル
- **改修** `src/app/components/MapScreen.tsx` — `customImageUri` 円表示
- **改修** `src/app/appStyles.ts` — `customUserLocationMarkerImage` スタイル追加
- **テスト** `src/features/customization/__tests__/colorPresets.test.ts` — 新規
- **テスト** `src/features/customization/__tests__/customizationResolver.test.ts` — 既存拡張
- **テスト** `src/features/customization/__tests__/customizationOptions.test.ts` — 既存拡張
- **テスト** `src/theme/__tests__/theme.test.ts` — 既存拡張

テストコマンド（全タスク共通）: `npx jest`

---

### Task 1: expo-image-picker インストール

**Files:**
- Modify: `package.json`（自動）

- [ ] **Step 1: インストール**

```bash
npx expo install expo-image-picker
```

Expected: `package.json` の `dependencies` に `expo-image-picker` が追加される。

- [ ] **Step 2: インストール確認**

```bash
node -e "console.log(require('./package.json').dependencies['expo-image-picker'])"
```

Expected: バージョン文字列が出力される（例: `~16.0.6`）。

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: expo-image-pickerをインストールする"
```

---

### Task 2: アプリカラープリセット定義

**Files:**
- Create: `src/features/customization/colorPresets.ts`
- Test: `src/features/customization/__tests__/colorPresets.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/features/customization/__tests__/colorPresets.test.ts` を新規作成:

```typescript
import {
  APP_COLOR_PRESETS,
  DEFAULT_APP_COLOR_PRESET_ID,
  getAppColorPreset,
} from '../colorPresets';

describe('アプリカラープリセット colorPresets', () => {
  it('デフォルトIDはまっちゃ', () => {
    expect(DEFAULT_APP_COLOR_PRESET_ID).toBe('matcha');
  });

  it('12色のプリセットを持つ', () => {
    expect(APP_COLOR_PRESETS).toHaveLength(12);
  });

  it('まっちゃはlightThemeのprimary色を維持する', () => {
    const preset = getAppColorPreset('matcha');
    expect(preset.light.primary).toBe('#1f7a5c');
    expect(preset.dark.primary).toBe('#73c7a2');
  });

  it('未知IDはまっちゃへフォールバックする', () => {
    expect(getAppColorPreset('unknown' as never).id).toBe('matcha');
  });

  it('全プリセットがlight・dark両方の色を持つ', () => {
    for (const preset of APP_COLOR_PRESETS) {
      expect(preset.light.primary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(preset.light.primaryText).toMatch(/^#[0-9a-f]{6}$/i);
      expect(preset.light.mapLine).toMatch(/^#[0-9a-f]{6}$/i);
      expect(preset.dark.primary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(preset.dark.primaryText).toMatch(/^#[0-9a-f]{6}$/i);
      expect(preset.dark.mapLine).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
```

- [ ] **Step 2: テスト実行（FAIL確認）**

```bash
npx jest src/features/customization/__tests__/colorPresets.test.ts
```

Expected: FAIL（`colorPresets` モジュール未存在）

- [ ] **Step 3: colorPresets.ts を実装**

`src/features/customization/colorPresets.ts` を新規作成:

```typescript
/** アプリカラープリセットのID。 */
export type AppColorPresetId =
  | 'matcha' | 'wakaba' | 'himawari' | 'mikan' | 'yuuyake' | 'tomato'
  | 'sakura' | 'tasogare' | 'hoshizora' | 'umi' | 'ramune' | 'asatsuyu';

/** ライト・ダーク両モード用のprimary系色セット。 */
export type AppColorPresetColors = {
  primary: string;
  primaryText: string;
  mapLine: string;
};

/** アプリカラープリセット定義。 */
export type AppColorPreset = {
  id: AppColorPresetId;
  label: string;
  light: AppColorPresetColors;
  dark: AppColorPresetColors;
};

/** デフォルトで使うプリセットID（まっちゃ＝現在のプライマリカラー）。 */
export const DEFAULT_APP_COLOR_PRESET_ID: AppColorPresetId = 'matcha';

/** 12色のアプリカラープリセット一覧。 */
export const APP_COLOR_PRESETS: AppColorPreset[] = [
  {
    id: 'matcha',
    label: 'まっちゃ',
    light: { primary: '#1f7a5c', primaryText: '#fffdf8', mapLine: '#1f7a5c' },
    dark:  { primary: '#73c7a2', primaryText: '#102018', mapLine: '#73c7a2' },
  },
  {
    id: 'wakaba',
    label: 'わかば',
    light: { primary: '#5a8a1a', primaryText: '#ffffff', mapLine: '#5a8a1a' },
    dark:  { primary: '#9fd45a', primaryText: '#0f2000', mapLine: '#9fd45a' },
  },
  {
    id: 'himawari',
    label: 'ひまわり',
    light: { primary: '#b08000', primaryText: '#ffffff', mapLine: '#b08000' },
    dark:  { primary: '#f0c040', primaryText: '#1a1000', mapLine: '#f0c040' },
  },
  {
    id: 'mikan',
    label: 'みかん',
    light: { primary: '#c06010', primaryText: '#ffffff', mapLine: '#c06010' },
    dark:  { primary: '#f08840', primaryText: '#1a0800', mapLine: '#f08840' },
  },
  {
    id: 'yuuyake',
    label: 'ゆうやけ',
    light: { primary: '#c04020', primaryText: '#ffffff', mapLine: '#c04020' },
    dark:  { primary: '#f07050', primaryText: '#1a0500', mapLine: '#f07050' },
  },
  {
    id: 'tomato',
    label: 'トマト',
    light: { primary: '#b02020', primaryText: '#ffffff', mapLine: '#b02020' },
    dark:  { primary: '#f06060', primaryText: '#1a0000', mapLine: '#f06060' },
  },
  {
    id: 'sakura',
    label: 'さくら',
    light: { primary: '#b04070', primaryText: '#ffffff', mapLine: '#b04070' },
    dark:  { primary: '#f090b0', primaryText: '#1a0010', mapLine: '#f090b0' },
  },
  {
    id: 'tasogare',
    label: 'たそがれ',
    light: { primary: '#6030a0', primaryText: '#ffffff', mapLine: '#6030a0' },
    dark:  { primary: '#a870e0', primaryText: '#0a0018', mapLine: '#a870e0' },
  },
  {
    id: 'hoshizora',
    label: 'ほしぞら',
    light: { primary: '#3040a0', primaryText: '#ffffff', mapLine: '#3040a0' },
    dark:  { primary: '#7090e0', primaryText: '#00001a', mapLine: '#7090e0' },
  },
  {
    id: 'umi',
    label: 'うみ',
    light: { primary: '#1060a0', primaryText: '#ffffff', mapLine: '#1060a0' },
    dark:  { primary: '#50a0e0', primaryText: '#00101a', mapLine: '#50a0e0' },
  },
  {
    id: 'ramune',
    label: 'ラムネ',
    light: { primary: '#008090', primaryText: '#ffffff', mapLine: '#008090' },
    dark:  { primary: '#40c0d0', primaryText: '#001a1a', mapLine: '#40c0d0' },
  },
  {
    id: 'asatsuyu',
    label: 'あさつゆ',
    light: { primary: '#007060', primaryText: '#ffffff', mapLine: '#007060' },
    dark:  { primary: '#50b0a0', primaryText: '#001a16', mapLine: '#50b0a0' },
  },
];

/**
 * IDからプリセットを取得する。未知IDはまっちゃへフォールバック。
 *
 * @param id - 取得するプリセットID。
 * @returns 対応するプリセット。見つからない場合はまっちゃ。
 */
export function getAppColorPreset(id: AppColorPresetId): AppColorPreset {
  return APP_COLOR_PRESETS.find((preset) => preset.id === id) ?? APP_COLOR_PRESETS[0];
}

/**
 * 文字列がAppColorPresetIdとして有効か判定する。
 *
 * @param value - 判定する文字列。
 * @returns 有効なIDであればtrue。
 */
export function isAppColorPresetId(value: string): value is AppColorPresetId {
  return APP_COLOR_PRESETS.some((preset) => preset.id === value);
}
```

- [ ] **Step 4: テスト実行（PASS確認）**

```bash
npx jest src/features/customization/__tests__/colorPresets.test.ts
```

Expected: PASS（5テスト）

- [ ] **Step 5: Commit**

```bash
git add src/features/customization/colorPresets.ts src/features/customization/__tests__/colorPresets.test.ts
git commit -m "feat(color): アプリカラープリセット定義を追加する"
```

---

### Task 3: theme.ts に applyColorPreset を追加

**Files:**
- Modify: `src/theme/theme.ts`
- Test: `src/theme/__tests__/theme.test.ts`

- [ ] **Step 1: 失敗するテストを追加**

`src/theme/__tests__/theme.test.ts` の末尾に追加:

```typescript
import { applyColorPreset } from '../theme';
import { getAppColorPreset } from '../../features/customization/colorPresets';

describe('テーマへのプリセット適用 applyColorPreset', () => {
  it('lightThemeにまっちゃ以外のプリセットを適用するとprimaryが変わる', () => {
    const preset = getAppColorPreset('tomato');
    const applied = applyColorPreset(lightTheme, preset);
    expect(applied.colors.primary).toBe('#b02020');
    expect(applied.colors.primaryText).toBe('#ffffff');
    expect(applied.colors.mapLine).toBe('#b02020');
  });

  it('darkThemeにプリセットを適用するとdark色が使われる', () => {
    const preset = getAppColorPreset('tomato');
    const applied = applyColorPreset(darkTheme, preset);
    expect(applied.colors.primary).toBe('#f06060');
  });

  it('applyColorPresetは元のテーマを変更しない', () => {
    const preset = getAppColorPreset('umi');
    applyColorPreset(lightTheme, preset);
    expect(lightTheme.colors.primary).toBe('#1f7a5c');
  });

  it('まっちゃを適用するとデフォルトのprimary色になる', () => {
    const preset = getAppColorPreset('matcha');
    const applied = applyColorPreset(lightTheme, preset);
    expect(applied.colors.primary).toBe('#1f7a5c');
  });
});
```

ファイル冒頭の import 行を更新（既存の import 文に `applyColorPreset` を追加）:

```typescript
import { applyColorPreset, darkTheme, getAppTheme, isAppThemePreference, lightTheme } from '../theme';
```

- [ ] **Step 2: テスト実行（FAIL確認）**

```bash
npx jest src/theme/__tests__/theme.test.ts
```

Expected: FAIL（`applyColorPreset` 未定義）

- [ ] **Step 3: theme.ts に applyColorPreset を追加**

`src/theme/theme.ts` の末尾（`getAppTheme` の後）に追加:

```typescript
import type { AppColorPreset } from '../features/customization/colorPresets';

/**
 * テーマにカラープリセットのprimary系色を上書きした新しいテーマを返す。
 * 元のテーマオブジェクトは変更しない。
 *
 * @param theme - ベースとなるテーマ。
 * @param preset - 適用するカラープリセット。
 * @returns primary/primaryText/mapLineを上書きした新しいテーマ。
 */
export function applyColorPreset(theme: AppTheme, preset: AppColorPreset): AppTheme {
  const colors = theme.name === 'dark' ? preset.dark : preset.light;
  return {
    ...theme,
    colors: { ...theme.colors, ...colors },
  };
}
```

- [ ] **Step 4: テスト実行（PASS確認）**

```bash
npx jest src/theme/__tests__/theme.test.ts
```

Expected: PASS（全テスト）

- [ ] **Step 5: Commit**

```bash
git add src/theme/theme.ts src/theme/__tests__/theme.test.ts
git commit -m "feat(theme): applyColorPresetでカラープリセットをテーマに適用する関数を追加する"
```

---

### Task 4: customizationOptions に 'custom' を追加

**Files:**
- Modify: `src/features/customization/customizationOptions.ts`
- Test: `src/features/customization/__tests__/customizationOptions.test.ts`

- [ ] **Step 1: 失敗するテストを追加**

`src/features/customization/__tests__/customizationOptions.test.ts` の末尾に追加:

```typescript
  it('現在地アイコンIDにcustomを含む', () => {
    const allIds = USER_LOCATION_ICON_OPTIONS.map((o) => o.id);
    expect(allIds).toContain('custom');
  });

  it('customはPlus限定である', () => {
    const custom = getUserLocationIconOption('custom');
    expect(custom.premium).toBe(true);
  });

  it('Plus有効時の利用可能アイコンにcustomを含む', () => {
    const available = getAvailableCustomizationOptions(USER_LOCATION_ICON_OPTIONS, true);
    expect(available.map((o) => o.id)).toContain('custom');
  });
```

- [ ] **Step 2: テスト実行（FAIL確認）**

```bash
npx jest src/features/customization/__tests__/customizationOptions.test.ts
```

Expected: FAIL

- [ ] **Step 3: customizationOptions.ts を更新**

`src/features/customization/customizationOptions.ts` を以下に置き換え:

```typescript
/** 現在地アイコンの表示スタイルID。 */
export type UserLocationIconId = 'default' | 'walker' | 'compass' | 'custom';

/** 現在地アイコンの選択肢。 */
export type UserLocationIconOption = {
  /** アイコンID。 */
  id: UserLocationIconId;
  /** 表示名。 */
  label: string;
  /** Strollia Plus限定の場合はtrue。 */
  premium: boolean;
};

/** 初期状態で使うOS標準の現在地アイコン。 */
export const DEFAULT_USER_LOCATION_ICON_ID: UserLocationIconId = 'default';

/** 現在地アイコン候補。 */
export const USER_LOCATION_ICON_OPTIONS: UserLocationIconOption[] = [
  { id: 'default', label: 'OS標準', premium: false },
  { id: 'walker', label: 'さんぽ', premium: true },
  { id: 'compass', label: 'コンパス', premium: true },
  { id: 'custom', label: 'カスタム', premium: true },
];

/**
 * 課金状態に応じて選べる項目だけを返す。
 *
 * @param options - premiumフラグを持つ選択肢一覧。
 * @param isPlusActive - Strollia Plusが有効かどうか。
 * @returns 無料またはPlus有効時に選べる項目一覧。
 */
export function getAvailableCustomizationOptions<T extends { premium: boolean }>(options: T[], isPlusActive: boolean): T[] {
  return options.filter((option) => isPlusActive || !option.premium);
}

/**
 * 現在地アイコンIDから設定を取得する。
 *
 * @param id - 取得したい現在地アイコンID。
 * @returns 対応するアイコン設定。見つからない場合はOS標準。
 */
export function getUserLocationIconOption(id: UserLocationIconId): UserLocationIconOption {
  return USER_LOCATION_ICON_OPTIONS.find((option) => option.id === id) ?? USER_LOCATION_ICON_OPTIONS[0];
}
```

- [ ] **Step 4: テスト実行（PASS確認）**

```bash
npx jest src/features/customization/__tests__/customizationOptions.test.ts
```

Expected: PASS（全テスト）

- [ ] **Step 5: Commit**

```bash
git add src/features/customization/customizationOptions.ts src/features/customization/__tests__/customizationOptions.test.ts
git commit -m "feat(icon): 現在地アイコンIDにcustomを追加する"
```

---

### Task 5: customizationResolver を URI 対応に拡張

**Files:**
- Modify: `src/features/customization/customizationResolver.ts`
- Test: `src/features/customization/__tests__/customizationResolver.test.ts`

- [ ] **Step 1: 失敗するテストを追加**

`src/features/customization/__tests__/customizationResolver.test.ts` の既存テストはそのまま残し、末尾に追加:

```typescript
  it('customかつURIありPlusActiveのとき customImageUri を返す', () => {
    expect(resolveUserLocationIcon('custom', true, 'file:///tmp/icon.jpg')).toEqual({
      useNativeUserLocation: false,
      customIconId: null,
      customImageUri: 'file:///tmp/icon.jpg',
    });
  });

  it('customかつURIなしのときOS標準へフォールバックする', () => {
    expect(resolveUserLocationIcon('custom', true, null)).toEqual({
      useNativeUserLocation: true,
      customIconId: null,
      customImageUri: null,
    });
  });

  it('customかつPlus非加入のときOS標準へフォールバックする', () => {
    expect(resolveUserLocationIcon('custom', false, 'file:///tmp/icon.jpg')).toEqual({
      useNativeUserLocation: true,
      customIconId: null,
      customImageUri: null,
    });
  });

  it('walkerかつPlus有効のとき customIconId を返す（customImageUriはnull）', () => {
    expect(resolveUserLocationIcon('walker', true, null)).toEqual({
      useNativeUserLocation: false,
      customIconId: 'walker',
      customImageUri: null,
    });
  });

  it('無課金時の現在地アイコンはOS標準（既存テストをcustomImageUri対応で更新）', () => {
    expect(resolveUserLocationIcon('walker', false, null)).toEqual({
      useNativeUserLocation: true,
      customIconId: null,
      customImageUri: null,
    });
  });
```

既存の2テストは `customImageUri: null` が含まれないため削除し上記で置き換える。

- [ ] **Step 2: テスト実行（FAIL確認）**

```bash
npx jest src/features/customization/__tests__/customizationResolver.test.ts
```

Expected: FAIL（`customImageUri` プロパティ未存在・第3引数未対応）

- [ ] **Step 3: customizationResolver.ts を更新**

`src/features/customization/customizationResolver.ts` を以下に置き換え:

```typescript
import {
  DEFAULT_USER_LOCATION_ICON_ID,
  getUserLocationIconOption,
  UserLocationIconId,
} from './customizationOptions';

/** 現在地アイコン描画方式の判定結果。 */
export type ResolvedUserLocationIcon = {
  /** OS標準の現在地表示を使う場合はtrue。 */
  useNativeUserLocation: boolean;
  /** walker/compassアイコンで描画する場合のID。 */
  customIconId: 'walker' | 'compass' | null;
  /** カスタム画像URIで描画する場合のURI。 */
  customImageUri: string | null;
};

/**
 * 課金状態を考慮して現在地アイコン描画方式を解決する。
 *
 * @param selectedId - ユーザーが選択した現在地アイコンID。
 * @param isPlusActive - Strollia Plusが有効かどうか。
 * @param customImageUri - カスタム画像URI（'custom'選択時のみ使用）。
 * @returns OS標準表示・アイコン表示・カスタム画像表示のいずれかの判定結果。
 */
export function resolveUserLocationIcon(
  selectedId: UserLocationIconId,
  isPlusActive: boolean,
  customImageUri: string | null,
): ResolvedUserLocationIcon {
  const selectedOption = getUserLocationIconOption(selectedId);

  if (selectedOption.id === DEFAULT_USER_LOCATION_ICON_ID || (selectedOption.premium && !isPlusActive)) {
    return { useNativeUserLocation: true, customIconId: null, customImageUri: null };
  }

  if (selectedOption.id === 'custom') {
    if (!customImageUri) {
      return { useNativeUserLocation: true, customIconId: null, customImageUri: null };
    }
    return { useNativeUserLocation: false, customIconId: null, customImageUri };
  }

  if (selectedOption.id === 'walker' || selectedOption.id === 'compass') {
    return { useNativeUserLocation: false, customIconId: selectedOption.id, customImageUri: null };
  }

  return { useNativeUserLocation: true, customIconId: null, customImageUri: null };
}
```

- [ ] **Step 4: テスト実行（PASS確認）**

```bash
npx jest src/features/customization/__tests__/customizationResolver.test.ts
```

Expected: PASS（全テスト）

- [ ] **Step 5: Commit**

```bash
git add src/features/customization/customizationResolver.ts src/features/customization/__tests__/customizationResolver.test.ts
git commit -m "feat(icon): resolveUserLocationIconをカスタム画像URI対応に拡張する"
```

---

### Task 6: appStyles に customUserLocationMarkerImage を追加

**Files:**
- Modify: `src/app/appStyles.ts`

このタスクはスタイル追加のみ。TDD として「スタイルが存在する」アサーションを書く。

- [ ] **Step 1: 失敗するテストを書く**

既存の `src/app/components/__tests__/ScreenComponents.test.tsx` （またはスタイルテスト用ファイルがあればそこ）に追加。なければ新規で `src/app/__tests__/appStylesCustomIcon.test.ts` を作成:

```typescript
import { createStyles } from '../appStyles';
import { lightTheme } from '../../theme/theme';

describe('カスタムアイコン画像スタイル', () => {
  it('customUserLocationMarkerImageスタイルを持つ', () => {
    const styles = createStyles(lightTheme);
    expect(styles.customUserLocationMarkerImage).toBeDefined();
  });

  it('customUserLocationMarkerImageは正方形かつborderRadius:999である', () => {
    const styles = createStyles(lightTheme);
    expect(styles.customUserLocationMarkerImage.width).toBe(42);
    expect(styles.customUserLocationMarkerImage.height).toBe(42);
    expect(styles.customUserLocationMarkerImage.borderRadius).toBe(999);
  });
});
```

- [ ] **Step 2: テスト実行（FAIL確認）**

```bash
npx jest src/app/__tests__/appStylesCustomIcon.test.ts
```

Expected: FAIL

- [ ] **Step 3: appStyles.ts に customUserLocationMarkerImage を追加**

`src/app/appStyles.ts` の `customUserLocationMarker` 定義の直後に追加:

```typescript
    customUserLocationMarkerImage: {
      borderColor: colors.card,
      borderRadius: 999,
      borderWidth: 3,
      height: 42,
      width: 42,
    },
```

- [ ] **Step 4: テスト実行（PASS確認）**

```bash
npx jest src/app/__tests__/appStylesCustomIcon.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/appStyles.ts src/app/__tests__/appStylesCustomIcon.test.ts
git commit -m "style(icon): カスタム画像アイコン用の円スタイルを追加する"
```

---

### Task 7: MapScreen でカスタム画像を描画

**Files:**
- Modify: `src/app/components/MapScreen.tsx`

`ResolvedUserLocationIcon` に `customImageUri` が加わったため、MapScreen の Marker 描画を更新する。

- [ ] **Step 1: MapScreen.tsx の Marker 部分を更新**

`src/app/components/MapScreen.tsx` の imports に `Image` を追加:

```typescript
import { Image, SafeAreaView, ... } from 'react-native';
```

Marker 描画ブロック（`!userLocationIcon.useNativeUserLocation && userCoordinate` の条件）を以下に置き換え:

```tsx
        {!userLocationIcon.useNativeUserLocation && userCoordinate && (
          <Marker coordinate={userCoordinate} anchor={{ x: 0.5, y: 0.5 }}>
            {userLocationIcon.customImageUri ? (
              <Image
                source={{ uri: userLocationIcon.customImageUri }}
                style={styles.customUserLocationMarkerImage}
                onError={() => {
                  // URI読み込み失敗時はApp.tsx側でフォールバック処理を行う
                }}
              />
            ) : (
              <View style={styles.customUserLocationMarker}>
                <MaterialCommunityIcons
                  name={userLocationIcon.customIconId === 'compass' ? 'compass' : 'walk'}
                  size={22}
                  color={theme.colors.primaryText}
                />
              </View>
            )}
          </Marker>
        )}
```

- [ ] **Step 2: 全テスト実行（回帰確認）**

```bash
npx jest
```

Expected: PASS（既存テストに回帰なし。MapScreen はモック済みのため直接テストなし）

- [ ] **Step 3: Commit**

```bash
git add src/app/components/MapScreen.tsx
git commit -m "feat(icon): MapScreenでカスタム画像アイコンを円表示する"
```

---

### Task 8: App.tsx にアプリカラーとカスタムアイコンのstate・ロジックを追加

**Files:**
- Modify: `src/app/App.tsx`

このタスクで追加・変更する内容：
1. `selectedAppColorPresetId` state と設定読込・保存
2. `customIconImageUri` state と設定読込
3. `userLocationIcon` useMemo を第3引数付きに更新
4. `theme` useMemo に `applyColorPreset` 適用を追加
5. `updateAppColorPreset` 関数
6. `pickCustomIcon` 関数（expo-image-picker呼び出し）
7. `SettingsScreen` へ新プロップ追加

- [ ] **Step 1: App.tsx を更新**

**imports に追加（既存 imports の後）:**

```typescript
import * as ImagePicker from 'expo-image-picker';
import {
  APP_COLOR_PRESET_SETTING_KEY,  // 後述の定数
  AppColorPresetId,
  DEFAULT_APP_COLOR_PRESET_ID,
  getAppColorPreset,
  isAppColorPresetId,
} from '../features/customization/colorPresets';
import { applyColorPreset } from '../theme/theme';
```

**定数追加（`USER_LOCATION_ICON_SETTING_KEY` の近くに）:**

```typescript
const APP_COLOR_PRESET_SETTING_KEY = 'appColorPresetId';
const CUSTOM_ICON_IMAGE_URI_SETTING_KEY = 'customIconImageUri';
```

**state 追加（`selectedUserLocationIconId` state の近くに）:**

```typescript
  const [selectedAppColorPresetId, setSelectedAppColorPresetId] = useState<AppColorPresetId>(DEFAULT_APP_COLOR_PRESET_ID);
  const [customIconImageUri, setCustomIconImageUri] = useState<string | null>(null);
```

**`userLocationIcon` useMemo を更新（第3引数追加）:**

```typescript
  const userLocationIcon = useMemo(
    () => resolveUserLocationIcon(selectedUserLocationIconId, premiumAccessState.isPlusActive, customIconImageUri),
    [premiumAccessState.isPlusActive, selectedUserLocationIconId, customIconImageUri],
  );
```

**`theme` useMemo を更新（`src/app/App.tsx:152` 付近）:**

既存コード（`src/app/App.tsx:152`）:

```typescript
  const colorScheme = useColorScheme();
  const theme = useMemo(() => getAppTheme(colorScheme), [colorScheme]);
```

を以下に置き換える:

```typescript
  const colorScheme = useColorScheme();
  const theme = useMemo(() => {
    const rawTheme = getAppTheme(colorScheme);
    const preset = premiumAccessState.isPlusActive
      ? getAppColorPreset(selectedAppColorPresetId)
      : getAppColorPreset(DEFAULT_APP_COLOR_PRESET_ID);
    return applyColorPreset(rawTheme, preset);
  }, [colorScheme, premiumAccessState.isPlusActive, selectedAppColorPresetId]);
```

**設定読み込みに追加（`Promise.all` で読み込んでいる箇所）:**

```typescript
        const [savedKeepScreenAwake, savedShowPhotosOnMap, savedUserLocationIcon, savedAppColorPresetId, savedCustomIconImageUri] = await Promise.all([
          getBooleanSetting(KEEP_SCREEN_AWAKE_SETTING_KEY, false),
          getBooleanSetting(SHOW_PHOTOS_ON_MAP_SETTING_KEY, false),
          getStringSetting(USER_LOCATION_ICON_SETTING_KEY, DEFAULT_USER_LOCATION_ICON_ID),
          getStringSetting(APP_COLOR_PRESET_SETTING_KEY, DEFAULT_APP_COLOR_PRESET_ID),
          getStringSetting(CUSTOM_ICON_IMAGE_URI_SETTING_KEY, ''),
        ]);
        setKeepScreenAwake(savedKeepScreenAwake);
        setShowPhotosOnMap(savedShowPhotosOnMap);
        setSelectedUserLocationIconId(getUserLocationIconOption(savedUserLocationIcon as UserLocationIconId).id);
        setSelectedAppColorPresetId(isAppColorPresetId(savedAppColorPresetId) ? savedAppColorPresetId : DEFAULT_APP_COLOR_PRESET_ID);
        setCustomIconImageUri(savedCustomIconImageUri || null);
```

**`updateAppColorPreset` 関数を追加（`updateUserLocationIcon` の近くに）:**

```typescript
  /**
   * アプリカラープリセットを保存して即時反映する。
   *
   * @param presetId - 保存するプリセットID。
   */
  function updateAppColorPreset(presetId: AppColorPresetId): void {
    triggerSelectionHaptic();
    setSelectedAppColorPresetId(presetId);
    setSetting(APP_COLOR_PRESET_SETTING_KEY, presetId).catch((error: unknown) => {
      Alert.alert('設定保存失敗', error instanceof Error ? error.message : 'アプリカラーを保存できませんでした。');
    });
  }
```

**`pickCustomIcon` 関数を追加（`updateUserLocationIcon` の近くに）:**

```typescript
  /**
   * フォトライブラリからカスタムアイコン画像を選択して保存する。
   * システムの正方形クロップUIを使用する。
   */
  async function pickCustomIcon(): Promise<void> {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('権限が必要です', 'カスタムアイコンを設定するには写真へのアクセス権限が必要です。');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (result.canceled) {
      return;
    }

    const uri = result.assets[0].uri;
    setCustomIconImageUri(uri);
    setSelectedUserLocationIconId('custom');
    setSetting(CUSTOM_ICON_IMAGE_URI_SETTING_KEY, uri).catch((error: unknown) => {
      Alert.alert('設定保存失敗', error instanceof Error ? error.message : 'カスタムアイコンを保存できませんでした。');
    });
    setSetting(USER_LOCATION_ICON_SETTING_KEY, 'custom').catch((error: unknown) => {
      Alert.alert('設定保存失敗', error instanceof Error ? error.message : '現在地アイコンを保存できませんでした。');
    });
    Alert.alert('カスタムアイコン', '写真をアルバムから削除するとOS標準に戻ります。');
  }
```

**`updateUserLocationIcon` に custom タップ時の分岐を追加:**

```typescript
  function updateUserLocationIcon(iconId: UserLocationIconId): void {
    const option = getUserLocationIconOption(iconId);

    if (option.premium && !premiumAccessState.isPlusActive) {
      showPremiumLockedMessage(option.label);
      return;
    }

    if (iconId === 'custom') {
      pickCustomIcon().catch((error: unknown) => {
        console.warn('pickCustomIcon failed:', error);
      });
      return;
    }

    triggerSelectionHaptic();
    setSelectedUserLocationIconId(option.id);
    setSetting(USER_LOCATION_ICON_SETTING_KEY, option.id).catch((error: unknown) => {
      Alert.alert('設定保存失敗', error instanceof Error ? error.message : '現在地アイコンを保存できませんでした。');
    });
  }
```

**`SettingsScreen` props に追加（JSX の `<SettingsScreen` に）:**

```tsx
                        selectedAppColorPresetId={selectedAppColorPresetId}
                        onUpdateAppColorPreset={updateAppColorPreset}
```

- [ ] **Step 2: 全テスト実行（型エラーがないか確認）**

```bash
npx jest
```

Expected: PASS（SettingsScreen 側の props が増えたことによる型エラーはまだない。SettingsScreen の型定義を次タスクで更新するまでは TypeScript エラーが出る可能性があるが jest テストは通る）

- [ ] **Step 3: Commit**

```bash
git add src/app/App.tsx
git commit -m "feat: アプリカラーとカスタムアイコンのstate・ロジックをApp.tsxに追加する"
```

---

### Task 9: SettingsScreen にアプリカラーPicker・カスタムアイコンタイルを追加

**Files:**
- Modify: `src/app/components/SettingsScreen.tsx`
- Test: `src/app/components/__tests__/SettingsScreen.test.tsx`

- [ ] **Step 1: SettingsScreen.test.tsx にテストを追加**

`src/app/components/__tests__/SettingsScreen.test.tsx` でアプリカラー・カスタムアイコン関連のテストを追加。まず既存テストが動くことを確認してから追加箇所を探す:

```bash
npx jest src/app/components/__tests__/SettingsScreen.test.tsx
```

テストが通ったら、既存の `describe` ブロック末尾に追加（ファイルの末尾近くの `}` の前）:

```typescript
  describe('Plus会員向けカスタマイズ', () => {
    test('Plus会員はアプリカラーセクションを表示する', async () => {
      const plusProps = {
        ...baseProps,
        premiumAccessState: { isPlusActive: true, entitlementId: 'strollia_plus' },
        selectedAppColorPresetId: 'matcha' as const,
        onUpdateAppColorPreset: jest.fn(),
      };
      let renderer: any;
      await act(async () => {
        renderer = ReactTestRenderer.create(<SettingsScreen {...plusProps} />);
      });
      const texts = renderer.root.findAllByType(Text).map((n: any) => n.props.children);
      expect(texts).toContain('アプリカラー');
    });

    test('非Plus会員はアプリカラーセクションを表示しない', async () => {
      const freeProps = {
        ...baseProps,
        premiumAccessState: { isPlusActive: false, entitlementId: 'strollia_plus' },
        selectedAppColorPresetId: 'matcha' as const,
        onUpdateAppColorPreset: jest.fn(),
      };
      let renderer: any;
      await act(async () => {
        renderer = ReactTestRenderer.create(<SettingsScreen {...freeProps} />);
      });
      const texts = renderer.root.findAllByType(Text).map((n: any) => n.props.children);
      expect(texts).not.toContain('アプリカラー');
    });
  });
```

注: `baseProps` の定義箇所（既存テストが `baseProps` or 直接 props を渡している場合はそのパターンに合わせる）と `Text` の import を確認して合わせること。

- [ ] **Step 2: テスト実行（FAIL確認）**

```bash
npx jest src/app/components/__tests__/SettingsScreen.test.tsx -t "アプリカラー"
```

Expected: FAIL（props 型に `selectedAppColorPresetId` / `onUpdateAppColorPreset` が未追加）

- [ ] **Step 3: SettingsScreen.tsx を更新**

**imports に追加:**

```typescript
import { Modal, Pressable, ... } from 'react-native';  // Modal を追加
import {
  APP_COLOR_PRESETS,
  AppColorPresetId,
  getAppColorPreset,
} from '../../features/customization/colorPresets';
```

**`SettingsScreenProps` 型に追加（`onUpdateUserLocationIcon` の近くに）:**

```typescript
  /** 選択中のアプリカラープリセットID。 */
  selectedAppColorPresetId: AppColorPresetId;
  /** アプリカラープリセット更新処理。 */
  onUpdateAppColorPreset: (presetId: AppColorPresetId) => void;
```

**`SettingsScreen` 関数の分割代入に追加:**

```typescript
  selectedAppColorPresetId,
  onUpdateAppColorPreset,
```

**`UserLocationIconPicker` の直後に `AppColorPicker` を追加（`isPlusActive` 条件ブロック内）:**

```tsx
          {isPlusActive ? (
            <>
              <UserLocationIconPicker
                isPlusActive={isPlusActive}
                selectedUserLocationIconId={selectedUserLocationIconId}
                styles={styles}
                theme={theme}
                onUpdateUserLocationIcon={onUpdateUserLocationIcon}
              />
              <AppColorPicker
                styles={styles}
                theme={theme}
                selectedPresetId={selectedAppColorPresetId}
                onUpdatePreset={onUpdateAppColorPreset}
              />
            </>
          ) : null}
```

**`AppColorPicker` コンポーネントを `UserLocationIconPicker` の後に追加（ファイル末尾近く）:**

```tsx
type AppColorPickerProps = {
  styles: AppStyles;
  theme: AppTheme;
  selectedPresetId: AppColorPresetId;
  onUpdatePreset: (presetId: AppColorPresetId) => void;
};

/** アプリカラープリセット選択ドロップダウン。 */
function AppColorPicker({ styles, theme, selectedPresetId, onUpdatePreset }: AppColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedPreset = getAppColorPreset(selectedPresetId);
  const dotColor = theme.name === 'dark' ? selectedPreset.dark.primary : selectedPreset.light.primary;

  return (
    <OptionGroup styles={styles} title="アプリカラー (Strollia Plus)">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="アプリカラーを選択"
        onPress={() => setIsOpen(true)}
        style={styles.colorPresetDropdownButton}
      >
        <View style={[styles.colorPresetDot, { backgroundColor: dotColor }]} />
        <Text style={styles.colorPresetLabel}>{selectedPreset.label}</Text>
        <MaterialCommunityIcons name="chevron-down" size={18} color={theme.colors.mutedText} />
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.colorPresetModalBackdrop} onPress={() => setIsOpen(false)}>
          <View style={styles.colorPresetModalSheet}>
            {APP_COLOR_PRESETS.map((preset) => {
              const presetDotColor = theme.name === 'dark' ? preset.dark.primary : preset.light.primary;
              const isSelected = preset.id === selectedPresetId;

              return (
                <Pressable
                  key={preset.id}
                  accessibilityRole="button"
                  accessibilityLabel={preset.label}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    onUpdatePreset(preset.id);
                    setIsOpen(false);
                  }}
                  style={styles.colorPresetRow}
                >
                  <View style={[styles.colorPresetDot, { backgroundColor: presetDotColor }]} />
                  <Text style={styles.colorPresetRowLabel}>{preset.label}</Text>
                  {isSelected && (
                    <MaterialCommunityIcons name="check" size={18} color={theme.colors.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </OptionGroup>
  );
}
```

- [ ] **Step 4: appStyles.ts にカラーPicker用スタイルを追加**

`src/app/appStyles.ts` の `colorPreset` 系スタイルを追加（例: `customizationOption` の近くに）:

```typescript
    colorPresetDropdownButton: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      alignSelf: 'stretch',
    },
    colorPresetDot: {
      borderRadius: 999,
      height: 16,
      width: 16,
    },
    colorPresetLabel: {
      color: colors.text,
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
    },
    colorPresetModalBackdrop: {
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      flex: 1,
      justifyContent: 'flex-end',
    },
    colorPresetModalSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 34,
      paddingTop: 8,
    },
    colorPresetRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    colorPresetRowLabel: {
      color: colors.text,
      flex: 1,
      fontSize: 16,
    },
```

**また、`UserLocationIconPicker` の `'custom'` タイルのアイコン部分を更新:**

`UserLocationIconPicker` 内の `iconName` 計算を更新:

```typescript
        const iconName: MaterialIconName =
          option.id === 'compass' ? 'compass-outline'
          : option.id === 'walker' ? 'walk'
          : option.id === 'custom' ? 'image-outline'
          : 'crosshairs-gps';
```

- [ ] **Step 5: テスト実行（PASS確認）**

```bash
npx jest src/app/components/__tests__/SettingsScreen.test.tsx
```

Expected: PASS

- [ ] **Step 6: 全テスト実行**

```bash
npx jest
```

Expected: PASS（全テスト）

- [ ] **Step 7: Commit**

```bash
git add src/app/components/SettingsScreen.tsx src/app/appStyles.ts src/app/components/__tests__/SettingsScreen.test.tsx
git commit -m "feat(settings): アプリカラーPickerとカスタムアイコンタイルを設定画面に追加する"
```

---

### Task 10: AppMapReturn テストを新 props 対応に更新

**Files:**
- Modify: `src/app/__tests__/AppMapReturn.test.tsx`

App.tsx の `SettingsScreen` に新 props が追加されたため、モックが型エラーになっている場合を修正する（モックは `() => null` なので実際は問題ないが、SettingsScreen mock の型定義が strict な場合に備える）。

- [ ] **Step 1: 全テスト実行して型エラーを確認**

```bash
npx jest src/app/__tests__/AppMapReturn.test.tsx
```

Expected: PASS（SettingsScreen はモックになっており props を受け取らないため、通常は型エラーにならない）

もし FAIL した場合は `SettingsScreen` モック内で新 props を受け取るよう更新する。

- [ ] **Step 2: tsc で型チェック**

```bash
npx tsc --noEmit 2>&1 | grep -v "importRepository.test" | head -20
```

型エラーが出た場合は対応する（`importRepository.test.ts` の既存エラーは無視）。

- [ ] **Step 3: 全テスト実行（最終確認）**

```bash
npx jest
```

Expected: PASS（全テスト）

- [ ] **Step 4: Commit**

```bash
git add src/app/__tests__/AppMapReturn.test.tsx
git commit -m "fix(test): 新propsに対応してAppMapReturnテストを更新する"
```

（変更がなければこのタスクはスキップ）

---

## 完了後

全タスク完了後、`superpowers:finishing-a-development-branch` スキルでテスト確認・ブランチ完了処理を行う。
