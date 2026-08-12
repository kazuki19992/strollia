#!/usr/bin/env bash
set -euo pipefail

# Android ビルドをローカルで作成し、接続中の実機へ adb install する。
#
# 使い方:
#   ./scripts/build-and-install-android.sh [development|preview|production]
#   プロファイルを省略した場合は preview を使用する。
#
# 前提:
#   - .env.local に GOOGLE_MAPS_ANDROID_API_KEY と EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY が設定されている
#     (production プロファイルの場合は SENTRY_AUTH_TOKEN も必要)
#   - eas-cli がインストールされ、`eas` コマンドとして PATH から直接実行できる(npx 経由ではない)
#   - Android SDK (adb) がインストールされ、PATH から実行できる
#   - インストール対象の実機が1台だけ USB 接続され、USBデバッグの許可がされていること
#   - production プロファイルは Android App Bundle (.aab) を生成するため adb install できない。
#     ビルドのみ行い、成果物パスを表示して終了する（ストア提出は publish スキルを使用する）
#   - macOS 専用(BSD の `stat -f` を使用)。Linux では成果物検出に失敗する
#
# 【暫定対応 / issue #141 で解消したら削除】
#   EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY が Test Store キー(test_プレフィックス)のままの間、
#   preview プロファイルは eas build を使わず、ネイティブプロジェクトを直接生成して
#   release buildType を debuggable 化した APK を gradlew でビルドする
#   (RevenueCat が非debuggableビルドでのTest Storeキー使用を強制クラッシュさせるため)。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_LOCAL="${REPO_ROOT}/.env.local"
BUILDS_DIR="${REPO_ROOT}/builds"

PROFILE="${1:-preview}"

case "${PROFILE}" in
  development | preview | production) ;;
  *)
    echo "エラー: 不明なプロファイル '${PROFILE}' です。development, preview, production のいずれかを指定してください。" >&2
    exit 1
    ;;
esac

if [[ ! -f "${ENV_LOCAL}" ]]; then
  echo "エラー: ${ENV_LOCAL} が見つかりません。" >&2
  exit 1
fi

# .env.local から key=value を読み取る。複数行ある場合は後の値を優先する。
# `export KEY=...` 形式・前後の引用符・CRLF改行の `\r` を許容し、値のみを返す。
# キーが存在しない場合、grep は非ゼロ終了するが pipefail 環境下でも
# 呼び出し側のチェックへ処理を進めるため `|| true` で握り潰す。
read_env_value() {
  local key="$1"
  local value
  value="$(grep -E "^(export[[:space:]]+)?${key}=" "${ENV_LOCAL}" | tail -1 | cut -d'=' -f2- || true)"
  # CRLF改行のファイルから読んだ場合に混入する行末の \r を除去する
  value="${value%$'\r'}"
  # 前後を同じ引用符(シングル/ダブル)で囲まれている場合のみ除去する
  if [[ "${value}" =~ ^\".*\"$ ]] || [[ "${value}" =~ ^\'.*\'$ ]]; then
    value="${value:1:$((${#value} - 2))}"
  fi
  printf '%s' "${value}"
}

GOOGLE_MAPS_ANDROID_API_KEY="$(read_env_value GOOGLE_MAPS_ANDROID_API_KEY)"
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY="$(read_env_value EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY)"

if [[ -z "${GOOGLE_MAPS_ANDROID_API_KEY}" ]]; then
  echo "エラー: .env.local に GOOGLE_MAPS_ANDROID_API_KEY が設定されていません。" >&2
  exit 1
fi

if [[ -z "${EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY}" ]]; then
  echo "エラー: .env.local に EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY が設定されていません。" >&2
  exit 1
fi

export GOOGLE_MAPS_ANDROID_API_KEY
export EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
export EXPO_PUBLIC_ENABLE_PREMIUM_ACCESS_WITHOUT_REVENUECAT=false
export EXPO_PUBLIC_RESET_ACHIEVEMENTS_ON_LAUNCH=false
export EAS_LOCAL_BUILD_ARTIFACTS_DIR="${BUILDS_DIR}"

# production は eas.json 上で SENTRY_DISABLE_AUTO_UPLOAD が未設定のため、
# ビルド時に Sentry へソースマップをアップロードする（認証トークンが必要）
if [[ "${PROFILE}" == "production" ]]; then
  SENTRY_AUTH_TOKEN="$(read_env_value SENTRY_AUTH_TOKEN)"
  if [[ -z "${SENTRY_AUTH_TOKEN}" ]]; then
    echo "エラー: .env.local に SENTRY_AUTH_TOKEN が設定されていません（production プロファイルで必要）。" >&2
    exit 1
  fi
  export SENTRY_AUTH_TOKEN
fi

mkdir -p "${BUILDS_DIR}"

echo "=== Android ${PROFILE} ビルド（ローカル）を開始します ==="
echo "成果物の出力先: ${BUILDS_DIR}"

# 【暫定対応 / issue #141 で解消したら削除】
# RevenueCatはTest Storeキー(test_プレフィックス)を非debuggableビルド(release系 = preview/production)で
# 検出すると、ストア誤配信を防ぐ目的で意図的に強制クラッシュする。Android本番RevenueCatキーが
# 未発行の間、previewビルドに限り、eas buildを使わずネイティブプロジェクトを直接生成して
# release buildTypeをdebuggable化し、gradlewで直接ビルドする(署名はAGP既定のdebug鍵を使うため
# EAS資格情報は不要)。本番キーを.env.localに設定すれば、この分岐は自動的に通らなくなる。
if [[ "${PROFILE}" == "preview" && "${EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY}" == test_* ]]; then
  echo ""
  echo "警告: EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY がRevenueCatのTest Storeキーです。"
  echo "previewビルドは release バリアントのため、RevenueCat SDKが意図的に強制クラッシュします(issue #141)。"
  echo "暫定対応として、ネイティブプロジェクトを直接生成し release buildType を debuggable 化してビルドします。"
  echo "本番用RevenueCat Androidキーを .env.local に設定すれば、この暫定対応は不要になります。"

  ANDROID_DIR="${REPO_ROOT}/android"
  # スクリプト終了時(成功/失敗問わず)に必ず android/ を削除し、managed workflow の状態を保つ
  trap 'rm -rf "${ANDROID_DIR}"' EXIT
  rm -rf "${ANDROID_DIR}"

  # eas.json の preview プロファイルと同じビルド用環境変数を合わせる
  export EXPO_PUBLIC_STROLLIA_BUILD_PROFILE=preview
  export SENTRY_DISABLE_AUTO_UPLOAD=true

  npx expo prebuild --platform android --no-install

  BUILD_GRADLE="${ANDROID_DIR}/app/build.gradle"
  if [[ ! -f "${BUILD_GRADLE}" ]]; then
    echo "エラー: ${BUILD_GRADLE} が生成されませんでした。" >&2
    exit 1
  fi

  if ! grep -q "debuggable true" "${BUILD_GRADLE}"; then
    sed -i '' -E 's/(release[[:space:]]*\{)/\1\n            debuggable true/' "${BUILD_GRADLE}"
  fi

  (cd "${ANDROID_DIR}" && ./gradlew :app:assembleRelease)

  BUILT_APK="${ANDROID_DIR}/app/build/outputs/apk/release/app-release.apk"
  if [[ ! -f "${BUILT_APK}" ]]; then
    echo "エラー: ${BUILT_APK} が生成されませんでした。" >&2
    exit 1
  fi

  cp "${BUILT_APK}" "${BUILDS_DIR}/build-android-preview-test-store-workaround-$(date +%s).apk"
else
  if ! command -v eas >/dev/null 2>&1; then
    echo "エラー: eas コマンドが見つかりません。eas-cli をインストールしてください(npm install -g eas-cli 等)。" >&2
    exit 1
  fi

  eas build \
    --platform android \
    --profile "${PROFILE}" \
    --local \
    --non-interactive
fi

# ビルドで生成された最新の .apk / .aab を特定する（macOS の stat で更新時刻順にソート）
LATEST_ARTIFACT="$(find "${BUILDS_DIR}" -maxdepth 1 \( -name '*.apk' -o -name '*.aab' \) -print0 2>/dev/null \
  | xargs -0 stat -f '%m %N' 2>/dev/null \
  | sort -rn | head -1 | cut -d' ' -f2-)"

if [[ -z "${LATEST_ARTIFACT}" ]]; then
  echo "エラー: ${BUILDS_DIR} にビルド成果物（.apk / .aab）が見つかりません。" >&2
  exit 1
fi

echo ""
echo "=== ビルド完了 ==="
echo "成果物: ${LATEST_ARTIFACT}"

# production (store配布) は Android App Bundle になり、adb install できない
if [[ "${LATEST_ARTIFACT}" == *.aab ]]; then
  echo ""
  echo "production プロファイルは Android App Bundle (.aab) のため adb install できません。"
  echo "ストア提出は publish スキルを使用してください。"
  exit 0
fi

if ! command -v adb >/dev/null 2>&1; then
  echo ""
  echo "adb が見つからないため、インストールをスキップします。Android SDK の platform-tools をPATHに追加してください。"
  echo "接続後は以下のコマンドで手動インストールできます:"
  echo "  adb install -r \"${LATEST_ARTIFACT}\""
  exit 0
fi

DEVICE_LIST="$(adb devices | tail -n +2 | grep -w "device" || true)"

if [[ -z "${DEVICE_LIST}" ]]; then
  echo ""
  echo "接続中の実機が見つかりません。インストールをスキップします。"
  echo "USB接続とUSBデバッグの許可を確認したうえで、以下のコマンドで手動インストールできます:"
  echo "  adb install -r \"${LATEST_ARTIFACT}\""
  exit 0
fi

DEVICE_COUNT="$(echo "${DEVICE_LIST}" | wc -l | tr -d ' ')"

if [[ "${DEVICE_COUNT}" -gt 1 ]]; then
  echo "エラー: 複数の実機が接続されています。1台のみ接続した状態で再実行してください。" >&2
  echo "${DEVICE_LIST}" >&2
  exit 1
fi

DEVICE_ID="$(echo "${DEVICE_LIST}" | awk '{print $1}')"

echo ""
echo "=== ${DEVICE_ID} へインストールします ==="
adb -s "${DEVICE_ID}" install -r "${LATEST_ARTIFACT}"

echo ""
echo "=== 完了 ==="
