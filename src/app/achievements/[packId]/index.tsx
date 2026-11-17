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
 * - 到達済みスポットからは、実績スタックの子画面(/achievements/[packId]/[date])として日別記録詳細を開く。
 *   日別記録スタック(/daily-logs/[date])へ飛ぶと右からの子画面遷移にならず、戻る先・戻るラベルも
 *   「日ごとの記録」になってパック詳細へ帰れないため。
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
      onSelectVisitedSpot={(localDate) => router.push({ pathname: '/achievements/[packId]/[date]', params: { packId, date: localDate } })}
    />
  );
}
