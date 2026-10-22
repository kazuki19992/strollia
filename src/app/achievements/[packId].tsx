import { useLocalSearchParams, useRouter } from 'expo-router';

import { LandmarkPackScreen } from '@/ui/components/LandmarkPackScreen';
import { useAppState } from '@/ui/state/AppStateProvider';

/**
 * スポットパック詳細ルート(/achievements/[packId])。
 *
 * AppStateProvider から到達状況を取得し LandmarkPackScreen を描画する。
 *
 * 設計上の注意:
 * - ナビゲーションパラメータは文字列のみ許容するため、パック定義ではなく packId を受け取る。
 * - 未知の packId(ディープリンクやマスタからパックが消えた場合)は何も描画しない(異常系)。
 * - 到達済みスポットからの日別記録詳細への遷移は、日別記録一覧ルートと同じく router.push で行う。
 * - 未到達スポットは画面内の埋め込み地図がズームするだけで、メイン地図への遷移はしない
 *   (LandmarkPackScreen が内部状態として管理する)。
 */
export default function LandmarkPackRoute(): React.ReactElement | null {
  const { packId } = useLocalSearchParams<{ packId: string }>();
  const s = useAppState();
  const router = useRouter();

  const detail = s.getLandmarkPackDetail(packId);

  if (!detail) {
    return null;
  }

  return (
    <LandmarkPackScreen
      pack={detail.pack}
      spotItems={detail.spotItems}
      styles={s.styles}
      theme={s.theme}
      onBack={s.closeLandmarkPack}
      onSelectVisitedSpot={(localDate) => router.push({ pathname: '/daily-logs/[date]', params: { date: localDate } })}
    />
  );
}
