import * as Sentry from '@sentry/react-native';
import type { ErrorEvent } from '@sentry/core';

import { scrubSentryEventLocationData } from './sentryScrubber';

const SENTRY_DSN = 'https://c74942d776de099ad82e73ef400d0525@o4511573900132352.ingest.us.sentry.io/4511573917106176';
const INVESTIGATED_ERROR_TAG = 'strollia_investigated_error';

let isSentryInitialized = false;

export type InvestigatedErrorContext = {
  area: string;
  context?: Record<string, unknown>;
  screenName?: string;
  tags?: Record<string, string>;
};

/**
 * 調査対象として明示されたイベントだけをSentryへ送信する。
 *
 * GPSログ本体や座標値は送らない方針のため、送信直前に位置情報らしいフィールドをマスクする。
 */
export function filterSentryEventForInvestigatedError(event: ErrorEvent): ErrorEvent | null {
  if (event.tags?.[INVESTIGATED_ERROR_TAG] !== 'true') {
    return null;
  }

  return scrubSentryEventLocationData(event);
}

/**
 * Sentry SDKを初期化する。
 *
 * 無料枠を守るため、自動捕捉されたイベントは `beforeSend` で破棄し、
 * `reportInvestigatedError` から送る例外だけを送信対象にする。
 */
export function initializeSentry(): void {
  if (isSentryInitialized) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    enableAppHangTracking: false,
    enableAutoPerformanceTracing: false,
    enableAutoSessionTracking: false,
    enableCaptureFailedRequests: false,
    enableNativeCrashHandling: false,
    enableWatchdogTerminationTracking: false,
    sendDefaultPii: false,
    beforeSend(event) {
      return filterSentryEventForInvestigatedError(event);
    },
  });
  isSentryInitialized = true;
}

/**
 * 調査したい例外だけをSentryへ送る。
 */
export function reportInvestigatedError(error: unknown, options: InvestigatedErrorContext): void {
  Sentry.withScope((scope) => {
    scope.setTag(INVESTIGATED_ERROR_TAG, 'true');
    scope.setTag('investigation_area', options.area);

    if (options.screenName) {
      scope.setTag('screen', options.screenName);
    }

    Object.entries(options.tags ?? {}).forEach(([key, value]) => {
      scope.setTag(key, value);
    });

    if (options.context) {
      scope.setContext('investigation', options.context);
    }

    Sentry.captureException(error);
  });
}

export const wrapWithSentry = Sentry.wrap;
