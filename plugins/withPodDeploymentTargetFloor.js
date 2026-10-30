const { withPodfile } = require('expo/config-plugins');

/** 追加したRubyコードを識別し、再適用時に二重挿入しないための目印。 */
const POD_DEPLOYMENT_TARGET_FLOOR_TAG = 'strollia-pod-deployment-target-floor';

const BEGIN_MARKER = `# @generated begin ${POD_DEPLOYMENT_TARGET_FLOOR_TAG}`;
const END_MARKER = `# @generated end ${POD_DEPLOYMENT_TARGET_FLOOR_TAG}`;

/**
 * post_install に差し込むRubyコード。
 *
 * Xcode 27 はiOS 15.0未満のデプロイメントターゲットをエラーにする。
 * react_native_post_install はPod本体のネイティブターゲットしか引き上げないため、
 * Sentry-Sentry や RNSVG-RNSVGFilters のようなリソースバンドル用ターゲットが
 * podspec由来の古い値(9.0〜13.0)のまま残りビルドが失敗する。
 * pods_project.targets はリソースバンドルも含むので、ここで全ターゲットを
 * アプリ本体の platform 指定と同じ下限まで引き上げる。
 */
const FLOOR_SNIPPET = `    ${BEGIN_MARKER}
    minimum = podfile_properties['ios.deploymentTarget'] || '15.1'
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_configuration|
        current = build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || Gem::Version.new(current) < Gem::Version.new(minimum)
          build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = minimum
        end
      end
    end
    ${END_MARKER}
`;

/** 以前に挿入したブロックを取り除く。再適用時に最新の内容で差し替えるため。 */
function removeExistingSnippet(podfileContents) {
  const begin = podfileContents.indexOf(BEGIN_MARKER);
  if (begin === -1) {
    return podfileContents;
  }
  const lineStart = podfileContents.lastIndexOf('\n', begin) + 1;
  const endMarker = podfileContents.indexOf(END_MARKER, begin);
  const lineEnd = podfileContents.indexOf('\n', endMarker) + 1;
  return podfileContents.slice(0, lineStart) + podfileContents.slice(lineEnd);
}

/**
 * Podfileの post_install ブロック末尾(react_native_post_install の後)へ下限引き上げ処理を挿入する。
 * RN側の処理より後に実行し、その設定で上書きされないようにする。
 */
function applyPodDeploymentTargetFloor(podfileContents) {
  const contents = removeExistingSnippet(podfileContents);
  const postInstallStart = contents.indexOf('post_install do |installer|');
  if (postInstallStart === -1) {
    throw new Error('Podfileに post_install ブロックが見つからないため、Podのデプロイメントターゲット下限を設定できません');
  }

  const closingEnd = contents.indexOf('\n  end\n', postInstallStart);
  if (closingEnd === -1) {
    throw new Error('Podfileの post_install ブロックの終端が見つからないため、Podのデプロイメントターゲット下限を設定できません');
  }

  const insertAt = closingEnd + 1;
  return contents.slice(0, insertAt) + FLOOR_SNIPPET + contents.slice(insertAt);
}

/** prebuild時に生成されるPodfileへ、全Podターゲットのデプロイメントターゲット下限を設定する。 */
function withPodDeploymentTargetFloor(config) {
  return withPodfile(config, (podfileConfig) => {
    podfileConfig.modResults.contents = applyPodDeploymentTargetFloor(podfileConfig.modResults.contents);
    return podfileConfig;
  });
}

module.exports = withPodDeploymentTargetFloor;
module.exports.applyPodDeploymentTargetFloor = applyPodDeploymentTargetFloor;
module.exports.POD_DEPLOYMENT_TARGET_FLOOR_TAG = POD_DEPLOYMENT_TARGET_FLOOR_TAG;
