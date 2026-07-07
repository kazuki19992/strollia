import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { AppStyles } from '@/app/appStyles';
import {
  DASHBOARD_BASE_TEXT,
  FIXED_MAP_UI_TEXT_PROPS,
  formatSpeedKmh,
  getScaledSpeedDialLayout,
  getScaledTextStyle,
  getSpeedMeterArcStroke,
  SPEED_METER_ARC_RADIUS,
  SPEED_METER_ARC_STROKE_WIDTH,
} from './dashboardScaling';

export type SpeedDialProps = {
  /** 現在速度。単位はkm/h。 */
  currentSpeedKmh: number;
  /** ゲージ進捗。0〜100の割合。 */
  progressPercent: number;
  /** ダッシュボードの縮小倍率。 */
  scale: number;
  /** 速度帯に応じた色。 */
  speedColor: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
};

/** 数字と速度リングを持つ円形スピードメーターを描画する。 */
export function SpeedDial({ currentSpeedKmh, progressPercent, scale, speedColor, styles }: SpeedDialProps) {
  const arcStroke = getSpeedMeterArcStroke(progressPercent);
  const layout = getScaledSpeedDialLayout(scale);

  return (
    <View style={[styles.speedDashboardDial, layout.dial]}>
      <View style={[styles.speedDashboardRingBase, layout.ringBase]} testID="speed-meter-ring-base" />
      <Svg
        accessibilityElementsHidden
        focusable={false}
        pointerEvents="none"
        style={[styles.speedDashboardArcSvg, layout.arcSvg]}
        testID="speed-meter-arc-svg"
        viewBox="0 0 104 104"
      >
        {progressPercent > 0 && (
          <Circle
            cx="52"
            cy="52"
            fill="none"
            originX="52"
            originY="52"
            r={SPEED_METER_ARC_RADIUS}
            rotation="-90"
            stroke={speedColor}
            strokeDasharray={arcStroke.strokeDasharray}
            strokeDashoffset={arcStroke.strokeDashoffset}
            strokeLinecap="round"
            strokeWidth={SPEED_METER_ARC_STROKE_WIDTH}
            testID="speed-meter-progress-arc"
          />
        )}
      </Svg>
      <View style={[styles.speedDashboardDialContent, layout.dialContent]}>
        <Text {...FIXED_MAP_UI_TEXT_PROPS} style={[styles.speedometerLabel, getScaledTextStyle(DASHBOARD_BASE_TEXT.speedLabel, scale)]}>
          SPEED
        </Text>
        <Text
          {...FIXED_MAP_UI_TEXT_PROPS}
          style={[styles.speedDashboardSpeedValue, getScaledTextStyle(DASHBOARD_BASE_TEXT.speedValue, scale), { color: speedColor }]}
        >
          {formatSpeedKmh(currentSpeedKmh)}
        </Text>
        <Text
          {...FIXED_MAP_UI_TEXT_PROPS}
          style={[styles.speedDashboardSpeedUnit, getScaledTextStyle(DASHBOARD_BASE_TEXT.speedUnit, scale)]}
        >
          km/h
        </Text>
      </View>
    </View>
  );
}
