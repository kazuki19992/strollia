# スタンプラリーパックのトロフィーアイコンSVG化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スタンプラリー(スポット訪問実績)パックのトロフィーアイコンを、手作業PNGからSVGマスタ+自動生成PNGの二本立てへ切り替える。実績画面のパック行には新しくSVGを直接描画し、プッシュ通知添付・汎用実績システムは変更せずそのまま動かす。

**Architecture:** パックの完走トロフィーを「表示用SVG(`trophyIcon`)」と「通知添付・汎用実績システム互換用の生成PNG(`trophyImage`)」に役割分離する。SVGを唯一のマスタとし、PNGはビルドスクリプトで`sharp`を使い自動生成する(手作業PNG作成を廃止)。Metroには`react-native-svg-transformer`を配線し、`.svg`をReactコンポーネントとして直接importできるようにする。汎用実績システム(`achievementDefinitions.ts`・通知・各種モーダル)は一切変更しない。

**Tech Stack:** Expo ~57 / React Native 0.86 / TypeScript ~6.0 (strict) / react-native-svg 15.15.4 / react-native-svg-transformer(Metro変換) / sharp(Node側PNG生成、devDependency) / jest + jest-expo + @testing-library/react-native

**Spec:** `docs/superpowers/specs/2026-10-07-landmark-pack-svg-trophy-design.md`

## Global Constraints

- コミットは Semantic Commit Message(`type(scope): 日本語の説明`)。type は英語、説明は日本語
- JSDoc は日本語。「何をするか」に加え必要なら「なぜその設計か」も書く
- `describe` / `test` / `it` の説明文は日本語
- import は `@/` エイリアス。`../` を含む相対 import は ESLint error(同一ディレクトリ内は `./`)
- TypeScript strict。`any` を使わない
- 各タスクの最後に `npm run typecheck` / `npm test` / `npm run lint` を通してからコミットする。lint は error 0 が合格条件
- 作業ディレクトリは worktree `/Users/kazuki19992/gits/footspot/.worktrees/claude-landmark-pack-svg-icon`(ブランチ `claude/landmark-pack-svg-icon`)
- `achievementDefinitions.ts`・`achievementNotificationService.ts`・`AchievementScroller.tsx`・`AchievementDialog.tsx`・`AchievementUnlockModal.tsx`・`MonthlyReportScreen.tsx` は変更しない(設計書§4)
- `resolveLandmarkTrophyDisplayState` の3状態ロジック(`dim`/`grayscale`/`color`)は変更しない

---

## File Structure

| ファイル                                                                  | 変更内容                                                                                                               |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `metro.config.js`                                                         | `react-native-svg-transformer` を配線し `.svg` をコンポーネントとしてimport可能にする                                  |
| `src/types/svg.d.ts`                                                      | `*.svg` importの型宣言(新規)                                                                                           |
| `__mocks__/svgMock.js`                                                    | Jestでの `.svg` importモック(新規)                                                                                     |
| `package.json`                                                            | `sharp` をdevDependencyに追加、jestの`moduleNameMapper`に`.svg`マッピング追加、`generate:landmarks`スクリプトを2段階化 |
| `assets/achievements/spots/svg/japan-falls-3.svg`                         | トロフィーSVGマスタ(新規)                                                                                              |
| `scripts/generate-landmark-trophy-pngs.mjs`                               | SVG→PNG自動生成スクリプト(新規)                                                                                        |
| `assets/achievements/spots/spots-japan-falls-3.png`                       | 削除(新しい生成PNGへ置き換え)                                                                                          |
| `data/landmarks/landmarkPacks.schema.json`                                | `trophyIcon` を必須項目として追加                                                                                      |
| `data/landmarks/landmarkPacks.json`                                       | `trophyIcon` 追加、`trophyImage` の値を新しいPNG名へ変更                                                               |
| `scripts/generate-landmark-catalog.mjs`                                   | 生成テンプレート・型に `trophyIcon` を追加                                                                             |
| `src/features/landmarks/landmarkCatalog.generated.ts`                     | 生成物(再生成)                                                                                                         |
| `src/features/landmarks/__tests__/landmarkCatalog.test.ts`                | `trophyIcon` の検証テスト追加                                                                                          |
| `src/ui/components/__tests__/LandmarkPackScreen.test.tsx`                 | フィクスチャに `trophyIcon` 追加                                                                                       |
| `src/ui/components/__tests__/AchievementListScreenLandmarkPacks.test.tsx` | フィクスチャに `trophyIcon` 追加、SVG描画テスト追加                                                                    |
| `src/ui/components/AchievementListScreen.tsx`                             | パック行トロフィーの描画を `Image` から `trophyIcon` コンポーネントへ変更                                              |
| `docs/todo.md` / `docs/landmark-spot-packs.md` / `docs/achievements.md`   | SVG+生成PNGパイプラインの記述反映                                                                                      |

---

## Task 1: SVGインフラ整備(Metro・Jest・型宣言・sharp依存)

**Files:**

- Modify: `metro.config.js`
- Modify: `package.json`
- Create: `src/types/svg.d.ts`
- Create: `__mocks__/svgMock.js`

**Interfaces:**

- Produces: `.svg` ファイルを `import Foo from './foo.svg'` でReactコンポーネント(`ComponentType<SvgProps>`)としてimportできる状態(Metro実機・Jestテストの両方で)

- [ ] **Step 1: `metro.config.js` に `react-native-svg-transformer` を配線する**

`metro.config.js` の現状:

```js
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
```

以下へ置き換える。

```js
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};
config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
};

module.exports = config;
```

- [ ] **Step 2: `*.svg` importのTypeScript型宣言を追加する**

`src/types/svg.d.ts`(新規):

```typescript
/**
 * react-native-svg-transformer(Metro)経由で `.svg` をReactコンポーネントとしてimportできるようにする型宣言。
 * 実体は無く、変換後の形(SvgPropsを受け取るコンポーネント)を型として示すだけ。
 */
declare module '*.svg' {
  import { ComponentType } from 'react';
  import { SvgProps } from 'react-native-svg';

  const content: ComponentType<SvgProps>;
  export default content;
}
```

- [ ] **Step 3: Jestでの `.svg` importモックを追加する**

`__mocks__/svgMock.js`(新規):

```js
/**
 * Jestでの `.svg` import 用モック。
 *
 * react-native-svg-transformer公式READMEは `module.exports = "SvgMock"`(文字列)を示すが、
 * 文字列は有効なReact Native組み込みコンポーネント名として登録されていないため、
 * @testing-library/react-native 経由でレンダーすると失敗する。
 * 既存のモック方針(@expo/vector-icons を react-native の Text で代替する等)に合わせ、
 * 実在するコンポーネント(View)を返す。
 */
module.exports = require('react-native').View;
```

- [ ] **Step 4: `package.json` のJest設定へ `.svg` のmoduleNameMapperを追加する**

`package.json` 内 `jest.moduleNameMapper` の現状:

```json
    "moduleNameMapper": {
      "^@/(.*)$": "<rootDir>/src/$1",
      "^@modules/(.*)$": "<rootDir>/modules/$1"
    },
```

以下へ置き換える。

```json
    "moduleNameMapper": {
      "^@/(.*)$": "<rootDir>/src/$1",
      "^@modules/(.*)$": "<rootDir>/modules/$1",
      "\\.svg$": "<rootDir>/__mocks__/svgMock.js"
    },
```

- [ ] **Step 5: `sharp` をdevDependencyへ追加する**

`package.json` の `devDependencies` 内、`"react-native-svg-transformer": "^1.5.3",` の直後に以下を追加する(アルファベット順)。

```json
    "sharp": "^0.33.5",
```

- [ ] **Step 6: 依存をインストールする**

```bash
npm install
```

Expected: `sharp` が `node_modules` へ追加され、`package-lock.json` が更新される。

- [ ] **Step 7: 既存テスト・型チェック・lintに影響が無いことを確認する**

```bash
npm run typecheck && npm test && npm run lint
```

Expected: この時点ではまだ `.svg` をimportするコードが無いため、既存の結果(全件PASS、lint error 0)から変化がないこと。

- [ ] **Step 8: コミット**

```bash
git add metro.config.js src/types/svg.d.ts __mocks__/svgMock.js package.json package-lock.json
git commit -m "build(landmarks): SVGアイコン用のMetro/Jest設定とsharp依存を追加"
```

---

## Task 2: トロフィーSVGマスタとPNG自動生成スクリプト

**Files:**

- Create: `assets/achievements/spots/svg/japan-falls-3.svg`
- Create: `scripts/generate-landmark-trophy-pngs.mjs`
- Modify: `package.json`(`generate:landmarks` スクリプト)

**Interfaces:**

- Consumes: Task 1 の `sharp` 依存
- Produces: `assets/achievements/spots/svg/*.svg` を入力に、同名の `assets/achievements/spots/*.png`(600×600、透過)を出力するビルドスクリプト。パックJSONの内容には依存しない(ファイル名のみで1:1対応する)

- [ ] **Step 1: トロフィーSVGマスタを作成する**

`assets/achievements/spots/svg/japan-falls-3.svg`(新規)。日本三名瀑を表す、濃紺の円背景+山の稜線+3本の滝筋+水しぶきのシンプルな幾何学的フラットデザイン。

```xml
<svg width="600" height="600" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
  <circle cx="300" cy="300" r="300" fill="#0D47A1" />
  <path d="M40 420 L210 190 L300 300 L390 170 L560 420 Z" fill="#0B3C91" />
  <rect x="195" y="260" width="34" height="220" rx="17" fill="#90CAF9" />
  <rect x="283" y="220" width="34" height="260" rx="17" fill="#BBDEFB" />
  <rect x="371" y="260" width="34" height="220" rx="17" fill="#90CAF9" />
  <ellipse cx="212" cy="486" rx="46" ry="16" fill="#E3F2FD" opacity="0.9" />
  <ellipse cx="300" cy="494" rx="52" ry="18" fill="#E3F2FD" opacity="0.95" />
  <ellipse cx="388" cy="486" rx="46" ry="16" fill="#E3F2FD" opacity="0.9" />
</svg>
```

- [ ] **Step 2: PNG自動生成スクリプトを書く**

`scripts/generate-landmark-trophy-pngs.mjs`(新規)。

```js
/**
 * assets/achievements/spots/svg/ 配下の全SVGから、同名の透過PNG(600×600)を生成する。
 *
 * パックトロフィーの絵柄はSVGをマスタとして手書きし、プッシュ通知添付・汎用実績システムが
 * 要求する実ファイルのPNGはここで自動生成する(手作業でPNGを用意しない)。
 * パックJSONの内容には依存せず、SVGファイル名から機械的にPNGファイル名を決める。
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svgDir = resolve(rootDir, 'assets/achievements/spots/svg');
const outputDir = resolve(rootDir, 'assets/achievements/spots');

const TROPHY_SIZE = 600;

const svgFiles = readdirSync(svgDir).filter((fileName) => fileName.endsWith('.svg'));

if (svgFiles.length === 0) {
  console.error(`SVGファイルが見つかりません: ${svgDir}`);
  process.exit(1);
}

await Promise.all(
  svgFiles.map(async (fileName) => {
    const svgPath = resolve(svgDir, fileName);
    const pngFileName = fileName.replace(/\.svg$/, '.png');
    const pngPath = resolve(outputDir, pngFileName);

    const svgBuffer = readFileSync(svgPath);
    const pngBuffer = await sharp(svgBuffer, { density: 300 })
      .resize(TROPHY_SIZE, TROPHY_SIZE)
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();

    writeFileSync(pngPath, pngBuffer);
    console.log(`トロフィーPNGを生成しました: ${pngPath}`);
  }),
);
```

- [ ] **Step 3: スクリプトを実行してPNGが生成されることを確認する**

```bash
node scripts/generate-landmark-trophy-pngs.mjs
```

Expected: `トロフィーPNGを生成しました: .../assets/achievements/spots/japan-falls-3.png` が出力され、該当ファイルが作成される。

```bash
node -e "import('sharp').then(({ default: sharp }) => sharp('assets/achievements/spots/japan-falls-3.png').metadata().then((m) => console.log(m.width, m.height, m.format, m.hasAlpha)))"
```

Expected: `600 600 png true`

- [ ] **Step 4: `generate:landmarks` npm scriptを2段階化する**

`package.json` の現状:

```json
    "generate:landmarks": "node scripts/generate-landmark-catalog.mjs",
```

以下へ置き換える。

```json
    "generate:landmarks": "node scripts/generate-landmark-trophy-pngs.mjs && node scripts/generate-landmark-catalog.mjs",
```

- [ ] **Step 5: `npm run generate:landmarks` を実行して両方のスクリプトが連続して成功することを確認する**

```bash
npm run generate:landmarks
```

Expected: トロフィーPNG生成のログに続けて、`landmark catalog を生成しました: ...` が出力される(この時点ではまだ `landmarkPacks.json` に `trophyIcon` が無いため、カタログの中身自体はTask 1以前と同じ)。

- [ ] **Step 6: 型チェック・テスト・lintを通してコミット**

```bash
npm run typecheck && npm test && npm run lint
git add assets/achievements/spots/svg scripts/generate-landmark-trophy-pngs.mjs package.json
git commit -m "feat(landmarks): トロフィーSVGマスタとPNG自動生成スクリプトを追加"
```

---

## Task 3: データモデルに `trophyIcon` を追加する

**Files:**

- Modify: `data/landmarks/landmarkPacks.schema.json`
- Modify: `data/landmarks/landmarkPacks.json`
- Modify: `scripts/generate-landmark-catalog.mjs`
- Modify: `src/features/landmarks/landmarkCatalog.generated.ts`(生成物。手動編集せず本タスクのStepで再生成する)
- Modify: `src/features/landmarks/__tests__/landmarkCatalog.test.ts`
- Modify: `src/ui/components/__tests__/LandmarkPackScreen.test.tsx`
- Modify: `src/ui/components/__tests__/AchievementListScreenLandmarkPacks.test.tsx`
- Delete: `assets/achievements/spots/spots-japan-falls-3.png`

**Interfaces:**

- Consumes: Task 2 で生成された `assets/achievements/spots/japan-falls-3.png`
- Produces:
  - `GeneratedLandmarkPack.trophyIcon: ComponentType<SvgProps>`(生成物の型)
  - `LandmarkPack.trophyIcon: ComponentType<SvgProps>`(`GeneratedLandmarkPack & { trophyImageUri }` の合成型に自動で乗る。追加の型定義は不要)

- [ ] **Step 1: スキーマへ `trophyIcon` を必須項目として追加する**

`data/landmarks/landmarkPacks.schema.json` を以下へ置き換える。

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://strollia.app/schemas/landmarkPacks.schema.json",
  "title": "Strollia landmark packs",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["id", "name", "description", "trophyImage", "trophyIcon", "sortOrder", "isFree"],
    "additionalProperties": false,
    "properties": {
      "id": {
        "type": "string",
        "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
      },
      "name": { "type": "string", "minLength": 1 },
      "description": { "type": "string", "minLength": 1 },
      "trophyImage": { "type": "string", "pattern": "^[a-z0-9-]+\\.png$" },
      "trophyIcon": {
        "type": "string",
        "pattern": "^[a-z0-9-]+$",
        "description": "SVGアイコンの識別子。assets/achievements/spots/svg/<値>.svg がマスタ。trophyImageのPNGはこのSVGから生成する"
      },
      "sortOrder": { "type": "integer", "minimum": 1 },
      "isFree": {
        "type": "boolean",
        "description": "trueなら無料で誰でも到達検知・完走できる。falseならStrollia Plusのサブスクが必要"
      }
    }
  }
}
```

- [ ] **Step 2: パックJSONへ `trophyIcon` を追加し `trophyImage` の値を新しいPNG名へ変更する**

`data/landmarks/landmarkPacks.json` を以下へ置き換える。

```json
[
  {
    "id": "01a0c450-6c00-7000-8000-000000000001",
    "name": "日本三名瀑",
    "description": "日本を代表する3つの名瀑",
    "trophyImage": "japan-falls-3.png",
    "trophyIcon": "japan-falls-3",
    "sortOrder": 100,
    "isFree": true
  }
]
```

- [ ] **Step 3: 古いPNGアセットを削除する**

Task 2で生成した `japan-falls-3.png` が同じ役割を引き継ぐため、手作業で用意されていた旧ファイルを削除する。

```bash
git rm assets/achievements/spots/spots-japan-falls-3.png
```

- [ ] **Step 4: 生成スクリプトのテンプレートへ `trophyIcon` を通す**

`scripts/generate-landmark-catalog.mjs` の `packEntries` 生成部分の既存ブロック:

```js
return `  {
    id: ${toLiteral(pack.id)},
    name: ${toLiteral(pack.name)},
    description: ${toLiteral(pack.description)},
    // 所属スポット: ${memberNames}
    trophyImage: require('../../../assets/achievements/spots/${pack.trophyImage}'),
    sortOrder: ${pack.sortOrder},
    isFree: ${pack.isFree},
  },`;
```

以下へ置き換える。

```js
return `  {
    id: ${toLiteral(pack.id)},
    name: ${toLiteral(pack.name)},
    description: ${toLiteral(pack.description)},
    // 所属スポット: ${memberNames}
    trophyImage: require('../../../assets/achievements/spots/${pack.trophyImage}'),
    trophyIcon: require('../../../assets/achievements/spots/svg/${pack.trophyIcon}.svg').default,
    sortOrder: ${pack.sortOrder},
    isFree: ${pack.isFree},
  },`;
```

同ファイル内、生成出力テンプレート先頭のimport部分の既存ブロック:

```js
const output = `/**
 * data/landmarks のJSONから生成したスポット実績カタログ。
 * 手動編集せず、npm run generate:landmarks で再生成する。
 */
import type { ImageSourcePropType } from 'react-native';
```

以下へ置き換える。

```js
const output = `/**
 * data/landmarks のJSONから生成したスポット実績カタログ。
 * 手動編集せず、npm run generate:landmarks で再生成する。
 */
import type { ComponentType } from 'react';
import type { ImageSourcePropType } from 'react-native';
import type { SvgProps } from 'react-native-svg';
```

`GeneratedLandmarkPack` 型定義ブロックの既存ブロック:

```js
/** スポットの集合。完走で実績が解除される単位。 */
export type GeneratedLandmarkPack = {
  /** UUIDv7。 */
  id: string;
  /** 表示名。 */
  name: string;
  /** 一覧行のサブタイトルに表示する説明。 */
  description: string;
  /** 完走トロフィー画像。 */
  trophyImage: ImageSourcePropType;
  /** 一覧の表示順。 */
  sortOrder: number;
  /** trueなら無料で誰でも到達検知・完走できる。falseならStrollia Plusのサブスクが必要。 */
  isFree: boolean;
};
```

以下へ置き換える。

```js
/** スポットの集合。完走で実績が解除される単位。 */
export type GeneratedLandmarkPack = {
  /** UUIDv7。 */
  id: string;
  /** 表示名。 */
  name: string;
  /** 一覧行のサブタイトルに表示する説明。 */
  description: string;
  /** 完走トロフィー画像(通知添付・汎用実績システム互換用のPNG。trophyIconのSVGから生成する)。 */
  trophyImage: ImageSourcePropType;
  /** 一覧行に表示するSVGトロフィーアイコン(表示用のマスタ)。 */
  trophyIcon: ComponentType<SvgProps>;
  /** 一覧の表示順。 */
  sortOrder: number;
  /** trueなら無料で誰でも到達検知・完走できる。falseならStrollia Plusのサブスクが必要。 */
  isFree: boolean;
};
```

- [ ] **Step 5: カタログを再生成する**

```bash
npm run generate:landmarks
```

Expected: `landmark catalog を生成しました: ...` と出力され、`src/features/landmarks/landmarkCatalog.generated.ts` の `GENERATED_LANDMARK_PACKS` に `trophyIcon: require('../../../assets/achievements/spots/svg/japan-falls-3.svg').default` が含まれる。`git diff src/features/landmarks/landmarkCatalog.generated.ts` で確認する。

- [ ] **Step 6: `landmarkCatalog.test.ts` に `trophyIcon` の検証テストを追加する**

`src/features/landmarks/__tests__/landmarkCatalog.test.ts` を開き、既存の `'全パックがisFreeを持つ'` テストの直後に追加する。

```typescript
it('全パックがtrophyIconを持つ', () => {
  for (const pack of LANDMARK_PACKS) {
    expect(pack.trophyIcon).toBeDefined();
  }
});
```

- [ ] **Step 7: 型チェックを実行し、残りの壊れたフィクスチャを洗い出す**

```bash
npm run typecheck
```

Expected: `src/ui/components/__tests__/LandmarkPackScreen.test.tsx` と `src/ui/components/__tests__/AchievementListScreenLandmarkPacks.test.tsx` が、`LandmarkPack` / `LandmarkPackListItem` の型に `trophyIcon` が無いというエラーで失敗する(両ファイルとも `trophyImage` / `trophyImageUri` を明示的な型注釈付きオブジェクトリテラルで持っている)。

- [ ] **Step 8: `LandmarkPackScreen.test.tsx` のフィクスチャへ `trophyIcon` を追加する**

`src/ui/components/__tests__/LandmarkPackScreen.test.tsx` 内の以下のブロックを探す。

```typescript
const pack: LandmarkPack = {
  id: '01a0c450-6c00-7000-8000-000000000001',
  name: '日本三名瀑',
  description: '日本を代表する3つの名瀑',
  trophyImage: 1,
  trophyImageUri: null,
  sortOrder: 100,
  isFree: true,
};
```

以下へ置き換える(この画面はトロフィーアイコンを描画しないため、型を満たすだけの最小値でよい)。

```typescript
const pack: LandmarkPack = {
  id: '01a0c450-6c00-7000-8000-000000000001',
  name: '日本三名瀑',
  description: '日本を代表する3つの名瀑',
  trophyImage: 1,
  trophyIcon: () => null,
  trophyImageUri: null,
  sortOrder: 100,
  isFree: true,
};
```

- [ ] **Step 9: `AchievementListScreenLandmarkPacks.test.tsx` のフィクスチャへ `trophyIcon` を追加する**

`src/ui/components/__tests__/AchievementListScreenLandmarkPacks.test.tsx` 内の以下のブロックを探す。

```tsx
const styles = createStyles(lightTheme);

/** テスト用の日本三名瀑パック行(2/3到達)。 */
const fallsPackItem: LandmarkPackListItem = {
  pack: {
    id: '01a0c450-6c00-7000-8000-000000000001',
    name: '日本三名瀑',
    description: '日本を代表する3つの名瀑',
    trophyImage: 1,
    trophyImageUri: null,
    sortOrder: 100,
    isFree: true,
  },
  visitedCount: 2,
  totalCount: 3,
  isLocked: false,
};
```

以下へ置き換える(Task 4でこの `MockTrophyIcon` を使って「SVGが実際に描画されているか」を検証する)。

```tsx
const styles = createStyles(lightTheme);

/** テスト用のトロフィーSVGアイコンモック。実体を描画する必要はなく、コンポーネント型として参照できれば十分。 */
function MockTrophyIcon() {
  return null;
}

/** テスト用の日本三名瀑パック行(2/3到達)。 */
const fallsPackItem: LandmarkPackListItem = {
  pack: {
    id: '01a0c450-6c00-7000-8000-000000000001',
    name: '日本三名瀑',
    description: '日本を代表する3つの名瀑',
    trophyImage: 1,
    trophyIcon: MockTrophyIcon,
    trophyImageUri: null,
    sortOrder: 100,
    isFree: true,
  },
  visitedCount: 2,
  totalCount: 3,
  isLocked: false,
};
```

- [ ] **Step 10: 型チェック・テスト・lintを通す**

```bash
npm run typecheck && npm test && npm run lint
```

- [ ] **Step 11: コミット**

```bash
git add data/landmarks scripts/generate-landmark-catalog.mjs src/features/landmarks src/ui/components/__tests__/LandmarkPackScreen.test.tsx src/ui/components/__tests__/AchievementListScreenLandmarkPacks.test.tsx
git add -u assets/achievements/spots
git commit -m "feat(landmarks): パックにtrophyIconフィールドを追加し日本三名瀑をSVGアイコンへ切替"
```

---

## Task 4: `AchievementListScreen` のパック行トロフィーをSVGで描画する

**Files:**

- Modify: `src/ui/components/AchievementListScreen.tsx`
- Modify: `src/ui/components/__tests__/AchievementListScreenLandmarkPacks.test.tsx`

**Interfaces:**

- Consumes: Task 3 の `LandmarkPackListItem.pack.trophyIcon: ComponentType<SvgProps>`、Task 3 Step 9 の `MockTrophyIcon`

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/components/__tests__/AchievementListScreenLandmarkPacks.test.tsx` 内、`'進捗バーへ到達率を渡す'` テストの直後に追加する。

```tsx
it('パック行のトロフィーをSVGアイコンで描画する', () => {
  renderScreen();

  // UNSAFE_: コンポーネント型検索はtesting.mdが明示的に許容する例外。
  // トロフィーの実体はSVGで、accessibilityLabel等では「どのコンポーネントが描画されたか」を確認できない
  expect(screen.UNSAFE_getByType(MockTrophyIcon)).toBeTruthy();
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- AchievementListScreenLandmarkPacks`
Expected: FAIL(`MockTrophyIcon` がまだ描画されていない。`AchievementListScreen.tsx` は現状 `item.pack.trophyImage` を `Image` で描画している)

- [ ] **Step 3: `AchievementListScreen.tsx` のパック行トロフィー描画をSVGへ変更する**

`src/ui/components/AchievementListScreen.tsx` 内の以下の行を探す。

```typescript
                const trophyImage = <Image source={item.pack.trophyImage} style={{ width: packTrophySize, height: packTrophySize }} />;
```

以下へ置き換える。

```typescript
                const TrophyIcon = item.pack.trophyIcon;
                const trophyImage = <TrophyIcon width={packTrophySize} height={packTrophySize} />;
```

`Image` のimportは実績グリッド側(`item.definition.trophyImage`、78〜107行目付近)で引き続き使うため、importからは削除しない。

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npm test -- AchievementListScreenLandmarkPacks`
Expected: PASS(全件)

- [ ] **Step 5: 型チェック・テスト・lintを通してコミット**

```bash
npm run typecheck && npm test && npm run lint
git add src/ui/components
git commit -m "feat(achievements): パック行トロフィーの描画をSVGアイコンへ切替"
```

---

## Task 5: ドキュメント更新・全体検証・PR作成

**Files:**

- Modify: `docs/todo.md`
- Modify: `docs/landmark-spot-packs.md`
- Modify: `docs/achievements.md`

**Interfaces:**

- Consumes: なし(ドキュメントのみ)

- [ ] **Step 1: `docs/todo.md` のトロフィー関連項目を更新する**

`docs/todo.md` の2.20節内、以下の3行を探す(連続している)。

```markdown
- [ ] 残り10パックの完走トロフィー画像を作成する（600×600の透過PNG、円形いっぱいの絵柄、`assets/achievements/spots/`）
- [ ] スポット座標・半径の決定を補助するヘルパーツールを用意する（候補座標から半径内に入る道路・隣接スポットを確認できるもの）
- [ ] トロフィーPNGを最適化する（11パックぶんがバンドルに載るため、追加前にファイルサイズを削る）
```

以下の2行へ置き換える(1行目は書き換え、3行目は削除)。

```markdown
- [ ] 残り10パックのトロフィーSVGアイコンを作成する（シンプルな幾何学的ベクターアイコン、`assets/achievements/spots/svg/`。PNGは`npm run generate:landmarks`が自動生成するため手作業は不要）
- [ ] スポット座標・半径の決定を補助するヘルパーツールを用意する（候補座標から半径内に入る道路・隣接スポットを確認できるもの）
```

(「トロフィーPNGを最適化する」の行は削除する。生成スクリプトが`palette: true`で圧縮済みのPNGを出力するため、フラットなベクター絵柄であれば独立した最適化作業は不要と判断する。)

- [ ] **Step 2: `docs/landmark-spot-packs.md` §2 にSVG+PNGパイプラインの運用を追記する**

`docs/landmark-spot-packs.md` 内、以下の行を探す。

```markdown
## 2. 完走トロフィーの運用ルール

パックの内容が後から変わると、完走トロフィーの扱いが破綻する。以下を運用ルールとする。

### ルール1: 解除済みの完走実績は、リストが変わっても取り消さない
```

以下へ置き換える。

```markdown
## 2. 完走トロフィーの運用ルール

パックの内容が後から変わると、完走トロフィーの扱いが破綻する。以下を運用ルールとする。

トロフィーの絵柄は、シンプルな幾何学的ベクターアイコンをSVGで用意する(`assets/achievements/spots/svg/<trophyIcon>.svg`)。
プッシュ通知添付・汎用実績システム互換用のPNG(`assets/achievements/spots/<trophyImage>`、600×600・透過)は、
このSVGから `npm run generate:landmarks` が自動生成するため、手作業でPNGを用意する必要はない。
詳細は `docs/superpowers/specs/2026-10-07-landmark-pack-svg-trophy-design.md` を参照する。

### ルール1: 解除済みの完走実績は、リストが変わっても取り消さない
```

- [ ] **Step 3: `docs/achievements.md` §14.2 にtrophyIcon/trophyImageの関係を追記する**

`docs/achievements.md` 内、以下の行を探す。

```markdown
スポットとパックは多対多で、スポット側が所属パックと表示順を持つ。識別子はUUIDv7で、
到達記録(`landmark_spot_visits.spot_id`)に保存されるため後から変更しない。

生成時に以下を検証し、問題があればビルド前に失敗させる。
```

以下へ置き換える。

```markdown
スポットとパックは多対多で、スポット側が所属パックと表示順を持つ。識別子はUUIDv7で、
到達記録(`landmark_spot_visits.spot_id`)に保存されるため後から変更しない。

パックの完走トロフィーは、表示用SVGアイコン(`trophyIcon`)と、通知添付・汎用実績システム互換用の
生成PNG(`trophyImage`)の組で持つ。PNGは`npm run generate:landmarks`がSVGから自動生成するため、
手作業では用意しない。詳細は`docs/superpowers/specs/2026-10-07-landmark-pack-svg-trophy-design.md`を参照する。

生成時に以下を検証し、問題があればビルド前に失敗させる。
```

- [ ] **Step 4: 全体の検証**

```bash
npm run generate:landmarks
npm run typecheck
npm test
npm run lint
npm run format:check
```

すべて成功すること。`npm run format:check` で差分が出た場合は `npx prettier --write <該当ファイル>` を実行してから再確認する。

- [ ] **Step 5: コミット**

```bash
git add docs
git commit -m "docs: スタンプラリーのトロフィーSVG+PNG生成パイプラインをドキュメントへ反映"
```

- [ ] **Step 6: PRを作成する**

```bash
git push -u origin claude/landmark-pack-svg-icon
```

`develop` をベースに Open PR として作成する。description は日本語で、以下を含める。

- 変更内容: スタンプラリーパックのトロフィーアイコンを、手作業PNGからSVGマスタ+自動生成PNGへ切り替えた。実績画面のパック行アイコンはSVGを直接描画し、プッシュ通知添付・汎用実績システム向けのPNGは`npm run generate:landmarks`がSVGから自動生成する
- 理由: 今後追加する10パックぶんのトロフィー絵柄を、写実的なイラストではなくコードで作れるシンプルな幾何学的ベクターアイコンへ統一し、絵柄作成のコストを下げる
- 影響範囲: `metro.config.js`, `data/landmarks/`, `scripts/`, `src/features/landmarks/`, `src/ui/components/AchievementListScreen.tsx`, `assets/achievements/spots/`, 関連ドキュメント
- 検証結果: `npm run generate:landmarks && npm run typecheck && npm test && npm run lint && npm run format:check` すべて成功したことを記載
- PR本文の末尾に以下を追記すること:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Self-Review

**Spec coverage:**

| 設計書の節                              | 実装タスク                              |
| --------------------------------------- | --------------------------------------- |
| §3.1 SVG/PNGの役割分離                  | Task 1・2・3(データモデル)              |
| §3.2 `trophyIcon` フィールド追加        | Task 3                                  |
| §3.3 ファイル配置                       | Task 2・3                               |
| §3.4 絵柄                               | Task 2 Step 1                           |
| §3.5 PNG生成スクリプト                  | Task 2                                  |
| §3.6 Metro設定                          | Task 1                                  |
| §3.7 生成カタログへの反映               | Task 3                                  |
| §3.8 `AchievementListScreen.tsx` の変更 | Task 4                                  |
| §4 変更しないもの                       | 全タスク共通(Global Constraints に明記) |
| §5 ドキュメント更新                     | Task 5                                  |
| §6 テスト方針                           | 各タスクのテストステップ                |

**既知の制約:**

- 設計書§3.5は「出力: 対応するtrophyImageのファイル名」としていたが、実装では「SVGファイル名と同名のPNG」という1:1の機械的対応に単純化した(パックJSONへの依存を無くし、スクリプトをより単純にするため)。この単純化に合わせて`landmarkPacks.json`の`trophyImage`値を`japan-falls-3.png`(旧`spots-japan-falls-3.png`から命名変更)にしている。設計の意図(SVGマスタからPNGを自動生成する)自体は変わらない
- `metro.config.js`の実機動作(Expo Go/開発ビルドでSVGが実際に描画されるか)は自動テストでは検証できない。Task 1完了時点ではまだ`.svg`をimportするコードが無く、Task 3〜4で初めて実使用されるため、Task 4完了後に実機/シミュレータでの目視確認を推奨する(本計画のテストでは検証できない旨を明記する)
