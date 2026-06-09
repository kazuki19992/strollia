# 実績画面グリッド化 + ダイアログ共通化 設計

## 概要

実績画面をカード型からグリッド型（2列）へ刷新する。あわせて実績解除モーダルのダイアログ部分を汎用 `Dialog` コンポーネントとして切り出し、実績解除通知・実績詳細表示の両方で使用する。テーマカラーの色味（ベージュ・グリーン系）を無彩色へ調整する。

---

## コンポーネント構造

```
Dialog（汎用・新規）
  - children: ReactNode を表示する
  - props: visible, showConfetti, autoClose, onClose, styles, theme, animationKey?
  - 責務: スワイプ/タップで閉じる・登場退場アニメーション・紙吹雪（任意）・自動クローズ（任意）・閉じるボタン

AchievementUnlockModal（実績解除通知・改修）
  - Dialog を直接使用（showConfetti=true, autoClose=true）
  - 独自コンテンツ: 「実績解除」eyebrow / 「○○を達成しました！」/ 説明 / X共有ボタン
  - 既存の onShareToX インターフェースを維持

AchievementDialog（グリッドタップ詳細・新規）
  - Dialog を使用（showConfetti=false, autoClose=false）
  - コンテンツ: 実績画像 / 実績名 / 開放日 / 実績の説明 / システム共有ボタン / 閉じるボタン
  - 共有: captureRef でダイアログ内容を画像キャプチャ → expo-sharing で共有

AchievementListScreen（グリッド・改修）
  - カテゴリごとの2列グリッド
  - 解除済みタップで AchievementDialog を開く
```

---

## Dialog コンポーネント（新規）

**ファイル:** `src/app/components/Dialog.tsx`

`AchievementUnlockModal` の以下のロジックを汎用化して移植する:
- `Modal` + バックドロップ
- `PanResponder` によるスワイプ閉じ（`achievementUnlockModalLogic.ts` の判定関数を流用）
- 登場（spring）/ 退場（timing）アニメーション
- ドラッグ距離に応じた opacity 変化
- 閉じるボタン

**Props:**
```typescript
export type DialogProps = {
  /** 表示状態。 */
  visible: boolean;
  /** 子要素（ダイアログ本文）。 */
  children: ReactNode;
  /** 紙吹雪を背景に表示するか。 */
  showConfetti?: boolean;
  /** 一定時間で自動的に閉じるか。 */
  autoClose?: boolean;
  /** 紙吹雪の再生キー（showConfetti=true時）。 */
  animationKey?: string | null;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 閉じる処理。 */
  onClose: () => void;
};
```

**振る舞い:**
- `showConfetti=false` のときは `ConfettiOverlay` をレンダリングしない
- `autoClose=false` のときは自動クローズタイマーと進捗バー（`achievementAutoCloseTrack`）を描画しない
- 閉じるボタンとスワイプは常に有効
- `AUTO_CLOSE_DELAY_MS` は autoClose=true のときのみ使用

---

## AchievementUnlockModal（改修）

**ファイル:** `src/app/components/AchievementUnlockModal.tsx`

ダイアログの枠・アニメーション・紙吹雪・自動クローズロジックを `Dialog` へ委譲し、本コンポーネントは「実績解除」専用のコンテンツのみ保持する。

```tsx
export function AchievementUnlockModal({ achievement, animationKey, styles, theme, onShareToX, onClose }: AchievementUnlockModalProps) {
  return (
    <Dialog
      visible={achievement != null}
      showConfetti
      autoClose
      animationKey={animationKey}
      styles={styles}
      theme={theme}
      onClose={onClose}
    >
      {achievement && (
        <>
          <Text style={styles.achievementModalEyebrow}>実績解除</Text>
          <Image source={achievement.trophyImage} style={styles.achievementModalImage} />
          <Text style={styles.achievementModalTitle}>{achievement.title}を達成しました！</Text>
          <Text style={styles.achievementModalDescription}>{achievement.description}</Text>
          <Pressable onPress={() => onShareToX(achievement)} style={styles.achievementPrimaryButton}>
            <Feather name="share-2" size={18} color={styles.primaryButtonText.color} />
            <Text style={styles.primaryButtonText}>ともだちに自慢する</Text>
          </Pressable>
        </>
      )}
    </Dialog>
  );
}
```

注: 共有時の自動クローズ一時停止は Dialog 側に「子からポーズを要求する仕組み」が必要。`Dialog` は `onClose` と分離して、X共有ボタンは autoClose を止めるため `Dialog` が context もしくは `pauseAutoClose` を子へ渡せるようにする。

**自動クローズ一時停止の方式:** `Dialog` が render-prop で `pauseAutoClose: () => void` を子へ渡す。

```tsx
<Dialog ...>
  {({ pauseAutoClose }) => ( ... onShareToX前に pauseAutoClose() ... )}
</Dialog>
```

`children` は `ReactNode | ((helpers: { pauseAutoClose: () => void }) => ReactNode)` を受け付ける。

---

## AchievementDialog（新規）

**ファイル:** `src/app/components/AchievementDialog.tsx`

**Props:**
```typescript
export type AchievementDialogProps = {
  /** 表示する実績一覧アイテム。null で非表示。 */
  item: AchievementListItem | null;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 閉じる処理。 */
  onClose: () => void;
};
```

**コンテンツ（captureRef 対象は画像〜説明まで、共有/閉じるボタンは対象外）:**
- 実績画像
- 実績名
- 開放日（`item.unlockedAt` を `toLocaleDateString()`）
- 実績の説明
- システム共有ボタン（captureRef → expo-sharing。`DailyLogDetailScreen` の `shareDailyLogImage` を参考）
- 閉じるボタン: `Dialog` が標準で持つ閉じるボタンに委譲する（AchievementDialog 本文には独自の閉じるボタンを置かない）

`Dialog` を `showConfetti={false} autoClose={false}` で使用。

---

## AchievementListScreen（改修）

**ファイル:** `src/app/components/AchievementListScreen.tsx`

カテゴリごとに2列グリッド。各カテゴリ内で実績は `sortOrder` 昇順。3状態で表示を分岐:

| 状態 | 判定 | 画像 | 実績名 | 進捗 | タップ |
|------|------|------|--------|------|--------|
| 解除済み | `unlockedAt != null` | 通常 | 実績名 | 開放日 | AchievementDialog を開く |
| 次の実績 | カテゴリ内で最初のロック済み | グレースケール（薄め） | 実績名 | 進捗（X / Y） | 不可 |
| それ以降 | 上記以外のロック済み | シルエット | ？？？ | ？？？ | 不可 |

**状態判定ロジック（新規ヘルパー）:**
```typescript
type AchievementDisplayState = 'unlocked' | 'next' | 'hidden';

function resolveAchievementDisplayStates(items: AchievementListItem[]): Map<string, AchievementDisplayState>
```
カテゴリごとに sortOrder 昇順で走査し、最初のロック済みを `next`、以降のロック済みを `hidden`、解除済みを `unlocked` とする。

**グレースケール表現（次の実績）:**
- 通常 `Image` の上に絶対配置の半透明オーバーレイ
- ライトモード: `rgba(255, 255, 255, 0.55)`
- ダークモード: `rgba(0, 0, 0, 0.55)`

**シルエット表現（それ以降）:**
- `Image` に `tintColor` を適用し単色塗りつぶし
- 色は `theme.colors.border`（無彩色化後: ライト `#e0e0e0` / ダーク `#3a3a3a`）

---

## テーマ無彩色化

**ファイル:** `src/theme/theme.ts`

プライマリ系（`primary` / `primaryText` / `mapLine` / `plusCtaBackground` / `danger` 系 / `routeMapEmpty*`）は変更しない。色味のある無彩色相当のキーを調整する。

### lightTheme

| キー | 現在 | 変更後 |
|------|------|--------|
| `card` | `#fffdf8` | `#f8f8f8` |
| `cardStrong` | `#fffdf8` | `#f0f0f0` |
| `text` | `#2d2416` | `#1a1a1a` |
| `mutedText` | `#675c4d` | `#666666` |
| `border` | `#e5ddcd` | `#e0e0e0` |
| `surfaceOverlay` | `rgba(255, 253, 248, 0.94)` | `rgba(248, 248, 248, 0.94)` |
| `scrim` | `rgba(45, 36, 22, 0.08)` | `rgba(0, 0, 0, 0.08)` |
| `shadow` | `#2d2416` | `#000000` |

### darkTheme

| キー | 現在 | 変更後 |
|------|------|--------|
| `card` | `#22261d` | `#252525` |
| `cardStrong` | `#2b3025` | `#2e2e2e` |
| `text` | `#f3eadb` | `#f0f0f0` |
| `mutedText` | `#c8bda7` | `#999999` |
| `border` | `#3a4032` | `#3a3a3a` |
| `shareButtonBackground` | `#f7f2ea` | `#f0f0f0` |
| `surfaceOverlay` | `rgba(34, 38, 29, 0.94)` | `rgba(37, 37, 37, 0.94)` |

`background` / `primary` 系 / `routeMapEmpty*` / `shareButtonText` / `dangerSurface` は据え置き。

---

## スタイル追加（appStyles.ts）

グリッド2列・3状態表示用のスタイルを追加:
- `achievementGridTile`（2列タイル: `width: '48%'` 相当）
- `achievementTileImage` / `achievementTileImageNext`（グレースケールオーバーレイ）/ `achievementTileImageHidden`（シルエット）
- `achievementTileGrayscaleOverlay`
- `achievementTileTitle` / `achievementTileProgress`
- `achievementDialogShareButton` 等

既存の `achievementCard` 系は不要になれば削除する。

---

## テスト方針

- `Dialog`: visible 切替・onClose 呼び出し・showConfetti/autoClose の有無で ConfettiOverlay/進捗バーの描画切替・pauseAutoClose の render-prop 動作
- `AchievementUnlockModal`: Dialog に showConfetti/autoClose=true で渡る・共有ボタンで onShareToX 呼び出し
- `AchievementDialog`: item の内容表示・開放日表示・共有ボタンで captureRef/expo-sharing 呼び出し・閉じる
- `AchievementListScreen`: 3状態の表示分岐（解除済み/次/それ以降）・カテゴリごとの next 判定・解除済みタップで onSelectAchievement 呼び出し・ロック済みはタップ不可
- `resolveAchievementDisplayStates`: カテゴリごとの状態解決ロジック

---

## 依存関係

- 追加ライブラリなし（`expo-sharing` / `react-native-view-shot` は既存）
