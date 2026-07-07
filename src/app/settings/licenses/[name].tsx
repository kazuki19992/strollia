import { useLocalSearchParams, useRouter } from 'expo-router';

import { LicenseDetailScreen } from '@/ui/components/LicenseScreen';
import { OSS_LICENSES } from '@/ui/generated/ossLicenses';
import { useAppState } from '@/ui/state/AppStateProvider';

/**
 * OSSライセンス詳細ルート(/settings/licenses/[name])。
 *
 * URL パラメータの name(= OssLicenseEntry.id) から OSS_LICENSES を検索し
 * LicenseDetailScreen を描画する。
 *
 * 設計上の注意:
 * - expo-router のパラメータは文字列のみ許容するため OssLicenseEntry オブジェクトは
 *   渡さず id 文字列で検索する。OSS_LICENSES は同一データ源のため挙動は不変。
 * - ライセンスが見つからない場合は何も描画しない(異常系)。
 */
export default function LicenseDetailRoute(): React.ReactElement | null {
  const { name } = useLocalSearchParams<{ name: string }>();
  const s = useAppState();
  const router = useRouter();

  const license = OSS_LICENSES.find((l) => l.id === name);

  if (!license) {
    return null;
  }

  return <LicenseDetailScreen license={license} styles={s.styles} theme={s.theme} onBackToLicenseList={() => router.back()} />;
}
