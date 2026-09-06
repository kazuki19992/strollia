# App Update Notice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 明示的に通知対象へ指定したストア配布版を既存ユーザーが初めて起動したときだけ、SVG工事看板を既存Dialog内へ表示し、設定画面から再表示できるようにする。

**Architecture:** 最新1件の任意通知定義と現在のネイティブ版を純粋関数で照合し、SQLiteの既読版と初回チュートリアル完了状態を起動時に組み合わせる。表示状態と副作用はAppStateProviderへ置き、描画は再利用可能なScalableSvgCanvas、看板固有SVG、既存Dialogの3層へ分離する。

**Tech Stack:** Expo 57、React Native 0.86、TypeScript 6 strict、expo-application、expo-sqlite、react-native-svg 15.15.4、Jest、Testing Library

**Spec:** `docs/superpowers/specs/2026-08-28-app-update-notice-design.md`

## Global Constraints

- `LATEST_UPDATE_NOTICE` は動作確認中だけ対象版の仮データを入れ、確認完了後は未提供版として `null` に戻す。
- 通知は `Application.nativeApplicationVersion` と通知の `version` が文字列で完全一致するときだけ有効とする。
- 新規インストールでは初回チュートリアルだけを表示し、現在版を既読として原子的に保存する。
- 更新項目は重要順に1件以上、各1〜10 Unicode文字とする。看板は先頭2件を表示し、3件目以降があれば「など……」を自動表示する。
- 「アプリを新しくしました」「ご迷惑をおかけしました」は単一のSVG Textで必ず1行表示する。
- feature／fixとも「詳しくはリリースノートをご確認ください」を表示する。
- 看板は329単位幅のSVG viewBoxで描画し、文字、線、余白を含む全要素を同一倍率で線形拡大縮小する。
- 看板本体と更新内容欄は角丸なし、バージョン帯だけ丸棒にする。
- 既存Dialogのスワイプクローズを使用し、設定起点だけ「ストアページへ」を表示する。
- SQLiteの既存 `app_settings` を使い、DBスキーマや外部依存を追加しない。
- テスト名は日本語、公開型・関数・自明でない変数には日本語JSDocを付ける。

---

### Task 1: 通知定義と対象版判定

**Files:**

- Create: `src/features/app-update/updateNotices.ts`
- Create: `src/features/app-update/__tests__/updateNotices.test.ts`

**Interfaces:**

- Consumes: `Application.nativeApplicationVersion` とSQLiteから読み込んだ既読版文字列。
- Produces: `AppUpdateNotice`, `AppUpdateNoticeKind`, `AppUpdateNoticeSource`, `LAST_ACKNOWLEDGED_UPDATE_NOTICE_VERSION_SETTING_KEY`, `LATEST_UPDATE_NOTICE`, `resolveCurrentAppUpdateNotice()`, `shouldShowAutomaticAppUpdateNotice()`。

- [ ] **Step 1: 対象版と定義検証の失敗テストを書く**

```ts
import {
  resolveCurrentAppUpdateNotice,
  shouldShowAutomaticAppUpdateNotice,
  type AppUpdateNotice,
} from '@/features/app-update/updateNotices';

const featureNotice: AppUpdateNotice = {
  version: '1.3.0',
  kind: 'feature',
  items: ['地図を改善', '検索を追加', '表示を改善'],
};

describe('アプリ更新通知定義', () => {
  test('現在版と通知版が完全一致する場合だけ通知を解決する', () => {
    expect(resolveCurrentAppUpdateNotice(featureNotice, '1.3.0')).toEqual(featureNotice);
    expect(resolveCurrentAppUpdateNotice(featureNotice, '1.3.1')).toBeNull();
    expect(resolveCurrentAppUpdateNotice(featureNotice, '1.3')).toBeNull();
    expect(resolveCurrentAppUpdateNotice(featureNotice, null)).toBeNull();
  });

  test('通知定義がないリリースでは表示しない', () => {
    expect(resolveCurrentAppUpdateNotice(null, '1.3.0')).toBeNull();
  });

  test('項目数または文字数が不正なら表示しない', () => {
    expect(resolveCurrentAppUpdateNotice({ ...featureNotice, items: [] }, '1.3.0')).toBeNull();
    expect(resolveCurrentAppUpdateNotice({ ...featureNotice, items: ['12345678901'] }, '1.3.0')).toBeNull();
  });

  test('既存ユーザーかつ未読の現在版だけ自動表示する', () => {
    expect(
      shouldShowAutomaticAppUpdateNotice({
        currentNotice: featureNotice,
        firstLaunchTutorialCompleted: true,
        lastAcknowledgedVersion: '',
      }),
    ).toBe(true);
    expect(
      shouldShowAutomaticAppUpdateNotice({
        currentNotice: featureNotice,
        firstLaunchTutorialCompleted: false,
        lastAcknowledgedVersion: '',
      }),
    ).toBe(false);
    expect(
      shouldShowAutomaticAppUpdateNotice({
        currentNotice: featureNotice,
        firstLaunchTutorialCompleted: true,
        lastAcknowledgedVersion: '1.3.0',
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: テストを実行して未実装で失敗することを確認する**

Run: `npm test -- src/features/app-update/__tests__/updateNotices.test.ts --runInBand`

Expected: FAIL with module-not-found for `updateNotices`.

- [ ] **Step 3: 最新1件の任意定義と純粋判定を実装する**

```ts
export type AppUpdateNoticeKind = 'feature' | 'fix';
export type AppUpdateNoticeSource = 'automatic' | 'settings';

export type AppUpdateNotice = {
  version: string;
  kind: AppUpdateNoticeKind;
  items: readonly string[];
};

const KIND_TEXT = {
  feature: { heading: '新機能を\n追加しました', sectionTitle: '主な新機能' },
  fix: { heading: '不具合を\nなおしました', sectionTitle: '修正した不具合' },
} as const;

export const LATEST_UPDATE_NOTICE: AppUpdateNotice | null = null;
export const LAST_ACKNOWLEDGED_UPDATE_NOTICE_VERSION_SETTING_KEY = 'lastAcknowledgedUpdateNoticeVersion';

export function resolveCurrentAppUpdateNotice(
  notice: AppUpdateNotice | null,
  nativeApplicationVersion: string | null,
): AppUpdateNotice | null {
  if (!notice || !nativeApplicationVersion || notice.version !== nativeApplicationVersion) return null;
  const lengths = notice.items.map((item) => Array.from(item).length);
  if (notice.items.length < 1 || lengths.some((length) => length < 1 || length > 20)) return null;
  return notice;
}

export function shouldShowAutomaticAppUpdateNotice(params: {
  currentNotice: AppUpdateNotice | null;
  firstLaunchTutorialCompleted: boolean;
  lastAcknowledgedVersion: string;
}): boolean {
  return Boolean(
    params.firstLaunchTutorialCompleted && params.currentNotice && params.lastAcknowledgedVersion !== params.currentNotice.version,
  );
}
```

- [ ] **Step 4: 対象テストを通す**

Run: `npm test -- src/features/app-update/__tests__/updateNotices.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: コミットする**

```bash
git add src/features/app-update/updateNotices.ts src/features/app-update/__tests__/updateNotices.test.ts
git commit -m "feat(update): 更新通知の対象版判定を追加"
```

### Task 2: 汎用ScalableSvgCanvas

**Files:**

- Create: `src/ui/components/ScalableSvgCanvas.tsx`
- Create: `src/ui/components/__tests__/ScalableSvgCanvas.test.tsx`

**Interfaces:**

- Consumes: `viewBoxWidth`, `viewBoxHeight`, `accessibilityLabel`, SVG要素の `children`。
- Produces: 親幅いっぱいで縦横比を維持し、子を単一倍率で描画する `ScalableSvgCanvas`。

- [ ] **Step 1: viewBox・縦横比・子要素・読み上げの失敗テストを書く**

`react-native-svg` をReact Native `View`へ置き換えるテストモックを定義し、次を検証する。

```tsx
render(
  <ScalableSvgCanvas viewBoxWidth={329} viewBoxHeight={261} accessibilityLabel="更新通知" testID="vector-canvas">
    <Rect testID="vector-child" x={0} y={0} width={10} height={10} />
  </ScalableSvgCanvas>,
);

expect(screen.getByTestId('vector-canvas-container').props.style).toEqual(
  expect.objectContaining({ width: '100%', aspectRatio: 329 / 261 }),
);
expect(screen.getByTestId('vector-canvas')).toHaveProp('viewBox', '0 0 329 261');
expect(screen.getByTestId('vector-canvas')).toHaveProp('preserveAspectRatio', 'xMidYMid meet');
expect(screen.getByLabelText('更新通知')).toBeTruthy();
expect(screen.getByTestId('vector-child')).toBeTruthy();
```

- [ ] **Step 2: テストを実行して未実装で失敗することを確認する**

Run: `npm test -- src/ui/components/__tests__/ScalableSvgCanvas.test.tsx --runInBand`

Expected: FAIL with module-not-found for `ScalableSvgCanvas`.

- [ ] **Step 3: 固定viewBoxを表示領域へ合わせる共通コンポーネントを実装する**

```tsx
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg from 'react-native-svg';

export type ScalableSvgCanvasProps = {
  viewBoxWidth: number;
  viewBoxHeight: number;
  accessibilityLabel: string;
  children: ReactNode;
  testID?: string;
};

export function ScalableSvgCanvas({
  viewBoxWidth,
  viewBoxHeight,
  accessibilityLabel,
  children,
  testID,
}: ScalableSvgCanvasProps): React.ReactElement {
  return (
    <View testID={testID ? `${testID}-container` : undefined} style={{ width: '100%', aspectRatio: viewBoxWidth / viewBoxHeight }}>
      <Svg
        testID={testID}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        width="100%"
        height="100%"
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {children}
      </Svg>
    </View>
  );
}
```

子の契約はSVGプリミティブまたは最終的にSVGプリミティブを返すコンポーネントとし、`ForeignObject` や `vectorEffect="non-scaling-stroke"` を共通部品へ追加しない。

- [ ] **Step 4: 対象テストを通す**

Run: `npm test -- src/ui/components/__tests__/ScalableSvgCanvas.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 5: コミットする**

```bash
git add src/ui/components/ScalableSvgCanvas.tsx src/ui/components/__tests__/ScalableSvgCanvas.test.tsx
git commit -m "feat(ui): 拡大縮小可能なSVGキャンバスを追加"
```

### Task 3: 工事看板SVGアートワーク

**Files:**

- Create: `src/ui/components/AppUpdateNoticeSign.tsx`
- Create: `src/ui/components/__tests__/AppUpdateNoticeSign.test.tsx`

**Interfaces:**

- Consumes: Task 1の `AppUpdateNotice` とTask 2の `ScalableSvgCanvas`。
- Produces: `AppUpdateNoticeSignProps`, `AppUpdateNoticeSign`。内部関数 `AppUpdateNoticeSignArtwork` はSVG `G`を返す。

- [ ] **Step 1: 固定座標、文言差分、可変高さの失敗テストを書く**

`react-native-svg` の `Svg`, `G`, `Rect`, `Text` をテスト用 `View` / React Native `Text`へ置き換え、各要素へ安定したtestIDを付けて次を検証する。

```tsx
expect(screen.getByTestId('app-update-notice-sign-canvas')).toHaveProp('viewBox', '0 0 329 261');
expect(screen.getByTestId('app-update-notice-sign-outer-border')).toHaveProp('rx', 0);
expect(screen.getByTestId('app-update-notice-sign-version-pill')).toHaveProp('rx', 12.5);
expect(screen.getByTestId('app-update-notice-sign-top-copy').props.children).toBe('アプリを新しくしました');
expect(screen.getByText('詳しくはリリースノートをご確認ください')).toBeTruthy();
```

別ケースでfix上帯が「ご迷惑をおかけしました」の単一Textであること、2件でviewBox高282、重要順の3件以上で298、「など……」が `fontSize={11}` になることを検証する。

- [ ] **Step 2: テストを実行して未実装で失敗することを確認する**

Run: `npm test -- src/ui/components/__tests__/AppUpdateNoticeSign.test.tsx --runInBand`

Expected: FAIL with module-not-found for `AppUpdateNoticeSign`.

- [ ] **Step 3: 329単位の看板アートワークを実装する**

次の固定値をJSDoc付き定数として定義する。

```ts
const SIGN_WIDTH = 329;
const BASE_SIGN_HEIGHT = 261;
const SECOND_ITEM_EXTENSION = 21;
const SHOW_MORE_EXTENSION = 16;
const SIGN_BLUE = '#0077CC';
const SIGN_WHITE = '#FFFFFF';
const SIGN_FOOTER = '#303030';
```

高さと下側オフセットは次の式だけで決める。

```ts
const displayedItems = notice.items.slice(0, 2);
const secondItemOffset = displayedItems.length === 2 ? SECOND_ITEM_EXTENSION : 0;
const moreItemsOffset = notice.items.length > displayedItems.length ? SHOW_MORE_EXTENSION : 0;
const lowerContentOffset = secondItemOffset + moreItemsOffset;
const signHeight = BASE_SIGN_HEIGHT + lowerContentOffset;
```

`AppUpdateNoticeSignArtwork` は次の座標を使う。

- 背景 `Rect`: `x=0`, `y=0`, `width=329`, `height=signHeight`, `fill=#FFFFFF`。
- 上帯 `Rect`: `x=0`, `y=0`, `width=329`, `height=31`, `fill=#0077CC`。
- 外枠 `Rect`: `x=2`, `y=2`, `width=325`, `height=signHeight-4`, `strokeWidth=4`, `rx=0`, `ry=0`。
- 上帯文言: 単一 `Text`, `x=164.5`, `y=26`, `textAnchor=middle`, `fontSize=24`, `fontWeight=900`。
- 大見出し: 2つの `Text`, `x=164.5`, `y=79/119`, `fontSize=40`, `fontWeight=900`。
- 内容欄 `Rect`: 線の外端が `x=9..321`, `y=145..201+lowerContentOffset` になるよう `x=10`, `y=146`, `width=310`, `height=54+lowerContentOffset`, `strokeWidth=2`, `rx=0`, `ry=0`。
- 内容欄見出しと項目: `x=21`, 基準baseline `y=168/189/210`、`fontSize=14`, `fontWeight=900`。
- 「など……」: `x=21`, 2件目の下、`fontSize=11`, `fontWeight=900`。
- 丸棒 `Rect`: `x=9`, `y=207+lowerContentOffset`, `width=312`, `height=25`, `rx=12.5`, `ry=12.5`。
- 版番号: `x=164.5`, `y=226+lowerContentOffset`, `textAnchor=middle`, `fontSize=18`, `fontWeight=900`。
- 補足文: feature/fix共通で `x=318`, `y=252+lowerContentOffset`, `textAnchor=end`, `fontSize=10`, `fontWeight=900`。

上帯文言は改行やTSpanを使わない。看板内のReact Native `View` / React Native `Text`、`ForeignObject`、非スケーリングstrokeを使わない。

- [ ] **Step 4: 対象テストと型チェックを通す**

Run: `npm test -- src/ui/components/__tests__/AppUpdateNoticeSign.test.tsx src/ui/components/__tests__/ScalableSvgCanvas.test.tsx --runInBand`

Expected: PASS.

Run: `npm run typecheck`

Expected: exit 0.

- [ ] **Step 5: コミットする**

```bash
git add src/ui/components/AppUpdateNoticeSign.tsx src/ui/components/__tests__/AppUpdateNoticeSign.test.tsx
git commit -m "feat(update): 工事看板SVGを追加"
```

### Task 4: ストアURLの共通化

**Files:**

- Create: `src/config/storeUrls.ts`
- Create: `src/config/__tests__/storeUrls.test.ts`
- Modify: `src/features/achievements/achievementDefinitions.ts`
- Modify: `src/features/achievements/__tests__/achievementDefinitions.test.ts`

**Interfaces:**

- Consumes: React Native `Platform.OS`相当の文字列。
- Produces: `STROLLIA_APP_STORE_URL`, `STROLLIA_PLAY_STORE_URL`, `getStrolliaStoreUrl()`。

- [ ] **Step 1: OS別URLと既存共有文言の失敗テストを書く**

```ts
expect(getStrolliaStoreUrl('ios')).toBe('https://apps.apple.com/jp/app/id6777709044');
expect(getStrolliaStoreUrl('android')).toBe('https://play.google.com/store/apps/details?id=com.kazuki19992.strollia');
expect(createAchievementShareText('はじめの一歩')).toContain(STROLLIA_APP_STORE_URL);
```

- [ ] **Step 2: 対象テストを実行して新しいconfigがないため失敗することを確認する**

Run: `npm test -- src/config/__tests__/storeUrls.test.ts src/features/achievements/__tests__/achievementDefinitions.test.ts --runInBand`

Expected: FAIL with module-not-found for `storeUrls`.

- [ ] **Step 3: URL定義を集約して実績共有を移行する**

```ts
export const STROLLIA_APP_STORE_URL = 'https://apps.apple.com/jp/app/id6777709044';
export const STROLLIA_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.kazuki19992.strollia';

export function getStrolliaStoreUrl(platformOS: string): string {
  return platformOS === 'android' ? STROLLIA_PLAY_STORE_URL : STROLLIA_APP_STORE_URL;
}
```

`achievementDefinitions.ts` はconfigから `STROLLIA_APP_STORE_URL` をimportし、従来のローカル定義を削除する。テストもconfigから定数をimportする。

- [ ] **Step 4: 対象テストを通す**

Run: `npm test -- src/config/__tests__/storeUrls.test.ts src/features/achievements/__tests__/achievementDefinitions.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: コミットする**

```bash
git add src/config/storeUrls.ts src/config/__tests__/storeUrls.test.ts src/features/achievements/achievementDefinitions.ts src/features/achievements/__tests__/achievementDefinitions.test.ts
git commit -m "refactor(config): ストアURLを共通化"
```

### Task 5: 既存Dialog内の更新通知UI

**Files:**

- Create: `src/ui/components/AppUpdateNoticeDialog.tsx`
- Create: `src/ui/components/__tests__/AppUpdateNoticeDialog.test.tsx`
- Modify: `src/ui/styles/achievementStyles.ts`
- Modify: `src/ui/__tests__/appStylesSplit.test.ts`

**Interfaces:**

- Consumes: `AppUpdateNotice`, `AppStyles`, 表示元 `automatic | settings`, close/store callbacks。
- Produces: `AppUpdateNoticeDialogProps`, `AppUpdateNoticeDialog`。表示元型はTask 1の `AppUpdateNoticeSource` を使う。

- [ ] **Step 1: Dialogの既存挙動と設定起点ボタンの失敗テストを書く**

```tsx
render(
  <AppUpdateNoticeDialog
    visible
    source="automatic"
    notice={featureNotice}
    styles={styles}
    onClose={onClose}
    onOpenStorePage={onOpenStorePage}
  />,
);

const dialog = screen.UNSAFE_getByType(Dialog);
expect(dialog.props.swipeToClose).toBe(true);
expect(dialog.props.autoClose).toBe(false);
expect(screen.queryByLabelText('ストアページへ')).toBeNull();
```

`source="settings"` の別テストでは「ストアページへ」を表示し、`fireEvent.press` で `onOpenStorePage` が1回呼ばれることを検証する。`notice={null}` または `visible={false}` ではDialogの `visible` がfalseになることも固定する。

- [ ] **Step 2: 対象テストを実行して未実装で失敗することを確認する**

Run: `npm test -- src/ui/components/__tests__/AppUpdateNoticeDialog.test.tsx --runInBand`

Expected: FAIL with module-not-found for `AppUpdateNoticeDialog`.

- [ ] **Step 3: Dialog内へcontain表示する内容を実装する**

```tsx
export type AppUpdateNoticeDialogProps = {
  visible: boolean;
  source: AppUpdateNoticeSource | null;
  notice: AppUpdateNotice | null;
  styles: AppStyles;
  onClose: () => void;
  onOpenStorePage: () => void;
};
```

`Dialog` は `swipeToClose`, `autoClose={false}` で使用する。内部に `ScrollView` は置かず、既存Dialogの全方向スワイプ閉じを維持する。画面高の72%と、画面高からDialog外側余白・カードpadding・要素間gap・スワイプ案内を除いた高さの小さい方を内容の最大高とする。画面幅からDialogの左右余白を除いた最大幅と合わせ、さらに小さい方の倍率で `AppUpdateNoticeSign` 全体を `object-fit: contain` 相当に縮小する。`source === 'settings'` の場合は既存 `ActionPill label="ストアページへ"` の領域を先に確保してから看板の最大高を決める。看板周囲へ独自カード、影、角丸マスクを追加しない。

`createAchievementStyles` へ次の責務だけを追加する。

```ts
appUpdateNoticeDialogContent: {
  alignItems: 'center',
  alignSelf: 'stretch',
  gap: 12,
  paddingTop: 22,
},
```

既存の閉じるボタンと看板が重ならないよう `paddingTop` を確保し、スワイプ案内と閉じ操作は既存Dialog側に任せる。SVGのviewBox、文字、線、余白は個別調整せず、看板全体を同じ倍率で線形に拡大縮小する。

- [ ] **Step 4: コンポーネントとスタイル分割テストを通す**

Run: `npm test -- src/ui/components/__tests__/AppUpdateNoticeDialog.test.tsx src/ui/__tests__/appStylesSplit.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: コミットする**

```bash
git add src/ui/components/AppUpdateNoticeDialog.tsx src/ui/components/__tests__/AppUpdateNoticeDialog.test.tsx src/ui/styles/achievementStyles.ts src/ui/__tests__/appStylesSplit.test.ts
git commit -m "feat(update): 更新通知ダイアログを追加"
```

### Task 6: 起動判定・既読保存・モーダル待機

**Files:**

- Modify: `src/ui/hooks/useAppInitialization.ts`
- Modify: `src/ui/hooks/__tests__/useAppInitialization.test.tsx`
- Modify: `src/ui/state/AppStateProvider.tsx`
- Modify: `src/ui/__tests__/AppMapReturn.test.tsx`

**Interfaces:**

- Consumes: Task 1の現在版通知、SQLiteキー `lastAcknowledgedUpdateNoticeVersion`、既存グローバルモーダル状態。
- Produces: Contextの `currentAppUpdateNotice`, `appUpdateNoticeDialogSource`, `isAppUpdateNoticeDialogVisible`, `openLatestAppUpdateNotice`, `closeAppUpdateNotice`, `openAppStorePage`。

- [ ] **Step 1: 初期化フックの自動表示条件テストを書く**

`UseAppInitializationOptions` に次を追加する前提でテストを書く。

```ts
currentAppUpdateNotice: AppUpdateNotice | null;
openAutomaticAppUpdateNotice: () => void;
```

`getStringSetting('lastAcknowledgedUpdateNoticeVersion', '')` を読み、次を検証する。

- チュートリアル完了済み・未読・現在版通知ありなら `openAutomaticAppUpdateNotice()` を1回呼ぶ。
- チュートリアル未完了、既読、通知なしの各ケースでは呼ばない。
- 自動表示の判定は `refreshAchievementState` 後に行う。

- [ ] **Step 2: Provider統合の失敗テストを書く**

`AppMapReturn.test.tsx` で通知moduleを `version: '1.3.0'` のfixtureへ差し替え、`expo-application` の `nativeApplicationVersion` も `'1.3.0'` に固定して、次を検証する。

```ts
expect(setSettings).toHaveBeenCalledWith([
  { key: 'firstLaunchTutorialCompleted', value: true },
  { key: 'lastAcknowledgedUpdateNoticeVersion', value: '1.3.0' },
]);
```

さらに次をテストする。

- 既存ユーザーの未読現在版を自動表示する。
- 自動表示を閉じると `setSetting('lastAcknowledgedUpdateNoticeVersion', '1.3.0')` を呼ぶ。
- 既読版では表示しない。
- 初回チュートリアル中は表示せず、完了時にチュートリアルフラグと現在通知版を `setSettings` で原子的に保存する。
- 設定から再表示して閉じても既読設定を書かない。
- 実績通知、実績詳細、Paywall、初回チュートリアル、写真プレビュー、GPX処理のいずれかが表示中なら更新通知を待機し、解消後に表示する。
- ストアURLを開く処理が失敗してもダイアログを閉じず、警告ログを残す。
- 既読版の保存に失敗しても現在のダイアログは閉じ、警告ログを残す。

- [ ] **Step 3: 対象テストを実行して新しいオプションとContext値がないため失敗することを確認する**

Run: `npm test -- src/ui/hooks/__tests__/useAppInitialization.test.tsx src/ui/__tests__/AppMapReturn.test.tsx --runInBand`

Expected: FAIL on missing update-notice initialization/state behavior.

- [ ] **Step 4: 初期化フックへ既読版読み込みと自動表示予約を追加する**

Task 1の `LAST_ACKNOWLEDGED_UPDATE_NOTICE_VERSION_SETTING_KEY` をimportし、既存 `Promise.all` へ次を追加する。

```ts
getStringSetting(LAST_ACKNOWLEDGED_UPDATE_NOTICE_VERSION_SETTING_KEY, '');
```

初回チュートリアル分岐では、未完了なら従来どおりチュートリアルだけを表示する。完了済みなら初期化末尾で次を実行する。

```ts
if (
  shouldShowAutomaticAppUpdateNotice({
    currentNotice: currentAppUpdateNotice,
    firstLaunchTutorialCompleted: savedFirstLaunchTutorialCompleted,
    lastAcknowledgedVersion: savedLastAcknowledgedVersion,
  })
) {
  openAutomaticAppUpdateNotice();
}
```

- [ ] **Step 5: Providerへ通知状態・閉じ処理・ストア処理を追加する**

```ts
const currentAppUpdateNotice = resolveCurrentAppUpdateNotice(LATEST_UPDATE_NOTICE, Application.nativeApplicationVersion);
const [appUpdateNoticeDialogSource, setAppUpdateNoticeDialogSource] = useState<AppUpdateNoticeSource | null>(null);

const openAutomaticAppUpdateNotice = useCallback((): void => {
  setAppUpdateNoticeDialogSource('automatic');
}, []);

const hasBlockingGlobalModal = Boolean(
  isFirstLaunchTutorialVisible ||
  activeAchievementNotification ||
  selectedAchievement ||
  isPremiumPaywallVisible ||
  selectedPhoto ||
  selectedPhotoCluster ||
  isProcessingGpxImport,
);
const isAppUpdateNoticeDialogVisible = appUpdateNoticeDialogSource !== null && currentAppUpdateNotice !== null && !hasBlockingGlobalModal;
```

`openLatestAppUpdateNotice` は現在版通知がある場合だけ `settings` を設定する。`closeAppUpdateNotice` は先に表示元をnullへ戻し、元が `automatic` の場合だけ `setSetting(LAST_ACKNOWLEDGED_UPDATE_NOTICE_VERSION_SETTING_KEY, currentAppUpdateNotice.version)` を実行する。保存失敗は `console.warn` とし、閉じ操作は巻き戻さない。

`completeFirstLaunchTutorial` の初回表示分岐は `setSetting` から `setSettings` へ変更する。

```ts
const entries: AppSettingEntry[] = [{ key: FIRST_LAUNCH_TUTORIAL_COMPLETED_SETTING_KEY, value: true }];
if (currentAppUpdateNotice) {
  entries.push({ key: LAST_ACKNOWLEDGED_UPDATE_NOTICE_VERSION_SETTING_KEY, value: currentAppUpdateNotice.version });
}
setSettings(entries).catch((error: unknown) => {
  console.warn('Failed to persist first launch tutorial state:', error);
});
```

`openAppStorePage` は `Linking.openURL(getStrolliaStoreUrl(Platform.OS))` を呼び、失敗時は警告を残してダイアログ状態を変更しない。

- [ ] **Step 6: 初期化・Provider統合テストを通す**

Run: `npm test -- src/ui/hooks/__tests__/useAppInitialization.test.tsx src/ui/__tests__/AppMapReturn.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 7: コミットする**

```bash
git add src/ui/hooks/useAppInitialization.ts src/ui/hooks/__tests__/useAppInitialization.test.tsx src/ui/state/AppStateProvider.tsx src/ui/__tests__/AppMapReturn.test.tsx
git commit -m "feat(update): 更新通知の起動判定と既読管理を追加"
```

### Task 7: ルートダイアログと設定画面の配線

**Files:**

- Modify: `src/app/_layout.tsx`
- Modify: `src/app/__tests__/routerLayout.test.tsx`
- Modify: `src/app/settings/index.tsx`
- Modify: `src/ui/components/SettingsScreen.tsx`
- Modify: `src/ui/components/__tests__/SettingsScreen.test.tsx`
- Modify: `src/ui/__tests__/AppMapReturn.test.tsx`

**Interfaces:**

- Consumes: Task 5の `AppUpdateNoticeDialog` とTask 6のContext値・操作。
- Produces: 自動／設定起点のグローバル表示と「最新の更新内容を見る」設定導線。

- [ ] **Step 1: 設定ボタンの表示条件と順序の失敗テストを書く**

`SettingsScreenProps` へ次を追加する前提でテストを書く。

```ts
hasCurrentAppUpdateNotice: boolean;
onOpenLatestAppUpdateNotice: () => void;
```

`hasCurrentAppUpdateNotice=true` では「このアプリについて」の直後に「最新の更新内容を見る」を表示し、押下でコールバックを1回呼ぶ。falseではボタンを表示しない。

- [ ] **Step 2: ルート配線の失敗テストを書く**

`routerLayout.test.tsx` の `useAppState` mockへ通知状態を追加し、`AppUpdateNoticeDialog` mockが次を受け取ることを検証する。

```ts
expect(mockLatestUpdateNoticeDialogProps).toEqual(
  expect.objectContaining({
    visible: true,
    source: 'automatic',
    notice: expect.objectContaining({ version: '1.3.0' }),
  }),
);
```

`AppMapReturn.test.tsx` では設定画面のボタンから `source='settings'` で開き、ストアボタンが現れることを検証する。

- [ ] **Step 3: 対象テストを実行してpropsと配線がないため失敗することを確認する**

Run: `npm test -- src/ui/components/__tests__/SettingsScreen.test.tsx src/app/__tests__/routerLayout.test.tsx src/ui/__tests__/AppMapReturn.test.tsx --runInBand`

Expected: FAIL on missing SettingsScreen props and root dialog wiring.

- [ ] **Step 4: 設定画面へ条件付きActionPillを追加する**

「アプリ情報」内で「このアプリについて」の直後へ追加する。

```tsx
{
  hasCurrentAppUpdateNotice ? (
    <ActionPill
      alignLeft
      icon={<Feather name="gift" size={16} color={theme.name === 'dark' ? '#ffffff' : '#333333'} />}
      label="最新の更新内容を見る"
      styles={styles}
      onPress={onOpenLatestAppUpdateNotice}
    />
  ) : null;
}
```

`src/app/settings/index.tsx` は `hasCurrentAppUpdateNotice={s.currentAppUpdateNotice !== null}` と `onOpenLatestAppUpdateNotice={s.openLatestAppUpdateNotice}` を渡す。

- [ ] **Step 5: ルートレイアウトへグローバルDialogを追加する**

```tsx
<AppUpdateNoticeDialog
  visible={s.isAppUpdateNoticeDialogVisible}
  source={s.appUpdateNoticeDialogSource}
  notice={s.currentAppUpdateNotice}
  styles={s.styles}
  onClose={s.closeAppUpdateNotice}
  onOpenStorePage={s.openAppStorePage}
/>
```

初回チュートリアルなどとの排他判定はTask 6のProviderを単一ソースとし、ルート側で別の条件分岐を複製しない。

- [ ] **Step 6: 設定・ルート・統合テストを通す**

Run: `npm test -- src/ui/components/__tests__/SettingsScreen.test.tsx src/app/__tests__/routerLayout.test.tsx src/ui/__tests__/AppMapReturn.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 7: コミットする**

```bash
git add src/app/_layout.tsx src/app/__tests__/routerLayout.test.tsx src/app/settings/index.tsx src/ui/components/SettingsScreen.tsx src/ui/components/__tests__/SettingsScreen.test.tsx src/ui/__tests__/AppMapReturn.test.tsx
git commit -m "feat(update): 更新通知を設定画面とルートへ配線"
```

### Task 8: 全体検証と基準画像比較

**Files:**

- Modify if required by formatter only: files changed in Tasks 1–7

**Interfaces:**

- Consumes: Tasks 1–7の完成実装。
- Produces: 自動検証結果、基準画像との目視比較結果、クリーンな作業ツリー。

- [ ] **Step 1: 変更対象のPrettierを実行する**

Run:

```bash
npx prettier --write \
  src/features/app-update \
  src/config/storeUrls.ts \
  src/config/__tests__/storeUrls.test.ts \
  src/features/achievements/achievementDefinitions.ts \
  src/features/achievements/__tests__/achievementDefinitions.test.ts \
  src/ui/components/ScalableSvgCanvas.tsx \
  src/ui/components/AppUpdateNoticeSign.tsx \
  src/ui/components/AppUpdateNoticeDialog.tsx \
  src/ui/components/__tests__/ScalableSvgCanvas.test.tsx \
  src/ui/components/__tests__/AppUpdateNoticeSign.test.tsx \
  src/ui/components/__tests__/AppUpdateNoticeDialog.test.tsx \
  src/ui/hooks/useAppInitialization.ts \
  src/ui/hooks/__tests__/useAppInitialization.test.tsx \
  src/ui/state/AppStateProvider.tsx \
  src/ui/components/SettingsScreen.tsx \
  src/ui/components/__tests__/SettingsScreen.test.tsx \
  src/app/_layout.tsx \
  src/app/settings/index.tsx \
  src/app/__tests__/routerLayout.test.tsx \
  src/ui/__tests__/AppMapReturn.test.tsx \
  src/ui/styles/achievementStyles.ts \
  src/ui/__tests__/appStylesSplit.test.ts
```

Expected: formatter completes without error; inspect `git diff` to ensure no unrelated files changed.

- [ ] **Step 2: 全自動検証を実行する**

Run: `npm run typecheck`

Expected: exit 0.

Run: `npm run lint`

Expected: exit 0 with no lint errors.

Run: `npm run format:check`

Expected: exit 0.

Run: `npm test -- --runInBand --silent`

Expected: all suites PASS.

- [ ] **Step 3: SVGの線形スケーリングを数値で確認する**

コンポーネントテストに表示幅329と263.2（80%）のケースを置き、外側コンテナの縦横比が同一で、SVG内部の `fontSize=24`, `strokeWidth=4`, 座標値が再レンダー後も変化しないことを確認する。表示側の縮尺はviewBoxが0.8倍として適用するため、内部値を19.2や3.2へ書き換えない。

Run: `npm test -- src/ui/components/__tests__/ScalableSvgCanvas.test.tsx src/ui/components/__tests__/AppUpdateNoticeSign.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 4: 基準画像との目視比較を行う**

テスト用に一時的なfixtureを注入できるテスト環境だけで、幅329相当のfeature/fix、1件、2件、2件＋「など……」を表示する。ソースの `LATEST_UPDATE_NOTICE` は `null` から変更しない。

次を添付PDFの144dpiレンダリング／PNGと横並びで確認する。

- 外枠4単位、上帯31単位、青 `#0077CC`。
- 上帯文言が両種別とも1行。
- 大見出しの固定2行と更新内容欄の座標。
- 看板と内容欄は直角、版番号だけ丸棒。
- feature/fixとも補足文あり。
- 2件と「など……」では大見出しまで動かず、内容欄以下だけ下へ伸びる。
- 小さい表示幅でも文字、線、余白が同じ倍率で縮小される。

実機またはシミュレータを利用できない場合は、数値・コンポーネントテストまでを完了し、視覚検証未実施とPRに明記する。

- [ ] **Step 5: 最終差分を確認して検証コミットを作る**

Run: `git diff --check`

Expected: no output.

Run: `git status --short`

Expected: 変更がある場合はTasks 1–7の対象ファイルだけ。

フォーマットや視覚調整による変更がある場合だけコミットする。

```bash
git add \
  src/features/app-update \
  src/config/storeUrls.ts \
  src/config/__tests__/storeUrls.test.ts \
  src/features/achievements/achievementDefinitions.ts \
  src/features/achievements/__tests__/achievementDefinitions.test.ts \
  src/ui/components/ScalableSvgCanvas.tsx \
  src/ui/components/AppUpdateNoticeSign.tsx \
  src/ui/components/AppUpdateNoticeDialog.tsx \
  src/ui/components/__tests__/ScalableSvgCanvas.test.tsx \
  src/ui/components/__tests__/AppUpdateNoticeSign.test.tsx \
  src/ui/components/__tests__/AppUpdateNoticeDialog.test.tsx \
  src/ui/hooks/useAppInitialization.ts \
  src/ui/hooks/__tests__/useAppInitialization.test.tsx \
  src/ui/state/AppStateProvider.tsx \
  src/ui/components/SettingsScreen.tsx \
  src/ui/components/__tests__/SettingsScreen.test.tsx \
  src/app/_layout.tsx \
  src/app/settings/index.tsx \
  src/app/__tests__/routerLayout.test.tsx \
  src/ui/__tests__/AppMapReturn.test.tsx \
  src/ui/styles/achievementStyles.ts \
  src/ui/__tests__/appStylesSplit.test.ts
git commit -m "fix(update): 更新通知の表示を基準画像へ調整"
```

変更がなければ空コミットは作成しない。
