# スタンプラリーパックのトロフィーアイコンをSVG化する設計書

## 1. 背景・目的

現在、スタンプラリー(スポット訪問実績)のパックトロフィーは `assets/achievements/spots/` 配下の手作業PNG(600×600、透過、円形いっぱいの絵柄)で用意する前提になっている(`docs/todo.md` 2.20節に「残り10パックの完走トロフィー画像を作成する」が未着手で残っている)。

このPNGは実写・イラスト相当の絵柄を前提にしており、人間のイラストレーターかストック画像が必要になる。コードで実装するエージェント(このAI)は、整ったベクターの幾何学的アイコンなら書けるが、写実的なイラストは書けない。今後11パックぶんの絵柄を用意する運用コストを下げるため、パックトロフィーの絵柄をSVG(シンプルな幾何学的ベクターアイコン)で作る方式へ切り替える。

今回のスコープは以下の2点。

1. 既存の唯一のパック「日本三名瀑」のトロフィーをSVGで作り直し、実績画面のスポットセクション(現在は滝のPNGが表示されている場所)にSVGとして表示する
2. これを今後追加する全パックの標準方式として採用する(スキーマ・生成スクリプト・型を今回合わせて整備する)

## 2. 既存実装の制約(調査結果)

- `LandmarkPack.trophyImage: ImageSourcePropType` は、実績画面のパック行アイコン(`AchievementListScreen.tsx`)だけでなく、汎用実績システム(`achievementDefinitions.ts` が `landmarkPackCompletion` 条件の `AchievementDefinition` を組み立てる際にそのまま転用)経由で、パック完走時のプッシュ通知画像添付(`achievementNotificationService.ts` の `attachments: [{ url: trophyImageUri, type: 'image/png' }]`)にも使われている
- `expo-notifications` の通知添付は実ファイル(PNG)のURIを要求するため、SVGをReactコンポーネントとして描画するだけでは代替できない
- `AchievementDefinition.trophyImage: ImageSourcePropType` は距離・ログ日数・都道府県・市区町村の実績とも共通の型で、`AchievementScroller` / `AchievementDialog` / `AchievementUnlockModal` / `MonthlyReportScreen` など複数画面がこの型を前提にしている。これらを今回変更する理由はない
- `react-native-svg`(依存)・`react-native-svg-transformer`(devDependency)は既にインストール済みだが、`metro.config.js` には配線されていない。アプリ内の既存SVG利用(`ScalableSvgCanvas.tsx` 等)はすべて `react-native-svg` のプリミティブをコードで直接書く方式で、`.svg` ファイルをimportする方式は前例がない
- `sharp` 等のNode側ラスタライザは未導入

## 3. 方針

### 3.1 「表示用SVG」と「通知添付用PNG」を分離する

パックのトロフィーアイコンを以下の2つの役割に分けて持つ。

| 役割 | 形式 | 用途 | 生成方法 |
|------|------|------|----------|
| 表示用 | SVG | 実績画面のパック行アイコン(`AchievementListScreen.tsx`) | 手書きのSVGファイルをマスタとして用意 |
| 通知添付・汎用実績互換用 | PNG(600×600、透過) | `achievementNotificationService` の通知添付、`AchievementDefinition.trophyImage` 互換 | SVGからビルドスクリプトで自動生成(手作業PNGは廃止) |

これにより、汎用実績システム(`achievementDefinitions.ts`・通知・`AchievementScroller`等)は一切変更不要になる。変更が要るのは「PNGの作り方」と「`AchievementListScreen.tsx` のパック行アイコンの描画方法」だけ。

### 3.2 データモデル: `trophyIcon` フィールドを追加する(既存 `trophyImage` は維持)

`data/landmarks/landmarkPacks.schema.json` に `trophyIcon` を新規必須フィールドとして追加する。既存の `trophyImage` はフィールド名・パターンとも変更しない(PNGファイル名を指す点は同じ。ただし今後はこのPNGを手作業ではなく生成スクリプトで作る)。

```json
"trophyIcon": {
  "type": "string",
  "pattern": "^[a-z0-9-]+$",
  "description": "SVGアイコンの識別子。assets/achievements/spots/svg/<値>.svg がマスタ。trophyImageのPNGはこのSVGから生成する"
}
```

`data/landmarks/landmarkPacks.json` の既存パック「日本三名瀑」に `"trophyIcon": "japan-falls-3"` を追加する。

### 3.3 SVGマスタファイルと生成PNGの配置

```text
assets/achievements/spots/
  svg/
    japan-falls-3.svg   # 新規: 手書きSVGマスタ
  spots-japan-falls-3.png  # 既存PNGを新しい生成PNGで置き換える
```

ファイル名規則: SVGは `assets/achievements/spots/svg/<trophyIcon>.svg`、PNGは既存の `assets/achievements/spots/<trophyImage>` パス(今回は同じ `spots-japan-falls-3.png` を維持し、内容だけ新しいSVG由来のものに置き換える)。

### 3.4 SVGアイコンの絵柄(日本三名瀑)

シンプルな幾何学的フラットデザインとする。

- 円形の塗り背景(濃い青 `#0D47A1` 系)が600×600の円いっぱいを占める(既存PNGと同じ「円形いっぱいの絵柄」を踏襲)
- 背景にやや暗い山の稜線(三角形2つを重ねたシルエット)
- 手前に3本の縦の滝筋(白〜水色のグラデーションは使わず、単色+明度違いの帯で3本。3名瀑を表す「3」を視覚的に強調する)
- 各滝の下に小さな楕円の水しぶき/滝壺
- 色数は4色程度に抑える(背景紺・山影・滝筋の明暗2色)

この絵柄は `isFree` 等の状態とは無関係の静的トロフィー絵柄であり、ライト/ダークモードのテーマに追従させる必要はない(既存PNGトロフィーもテーマ非依存の固定色)。

### 3.5 PNG生成スクリプト

新規Node スクリプト `scripts/generate-landmark-trophy-pngs.mjs` を追加する。

- 入力: `assets/achievements/spots/svg/*.svg` の全ファイル
- 出力: `assets/achievements/spots/<対応するtrophyImageのファイル名>.png`(600×600、透過)
- 変換には `sharp`(新規devDependency)を使う。`sharp` はNodeのビルド時ツールであり、Expoアプリ本体へは同梱されないため、AGENTS.md §4「ネイティブコードの追加が必要な依存は慎重に判断する」が想定するアプリ本体依存には当たらない(既存の `ajv`・`fast-xml-parser` 等のビルド/生成スクリプト専用依存と同じ扱い)
- `package.json` の npm script `generate:landmarks` を `node scripts/generate-landmark-trophy-pngs.mjs && node scripts/generate-landmark-catalog.mjs` のように連結し、1コマンドでSVG→PNG生成とカタログ生成の両方を行う

### 3.6 Metro設定: `.svg` を直接importできるようにする

`metro.config.js` を以下の形へ変更する(既存の `getSentryExpoConfig` の戻り値へ `react-native-svg-transformer` の設定を重ねる)。

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

TypeScriptが `*.svg` importを認識できるよう、`src/types/svg.d.ts` を新規追加する。

```typescript
declare module '*.svg' {
  import { ComponentType } from 'react';
  import { SvgProps } from 'react-native-svg';

  const content: ComponentType<SvgProps>;
  export default content;
}
```

### 3.7 生成カタログへの反映

`scripts/generate-landmark-catalog.mjs` の `GeneratedLandmarkPack` 型とパック生成テンプレートへ `trophyIcon` を追加する。

```typescript
export type GeneratedLandmarkPack = {
  id: string;
  name: string;
  description: string;
  trophyImage: ImageSourcePropType;
  /** パック行に表示するSVGトロフィーアイコン。 */
  trophyIcon: ComponentType<SvgProps>;
  sortOrder: number;
  isFree: boolean;
};
```

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

`src/features/landmarks/landmarkCatalog.ts` の `LandmarkPack` 型(`GeneratedLandmarkPack & { trophyImageUri }`)はそのまま `trophyIcon` を継承するため変更不要。`trophyImageUri` の計算ロジック(`Image.resolveAssetSource(pack.trophyImage)`)も変更不要。

### 3.8 `AchievementListScreen.tsx` の変更

パック行アイコンの描画を `Image` から `trophyIcon` コンポーネントへ変更する。`Grayscale` ラップ・3状態(`dim`/`grayscale`/`color`)切り替えのロジックはそのまま(ラップする中身を差し替えるだけ)。

```typescript
// 変更前
const trophyImage = <Image source={item.pack.trophyImage} style={{ width: packTrophySize, height: packTrophySize }} />;

// 変更後
const TrophyIcon = item.pack.trophyIcon;
const trophyImage = <TrophyIcon width={packTrophySize} height={packTrophySize} />;
```

## 4. 変更しないもの

- `achievementDefinitions.ts` の `AchievementDefinition.trophyImage` / `trophyImageUri`、および `pack.trophyImage` → `AchievementDefinition.trophyImage` への変換ロジック
- `achievementNotificationService.ts`(パック完走通知の画像添付)
- `AchievementScroller.tsx` / `AchievementDialog.tsx` / `AchievementUnlockModal.tsx` / `MonthlyReportScreen.tsx`(いずれもPNGベースの`trophyImage`を使い続ける)
- 距離・ログ日数・都道府県・市区町村の実績トロフィー(PNGのまま)
- `resolveLandmarkTrophyDisplayState` の3状態ロジック(`dim`/`grayscale`/`color`)

## 5. ドキュメント更新

- `docs/todo.md` 2.20節: 「残り10パックの完走トロフィー画像を作成する(600×600の透過PNG...)」を「SVGアイコンを作成する(`assets/achievements/spots/svg/`)」へ書き換える。「トロフィーPNGを最適化する」は、生成PNGがフラットな幾何学図形で元々小さくなる見込みのため、スクリプトのPNG出力オプション(パレット圧縮等)で対応し、独立項目としては削除する
- `docs/landmark-spot-packs.md` §2「完走トロフィーの運用ルール」: SVGマスタ+PNG自動生成の運用に書き換える
- `docs/achievements.md`: トロフィー画像の形式を説明している箇所(§6.1など)にスポットパックが例外(SVGマスタ+自動生成PNG)である旨を追記するか判断する(スコープが汎用実績ではなくスポットパック限定のため、§14側に追記する方が適切と判断)

## 6. テスト方針

- `GENERATED_LANDMARK_PACKS` をモックしている既存テスト(`landmarkCatalogFreePaid.test.ts` / `landmarkRecordingServiceFreePaid.test.ts` / `useLandmarkPackStateFreePaid.test.tsx` / `AchievementListScreenLandmarkPacks.test.tsx` のフィクスチャ)に `trophyIcon` フィールド(モック用の簡単な関数コンポーネントまたは `() => null`)を追加する
- `AchievementListScreenLandmarkPacks.test.tsx` の `trophyImage: 1` (数値モック)に加えて `trophyIcon` にモックコンポーネントを追加する
- `scripts/generate-landmark-trophy-pngs.mjs` 自体はビルドスクリプトであり、`AGENTS.md` §2の「外部依存が強い処理」に該当する(実際のラスタライズは `sharp` 任せ)。単体テストは書かず、`npm run generate:landmarks` を実行して実際にPNGが生成されること・既存カタログ生成が成功することを手動確認する。理由をコミット時に明記する
- `metro.config.js` の変更は設定ファイルであり、単体テスト対象外。`.svg` importが実際に解決できることは、変更後に `npm run typecheck && npm test` が通ること、および実機/シミュレータでの目視確認で検証する

## 7. 対象外(今回やらないこと)

- 既存の距離・ログ日数・都道府県・市区町村トロフィーのSVG化
- `.svg` を使った他の画面(地図マーカー等)のアイコン全面差し替え
- まだ存在しない残り10パックのSVG自体の作成(スキーマ・パイプラインだけ今回整備し、絵柄は各パック追加時に都度作成する)
