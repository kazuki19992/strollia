import { useRouter } from 'expo-router';

import { AboutAppScreen } from '@/ui/components/AboutAppScreen';
import { useAppState } from '@/ui/state/AppStateProvider';

/**
 * アプリ情報ルート(/settings/about)。
 */
export default function AboutAppRoute(): React.ReactElement {
  const s = useAppState();
  const router = useRouter();

  return <AboutAppScreen styles={s.styles} theme={s.theme} onBackToSettings={() => router.back()} />;
}
