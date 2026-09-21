import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { createAltitudeProfile, formatAltitudeProfileTime, type AltitudeProfile } from '@/features/reports/altitudeProfile';
import type { AppTheme } from '@/theme/theme';
import type { LocationPoint } from '@/types/gps';
import type { AppStyles } from '@/ui/appStyles';
import { SectionTitle } from './SectionTitle';

const CHART_HEIGHT = 160;
const INITIAL_CHART_WIDTH = 320;
const CHART_PADDING = 8;

export type AltitudeProfileSectionProps = {
  /** 1日全体のGPSポイント。 */
  points: readonly LocationPoint[];
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** データ不足時に画面用メッセージを表示するか。 */
  showUnavailableMessage: boolean;
};

/** 高度点をSVG座標へ変換して1区間のパス文字列を作る。 */
function createSegmentPath(segment: AltitudeProfile['segments'][number], profile: AltitudeProfile, width: number): string {
  const timeRange = Math.max(1, profile.endTimestampMs - profile.startTimestampMs);
  const altitudeRange = Math.max(1, profile.maxAltitudeMeters - profile.minAltitudeMeters);
  return segment
    .map((point, index) => {
      const x = ((point.timestampMs - profile.startTimestampMs) / timeRange) * width;
      const y =
        CHART_PADDING + (1 - (point.altitudeMeters - profile.minAltitudeMeters) / altitudeRange) * (CHART_HEIGHT - CHART_PADDING * 2);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

/** 日別詳細とPNG共有で共通利用する高度プロファイルセクション。 */
export function AltitudeProfileSection({ points, styles, theme, showUnavailableMessage }: AltitudeProfileSectionProps) {
  const [chartWidth, setChartWidth] = useState(INITIAL_CHART_WIDTH);
  const profile = useMemo(() => createAltitudeProfile(points, Math.max(2, Math.ceil(chartWidth * 2))), [chartWidth, points]);

  if (!profile) {
    if (!showUnavailableMessage) return null;
    return (
      <View style={styles.dailyLogDetailSection}>
        <SectionTitle styles={styles}>高度</SectionTitle>
        <Text style={styles.altitudeProfileEmptyText}>高度データを表示できません</Text>
      </View>
    );
  }

  const minAltitude = Math.round(profile.minAltitudeMeters);
  const maxAltitude = Math.round(profile.maxAltitudeMeters);
  const accessibilityLabel = `最低高度${minAltitude}メートル、最高高度${maxAltitude}メートル`;
  const stroke = profile.isFlat ? theme.colors.primary : 'url(#altitude-profile-gradient)';

  return (
    <View style={styles.dailyLogDetailSection}>
      <SectionTitle styles={styles}>高度</SectionTitle>
      <View accessible accessibilityLabel={accessibilityLabel}>
        <View style={styles.altitudeProfilePlotRow}>
          <View style={styles.altitudeProfileYAxis}>
            <Text style={styles.altitudeProfileAxisLabel}>{maxAltitude}m</Text>
            <Text style={styles.altitudeProfileAxisLabel}>{minAltitude}m</Text>
          </View>
          <View
            style={styles.altitudeProfileChart}
            onLayout={(event) => {
              const width = event.nativeEvent.layout.width;
              if (width > 0 && width !== chartWidth) setChartWidth(width);
            }}
          >
            <Svg accessibilityElementsHidden height={CHART_HEIGHT} viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`} width="100%">
              <Defs>
                <LinearGradient id="altitude-profile-gradient" x1="0" x2="0" y1="1" y2="0">
                  <Stop offset="0" stopColor={theme.colors.altitudeLow} />
                  <Stop offset="0.45" stopColor={theme.colors.altitudeMid} />
                  <Stop offset="0.72" stopColor={theme.colors.altitudeHighMid} />
                  <Stop offset="1" stopColor={theme.colors.altitudeHigh} />
                </LinearGradient>
              </Defs>
              {[0.25, 0.5, 0.75].map((ratio) => (
                <Line
                  key={ratio}
                  stroke={theme.colors.border}
                  strokeWidth={1}
                  x1={0}
                  x2={chartWidth}
                  y1={CHART_HEIGHT * ratio}
                  y2={CHART_HEIGHT * ratio}
                />
              ))}
              {profile.segments
                .filter((segment) => segment.length >= 2)
                .map((segment, index) => (
                  <Path
                    key={`${segment[0].timestampMs}-${index}`}
                    d={createSegmentPath(segment, profile, chartWidth)}
                    fill="none"
                    stroke={stroke}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                  />
                ))}
            </Svg>
          </View>
        </View>
        <View style={styles.altitudeProfileTimeLabels}>
          <Text style={styles.altitudeProfileTimeLabel}>{formatAltitudeProfileTime(profile.startTimestampMs)}</Text>
          <Text style={styles.altitudeProfileTimeLabel}>{formatAltitudeProfileTime(profile.middleTimestampMs)}</Text>
          <Text style={styles.altitudeProfileTimeLabel}>{formatAltitudeProfileTime(profile.endTimestampMs)}</Text>
        </View>
      </View>
    </View>
  );
}
