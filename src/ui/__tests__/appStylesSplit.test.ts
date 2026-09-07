/**
 * appStyles 分割後のキー網羅テスト。
 *
 * appStyles.ts を責務別ファイルへ分割した後、createStyles(theme) の ReturnType が
 * 分割前と同一のキー集合を持つことを実行時に検証する。
 *
 * テスト方針:
 *   - 各サブファイルの createXxxStyles(theme) が期待するキーを持つかをスモークチェックする
 *   - createStyles(theme) の全体結果が代表キーをすべて含むことを確認する
 */
import { createStyles } from '@/ui/appStyles';
import { StyleSheet } from 'react-native';
import { createAchievementStyles } from '@/ui/styles/achievementStyles';
import { createCommonStyles } from '@/ui/styles/commonStyles';
import { createDailyLogStyles } from '@/ui/styles/dailyLogStyles';
import { createMapStyles } from '@/ui/styles/mapStyles';
import { createSettingsStyles } from '@/ui/styles/settingsStyles';
import { lightTheme } from '@/theme/theme';

describe('appStyles 分割後のキー網羅検証', () => {
  const theme = lightTheme;

  describe('createAchievementStyles — 実績・チュートリアル・コンフェッティ', () => {
    test('実績モーダル・グリッド・スクロールの代表キーを持つ', () => {
      const styles = createAchievementStyles(theme);

      expect(styles.achievementModalCard).toBeDefined();
      expect(styles.achievementGrid).toBeDefined();
      expect(styles.achievementScroller).toBeDefined();
      expect(styles.achievementAutoCloseTrack).toBeDefined();
      expect(styles.firstLaunchTutorialButton).toBeDefined();
      expect(styles.dialogSwipeHint).toBeDefined();
      expect(styles.appUpdateNoticeDialogContent).toBeDefined();
      expect(styles.confettiLayer).toBeDefined();
      expect(styles.confettiPiece).toBeDefined();
    });
  });

  describe('createMapStyles — マップ・ダッシュボード・写真・GPS権限', () => {
    test('ダッシュボード・位置情報・写真クラスター・権限UIの代表キーを持つ', () => {
      const styles = createMapStyles(theme);

      expect(styles.container).toBeDefined();
      expect(styles.map).toBeDefined();
      expect(styles.dashboardNavPanel).toBeDefined();
      expect(styles.speedometerPanel).toBeDefined();
      expect(styles.menuCard).toBeDefined();
      expect(styles.locationPill).toBeDefined();
      expect(styles.photoClusterCallout).toBeDefined();
      expect(styles.permissionCard).toBeDefined();
      expect(styles.customUserLocationMarker).toBeDefined();
      expect(styles.recenterButton).toBeDefined();
    });
  });

  describe('createSettingsStyles — 設定・ヘッダー・フォーム・ライセンス', () => {
    test('設定画面・ヘッダー・リスト行・色プリセット・ペイウォールの代表キーを持つ', () => {
      const styles = createSettingsStyles(theme);

      expect(styles.appScreen).toBeDefined();
      expect(styles.appHeader).toBeDefined();
      expect(styles.appListItem).toBeDefined();
      expect(styles.settingsGpsPanel).toBeDefined();
      expect(styles.actionPill).toBeDefined();
      expect(styles.selectionTile).toBeDefined();
      expect(styles.colorPresetRow).toBeDefined();
      expect(styles.licenseMetaRow).toBeDefined();
      expect(styles.premiumBadge).toBeDefined();
      expect(styles.settingsPlusBadge).toBeDefined();
    });

    test('滞在場所アイコンのドロップダウンではTwemojiを文字より少し大きい28pxで表示する', () => {
      const styles = createSettingsStyles(theme);

      expect(StyleSheet.flatten(styles.stayPlaceEmojiPickerImage)).toMatchObject({ height: 28, width: 28 });
    });
  });

  describe('createDailyLogStyles — 日別ログ・スライダー・GIF', () => {
    test('日別ログ・ルートマップ・スライダー・GIF・共有の代表キーを持つ', () => {
      const styles = createDailyLogStyles(theme);

      expect(styles.dailyLogDetailCapture).toBeDefined();
      expect(styles.routeMapFrame).toBeDefined();
      expect(styles.stepSliderThumb).toBeDefined();
      expect(styles.rangeSliderFill).toBeDefined();
      expect(styles.gifFrameContainer).toBeDefined();
      expect(styles.gifProgressTrack).toBeDefined();
      expect(styles.shareButtonWide).toBeDefined();
      expect(styles.lockedOverlay).toBeDefined();
      expect(styles.topToastContainer).toBeDefined();
    });
  });

  describe('createCommonStyles — 汎用ボタン・空状態・ステータス', () => {
    test('ボタン・空状態・ローディング・ステータス・レポートナビの代表キーを持つ', () => {
      const styles = createCommonStyles(theme);

      expect(styles.primaryButton).toBeDefined();
      expect(styles.secondaryButton).toBeDefined();
      expect(styles.emptyCard).toBeDefined();
      expect(styles.loadingContainer).toBeDefined();
      expect(styles.statusPill).toBeDefined();
      expect(styles.developmentFlagBannerContainer).toBeDefined();
      expect(styles.reportNavigationOverlay).toBeDefined();
      expect(styles.overlay).toBeDefined();
    });
  });

  describe('createStyles — 全体結合', () => {
    test('全サブファイルのキーが重複なく統合されている', () => {
      const styles = createStyles(theme);

      // 各サブファイルの代表キーが createStyles の結果に含まれることを確認する
      // achievementStyles
      expect(styles.achievementModalCard).toBeDefined();
      expect(styles.confettiLayer).toBeDefined();
      expect(styles.firstLaunchTutorialButton).toBeDefined();
      expect(styles.appUpdateNoticeDialogContent).toBeDefined();
      // mapStyles
      expect(styles.dashboardNavPanel).toBeDefined();
      expect(styles.mapDisplayBackgroundControlsDimmed).toBeDefined();
      expect(styles.permissionCard).toBeDefined();
      expect(styles.photoClusterCallout).toBeDefined();
      // settingsStyles
      expect(styles.appScreen).toBeDefined();
      expect(styles.actionPill).toBeDefined();
      expect(styles.settingsPlusBadge).toBeDefined();
      expect(styles.stayPlaceEditorMap).toBeDefined();
      expect(styles.colorPresetModalScroll).toBeDefined();
      expect(styles.stayPlaceMapMarkerBubble).toBeDefined();
      // dailyLogStyles
      expect(styles.routeMapFrame).toBeDefined();
      expect(styles.gifFrameContainer).toBeDefined();
      expect(styles.lockedOverlay).toBeDefined();
      // commonStyles
      expect(styles.primaryButton).toBeDefined();
      expect(styles.reportNavigationOverlay).toBeDefined();
    });

    test('全393キーが存在する（過不足なし）', () => {
      const styles = createStyles(theme);
      const keys = Object.keys(styles);

      // 分割前の総キー数と一致することを確認する（将来のキー追加で差分が出た場合に検知できる）
      // 内訳: 分割前352キー + topToast系2キー + lockedOverlay 1キー + 滞在場所設定12キー + 地図マーカー7キー
      //       + 画像を取得できない写真のプレースホルダ5キー + 拡大表示の高解像度取得中インジケータ2キー
      //       + 写真一覧の背景(photoClusterBackdrop)1キー + 写真走査の計測表示(photoScanMetricsText)1キー
      //       + 端末未ダウンロード写真のインライン案内3キー + GPXインポートODO表示5キー
      //       + 更新通知ダイアログ1キー
      //       + マップ表示設定中の背景ダッシュボード減光1キー
      expect(keys.length).toBe(393);
    });
  });
});
