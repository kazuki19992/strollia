import * as Sentry from '@sentry/react-native';

import { scrubSentryEventLocationData } from './sentryScrubber';

const SENTRY_DSN = 'https://c74942d776de099ad82e73ef400d0525@o4511573900132352.ingest.us.sentry.io/4511573917106176';

let isSentryInitialized = false;

/**
 * アプリ全体の例外・クラッシュをSentryへ送信する。
 *
 * GPSログ本体や座標値は送らない方針のため、PII送信を無効化し、送信直前にも位置情報らしい
 * フィールドをマスクする。
 */
export function initializeSentry(): void {
  if (isSentryInitialized) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubSentryEventLocationData(event);
    },
  });
  isSentryInitialized = true;
}

export const wrapWithSentry = Sentry.wrap;
