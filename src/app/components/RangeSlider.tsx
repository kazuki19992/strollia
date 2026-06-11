import { PanResponder, Text, View } from 'react-native';
import { useRef, useState } from 'react';

import type { AppTheme } from '../../theme/theme';
import type { AppStyles } from '../appStyles';
import { resolveRangeThumbValues, type RangeThumb } from './rangeSliderValue';

export type RangeSliderProps = {
  /** スライダーのアクセシビリティラベル。 */
  accessibilityLabel: string;
  /** 最小値。 */
  minValue: number;
  /** 最大値。 */
  maxValue: number;
  /** 1ステップの幅。 */
  stepValue: number;
  /** 開始つまみの現在値。 */
  startValue: number;
  /** 終了つまみの現在値。 */
  endValue: number;
  /** 左端の表示ラベル。 */
  startLabel: string;
  /** 右端の表示ラベル。 */
  endLabel: string;
  /** 区間の表示ラベル（例: "9:00 〜 11:30"）。 */
  valueLabel: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ（API 互換のため保持、色は appStyles で管理）。 */
  theme: AppTheme;
  /** ドラッグ開始時の処理（任意）。 */
  onDragStart?: () => void;
  /** ドラッグ終了時の処理（任意）。 */
  onDragEnd?: () => void;
  /** 値が変わったときの処理。 */
  onChange: (start: number, end: number) => void;
};

const THUMB_HALF_WIDTH = 13;

/** 開始・終了の2つのつまみで区間を選択できる純粋 JS スライダー。 */
export function RangeSlider({
  accessibilityLabel,
  minValue,
  maxValue,
  stepValue,
  startValue,
  endValue,
  startLabel,
  endLabel,
  valueLabel,
  styles,
  onDragStart,
  onDragEnd,
  onChange,
}: RangeSliderProps) {
  const [trackWidth, setTrackWidth] = useState(1);

  const span = Math.max(maxValue - minValue, 1);
  const startNorm = Math.min(maxValue, Math.max(minValue, startValue));
  const endNorm = Math.min(maxValue, Math.max(minValue, endValue));
  const startProgress = (startNorm - minValue) / span;
  const endProgress = (endNorm - minValue) / span;
  const startThumbX = startProgress * trackWidth - THUMB_HALF_WIDTH;
  const endThumbX = endProgress * trackWidth - THUMB_HALF_WIDTH;

  // すべての動的な値を ref で保持し、PanResponder の再生成を防ぐ。
  // useMemo に prop を含めると onChange 呼び出し後の再レンダリングごとに
  // PanResponder が再生成されてジェスチャーが壊れる。
  const trackWidthRef = useRef(trackWidth);
  const startRef = useRef(startNorm);
  startRef.current = startNorm;
  const endRef = useRef(endNorm);
  endRef.current = endNorm;
  const minValueRef = useRef(minValue);
  minValueRef.current = minValue;
  const maxValueRef = useRef(maxValue);
  maxValueRef.current = maxValue;
  const stepValueRef = useRef(stepValue);
  stepValueRef.current = stepValue;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onDragStartRef = useRef(onDragStart);
  onDragStartRef.current = onDragStart;
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;
  const startDragXRef = useRef(0);
  const endDragXRef = useRef(0);

  // つまみごとに PanResponder を一度だけ生成する。値は ref 経由で参照する。
  const createThumbResponder = (thumb: RangeThumb, dragXRef: { current: number }) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const min = minValueRef.current;
        const max = maxValueRef.current;
        const current = thumb === 'start' ? startRef.current : endRef.current;
        const currentProgress = (current - min) / Math.max(max - min, 1);
        dragXRef.current = currentProgress * trackWidthRef.current;
        onDragStartRef.current?.();
      },
      onPanResponderMove: (_event, gestureState) => {
        const w = trackWidthRef.current;
        const min = minValueRef.current;
        const max = maxValueRef.current;
        const step = stepValueRef.current;
        const rawRatio = (dragXRef.current + gestureState.dx) / w;
        const rawValue = min + Math.min(1, Math.max(0, rawRatio)) * (max - min);
        const next = resolveRangeThumbValues(
          thumb,
          rawValue,
          { start: startRef.current, end: endRef.current },
          { minValue: min, maxValue: max, stepValue: step },
        );
        if (next.start !== startRef.current || next.end !== endRef.current) {
          onChangeRef.current(next.start, next.end);
        }
      },
      onPanResponderRelease: () => {
        onDragEndRef.current?.();
      },
      onPanResponderTerminate: () => {
        onDragEndRef.current?.();
      },
    });

  const startPanResponder = useRef(createThumbResponder('start', startDragXRef)).current;
  const endPanResponder = useRef(createThumbResponder('end', endDragXRef)).current;

  const handleAccessibilityAction = (thumb: RangeThumb, actionName?: string) => {
    const dir = actionName === 'increment' ? 1 : -1;
    const current = thumb === 'start' ? startRef.current : endRef.current;
    const raw = current + dir * stepValueRef.current;
    const next = resolveRangeThumbValues(
      thumb,
      raw,
      { start: startRef.current, end: endRef.current },
      { minValue: minValueRef.current, maxValue: maxValueRef.current, stepValue: stepValueRef.current },
    );
    if (next.start !== startRef.current || next.end !== endRef.current) {
      onChangeRef.current(next.start, next.end);
    }
  };

  return (
    <View style={styles.rangeSlider}>
      <View style={styles.rangeSliderRow}>
        <Text style={styles.rangeSliderEdgeLabel}>{startLabel}</Text>
        <View
          style={styles.rangeSliderTouchArea}
          onLayout={(e) => {
            const w = Math.max(e.nativeEvent.layout.width, 1);
            trackWidthRef.current = w;
            setTrackWidth(w);
          }}
        >
          <View style={styles.rangeSliderTrack}>
            <View
              style={[
                styles.rangeSliderFill,
                {
                  left: `${startProgress * 100}%` as unknown as number,
                  width: `${Math.max(endProgress - startProgress, 0) * 100}%` as unknown as number,
                },
              ]}
            />
          </View>
          <View
            accessible
            accessibilityLabel={`${accessibilityLabel} (${startLabel})`}
            accessibilityRole="adjustable"
            accessibilityValue={{ min: minValue, max: maxValue, now: startNorm, text: valueLabel }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) => handleAccessibilityAction('start', e.nativeEvent.actionName)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            {...startPanResponder.panHandlers}
            style={[styles.rangeSliderThumb, { transform: [{ translateX: startThumbX }] }]}
          />
          <View
            accessible
            accessibilityLabel={`${accessibilityLabel} (${endLabel})`}
            accessibilityRole="adjustable"
            accessibilityValue={{ min: minValue, max: maxValue, now: endNorm, text: valueLabel }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) => handleAccessibilityAction('end', e.nativeEvent.actionName)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            {...endPanResponder.panHandlers}
            style={[styles.rangeSliderThumb, { transform: [{ translateX: endThumbX }] }]}
          />
        </View>
        <Text style={styles.rangeSliderEdgeLabel}>{endLabel}</Text>
      </View>
      <Text style={styles.rangeSliderValueLabel}>{valueLabel}</Text>
    </View>
  );
}
