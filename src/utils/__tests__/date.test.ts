import { toLocalDate } from '../date';

describe('toLocalDate', () => {
  it('Dateをローカル時刻基準のYYYY-MM-DDへ変換する', () => {
    const date = new Date(2026, 4, 4, 9, 30, 0);

    expect(toLocalDate(date)).toBe('2026-05-04');
  });
});
