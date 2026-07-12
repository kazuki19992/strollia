import type * as Location from 'expo-location';

/**
 * GPXインポート中の位置情報書き込みを一時停止するためのモジュール状態。
 *
 * インポートはチャンク分割していても書き込みロックを頻繁に取得するため、
 * バックグラウンドGPS記録の書き込みと競合すると SQLITE_BUSY(database is locked)が
 * 発生しうる。インポート中はDBへ書かず受信した位置情報をメモリへ退避し、
 * インポート完了後にまとめて通常の保存規則で取り込むことで競合を根本的に避ける。
 *
 * バックグラウンドタスクとフォアグラウンド監視は同一のJSランタイムで動くため、
 * モジュールスコープの状態で両方の経路を制御できる。
 */
let isImportPriorityActive = false;

/** インポート中に受信した位置情報のバッファ(受信順)。 */
let bufferedLocations: Location.LocationObject[] = [];

/** GPXインポート優先モードが有効か(有効中は位置情報をバッファへ退避する)。 */
export function isGpxImportPriorityActive(): boolean {
  return isImportPriorityActive;
}

/** GPXインポート優先モードを開始する。以後の位置情報はDBへ書かずバッファへ退避する。 */
export function beginGpxImportPriority(): void {
  isImportPriorityActive = true;
}

/** インポート中に受信した位置情報をバッファへ退避する。 */
export function bufferLocationsDuringGpxImport(locations: Location.LocationObject[]): void {
  bufferedLocations.push(...locations);
}

/**
 * GPXインポート優先モードを終了し、退避していた位置情報を取り出す。
 * 呼び出し後はバッファが空になり、以後の位置情報は通常どおりDBへ書き込まれる。
 */
export function endGpxImportPriorityAndDrain(): Location.LocationObject[] {
  isImportPriorityActive = false;
  const drained = bufferedLocations;
  bufferedLocations = [];
  return drained;
}

/**
 * 取り出し済みの位置情報をバッファの先頭へ戻す。
 * flush(取り込み)が失敗した場合に位置情報を失わないための復元経路。
 * 戻した分は次の位置情報受信時に受信順を保ってまとめて処理される。
 */
export function requeueLocationsToBuffer(locations: Location.LocationObject[]): void {
  bufferedLocations = [...locations, ...bufferedLocations];
}

/**
 * バッファに残っている位置情報を取り出す(優先モードの状態は変更しない)。
 * flush失敗後の残留分を、次の通常記録時に回収するために使う。
 */
export function drainBufferedLocations(): Location.LocationObject[] {
  const drained = bufferedLocations;
  bufferedLocations = [];
  return drained;
}

/** テスト用: モジュール状態を初期化する。 */
export function resetGpxImportPriorityForTest(): void {
  isImportPriorityActive = false;
  bufferedLocations = [];
}
