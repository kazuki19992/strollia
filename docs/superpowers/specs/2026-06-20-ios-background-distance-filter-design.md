# iOSバックグラウンド位置更新の距離フィルター設計

## 背景

Issue #89の調査で、iOS Simulatorへ移動座標を継続注入しても、アプリをバックグラウンドへ移した約10秒後のTaskManager実行を最後に位置更新が停止し、復帰後も停止中の座標が補完されないことを確認した。

現在のiOS設定は `showsBackgroundLocationIndicator: false` と `distanceInterval: 5` を併用している。Expo LocationのiOS consumerは `startUpdatingLocation()` と `startMonitoringSignificantLocationChanges()` を同じ `CLLocationManager` で開始する。Apple Developer ForumsのApple Engineer回答では、iOS 16.4以降、この構成で継続的な高精度バックグラウンド更新を行う場合、位置情報インジケーターを表示するか、`distanceFilter`を設定しない必要がある。

参考: https://developer.apple.com/forums/thread/726945?answerId=748944022

## 変更方針

iOSでは `showsBackgroundLocationIndicator: false` を維持し、`distanceInterval`を位置情報タスクのoptionsへ含めない。ExpoのiOS実装では未指定時に `CLLocationManager.distanceFilter` が `kCLDistanceFilterNone` になる。

Androidでは従来どおり `distanceInterval: 5` を維持し、foreground serviceの更新頻度や電池消費への影響を避ける。

GPSポイントの保存間隔は `shouldSaveLocationPoint` の5m判定を維持する。iOSでネイティブ更新が増えても、SQLiteへ保存するGPSポイントを無制限に増やさない。Visited Gridは従来どおり受信位置を処理するため、実機検証では処理負荷と電池消費も確認する。

## options一致判定

`getLocationTaskOptions()` がプラットフォーム別の期待値を返し、既存の `hasCurrentLocationTaskOptions()` はその期待値と登録済みoptionsを比較する。

- iOS: `distanceInterval` が未指定なら最新
- Android: `distanceInterval` が5なら最新

これにより、既存iOSユーザーの登録値が5の場合、次回の通常起動時に同名タスクへ距離フィルターなしのoptionsを適用する。明示的なstopは行わない。

## テスト

- iOSでは `distanceInterval` がoptionsに存在しない
- Androidでは `distanceInterval: 5` を維持する
- プラットフォーム別optionsに対する一致判定が正しく動作する
- iOS Simulatorで移動を継続注入し、前景から背景へ移した後もTaskManager実行とGPS記録が継続する
- 最終判断は実機でも同じ移動テストを行う

## 非対象

- Dynamic Island等のバックグラウンド位置情報インジケーターは再表示しない
- GPSポイントの5m保存判定は変更しない
- Androidの距離フィルターは変更しない
