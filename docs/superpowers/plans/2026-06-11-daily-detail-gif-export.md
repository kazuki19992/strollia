# 日別記録詳細：スライダー改善とGIF出力 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 日別記録詳細のスライダーを5分刻み・低背・幅広にし、その日の移動軌跡を480pxの累積アニメーションGIFとして生成・共有できるようにする。

**Architecture:** フレーム時刻算出を純関数化、GIF生成オーケストレーションは capture/encode を注入してテスト可能にする。画面外にマウントした固定サイズの地図Viewを1コマずつ `captureRef` でPNG化し、`upng-js` でRGBA化、`gifenc` でGIF化する。生成中は共通 `Dialog` を `dismissible=false` で拡張したブロッキング進捗ダイアログを表示する。

**Tech Stack:** React Native / Expo, react-native-maps, react-native-view-shot, expo-file-system/legacy, expo-sharing, gifenc, upng-js, Jest。

---

## File Structure

- `src/app/dailyRouteTimeline.ts` — `DAILY_ROUTE_TIME_STEP_MINUTES` を 5 に変更（修正）。
- `src/app/__tests__/dailyRouteTimeline.test.ts` — 期待値更新（修正）。
- `src/app/appStyles.ts` — スライダーのサイズ調整、GIF関連スタイル追加（修正）。
- `src/app/components/Dialog.tsx` — `dismissible` prop 追加（修正）。
- `src/app/components/__tests__/Dialog.test.tsx` — 新規テスト（新規）。
- `src/features/export/routeGifFrames.ts` — フレーム時刻算出の純関数（新規）。
- `src/features/export/__tests__/routeGifFrames.test.ts` — テスト（新規）。
- `src/features/export/routeGifBuilder.ts` — capture/encode 注入のオーケストレーション（新規）。
- `src/features/export/__tests__/routeGifBuilder.test.ts` — テスト（新規）。
- `src/features/export/routeGifExporter.ts` — gifenc/upng/captureRef を束ねる実体（新規・ネイティブ依存のため手動確認）。
- `src/app/components/GifFrameRenderer.tsx` — 画面外フレーム描画View（新規・手動確認）。
- `src/app/components/DailyLogDetailScreen.tsx` — 配置変更・キャプチャ除外・生成フロー・進捗ダイアログ組込（修正）。

---

## Task 1: スライダーを5分刻みにする

**Files:**
- Modify: `src/app/dailyRouteTimeline.ts:8`
- Test: `src/app/__tests__/dailyRouteTimeline.test.ts:19-23`

- [ ] **Step 1: テストの期待値を5分へ更新（失敗させる）**

`src/app/__tests__/dailyRouteTimeline.test.ts` の該当テストを書き換える:

```typescript
  it('0時から24時までを5分刻みで扱う定数を公開する', () => {
    expect(DAILY_ROUTE_START_MINUTES).toBe(0);
    expect(DAILY_ROUTE_END_MINUTES).toBe(1440);
    expect(DAILY_ROUTE_TIME_STEP_MINUTES).toBe(5);
  });
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx jest src/app/__tests__/dailyRouteTimeline.test.ts`
Expected: FAIL（`expect(30).toBe(5)`）

- [ ] **Step 3: 定数を変更**

`src/app/dailyRouteTimeline.ts` の8行目:

```typescript
/** 日別ルートタイムラインの移動刻み。必要になったらこの値を変更する。 */
export const DAILY_ROUTE_TIME_STEP_MINUTES = 5;
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx jest src/app/__tests__/dailyRouteTimeline.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/app/dailyRouteTimeline.ts src/app/__tests__/dailyRouteTimeline.test.ts
git commit -m "feat(daily-detail): 移動軌跡スライダーを5分刻みにする"
```

---

## Task 2: スライダーのサイズ調整（低背・幅広）

**Files:**
- Modify: `src/app/appStyles.ts:1929-1980`

UIスタイルのみのため自動テストはなし。手動確認。

- [ ] **Step 1: スタイルを調整**

`src/app/appStyles.ts` の `stepSlider` と `stepSliderTouchArea` を次の値へ変更する:

```typescript
    stepSlider: {
      gap: 2,
      paddingHorizontal: 6,
    },
```

```typescript
    stepSliderTouchArea: {
      flex: 1,
      height: 32,
      justifyContent: 'center',
    },
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/app/appStyles.ts
git commit -m "style(daily-detail): スライダーを低背・幅広に調整する"
```

---

## Task 3: Dialog に dismissible を追加

`dismissible=false`（既定 true）で ×ボタン・スワイプ閉じ・スワイプヒント・背景/戻る閉じを無効化する。

**Files:**
- Modify: `src/app/components/Dialog.tsx`
- Test: `src/app/components/__tests__/Dialog.test.tsx`（新規）

- [ ] **Step 1: 失敗するテストを書く**

`src/app/components/__tests__/Dialog.test.tsx` を新規作成:

```tsx
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';

import { Dialog } from '../Dialog';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'Icon' }));
jest.mock('../ConfettiOverlay', () => ({ ConfettiOverlay: () => null }));

const styles = new Proxy({}, { get: () => ({}) }) as never;

describe('Dialog dismissible', () => {
  it('dismissible=false のとき閉じるボタンを描画しない', () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <Dialog visible dismissible={false} swipeToClose={false} styles={styles} onClose={() => undefined}>
          <Text>本文</Text>
        </Dialog>,
      );
    });
    const closeButtons = tree!.root.findAll(
      (node) => node.props.accessibilityLabel === '閉じる',
    );
    expect(closeButtons).toHaveLength(0);
  });

  it('dismissible 既定（true）では閉じるボタンを描画する', () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <Dialog visible swipeToClose={false} styles={styles} onClose={() => undefined}>
          <Text>本文</Text>
        </Dialog>,
      );
    });
    const closeButtons = tree!.root.findAll(
      (node) => node.props.accessibilityLabel === '閉じる',
    );
    expect(closeButtons.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx jest src/app/components/__tests__/Dialog.test.tsx`
Expected: FAIL（`dismissible` 未対応で閉じるボタンが常に描画される / props型エラー）

- [ ] **Step 3: Dialog を実装**

`src/app/components/Dialog.tsx` の `DialogProps` に追加:

```typescript
  /** false のとき閉じる手段（×ボタン・スワイプ・背景/戻る）を無効化する。既定 true。 */
  dismissible?: boolean;
```

関数シグネチャのデフォルト分割代入へ `dismissible = true` を追加:

```typescript
export function Dialog({ visible, children, showConfetti = false, autoClose = false, swipeToClose = true, dismissible = true, animationKey = null, styles, onClose }: DialogProps) {
```

スワイプを無効化するため、`panResponder` の `onStartShouldSetPanResponder` と `onMoveShouldSetPanResponder` を `dismissible` で抑制する。`panResponder` の `useMemo` 依存配列に `dismissible` を加え、ハンドラ先頭を次のように変更:

```typescript
        onStartShouldSetPanResponder: () => dismissible,
        onMoveShouldSetPanResponder: (_, gestureState) => dismissible && (Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4),
```

`Modal` の `onRequestClose` を `dismissible` のときだけ閉じるよう変更:

```typescript
    <Modal visible={isRendered} transparent animationType="none" onRequestClose={() => { if (dismissible) animateOut(true); }}>
```

×ボタンを条件付きに変更（既存の `<Pressable ... accessibilityLabel="閉じる">...</Pressable>` を囲む）:

```tsx
            {dismissible && (
              <Pressable onPress={() => animateOut(true)} hitSlop={10} style={styles.achievementCloseButton} accessibilityLabel="閉じる" accessibilityRole="button">
                <MaterialCommunityIcons name="close" size={18} color={styles.achievementCloseButtonIcon.color} />
              </Pressable>
            )}
```

スワイプヒントの条件を変更:

```tsx
            {swipeToClose && dismissible && <Text style={styles.dialogSwipeHint}>スワイプで閉じる</Text>}
```

`useMemo` 依存配列に `dismissible` を追加:

```typescript
    [animateOut, dragX, dragY, resetDragPosition, swipeToClose, dismissible],
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx jest src/app/components/__tests__/Dialog.test.tsx`
Expected: PASS

- [ ] **Step 5: 既存のDialog利用箇所が壊れていないか確認**

Run: `npx jest src/app/components/__tests__/AchievementDialog.test.tsx`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/app/components/Dialog.tsx src/app/components/__tests__/Dialog.test.tsx
git commit -m "feat(dialog): 閉じる手段を無効化する dismissible を追加"
```

---

## Task 4: GIFフレーム時刻の算出（純関数）

各コマが「開始から該当時刻まで」を表す、その日の0時からの経過分（minute-of-day）の配列を返す。

**Files:**
- Create: `src/features/export/routeGifFrames.ts`
- Test: `src/features/export/__tests__/routeGifFrames.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/features/export/__tests__/routeGifFrames.test.ts` を新規作成:

```typescript
import { computeGifFrameMinutes } from '../routeGifFrames';
import type { LocationPoint } from '../../../types/gps';

function pointAt(minuteOfDay: number, id: number): LocationPoint {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return {
    id,
    recordedAt: new Date(2026, 4, 31, hours, minutes).toISOString(),
    localDate: '2026-05-31',
    latitude: 35,
    longitude: 139,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: null,
    altitudeAccuracy: null,
  };
}

describe('computeGifFrameMinutes', () => {
  it('最初〜最後を10分刻みにし最後を必ず含める', () => {
    const points = [pointAt(0, 1), pointAt(30, 2), pointAt(60, 3)];
    expect(computeGifFrameMinutes(points, 10)).toEqual([0, 10, 20, 30, 40, 50, 60]);
  });

  it('10分未満の記録は最初と最後の2コマ', () => {
    const points = [pointAt(0, 1), pointAt(5, 2)];
    expect(computeGifFrameMinutes(points, 10)).toEqual([0, 5]);
  });

  it('同一分に収まる記録は1コマ', () => {
    const points = [pointAt(10, 1), pointAt(10, 2)];
    expect(computeGifFrameMinutes(points, 10)).toEqual([10]);
  });

  it('点が1つ以下なら空配列', () => {
    expect(computeGifFrameMinutes([pointAt(0, 1)], 10)).toEqual([]);
    expect(computeGifFrameMinutes([], 10)).toEqual([]);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx jest src/features/export/__tests__/routeGifFrames.test.ts`
Expected: FAIL（モジュール未定義）

- [ ] **Step 3: 純関数を実装**

`src/features/export/routeGifFrames.ts` を新規作成:

```typescript
import type { LocationPoint } from '../../types/gps';
import { getPointMinutesOfDay } from '../../app/dailyRouteTimeline';

/**
 * その日の点列から、累積GIFの各コマが表す「0時からの経過分」を算出する。
 * 最初の点の時刻から最後の点の時刻まで stepMinutes 刻みで進め、最後の時刻を必ず含める。
 *
 * @param points - 時刻昇順のGPSポイント。
 * @param stepMinutes - コマ間隔（分）。
 * @returns 各コマの minute-of-day 配列。点が1つ以下なら空配列。
 */
export function computeGifFrameMinutes(points: LocationPoint[], stepMinutes: number): number[] {
  if (points.length < 2) {
    return [];
  }

  const firstMinute = getPointMinutesOfDay(points[0]);
  const lastMinute = getPointMinutesOfDay(points[points.length - 1]);

  const frames: number[] = [];
  for (let minute = firstMinute; minute < lastMinute; minute += stepMinutes) {
    frames.push(minute);
  }
  frames.push(lastMinute);
  return frames;
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx jest src/features/export/__tests__/routeGifFrames.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/features/export/routeGifFrames.ts src/features/export/__tests__/routeGifFrames.test.ts
git commit -m "feat(export): GIFフレーム時刻の算出関数を追加"
```

---

## Task 5: GIF生成オーケストレーション（capture/encode注入）

フレーム数ぶん capture→encode を回し、進捗通知・キャンセル中断を行う。ネイティブ非依存でテストする。

**Files:**
- Create: `src/features/export/routeGifBuilder.ts`
- Test: `src/features/export/__tests__/routeGifBuilder.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/features/export/__tests__/routeGifBuilder.test.ts` を新規作成:

```typescript
import { buildRouteGif } from '../routeGifBuilder';

function fakeEncoder() {
  const frames: number[] = [];
  return {
    frames,
    addFrame: (_rgba: Uint8Array, _w: number, _h: number, delayMs: number) => frames.push(delayMs),
    finish: () => new Uint8Array([1, 2, 3]),
  };
}

const capture = async () => ({ data: new Uint8Array(4), width: 1, height: 1 });

describe('buildRouteGif', () => {
  it('全フレームを capture/encode し GIF バイト列を返す', async () => {
    const encoder = fakeEncoder();
    const progress: Array<[number, number]> = [];
    const result = await buildRouteGif({
      frameCount: 3,
      delayMs: 500,
      capture,
      createEncoder: () => encoder,
      onProgress: (done, total) => progress.push([done, total]),
    });
    expect(encoder.frames).toEqual([500, 500, 500]);
    expect(result).toEqual(new Uint8Array([1, 2, 3]));
    expect(progress).toEqual([[1, 3], [2, 3], [3, 3]]);
  });

  it('shouldAbort が true を返したら中断して null を返す', async () => {
    const encoder = fakeEncoder();
    let calls = 0;
    const result = await buildRouteGif({
      frameCount: 5,
      delayMs: 500,
      capture,
      createEncoder: () => encoder,
      shouldAbort: () => {
        calls += 1;
        return calls >= 2; // 2フレーム目の後で中断
      },
    });
    expect(result).toBeNull();
    expect(encoder.frames.length).toBe(2);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx jest src/features/export/__tests__/routeGifBuilder.test.ts`
Expected: FAIL（モジュール未定義）

- [ ] **Step 3: 実装**

`src/features/export/routeGifBuilder.ts` を新規作成:

```typescript
/** RGBAフレームのキャプチャ結果。 */
export type CapturedFrame = { data: Uint8Array; width: number; height: number };

/** 指定インデックスのフレームをRGBAでキャプチャする。 */
export type GifFrameCapture = (frameIndex: number) => Promise<CapturedFrame>;

/** GIFエンコーダの最小インターフェース。 */
export type GifFrameEncoder = {
  addFrame: (rgba: Uint8Array, width: number, height: number, delayMs: number) => void;
  finish: () => Uint8Array;
};

/** buildRouteGif の引数。 */
export type BuildRouteGifOptions = {
  /** 総フレーム数。 */
  frameCount: number;
  /** 1コマの表示時間（ミリ秒）。 */
  delayMs: number;
  /** フレームのキャプチャ関数。 */
  capture: GifFrameCapture;
  /** エンコーダ生成関数。 */
  createEncoder: () => GifFrameEncoder;
  /** 進捗通知（任意）。 */
  onProgress?: (done: number, total: number) => void;
  /** 中断判定（任意）。true を返すと中断し null を返す。 */
  shouldAbort?: () => boolean;
};

/**
 * フレームを順にキャプチャ・エンコードしてGIFバイト列を返す。
 * 各フレーム後に中断判定を行い、中断された場合は null を返す。
 */
export async function buildRouteGif(options: BuildRouteGifOptions): Promise<Uint8Array | null> {
  const { frameCount, delayMs, capture, createEncoder, onProgress, shouldAbort } = options;
  const encoder = createEncoder();

  for (let index = 0; index < frameCount; index += 1) {
    const frame = await capture(index);
    encoder.addFrame(frame.data, frame.width, frame.height, delayMs);
    onProgress?.(index + 1, frameCount);

    if (shouldAbort?.()) {
      return null;
    }
  }

  return encoder.finish();
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx jest src/features/export/__tests__/routeGifBuilder.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/features/export/routeGifBuilder.ts src/features/export/__tests__/routeGifBuilder.test.ts
git commit -m "feat(export): GIF生成オーケストレーション（注入可能）を追加"
```

---

## Task 6: 依存パッケージの追加

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: gifenc と upng-js をインストール**

Run:
```bash
npm install gifenc@1.0.3 upng-js@2.1.0
npm install --save-dev @types/upng-js
```
（`@types/upng-js` が存在しない場合は Step 3 のローカル型宣言で対応する）

- [ ] **Step 2: 既存テストが壊れていないか確認**

Run: `npx jest`
Expected: 全PASS

- [ ] **Step 3: upng-js の型がなければローカル宣言を追加**

`@types/upng-js` が無い場合のみ、`src/types/upng-js.d.ts` を新規作成:

```typescript
declare module 'upng-js' {
  export function decode(buffer: ArrayBuffer): unknown;
  export function toRGBA8(image: unknown): ArrayBuffer[];
  const UPNG: { decode: typeof decode; toRGBA8: typeof toRGBA8 };
  export default UPNG;
}
```

- [ ] **Step 4: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add package.json package-lock.json src/types/upng-js.d.ts
git commit -m "chore(deps): GIF生成のため gifenc と upng-js を追加"
```

---

## Task 7: フレーム描画コンポーネント GifFrameRenderer

画面外にマウントする480×480の地図View。region固定・累積Polyline・左上時刻（DSEG）・右下ブランディング。ネイティブ描画のため自動テストはなし（手動確認）。

**Files:**
- Create: `src/app/components/GifFrameRenderer.tsx`
- Modify: `src/app/appStyles.ts`（GIF用スタイル追加）

- [ ] **Step 1: GIF用スタイルを追加**

`src/app/appStyles.ts` の StyleSheet オブジェクト内（`stepSlider` の近く）に追加する。色は `colors`/`theme` を利用:

```typescript
    gifFrameContainer: {
      height: 480,
      position: 'absolute',
      left: -10000,
      top: 0,
      width: 480,
    },
    gifFrameMap: {
      height: 480,
      width: 480,
    },
    gifFrameTimeBadge: {
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: 8,
      left: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
      position: 'absolute',
      top: 12,
    },
    gifFrameTimeText: {
      color: '#ffffff',
      fontFamily: NUMERIC_DISPLAY_FONT,
      fontSize: 26,
    },
    gifFrameBranding: {
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderRadius: 8,
      bottom: 12,
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
      position: 'absolute',
      right: 12,
    },
    gifFrameBrandingIcon: {
      borderRadius: 6,
      height: 34,
      width: 34,
    },
    gifFrameBrandingTextWrap: {
      justifyContent: 'center',
    },
    gifFrameBrandingTagline: {
      color: '#ffffff',
      fontSize: 9,
      lineHeight: 11,
    },
    gifFrameBrandingName: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '900',
      lineHeight: 16,
    },
```

`appStyles.ts` 冒頭で `NUMERIC_DISPLAY_FONT` が import 済みか確認し、無ければ追加:

```typescript
import { NUMERIC_DISPLAY_FONT } from '../theme/fonts';
```

- [ ] **Step 2: GifFrameRenderer を実装**

`src/app/components/GifFrameRenderer.tsx` を新規作成:

```tsx
import { forwardRef } from 'react';
import { Image, Text, View } from 'react-native';
import MapView, { Polyline, Region } from 'react-native-maps';

import { toRenderRouteCoordinates } from '../../features/map/routeMapper';
import type { AppTheme } from '../../theme/theme';
import type { LocationPoint } from '../../types/gps';
import type { AppStyles } from '../appStyles';

export type GifFrameRendererProps = {
  /** 全コマ共通の固定表示範囲。 */
  region: Region;
  /** このコマで表示する累積ポイント。 */
  points: LocationPoint[];
  /** 左上に表示する時刻ラベル（HH:MM）。 */
  timeLabel: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 地図の初期化完了通知。 */
  onMapReady: () => void;
};

/** 画面外にマウントしてGIFの1コマをキャプチャするための地図View。 */
export const GifFrameRenderer = forwardRef<View, GifFrameRendererProps>(function GifFrameRenderer(
  { region, points, timeLabel, styles, theme, onMapReady },
  ref,
) {
  const routeCoordinates = toRenderRouteCoordinates(points);

  return (
    <View ref={ref} collapsable={false} style={styles.gifFrameContainer}>
      <MapView
        style={styles.gifFrameMap}
        initialRegion={region}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onMapReady={onMapReady}
      >
        {routeCoordinates.length > 1 ? (
          <Polyline coordinates={routeCoordinates} strokeColor={theme.colors.mapLine} strokeWidth={5} />
        ) : null}
      </MapView>
      <View style={styles.gifFrameTimeBadge}>
        <Text style={styles.gifFrameTimeText}>{timeLabel}</Text>
      </View>
      <View style={styles.gifFrameBranding}>
        <Image source={require('../../../assets/icon.png')} style={styles.gifFrameBrandingIcon} />
        <View style={styles.gifFrameBrandingTextWrap}>
          <Text style={styles.gifFrameBrandingTagline}>おさんぽ記録アプリ</Text>
          <Text style={styles.gifFrameBrandingName}>すとろりあ</Text>
        </View>
      </View>
    </View>
  );
});
```

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/app/components/GifFrameRenderer.tsx src/app/appStyles.ts
git commit -m "feat(daily-detail): GIFフレーム描画コンポーネントを追加"
```

---

## Task 8: GIF出力の実体 routeGifExporter

`react-native-view-shot` でPNGキャプチャ→`upng-js`でRGBA→`gifenc`でGIF→ファイル書き出し。ネイティブ依存のため自動テストはなし。`buildRouteGif` を用いる。

**Files:**
- Create: `src/features/export/routeGifExporter.ts`

- [ ] **Step 1: 実装**

`src/features/export/routeGifExporter.ts` を新規作成:

```typescript
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import UPNG from 'upng-js';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { buildRouteGif } from './routeGifBuilder';

/** GIF生成・共有の引数。 */
export type ExportRouteGifOptions = {
  /** キャプチャ対象（GifFrameRendererのView ref）の current。 */
  captureTarget: () => unknown;
  /** 総フレーム数。 */
  frameCount: number;
  /** index のコマを描画させ、描画完了（次フレーム）まで待つ。 */
  renderFrame: (index: number) => Promise<void>;
  /** 1コマの表示時間（ミリ秒）。 */
  delayMs: number;
  /** 出力ファイル名（拡張子なし）。 */
  fileName: string;
  /** 進捗通知。 */
  onProgress?: (done: number, total: number) => void;
  /** 中断判定。 */
  shouldAbort?: () => boolean;
};

/** PNGの一時ファイルをRGBAへデコードする。 */
async function captureFrameRgba(captureTarget: () => unknown): Promise<{ data: Uint8Array; width: number; height: number }> {
  const base64 = await captureRef(captureTarget() as never, { format: 'png', quality: 1, result: 'base64', width: 480, height: 480 });
  const pngBuffer = Buffer.from(base64, 'base64');
  const arrayBuffer = pngBuffer.buffer.slice(pngBuffer.byteOffset, pngBuffer.byteOffset + pngBuffer.byteLength);
  const image = UPNG.decode(arrayBuffer) as { width: number; height: number };
  const rgba = UPNG.toRGBA8(image)[0];
  return { data: new Uint8Array(rgba), width: image.width, height: image.height };
}

/**
 * その日の移動軌跡をアニメーションGIFとして生成し、共有シートを開く。
 * 中断された場合は何もせず false を返す。
 */
export async function exportRouteGif(options: ExportRouteGifOptions): Promise<boolean> {
  const { captureTarget, frameCount, renderFrame, delayMs, fileName, onProgress, shouldAbort } = options;

  const gif = await buildRouteGif({
    frameCount,
    delayMs,
    onProgress,
    shouldAbort,
    createEncoder: () => {
      const encoder = GIFEncoder();
      return {
        addFrame: (rgba: Uint8Array, width: number, height: number, frameDelayMs: number) => {
          const palette = quantize(rgba, 256);
          const index = applyPalette(rgba, palette);
          encoder.writeFrame(index, width, height, { palette, delay: frameDelayMs });
        },
        finish: () => {
          encoder.finish();
          return encoder.bytes();
        },
      };
    },
    capture: async (index: number) => {
      await renderFrame(index);
      return captureFrameRgba(captureTarget);
    },
  });

  if (!gif) {
    return false;
  }

  const fileUri = `${FileSystem.cacheDirectory}${fileName}.gif`;
  const base64Gif = Buffer.from(gif).toString('base64');
  await FileSystem.writeAsStringAsync(fileUri, base64Gif, { encoding: FileSystem.EncodingType.Base64 });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('この端末では共有機能を利用できません。');
  }

  await Sharing.shareAsync(fileUri, { mimeType: 'image/gif', dialogTitle: `${fileName}.gif`, UTI: 'com.compuserve.gif' });
  return true;
}
```

注: `buffer` は React Native に同梱（Metro が polyfill 提供）。利用できない場合は `global.Buffer` を確認する。

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし（`gifenc` の型が無ければ `src/types` に最小宣言を追加する: `declare module 'gifenc';`）

- [ ] **Step 3: コミット**

```bash
git add src/features/export/routeGifExporter.ts src/types/
git commit -m "feat(export): GIF生成・共有の実体を追加"
```

---

## Task 9: DailyLogDetailScreen へ統合

スライダー/GIFボタンをキャプチャから除外し、GIFボタン・生成フロー・進捗ダイアログを組み込む。

**Files:**
- Modify: `src/app/components/DailyLogDetailScreen.tsx`
- Modify: `src/app/appStyles.ts`（進捗ダイアログ用スタイル追加）

- [ ] **Step 1: 進捗ダイアログ用スタイルを追加**

`src/app/appStyles.ts` に追加:

```typescript
    gifProgressTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
      marginBottom: 8,
      textAlign: 'center',
    },
    gifProgressBody: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 16,
      opacity: 0.8,
      textAlign: 'center',
    },
    gifProgressTrack: {
      backgroundColor: theme.name === 'dark' ? '#4b4b4b' : '#e0e0e0',
      borderRadius: 999,
      height: 8,
      marginBottom: 16,
      overflow: 'hidden',
      width: '100%' as unknown as number,
    },
    gifProgressFill: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      height: '100%' as unknown as number,
    },
    gifProgressCancel: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      paddingVertical: 10,
      width: '100%' as unknown as number,
    },
    gifProgressCancelText: {
      color: colors.text,
      fontWeight: '700',
    },
```

- [ ] **Step 2: DailyLogDetailScreen に state とロジックを追加**

`src/app/components/DailyLogDetailScreen.tsx` の import に追加:

```typescript
import { Image as RNImage } from 'react-native';
import { Dialog } from './Dialog';
import { GifFrameRenderer } from './GifFrameRenderer';
import { computeGifFrameMinutes } from '../../features/export/routeGifFrames';
import { exportRouteGif } from '../../features/export/routeGifExporter';
import { createInitialRegion } from '../../features/map/routeMapper';
import { filterLocationPointsUntilMinute, formatTimelineTimeLabel } from '../dailyRouteTimeline';
```

（既存 import と重複するものは追加しない。`filterLocationPointsUntilMinute`/`formatTimelineTimeLabel` は既存 import 行に統合する。）

コンポーネント本体に state を追加:

```typescript
  const [isCapturingShare, setIsCapturingShare] = useState(false);
  const [gifProgress, setGifProgress] = useState<{ done: number; total: number } | null>(null);
  const [gifFrameIndex, setGifFrameIndex] = useState(0);
  const gifAbortRef = useRef(false);
  const gifFrameRef = useRef<View>(null);
  const gifFrameResolveRef = useRef<(() => void) | null>(null);
  const gifMapReadyRef = useRef<(() => void) | null>(null);
```

GIFフレーム情報を算出:

```typescript
  const GIF_FRAME_STEP_MINUTES = 10;
  const GIF_FRAME_DELAY_MS = 500;
  const gifFrameMinutes = useMemo(() => computeGifFrameMinutes(dailyPoints, GIF_FRAME_STEP_MINUTES), [dailyPoints]);
  const canExportGif = isPlusActive && gifFrameMinutes.length >= 2;
  const gifRegion = useMemo(() => (dailyPoints.length > 0 ? createInitialRegion(dailyPoints) : null), [dailyPoints]);
  const isGeneratingGif = gifProgress !== null;
  const gifFramePoints = useMemo(
    () => (gifRegion ? filterLocationPointsUntilMinute(dailyPoints, gifFrameMinutes[gifFrameIndex] ?? 0) : []),
    [dailyPoints, gifFrameMinutes, gifFrameIndex, gifRegion],
  );
  const gifFrameTimeLabel = formatTimelineTimeLabel(gifFrameMinutes[gifFrameIndex] ?? 0);
```

- [ ] **Step 3: shareDailyLogImage をキャプチャ除外対応にする**

`shareDailyLogImage` 内、`captureRef` 呼び出しの前後を次のように変更（スライダー等を隠してから撮る）:

```typescript
    setIsSharingDetail(true);
    setIsCapturingShare(true);

    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('共有できません', 'この環境では共有シートを利用できません。');
        return;
      }

      const uri = await captureRef(captureViewRef.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      // ...（既存の Sharing.shareAsync はそのまま）
```

`finally` を次のように変更:

```typescript
    } finally {
      setIsCapturingShare(false);
      setIsSharingDetail(false);
    }
```

- [ ] **Step 4: GIF生成ハンドラを追加**

コンポーネント内に関数を追加:

```typescript
  function waitForGifMapReady(): Promise<void> {
    return new Promise<void>((resolve) => {
      gifMapReadyRef.current = resolve;
    });
  }

  function renderGifFrame(index: number): Promise<void> {
    return new Promise<void>((resolve) => {
      gifFrameResolveRef.current = resolve;
      setGifFrameIndex(index);
    });
  }

  async function handleExportGif(): Promise<void> {
    if (!canExportGif || isGeneratingGif || !gifRegion) {
      return;
    }

    gifAbortRef.current = false;
    setGifFrameIndex(0);
    setGifProgress({ done: 0, total: gifFrameMinutes.length });

    try {
      // フレームViewのマウントと地図初期化を待つ
      await waitForGifMapReady();

      const success = await exportRouteGif({
        captureTarget: () => gifFrameRef.current,
        frameCount: gifFrameMinutes.length,
        delayMs: GIF_FRAME_DELAY_MS,
        fileName: `strollia-${log.localDate}`,
        renderFrame: renderGifFrame,
        onProgress: (done, total) => setGifProgress({ done, total }),
        shouldAbort: () => gifAbortRef.current,
      });

      if (!success && !gifAbortRef.current) {
        Alert.alert('GIF出力', 'GIFを生成できませんでした。');
      }
    } catch (error: unknown) {
      Alert.alert('GIF出力失敗', error instanceof Error ? error.message : 'GIFを生成できませんでした。');
    } finally {
      setGifProgress(null);
      gifMapReadyRef.current = null;
      gifFrameResolveRef.current = null;
    }
  }

  function handleCancelGif(): void {
    gifAbortRef.current = true;
  }
```

`renderGifFrame` の resolve は描画完了後に行う。`gifFrameIndex` 変更を反映する effect を追加:

```typescript
  useEffect(() => {
    if (!isGeneratingGif) {
      return;
    }
    // フレーム描画がコミットされたら次フレーム待ちを解決する
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        gifFrameResolveRef.current?.();
        gifFrameResolveRef.current = null;
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [gifFrameIndex, isGeneratingGif]);
```

- [ ] **Step 5: スライダー・GIFボタンをキャプチャ除外で描画**

`StepSlider` を囲む `{showSlider && (...)}` を `{showSlider && !isCapturingShare && (...)}` に変更し、その直後（スライダーの `valueLabel` の下）にGIFボタンを追加:

```tsx
            {showSlider && !isCapturingShare && (
              <StepSlider
                /* 既存の props そのまま */
              />
            )}
            {canExportGif && !isCapturingShare && (
              <ActionPill
                disabled={isGeneratingGif}
                icon={<MaterialCommunityIcons name="image-multiple" size={20} color={theme.colors.text} />}
                label="移動記録をGIFで出力"
                styles={styles}
                onPress={() => {
                  handleExportGif().catch(() => undefined);
                }}
              />
            )}
```

- [ ] **Step 6: 画面外フレームViewと進捗ダイアログを描画**

`ScrollView` の閉じタグの後、`SafeAreaView` を閉じる前に追加:

```tsx
      {isGeneratingGif && gifRegion && (
        <GifFrameRenderer
          ref={gifFrameRef}
          region={gifRegion}
          points={gifFramePoints}
          timeLabel={gifFrameTimeLabel}
          styles={styles}
          theme={theme}
          onMapReady={() => {
            gifMapReadyRef.current?.();
            gifMapReadyRef.current = null;
          }}
        />
      )}

      <Dialog visible={isGeneratingGif} dismissible={false} swipeToClose={false} styles={styles} onClose={() => undefined}>
        <Text style={styles.gifProgressTitle}>アニメGIF生成中…</Text>
        <Text style={styles.gifProgressBody}>生成が終わるまで少しお待ちください。画面を閉じないでください。</Text>
        <View style={styles.gifProgressTrack}>
          <View
            style={[
              styles.gifProgressFill,
              { width: `${gifProgress ? Math.round((gifProgress.done / Math.max(gifProgress.total, 1)) * 100) : 0}%` as unknown as number },
            ]}
          />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="GIF生成をキャンセル" style={styles.gifProgressCancel} onPress={handleCancelGif}>
          <Text style={styles.gifProgressCancelText}>キャンセル</Text>
        </Pressable>
      </Dialog>
```

import に `Pressable` を追加（`react-native` から）。

- [ ] **Step 7: 型チェックと既存テスト**

Run: `npx tsc --noEmit && npx jest src/app/components/__tests__/DailyLogDetailScreen.test.tsx`
Expected: エラーなし／PASS（必要に応じてテストのモックに `expo-sharing` 等を追加）

- [ ] **Step 8: コミット**

```bash
git add src/app/components/DailyLogDetailScreen.tsx src/app/appStyles.ts
git commit -m "feat(daily-detail): GIF出力ボタンと生成フロー・進捗ダイアログを統合"
```

---

## Task 10: 全体検証

- [ ] **Step 1: 型チェック・全テスト**

Run: `npx tsc --noEmit && npx jest`
Expected: 全PASS、型エラーなし

- [ ] **Step 2: 手動確認（実機/シミュレータ）**

確認項目:
- スライダーが5分刻みで動き、低背・幅広になっている。
- 「この日の記録を共有」のキャプチャ画像にスライダー・GIFボタンが含まれない。
- GIFボタン押下で進捗ダイアログが出て、背景操作不可・×やスワイプで閉じられない・キャンセルのみ。
- キャンセルで即中断し何も共有されない。
- 生成完了でGIFが共有でき、累積軌跡・左上時刻(DSEG)・右下ブランディングが描画される。

- [ ] **Step 3: 仕上げコミット（必要なら）**

```bash
git add -A && git commit -m "chore(daily-detail): GIF出力の仕上げ"
```
```
```

---

## Self-Review メモ

- spec の各要件（5分刻み/低背幅広/キャプチャ除外/GIFボタン配置/累積10分/0.5秒/480px/地図+線/左上時刻DSEG/右下ブランディング/ブロッキング進捗+キャンセルのみ+本文）を Task 1〜9 でカバー。
- `computeGifFrameMinutes`・`buildRouteGif`・`exportRouteGif` のシグネチャはタスク間で一致。
- ネイティブ依存（captureRef/エンコード/共有/地図描画）は手動確認に明示。
