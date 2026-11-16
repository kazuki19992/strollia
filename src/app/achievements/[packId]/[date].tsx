import { useLocalSearchParams, useRouter } from 'expo-router';

import { DailyLogDetailScreen } from '@/ui/components/DailyLogDetailScreen';
import { useAppState } from '@/ui/state/AppStateProvider';

/**
 * スポットパック詳細から開く日別記録詳細ルート(/achievements/[packId]/[date])。
 *
 * 画面は日別記録スタックの詳細(/daily-logs/[date])と同じ DailyLogDetailScreen を使う。
 * 実績スタックの子として積むことで、右からの子画面遷移・左端スワイプバック・
 * 戻るボタン(ラベルはパック名)がすべてパック詳細へ戻る動きになる。
 *
 * 設計上の注意:
 * - パック・日別ログが見つからない場合は何も描画しない(異常系。日別記録ルートと同じ扱い)。
 */
export default function LandmarkPackDailyLogDetailRoute(): React.ReactElement | null {
  const { packId, date } = useLocalSearchParams<{ packId: string; date: string }>();
  const s = useAppState();
  const router = useRouter();

  const detail = s.getLandmarkPackDetail(packId);
  const log = s.dailyLogs.find((l) => l.localDate === date);

  if (!detail || !log) {
    return null;
  }

  return (
    <DailyLogDetailScreen
      backLabel={detail.pack.name}
      log={log}
      styles={s.styles}
      theme={s.theme}
      premiumAccessState={s.premiumAccessState}
      activeStayPlaces={s.activeStayPlaces}
      stayPlacesStatus={s.stayPlacesStatus}
      onBackToDailyLogs={() => router.back()}
      onOpenPremiumPaywall={s.openPremiumPaywall}
    />
  );
}
