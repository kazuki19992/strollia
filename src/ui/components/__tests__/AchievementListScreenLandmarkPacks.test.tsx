import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { lightTheme } from '@/theme/theme';
import { createStyles } from '@/ui/appStyles';
import { LANDMARK_PACK_PLUS_PROMOTION_NOTE, LANDMARK_PACK_SECTION_TITLE } from '@/ui/appText';
import { AchievementListScreen } from '@/ui/components/AchievementListScreen';
import type { LandmarkPackListItem } from '@/ui/hooks/useLandmarkPackState';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: () => null,
  Feather: require('react-native').Text,
}));

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
  },
  visitedCount: 2,
  totalCount: 3,
  isLocked: false,
};

/** スポットセクションのpropsを埋めて実績画面を描画する。 */
function renderScreen(
  overrides: Partial<{
    landmarkPackItems: LandmarkPackListItem[];
    isPlusActive: boolean;
    onSelectLandmarkPack: (packId: string) => void;
    onRequestPremium: () => void;
  }> = {},
) {
  render(
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

  it('Plus限定であることを示す見出しを表示する', () => {
    renderScreen();

    expect(screen.getByText(LANDMARK_PACK_SECTION_TITLE)).toBeTruthy();
  });

  it('パック名・説明・分数の進捗を表示する', () => {
    renderScreen();

    expect(screen.getByText('日本三名瀑')).toBeTruthy();
    expect(screen.getByText('日本を代表する3つの名瀑')).toBeTruthy();
    expect(screen.getByText('2/3')).toBeTruthy();
  });

  it('進捗バーへ到達率を渡す', () => {
    renderScreen();

    expect(screen.getByLabelText('日本三名瀑の進捗').props.accessibilityValue).toEqual({ min: 0, max: 100, now: 67 });
  });

  it('パック行を押すと詳細を開く', () => {
    const onSelectLandmarkPack = jest.fn();
    renderScreen({ onSelectLandmarkPack });

    act(() => {
      fireEvent.press(screen.getByLabelText('日本三名瀑の詳細を開く'));
    });

    expect(onSelectLandmarkPack).toHaveBeenCalledWith('01a0c450-6c00-7000-8000-000000000001');
  });

  it('パックが1件も無い場合はセクションを表示しない', () => {
    renderScreen({ landmarkPackItems: [] });

    expect(screen.queryByText(LANDMARK_PACK_SECTION_TITLE)).toBeNull();
  });

  describe('Plus未加入時', () => {
    /** 施錠状態のパック行。検知していないため到達数は0。 */
    const lockedPackItem: LandmarkPackListItem = { ...fallsPackItem, visitedCount: 0, isLocked: true };

    it('進捗を表示せずPaywallへ誘導する', () => {
      const onRequestPremium = jest.fn();
      renderScreen({ landmarkPackItems: [lockedPackItem], isPlusActive: false, onRequestPremium });

      expect(screen.queryByText('0/3')).toBeNull();
      expect(screen.queryByLabelText('日本三名瀑の進捗')).toBeNull();

      act(() => {
        fireEvent.press(screen.getByLabelText('日本三名瀑はStrollia Plus限定です'));
      });

      expect(onRequestPremium).toHaveBeenCalled();
    });

    it('他のパックの存在を伝える誘導文を表示する', () => {
      renderScreen({ landmarkPackItems: [lockedPackItem], isPlusActive: false });

      expect(screen.getByText(LANDMARK_PACK_PLUS_PROMOTION_NOTE)).toBeTruthy();
    });

    it('2件以上渡されても先頭1件だけを表示する', () => {
      const secondPackItem: LandmarkPackListItem = {
        ...lockedPackItem,
        pack: { ...lockedPackItem.pack, id: '01a0c450-6c00-7000-8000-000000000002', name: '日本本土四極' },
      };
      renderScreen({ landmarkPackItems: [lockedPackItem, secondPackItem], isPlusActive: false });

      expect(screen.getByText('日本三名瀑')).toBeTruthy();
      expect(screen.queryByText('日本本土四極')).toBeNull();
    });
  });
});
