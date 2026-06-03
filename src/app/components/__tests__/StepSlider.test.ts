import { normalizeValue, valueFromLocation } from '../StepSlider';

describe('ステップスライダー StepSlider', () => {
  it('値を指定範囲内のステップへ丸める', () => {
    expect(normalizeValue(44, 0, 1440, 30)).toBe(30);
    expect(normalizeValue(46, 0, 1440, 30)).toBe(60);
    expect(normalizeValue(-10, 0, 1440, 30)).toBe(0);
    expect(normalizeValue(1460, 0, 1440, 30)).toBe(1440);
  });

  it('トラック位置から30分刻みの値を求める', () => {
    expect(valueFromLocation(50, 100, 0, 1440, 30)).toBe(720);
    expect(valueFromLocation(1, 100, 0, 1440, 30)).toBe(0);
    expect(valueFromLocation(100, 100, 0, 1440, 30)).toBe(1440);
  });
});
