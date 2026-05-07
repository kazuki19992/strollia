import { canEvaluateAchievementsInForeground } from '../achievementEvaluationGate';

describe('実績評価ガード canEvaluateAchievementsInForeground', () => {
  test('実績解除ダイアログが表示されていない場合は評価できる', () => {
    expect(canEvaluateAchievementsInForeground(false)).toBe(true);
  });

  test('実績解除ダイアログが表示されている場合は評価しない', () => {
    expect(canEvaluateAchievementsInForeground(true)).toBe(false);
  });
});
