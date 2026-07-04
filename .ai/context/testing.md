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
import { db } from '../../../db/database';
import { getStringSetting } from '../settingsRepository';

jest.mock('../../../db/database', () => ({
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

`react-test-renderer` + Expoモジュールのモック(実例: `src/app/__tests__/AppMapReturn.test.tsx`):

```typescript
import ReactTestRenderer, { act } from 'react-test-renderer';
import { View } from 'react-native';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('react-native-maps', () => ({
  __esModule: true,
  default: View,
  Marker: View,
}));

/** マイクロタスクを流し切って非同期stateの反映を待つ。 */
const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('App 地図復帰時の表示範囲復元', () => {
  test('別画面から地図へ戻ると現在地中心へ復元する', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    // accessibilityLabel でUI要素を特定する
    const button = renderer!.root.findByProps({ accessibilityLabel: '現在地へ移動' });
  });
});
```

ポイント:

- レンダリングと状態更新は必ず `act()` で包む
- UI要素の特定は `findByProps({ accessibilityLabel: '...' })` を優先する(コンポーネントに accessibilityLabel を付ける規約とセット)
- モックが必要な代表モジュール: `expo-haptics`, `expo-location`, `expo-notifications`, `react-native-maps`, `react-native-purchases`, DBリポジトリ関数

## テストを書けない場合

理由を明記し、代替の検証方法(手動確認手順など)を提示する(AGENTS.md §2)。
