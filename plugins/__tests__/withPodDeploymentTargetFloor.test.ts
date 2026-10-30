/** config plugin はNodeから直接読み込むためCommonJSで書いており、型定義を持たないので必要な関数だけ型付けして取り出す。 */
const { applyPodDeploymentTargetFloor, POD_DEPLOYMENT_TARGET_FLOOR_TAG } = require('../withPodDeploymentTargetFloor') as {
  applyPodDeploymentTargetFloor: (podfileContents: string) => string;
  POD_DEPLOYMENT_TARGET_FLOOR_TAG: string;
};

/** Expo SDK 57のprebuildが生成するPodfileのpost_install部分を模したもの。 */
const GENERATED_PODFILE = `podfile_properties = JSON.parse(File.read(File.join(__dir__, 'Podfile.properties.json'))) rescue {}

platform :ios, podfile_properties['ios.deploymentTarget'] || '15.1'

target 'app' do
  use_expo_modules!

  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
  end
end
`;

/** post_install ブロックの中身(開始行から閉じる end まで)を取り出す。 */
function extractPostInstallBlock(podfile: string): string {
  const start = podfile.indexOf('post_install do |installer|');
  const end = podfile.indexOf('\n  end\n', start);
  return podfile.slice(start, end);
}

describe('Podのデプロイメントターゲット下限を揃えるconfig plugin', () => {
  test('リソースバンドルを含む全Podターゲットを下限まで引き上げる処理をpost_install内に追加する', () => {
    const result = applyPodDeploymentTargetFloor(GENERATED_PODFILE);
    const postInstall = extractPostInstallBlock(result);

    expect(postInstall).toContain('installer.pods_project.targets.each');
    expect(postInstall).toContain("build_settings['IPHONEOS_DEPLOYMENT_TARGET']");
    expect(postInstall).toContain(POD_DEPLOYMENT_TARGET_FLOOR_TAG);
  });

  test('下限はアプリ本体のplatform指定と同じ値を使う', () => {
    const postInstall = extractPostInstallBlock(applyPodDeploymentTargetFloor(GENERATED_PODFILE));

    expect(postInstall).toContain("podfile_properties['ios.deploymentTarget'] || '15.1'");
  });

  test('react_native_post_install の後に実行され、RN側の設定で上書きされない', () => {
    const postInstall = extractPostInstallBlock(applyPodDeploymentTargetFloor(GENERATED_PODFILE));

    expect(postInstall.indexOf('react_native_post_install(')).toBeLessThan(postInstall.indexOf('installer.pods_project.targets.each'));
  });

  test('すでに下限以上のターゲットは変更しない条件で書き換える', () => {
    const postInstall = extractPostInstallBlock(applyPodDeploymentTargetFloor(GENERATED_PODFILE));

    expect(postInstall).toContain('Gem::Version.new(current) < Gem::Version.new(minimum)');
  });

  test('複数回適用しても処理は1つだけになる', () => {
    const once = applyPodDeploymentTargetFloor(GENERATED_PODFILE);
    const twice = applyPodDeploymentTargetFloor(once);

    expect(twice).toBe(once);
    expect(twice.split('installer.pods_project.targets.each').length - 1).toBe(1);
  });

  test('post_install が見つからない場合は黙って壊さずエラーにする', () => {
    expect(() => applyPodDeploymentTargetFloor("platform :ios, '15.1'\n")).toThrow('post_install');
  });
});
