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

  test("fmt podspec に対象の C++ 設定がない場合は理由が分かる例外を投げる", () => {
    const podspec = `
Pod::Spec.new do |spec|
  spec.name = "fmt"
  spec.pod_target_xcconfig = {
    "GCC_WARN_INHIBIT_ALL_WARNINGS" => "YES"
  }
end
`;

    expect(() => patchFmtPodspecContents(podspec)).toThrow(
      "with-fmt-cxx17: expected fmt C++ standard setting was not found",
    );
  });
});
