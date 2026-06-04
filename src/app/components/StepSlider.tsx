import { PanResponder, Text, View } from 'react-native';
import { useRef, useState } from 'react';

import type { AppTheme } from '../../theme/theme';
import type { AppStyles } from '../appStyles';

export type StepSliderProps = {
  /** スライダーのアクセシビリティラベル。 */
  accessibilityLabel: string;
  /** 右端の表示ラベル。 */
  endLabel: string;
  /** 最大値。 */
  maxValue: number;
  /** 最小値。 */
  minValue: number;
  /** 左端の表示ラベル。 */
  startLabel: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 1ステップの幅。 */
  stepValue: number;
  /** 現在テーマ（API 互換のため保持、色は appStyles で管理）。 */
  theme: AppTheme;
  /** 現在値。 */
  value: number;
  /** 現在値の表示ラベル。 */
  valueLabel: string;
  /** ドラッグ開始時の処理（任意）。 */
  onDragStart?: () => void;
  /** ドラッグ終了時の処理（任意）。 */
  onDragEnd?: () => void;
  /** 値が変わったときの処理。 */
  onValueChange: (value: number) => void;
};

const THUMB_HALF_WIDTH = 13;

/** 指定ステップ単位で値を選択できる純粋 JS スライダー。 */
export function StepSlider({
  accessibilityLabel,
  endLabel,
  maxValue,
  minValue,
  startLabel,
  styles,
  stepValue,
  value,
  valueLabel,
  onDragStart,
  onDragEnd,
  onValueChange,
}: StepSliderProps) {
  const [trackWidth, setTrackWidth] = useState(1);
  const normalizedValue = normalizeValue(value, minValue, maxValue, stepValue);
  const progress = (normalizedValue - minValue) / Math.max(maxValue - minValue, 1);
  const thumbX = progress * trackWidth - THUMB_HALF_WIDTH;

  // すべての動的な値を ref で保持し、PanResponder の再生成を防ぐ。
  // useMemo に prop を含めると onValueChange 呼び出し後の再レンダリングごとに
  // PanResponder が再生成されてジェスチャーが壊れる。
  const trackWidthRef = useRef(trackWidth);
  const normalizedValueRef = useRef(normalizedValue);
  normalizedValueRef.current = normalizedValue;
  const minValueRef = useRef(minValue);
  minValueRef.current = minValue;
  const maxValueRef = useRef(maxValue);
  maxValueRef.current = maxValue;
  const stepValueRef = useRef(stepValue);
  stepValueRef.current = stepValue;
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;
  const onDragStartRef = useRef(onDragStart);
  onDragStartRef.current = onDragStart;
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;
  const dragStartXRef = useRef(0);

  // PanResponder を一度だけ生成する。すべての値は ref 経由で参照する。
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const min = minValueRef.current;
        const max = maxValueRef.current;
        const norm = normalizedValueRef.current;
        const currentProgress = (norm - min) / Math.max(max - min, 1);
        dragStartXRef.current = currentProgress * trackWidthRef.current;
        onDragStartRef.current?.();
      },
      onPanResponderMove: (_event, gestureState) => {
        const w = trackWidthRef.current;
        const min = minValueRef.current;
        const max = maxValueRef.current;
        const step = stepValueRef.current;
        const rawRatio = (dragStartXRef.current + gestureState.dx) / w;
        const rawValue = min + Math.min(1, Math.max(0, rawRatio)) * (max - min);
        const nextValue = normalizeValue(rawValue, min, max, step);
        if (nextValue !== normalizedValueRef.current) {
          onValueChangeRef.current(nextValue);
        }
      },
      onPanResponderRelease: () => {
        onDragEndRef.current?.();
      },
      onPanResponderTerminate: () => {
        onDragEndRef.current?.();
      },
    }),
  ).current;

  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="adjustable" style={styles.stepSlider}>
      <View style={styles.stepSliderRow}>
        <Text style={styles.stepSliderEdgeLabel}>{startLabel}</Text>
        <View
          {...panResponder.panHandlers}
          style={styles.stepSliderTouchArea}
          onLayout={(e) => {
            const w = Math.max(e.nativeEvent.layout.width, 1);
            trackWidthRef.current = w;
            setTrackWidth(w);
          }}
        >
          <View style={styles.stepSliderTrack}>
            <View style={[styles.stepSliderFill, { width: `${progress * 100}%` as unknown as number }]} />
          </View>
          <View style={[styles.stepSliderThumb, { transform: [{ translateX: thumbX }] }]} />
        </View>
        <Text style={styles.stepSliderEdgeLabel}>{endLabel}</Text>
      </View>
      <Text style={styles.stepSliderValueLabel}>{valueLabel}</Text>
    </View>
  );
}

/** 指定範囲とステップへ値を丸める。 */
export function normalizeValue(value: number, minValue: number, maxValue: number, stepValue: number): number {
  const clampedValue = Math.min(maxValue, Math.max(minValue, value));
  const stepCount = Math.round((clampedValue - minValue) / stepValue);
  return Math.min(maxValue, Math.max(minValue, minValue + stepCount * stepValue));
}
