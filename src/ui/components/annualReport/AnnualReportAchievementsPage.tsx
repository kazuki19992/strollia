import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Animated, Easing, Image, type ImageSourcePropType, Text, View } from 'react-native';

import { getAchievementDefinition } from '@/features/achievements/achievementDefinitions';
import { achievementMessage } from '@/features/annualReport/annualReportCopy';
import type { AnnualReportPayloadV1 } from '@/features/annualReport/annualReportTypes';
import { getLandmarkSpotById } from '@/features/landmarks/landmarkCatalog';
import { STORY_PAGE_DURATION_MS } from '@/ui/hooks/useStoryPlayer';
import { timelineProgress, useStoryTimeline } from '@/ui/hooks/useStoryTimeline';
import { AnnualReportRise } from './AnnualReportRise';
import { annualReportColors, annualReportStyles } from './annualReportStyles';
import { RISE_DELAYS_MS, type AnnualReportPageProps } from './annualReportPageProps';

/** トロフィーの最大表示数(spec §4)。 */
const MAX_TROPHIES = 3;
/** 最初のトロフィーが落ち始める時刻と、トロフィー同士の間隔(ミリ秒)。 */
const DROP_START_MS = 1200;
const DROP_INTERVAL_MS = 400;
const DROP_MS = 700;
const DROP_EASING = Easing.bezier(0.3, 1.5, 0.5, 1);
/** 光る(輪が広がって消える)のを始める時刻と1回の長さ(ミリ秒)。2回繰り返す。 */
const GLOW_START_MS = 2400;
const GLOW_MS = 800;
/** 「ほか N 件」を出す時刻(ミリ秒)。最大3件のトロフィーが落ち終わった後にする。 */
const REMAINING_DELAY_MS = DROP_START_MS + MAX_TROPHIES * DROP_INTERVAL_MS;

/** ページ9に出すトロフィー1件。 */
export type AnnualReportTrophyItem = {
  key: string;
  title: string;
  caption: string;
  /** 実績ならトロフィー画像。スポットは画像を持たないため null(アイコンで表す)。 */
  image: ImageSourcePropType | null;
  date: string;
};

/** `YYYY-MM-DD` を `M月D日` にする。 */
function formatMonthDay(localDate: string): string {
  const [, month, day] = localDate.split('-').map((value) => Number.parseInt(value, 10));
  return `${month}月${day}日`;
}

/**
 * 実績とスポットの代表を新しい順に混ぜ、最大3件にする。
 * マスタから消えたIDは表示できないため飛ばす。
 */
export function resolveAnnualReportTrophies(payload: AnnualReportPayloadV1): AnnualReportTrophyItem[] {
  const achievements: AnnualReportTrophyItem[] = payload.achievements.highlights.flatMap((highlight) => {
    const definition = getAchievementDefinition(highlight.id);
    return definition
      ? [
          {
            key: `achievement-${highlight.id}`,
            title: definition.title,
            caption: `実績・${formatMonthDay(highlight.unlockedLocalDate)}`,
            image: definition.trophyImage,
            date: highlight.unlockedLocalDate,
          },
        ]
      : [];
  });
  const spots: AnnualReportTrophyItem[] = payload.spots.highlights.flatMap((highlight) => {
    const spot = getLandmarkSpotById(highlight.id);
    return spot
      ? [
          {
            key: `spot-${highlight.id}`,
            title: spot.name,
            caption: `スポット到達・${formatMonthDay(highlight.visitedLocalDate)}`,
            image: null,
            date: highlight.visitedLocalDate,
          },
        ]
      : [];
  });
  return [...achievements, ...spots].sort((left, right) => right.date.localeCompare(left.date)).slice(0, MAX_TROPHIES);
}

/**
 * 表示しきれなかった実績・スポットの件数を返す(0未満は0)。
 * 代表は最大3件のため、合計から実際に表示した件数を引いて「ほか N 件」に使う。
 * マスタから消えて表示できなかった代表も、残りとして数える。
 */
export function resolveRemainingTrophyCount(payload: AnnualReportPayloadV1, shown: number): number {
  return Math.max(0, payload.achievements.count + payload.spots.count - shown);
}

/**
 * ページ9: 到達したスポットと実績。トロフィーが上から落ちて光る(最大3件)。スポットが0件なら実績だけの文言にする。
 * 表示しきれない件数があれば、トロフィーの下に「ほか N 件」を出す。
 */
export function AnnualReportAchievementsPage({ payload, paused, completed, contentTop }: AnnualReportPageProps) {
  const clock = useStoryTimeline({ durationMs: STORY_PAGE_DURATION_MS, paused, completed });
  const hasSpots = payload.spots.count > 0;
  const trophies = resolveAnnualReportTrophies(payload);
  const remaining = resolveRemainingTrophyCount(payload, trophies.length);

  return (
    <View style={[annualReportStyles.page, annualReportStyles.pageContent, { paddingTop: contentTop }]}>
      <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[0]}>
        <Text style={annualReportStyles.pageHeading}>{hasSpots ? '到達したスポットと実績' : '解除した実績'}</Text>
      </AnnualReportRise>
      <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[1]}>
        <Text style={annualReportStyles.pageMessage}>{achievementMessage(payload.achievements.count, payload.spots.count)}</Text>
      </AnnualReportRise>
      <View style={annualReportStyles.trophies}>
        {trophies.map((trophy, index) => {
          const drop = timelineProgress(clock, DROP_START_MS + index * DROP_INTERVAL_MS, DROP_MS, DROP_EASING);
          const glow = clock.interpolate({
            inputRange: [GLOW_START_MS, GLOW_START_MS + GLOW_MS, GLOW_START_MS + GLOW_MS + 1, GLOW_START_MS + GLOW_MS * 2],
            outputRange: [0, 1, 0, 1],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View
              key={trophy.key}
              style={[
                annualReportStyles.trophyRow,
                {
                  opacity: drop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
                  transform: [
                    { translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) },
                    { scale: drop.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                  ],
                },
              ]}
            >
              {/* 金色の丸の座布団はトロフィーが見づらくなるため敷かず、画像を直接置く */}
              <View style={annualReportStyles.trophyIcon}>
                <Animated.View
                  style={[
                    annualReportStyles.trophyGlow,
                    {
                      opacity: glow.interpolate({ inputRange: [0, 0.01, 1], outputRange: [0, 0.8, 0] }),
                      transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
                    },
                  ]}
                />
                {trophy.image ? (
                  <Image source={trophy.image} style={annualReportStyles.trophyImage} resizeMode="contain" />
                ) : (
                  <MaterialCommunityIcons name="map-marker-star" size={36} color={annualReportColors.accent} />
                )}
              </View>
              <View>
                <Text style={annualReportStyles.trophyTitle}>{trophy.title}</Text>
                <Text style={annualReportStyles.trophyCaption}>{trophy.caption}</Text>
              </View>
            </Animated.View>
          );
        })}
        {remaining > 0 ? (
          <AnnualReportRise clock={clock} delayMs={REMAINING_DELAY_MS}>
            <Text style={annualReportStyles.trophyRemaining}>{`ほか ${remaining} 件`}</Text>
          </AnnualReportRise>
        ) : null}
      </View>
    </View>
  );
}
