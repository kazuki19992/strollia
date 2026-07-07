import { useRouter } from 'expo-router';

import { AchievementListScreen } from '@/ui/components/AchievementListScreen';
import { useAppState } from '@/ui/state/AppStateProvider';

/**
 * 実績一覧ルート(/achievements)。
 *
 * AppStateProvider から achievementItems を取得し AchievementListScreen を描画する。
 */
export default function AchievementsRoute(): React.ReactElement {
  const s = useAppState();
  const router = useRouter();

  return (
    <AchievementListScreen
      items={s.achievementItems}
      styles={s.styles}
      theme={s.theme}
      onBackToMap={() => {
        s.openMap();
        router.back();
      }}
      onSelectAchievement={s.setSelectedAchievement}
    />
  );
}
