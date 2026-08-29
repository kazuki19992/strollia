#!/usr/bin/env bash
set -euo pipefail

# iOS preview(内部配布)ビルドをローカルで作成する。
#
# 使い方:
#   ./scripts/build-preview-ios.sh
#
# 前提:
#   - .env.local に EXPO_PUBLIC_REVENUECAT_IOS_API_KEY が設定されている
#   - eas-cli がインストールされ、`eas` コマンドとして PATH から実行できる
#   - Ad Hoc 配布用のプロビジョニングプロファイルが EAS に登録されている
#   - macOS 専用(BSD の `stat -f` を使用)。Linux では成果物検出に失敗する
#
# production ビルドと提出は ./scripts/build-and-submit-ios.sh を使う。
# Android の preview は ./scripts/build-and-install-android.sh preview を使う。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_LOCAL="${REPO_ROOT}/.env.local"
BUILDS_DIR="${REPO_ROOT}/builds"

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

EXPO_PUBLIC_REVENUECAT_IOS_API_KEY="$(read_env_value EXPO_PUBLIC_REVENUECAT_IOS_API_KEY)"

if [[ -z "${EXPO_PUBLIC_REVENUECAT_IOS_API_KEY}" ]]; then
  echo "エラー: .env.local に EXPO_PUBLIC_REVENUECAT_IOS_API_KEY が設定されていません。" >&2
  exit 1
fi

export EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
# preview は本番相当の動作を検証するためのビルドなので、開発用フラグは明示的に無効化する。
# .env.local に有効な値が残っていても preview ビルドへ持ち込まない(build-preview スキルの注意点)
export EXPO_PUBLIC_ENABLE_PREMIUM_ACCESS_WITHOUT_REVENUECAT=false
export EXPO_PUBLIC_RESET_ACHIEVEMENTS_ON_LAUNCH=false
export EAS_LOCAL_BUILD_ARTIFACTS_DIR="${BUILDS_DIR}"

# 写真走査コストの計測フラグ(一時)。Phase 2-c の設計に使う実測値を実機で取るためのもので、
# 上の2つと違い .env.local の値をそのままビルドへ渡す。未設定なら既定の挙動(計測表示なし・上限なしの全件走査)。
# 計測が終わったらこのブロックごと削除する。詳細は docs/photo-geotag.md を参照
PHOTO_SCAN_METRICS_FLAG="$(read_env_value EXPO_PUBLIC_LOG_PHOTO_SCAN_METRICS)"
if [[ -n "${PHOTO_SCAN_METRICS_FLAG}" ]]; then
  export EXPO_PUBLIC_LOG_PHOTO_SCAN_METRICS="${PHOTO_SCAN_METRICS_FLAG}"
  echo "計測フラグ: EXPO_PUBLIC_LOG_PHOTO_SCAN_METRICS=${PHOTO_SCAN_METRICS_FLAG}"
fi

PHOTO_SCAN_LIMIT="$(read_env_value EXPO_PUBLIC_PHOTO_SCAN_LIMIT)"
if [[ -n "${PHOTO_SCAN_LIMIT}" ]]; then
  export EXPO_PUBLIC_PHOTO_SCAN_LIMIT="${PHOTO_SCAN_LIMIT}"
  echo "走査上限: EXPO_PUBLIC_PHOTO_SCAN_LIMIT=${PHOTO_SCAN_LIMIT}"
fi

# preview は eas.json で SENTRY_DISABLE_AUTO_UPLOAD=true のためソースマップを送らず、
# SENTRY_AUTH_TOKEN は必須ではない。設定されている場合だけ渡す。
SENTRY_AUTH_TOKEN="$(read_env_value SENTRY_AUTH_TOKEN)"
if [[ -n "${SENTRY_AUTH_TOKEN}" ]]; then
  export SENTRY_AUTH_TOKEN
fi

if ! command -v eas >/dev/null 2>&1; then
  echo "エラー: eas コマンドが見つかりません。eas-cli をインストールしてください(npm install -g eas-cli 等)。" >&2
  exit 1
fi

mkdir -p "${BUILDS_DIR}"

echo "=== iOS preview ビルド（ローカル）を開始します ==="
echo "成果物の出力先: ${BUILDS_DIR}"

# eas-cli は実行時の作業ディレクトリから eas.json と package.json を解決する。
# リポジトリ外から絶対パスで起動された場合に設定を解決できない(または別プロジェクトを
# 対象にする)ことがあるため、リポジトリ直下へ移動してから実行する
cd "${REPO_ROOT}"

eas build \
  --platform ios \
  --profile preview \
  --local \
  --non-interactive

# ビルドで生成された最新の .ipa を特定する（macOS の stat で更新時刻順にソート）
LATEST_IPA="$(find "${BUILDS_DIR}" -maxdepth 1 -name '*.ipa' -print0 2>/dev/null \
  | xargs -0 stat -f '%m %N' 2>/dev/null \
  | sort -rn | head -1 | cut -d' ' -f2-)"

if [[ -z "${LATEST_IPA}" ]]; then
  echo "エラー: ${BUILDS_DIR} に .ipa ファイルが見つかりません。" >&2
  exit 1
fi

echo ""
echo "=== 完了 ==="
echo "成果物: ${LATEST_IPA}"
echo ""
echo "実機へインストールするには、Apple Configurator や Xcode の Devices and Simulators から"
echo "上記の .ipa を転送してください（preview は内部配布のため App Store Connect へは提出しません）。"
