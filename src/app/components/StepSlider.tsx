import Slider from '@react-native-community/slider';
import { Text, View } from 'react-native';

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
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 現在値。 */
  value: number;
  /** 現在値の表示ラベル。 */
  valueLabel: string;
  /** 値が変わったときの処理。 */
  onValueChange: (value: number) => void;
};

/** 指定ステップ単位で値を選択できるネイティブスライダー。 */
export function StepSlider({
  accessibilityLabel,
  endLabel,
  maxValue,
  minValue,
  startLabel,
  styles,
  stepValue,
  theme,
  value,
  valueLabel,
  onValueChange,
}: StepSliderProps) {
  const normalizedValue = normalizeValue(value, minValue, maxValue, stepValue);

  function handleValueChange(nextValue: number): void {
    const normalizedNextValue = normalizeValue(nextValue, minValue, maxValue, stepValue);
    if (normalizedNextValue !== normalizedValue) {
      onValueChange(normalizedNextValue);
    }
  }

  return (
    <View accessibilityLabel={accessibilityLabel} style={styles.stepSlider}>
      <View style={styles.stepSliderRow}>
        <Text style={styles.stepSliderEdgeLabel}>{startLabel}</Text>
        <Slider
          accessibilityLabel={accessibilityLabel}
          minimumValue={minValue}
          maximumValue={maxValue}
          step={stepValue}
          value={normalizedValue}
          minimumTrackTintColor={theme.name === 'dark' ? '#f2f2f2' : '#172b63'}
          maximumTrackTintColor={theme.name === 'dark' ? '#4b4b4b' : '#e0e0e0'}
          thumbTintColor={theme.name === 'dark' ? '#f2f2f2' : '#ffffff'}
          style={styles.stepSliderNative}
          onValueChange={handleValueChange}
        />
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
