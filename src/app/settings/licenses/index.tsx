import { useRouter } from 'expo-router';

import { LicenseScreen } from '@/ui/components/LicenseScreen';
import { useAppState } from '@/ui/state/AppStateProvider';

/**
 * OSSライセンス一覧ルート(/settings/licenses)。
 */
export default function LicenseListRoute(): React.ReactElement {
  const s = useAppState();
  const router = useRouter();

  return (
    <LicenseScreen
      styles={s.styles}
      theme={s.theme}
      onBackToSettings={() => router.back()}
      onOpenLicenseDetail={(license) => router.push({ pathname: '/settings/licenses/[name]', params: { name: license.id } })}
    />
  );
}
