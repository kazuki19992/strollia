const fs = require("fs");
const path = require("path");
const { createRunOncePlugin, withDangerousMod } = require("expo/config-plugins");

const PLUGIN_NAME = "with-fmt-cxx17";
const PODSPEC_RELATIVE_PATH = path.join(
  "node_modules",
  "react-native",
  "third-party-podspecs",
  "fmt.podspec",
);
const FMT_CXX_STANDARD_PATTERN =
  '"CLANG_CXX_LANGUAGE_STANDARD" => rct_cxx_language_standard()';
const FMT_CXX_STANDARD_REPLACEMENT = '"CLANG_CXX_LANGUAGE_STANDARD" => "c++17"';

/**
 * React Native 0.81's fmt pod inherits c++20, which fails to compile with
 * Xcode 26-era consteval checks. Keep this override scoped to fmt only.
 */
function patchFmtPodspecContents(contents) {
  if (contents.includes(FMT_CXX_STANDARD_REPLACEMENT)) {
    return contents;
  }

  if (!contents.includes(FMT_CXX_STANDARD_PATTERN)) {
    throw new Error(
      `${PLUGIN_NAME}: expected fmt C++ standard setting was not found`,
    );
  }

  return contents.replace(
    FMT_CXX_STANDARD_PATTERN,
    FMT_CXX_STANDARD_REPLACEMENT,
  );
}

/**
 * Patches the installed React Native fmt podspec during Expo prebuild.
 */
function withFmtCxx17(config) {
  return withDangerousMod(config, [
    "ios",
    (modConfig) => {
      const podspecPath = path.join(
        modConfig.modRequest.projectRoot,
        PODSPEC_RELATIVE_PATH,
      );
      const contents = fs.readFileSync(podspecPath, "utf8");
      const patchedContents = patchFmtPodspecContents(contents);

      if (patchedContents !== contents) {
        fs.writeFileSync(podspecPath, patchedContents);
      }

      return modConfig;
    },
  ]);
}

module.exports = createRunOncePlugin(withFmtCxx17, PLUGIN_NAME, "1.0.0");
module.exports.patchFmtPodspecContents = patchFmtPodspecContents;
