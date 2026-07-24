# 不具合レポート送信設定 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 不具合(App Hang/クラッシュ)レポートの送信可否を、設定画面と初回チュートリアルのトグルでユーザーが切り替えられるようにする。

**Architecture:** SQLite `app_settings` にキー `crashReportingEnabled`(デフォルト true)で永続化する。Sentry は起動時初期化のまま、`sentry.ts` のモジュールフラグを `beforeSend` で参照して送信可否を動的にゲートする。設定画面とチュートリアルのトグルは `AppStateProvider` の `crashReportingEnabled` 状態を共有し、`updateCrashReportingEnabled` から UI 状態・Sentry フラグ・永続化を一括更新する。

**Tech Stack:** Expo ~57 / React Native 0.86 / TypeScript 6.0 / @sentry/react-native 7.11 / jest + @testing-library/react-native

## Global Constraints

- 文言はユーザー確定版を一字一句そのまま使う(下記 Task 1 の定数)。
- 設定キーは `crashReportingEnabled`、デフォルト `true`。
- 位置情報マスク(`scrubSentryEventLocationData`)は従来どおり維持する。オフ時はイベント自体を送らない。
- 設定リポジトリは `getBooleanSetting` / `setSetting` を使う。AsyncStorage 禁止。
- ディレクトリを跨ぐ import は `@/` エイリアス。`../` 禁止(lint error)。
- `src/ui/components/**` で `StyleSheet.create` 禁止。スタイルは `appStyles.ts`。
- 押下・操作可能要素に `accessibilityLabel` + `accessibilityRole`。
- `describe`/`test`/`it` は日本語。各作業後に `npm run typecheck` / `npm test` / `npm run lint`(error 0)。

## 確定文面

- 設定セクションタイトル: `プライバシー`
- トグルラベル(設定・チュートリアル共通): `不具合レポートを送る`
- 設定説明文: `アプリが固まったり、落ちたりしたときなどの不具合の記録を開発者に自動で送ります。あなたの位置情報や移動記録など、あなたを特定できてしまう情報は送りません。有効にしておくと不具合改善が早くなります。`
- チュートリアルステップタイトル: `不具合レポートについて`
- チュートリアル本文(3段落):
  1. `あなたの位置情報や移動記録は、これまで通り外部に送りません。`
  2. `ただし、アプリが固まったり落ちたりしたときの不具合の記録だけは、改善のために開発者へ自動で送ります(あなたを特定できる情報は含みません)。下のスイッチか設定画面で切り替えられます。`
  3. `アプリ改善にご協力をお願いします。`

## ファイル構成

| ファイル | 役割 | 変更 |
| --- | --- | --- |
| `src/ui/appText.ts` | 文言定数を集約 | 定数追加 |
| `src/config/sentry.ts` | Sentry 送信ゲート | フラグ+setter+beforeSend拡張 |
| `src/ui/hooks/useAppInitialization.ts` | 起動時に設定を読み Sentry フラグ・状態へ反映 | 読み込み・setter prop 追加 |
| `src/ui/state/AppStateProvider.tsx` | 状態 `crashReportingEnabled` と `updateCrashReportingEnabled`、context 配布、init 配線 | 追加 |
| `src/ui/components/SettingsScreen.tsx` | プライバシーセクション + トグル | props+UI追加 |
| `src/app/settings/index.tsx` | SettingsScreen へ props 配線 | 2行追加 |
| `src/ui/components/FirstLaunchTutorialDialog.tsx` | 告知ステップ + トグル + props | 追加 |
| `src/app/_layout.tsx` | チュートリアルへ props 配線 | 2行追加 |

---

### Task 1: 文言定数を追加する

**Files:**
- Modify: `src/ui/appText.ts`(末尾へ追加)
- Test: `src/ui/__tests__/appText.test.ts`

**Interfaces:**
- Produces:
  - `CRASH_REPORTING_SETTING_KEY: 'crashReportingEnabled'`
  - `CRASH_REPORTING_TOGGLE_LABEL: string`
  - `CRASH_REPORTING_SETTING_DESCRIPTION: string`
  - `CRASH_REPORTING_TUTORIAL_TITLE: string`
  - `CRASH_REPORTING_TUTORIAL_PARAGRAPHS: string[]`

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/__tests__/appText.test.ts` の末尾(最後の `});` の前)に追記:

```typescript
  describe('不具合レポート設定の文言', () => {
    it('設定キーとラベルが確定値と一致する', () => {
      expect(CRASH_REPORTING_SETTING_KEY).toBe('crashReportingEnabled');
      expect(CRASH_REPORTING_TOGGLE_LABEL).toBe('不具合レポートを送る');
    });

    it('設定説明文が確定文面と一致する', () => {
      expect(CRASH_REPORTING_SETTING_DESCRIPTION).toBe(
        'アプリが固まったり、落ちたりしたときなどの不具合の記録を開発者に自動で送ります。あなたの位置情報や移動記録など、あなたを特定できてしまう情報は送りません。有効にしておくと不具合改善が早くなります。',
      );
    });

    it('チュートリアル文面が確定内容と一致する', () => {
      expect(CRASH_REPORTING_TUTORIAL_TITLE).toBe('不具合レポートについて');
      expect(CRASH_REPORTING_TUTORIAL_PARAGRAPHS).toEqual([
        'あなたの位置情報や移動記録は、これまで通り外部に送りません。',
        'ただし、アプリが固まったり落ちたりしたときの不具合の記録だけは、改善のために開発者へ自動で送ります(あなたを特定できる情報は含みません)。下のスイッチか設定画面で切り替えられます。',
        'アプリ改善にご協力をお願いします。',
      ]);
    });
  });
```

そのファイル先頭の import 文に、新しい定数を追加する(既存 import 行に合わせて追記):

```typescript
import {
  CRASH_REPORTING_SETTING_DESCRIPTION,
  CRASH_REPORTING_SETTING_KEY,
  CRASH_REPORTING_TOGGLE_LABEL,
  CRASH_REPORTING_TUTORIAL_PARAGRAPHS,
  CRASH_REPORTING_TUTORIAL_TITLE,
} from '@/ui/appText';
```

(既存テストが `from '@/ui/appText'` で別のものを import している場合は、その import に統合する。)

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx jest src/ui/__tests__/appText.test.ts`
Expected: FAIL(`CRASH_REPORTING_SETTING_KEY` 等が未定義)

- [ ] **Step 3: 定数を実装**

`src/ui/appText.ts` の末尾に追加:

```typescript
/** 不具合レポート送信設定の永続化キー。 */
export const CRASH_REPORTING_SETTING_KEY = 'crashReportingEnabled';

/** 不具合レポートトグルのラベル(設定画面・チュートリアル共通)。 */
export const CRASH_REPORTING_TOGGLE_LABEL = '不具合レポートを送る';

/** 設定画面の不具合レポート項目の説明文。 */
export const CRASH_REPORTING_SETTING_DESCRIPTION =
  'アプリが固まったり、落ちたりしたときなどの不具合の記録を開発者に自動で送ります。あなたの位置情報や移動記録など、あなたを特定できてしまう情報は送りません。有効にしておくと不具合改善が早くなります。';

/** 初回チュートリアルの不具合レポート告知ステップのタイトル。 */
export const CRASH_REPORTING_TUTORIAL_TITLE = '不具合レポートについて';

/** 初回チュートリアルの不具合レポート告知ステップの本文段落。 */
export const CRASH_REPORTING_TUTORIAL_PARAGRAPHS = [
  'あなたの位置情報や移動記録は、これまで通り外部に送りません。',
  'ただし、アプリが固まったり落ちたりしたときの不具合の記録だけは、改善のために開発者へ自動で送ります(あなたを特定できる情報は含みません)。下のスイッチか設定画面で切り替えられます。',
  'アプリ改善にご協力をお願いします。',
];
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx jest src/ui/__tests__/appText.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/ui/appText.ts src/ui/__tests__/appText.test.ts
git commit -m "feat(settings): 不具合レポート設定の文言定数を追加する"
```

---

### Task 2: Sentry 送信ゲートを追加する

**Files:**
- Modify: `src/config/sentry.ts`
- Test: `src/config/__tests__/sentry.test.ts`

**Interfaces:**
- Consumes: `filterSentryEventBeforeSend(event)`(既存)
- Produces:
  - `setCrashReportingEnabled(enabled: boolean): void` — モジュールフラグを更新
  - `beforeSend` 拡張: フラグ false のとき `null` を返す

- [ ] **Step 1: 失敗するテストを書く**

`src/config/__tests__/sentry.test.ts` に、`filterSentryEventBeforeSend` を使う新しい describe を追加する。まず import に `setCrashReportingEnabled` を追加(既存の `@/config/sentry` からの import 行へ統合):

```typescript
  describe('不具合レポート送信のゲート', () => {
    afterEach(() => {
      // 既定(有効)へ戻す。他テストへ副作用を残さない
      setCrashReportingEnabled(true);
    });

    it('無効化するとbeforeSendはnullを返しイベントを送らない', () => {
      const event = { message: 'test' } as unknown as Parameters<typeof filterSentryEventBeforeSend>[0];
      setCrashReportingEnabled(false);

      expect(filterSentryEventBeforeSend(event)).toBeNull();
    });

    it('有効時は位置情報マスク済みのイベントを返す', () => {
      const event = { message: 'test' } as unknown as Parameters<typeof filterSentryEventBeforeSend>[0];
      setCrashReportingEnabled(true);

      expect(filterSentryEventBeforeSend(event)).not.toBeNull();
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx jest src/config/__tests__/sentry.test.ts -t "不具合レポート送信のゲート"`
Expected: FAIL(`setCrashReportingEnabled` が未定義。また `filterSentryEventBeforeSend` が null を返さない)

- [ ] **Step 3: フラグとゲートを実装**

`src/config/sentry.ts` の `filterSentryEventBeforeSend` を次の形へ変更し、直前にフラグと setter を追加する。既存の `filterSentryEventBeforeSend`:

```typescript
export function filterSentryEventBeforeSend(event: ErrorEvent): ErrorEvent {
  return scrubSentryEventLocationData(event);
}
```

を、以下へ置き換える:

```typescript
/**
 * 不具合レポートを送信するかどうかのモジュール状態。
 *
 * Sentry.init は起動時に同期実行され DB 初期化より前に走るため、init 自体は
 * 設定で切り替えられない。init は常に実行し、beforeSend でこのフラグを参照して
 * 送信可否だけを動的に制御する。既定は true(有効)。
 */
let isCrashReportingEnabled = true;

/** 不具合レポート送信の有効/無効を設定する。 */
export function setCrashReportingEnabled(enabled: boolean): void {
  isCrashReportingEnabled = enabled;
}

/**
 * Sentryへ送るイベントの最終加工を行う。
 *
 * 不具合レポートが無効なら null を返してイベントを送らない。
 * 有効なら、GPSログ本体や座標値を送らない方針のため位置情報らしいフィールドをマスクする。
 */
export function filterSentryEventBeforeSend(event: ErrorEvent): ErrorEvent | null {
  if (!isCrashReportingEnabled) {
    return null;
  }

  return scrubSentryEventLocationData(event);
}
```

`initializeSentry` 内の `beforeSend` は現状 `return filterSentryEventBeforeSend(event);` を返しており、戻り値型が `ErrorEvent | null` に広がるだけで変更不要。

- [ ] **Step 4: テストが通ることを確認**

Run: `npx jest src/config/__tests__/sentry.test.ts`
Expected: PASS(既存 init テスト含め全通過)

- [ ] **Step 5: 型チェック**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add src/config/sentry.ts src/config/__tests__/sentry.test.ts
git commit -m "feat(sentry): 不具合レポート送信をbeforeSendでゲートする"
```

---

### Task 3: AppStateProvider に状態と更新処理を追加する

**Files:**
- Modify: `src/ui/state/AppStateProvider.tsx`
- Modify: `src/ui/hooks/useAppInitialization.ts`
- Test: `src/ui/components/__tests__/SettingsScreen.test.tsx` はスコープ外。ここでは `useAppInitialization` の読み込み配線と Provider 状態を統合テスト(Task 4 の SettingsScreen 経由)で担保する。単体では下記フックテストを追加。
- Test(新規): `src/ui/state/__tests__/crashReportingState.test.tsx`

**Interfaces:**
- Consumes: `setCrashReportingEnabled`(Task 2)、`CRASH_REPORTING_SETTING_KEY`(Task 1)、`getBooleanSetting`/`setSetting`(既存)
- Produces(context 経由):
  - `crashReportingEnabled: boolean`
  - `updateCrashReportingEnabled: (enabled: boolean) => Promise<void>`
- Produces(`useAppInitialization` の新 prop):
  - `setCrashReportingEnabled: (value: boolean) => void`(UI 状態の setter。Sentry フラグ用の同名関数とは別物)

**注意:** `useAppInitialization` の prop 名は UI 状態 setter。Sentry フラグ setter(Task 2)と名前が同じなので、AppStateProvider 側では Sentry の方を `applyCrashReportingToSentry` という別名で import して混同を防ぐ。

- [ ] **Step 1: 失敗するテストを書く(Provider 状態と更新)**

`src/ui/state/__tests__/crashReportingState.test.tsx` を新規作成。既存の `src/ui/__tests__/AppMapReturn.test.tsx` のモック方針(sentry / maps / settingsRepository 等をモック)に倣い、`renderRouter('src/app')` で設定画面のトグルを操作して `setSetting` が呼ばれることを検証する。まず最小の失敗テスト:

```typescript
import { act, cleanup, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AppState } from 'react-native';

import { setSetting } from '@/features/settings/settingsRepository';

jest.mock('@/config/sentry', () => ({
  wrapWithSentry: (component: unknown) => component,
  updateSentryScreenContext: jest.fn(),
  updateSentrySubscriptionContext: jest.fn(),
  updateSentryUserContext: jest.fn(),
  setCrashReportingEnabled: jest.fn(),
}));

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View, Marker: View, Polygon: View, Polyline: View };
});

jest.mock('@/features/settings/settingsRepository', () => ({
  getBooleanSetting: jest.fn().mockResolvedValue(true),
  getStringSetting: jest.fn().mockResolvedValue(''),
  setSetting: jest.fn().mockResolvedValue(undefined),
  setSettings: jest.fn().mockResolvedValue(undefined),
}));

// 他の必要モック(expo-haptics, expo-location, expo-notifications, react-native-purchases 等)は
// AppMapReturn.test.tsx と同じものをコピーする。

const flushPromises = async () => {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) {
      await Promise.resolve();
    }
  });
};

describe('不具合レポート設定の状態', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active', writable: true });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('設定画面のトグルを切り替えるとcrashReportingEnabledキーで保存する', async () => {
    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });
    await flushPromises();

    await act(async () => {
      fireEvent(screen.getByLabelText('不具合レポートを送る'), 'valueChange', false);
    });
    await flushPromises();

    expect(setSetting).toHaveBeenCalledWith('crashReportingEnabled', false);
  });
});
```

（注: このテストは Task 4 の SettingsScreen トグル実装が入って初めて全体が通る。Task 3 では Provider 側の `updateCrashReportingEnabled` と context 配布まで実装し、Step 2 で「トグルがまだ無い」ため FAIL することを確認する。Task 4 完了後に GREEN になる。ここでは Provider の配線を先に用意する。）

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx jest src/ui/state/__tests__/crashReportingState.test.tsx`
Expected: FAIL(`getByLabelText('不具合レポートを送る')` が見つからない)

- [ ] **Step 3: `useAppInitialization` に読み込みを追加**

`src/ui/hooks/useAppInitialization.ts`:

1. import に定数を追加(既存 `@/ui/appText` からの import があればそこへ、なければ新規行):

```typescript
import { CRASH_REPORTING_SETTING_KEY } from '@/ui/appText';
```

2. `UseAppInitializationOptions` 型(`setKeepScreenAwake: (value: boolean) => void;` の近く)に追加:

```typescript
  /** 不具合レポート設定のUI状態を反映する。 */
  setCrashReportingEnabled: (value: boolean) => void;
```

3. 関数引数の分割代入(`setKeepScreenAwake,` の近く)に `setCrashReportingEnabled,` を追加。

4. `Promise.all` の配列に読み込みを追加(`getBooleanSetting(KEEP_SCREEN_AWAKE_SETTING_KEY, false),` の隣):

```typescript
          getBooleanSetting(CRASH_REPORTING_SETTING_KEY, true),
```

そして分割代入の受け取り変数に `savedCrashReportingEnabled,` を追加(配列の順序に合わせる)。

5. `setKeepScreenAwake(savedKeepScreenAwake);` の近くに反映を追加:

```typescript
        setCrashReportingEnabled(savedCrashReportingEnabled);
```

6. `useCallback` の依存配列(末尾の deps)に `setCrashReportingEnabled` を追加。

- [ ] **Step 4: `AppStateProvider` に状態・更新・配線を追加**

`src/ui/state/AppStateProvider.tsx`:

1. import(`@/config/sentry` からの import 行)に別名を追加:

```typescript
import { setCrashReportingEnabled as applyCrashReportingToSentry } from '@/config/sentry';
```

2. import に定数を追加:

```typescript
import { CRASH_REPORTING_SETTING_KEY } from '@/ui/appText';
```

3. `AppStateContextValue` 型(`keepScreenAwake: boolean;` の近く)に追加:

```typescript
  /** 不具合レポートを送信するか。 */
  crashReportingEnabled: boolean;
  /** 不具合レポート送信設定を更新する。 */
  updateCrashReportingEnabled: (enabled: boolean) => Promise<void>;
```

4. state 定義(`const [keepScreenAwake, setKeepScreenAwake] = useState(false);` の近く)に追加。既定は true:

```typescript
  const [crashReportingEnabled, setCrashReportingEnabledState] = useState(true);
```

5. 起動時に UI 状態と Sentry フラグの両方へ反映する setter を用意する(useAppInitialization の `setCrashReportingEnabled` prop へ渡す):

```typescript
  const applyCrashReportingSetting = useCallback((value: boolean): void => {
    setCrashReportingEnabledState(value);
    applyCrashReportingToSentry(value);
  }, []);
```

6. `updateCrashReportingEnabled` を `updateKeepScreenAwake` の近くに追加(巻き戻しパターン + Sentry 即時反映):

```typescript
  const updateCrashReportingEnabled = useCallback(
    async (enabled: boolean): Promise<void> => {
      const previousValue = crashReportingEnabled;
      setCrashReportingEnabledState(enabled);
      applyCrashReportingToSentry(enabled);
      try {
        await setSetting(CRASH_REPORTING_SETTING_KEY, enabled);
      } catch (error: unknown) {
        console.warn('Failed to persist crash reporting setting:', error);
        setCrashReportingEnabledState(previousValue);
        applyCrashReportingToSentry(previousValue);
      }
    },
    [crashReportingEnabled],
  );
```

7. `useAppInitialization({ ... })` の呼び出しに prop を追加:

```typescript
    setCrashReportingEnabled: applyCrashReportingSetting,
```

8. context value(return する巨大オブジェクト。`keepScreenAwake,` `updateKeepScreenAwake,` の近く)に追加:

```typescript
    crashReportingEnabled,
    updateCrashReportingEnabled,
```

- [ ] **Step 5: 型チェック**

Run: `npm run typecheck`
Expected: エラーなし(この時点では Task 4 未実装のため Step 1 のテストはまだ FAIL のまま)

- [ ] **Step 6: コミット**

```bash
git add src/ui/state/AppStateProvider.tsx src/ui/hooks/useAppInitialization.ts src/ui/state/__tests__/crashReportingState.test.tsx
git commit -m "feat(settings): 不具合レポート設定の状態と更新処理を追加する"
```

---

### Task 4: 設定画面にプライバシーセクションとトグルを追加する

**Files:**
- Modify: `src/ui/components/SettingsScreen.tsx`
- Modify: `src/app/settings/index.tsx`
- Test: `src/ui/components/__tests__/SettingsScreen.test.tsx`

**Interfaces:**
- Consumes: `CRASH_REPORTING_TOGGLE_LABEL` / `CRASH_REPORTING_SETTING_DESCRIPTION`(Task 1)、Provider の `crashReportingEnabled` / `updateCrashReportingEnabled`(Task 3)
- Produces: `SettingsScreenProps` に `crashReportingEnabled: boolean` と `onUpdateCrashReportingEnabled: (enabled: boolean) => Promise<void>`

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/components/__tests__/SettingsScreen.test.tsx` の `createProps()` に2プロパティを追加(`keepScreenAwake: false,` の近くと `onUpdateKeepScreenAwake: jest.fn()...` の近く):

```typescript
    crashReportingEnabled: true,
```
```typescript
    onUpdateCrashReportingEnabled: jest.fn().mockResolvedValue(undefined),
```

新しいテストを追加:

```typescript
  test('プライバシーセクションの不具合レポートトグルを切り替えると更新処理を呼ぶ', () => {
    const props = createProps();
    render(<SettingsScreen {...props} />);

    act(() => {
      fireEvent(screen.getByLabelText('不具合レポートを送る'), 'valueChange', false);
    });

    expect(props.onUpdateCrashReportingEnabled).toHaveBeenCalledWith(false);
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx jest src/ui/components/__tests__/SettingsScreen.test.tsx -t "プライバシー"`
Expected: FAIL(`getByLabelText('不具合レポートを送る')` が見つからない)

- [ ] **Step 3: SettingsScreen に props と UI を実装**

`src/ui/components/SettingsScreen.tsx`:

1. import に文言定数を追加:

```typescript
import { CRASH_REPORTING_SETTING_DESCRIPTION, CRASH_REPORTING_TOGGLE_LABEL } from '@/ui/appText';
```

2. `SettingsScreenProps` 型(`onUpdateKeepScreenAwake: (enabled: boolean) => Promise<void>;` の近く)に追加:

```typescript
  /** 不具合レポートを送信するか。 */
  crashReportingEnabled: boolean;
  /** 不具合レポート送信設定の更新処理。 */
  onUpdateCrashReportingEnabled: (enabled: boolean) => Promise<void>;
```

3. 関数の分割代入(`keepScreenAwake,` `onUpdateKeepScreenAwake,` の近く)に `crashReportingEnabled,` と `onUpdateCrashReportingEnabled,` を追加。

4. 「アプリ情報」`ScreenSection`(`<ScreenSection styles={styles} title="アプリ情報">`)の直前に、新しいセクションを追加:

```tsx
        <ScreenSection styles={styles} title="プライバシー">
          <View style={styles.settingsInlineRow}>
            <View style={styles.settingsInlineText}>
              <Text style={styles.formItemTitle}>{CRASH_REPORTING_TOGGLE_LABEL}</Text>
              <Text style={styles.formItemDescription}>{CRASH_REPORTING_SETTING_DESCRIPTION}</Text>
            </View>
            <Switch
              accessibilityLabel={CRASH_REPORTING_TOGGLE_LABEL}
              accessibilityRole="switch"
              value={crashReportingEnabled}
              onValueChange={(value) => {
                onUpdateCrashReportingEnabled(value).catch((error: unknown) => {
                  Alert.alert('設定保存失敗', error instanceof Error ? error.message : '設定を保存できませんでした。');
                });
              }}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor="#ffffff"
            />
          </View>
        </ScreenSection>
```

（`View` / `Text` / `Switch` / `Alert` / `ScreenSection` は既存 import 済み。未 import ならファイル上部の該当 import に追加する。）

- [ ] **Step 4: settings ルートで props を配線**

`src/app/settings/index.tsx` の `onUpdateKeepScreenAwake={s.updateKeepScreenAwake}` の近くに追加:

```tsx
      crashReportingEnabled={s.crashReportingEnabled}
      onUpdateCrashReportingEnabled={s.updateCrashReportingEnabled}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npx jest src/ui/components/__tests__/SettingsScreen.test.tsx`
Expected: PASS

- [ ] **Step 6: Task 3 の統合テストも通ることを確認**

Run: `npx jest src/ui/state/__tests__/crashReportingState.test.tsx`
Expected: PASS(トグルが実装され `setSetting` が呼ばれる)

- [ ] **Step 7: コミット**

```bash
git add src/ui/components/SettingsScreen.tsx src/app/settings/index.tsx src/ui/components/__tests__/SettingsScreen.test.tsx
git commit -m "feat(settings): プライバシーセクションに不具合レポートトグルを追加する"
```

---

### Task 5: 初回チュートリアルに告知ステップとトグルを追加する

**Files:**
- Modify: `src/ui/components/FirstLaunchTutorialDialog.tsx`
- Modify: `src/app/_layout.tsx`
- Test: `src/ui/components/__tests__/FirstLaunchTutorialDialog.test.tsx`

**Interfaces:**
- Consumes: `CRASH_REPORTING_TOGGLE_LABEL` / `CRASH_REPORTING_TUTORIAL_TITLE` / `CRASH_REPORTING_TUTORIAL_PARAGRAPHS`(Task 1)、Provider の `crashReportingEnabled` / `updateCrashReportingEnabled`(Task 3)
- Produces: `FirstLaunchTutorialDialogProps` に `crashReportingEnabled: boolean` と `onUpdateCrashReportingEnabled: (enabled: boolean) => void`

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/components/__tests__/FirstLaunchTutorialDialog.test.tsx` に追加。既存の `press` ヘルパー(「次へ」を押して進む)を使い、告知ステップまで進めてトグルを操作する。まずレンダリングの必須 props に2つ追加する形でテストを書く:

```typescript
  test('不具合レポート告知ステップのスイッチを切り替えると更新処理を呼ぶ', () => {
    const onUpdate = jest.fn();
    render(
      <FirstLaunchTutorialDialog
        visible
        styles={styles}
        onComplete={jest.fn()}
        crashReportingEnabled
        onUpdateCrashReportingEnabled={onUpdate}
      />,
    );

    // 告知ステップ(不具合レポートについて)まで「次へ」で進む
    // タイトルが表示されるまで進める
    for (let i = 0; i < 10; i += 1) {
      if (screen.queryByText('不具合レポートについて')) {
        break;
      }
      press('次へ');
    }

    expect(screen.getByText('不具合レポートについて')).toBeTruthy();

    act(() => {
      fireEvent(screen.getByLabelText('不具合レポートを送る'), 'valueChange', false);
    });

    expect(onUpdate).toHaveBeenCalledWith(false);
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx jest src/ui/components/__tests__/FirstLaunchTutorialDialog.test.tsx -t "不具合レポート"`
Expected: FAIL(props 未対応・ステップ未追加で `不具合レポートについて` が見つからない)

- [ ] **Step 3: FirstLaunchTutorialDialog に props・ステップ・トグルを実装**

`src/ui/components/FirstLaunchTutorialDialog.tsx`:

1. import に文言定数を追加。`Switch` も import に加える(`react-native` からの import へ):

```typescript
import { CRASH_REPORTING_TOGGLE_LABEL, CRASH_REPORTING_TUTORIAL_PARAGRAPHS, CRASH_REPORTING_TUTORIAL_TITLE } from '@/ui/appText';
```

2. `TutorialStep` 型に任意フラグを追加:

```typescript
  /** このステップで不具合レポートトグルを表示するか。 */
  showCrashReportingToggle?: boolean;
```

3. `TUTORIAL_STEPS` 配列で「さいごに」ステップの後、「位置情報を確認してはじめる」ステップの前に新ステップを挿入:

```typescript
  {
    title: CRASH_REPORTING_TUTORIAL_TITLE,
    paragraphs: CRASH_REPORTING_TUTORIAL_PARAGRAPHS,
    showCrashReportingToggle: true,
  },
```

4. `FirstLaunchTutorialDialogProps` 型に追加:

```typescript
  /** 不具合レポートを送信するか。 */
  crashReportingEnabled: boolean;
  /** 不具合レポート送信設定の更新処理。 */
  onUpdateCrashReportingEnabled: (enabled: boolean) => void;
```

5. 関数の分割代入に `crashReportingEnabled,` と `onUpdateCrashReportingEnabled,` を追加。

6. 本文の描画箇所(`currentStep.paragraphs.map(...)` の後、`currentStep.bulletItems` 描画の近く)に、トグルの条件描画を追加。theme 色はチュートリアルが `theme` を受け取っていない場合、`Switch` の色指定は省略しデフォルトにする(トグル label は必須):

```tsx
      {currentStep.showCrashReportingToggle && (
        <View style={styles.settingsInlineRow}>
          <Text style={styles.formItemTitle}>{CRASH_REPORTING_TOGGLE_LABEL}</Text>
          <Switch
            accessibilityLabel={CRASH_REPORTING_TOGGLE_LABEL}
            accessibilityRole="switch"
            value={crashReportingEnabled}
            onValueChange={onUpdateCrashReportingEnabled}
          />
        </View>
      )}
```

（`styles.settingsInlineRow` / `styles.formItemTitle` は既存の共通スタイル。`View` が未 import なら追加する。)

- [ ] **Step 4: `_layout.tsx` で props を配線**

`src/app/_layout.tsx` の `<FirstLaunchTutorialDialog ... onComplete={s.completeFirstLaunchTutorial} />` に追加:

```tsx
        crashReportingEnabled={s.crashReportingEnabled}
        onUpdateCrashReportingEnabled={(value) => {
          s.updateCrashReportingEnabled(value).catch((error: unknown) => {
            console.warn('Failed to update crash reporting from tutorial:', error);
          });
        }}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npx jest src/ui/components/__tests__/FirstLaunchTutorialDialog.test.tsx`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/ui/components/FirstLaunchTutorialDialog.tsx src/app/_layout.tsx src/ui/components/__tests__/FirstLaunchTutorialDialog.test.tsx
git commit -m "feat(tutorial): 初回チュートリアルに不具合レポート告知ステップとトグルを追加する"
```

---

### Task 6: 全体検証とドキュメント更新

**Files:**
- Modify: `docs/data-storage.md`(app_settings の設定キー一覧があれば追記)

- [ ] **Step 1: 全テスト・型・lint・format を実行**

Run: `npm run typecheck && npm test && npm run lint && npm run format:check`
Expected: typecheck 0エラー / 全テスト PASS / lint error 0 / format 通過

- [ ] **Step 2: ドキュメントに設定キーを追記**

`docs/data-storage.md` に `app_settings` のキー一覧があれば、`crashReportingEnabled`(boolean、デフォルト true、不具合レポート送信可否)を追記する。該当箇所がなければこの Step はスキップし、その旨をコミットメッセージに記さない(コミット不要)。

- [ ] **Step 3: format 適用してコミット(ドキュメント変更があれば)**

```bash
npm run format
git add -A
git commit -m "docs: 不具合レポート設定のキーをデータ仕様に追記する"
```

---

## Self-Review 結果

- **Spec coverage:** プライバシーセクション(Task 4)/ チュートリアル告知+トグル(Task 5)/ デフォルト true(Task 1・3)/ 位置情報を送らない=マスク維持+オフ時null(Task 2)/ 両トグル同期=共有状態(Task 3-5)/ 永続化(Task 3)/ 起動時読み込み(Task 3)を各タスクで実装。網羅。
- **Placeholder scan:** 各コードステップに実コードを記載。プレースホルダなし。
- **Type consistency:** `setCrashReportingEnabled`(Sentry フラグ setter, Task 2)と `useAppInitialization` の同名 prop(UI 状態 setter)の衝突を、Provider 側で `applyCrashReportingToSentry` エイリアスと `applyCrashReportingSetting`(両方反映)で分離。context の `crashReportingEnabled`/`updateCrashReportingEnabled`、props の `onUpdateCrashReportingEnabled` は全タスクで一致。
