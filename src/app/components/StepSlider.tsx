import { useMemo, useState } from 'react';
import { GestureResponderEvent, PanResponder, Text, View } from 'react-native';

import type { AppStyles } from '../appStyles';

export type StepSliderProps = {
  /** スライダーのアクセシビリティラベル。 */
  accessibilityLabel: string;
  /** 左端の表示ラベル。 */
  endLabel: string;
  /** 最大値。 */
  maxValue: number;
  /** 最小値。 */
  minValue: number;
  /** 右端の表示ラベル。 */
  startLabel: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 1ステップの幅。 */
  stepValue: number;
  /** 現在値。 */
  value: number;
  /** 値が変わったときの処理。 */
  onValueChange: (value: number) => void;
};

/** 指定ステップ単位で値を選択できる汎用スライダー。 */
export function StepSlider({
  accessibilityLabel,
  endLabel,
  maxValue,
  minValue,
  startLabel,
  styles,
  stepValue,
  value,
  onValueChange,
}: StepSliderProps) {
  const [trackWidth, setTrackWidth] = useState(1);
  const normalizedValue = normalizeValue(value, minValue, maxValue, stepValue);
  const progress = (normalizedValue - minValue) / Math.max(maxValue - minValue, 1);
  const tickPositions = useMemo(() => [0.25, 0.5, 0.75], []);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          onValueChange(valueFromLocation(event.nativeEvent.locationX, trackWidth, minValue, maxValue, stepValue));
        },
        onPanResponderMove: (event, gestureState) => {
          onValueChange(valueFromLocation(event.nativeEvent.locationX + gestureState.dx, trackWidth, minValue, maxValue, stepValue));
        },
      }),
    [maxValue, minValue, onValueChange, stepValue, trackWidth],
  );

  function handlePress(event: GestureResponderEvent): void {
    onValueChange(valueFromLocation(event.nativeEvent.locationX, trackWidth, minValue, maxValue, stepValue));
  }

  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="adjustable" style={styles.stepSlider}>
      <Text style={styles.stepSliderEdgeLabel}>{startLabel}</Text>
      <View style={styles.stepSliderTrackWrap}>
        <View
          {...panResponder.panHandlers}
          onLayout={(event) => setTrackWidth(Math.max(event.nativeEvent.layout.width, 1))}
          onStartShouldSetResponder={() => true}
          onResponderRelease={handlePress}
          style={styles.stepSliderTrackTouchArea}
        >
          <View style={styles.stepSliderTrack}>
            <View style={[styles.stepSliderProgress, { width: `${progress * 100}%` }]} />
          </View>
          {tickPositions.map((position) => (
            <View key={position} style={[styles.stepSliderTick, { left: `${position * 100}%` }]} />
          ))}
          <View style={[styles.stepSliderThumb, { left: `${progress * 100}%` }]} />
        </View>
      </View>
      <Text style={styles.stepSliderEdgeLabel}>{endLabel}</Text>
    </View>
  );
}

/** 指定範囲とステップへ値を丸める。 */
export function normalizeValue(value: number, minValue: number, maxValue: number, stepValue: number): number {
  const clampedValue = Math.min(maxValue, Math.max(minValue, value));
  const stepCount = Math.round((clampedValue - minValue) / stepValue);
  return Math.min(maxValue, Math.max(minValue, minValue + stepCount * stepValue));
}

/** トラック上のX座標からステップ値を求める。 */
export function valueFromLocation(locationX: number, trackWidth: number, minValue: number, maxValue: number, stepValue: number): number {
  const ratio = Math.min(1, Math.max(0, locationX / Math.max(trackWidth, 1)));
  return normalizeValue(minValue + (maxValue - minValue) * ratio, minValue, maxValue, stepValue);
}
