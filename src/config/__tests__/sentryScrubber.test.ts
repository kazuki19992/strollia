import { scrubSentryEventLocationData } from '../sentryScrubber';

describe('Sentryイベントの位置情報マスク', () => {
  it('ネストした位置情報フィールドを送信前に伏せる', () => {
    const event = {
      message: 'location update failed',
      contexts: {
        current: {
          coords: {
            latitude: 35.681236,
            longitude: 139.767125,
            accuracy: 8,
          },
        },
      },
      extra: {
        route: [
          { latitude: 35.681236, longitude: 139.767125 },
          { latitude: 35.682, longitude: 139.768 },
        ],
      },
    };

    expect(scrubSentryEventLocationData(event)).toEqual({
      message: 'location update failed',
      contexts: {
        current: {
          coords: '[Filtered]',
        },
      },
      extra: {
        route: [
          { latitude: '[Filtered]', longitude: '[Filtered]' },
          { latitude: '[Filtered]', longitude: '[Filtered]' },
        ],
      },
    });
  });

  it('位置情報ではないイベント情報は維持する', () => {
    const event = {
      message: 'purchase failed',
      level: 'error',
      extra: {
        plan: 'yearly',
        price: '300',
      },
    };

    expect(scrubSentryEventLocationData(event)).toEqual(event);
  });
});
