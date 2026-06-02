const { patchFmtPodspecContents } = require("../withFmtCxx17");

describe("withFmtCxx17", () => {
  test("fmt podspec の C++ 標準だけ c++17 に固定する", () => {
    const podspec = `
Pod::Spec.new do |spec|
  spec.name = "fmt"
  spec.pod_target_xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => rct_cxx_language_standard(),
    "GCC_WARN_INHIBIT_ALL_WARNINGS" => "YES"
  }
end
`;

    expect(patchFmtPodspecContents(podspec)).toContain(
      '"CLANG_CXX_LANGUAGE_STANDARD" => "c++17"',
    );
  });

  test("すでに補正済みの fmt podspec は二重に変更しない", () => {
    const podspec = `
Pod::Spec.new do |spec|
  spec.name = "fmt"
  spec.pod_target_xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++17",
    "GCC_WARN_INHIBIT_ALL_WARNINGS" => "YES"
  }
end
`;

    expect(patchFmtPodspecContents(podspec)).toBe(podspec);
  });
});
