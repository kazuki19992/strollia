# テストの書き方

テスト方針(何をテストするか)は `AGENTS.md` §2 / §9 を参照。ここでは実装パターンをまとめる。

## 実行と配置

- 実行: `npm test` / watch: `npm run test:watch`
- 設定: `package.json` の `jest`(preset: `jest-expo`)
- 配置: 対象と同じディレクトリの `__tests__/` に `*.test.ts` / `*.test.tsx`
- `describe` / `test` / `it` の説明文は日本語で書く

## 基本方針

- 端末API(GPS取得、ファイル共有、SQLite)そのものではなく、その結果を扱う純粋関数をテストする
- リポジトリのテストは `db` をモジュールモックする(実DBは使わない)
- `clearMocks: true` 相当の運用: `beforeEach(() => { jest.clearAllMocks(); })`
- `react-test-renderer` の直接 import / require は禁止(ESLint で error)。テスト API は下記の RTL を使う
- `@testing-library/react-native` は v14(Expo SDK 58 移行時に更新)。`render` / `renderHook` / `fireEvent` / `act` / `rerender` / `unmount` と `expo-router/testing-library` の `renderRouter` はすべて Promise を返すので、必ず `await` する。`await` し忘れると「overlapping act() calls」で失敗する。詳細は `node_modules/@testing-library/react-native/docs/guides/migration-v14.md`

## リポジトリテストの実例

`src/features/settings/__tests__/settingsRepository.test.ts` のパターン:

```typescript
import { db } from '@/db/database';
import { getStringSetting } from '@/features/settings/settingsRepository';

/** トランザクションrunnerのモック。withExclusiveTransaction のコールバックへ渡す。 */
const mockTxn = {
  runAsync: jest.fn(),
  getFirstAsync: jest.fn(),
};

jest.mock('@/db/database', () => ({
  db: {
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
  },
  // busy_timeout付き排他トランザクション(database.tsのラッパー)。txnランナーを直接渡す
  withExclusiveTransaction: jest.fn(async (callback) => callback(mockTxn)),
}));

describe('設定リポジトリ settingsRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('文字列設定が壊れている場合はfallbackを返す', async () => {
    (db.getFirstAsync as jest.Mock).mockResolvedValue({ value: '{broken' });

    await expect(getStringSetting('sampleSetting', 'default')).resolves.toBe('default');
  });
});
```

## UIコンポーネントテストの実例

`@testing-library/react-native` の `render` + `screen.getByLabelText` / `fireEvent` を使う(実例: `src/ui/components/__tests__/DailyLogsScreen.test.tsx`)。

```typescript
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { DailyLogsScreen } from '@/ui/components/DailyLogsScreen';

jest.mock('@expo/vector-icons', () => ({
  Feather: require('react-native').Text,
}));

describe('日別ログ画面 DailyLogsScreen', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('行を押すと詳細を開く', async () => {
    const onOpen = jest.fn();
    await render(<DailyLogsScreen ... onOpenDailyLogDetail={onOpen} />);

    await fireEvent.press(screen.getByLabelText('5月31日（日）の記録を開く'));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
```

ポイント:

- UI要素の特定は `screen.getByLabelText('...')` を優先する(コンポーネントに `accessibilityLabel` + `accessibilityRole` を付ける規約とセット)
- ボタン押下は `fireEvent.press(element)` を使う。`.props.onPress()` 直接呼び出しは禁止
- `UNSAFE_getByType` / `UNSAFE_getByProps` などの `UNSAFE_` 系クエリは RTL v14 で削除された。標準クエリで特定できない場合だけ、`screen.container.queryAll((node) => ...)` でホスト要素の `type` / `props` を検索し、理由をコメントに記載する
  - 対象はホスト要素(`View` / `Text` などネイティブに描画される要素)だけ。自作コンポーネントの型では検索できない
  - 許容例: `disabled` 値検証(Pressable の `disabled` prop は accessibilityState にマッピングされ props.disabled では検証できない)、`aria-hidden` 画面内の要素検索、モックした地図要素の props 検証
- `await render()` は内部で `act` を流し切るため、`await act(async () => { await render(...) })` は不要
- `fireEvent.press` / `fireEvent.scroll` は既定のネイティブイベントを生成して渡した値とマージするため、ハンドラの引数は `expect.objectContaining` で検証する
- モックが必要な代表モジュール: `@expo/vector-icons`, `react-native-maps`, DBリポジトリ関数

## フックテストの実例

`@testing-library/react-native` の `renderHook` を使う(実例: `src/ui/hooks/__tests__/useAnimatedBooleanOpacity.test.tsx`)。

```typescript
import { act, renderHook } from '@testing-library/react-native';
import { useAnimatedBooleanOpacity } from '@/ui/hooks/useAnimatedBooleanOpacity';

describe('真偽値フェードhook useAnimatedBooleanOpacity', () => {
  it('visible=trueの場合は初期値1で開始する', async () => {
    const { result } = await renderHook(() => useAnimatedBooleanOpacity(true, 500));

    expect(result.current.__getValue()).toBe(1);
  });

  it('props変更による再レンダーは rerender で検証する', async () => {
    const { rerender } = await renderHook(({ visible }: { visible: boolean }) => useAnimatedBooleanOpacity(visible, 250), {
      initialProps: { visible: false },
    });

    await rerender({ visible: true });

    // rerender 後の状態を result.current で検証する
  });
});
```

ポイント:

- フック戻り値は `result.current` で参照する
- props 変更は `await rerender(newProps)` で行う
- 副作用の非同期 flush は `await act(async () => { ... })` で包む

## ルーター統合テストの実例

`expo-router/testing-library` の `renderRouter` を使う(実例: `src/ui/__tests__/AppMapReturn.test.tsx`)。

```typescript
import { act, cleanup, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AppState } from 'react-native';

jest.mock('@/config/sentry', () => ({
  wrapWithSentry: (component: unknown) => component,
  updateSentryScreenContext: jest.fn(),
  updateSentrySubscriptionContext: jest.fn(),
  updateSentryUserContext: jest.fn(),
}));

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View, Marker: View, Polygon: View, Polyline: View };
});

jest.mock('@/features/settings/settingsRepository', () => ({
  getBooleanSetting: jest.fn().mockResolvedValue(false),
  setSetting: jest.fn().mockResolvedValue(undefined),
  setSettings: jest.fn().mockResolvedValue(undefined),
}));

/** マイクロタスクを繰り返し流し切って非同期 state の反映を待つ。 */
const flushPromises = async () => {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) {
      await Promise.resolve();
    }
  });
};

describe('App 地図復帰時の表示範囲復元', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active', writable: true });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  test('別画面から地図へ戻ると現在地中心へ復元する', async () => {
    await renderRouter('src/app');
    await flushPromises();

    // accessibilityLabel でUI要素を特定し、fireEvent.press でボタンを押す
    await fireEvent.press(screen.getByLabelText('日ごとの記録'));
    await fireEvent.press(screen.getByLabelText('地図へ'));
    await flushPromises();

    expect(mockAnimateToRegion).toHaveBeenCalled();
  });
});
```

ポイント:

- `renderRouter('src/app')` でルート定義ごとレンダリングする。個別コンポーネントではなくルーター全体をテストする
- `renderRouter` / `fireEvent` は `await` する。それ以外の状態更新は `await act()` で包む
- UI要素は `screen.getByLabelText('...')` を優先し、`fireEvent.press` でボタンを押す
- テスト終了後は `cleanup()` と `jest.restoreAllMocks()` を `afterEach` で呼ぶ
- `wrapWithSentry` は `(component) => component` でラップを外すモックが必要
- モックが必要な代表モジュール: `@/config/sentry`(wrapWithSentry), `expo-haptics`, `expo-location`, `expo-notifications`, `react-native-maps`, `react-native-purchases`, DBリポジトリ関数
- 画面遷移後に前画面の要素を検証する場合は `aria-hidden` の影響で `getByLabelText` が失敗することがある。その場合だけ `screen.container.queryAll` でホスト要素を検索し理由をコメントする

## テストを書けない場合

理由を明記し、代替の検証方法(手動確認手順など)を提示する(AGENTS.md §2)。
