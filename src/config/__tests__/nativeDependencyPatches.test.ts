import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** リポジトリルート。src/config/__tests__ から3階層上。 */
const ROOT_DIR = join(__dirname, '..', '..', '..');

/** iOS 27で起動を止めていた通知権限取得の実装ファイル。 */
const NOTIFICATIONS_REQUESTER_PATH = join(
  ROOT_DIR,
  'node_modules/expo-notifications/ios/ExpoNotifications/Permissions/ExpoNotificationsPermissionsRequester.swift',
);

/** package.json の検証に使う項目だけを表す型。 */
type PackageJson = { version?: string; scripts?: Record<string, string> };

/** package.json を読み込む。 */
function readPackageJson(path: string): PackageJson {
  return JSON.parse(readFileSync(path, 'utf8')) as PackageJson;
}

describe('依存パッケージのネイティブパッチ', () => {
  it('npm install 後に patch-package でパッチを適用する', () => {
    const rootPackage = readPackageJson(join(ROOT_DIR, 'package.json'));

    expect(rootPackage.scripts?.postinstall).toBe('patch-package');
  });

  it('インストール済みの expo-notifications と同じバージョンのパッチが存在する(更新時にパッチの作り直し漏れを検知する)', () => {
    const { version } = readPackageJson(join(ROOT_DIR, 'node_modules/expo-notifications/package.json'));

    expect(existsSync(join(ROOT_DIR, 'patches', `expo-notifications+${version}.patch`))).toBe(true);
  });

  it('通知権限の取得は呼び出し元キューで完了ハンドラを待たない(iOS 27でExpoの共通キューがデッドロックするため)', () => {
    const source = readFileSync(NOTIFICATIONS_REQUESTER_PATH, 'utf8');
    const getPermissionsBody = source.slice(
      source.indexOf('public func getPermissions()'),
      source.indexOf('private func getPermissionsAsync()'),
    );

    expect(getPermissionsBody).toContain('Task.detached');
    expect(getPermissionsBody).not.toContain('getNotificationSettings {');
  });
});
