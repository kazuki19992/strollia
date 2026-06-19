import * as Location from 'expo-location';

import {
  BACKGROUND_LOCATION_TASK_NAME,
  getLocationTaskOptions,
  hasCurrentLocationTaskOptions,
  LOCATION_MAX_ACCURACY_METERS,
  LOCATION_MIN_SAVE_DISTANCE_METERS,
  LOCATION_UPDATE_DISTANCE_METERS,
  LOCATION_UPDATE_INTERVAL_MS,
} from '../locationTrackingConfig';

describe('位置情報追跡設定', () => {
  it('安定したバックグラウンドタスク名を使う', () => {
    expect(BACKGROUND_LOCATION_TASK_NAME).toBe('strollia-background-location-task');
  });

  it('10秒間隔と距離条件を位置情報更新の目安にする', () => {
    const options = getLocationTaskOptions();

    expect(LOCATION_UPDATE_INTERVAL_MS).toBe(10000);
    expect(options.timeInterval).toBe(10000);
    expect(options.accuracy).toBe(Location.Accuracy.High);
    expect(LOCATION_UPDATE_DISTANCE_METERS).toBe(5);
    expect(LOCATION_MAX_ACCURACY_METERS).toBe(50);
    expect(LOCATION_MIN_SAVE_DISTANCE_METERS).toBe(5);
    expect(options.distanceInterval).toBe(5);
    expect(options.deferredUpdatesInterval).toBe(10000);
    expect(options.foregroundService?.notificationTitle).toBe('すとろりあで記録中');
  });

  it('記録中はshowsBackgroundLocationIndicator=falseを維持する(trueだとDynamic Island等にOSインジケータが再表示される回帰)', () => {
    const options = getLocationTaskOptions();

    expect(options.showsBackgroundLocationIndicator).toBe(false);
  });

  it('Strolliaが管理する登録済みオプションがすべて一致すると最新と判定する', () => {
    expect(hasCurrentLocationTaskOptions(getLocationTaskOptions())).toBe(true);
  });

  it('Dynamic Island表示設定が古いと最新ではないと判定する', () => {
    expect(hasCurrentLocationTaskOptions({
      ...getLocationTaskOptions(),
      showsBackgroundLocationIndicator: true,
    })).toBe(false);
  });

  it('監視間隔またはforeground service設定が異なると最新ではないと判定する', () => {
    expect(hasCurrentLocationTaskOptions({
      ...getLocationTaskOptions(),
      distanceInterval: 100,
    })).toBe(false);
    expect(hasCurrentLocationTaskOptions({
      ...getLocationTaskOptions(),
      foregroundService: {
        ...getLocationTaskOptions().foregroundService!,
        notificationBody: '古い通知文言',
      },
    })).toBe(false);
  });

  it('Strolliaが管理しない余分なプロパティは一致判定へ影響しない', () => {
    expect(hasCurrentLocationTaskOptions({
      ...getLocationTaskOptions(),
      deferredUpdatesDistance: 0,
    })).toBe(true);
  });

  it('監視設定の項目を追加した場合に一致判定の更新漏れを検知できる', () => {
    const options = getLocationTaskOptions();

    expect(Object.keys(options).sort()).toEqual([
      'accuracy',
      'deferredUpdatesInterval',
      'distanceInterval',
      'foregroundService',
      'pausesUpdatesAutomatically',
      'showsBackgroundLocationIndicator',
      'timeInterval',
    ]);
    expect(Object.keys(options.foregroundService ?? {}).sort()).toEqual([
      'killServiceOnDestroy',
      'notificationBody',
      'notificationColor',
      'notificationTitle',
    ]);
  });
});
