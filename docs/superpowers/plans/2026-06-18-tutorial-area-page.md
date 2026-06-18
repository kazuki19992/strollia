# Tutorial Area Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 初回起動チュートリアルへ、承認済みの文面と画像を使った「エリアを広げよう」ページを追加する。

**Architecture:** 既存の `FirstLaunchTutorialDialog` のステップ配列へ1ページ追加し、現在の画像枠を再利用する。画像サイズは現在の固定比率を画像アセットごとの `Image.resolveAssetSource` による比率へ置き換え、既存画像と新画像を同じ描画経路で安全に縮小する。

**Tech Stack:** React Native 0.81、React 19、TypeScript、Jest、react-test-renderer

---

## ファイル構成

- `assets/tutorial/area-instruction.png`: ユーザー提供のエリア説明画像。新ページで表示する。
- `src/app/components/FirstLaunchTutorialDialog.tsx`: ページ定義、段落、画像アセット、画像比率計算を実装する。
- `src/app/components/__tests__/FirstLaunchTutorialDialog.test.tsx`: 6ページの順序、2段落、画像、画像比率、完了・再表示動作を検証する。
- `docs/mvp.md`: 初回チュートリアルがエリア表示も説明することを記録する。

### Task 1: エリアページと画像比率対応をTDDで追加する

**Files:**
- Modify: `src/app/components/__tests__/FirstLaunchTutorialDialog.test.tsx:35-172`
- Modify: `src/app/components/FirstLaunchTutorialDialog.tsx:8-97`
- Add: `assets/tutorial/area-instruction.png`

- [ ] **Step 1: 6ページの順序とエリア本文を期待する失敗テストへ更新する**

`src/app/components/__tests__/FirstLaunchTutorialDialog.test.tsx` のページ遷移テストを、次の期待値へ更新する。本文2件をそれぞれ `toContain` で検証し、別々の `Text` として描画されることを保証する。

既存の `afterEach` には `jest.restoreAllMocks()` を追加し、画像情報の spy が他テストへ残らないようにする。

```tsx
afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  jest.restoreAllMocks();
  renderer = null;
});
```

```tsx
test('次へを押すと画面下の項目、エリア、実績、安全注意、権限案内の順に進む', () => {
  act(() => {
    renderer = create(<FirstLaunchTutorialDialog visible styles={styles} onComplete={jest.fn()} />);
  });

  press('次へ');
  expect(visibleTexts()).toContain('画面下の項目');
  expect(visibleTexts()).toContain('2 / 6');

  press('次へ');
  expect(visibleTexts()).toContain('エリアを広げよう');
  expect(visibleTexts()).toContain('3 / 6');
  expect(visibleTexts()).toContain('地図上で薄く色が塗られているマスを、Strolliaでは「エリア」と呼びます。');
  expect(visibleTexts()).toContain('歩いた場所がエリアとして記録され、地図に少しずつ広がっていきます。いろいろな道を歩いて、自分だけの地図を育てていきましょう。');
  expect(renderer!.root.findByType(Image).props.accessibilityLabel).toBe('地図上のエリアの説明');

  press('次へ');
  expect(visibleTexts()).toContain('実績を集める');
  expect(visibleTexts()).toContain('4 / 6');

  press('次へ');
  expect(visibleTexts()).toContain('さいごに');
  expect(visibleTexts()).toContain('5 / 6');
  expect(visibleTexts()).toContain('安全に楽しくおさんぽするために、次のことを守りましょう。');
  expect(visibleTexts()).toContain('立入禁止の場所や私有地に入らない');
  expect(visibleTexts()).toContain('交通ルールを守り、まわりに注意する');
  expect(visibleTexts()).toContain('危険な場所には近づかない、入らない');
  expect(visibleTexts()).toContain('体調が悪くなったら無理に続けない');

  press('次へ');
  expect(visibleTexts()).toContain('位置情報を確認してはじめる');
  expect(visibleTexts()).toContain('6 / 6');
  expect(visibleTexts()).toContain('GPSログの記録には位置情報の常時許可が必要です。');
  expect(visibleTexts()).toContain('チュートリアルを閉じたあと、地図上に表示される位置情報の案内パネルから続けられます。');
});
```

最初のページ数期待値を `1 / 6` に変更し、完了・再表示テストでは最終ページへ進むための `press('次へ')` を1回ずつ追加する。再表示直前は `6 / 6`、再表示後は `1 / 6` を期待する。

- [ ] **Step 2: 関連テストを実行し、新ページ未実装で失敗することを確認する**

Run:

```bash
npm test -- --runInBand src/app/components/__tests__/FirstLaunchTutorialDialog.test.tsx
```

Expected: FAIL。`1 / 6` が見つからず、既存実装が `1 / 5` を表示していることが示される。

- [ ] **Step 3: 画像ごとの比率を期待する失敗テストを追加する**

同じテストファイルで、画像アセットを識別しながら元サイズを返す spy をテスト内で使用する。

```tsx
const areaInstructionImage = require('../../../../assets/tutorial/area-instruction.png');

test('補足画像ごとのアスペクト比を保って画像枠内に表示する', () => {
  jest.spyOn(Image, 'resolveAssetSource').mockImplementation((source) => {
    if (source === areaInstructionImage) {
      return { width: 903, height: 540, scale: 1, uri: 'area-instruction.png' };
    }
    return { width: 453, height: 279, scale: 1, uri: 'home-screen-instruction.png' };
  });

  act(() => {
    renderer = create(<FirstLaunchTutorialDialog visible styles={styles} onComplete={jest.fn()} />);
  });

  press('次へ');
  const instructionImageFrame = renderer!.root.findAllByType(View).find(
    (node: any) => node.props.style === styles.firstLaunchTutorialInstructionImageFrame,
  );
  act(() => {
    instructionImageFrame!.props.onLayout({ nativeEvent: { layout: { width: 300 } } });
  });
  expect(renderer!.root.findByType(Image).props.style).toEqual([
    styles.firstLaunchTutorialInstructionImage,
    { width: 268, height: 268 / (453 / 279) },
  ]);

  press('次へ');
  expect(renderer!.root.findByType(Image).props.style).toEqual([
    styles.firstLaunchTutorialInstructionImage,
    { width: 268, height: 268 / (903 / 540) },
  ]);
  expect(styles.firstLaunchTutorialInstructionImage).not.toEqual(expect.objectContaining({ width: '100%' }));
  expect(styles.firstLaunchTutorialInstructionImage).not.toEqual(expect.objectContaining({ alignSelf: 'stretch' }));

});
```

同じテストファイルへ、無効な元サイズでは既存画像比率へフォールバックするケースも追加する。

```tsx
test('補足画像の元サイズを取得できないときは既存画像比率へフォールバックする', () => {
  jest.spyOn(Image, 'resolveAssetSource').mockReturnValue({
    width: 0,
    height: 0,
    scale: 1,
    uri: 'invalid-instruction.png',
  });
  act(() => {
    renderer = create(<FirstLaunchTutorialDialog visible styles={styles} onComplete={jest.fn()} />);
  });

  press('次へ');
  const instructionImageFrame = renderer!.root.findAllByType(View).find(
    (node: any) => node.props.style === styles.firstLaunchTutorialInstructionImageFrame,
  );
  act(() => {
    instructionImageFrame!.props.onLayout({ nativeEvent: { layout: { width: 300 } } });
  });

  expect(renderer!.root.findByType(Image).props.style).toEqual([
    styles.firstLaunchTutorialInstructionImage,
    { width: 268, height: 268 / (453 / 279) },
  ]);
});
```

- [ ] **Step 4: 関連テストを実行し、固定比率のため失敗することを確認する**

Run:

```bash
npm test -- --runInBand src/app/components/__tests__/FirstLaunchTutorialDialog.test.tsx
```

Expected: FAIL。エリア画像の期待高さ `268 / (903 / 540)` に対し、既存の固定比率 `268 / (453 / 279)` が返る。

- [ ] **Step 5: エリアページと画像ごとのアスペクト比計算を実装する**

`src/app/components/FirstLaunchTutorialDialog.tsx` の固定比率をフォールバックへ改名し、入力画像から安全に比率を解決する小関数を追加する。

```tsx
const FALLBACK_INSTRUCTION_IMAGE_ASPECT_RATIO = 453 / 279;
const INSTRUCTION_IMAGE_HORIZONTAL_PADDING = 16;

/** 補足画像の元サイズから、安全に表示用アスペクト比を解決する。 */
function resolveInstructionImageAspectRatio(source?: ImageSourcePropType): number {
  if (!source) {
    return FALLBACK_INSTRUCTION_IMAGE_ASPECT_RATIO;
  }

  const asset = Image.resolveAssetSource(source);
  if (!asset || asset.width <= 0 || asset.height <= 0) {
    return FALLBACK_INSTRUCTION_IMAGE_ASPECT_RATIO;
  }

  return asset.width / asset.height;
}
```

`TUTORIAL_STEPS` の「画面下の項目」と「実績を集める」の間へ、承認済み文面を2要素の `paragraphs` として追加する。

```tsx
{
  title: 'エリアを広げよう',
  instructionImage: require('../../../assets/tutorial/area-instruction.png'),
  instructionImageAccessibilityLabel: '地図上のエリアの説明',
  paragraphs: [
    '地図上で薄く色が塗られているマスを、Strolliaでは「エリア」と呼びます。',
    '歩いた場所がエリアとして記録され、地図に少しずつ広がっていきます。いろいろな道を歩いて、自分だけの地図を育てていきましょう。',
  ],
},
```

コンポーネント内のサイズ計算は現在のステップ画像から比率を求める。

```tsx
const instructionImageAspectRatio = resolveInstructionImageAspectRatio(currentStep.instructionImage);
const instructionImageWidth = Math.max(0, instructionImageFrameWidth - INSTRUCTION_IMAGE_HORIZONTAL_PADDING * 2);
const instructionImageSize = {
  width: instructionImageWidth,
  height: instructionImageWidth / instructionImageAspectRatio,
};
```

- [ ] **Step 6: 関連テストを実行して通過を確認する**

Run:

```bash
npm test -- --runInBand src/app/components/__tests__/FirstLaunchTutorialDialog.test.tsx
```

Expected: PASS。全テストが成功し、Jest の open handle 警告がない。

- [ ] **Step 7: 実装・テスト・画像をコミットする**

```bash
git add assets/tutorial/area-instruction.png src/app/components/FirstLaunchTutorialDialog.tsx src/app/components/__tests__/FirstLaunchTutorialDialog.test.tsx
git commit -m "feat(tutorial): エリア説明ページを追加"
```

### Task 2: MVPドキュメントを更新する

**Files:**
- Modify: `docs/mvp.md:26`

- [ ] **Step 1: チュートリアル説明へエリア案内を追記する**

`docs/mvp.md` の初回チュートリアル説明を次の文へ置き換える。

```markdown
初回起動時は、共通ダイアログでアプリ概要、画面下の主要項目、地図上のエリア表示、実績システム、安全に歩くための注意事項、位置情報権限の開始導線を順番に案内する。権限要求はチュートリアル内では実行せず、チュートリアルを閉じたあとに地図上の位置情報案内パネルから続けられることを伝える。完了後も設定画面の「チュートリアル」から同じ内容を再表示できる。
```

- [ ] **Step 2: ドキュメント差分を確認する**

Run:

```bash
git diff -- docs/mvp.md
```

Expected: チュートリアル案内へ `地図上のエリア表示` だけが追加され、他の仕様は変わっていない。

- [ ] **Step 3: ドキュメントをコミットする**

```bash
git add docs/mvp.md
git commit -m "docs(tutorial): エリア案内をMVP仕様へ追記"
```

### Task 3: 全体検証を行う

**Files:**
- Verify: `src/app/components/FirstLaunchTutorialDialog.tsx`
- Verify: `src/app/components/__tests__/FirstLaunchTutorialDialog.test.tsx`
- Verify: `docs/mvp.md`

- [ ] **Step 1: 型チェックを実行する**

Run:

```bash
npm run typecheck
```

Expected: exit code 0、TypeScriptエラーなし。

- [ ] **Step 2: 全テストを実行する**

Run:

```bash
npm test -- --runInBand
```

Expected: exit code 0、全テスト成功。

- [ ] **Step 3: 差分の空白エラーと作業ツリーを確認する**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` は出力なし。`git status --short` は空で、未コミット変更なし。
