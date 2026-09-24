import { AchievementListScreen } from '@/ui/components/AchievementListScreen';
import { useAppState } from '@/ui/state/AppStateProvider';

/**
 * 実績一覧ルート(/achievements)。
 *
 * AppStateProvider から achievementItems とスポットパックの到達状況を取得し
 * AchievementListScreen を描画する。
 */
export default function AchievementsRoute(): React.ReactElement {
  const s = useAppState();

  return (
    <AchievementListScreen
      items={s.achievementItems}
      landmarkPackItems={s.landmarkPackItems}
      isPlusActive={s.premiumAccessState.isPlusActive}
      styles={s.styles}
      theme={s.theme}
      onBackToMap={() => s.openMap()}
      onSelectAchievement={s.setSelectedAchievement}
      onSelectLandmarkPack={s.openLandmarkPack}
      onRequestPremium={s.openPremiumPaywall}
    />
  );
}
