import { useRouter } from 'expo-router';

import { FaqScreen } from '@/ui/components/FaqScreen';
import { useAppState } from '@/ui/state/AppStateProvider';

/**
 * FAQルート(/settings/faq)。
 */
export default function FaqRoute(): React.ReactElement {
  const s = useAppState();
  const router = useRouter();

  return <FaqScreen styles={s.styles} theme={s.theme} onBackToSettings={() => router.back()} />;
}
