# 写真クラスタリング O(N)化(Phase 2 / 2-a)設計書

作成日: 2026-08-11
前提: `2026-08-10-photo-map-scan-limit-removal-design.md`(Phase 2 全体設計)§4.3・§8(2-a)

## 1. 目的

`clusterMapPhotosByRadius`(`src/features/photos/photoClusters.ts`)の計算量を O(N²) から O(N) へ改善し、Phase 2 の上限撤廃(2-c)で写真件数が数千〜数万に増えても、ズーム操作や写真追加時のクラスタ再計算が実用的な時間で終わるようにする。

あわせて、パン時のメモ化(PR #137)が Web Mercator の緯度歪みにより南北パンで効かないことがある問題を、クラスタ半径の量子化で緩和する。

対象は**操作時のコスト**(ズーム・写真追加時の再計算)。読み込み時のコスト(Phase 1 で対応済み)・描画時のコスト(2-bで対応予定)は対象外。

## 2. 背景

### 2.1 現状の計算量

`findNearestCluster`(`photoClusters.ts`)は新規写真ごとに既存クラスタを全走査するため O(N × C)。写真が散在する実データでは C ≒ N となり実質 O(N²)。

| 写真数 | 現状 O(N²) |
| ------ | ---------- |
| 200    | 約 4万     |
| 5,000  | 約 2,500万 |
| 20,000 | 約 4億     |

### 2.2 メモ化が効かないケース

`getPhotoClusterRadiusMeters(region)` は `region.latitudeDelta` のみから半径を連続値で算出する。パン時に `usePhotoClusters` の2段 `useMemo`(PR #137)がこの半径をキーにしているが、Web Mercator 投影の影響で南北パンでは `latitudeDelta` が実際にわずかに変化するため、半径が bit 単位で一致せずメモ化がミスすることがある(`d(latitude)/d(pixel) ∝ cos(latitude)`)。

半径を離散段階へ丸めれば、この経路のメモ化ミスも解消する。

## 3. 方針

### 3.1 半径の量子化

`src/features/location/grid/gridAggregation.ts` の `DISPLAY_CELL_SIZE_STAGES` / `getStableDisplayCellSizeMeters` と同じ構造(段階テーブル + ヒステリシス)を `photoClusters.ts` 内に導入する。`GridOverlayConfig` 型には依存させず、写真クラスタ専用の段階テーブルとヒステリシス比率を持つ(ドメインが違うため、コードは共有せずパターンのみ踏襲する)。

```typescript
/** 写真クラスタ半径の段階。境界は既存の連続式(latitudeDelta × 3330)に合わせて選ぶ。 */
type PhotoClusterRadiusStage = {
  radiusMeters: number;
  maxLatitudeDelta: number;
};

const PHOTO_CLUSTER_RADIUS_STAGES: PhotoClusterRadiusStage[] = [
  { radiusMeters: 10, maxLatitudeDelta: 0.003 },
  { radiusMeters: 30, maxLatitudeDelta: 0.009 },
  { radiusMeters: 75, maxLatitudeDelta: 0.0225 },
  { radiusMeters: 150, maxLatitudeDelta: 0.045 },
  { radiusMeters: 300, maxLatitudeDelta: 0.09 },
  { radiusMeters: 750, maxLatitudeDelta: 0.225 },
  { radiusMeters: 1500, maxLatitudeDelta: 0.45 },
  { radiusMeters: 3000, maxLatitudeDelta: 0.9 },
  { radiusMeters: 7500, maxLatitudeDelta: 2.25 },
  { radiusMeters: 15000, maxLatitudeDelta: 4.5 },
];
/** 上記を超える(latitudeDelta >= 4.5)場合に使う最終段階。等価性を検証済みの上限値を使う。 */
const PHOTO_CLUSTER_RADIUS_WORLD_FALLBACK_METERS = 50_000;
```

正確な数値(段階数・境界・フォールバック値)は実装時に TDD で確定させる。ここでは構造(既存の傾き `3330` に沿った境界選定、等価性を保てる上限を最終段階にすること)を確定させる。

**既存の「上限なし」性質の扱い**: `getPhotoClusterRadiusMeters` は現在、広域ズームで際限なく半径が伸びる(既存テストで明示的に検証済み)。この設計では段階制に変えるため厳密には有限になる。当初は「世界地図相当」の巨大な値でUI上区別がつかない挙動を狙ったが、フォールバック半径は空間ハッシュの3セル探索が前提とするWeb Mercatorスケール係数のほぼ一定性が崩れない範囲に収める必要があり、実測で等価性が保証できる上限は50,000m(50km)である(200,000mでは崩れることを確認済み)。そのため最終段階のフォールバック値は50,000mとし、「世界地図相当で実質無制限」ではなく「等価性が保証できる範囲で最大」という位置付けにする。既存の「上限なし」テストは、新しい段階値に合わせて書き換える(意図した変更であり回帰ではない)。

**新API**:

```typescript
/**
 * 表示範囲の広さから写真クラスタ半径を段階選択する(ヒステリシスなし)。
 *
 * @param region - 現在の地図表示範囲。未取得の場合は近距離用の既定値を使う。
 * @returns 段階選択された半径メートル。
 */
export function getPhotoClusterRadiusMeters(region: Region | null): number;

/**
 * 表示セルサイズの切替境界付近で直前の半径を維持し、ズーム操作中のちらつきとパン時の
 * メモ化ミスを抑える。`getStableDisplayCellSizeMeters` と同じヒステリシスパターン。
 *
 * @param region - 現在の地図表示範囲。
 * @param previousRadiusMeters - 直前に使った半径。初回は null。
 * @returns ヒステリシスを加味した半径メートル。
 */
export function getStablePhotoClusterRadiusMeters(region: Region | null, previousRadiusMeters: number | null): number;
```

`getPhotoClusterRadiusMeters` は既存の公開関数であり、シグネチャは変えない(内部実装のみ段階選択へ変更)。`getStablePhotoClusterRadiusMeters` を新規追加する。

### 3.2 呼び出し側(`usePhotoClusters`)のヒステリシス対応

`src/ui/hooks/usePhotoClusters.ts` に前回半径を保持する `useRef` を追加する。refの更新はレンダー中ではなく、コミット後に `useEffect` で行う。

```typescript
export function usePhotoClusters(photos: MapPhoto[], visibleRegion: Region | null): MapPhotoCluster[] {
  const previousRadiusRef = useRef<number | null>(null);

  const clusterRadiusMeters = useMemo(() => {
    return getStablePhotoClusterRadiusMeters(visibleRegion, previousRadiusRef.current);
  }, [visibleRegion]);

  useEffect(() => {
    previousRadiusRef.current = clusterRadiusMeters;
  }, [clusterRadiusMeters]);

  return useMemo(() => clusterMapPhotosByRadius(photos, clusterRadiusMeters), [photos, clusterRadiusMeters]);
}
```

これにより、Concurrent Reactで破棄されたレンダーの半径が、次のコミット済みレンダーへ流出しない。

### 3.3 空間ハッシュによる O(N) クラスタリング

`clusterMapPhotosByRadius` の内部実装を、既存の `@/features/location/grid/gridCell` の `coordinateToGridCell` を使った空間ハッシュへ置き換える。この関数は `reports` / `map` feature から既に相互 import されている既存パターンであり、`photos` feature からの利用も同じ扱いにする。

```typescript
export function clusterMapPhotosByRadius(photos: MapPhoto[], clusterRadiusMeters: number): MapPhotoCluster[] {
  const clusters: MutablePhotoCluster[] = [];
  // セルID(coordinateToGridCellの cellId) → そのセルに seed を持つクラスタ一覧。
  const clustersByCellId = new Map<string, MutablePhotoCluster[]>();

  for (const photo of [...photos].sort((a, b) => b.creationTime - a.creationTime)) {
    const nearestCluster = findNearestClusterViaGrid(photo, clustersByCellId, clusterRadiusMeters);

    if (!nearestCluster) {
      const newCluster: MutablePhotoCluster = { seed: photo, photos: [photo] };
      clusters.push(newCluster);
      registerClusterCell(newCluster, clustersByCellId, clusterRadiusMeters);
      continue;
    }

    nearestCluster.photos.push(photo);
  }

  return clusters.map((cluster, index) => ({
    id: createClusterId(cluster, index),
    latitude: cluster.seed.latitude,
    longitude: cluster.seed.longitude,
    photos: cluster.photos,
  }));
}
```

`findNearestClusterViaGrid` は現行の `findNearestCluster` を置き換える。

- 写真の座標を `coordinateToGridCell(photo, clusterRadiusMeters)` でセル化する(セルサイズ = 半径)
- 自セルを中心に **±3セル(7×7=49セル)** の範囲にある候補クラスタを `clustersByCellId` から集める
- Xセル番号はワールド幅で循環させ、日付変更線の両側にある近接写真も候補に含める
- 候補それぞれについて、**現行と全く同じ** `distanceMeters(photo, cluster.seed)` で判定する(索引は候補の絞り込みにのみ使い、採用基準は変えない)
- 「半径内かつ最近傍」という現行のロジック(連鎖防止のため代表点との距離のみを見る)はそのまま維持し、同距離なら先に作られたクラスタを選ぶ

**探索範囲を1セル(9セル)ではなく3セル(49セル)にする理由**: Web Mercator は緯度が上がるほど距離を実際より引き伸ばす(北海道付近・緯度46度で最大約1.43倍)。セルサイズ=半径のまま1セル分だけ探索すると、緯度によっては本来同一クラスタになるべき写真をセル境界の外に見逃す可能性がある。3セル分(スケール係数3倍まで安全、緯度70度相当まで許容)に広げることで、現実的な全緯度域で現行 O(N²) 実装と同一の結果を保証する。49セルは N に対して定数なので、全体の計算量は O(N) のまま変わらない。

`registerClusterCell` は新規クラスタの seed を同じ `coordinateToGridCell` でセル化し、`clustersByCellId` へ登録する。

**この設計により、現行 O(N²) 実装と同一の出力になることを目指す。** 索引は候補を絞るためだけに使い、距離判定・採用基準は一切変更しないため、多くの場合は一致する。ただし3セル探索が前提とするWeb Mercatorスケール係数のほぼ一定性は、緯度が高すぎる場合(実測で緯度70度程度まで)、またはセルサイズ(=クラスタ半径)が数千km規模に達する場合には崩れ、その領域では出力が現行実装と異なりうる。等価性は緯度70度程度まで、かつフォールバック半径50,000mまでの範囲で検証済み(§3.1参照)。この範囲を外れても、写真が1枚も失われず必ずいずれかのクラスタに属すること(データ欠落なし・クラッシュなし)は変わらない。

## 4. 変更対象ファイル

| ファイル                                              | 変更内容                                                                                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/photos/photoClusters.ts`                | `clusterMapPhotosByRadius` を空間ハッシュ実装へ。`getPhotoClusterRadiusMeters` を段階選択へ。`getStablePhotoClusterRadiusMeters` を新設 |
| `src/features/photos/__tests__/photoClusters.test.ts` | 段階値・ヒステリシス・空間ハッシュの等価性テストへ更新                                                                                  |
| `src/ui/hooks/usePhotoClusters.ts`                    | 前回半径の `useRef` を追加し `getStablePhotoClusterRadiusMeters` を使う                                                                 |
| `src/ui/hooks/__tests__/usePhotoClusters.test.tsx`    | ヒステリシス込みの呼び出し回数テストを追加(既存のパン/ズーム/写真変化テストは維持)                                                      |

新規ファイルは作らない。

## 5. テスト方針

`AGENTS.md` §2 / §9 に従う。

### `getPhotoClusterRadiusMeters` / `getStablePhotoClusterRadiusMeters`(重点)

- 各段階の境界で正しい半径が選ばれること
- 下限(`MINIMUM_CLUSTER_RADIUS_METERS` 相当)が維持されること
- 最終段階を超える広域ズームでは、等価性を検証済みのフォールバック値(50,000m)になること
- ヒステリシス: 境界付近を往復しても、比率内ならちらつかず前回値を維持すること(`gridAggregation.test.ts` のテストパターンを踏襲)
- `previousRadiusMeters` が `null`(初回)の場合は素直に段階選択した値を返すこと

### `clusterMapPhotosByRadius`(重点)

- **既存の全テストケースをそのまま維持する**(近接写真をまとめる・連鎖的な巨大クラスタ化を防ぐ・表示範囲なしでも安全、等)。内部実装が変わっても外部挙動が同一であることの回帰テストとして機能させる
- **新規: 現行実装との等価性テスト**。ランダムまたは fixture の写真集合(数百件、様々な緯度)に対し、新しい空間ハッシュ実装と、素朴な O(N²) 参照実装(テスト内にコピーして残す)の出力が完全一致することを検証する
- **新規: 高緯度での正当性テスト**。緯度45度前後に、半径ギリギリの距離で配置した写真ペアが正しく同一クラスタになることを検証する(3セル探索の効果を直接確認する)
- **新規: セル境界をまたぐ配置**での正しいクラスタリング(現行の「グリッド境界をまたいだ近接写真も1つのクラスタにまとめる」テストと同種だが、空間ハッシュ実装特有の境界ケースとして追加)

### `usePhotoClusters`(既存テストに追加)

- ヒステリシス境界をまたぐパン操作で、`clusterMapPhotosByRadius` の呼び出し回数が想定通りになること(境界内側の往復では再計算しない)
- 既存の「パンでは再計算しない」「ズームでは再計算する」「写真一覧が変われば再計算する」は維持する

## 6. 影響範囲

- **ユーザー影響**: クラスタリング結果は現行と同一(等価性テストで担保)。ズーム操作・写真追加時の再計算が高速化する。写真件数が少ない現状(200件上限)では体感差はほぼないが、2-c で上限を撤廃した際に必須の前提になる
- **パン時のメモ化(PR #137)**: 半径が量子化されることで、南北パンでもメモ化がヒットしやすくなる(完全に保証はできないが、これまでより高い確率で効く)
- `getPhotoClusterRadiusMeters` の返り値が変わる(段階値になる)ため、依存する既存テストの厳密値アサーションは書き換えが必要
- ローカルファースト方針への影響なし(データの永続化・外部送信は発生しない)

## 7. 未確定事項

1. **段階テーブルの正確な数値**: §3.1 の値は構造の例示。実装時に TDD で確定する
2. **ヒステリシス比率**: `GRID_OVERLAY_CONFIG.displayCellSizeHysteresisRatio`(0.2)を写真クラスタでも同じ値にするか、別の値にするか。実装時に決める(既存踏襲でよければ0.2を初期値とする)
