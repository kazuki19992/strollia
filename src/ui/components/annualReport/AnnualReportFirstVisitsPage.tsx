import { Animated, Easing, Text, View } from 'react-native';

import { STORY_PAGE_DURATION_MS } from '@/ui/hooks/useStoryPlayer';
import { timelineProgress, useStoryTimeline } from '@/ui/hooks/useStoryTimeline';
import { AnnualReportRise } from './AnnualReportRise';
import { annualReportStyles } from './annualReportStyles';
import { RISE_DELAYS_MS, type AnnualReportPageProps } from './annualReportPageProps';

/** 都道府県チップが出始める時刻(ミリ秒)。 */
const CHIP_START_MS = 1200;
/** チップ同士の出現間隔の上限(ミリ秒)。数が多いときは全体が約3.5秒に収まるよう詰める。 */
const CHIP_INTERVAL_MAX_MS = 220;
const CHIP_TOTAL_MS = 3500;
/** チップのポンと出るアニメーション。 */
const CHIP_POP_MS = 500;
const CHIP_POP_EASING = Easing.bezier(0.3, 1.6, 0.5, 1);

/** その年に訪れた都道府県に、初訪問の都道府県(訪問一覧に無いものも含めて)を合わせたチップの並び。 */
function resolvePrefectureChips(visited: string[], newPrefectures: string[]): { name: string; isNew: boolean }[] {
  const newSet = new Set(newPrefectures);
  const names = [...visited, ...newPrefectures.filter((name) => !visited.includes(name))];
  return names.map((name) => ({ name, isNew: newSet.has(name) }));
}

/** ページ7: その年にはじめて訪れた場所。都道府県名をポンと順に出し、初訪問には ★ を付ける。 */
export function AnnualReportFirstVisitsPage({ payload, paused, completed, contentTop }: AnnualReportPageProps) {
  const clock = useStoryTimeline({ durationMs: STORY_PAGE_DURATION_MS, paused, completed });
  const chips = resolvePrefectureChips(payload.visitedPrefectures, payload.newPrefectures);
  const interval = Math.min(CHIP_INTERVAL_MAX_MS, CHIP_TOTAL_MS / Math.max(1, chips.length));

  return (
    <View style={[annualReportStyles.page, annualReportStyles.pageContent, { paddingTop: contentTop }]}>
      <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[0]}>
        <Text style={annualReportStyles.pageHeading}>{`${payload.year}年にはじめて訪れた場所`}</Text>
      </AnnualReportRise>
      <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[1]}>
        <Text style={annualReportStyles.pageMessage}>
          <Text style={annualReportStyles.accentText}>{payload.newPrefectures.length}</Text>
          {'つの都道府県、\n'}
          <Text style={annualReportStyles.accentText}>{payload.newMunicipalityCount}</Text>
          {'つの市区町村に\n初訪問です！'}
        </Text>
      </AnnualReportRise>
      <View style={annualReportStyles.chips}>
        {chips.map((chip, index) => {
          const pop = timelineProgress(clock, CHIP_START_MS + index * interval, CHIP_POP_MS, CHIP_POP_EASING);
          return (
            <Animated.View
              key={chip.name}
              style={[
                annualReportStyles.chip,
                chip.isNew && annualReportStyles.chipNew,
                {
                  opacity: pop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
                  transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
                },
              ]}
            >
              <Text style={[annualReportStyles.chipText, chip.isNew && annualReportStyles.chipTextNew]}>
                {chip.isNew ? `★ ${chip.name}` : chip.name}
              </Text>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
