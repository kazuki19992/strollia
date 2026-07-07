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

## リポジトリテストの実例

`src/features/settings/__tests__/settingsRepository.test.ts` のパターン:

```typescript
import { db } from '@/db/database';
import { getStringSetting } from '@/features/settings/settingsRepository';

jest.mock('@/db/database', () => ({
  db: {
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
    withExclusiveTransactionAsync: jest.fn(async (callback) => callback(mockTxn)),
  },
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

`expo-router/testing-library` の `renderRouter` + `screen.UNSAFE_getByProps` を使う(実例: `src/ui/__tests__/AppMapReturn.test.tsx`)。

```typescript
import { act, cleanup, renderRouter, screen } from 'expo-router/testing-library';
import { AppState } from 'react-native';
import { getBooleanSetting, setSetting } from '@/features/settings/settingsRepository';

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

// 他の依存モジュールも同様にモックする(expo-haptics, expo-location 等)

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
    renderRouter('src/app');
    await flushPromises();

    // accessibilityLabel でUI要素を特定する
    await act(async () => {
      screen.UNSAFE_getByProps({ accessibilityLabel: '現在地へ戻る' }).props.onPress();
    });
    await act(async () => {
      screen.UNSAFE_getByProps({ accessibilityLabel: '日ごとの記録' }).props.onPress();
    });
    await act(async () => {
      screen.UNSAFE_getByProps({ accessibilityLabel: '地図へ' }).props.onPress();
    });
    await flushPromises();

    expect(mockAnimateToRegion).toHaveBeenCalled();
  });
});
```

ポイント:

- `renderRouter('src/app')` でルート定義ごとレンダリングする。個別の画面コンポーネントではなくルーター全体をテストする
- レンダリングと状態更新は必ず `act()` で包む
- UI要素の特定は `screen.UNSAFE_getByProps({ accessibilityLabel: '...' })` を使う(コンポーネントに accessibilityLabel を付ける規約とセット)
- テスト終了後は `cleanup()` と `jest.restoreAllMocks()` を `afterEach` で呼ぶ
- `wrapWithSentry` は `(component) => component` でラップを外すモックが必要(expo-router のルートコンポーネントに適用されているため)
- モックが必要な代表モジュール: `@/config/sentry`(wrapWithSentry), `expo-haptics`, `expo-location`, `expo-notifications`, `react-native-maps`, `react-native-purchases`, DBリポジトリ関数

## テストを書けない場合

理由を明記し、代替の検証方法(手動確認手順など)を提示する(AGENTS.md §2)。
