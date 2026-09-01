import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PROJECT_ROOT = resolve(__dirname, '../../..');
const EXPECTED_PHOTO_LIBRARY_DESCRIPTION =
  'すとろりあは、ジオタグ付き写真を地図上に表示したり、現在地アイコンに使用する画像を選択したりするために写真ライブラリを読み取ります。';
const EXPECTED_MOTION_DESCRIPTION = 'すとろりあは、移動ルートを記録する際に端末の移動状態を利用する場合があります。';

/** AndroidManifest.xmlから指定した権限のuses-permissionタグを抽出する。 */
function findAndroidPermissionTags(manifest: string, permission: string): string[] {
  return [...manifest.matchAll(/<uses-permission\b[^>]*\/?\s*>/g)]
    .map(([tag]) => tag)
    .filter((tag) => tag.includes(`android:name="${permission}"`));
}

/** AndroidManifest.xmlで権限が有効なuses-permissionとして生成されていることを検証する。 */
function expectAndroidPermissionEnabled(manifest: string, permission: string): void {
  const tags = findAndroidPermissionTags(manifest, permission);
  expect(tags.some((tag) => !tag.includes('tools:node="remove"'))).toBe(true);
}

/** AndroidManifest.xmlで権限が未生成または明示削除されていることを検証する。 */
function expectAndroidPermissionProhibited(manifest: string, permission: string): void {
  const tags = findAndroidPermissionTags(manifest, permission);
  expect(tags.every((tag) => tag.includes('tools:node="remove"'))).toBe(true);
}

describe('Expo prebuild後のネイティブ権限', () => {
  let temporaryProjectPath: string;
  let infoPlist: string;
  let androidManifest: string;

  beforeAll(() => {
    temporaryProjectPath = mkdtempSync(join(tmpdir(), 'strollia-permissions-prebuild-'));
    copyFileSync(join(PROJECT_ROOT, 'app.json'), join(temporaryProjectPath, 'app.json'));
    copyFileSync(join(PROJECT_ROOT, 'package.json'), join(temporaryProjectPath, 'package.json'));
    symlinkSync(join(PROJECT_ROOT, 'assets'), join(temporaryProjectPath, 'assets'), 'dir');
    symlinkSync(join(PROJECT_ROOT, 'node_modules'), join(temporaryProjectPath, 'node_modules'), 'dir');

    const expoCliPath = require.resolve('expo/bin/cli');
    execFileSync(process.execPath, [expoCliPath, 'prebuild', '--no-install', '--platform', 'all'], {
      cwd: temporaryProjectPath,
      env: { ...process.env, CI: '1' },
      stdio: 'pipe',
    });

    infoPlist = readFileSync(join(temporaryProjectPath, 'ios', 'app', 'Info.plist'), 'utf8');
    androidManifest = readFileSync(join(temporaryProjectPath, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');
  }, 120_000);

  afterAll(() => {
    rmSync(temporaryProjectPath, { recursive: true, force: true });
  });

  test('iOSでは位置情報・モーション・写真読み取りの用途説明を生成する', () => {
    expect(infoPlist).toContain('<key>NSLocationWhenInUseUsageDescription</key>');
    expect(infoPlist).toContain('<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>');
    expect(infoPlist).toContain('<key>NSLocationAlwaysUsageDescription</key>');
    expect(infoPlist).toContain('<key>NSPhotoLibraryUsageDescription</key>');
    expect(infoPlist).toContain(`<string>${EXPECTED_PHOTO_LIBRARY_DESCRIPTION}</string>`);
    expect(infoPlist).toContain('<key>NSMotionUsageDescription</key>');
    expect(infoPlist).toContain(`<string>${EXPECTED_MOTION_DESCRIPTION}</string>`);

    expect(infoPlist).not.toContain('<key>NSCameraUsageDescription</key>');
    expect(infoPlist).not.toContain('<key>NSMicrophoneUsageDescription</key>');
    expect(infoPlist).not.toContain('<key>NSPhotoLibraryAddUsageDescription</key>');
  });

  test('Androidでは位置情報・写真読み取り・通知だけを許可する', () => {
    for (const permission of [
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_LOCATION',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.ACCESS_MEDIA_LOCATION',
      'android.permission.POST_NOTIFICATIONS',
    ]) {
      expectAndroidPermissionEnabled(androidManifest, permission);
    }

    for (const permission of [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.ACTIVITY_RECOGNITION',
      'com.google.android.gms.permission.ACTIVITY_RECOGNITION',
    ]) {
      expectAndroidPermissionProhibited(androidManifest, permission);
    }
  });
});
