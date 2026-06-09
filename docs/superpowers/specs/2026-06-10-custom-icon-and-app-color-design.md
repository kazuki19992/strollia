# カスタムアイコン画像 + アプリカラープリセット 設計

## 概要

Strollia Plus 会員向けに2つのカスタマイズ機能を追加する。

1. **カスタムアイコン画像:** フォトライブラリから任意の画像を現在地アイコンとして使用できる（正方形クロップ→円表示）。
2. **アプリカラープリセット:** 12色のプリセットから「まっちゃ」などを選択し、`primary` / `primaryText` / `mapLine` を一括変更する。

どちらも Plus 未加入の場合は設定セクションを非表示にし、強制的にデフォルト値（OS標準 / まっちゃ）を適用する。

---

## ファイル構成

| ファイル | 変更種別 | 責務 |
|---------|---------|------|
| `src/features/customization/colorPresets.ts` | 新規 | 12色プリセット定義 |
| `src/features/customization/customizationOptions.ts` | 改修 | `UserLocationIconId` に `'custom'` 追加 |
| `src/features/customization/customizationResolver.ts` | 改修 | カスタム画像URI対応・`resolveAppColorPreset` 追加 |
| `src/theme/theme.ts` | 改修 | `applyColorPreset` 追加（テーマにプリセット色を上書き） |
| `src/features/settings/settingsRepository.ts` | 改修 | `customIconImageUri` / `appColorPresetId` キー追加 |
| `src/app/App.tsx` | 改修 | 設定読込・保存・テーマ適用・アイコン更新処理 |
| `src/app/components/SettingsScreen.tsx` | 改修 | カスタムアイコン選択拡張・アプリカラードロップダウン追加 |
| `src/app/components/MapScreen.tsx` | 改修 | カスタム画像の円表示対応 |

---

## 1. アプリカラープリセット

### colorPresets.ts（新規）

```typescript
export type AppColorPresetId =
  | 'matcha' | 'wakaba' | 'himawari' | 'mikan' | 'yuuyake' | 'tomato'
  | 'sakura' | 'tasogare' | 'hoshizora' | 'umi' | 'ramune' | 'asatsuyu';

export type AppColorPreset = {
  id: AppColorPresetId;
  label: string;
  light: { primary: string; primaryText: string; mapLine: string };
  dark:  { primary: string; primaryText: string; mapLine: string };
};

export const DEFAULT_APP_COLOR_PRESET_ID: AppColorPresetId = 'matcha';

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

export function getAppColorPreset(id: AppColorPresetId): AppColorPreset {
  return APP_COLOR_PRESETS.find((p) => p.id === id) ?? APP_COLOR_PRESETS[0];
}
```

### theme.ts 追加

```typescript
import type { AppColorPreset } from '../features/customization/colorPresets';

/**
 * テーマにプリセット色を上書きした新しいテーマを返す。
 * lightTheme/darkTheme の name に合わせて light/dark を選択する。
 */
export function applyColorPreset(theme: AppTheme, preset: AppColorPreset): AppTheme {
  const colors = theme.name === 'dark' ? preset.dark : preset.light;
  return {
    ...theme,
    colors: { ...theme.colors, ...colors },
  };
}
```

### App.tsx の変更

- 設定読込時に `getStringSetting('appColorPresetId', DEFAULT_APP_COLOR_PRESET_ID)` を追加
- `selectedAppColorPresetId` state を追加（`AppColorPresetId` 型）
- `theme` の useMemo を `applyColorPreset(rawTheme, resolvedPreset)` に変更
  - `resolvedPreset` は `premiumAccessState.isPlusActive ? getAppColorPreset(selectedAppColorPresetId) : getAppColorPreset(DEFAULT_APP_COLOR_PRESET_ID)`
- `updateAppColorPreset(id: AppColorPresetId)` 関数を追加し、state 更新 + `setSetting` 保存
- `SettingsScreen` に `selectedAppColorPresetId` / `onUpdateAppColorPreset` を渡す

### SettingsScreen の変更（アプリカラー）

`UserLocationIconPicker` の直後、`isPlusActive` のときのみ `AppColorPicker` を描画：

```tsx
{isPlusActive && (
  <AppColorPicker
    styles={styles}
    theme={theme}
    selectedPresetId={selectedAppColorPresetId}
    onUpdatePreset={onUpdateAppColorPreset}
  />
)}
```

`AppColorPicker` は SettingsScreen 内プライベートコンポーネントとして定義。`Pressable` で現在選択中のカラードット＋名前を表示し、タップすると `Modal` ベースの選択リストを表示する（iOS/Android 共通。`ActionSheetIOS` はドットを表示できないため使わない）。

選択リストの各行：
```
● まっちゃ     ← カラードット（現在テーマの primary 色） + ラベル + チェックマーク（選択中）
```

---

## 2. カスタムアイコン画像

### customizationOptions.ts の変更

```typescript
export type UserLocationIconId = 'default' | 'walker' | 'compass' | 'custom';
```

`USER_LOCATION_ICON_OPTIONS` に追加：
```typescript
{ id: 'custom', label: 'カスタム', premium: true },
```

### customizationResolver.ts の変更

```typescript
export type ResolvedUserLocationIcon = {
  useNativeUserLocation: boolean;
  customIconId: Exclude<UserLocationIconId, 'default' | 'custom'> | null;
  customImageUri: string | null;   // 追加
};

export function resolveUserLocationIcon(
  selectedId: UserLocationIconId,
  isPlusActive: boolean,
  customImageUri: string | null,   // 追加
): ResolvedUserLocationIcon {
  // custom が選ばれていてもURIが無い／Plusでない場合はOS標準
  if (selectedId === 'custom') {
    if (!isPlusActive || !customImageUri) {
      return { useNativeUserLocation: true, customIconId: null, customImageUri: null };
    }
    return { useNativeUserLocation: false, customIconId: null, customImageUri };
  }
  // ... 既存ロジック（customImageUri: null を追加するだけ）
}
```

### App.tsx の変更（カスタムアイコン）

- `customIconImageUri` state を追加（`string | null`）
- 設定読込時に `getStringSetting('customIconImageUri', '')` を追加（空文字 → null 変換）
- `resolveUserLocationIcon` の第3引数に `customIconImageUri` を渡す
- `updateUserLocationIcon('custom')` 選択時は `pickCustomIcon()` を呼び出す
- `pickCustomIcon()` 関数：
  1. `expo-media-library` の `requestPermissionsAsync()` で権限確認
  2. `expo-image-picker` の `launchImageLibraryAsync({ allowsEditing: true, aspect: [1,1], mediaTypes: 'images' })` を呼ぶ
  3. キャンセルなら何もしない
  4. 成功 → `setSetting('customIconImageUri', uri)` + state 更新 + `setSelectedUserLocationIconId('custom')`
  5. `Alert.alert('カスタムアイコン', '写真をアルバムから削除するとOS標準に戻ります。')` を表示

> `expo-image-picker` は未インストールのため `npx expo install expo-image-picker` が必要。

### MapScreen.tsx の変更

`customImageUri` が非 null のとき、`<Image>` を `borderRadius: 999` で円表示：

```tsx
{!userLocationIcon.useNativeUserLocation && userCoordinate && (
  <Marker coordinate={userCoordinate} anchor={{ x: 0.5, y: 0.5 }}>
    {userLocationIcon.customImageUri ? (
      <Image
        source={{ uri: userLocationIcon.customImageUri }}
        style={styles.customUserLocationMarkerImage}
        onError={() => {/* URI 読み込み失敗 → 何も表示しない（App.tsx 側でフォールバック） */}}
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

URI 読み込みエラー時のフォールバック: `resolveUserLocationIcon` の外側で URI の有効性チェックは行わず、React Native の `Image` の `onError` でエラーを検知したら App.tsx の state を `{ selectedId: 'default', customImageUri: null }` にリセットする。

### SettingsScreen の変更（カスタムアイコン）

`UserLocationIconPicker` の `'custom'` タイル：
- アイコン部分：`customIconImageUri` が非 null なら 32×32 のサムネイル円画像、null なら `image` アイコン
- `onPress` では `onPickCustomIcon()` を呼ぶ（App.tsx から渡す）
- 選択済み（`selectedUserLocationIconId === 'custom'`）でも再タップで再選択可能

---

## テスト方針

| テスト対象 | 内容 |
|-----------|------|
| `colorPresets.ts` | `getAppColorPreset` がデフォルト返却・IDで正引き |
| `customizationResolver.ts` | `custom` + URI有効 → customImageUri 返却、custom + URI無効/非Plus → OS標準 |
| `theme.ts` | `applyColorPreset` でlight/dark正しく上書き |
| `SettingsScreen` | Plus時のみアプリカラー・カスタムアイコンセクション表示 |

---

## 依存関係

- `expo-image-picker` — 新規インストール必要（`npx expo install expo-image-picker`）
- `expo-media-library` — 既存インストール済み
