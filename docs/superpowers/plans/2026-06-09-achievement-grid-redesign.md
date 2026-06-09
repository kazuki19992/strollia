# 実績画面グリッド化 + ダイアログ共通化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 実績画面をカード型から2列グリッド型へ刷新し、実績解除モーダルのダイアログ部分を汎用 `Dialog` コンポーネントとして切り出して実績解除通知・実績詳細表示の両方で使い回す。

**Architecture:** `AchievementUnlockModal` にあった Modal / PanResponder / 登場退場アニメーション / 紙吹雪 / 自動クローズの責務を汎用 `Dialog` へ移植する。`Dialog` は `children`（ReactNode または render-prop）を受け取り、`showConfetti` / `autoClose` をフラグで切り替える。`AchievementUnlockModal`（解除通知）と新規 `AchievementDialog`（グリッドタップ詳細）はどちらも `Dialog` を直接使う。`AchievementListScreen` は2列グリッドで「解除済み / 次 / それ以降」の3状態を表示する。テーマカラーの色味を無彩色化する。

**Tech Stack:** React Native (Expo), TypeScript, Jest + react-test-renderer, expo-sharing, react-native-view-shot。

参照仕様: `docs/superpowers/specs/2026-06-09-achievement-grid-redesign-design.md`

---

## File Structure

- `src/theme/theme.ts` — 無彩色化した色トークン（Task 1）
- `src/theme/__tests__/theme.test.ts` — 既存アサーション更新（Task 1）
- `src/app/components/Dialog.tsx` — 新規・汎用ダイアログ（Task 2）
- `src/app/components/__tests__/Dialog.test.tsx` — 新規（Task 2）
- `src/app/components/AchievementUnlockModal.tsx` — Dialog 利用へ改修（Task 3）
- `src/app/components/__tests__/AchievementUnlockModal.test.tsx` — props 追加に追従（Task 3）
- `src/app/App.tsx` — UnlockModal に theme を渡す / AchievementDialog 配線（Task 3, Task 7）
- `src/app/components/achievementDisplayState.ts` — 新規・状態判定ヘルパー（Task 4）
- `src/app/components/__tests__/achievementDisplayState.test.ts` — 新規（Task 4）
- `src/app/appStyles.ts` — グリッド/ダイアログ用スタイル追加（Task 5）
- `src/app/components/AchievementDialog.tsx` — 新規・実績詳細ダイアログ（Task 6）
- `src/app/components/__tests__/AchievementDialog.test.tsx` — 新規（Task 6）
- `src/app/components/AchievementListScreen.tsx` — グリッド3状態へ改修（Task 7）
- `src/app/components/__tests__/AchievementListScreen.test.ts` — 既存維持（変更なし）

テストコマンドは全タスク共通で `npx jest <path> -t "<name>"`（プロジェクトの `npm test` は `jest`）。

---

### Task 1: テーマ無彩色化

**Files:**
- Modify: `src/theme/theme.ts:34-83`
- Test: `src/theme/__tests__/theme.test.ts:9-18`

- [ ] **Step 1: 既存テストを無彩色化後の値に更新（失敗させる）**

`src/theme/__tests__/theme.test.ts` の「日別ルートと共有ボタンの色はテーマトークンとして持つ」テスト内、ダークの `shareButtonBackground` 期待値を更新する。該当行を次へ置換:

```typescript
    expect(darkTheme.colors.shareButtonBackground).toBe('#f0f0f0');
```

さらに同 `describe` 内に無彩色化を固定する新規テストを追加:

```typescript
  it('カード・境界・文字色は無彩色トークンを使う', () => {
    expect(lightTheme.colors.card).toBe('#f8f8f8');
    expect(lightTheme.colors.cardStrong).toBe('#f0f0f0');
    expect(lightTheme.colors.text).toBe('#1a1a1a');
    expect(lightTheme.colors.mutedText).toBe('#666666');
    expect(lightTheme.colors.border).toBe('#e0e0e0');
    expect(lightTheme.colors.surfaceOverlay).toBe('rgba(248, 248, 248, 0.94)');
    expect(lightTheme.colors.scrim).toBe('rgba(0, 0, 0, 0.08)');
    expect(lightTheme.colors.shadow).toBe('#000000');

    expect(darkTheme.colors.card).toBe('#252525');
    expect(darkTheme.colors.cardStrong).toBe('#2e2e2e');
    expect(darkTheme.colors.text).toBe('#f0f0f0');
    expect(darkTheme.colors.mutedText).toBe('#999999');
    expect(darkTheme.colors.border).toBe('#3a3a3a');
    expect(darkTheme.colors.surfaceOverlay).toBe('rgba(37, 37, 37, 0.94)');
  });
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx jest src/theme/__tests__/theme.test.ts`
Expected: FAIL（無彩色化前の値のため不一致）

- [ ] **Step 3: theme.ts の lightTheme を無彩色化**

`src/theme/theme.ts` の `lightTheme.colors` 内、以下のキーを置換する（`background` / `primary` / `primaryText` / `danger` / `dangerSurface` / `mapLine` / `routeMapEmpty*` / `shareButton*` / `plusCtaBackground` は変更しない）:

```typescript
    card: '#f8f8f8',
    cardStrong: '#f0f0f0',
    text: '#1a1a1a',
    mutedText: '#666666',
    border: '#e0e0e0',
```

`surfaceOverlay` / `scrim` / `shadow` を置換:

```typescript
    surfaceOverlay: 'rgba(248, 248, 248, 0.94)',
    scrim: 'rgba(0, 0, 0, 0.08)',
    shadow: '#000000',
```

- [ ] **Step 4: theme.ts の darkTheme を無彩色化**

`src/theme/theme.ts` の `darkTheme.colors` 内、以下を置換:

```typescript
    card: '#252525',
    cardStrong: '#2e2e2e',
    text: '#f0f0f0',
    mutedText: '#999999',
    border: '#3a3a3a',
```

`shareButtonBackground` と `surfaceOverlay` を置換（`scrim` / `shadow` は据え置き）:

```typescript
    shareButtonBackground: '#f0f0f0',
    surfaceOverlay: 'rgba(37, 37, 37, 0.94)',
```

- [ ] **Step 5: テスト実行で成功を確認**

Run: `npx jest src/theme/__tests__/theme.test.ts`
Expected: PASS

- [ ] **Step 6: 既存スナップショット/関連テストの回帰確認**

Run: `npx jest src/app/components/__tests__/AchievementUnlockModal.test.tsx`
Expected: PASS（`achievementModalCard.backgroundColor` は `background` 参照のため影響なし、`backdrop` は dark `rgba(32, 32, 32, 0.92)` のまま）

- [ ] **Step 7: Commit**

```bash
git add src/theme/theme.ts src/theme/__tests__/theme.test.ts
git commit -m "style(theme): カード・境界・文字色を無彩色化する"
```

---

### Task 2: 汎用 Dialog コンポーネント

**Files:**
- Create: `src/app/components/Dialog.tsx`
- Test: `src/app/components/__tests__/Dialog.test.tsx`

`AchievementUnlockModal` の Modal / PanResponder / アニメーション / 紙吹雪 / 自動クローズロジックを汎用化して移植する。内部クローズ（閉じるボタン・スワイプ・自動）は親へ通知し、親が `visible=false` にした場合は通知せず退場アニメーションのみ行う。

- [ ] **Step 1: 失敗するテストを書く**

`src/app/components/__tests__/Dialog.test.tsx` を作成:

```tsx
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { createStyles } from '../../appStyles';
import { lightTheme } from '../../../theme/theme';
import { Dialog } from '../Dialog';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Feather: Text, MaterialCommunityIcons: Text };
});

const confettiMock = jest.fn();
jest.mock('../ConfettiOverlay', () => ({
  ConfettiOverlay: (props: Record<string, unknown>) => {
    confettiMock(props);
    return null;
  },
}));

const { act, create } = require('react-test-renderer') as {
  act: (callback: () => void) => void;
  create: (element: ReactNode) => { root: any; unmount: () => void };
};

const styles = createStyles(lightTheme);

let renderer: { root: any; unmount: () => void } | null = null;

describe('汎用ダイアログ Dialog', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    confettiMock.mockClear();
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = null;
    jest.useRealTimers();
  });

  test('autoClose=true のとき10秒経過で onClose を呼ぶ', () => {
    const onClose = jest.fn();
    act(() => {
      renderer = create(
        <Dialog visible autoClose animationKey="k1" styles={styles} theme={lightTheme} onClose={onClose}>
          <Text>本文</Text>
        </Dialog>,
      );
    });

    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('autoClose=false のときは時間経過しても onClose を呼ばない', () => {
    const onClose = jest.fn();
    act(() => {
      renderer = create(
        <Dialog visible styles={styles} theme={lightTheme} onClose={onClose}>
          <Text>本文</Text>
        </Dialog>,
      );
    });

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  test('showConfetti=false のとき ConfettiOverlay を active=false で描画する', () => {
    const onClose = jest.fn();
    act(() => {
      renderer = create(
        <Dialog visible styles={styles} theme={lightTheme} onClose={onClose}>
          <Text>本文</Text>
        </Dialog>,
      );
    });

    expect(confettiMock).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
  });

  test('閉じるボタンを押すと onClose を呼ぶ', () => {
    const onClose = jest.fn();
    act(() => {
      renderer = create(
        <Dialog visible styles={styles} theme={lightTheme} onClose={onClose}>
          <Text>本文</Text>
        </Dialog>,
      );
    });

    const closeButton = renderer!.root.findByProps({ accessibilityLabel: '閉じる' });
    act(() => {
      closeButton.props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('render-prop の pauseAutoClose を呼ぶと自動クローズが止まる', () => {
    const onClose = jest.fn();
    act(() => {
      renderer = create(
        <Dialog visible autoClose styles={styles} theme={lightTheme} onClose={onClose}>
          {({ pauseAutoClose }) => (
            <Text accessibilityLabel="pause" onPress={pauseAutoClose}>
              共有
            </Text>
          )}
        </Dialog>,
      );
    });

    const pauseNode = renderer!.root.findByProps({ accessibilityLabel: 'pause' });
    act(() => {
      pauseNode.props.onPress();
    });
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テスト実行で失敗を確認**

Run: `npx jest src/app/components/__tests__/Dialog.test.tsx`
Expected: FAIL（`Dialog` 未作成のため import エラー）

- [ ] **Step 3: Dialog コンポーネントを実装**

`src/app/components/Dialog.tsx` を作成:

```tsx
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Animated, Modal, PanResponder, Pressable, View } from 'react-native';

import { AppTheme } from '../../theme/theme';
import { AppStyles } from '../appStyles';
import { shouldDismissAchievementModalSwipe, shouldDismissAchievementModalTerminate } from './achievementUnlockModalLogic';
import { ConfettiOverlay } from './ConfettiOverlay';

/** 自動で閉じるまでの待機時間。 */
const AUTO_CLOSE_DELAY_MS = 10_000;

/** render-prop の子へ渡す補助関数。 */
export type DialogChildHelpers = {
  /** 自動クローズを止める（共有シートを開く前などに使う）。 */
  pauseAutoClose: () => void;
};

/** 汎用ダイアログのprops。 */
export type DialogProps = {
  /** 表示状態。 */
  visible: boolean;
  /** 本文。関数を渡すと pauseAutoClose を受け取れる。 */
  children: ReactNode | ((helpers: DialogChildHelpers) => ReactNode);
  /** 紙吹雪を背景に表示するか。 */
  showConfetti?: boolean;
  /** 一定時間で自動的に閉じるか。 */
  autoClose?: boolean;
  /** 紙吹雪の再生キー。 */
  animationKey?: string | null;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 閉じる処理。 */
  onClose: () => void;
};

/** スワイプ/紙吹雪/自動クローズを備えた汎用ダイアログ。 */
export function Dialog({ visible, children, showConfetti = false, autoClose = false, animationKey = null, styles, theme, onClose }: DialogProps) {
  const modalProgress = useRef(new Animated.Value(0)).current;
  const autoCloseProgress = useRef(new Animated.Value(0)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  const [isAutoClosePaused, setIsAutoClosePaused] = useState(false);
  const [isRendered, setIsRendered] = useState(visible);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const clearAutoCloseTimer = useCallback(function clearAutoCloseTimer(): void {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
  }, []);

  /** 退場アニメーションを再生し、必要なら親へ通知する。 */
  const animateOut = useCallback(
    function animateOut(notifyParent: boolean): void {
      if (isClosingRef.current) {
        return;
      }

      isClosingRef.current = true;
      autoCloseProgress.stopAnimation();
      clearAutoCloseTimer();
      if (notifyParent) {
        onCloseRef.current();
      }
      Animated.parallel([
        Animated.timing(modalProgress, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(dragX, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(dragY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) {
          setIsRendered(false);
        }
      });
    },
    [autoCloseProgress, clearAutoCloseTimer, dragX, dragY, modalProgress],
  );

  // 登場: visible が true になる / animationKey が変わると再生する。
  useEffect(() => {
    if (!visible) {
      return;
    }

    isClosingRef.current = false;
    setIsAutoClosePaused(false);
    setIsRendered(true);
    dragX.setValue(0);
    dragY.setValue(0);
    modalProgress.setValue(0);
    autoCloseProgress.setValue(0);
    clearAutoCloseTimer();
    Animated.spring(modalProgress, { toValue: 1, damping: 9, mass: 0.72, stiffness: 190, useNativeDriver: true }).start();
    if (autoClose) {
      Animated.timing(autoCloseProgress, { toValue: 1, duration: AUTO_CLOSE_DELAY_MS, useNativeDriver: false }).start();
    }
  }, [visible, animationKey, autoClose, autoCloseProgress, clearAutoCloseTimer, dragX, dragY, modalProgress]);

  // 親が visible=false にしたら退場（親へ再通知しない）。
  useEffect(() => {
    if (!visible && isRendered) {
      animateOut(false);
    }
  }, [visible, isRendered, animateOut]);

  // 自動クローズタイマー。
  useEffect(() => {
    if (!autoClose || !visible || !isRendered || isAutoClosePaused) {
      return;
    }

    autoCloseTimerRef.current = setTimeout(() => animateOut(true), AUTO_CLOSE_DELAY_MS);

    return clearAutoCloseTimer;
  }, [autoClose, visible, isRendered, isAutoClosePaused, animationKey, animateOut, clearAutoCloseTimer]);

  /** 自動クローズを止める。 */
  const pauseAutoClose = useCallback(function pauseAutoClose(): void {
    setIsAutoClosePaused(true);
    autoCloseProgress.stopAnimation();
    clearAutoCloseTimer();
  }, [autoCloseProgress, clearAutoCloseTimer]);

  const resetDragPosition = useCallback(function resetDragPosition(): void {
    Animated.spring(dragX, { toValue: 0, damping: 12, stiffness: 210, useNativeDriver: true }).start();
    Animated.spring(dragY, { toValue: 0, damping: 12, stiffness: 210, useNativeDriver: true }).start();
  }, [dragX, dragY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4,
        onPanResponderGrant: () => {
          dragX.stopAnimation();
          dragY.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) => {
          dragX.setValue(gestureState.dx);
          dragY.setValue(gestureState.dy);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (shouldDismissAchievementModalSwipe(gestureState)) {
            animateOut(true);
            return;
          }
          resetDragPosition();
        },
        onPanResponderTerminate: (_, gestureState) => {
          if (shouldDismissAchievementModalTerminate(gestureState)) {
            animateOut(true);
            return;
          }
          resetDragPosition();
        },
      }),
    [animateOut, dragX, dragY, resetDragPosition],
  );

  const distanceOpacity = Animated.add(dragX, dragY).interpolate({
    inputRange: [-260, -90, 0, 90, 260],
    outputRange: [0.35, 0.68, 1, 0.68, 0.35],
    extrapolate: 'clamp',
  });

  const content = typeof children === 'function' ? children({ pauseAutoClose }) : children;

  return (
    <Modal visible={isRendered} transparent animationType="none" onRequestClose={() => animateOut(true)}>
      <View style={styles.achievementModalBackdrop}>
        <ConfettiOverlay styles={styles} active={showConfetti && isRendered} animationKey={animationKey} />
        {isRendered && (
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.achievementModalCard,
              {
                opacity: Animated.multiply(modalProgress, distanceOpacity),
                transform: [
                  { scale: modalProgress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.62, 1.08, 1] }) },
                  { translateX: dragX },
                  { translateY: Animated.add(dragY, modalProgress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })) },
                ],
              },
            ]}
          >
            <Pressable onPress={() => animateOut(true)} hitSlop={10} style={styles.achievementCloseButton} accessibilityLabel="閉じる" accessibilityRole="button">
              <MaterialCommunityIcons name="close" size={18} color={styles.achievementCloseButtonIcon.color} />
            </Pressable>
            {autoClose && !isAutoClosePaused && (
              <View style={styles.achievementAutoCloseTrack}>
                <Animated.View
                  style={[
                    styles.achievementAutoCloseProgress,
                    { transform: [{ scaleX: autoCloseProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }] },
                  ]}
                />
              </View>
            )}
            {content}
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}
```

注: `theme` は将来の拡張用に受け取るが、現状は `styles` のみで描画する。lint で未使用警告が出る場合は呼び出し側との一貫性のため props には残し、`void theme;` を `Dialog` 本体先頭に置かず、ESLint の `no-unused-vars` が `props` 分割代入を許容する設定（既存の他コンポーネントと同様）に従う。既存コンポーネントが未使用 props を許容していなければ、この `theme` は Task 6 の `AchievementDialog` で使用するため残す。

- [ ] **Step 4: テスト実行で成功を確認**

Run: `npx jest src/app/components/__tests__/Dialog.test.tsx`
Expected: PASS（5テスト）

- [ ] **Step 5: Commit**

```bash
git add src/app/components/Dialog.tsx src/app/components/__tests__/Dialog.test.tsx
git commit -m "feat(dialog): 汎用Dialogコンポーネントを追加する"
```

---

### Task 3: AchievementUnlockModal を Dialog 利用へ改修

**Files:**
- Modify: `src/app/components/AchievementUnlockModal.tsx`（全面書き換え）
- Modify: `src/app/components/__tests__/AchievementUnlockModal.test.tsx`
- Modify: `src/app/App.tsx:1172-1178`

- [ ] **Step 1: テストを theme プロップ追加に追従させる（失敗させる）**

`src/app/components/__tests__/AchievementUnlockModal.test.tsx` を更新する。冒頭の import に theme を追加（既存の `createStyles` import 行の隣）:

```typescript
import { createStyles } from '../appStyles';
import { darkTheme, lightTheme } from '../../../theme/theme';
```

`styles` ハードコードオブジェクトの定義を `createStyles(lightTheme)` ベースへ置換し、theme を渡すよう「10秒経過すると自動で閉じる」テストを更新:

```typescript
const styles = createStyles(lightTheme);

// ... describe 内 ...
  test('10秒経過すると自動で閉じる', () => {
    const onClose = jest.fn();
    act(() => {
      renderer = create(
        <AchievementUnlockModal
          achievement={achievement}
          animationKey="1:odo-1"
          styles={styles}
          theme={lightTheme}
          onShareToX={jest.fn()}
          onClose={onClose}
        />,
      );
    });

    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
```

共有ボタンの動作を確認するテストを追加:

```typescript
  test('共有ボタンを押すと onShareToX を呼び自動クローズが止まる', () => {
    const onShareToX = jest.fn();
    const onClose = jest.fn();
    act(() => {
      renderer = create(
        <AchievementUnlockModal
          achievement={achievement}
          animationKey="1:odo-1"
          styles={styles}
          theme={lightTheme}
          onShareToX={onShareToX}
          onClose={onClose}
        />,
      );
    });

    const shareButton = (renderer as any).root.findByProps({ accessibilityLabel: 'ともだちに自慢する' });
    act(() => {
      shareButton.props.onPress();
    });

    expect(onShareToX).toHaveBeenCalledWith(achievement);

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
```

`renderer` 型注釈を `{ root: any; unmount: () => void }` に変更（findByProps 利用のため）。`create` の型も合わせる:

```typescript
const { act, create } = require('react-test-renderer') as {
  act: (callback: () => void) => void;
  create: (element: React.ReactElement) => { root: any; unmount: () => void };
};

let renderer: { root: any; unmount: () => void } | null = null;
```

- [ ] **Step 2: テスト実行で失敗を確認**

Run: `npx jest src/app/components/__tests__/AchievementUnlockModal.test.tsx`
Expected: FAIL（`theme` 未対応 / 共有ボタンに accessibilityLabel 無し）

- [ ] **Step 3: AchievementUnlockModal を Dialog 利用へ書き換え**

`src/app/components/AchievementUnlockModal.tsx` の全内容を置換:

```tsx
import { Feather } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';

import { AchievementDefinition } from '../../features/achievements/achievementDefinitions';
import { AppTheme } from '../../theme/theme';
import { AppStyles } from '../appStyles';
import { Dialog } from './Dialog';

/** 実績解除モーダルのprops。 */
export type AchievementUnlockModalProps = {
  /** 表示する実績。nullの場合は非表示。 */
  achievement: AchievementDefinition | null;
  /** 紙吹雪を表示ごとに再生するためのキー。 */
  animationKey: string | null;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** X投稿画面を開く処理。 */
  onShareToX: (achievement: AchievementDefinition) => void;
  /** 閉じる処理。 */
  onClose: () => void;
};

/** 実績解除時の紙吹雪付きモーダル。汎用 Dialog を解除通知向けに使う。 */
export function AchievementUnlockModal({ achievement, animationKey, styles, theme, onShareToX, onClose }: AchievementUnlockModalProps) {
  return (
    <Dialog visible={achievement != null} showConfetti autoClose animationKey={animationKey} styles={styles} theme={theme} onClose={onClose}>
      {({ pauseAutoClose }) =>
        achievement && (
          <>
            <Text style={styles.achievementModalEyebrow}>実績解除</Text>
            <Image source={achievement.trophyImage} style={styles.achievementModalImage} />
            <Text style={styles.achievementModalTitle}>{achievement.title}を達成しました！</Text>
            <Text style={styles.achievementModalDescription}>{achievement.description}</Text>
            <View style={styles.achievementModalActions}>
              <Pressable
                onPress={() => {
                  pauseAutoClose();
                  onShareToX(achievement);
                }}
                style={styles.achievementPrimaryButton}
                accessibilityLabel="ともだちに自慢する"
                accessibilityRole="button"
              >
                <Feather name="share-2" size={18} color={styles.primaryButtonText.color} />
                <Text style={styles.primaryButtonText}>ともだちに自慢する</Text>
              </Pressable>
              <Text style={styles.achievementSwipeHint}>スワイプで閉じる</Text>
            </View>
          </>
        )
      }
    </Dialog>
  );
}
```

- [ ] **Step 4: テスト実行で成功を確認**

Run: `npx jest src/app/components/__tests__/AchievementUnlockModal.test.tsx`
Expected: PASS

- [ ] **Step 5: App.tsx の呼び出しに theme を渡す**

`src/app/App.tsx:1172-1178` の `<AchievementUnlockModal ... />` に `theme={theme}` を追加:

```tsx
      <AchievementUnlockModal
        achievement={activeAchievementNotification?.definition ?? null}
        animationKey={activeAchievementNotification ? `${activeAchievementNotification.queueId}:${activeAchievementNotification.definition.id}` : null}
        styles={styles}
        theme={theme}
        onShareToX={shareAchievementToX}
        onClose={closeAchievementUnlockModal}
      />
```

- [ ] **Step 6: 関連テストの回帰確認**

Run: `npx jest src/app/__tests__/AppMapReturn.test.tsx`
Expected: PASS（App が AchievementUnlockModal を描画していてもエラーが出ないこと。失敗する場合はテスト側の AchievementUnlockModal モック有無を確認し、theme 必須化に伴うモック修正を行う）

- [ ] **Step 7: Commit**

```bash
git add src/app/components/AchievementUnlockModal.tsx src/app/components/__tests__/AchievementUnlockModal.test.tsx src/app/App.tsx
git commit -m "refactor(achievement): 解除モーダルを汎用Dialog利用へ置き換える"
```

---

### Task 4: 表示状態判定ヘルパー resolveAchievementDisplayStates

**Files:**
- Create: `src/app/components/achievementDisplayState.ts`
- Test: `src/app/components/__tests__/achievementDisplayState.test.ts`

カテゴリごとに sortOrder 昇順で走査し、解除済みは `unlocked`、最初のロック済みを `next`、以降のロック済みを `hidden` とする。

- [ ] **Step 1: 失敗するテストを書く**

`src/app/components/__tests__/achievementDisplayState.test.ts` を作成:

```typescript
import type { AchievementDefinition } from '../../../features/achievements/achievementDefinitions';
import type { AchievementListItem } from '../../../features/achievements/achievementRepository';
import { resolveAchievementDisplayStates } from '../achievementDisplayState';

/** テスト用の実績一覧項目を作る。 */
function item(id: string, category: AchievementDefinition['category'], sortOrder: number, unlockedAt: string | null): AchievementListItem {
  return {
    definition: {
      id,
      title: id,
      description: '',
      category,
      condition: { type: 'logDays', threshold: 1 },
      trophyImage: 1,
      trophyImageUri: null,
      shareText: '',
      sortOrder,
      enabled: true,
    },
    unlockedAt,
    progressValue: 0,
  };
}

describe('表示状態判定 resolveAchievementDisplayStates', () => {
  test('カテゴリ内で解除済み→次→それ以降を判定する', () => {
    const items = [
      item('a1', 'distance', 1001, '2026-01-01T00:00:00.000Z'),
      item('a2', 'distance', 1002, null),
      item('a3', 'distance', 1003, null),
    ];

    const states = resolveAchievementDisplayStates(items);

    expect(states.get('a1')).toBe('unlocked');
    expect(states.get('a2')).toBe('next');
    expect(states.get('a3')).toBe('hidden');
  });

  test('カテゴリごとに独立して next を決める', () => {
    const items = [
      item('d1', 'distance', 1001, null),
      item('p1', 'prefecture', 4001, null),
    ];

    const states = resolveAchievementDisplayStates(items);

    expect(states.get('d1')).toBe('next');
    expect(states.get('p1')).toBe('next');
  });

  test('sortOrder が逆順で渡っても昇順で next を決める', () => {
    const items = [
      item('a3', 'distance', 1003, null),
      item('a1', 'distance', 1001, '2026-01-01T00:00:00.000Z'),
      item('a2', 'distance', 1002, null),
    ];

    const states = resolveAchievementDisplayStates(items);

    expect(states.get('a2')).toBe('next');
    expect(states.get('a3')).toBe('hidden');
  });
});
```

- [ ] **Step 2: テスト実行で失敗を確認**

Run: `npx jest src/app/components/__tests__/achievementDisplayState.test.ts`
Expected: FAIL（`resolveAchievementDisplayStates` 未作成）

- [ ] **Step 3: ヘルパーを実装**

`src/app/components/achievementDisplayState.ts` を作成:

```typescript
import { AchievementListItem } from '../../features/achievements/achievementRepository';

/** 実績グリッドの表示状態。 */
export type AchievementDisplayState = 'unlocked' | 'next' | 'hidden';

/**
 * カテゴリごとに sortOrder 昇順で表示状態を解決する。
 *
 * @param items 実績一覧。
 * @returns 実績IDから表示状態へのマップ。
 */
export function resolveAchievementDisplayStates(items: AchievementListItem[]): Map<string, AchievementDisplayState> {
  const byCategory = new Map<string, AchievementListItem[]>();

  for (const item of items) {
    const category = item.definition.category;
    const list = byCategory.get(category) ?? [];
    list.push(item);
    byCategory.set(category, list);
  }

  const states = new Map<string, AchievementDisplayState>();

  for (const list of byCategory.values()) {
    const sorted = [...list].sort((a, b) => a.definition.sortOrder - b.definition.sortOrder);
    let firstLockedSeen = false;

    for (const item of sorted) {
      if (item.unlockedAt != null) {
        states.set(item.definition.id, 'unlocked');
        continue;
      }

      if (!firstLockedSeen) {
        firstLockedSeen = true;
        states.set(item.definition.id, 'next');
        continue;
      }

      states.set(item.definition.id, 'hidden');
    }
  }

  return states;
}
```

- [ ] **Step 4: テスト実行で成功を確認**

Run: `npx jest src/app/components/__tests__/achievementDisplayState.test.ts`
Expected: PASS（3テスト）

- [ ] **Step 5: Commit**

```bash
git add src/app/components/achievementDisplayState.ts src/app/components/__tests__/achievementDisplayState.test.ts
git commit -m "feat(achievement): グリッド表示状態判定ヘルパーを追加する"
```

---

### Task 5: グリッド/ダイアログ用スタイル追加

**Files:**
- Modify: `src/app/appStyles.ts`（`achievementGrid` 周辺に追加）
- Test: `src/app/components/__tests__/Dialog.test.tsx`（既存 createStyles 利用で間接検証、新規アサーション不要）

スタイル追加のみ。TDD としては「スタイルキーの存在をアサートする小テスト」を先に書く。

- [ ] **Step 1: スタイル存在を確認する失敗テストを書く**

`src/app/components/__tests__/achievementGridStyles.test.ts` を作成:

```typescript
import { createStyles } from '../../appStyles';
import { darkTheme, lightTheme } from '../../../theme/theme';

describe('実績グリッドのスタイル', () => {
  test('グリッドタイルとシルエット/グレースケール用スタイルを持つ', () => {
    const styles = createStyles(lightTheme);

    expect(styles.achievementGridTile).toBeDefined();
    expect(styles.achievementTileImageWrap).toBeDefined();
    expect(styles.achievementTileImage).toBeDefined();
    expect(styles.achievementTileGrayscaleOverlay).toBeDefined();
    expect(styles.achievementTileTitle).toBeDefined();
    expect(styles.achievementTileProgress).toBeDefined();
    expect(styles.achievementDialogDate).toBeDefined();
    expect(styles.achievementDialogShareButton).toBeDefined();
    expect(styles.achievementDialogShareButtonText).toBeDefined();
  });

  test('グレースケールオーバーレイはライト/ダークで色が異なる', () => {
    const light = createStyles(lightTheme);
    const dark = createStyles(darkTheme);

    expect(light.achievementTileGrayscaleOverlay.backgroundColor).toBe('rgba(255, 255, 255, 0.55)');
    expect(dark.achievementTileGrayscaleOverlay.backgroundColor).toBe('rgba(0, 0, 0, 0.55)');
  });
});
```

- [ ] **Step 2: テスト実行で失敗を確認**

Run: `npx jest src/app/components/__tests__/achievementGridStyles.test.ts`
Expected: FAIL（スタイルキー未定義）

- [ ] **Step 3: appStyles.ts にスタイルを追加**

`src/app/appStyles.ts` の `createStyles` 冒頭ローカル変数群（`const settingsWarning = '#a36100';` の直後あたり）に、テーマ別グレースケール色を定義:

```typescript
    const grayscaleOverlayColor = theme.name === 'dark' ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.55)';
```

`StyleSheet.create({` 内の `achievementGrid` 定義の直後に、以下のキーを追加（アルファベット順を厳守する必要はないが既存に倣い `achievement` 接頭辞群へまとめる）:

```typescript
    achievementGridTile: {
      flexBasis: '48%',
      gap: 6,
    },
    achievementTileImageWrap: {
      alignItems: 'center',
      alignSelf: 'stretch',
      aspectRatio: 1,
      backgroundColor: colors.cardStrong,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    achievementTileImage: {
      height: '78%',
      width: '78%',
    },
    achievementTileGrayscaleOverlay: {
      backgroundColor: grayscaleOverlayColor,
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    achievementTileTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '900',
      lineHeight: 17,
      textAlign: 'center',
    },
    achievementTileProgress: {
      color: colors.mutedText,
      fontSize: 11,
      fontWeight: '800',
      textAlign: 'center',
    },
    achievementDialogDate: {
      color: colors.mutedText,
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'center',
    },
    achievementDialogShareButton: {
      alignItems: 'center',
      backgroundColor: colors.shareButtonBackground,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    achievementDialogShareButtonText: {
      color: colors.shareButtonText,
      fontSize: 15,
      fontWeight: '900',
    },
```

- [ ] **Step 4: テスト実行で成功を確認**

Run: `npx jest src/app/components/__tests__/achievementGridStyles.test.ts`
Expected: PASS（2テスト）

- [ ] **Step 5: Commit**

```bash
git add src/app/appStyles.ts src/app/components/__tests__/achievementGridStyles.test.ts
git commit -m "style(achievement): グリッド/詳細ダイアログ用スタイルを追加する"
```

---

### Task 6: AchievementDialog コンポーネント

**Files:**
- Create: `src/app/components/AchievementDialog.tsx`
- Test: `src/app/components/__tests__/AchievementDialog.test.tsx`

`Dialog` を `showConfetti={false} autoClose={false}` で使う。本文に実績画像/実績名/開放日/説明/システム共有ボタンを描画。閉じるボタンは Dialog 標準を使う。

- [ ] **Step 1: 失敗するテストを書く**

`src/app/components/__tests__/AchievementDialog.test.tsx` を作成:

```tsx
import { Text } from 'react-native';

import type { AchievementListItem } from '../../../features/achievements/achievementRepository';
import { createStyles } from '../../appStyles';
import { lightTheme } from '../../../theme/theme';
import { AchievementDialog } from '../AchievementDialog';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Feather: Text, MaterialCommunityIcons: Text };
});

jest.mock('../ConfettiOverlay', () => ({ ConfettiOverlay: () => null }));

const shareAsync = jest.fn().mockResolvedValue(undefined);
const isAvailableAsync = jest.fn().mockResolvedValue(true);
jest.mock('expo-sharing', () => ({
  isAvailableAsync: (...args: unknown[]) => isAvailableAsync(...args),
  shareAsync: (...args: unknown[]) => shareAsync(...args),
}));

const captureRef = jest.fn().mockResolvedValue('file:///tmp/a.png');
jest.mock('react-native-view-shot', () => ({
  captureRef: (...args: unknown[]) => captureRef(...args),
}));

const { act, create } = require('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => { root: any; unmount: () => void };
};

const styles = createStyles(lightTheme);

const item: AchievementListItem = {
  definition: {
    id: 'log-days-7',
    title: '7日記録',
    description: 'GPSログを7日分記録する',
    category: 'logDays',
    condition: { type: 'logDays', threshold: 7 },
    trophyImage: 1,
    trophyImageUri: null,
    shareText: '共有文言',
    sortOrder: 3001,
    enabled: true,
  },
  unlockedAt: '2026-05-08T00:00:00.000Z',
  progressValue: 7,
};

describe('実績詳細ダイアログ AchievementDialog', () => {
  test('実績名・開放日・説明を表示する', async () => {
    let renderer: any;
    await act(async () => {
      renderer = create(<AchievementDialog item={item} styles={styles} theme={lightTheme} onClose={jest.fn()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('7日記録');
    expect(texts).toContain('GPSログを7日分記録する');
    expect(texts).toContain(`開放日: ${new Date(item.unlockedAt as string).toLocaleDateString()}`);
  });

  test('共有ボタンを押すと captureRef と shareAsync を呼ぶ', async () => {
    let renderer: any;
    await act(async () => {
      renderer = create(<AchievementDialog item={item} styles={styles} theme={lightTheme} onClose={jest.fn()} />);
    });

    const shareButton = renderer.root.findByProps({ accessibilityLabel: '実績を共有する' });
    await act(async () => {
      await shareButton.props.onPress();
    });

    expect(captureRef).toHaveBeenCalled();
    expect(shareAsync).toHaveBeenCalled();
  });

  test('item が null のとき本文を描画しない', async () => {
    let renderer: any;
    await act(async () => {
      renderer = create(<AchievementDialog item={null} styles={styles} theme={lightTheme} onClose={jest.fn()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).not.toContain('7日記録');
  });
});
```

- [ ] **Step 2: テスト実行で失敗を確認**

Run: `npx jest src/app/components/__tests__/AchievementDialog.test.tsx`
Expected: FAIL（`AchievementDialog` 未作成）

- [ ] **Step 3: AchievementDialog を実装**

`src/app/components/AchievementDialog.tsx` を作成:

```tsx
import { useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Alert, Image, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { AchievementListItem } from '../../features/achievements/achievementRepository';
import { AppTheme } from '../../theme/theme';
import { AppStyles } from '../appStyles';
import { Dialog } from './Dialog';

/** 実績詳細ダイアログのprops。 */
export type AchievementDialogProps = {
  /** 表示する実績一覧アイテム。null で非表示。 */
  item: AchievementListItem | null;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 閉じる処理。 */
  onClose: () => void;
};

/** 解除済み実績をタップしたときに開く詳細ダイアログ。 */
export function AchievementDialog({ item, styles, theme, onClose }: AchievementDialogProps) {
  const captureViewRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);

  async function shareAchievementImage(): Promise<void> {
    if (!captureViewRef.current || isSharing) {
      return;
    }

    setIsSharing(true);

    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('共有できません', 'この環境では共有シートを利用できません。');
        return;
      }

      const uri = await captureRef(captureViewRef.current, { format: 'png', quality: 1, result: 'tmpfile' });

      await Sharing.shareAsync(uri, {
        dialogTitle: 'すとろりあ 実績',
        mimeType: 'image/png',
        UTI: 'public.png',
      });
    } catch (error: unknown) {
      Alert.alert('共有失敗', error instanceof Error ? error.message : '実績を共有できませんでした。');
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <Dialog visible={item != null} styles={styles} theme={theme} onClose={onClose}>
      {item && (
        <>
          <View ref={captureViewRef} collapsable={false} style={[styles.achievementModalActions, { alignItems: 'center', backgroundColor: theme.colors.background }]}>
            <Image source={item.definition.trophyImage} style={styles.achievementModalImage} />
            <Text style={styles.achievementModalTitle}>{item.definition.title}</Text>
            {item.unlockedAt && <Text style={styles.achievementDialogDate}>開放日: {new Date(item.unlockedAt).toLocaleDateString()}</Text>}
            <Text style={styles.achievementModalDescription}>{item.definition.description}</Text>
          </View>
          <View style={styles.achievementModalActions}>
            <Text
              accessibilityLabel="実績を共有する"
              accessibilityRole="button"
              onPress={shareAchievementImage}
              style={styles.achievementDialogShareButton}
            >
              <Feather name="share-2" size={18} color={styles.achievementDialogShareButtonText.color} />
              <Text style={styles.achievementDialogShareButtonText}>  共有する</Text>
            </Text>
          </View>
        </>
      )}
    </Dialog>
  );
}
```

注: 共有ボタンは `Pressable` ではなく `Text`（onPress付き）を使うとアイコンとラベルのインライン配置が崩れるため、実装は `Pressable` でラップする方が望ましい。下記の確定版を使うこと:

```tsx
          <View style={styles.achievementModalActions}>
            <Pressable accessibilityLabel="実績を共有する" accessibilityRole="button" onPress={shareAchievementImage} style={styles.achievementDialogShareButton}>
              <Feather name="share-2" size={18} color={styles.achievementDialogShareButtonText.color} />
              <Text style={styles.achievementDialogShareButtonText}>共有する</Text>
            </Pressable>
          </View>
```

`Pressable` を import に追加（`import { Alert, Image, Pressable, Text, View } from 'react-native';`）。上のクラス本文では `Text` 版ブロックを使わず、この `Pressable` 版を採用する。

- [ ] **Step 4: テスト実行で成功を確認**

Run: `npx jest src/app/components/__tests__/AchievementDialog.test.tsx`
Expected: PASS（3テスト）

- [ ] **Step 5: Commit**

```bash
git add src/app/components/AchievementDialog.tsx src/app/components/__tests__/AchievementDialog.test.tsx
git commit -m "feat(achievement): 実績詳細ダイアログを追加する"
```

---

### Task 7: AchievementListScreen をグリッド3状態へ改修 + App 配線

**Files:**
- Modify: `src/app/components/AchievementListScreen.tsx`（全面改修、`getAchievementProgressLabel` は維持）
- Modify: `src/app/App.tsx`（選択状態と AchievementDialog 配線）
- Test: `src/app/components/__tests__/AchievementListScreen.test.ts`（既存維持・変更なし）、`src/app/components/__tests__/AchievementListScreenChrome.test.tsx`（拡張）

- [ ] **Step 1: グリッド3状態の表示テストを書く（失敗させる）**

`src/app/components/__tests__/AchievementListScreenChrome.test.tsx` に以下テストを追加する。先頭の import に追加:

```typescript
import { Image, Pressable, SafeAreaView, Text } from 'react-native';
import type { AchievementListItem } from '../../../features/achievements/achievementRepository';
```

`/** テスト用の実績項目を作る。 */` ヘルパーと新規 describe を末尾に追加:

```typescript
function gridItem(id: string, sortOrder: number, unlockedAt: string | null): AchievementListItem {
  return {
    definition: {
      id,
      title: `${id}タイトル`,
      description: '説明',
      category: 'distance',
      condition: { type: 'totalDistanceMeters', threshold: 1000 },
      trophyImage: 1,
      trophyImageUri: null,
      shareText: '',
      sortOrder,
      enabled: true,
    },
    unlockedAt,
    progressValue: 500,
  };
}

describe('実績グリッドの3状態表示', () => {
  const items = [
    gridItem('d1', 1001, '2026-01-01T00:00:00.000Z'),
    gridItem('d2', 1002, null),
    gridItem('d3', 1003, null),
  ];

  test('解除済みタップで onSelectAchievement を呼ぶ', () => {
    const onSelectAchievement = jest.fn();
    let renderer: any;
    act(() => {
      renderer = ReactTestRenderer.create(
        <AchievementListScreen items={items} styles={styles} theme={lightTheme} onBackToMap={jest.fn()} onSelectAchievement={onSelectAchievement} />,
      );
    });

    const tile = renderer.root.findByProps({ accessibilityLabel: 'd1タイトル の詳細を見る' });
    act(() => {
      tile.props.onPress();
    });
    expect(onSelectAchievement).toHaveBeenCalledWith(items[0]);
  });

  test('それ以降の実績はタイトルと進捗を伏せ字にする', () => {
    let renderer: any;
    act(() => {
      renderer = ReactTestRenderer.create(
        <AchievementListScreen items={items} styles={styles} theme={lightTheme} onBackToMap={jest.fn()} onSelectAchievement={jest.fn()} />,
      );
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('？？？');
  });

  test('次の実績はタイトルを表示し進捗ラベルを出す', () => {
    let renderer: any;
    act(() => {
      renderer = ReactTestRenderer.create(
        <AchievementListScreen items={items} styles={styles} theme={lightTheme} onBackToMap={jest.fn()} onSelectAchievement={jest.fn()} />,
      );
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('d2タイトル');
  });
});
```

- [ ] **Step 2: テスト実行で失敗を確認**

Run: `npx jest src/app/components/__tests__/AchievementListScreenChrome.test.tsx`
Expected: FAIL（`onSelectAchievement` 未対応 / 伏せ字未実装）

- [ ] **Step 3: AchievementListScreen を改修**

`src/app/components/AchievementListScreen.tsx` を以下へ置換（`getAchievementProgressLabel` は末尾にそのまま残す）:

```tsx
import { Image, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { AchievementCategory, formatAchievementDistance } from '../../features/achievements/achievementDefinitions';
import { AchievementListItem } from '../../features/achievements/achievementRepository';
import { AppTheme } from '../../theme/theme';
import { AppStyles } from '../appStyles';
import { resolveAchievementDisplayStates } from './achievementDisplayState';
import { AppScreenHeader } from './AppScreenHeader';

/** 実績一覧画面のprops。 */
export type AchievementListScreenProps = {
  /** 実績定義と解除状態を合わせた一覧。 */
  items: AchievementListItem[];
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 地図画面へ戻る処理。 */
  onBackToMap: () => void;
  /** 解除済み実績をタップしたときの処理。 */
  onSelectAchievement: (item: AchievementListItem) => void;
};

/** 実績カテゴリの表示順と見出し。 */
const categorySections: { category: AchievementCategory; title: string }[] = [
  { category: 'distance', title: '総移動距離' },
  { category: 'logDays', title: 'ログ記録日数' },
  { category: 'prefecture', title: '都道府県' },
  { category: 'municipality', title: '市区町村' },
];

/** 実績画面を2列グリッドで描画する。 */
export function AchievementListScreen({ items, styles, theme, onBackToMap, onSelectAchievement }: AchievementListScreenProps) {
  const displayStates = resolveAchievementDisplayStates(items);

  return (
    <SafeAreaView style={styles.appScreen}>
      <AppScreenHeader backLabel="地図" styles={styles} theme={theme} title="実績" onBack={onBackToMap} />

      <ScrollView contentContainerStyle={styles.screenList}>
        {categorySections.map((section) => {
          const sectionItems = items.filter((item) => item.definition.category === section.category);

          return (
            <View key={section.category} style={styles.achievementSection}>
              <Text style={styles.screenSectionHeading}>{section.title}</Text>
              <View style={styles.achievementGrid}>
                {sectionItems.map((item) => {
                  const state = displayStates.get(item.definition.id) ?? 'hidden';
                  const isUnlocked = state === 'unlocked';
                  const isHidden = state === 'hidden';
                  const title = isHidden ? '？？？' : item.definition.title;
                  const progress = isUnlocked
                    ? getAchievementProgressLabel(item)
                    : isHidden
                      ? '？？？'
                      : getAchievementProgressLabel(item);

                  const tile = (
                    <>
                      <View style={styles.achievementTileImageWrap}>
                        <Image
                          source={item.definition.trophyImage}
                          style={styles.achievementTileImage}
                          {...(isHidden ? { tintColor: theme.colors.border } : {})}
                        />
                        {state === 'next' && <View style={styles.achievementTileGrayscaleOverlay} />}
                      </View>
                      <Text style={styles.achievementTileTitle}>{title}</Text>
                      <Text style={styles.achievementTileProgress}>{progress}</Text>
                    </>
                  );

                  if (isUnlocked) {
                    return (
                      <Pressable
                        key={item.definition.id}
                        style={styles.achievementGridTile}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.definition.title} の詳細を見る`}
                        onPress={() => onSelectAchievement(item)}
                      >
                        {tile}
                      </Pressable>
                    );
                  }

                  return (
                    <View key={item.definition.id} style={styles.achievementGridTile}>
                      {tile}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

/** 実績カードに表示する進捗文言を作る。 */
export function getAchievementProgressLabel(item: AchievementListItem): string {
  if (item.unlockedAt) {
    return `達成: ${new Date(item.unlockedAt).toLocaleDateString()}`;
  }

  const threshold = item.definition.condition.threshold;

  switch (item.definition.condition.type) {
    case 'totalDistanceMeters':
      return `${formatAchievementDistance(item.progressValue / 1000)} / ${formatAchievementDistance(threshold / 1000)}`;
    case 'logDays':
      return `${item.progressValue} / ${threshold} 日`;
    case 'prefectureCount':
      return `${item.progressValue} / ${threshold} 都道府県`;
    case 'municipalityCount':
      return `${item.progressValue} / ${threshold} 市区町村`;
  }
}
```

- [ ] **Step 4: 既存 Chrome テストの呼び出しに onSelectAchievement を追加**

`src/app/components/__tests__/AchievementListScreenChrome.test.tsx` の既存テスト「設定画面と同じ背景と共通ヘッダーで表示する」の `create(...)` 呼び出しに `onSelectAchievement={jest.fn()}` を追加:

```typescript
      renderer = ReactTestRenderer.create(<AchievementListScreen items={[]} styles={styles} theme={lightTheme} onBackToMap={jest.fn()} onSelectAchievement={jest.fn()} />);
```

- [ ] **Step 5: テスト実行で成功を確認**

Run: `npx jest src/app/components/__tests__/AchievementListScreenChrome.test.tsx src/app/components/__tests__/AchievementListScreen.test.ts`
Expected: PASS

- [ ] **Step 6: App.tsx に選択状態と AchievementDialog を配線**

`src/app/App.tsx` の import 群に追加:

```tsx
import { AchievementDialog } from './components/AchievementDialog';
import type { AchievementListItem } from '../features/achievements/achievementRepository';
```

state 宣言（`isAchievementDialogVisibleRef` 付近、コンポーネント本体内の useState 群）に追加:

```tsx
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementListItem | null>(null);
```

`AchievementListScreen` を描画している箇所（`src/app/App.tsx:1078`）の props に `onSelectAchievement` を追加:

```tsx
          {screenMode === 'achievements' && (
            <AchievementListScreen
              items={achievementItems}
              styles={styles}
              theme={theme}
              onBackToMap={openMap}
              onSelectAchievement={setSelectedAchievement}
            />
          )}
```

`<AchievementUnlockModal ... />`（`src/app/App.tsx:1172` 付近）の直後に AchievementDialog を追加:

```tsx
      <AchievementDialog item={selectedAchievement} styles={styles} theme={theme} onClose={() => setSelectedAchievement(null)} />
```

`useState` が App.tsx で未 import の場合は `react` の import に追加（既存で `useState` を多用しているため通常は不要）。

- [ ] **Step 7: App 統合テストの回帰確認**

Run: `npx jest src/app/__tests__/AppMapReturn.test.tsx`
Expected: PASS（AchievementDialog は item=null で本文を描画しないため既存フローに影響しない。失敗時は AchievementDialog が expo-sharing / react-native-view-shot を import する点に対するモック有無を確認する）

- [ ] **Step 8: 全テスト実行**

Run: `npx jest`
Expected: PASS（全スイート）

- [ ] **Step 9: Commit**

```bash
git add src/app/components/AchievementListScreen.tsx src/app/components/__tests__/AchievementListScreenChrome.test.tsx src/app/App.tsx
git commit -m "feat(achievement): 実績画面を2列グリッド3状態表示へ刷新する"
```

---

## 完了後

全タスク完了後、`superpowers:finishing-a-development-branch` スキルを使用してテスト確認・ブランチ完了処理を行う。
