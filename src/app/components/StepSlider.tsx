import { PanResponder, Text, View } from 'react-native';
import { useMemo, useRef, useState } from 'react';

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
  onValueChange,
}: StepSliderProps) {
  const [trackWidth, setTrackWidth] = useState(1);
  const normalizedValue = normalizeValue(value, minValue, maxValue, stepValue);
  const normalizedValueRef = useRef(normalizedValue);
  normalizedValueRef.current = normalizedValue;
  const dragStartXRef = useRef(0);
  const dragStartValueRef = useRef(normalizedValue);
  const progress = (normalizedValue - minValue) / Math.max(maxValue - minValue, 1);
  const thumbX = progress * trackWidth - THUMB_HALF_WIDTH;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const rawX = Math.min(trackWidth, Math.max(0, event.nativeEvent.locationX));
          const nextValue = normalizeValue(
            minValue + (rawX / trackWidth) * (maxValue - minValue),
            minValue,
            maxValue,
            stepValue,
          );
          dragStartXRef.current = rawX;
          dragStartValueRef.current = nextValue;
          if (nextValue !== normalizedValueRef.current) {
            onValueChange(nextValue);
          }
        },
        onPanResponderMove: (_event, gestureState) => {
          const rawRatio = (dragStartXRef.current + gestureState.dx) / trackWidth;
          const rawValue = minValue + Math.min(1, Math.max(0, rawRatio)) * (maxValue - minValue);
          const nextValue = normalizeValue(rawValue, minValue, maxValue, stepValue);
          if (nextValue !== normalizedValueRef.current) {
            onValueChange(nextValue);
          }
        },
      }),
    [trackWidth, minValue, maxValue, stepValue, onValueChange],
  );

  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="adjustable" style={styles.stepSlider}>
      <View style={styles.stepSliderRow}>
        <Text style={styles.stepSliderEdgeLabel}>{startLabel}</Text>
        <View
          {...panResponder.panHandlers}
          style={styles.stepSliderTouchArea}
          onLayout={(e) => setTrackWidth(Math.max(e.nativeEvent.layout.width, 1))}
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
