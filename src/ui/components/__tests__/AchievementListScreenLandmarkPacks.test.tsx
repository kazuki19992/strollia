import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';

import { lightTheme } from '@/theme/theme';
import { createStyles } from '@/ui/appStyles';
import {
  LANDMARK_PACK_PLUS_PROMOTION_NOTE,
  LANDMARK_PACK_PLUS_TEASER_CTA,
  LANDMARK_PACK_SECTION_TITLE,
  PLUS_BADGE_LABEL,
} from '@/ui/appText';
import { AchievementListScreen, LANDMARK_PACK_TEASER_HIDDEN_HEIGHT } from '@/ui/components/AchievementListScreen';
import type { LandmarkPackListItem } from '@/ui/hooks/useLandmarkPackState';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: () => null,
  Feather: require('react-native').Text,
}));

const styles = createStyles(lightTheme);

/**
 * テスト用のトロフィーSVGアイコンモック。
 * RNTL v14 では型検索が廃止されたため、描画されたかを testID で確認できるホスト要素を返す。
 */
function MockTrophyIcon() {
  return <View testID="mock-trophy-icon" />;
}

/** 描画済みツリーからホストの Image 要素を全件返す。 */
const queryAllImages = () => screen.container.queryAll((node) => node.type === 'Image');

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

/** スポットセクションのpropsを埋めて実績画面を描画する。 */
async function renderScreen(
  overrides: Partial<{
    landmarkPackItems: LandmarkPackListItem[];
    isPlusActive: boolean;
    onSelectLandmarkPack: (packId: string) => void;
    onRequestPremium: () => void;
  }> = {},
) {
  await render(
    <AchievementListScreen
      items={[]}
      landmarkPackItems={overrides.landmarkPackItems ?? [fallsPackItem]}
      isPlusActive={overrides.isPlusActive ?? true}
      styles={styles}
      theme={lightTheme}
      onBackToMap={jest.fn()}
      onSelectAchievement={jest.fn()}
      onSelectLandmarkPack={overrides.onSelectLandmarkPack ?? jest.fn()}
      onRequestPremium={overrides.onRequestPremium ?? jest.fn()}
    />,
  );
}

describe('実績画面のスポットセクション', () => {
  beforeEach(() => {
    // SafeAreaView の deprecation 警告でテスト出力が埋まるのを避ける(既存テストと同じ扱い)
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('セクション見出しを表示する', async () => {
    await renderScreen();

    expect(screen.getByText(LANDMARK_PACK_SECTION_TITLE)).toBeTruthy();
  });

  it('パック名・説明・分数の進捗を表示する', async () => {
    await renderScreen();

    expect(screen.getByText('日本三名瀑')).toBeTruthy();
    expect(screen.getByText('日本を代表する3つの名瀑')).toBeTruthy();
    expect(screen.getByText('2/3')).toBeTruthy();
  });

  it('進捗バーへ到達率を渡す', async () => {
    await renderScreen();

    expect(screen.getByLabelText('日本三名瀑の進捗').props.accessibilityValue).toEqual({ min: 0, max: 100, now: 67 });
  });

  it('完走(フルカラー状態)したパック行はSVGアイコンで描画する', async () => {
    // fallsPackItemは2/3到達(grayscale状態)のため、完走(3/3・color状態)のフィクスチャで検証する
    const completedPackItem: LandmarkPackListItem = { ...fallsPackItem, visitedCount: 3 };
    await renderScreen({ landmarkPackItems: [completedPackItem] });

    // トロフィーの実体はSVGで、accessibilityLabel等では「どのコンポーネントが描画されたか」を確認できないため
    // モックが描画する testID で確認する
    expect(screen.getByTestId('mock-trophy-icon')).toBeTruthy();
  });

  it('未完走(白黒状態)のパック行はSVGアイコンではなくPNGをGrayscaleで描画する', async () => {
    // fallsPackItemは2/3到達でgrayscale状態(dimでもcolorでもない)
    await renderScreen();

    // Grayscale(react-native-color-matrix-image-filters)はreact-native-svgの
    // コンポーネントには効かないため、白黒状態もPNGのtrophyImageを描画する
    expect(screen.queryAllByTestId('mock-trophy-icon')).toHaveLength(0);
    expect(queryAllImages()).toHaveLength(1);
  });

  it('到達率50%以下のパック行は、他の実績トロフィーと同じ色でシルエット表示する', async () => {
    const halfPackItem: LandmarkPackListItem = { ...fallsPackItem, visitedCount: 1, totalCount: 2 };
    await renderScreen({ landmarkPackItems: [halfPackItem] });

    // シルエットは tintColor による単色塗りのため、SVGではなく透過PNGで描画する
    expect(screen.queryAllByTestId('mock-trophy-icon')).toHaveLength(0);
    const images = queryAllImages();
    expect(images).toHaveLength(1);
    expect(images[0].props.tintColor).toBe(lightTheme.colors.border);
  });

  it('白黒状態のパック行はシルエットにしない', async () => {
    await renderScreen();

    expect(queryAllImages()[0].props.tintColor).toBeUndefined();
  });

  it('パック行を押すと詳細を開く', async () => {
    const onSelectLandmarkPack = jest.fn();
    await renderScreen({ onSelectLandmarkPack });

    await fireEvent.press(screen.getByLabelText('日本三名瀑の詳細を開く'));

    expect(onSelectLandmarkPack).toHaveBeenCalledWith('01a0c450-6c00-7000-8000-000000000001');
  });

  it('パックが1件も無い場合はセクションを表示しない', async () => {
    await renderScreen({ landmarkPackItems: [] });

    expect(screen.queryByText(LANDMARK_PACK_SECTION_TITLE)).toBeNull();
  });

  describe('Plus未加入時', () => {
    /** 施錠状態のパック行。検知していないため到達数は0。 */
    const lockedPackItem: LandmarkPackListItem = { ...fallsPackItem, visitedCount: 0, isLocked: true };

    it('進捗を表示せずPaywallへ誘導する', async () => {
      const onRequestPremium = jest.fn();
      await renderScreen({ landmarkPackItems: [lockedPackItem], isPlusActive: false, onRequestPremium });

      expect(screen.queryByText('0/3')).toBeNull();
      expect(screen.queryByLabelText('日本三名瀑の進捗')).toBeNull();

      await fireEvent.press(screen.getByLabelText('日本三名瀑はStrollia Plus限定です'));

      expect(onRequestPremium).toHaveBeenCalled();
    });

    it('他のパックの存在を伝える誘導文を表示する', async () => {
      await renderScreen({ landmarkPackItems: [lockedPackItem], isPlusActive: false });

      expect(screen.getByText(LANDMARK_PACK_PLUS_PROMOTION_NOTE)).toBeTruthy();
    });

    it('無料パックと有料パックが混在する場合、両方を表示する', async () => {
      const freePackItem: LandmarkPackListItem = {
        ...fallsPackItem,
        pack: { ...fallsPackItem.pack, id: '01a0c450-6c00-7000-8000-000000000002', name: '日本本土四極' },
        isLocked: false,
      };
      await renderScreen({ landmarkPackItems: [lockedPackItem, freePackItem], isPlusActive: false });

      expect(screen.getByText('日本三名瀑')).toBeTruthy();
      expect(screen.getByText('日本本土四極')).toBeTruthy();
    });

    it('施錠中のパックが1件も無ければ誘導文を表示しない', async () => {
      const freePackItem: LandmarkPackListItem = { ...fallsPackItem, isLocked: false };
      await renderScreen({ landmarkPackItems: [freePackItem], isPlusActive: false });

      expect(screen.queryByText(LANDMARK_PACK_PLUS_PROMOTION_NOTE)).toBeNull();
    });

    it('施錠中は未到達と同じく、SVGアイコンではなくPNGのシルエットで描画する', async () => {
      // tintColorはネイティブ画像ビューの機能でreact-native-svgのコンポーネントには効かないため、
      // シルエット状態はSVGのtrophyIconではなくPNGのtrophyImageを描画する(実装側のコメント参照)
      await renderScreen({ landmarkPackItems: [lockedPackItem], isPlusActive: false });

      expect(screen.queryAllByTestId('mock-trophy-icon')).toHaveLength(0);
      const images = queryAllImages();
      expect(images).toHaveLength(1);
      expect(images[0].props.tintColor).toBe(lightTheme.colors.border);
    });
  });

  describe('Plus用パックのラベルと背景色グラデーションの導線', () => {
    /** 無料パック行。 */
    const freePack: LandmarkPackListItem = fallsPackItem;

    /** IDの末尾と名前からPlus用パック行を作る。未加入時は施錠・進捗なしになる。 */
    function plusPack(suffix: string, name: string, isLocked: boolean): LandmarkPackListItem {
      return {
        pack: { ...fallsPackItem.pack, id: `01a0c450-6c00-7000-8000-00000000010${suffix}`, name, isFree: false },
        visitedCount: 0,
        totalCount: 3,
        isLocked,
      };
    }

    /** グラデーション領域の中の固定高さの領域。スクリーンリーダーから隠しているため includeHiddenElements で取得する。 */
    const getHiddenArea = () => screen.getByTestId('landmark-pack-teaser-hidden-area', { includeHiddenElements: true });

    it('Plus未加入時は、Plus用パックの行にだけPlusラベルを付ける', async () => {
      await renderScreen({ landmarkPackItems: [freePack, plusPack('1', 'JRA競馬場', true)], isPlusActive: false });

      // Plus用パックの1件目は背景色を重ねるグラデーション領域内の行のため、読み上げ対象外の要素も含めて取得する
      const plusRow = screen.getByLabelText('JRA競馬場はStrollia Plus限定です', { includeHiddenElements: true });
      expect(within(plusRow).getByText(PLUS_BADGE_LABEL, { includeHiddenElements: true })).toBeTruthy();
      expect(within(screen.getByLabelText('日本三名瀑の詳細を開く')).queryByText(PLUS_BADGE_LABEL)).toBeNull();
    });

    it('Plus加入済みでも、Plus用パックの行にPlusラベルを付け、読み上げにもPlusを含める', async () => {
      await renderScreen({
        landmarkPackItems: [freePack, plusPack('1', 'JRA競馬場', false), plusPack('2', 'のぼれる灯台', false)],
        isPlusActive: true,
      });

      expect(within(screen.getByLabelText('JRA競馬場(Plus)の詳細を開く')).getByText(PLUS_BADGE_LABEL)).toBeTruthy();
      expect(within(screen.getByLabelText('のぼれる灯台(Plus)の詳細を開く')).getByText(PLUS_BADGE_LABEL)).toBeTruthy();
      expect(within(screen.getByLabelText('日本三名瀑の詳細を開く')).queryByText(PLUS_BADGE_LABEL)).toBeNull();
    });

    it('Plus加入済みなら全件を通常表示し、購入導線を出さない', async () => {
      await renderScreen({
        landmarkPackItems: [
          freePack,
          plusPack('1', 'JRA競馬場', false),
          plusPack('2', 'のぼれる灯台', false),
          plusPack('3', '日本三景', false),
        ],
        isPlusActive: true,
      });

      expect(screen.queryByLabelText(LANDMARK_PACK_PLUS_TEASER_CTA)).toBeNull();
      expect(screen.getByLabelText('日本三景(Plus)の詳細を開く')).toBeTruthy();
    });

    it('Plus未加入でPlus用パックが1件以上あると、購入導線を表示し、押すとペイウォールを開く', async () => {
      const onRequestPremium = jest.fn();
      await renderScreen({
        landmarkPackItems: [freePack, plusPack('1', 'JRA競馬場', true), plusPack('2', 'のぼれる灯台', true)],
        isPlusActive: false,
        onRequestPremium,
      });

      const cta = screen.getByLabelText(LANDMARK_PACK_PLUS_TEASER_CTA);
      expect(cta.props.accessibilityRole).toBe('button');
      await fireEvent.press(cta);

      expect(onRequestPremium).toHaveBeenCalledTimes(1);
      expect(screen.getByText(LANDMARK_PACK_PLUS_PROMOTION_NOTE)).toBeTruthy();
    });

    it('Plus未加入では無料パックだけを通常表示し、Plus用パックはすべてスクリーンリーダーから隠して押せなくする', async () => {
      const onRequestPremium = jest.fn();
      const onSelectLandmarkPack = jest.fn();
      await renderScreen({
        landmarkPackItems: [
          freePack,
          plusPack('1', 'JRA競馬場', true),
          plusPack('2', 'のぼれる灯台', true),
          plusPack('3', '日本三景', true),
        ],
        isPlusActive: false,
        onRequestPremium,
        onSelectLandmarkPack,
      });

      expect(screen.getByLabelText('日本三名瀑の詳細を開く')).toBeTruthy();
      // 件数を読み取れないよう、1件目も含めグラデーション領域内の行は読み上げ対象から外す
      expect(screen.queryByLabelText('JRA競馬場はStrollia Plus限定です')).toBeNull();
      expect(screen.queryByLabelText('のぼれる灯台はStrollia Plus限定です')).toBeNull();
      expect(screen.queryByText('日本三景')).toBeNull();

      // 隠した行は存在するが押せない
      await fireEvent.press(screen.getByLabelText('JRA競馬場はStrollia Plus限定です', { includeHiddenElements: true }));
      await fireEvent.press(screen.getByLabelText('のぼれる灯台はStrollia Plus限定です', { includeHiddenElements: true }));
      await fireEvent.press(screen.getByLabelText('日本三景はStrollia Plus限定です', { includeHiddenElements: true }));

      expect(onRequestPremium).not.toHaveBeenCalled();
      expect(onSelectLandmarkPack).not.toHaveBeenCalled();
    });

    it('2件目以降を置く領域は、件数によらず固定の高さにする', async () => {
      await renderScreen({ landmarkPackItems: [plusPack('1', 'JRA競馬場', true)], isPlusActive: false });
      const heightWithoutHiddenRows = StyleSheet.flatten(getHiddenArea().props.style).height;

      await renderScreen({
        landmarkPackItems: [
          plusPack('1', 'JRA競馬場', true),
          plusPack('2', 'のぼれる灯台', true),
          plusPack('3', '日本三景', true),
          plusPack('4', '追加パック', true),
        ],
        isPlusActive: false,
      });
      const heightWithHiddenRows = StyleSheet.flatten(getHiddenArea().props.style).height;

      expect(heightWithoutHiddenRows).toBe(LANDMARK_PACK_TEASER_HIDDEN_HEIGHT);
      expect(heightWithHiddenRows).toBe(LANDMARK_PACK_TEASER_HIDDEN_HEIGHT);
    });

    it('1件目の行は上端(0%)から下端(100%)まで背景色を段階的に濃く重ね、それより下は完全に隠す', async () => {
      await renderScreen({ landmarkPackItems: [freePack, plusPack('1', 'JRA競馬場', true)], isPlusActive: false });

      await fireEvent(screen.getByTestId('landmark-pack-teaser-peek-row', { includeHiddenElements: true }), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 100 } },
      });

      // 背景色を塗り不透明度を持つホスト要素を、グラデーションの帯として検索する
      const bands = screen.container.queryAll((node) => {
        const style = StyleSheet.flatten(node.props.style);
        return style?.backgroundColor === lightTheme.colors.background && typeof style.opacity === 'number';
      });
      const tops = bands.map((band) => StyleSheet.flatten(band.props.style).top);
      expect(tops[0]).toBe(0);
      // 最後の1枚は行の下端から始まり、2件目以降の領域を不透明度1で完全に隠す
      expect(tops[tops.length - 1]).toBe(100);
      expect(StyleSheet.flatten(bands[bands.length - 1].props.style).opacity).toBe(1);
      // 1件目の下端の帯も不透明度1(100%)に達する
      expect(StyleSheet.flatten(bands[bands.length - 2].props.style).opacity).toBe(1);
      expect(screen.container.queryAll((node) => node.props.intensity !== undefined)).toHaveLength(0);
    });

    it('Plus用パックが1件だけでも、件数を読み取らせないためグラデーション領域と購入導線を出す', async () => {
      await renderScreen({ landmarkPackItems: [freePack, plusPack('1', 'JRA競馬場', true)], isPlusActive: false });

      expect(screen.queryByLabelText('JRA競馬場はStrollia Plus限定です')).toBeNull();
      expect(screen.getByLabelText(LANDMARK_PACK_PLUS_TEASER_CTA)).toBeTruthy();
      expect(getHiddenArea()).toBeTruthy();
    });
  });
});
