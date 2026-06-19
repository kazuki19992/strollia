# Issue #89 バックグラウンド位置情報タスク更新デザイン

## 目的

Issue #89「バックグラウンドで位置情報が記録されない。フォアグラウンドでも不安定」で発生した位置情報記録の回帰を修正する。

既存ユーザーへ `showsBackgroundLocationIndicator: false` を反映し、Dynamic Islandやステータスバーの位置情報インジケータを非表示にする。一方で、設定反映のために記録中タスクを `stop→start` して位置更新を中断してはならない。

既存タスクの設定が最新なら何もせず、古い場合だけExpo TaskManagerの同名タスク更新を利用する。これにより、タスクの重複作成と起動ごとの不要な位置監視再設定を避ける。

## 調査結果

対象バージョンは `expo-location 19.0.8` と `expo-task-manager 14.0.9` である。

`Location.startLocationUpdatesAsync` は、iOS・AndroidともにTaskManagerのタスク登録処理へ委譲する。登録先は配列ではなく、アプリ識別子とタスク名をキーにした辞書である。

- iOSは同じタスク名かつ同じconsumerのタスクが存在すると、タスクを新規作成せず `setOptions` で既存タスクを更新する
- Androidも同じ条件で既存タスクの `setOptions` を呼び、新規タスクを追加しない
- 永続化されたタスク設定もタスク名をキーに上書きされる
- Strolliaは固定の `strollia-background-location-task` を使用するため、同名の `startLocationUpdatesAsync` を繰り返してもタスク数は増えない

ただし、Androidのlocation consumerは `setOptions` で内部の位置更新要求を再起動する。タスク自体は1つのままだが、毎回の起動で設定を上書きする必要はない。現在設定を先に比較し、不一致の場合だけ更新する。

現在の `refreshBackgroundLocationTaskRegistration` は、記録中タスクに対して明示的に `stopLocationUpdatesAsync` を呼んだ後、`startLocationUpdatesAsync` を呼んでいる。この処理は登録タスクと位置監視を一度解除するため、位置情報によるバックグラウンド起動を含むApp初期化と競合し、記録欠落を起こし得る。

## スコープ

含めるもの:

- 登録済み位置情報タスクの現在オプション取得
- 現在オプションと `getLocationTaskOptions()` の比較
- 古い設定の場合だけ、同名タスクへ最新オプションを上書き
- 設定更新経路から `stopLocationUpdatesAsync` を削除
- 現在設定が最新の場合は `startLocationUpdatesAsync` も呼ばない
- Dynamic Island非表示設定を維持
- 回帰テストとバックグラウンド記録方針のドキュメント更新

含めないもの:

- GPS保存間隔、要求精度、距離閾値の変更
- GPSポイントやVisited Gridの保存判定変更
- DBスキーマ変更
- 位置情報権限フローの変更
- OSによる位置情報更新の間引きへの対策
- Dynamic Island非表示設定の撤回

## 修正方針

### 最新オプションの判定

`TaskManager.getTaskOptionsAsync` で `strollia-background-location-task` の登録済みオプションを取得する。

取得結果と `getLocationTaskOptions()` について、Strolliaが指定する以下の値を比較する。

- `accuracy`
- `timeInterval`
- `distanceInterval`
- `deferredUpdatesInterval`
- `pausesUpdatesAutomatically`
- `showsBackgroundLocationIndicator`
- `foregroundService.notificationTitle`
- `foregroundService.notificationBody`
- `foregroundService.notificationColor`
- `foregroundService.killServiceOnDestroy`

現在値に余分なOS・Expo由来プロパティが含まれていても、それだけでは更新対象にしない。Strolliaが管理する値が一致しているかを明示的に判定する。

オプション比較は副作用のない関数として `locationTrackingConfig.ts` に置く。将来 `getLocationTaskOptions()` に管理対象の設定を追加するときは、比較関数とテストも同時に更新する。

### 登録済みタスクの更新

起動時の更新処理は以下の順序にする。

1. TaskManagerが利用可能か確認する
2. バックグラウンド位置情報タスクが開始済みか確認する
3. 未開始なら何もしない。既存の自動開始処理へ任せる
4. 登録済みオプションを取得する
5. 最新オプションと一致していれば何もしない
6. 不一致なら `Location.startLocationUpdatesAsync` を同じタスク名と最新オプションで呼ぶ

`Location.stopLocationUpdatesAsync` は呼ばない。

同名・同consumerへの `startLocationUpdatesAsync` はExpo TaskManager内で既存タスクのオプション更新になる。新しいタスクを追加しない。更新後のオプションは同じタスク名で永続化されるため、次回起動時は一致判定で処理を終了する。

関数名は、解除と再登録を意味する `refreshBackgroundLocationTaskRegistration` から、実際の責務が分かる `updateBackgroundLocationTaskOptionsIfNeeded` へ変更する。

### 未登録タスク

タスクが未開始の場合、設定更新処理は新規開始しない。

App初期化後の既存フローが権限状態と記録状態を確認し、必要な場合だけ `startBackgroundLocationRecording` で自動開始する。新規開始時は最初から `getLocationTaskOptions()` の最新設定が渡る。

## 期待する動作

### 更新前から記録中の既存ユーザー

登録済み設定の `showsBackgroundLocationIndicator` が `true` または未設定なら、次回の通常起動時に同名タスクへ最新設定を一度だけ上書きする。

- タスク数は1つのまま
- 明示的な停止は発生しない
- `showsBackgroundLocationIndicator: false` が永続化される
- 次回以降の起動では設定一致により `startLocationUpdatesAsync` を呼ばない

### すでに最新設定のユーザー

登録済み設定が最新なら、位置情報タスクに対して `start` も `stop` も行わない。記録中のタスクをそのまま維持する。

### タスク未開始のユーザー

設定更新処理では何もしない。位置情報権限が揃っていれば既存の自動開始処理が最新設定でタスクを開始する。

### 権限不足のユーザー

「常に許可」がないiOSユーザーはバックグラウンド記録の対象外である。既存の権限案内と「アプリ起動中のみ記録」表示を維持し、このPRでは権限仕様を変更しない。

## エラー処理

TaskManagerが利用できない場合とタスク未開始の場合は正常な非更新として終了する。

オプション取得または更新が失敗した場合は、App初期化側の既存catchで警告を記録し、その後の状態再取得と自動開始判定へ進む。更新前にタスクを停止しないため、更新失敗だけで既存の記録タスクを解除することはない。

## テスト方針

テスト名は日本語で記載する。

`locationTrackingConfig.test.ts` に以下を追加する。

- Strollia管理対象のオプションがすべて一致すれば最新と判定する
- `showsBackgroundLocationIndicator` が古ければ不一致と判定する
- 監視間隔やforeground service設定が異なれば不一致と判定する
- 管理対象外の余分なプロパティは判定へ影響しない

位置情報タスク更新のテストを以下へ変更する。

- 記録中かつ設定が古い場合、同名タスクへ最新設定を1回だけ渡す
- 設定更新時に `stopLocationUpdatesAsync` を呼ばない
- 記録中かつ設定が最新の場合、`start` と `stop` のどちらも呼ばない
- タスク未開始の場合、オプション取得・`start`・`stop` を呼ばない
- TaskManagerが利用できない場合、タスク状態確認以降の処理を呼ばない

Expoネイティブ内部のタスク辞書実装自体はStrolliaの単体テスト対象にしない。Strollia側では固定タスク名を使い、停止せず、必要な場合だけ同名 `start` を1回呼ぶ契約を検証する。

## ドキュメント更新

`docs/architecture.md` のバックグラウンド記録方針へ以下を追記する。

- 既存タスクのオプション更新は現在値と最新値が異なる場合だけ行う
- 更新には同名タスクのupsertを使用し、記録中タスクを停止しない
- タスク設定が最新なら起動時に位置監視を再設定しない

## 検証

実装後に以下を実行する。

```text
npm test -- --runInBand src/features/location/__tests__/locationTrackingConfig.test.ts src/features/location/__tests__/refreshBackgroundLocationTaskRegistration.test.ts
npm run typecheck
npm test -- --runInBand
```

自動テストに加え、実機確認では以下を確認する。

- 旧設定から更新後、Dynamic Islandまたはステータスバーの位置情報インジケータが残らない
- 更新後もバックグラウンド歩行のVisited GridとGPSログが連続して記録される
- アプリを複数回起動しても登録済み位置情報タスクが1件のままである

## 非対象と制約

iOS・Androidは位置情報更新頻度をOS判断で調整するため、10秒ごとのコールバックを保証しない。本修正はStrollia自身がタスクを解除する回帰を取り除くものであり、OSによる正規の間引きまで無効化するものではない。
