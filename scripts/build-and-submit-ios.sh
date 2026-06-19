#!/usr/bin/env bash
set -euo pipefail

# iOS プロダクションビルドをローカルで作成し、App Store Connect へ提出する。
#
# 使い方:
#   ./scripts/build-and-submit-ios.sh
#
# 前提:
#   - .env.local に SENTRY_AUTH_TOKEN が設定されている
#   - eas-cli がインストールされている（npx 経由で使用）
#   - Apple Developer の認証情報が EAS に登録されている

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_LOCAL="${REPO_ROOT}/.env.local"
BUILDS_DIR="${REPO_ROOT}/builds"

# .env.local から SENTRY_AUTH_TOKEN を読み込む
if [[ ! -f "${ENV_LOCAL}" ]]; then
  echo "エラー: ${ENV_LOCAL} が見つかりません。" >&2
  exit 1
fi

SENTRY_AUTH_TOKEN="$(grep -E '^SENTRY_AUTH_TOKEN=' "${ENV_LOCAL}" | head -1 | cut -d'=' -f2-)"

if [[ -z "${SENTRY_AUTH_TOKEN}" ]]; then
  echo "エラー: .env.local に SENTRY_AUTH_TOKEN が設定されていません。" >&2
  exit 1
fi

export SENTRY_AUTH_TOKEN
export EXPO_PUBLIC_ENABLE_PREMIUM_ACCESS_WITHOUT_REVENUECAT=false
export EXPO_PUBLIC_RESET_ACHIEVEMENTS_ON_LAUNCH=false
export EAS_LOCAL_BUILD_ARTIFACTS_DIR="${BUILDS_DIR}"

mkdir -p "${BUILDS_DIR}"

echo "=== iOS プロダクションビルド（ローカル）を開始します ==="
echo "成果物の出力先: ${BUILDS_DIR}"

npx eas-cli build \
  --platform ios \
  --profile production \
  --local \
  --non-interactive

# ビルドで生成された最新の .ipa を特定する
LATEST_IPA="$(ls -t "${BUILDS_DIR}"/*.ipa 2>/dev/null | head -1)"

if [[ -z "${LATEST_IPA}" ]]; then
  echo "エラー: ${BUILDS_DIR} に .ipa ファイルが見つかりません。" >&2
  exit 1
fi

echo ""
echo "=== App Store Connect へ提出します ==="
echo "対象ファイル: ${LATEST_IPA}"

npx eas-cli submit \
  --platform ios \
  --profile production \
  --path "${LATEST_IPA}" \
  --non-interactive

echo ""
echo "=== 完了 ==="
