import { toLocalDate } from '../date';

describe('toLocalDate', () => {
  it('formats a Date as YYYY-MM-DD using local time', () => {
    const date = new Date(2026, 4, 4, 9, 30, 0);

    expect(toLocalDate(date)).toBe('2026-05-04');
  });
});
