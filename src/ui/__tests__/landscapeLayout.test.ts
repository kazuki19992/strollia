import { isLandscapeLayout } from '@/ui/landscapeLayout';

describe('横画面判定 isLandscapeLayout', () => {
  test('幅が高さより大きい場合は横画面と判定する', () => {
    expect(isLandscapeLayout(1180, 820)).toBe(true);
  });

  test('高さが幅より大きい場合は縦画面と判定する', () => {
    expect(isLandscapeLayout(820, 1180)).toBe(false);
  });

  test('正方形は縦画面扱いにする', () => {
    expect(isLandscapeLayout(800, 800)).toBe(false);
  });

  test('NaNや0以下の不正な寸法は縦画面扱いにする', () => {
    expect(isLandscapeLayout(Number.NaN, 800)).toBe(false);
    expect(isLandscapeLayout(0, -1)).toBe(false);
  });
});
