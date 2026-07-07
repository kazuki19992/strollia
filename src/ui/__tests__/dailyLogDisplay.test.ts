import { formatGifFrameDateLabel } from '@/ui/dailyLogDisplay';

describe('formatGifFrameDateLabel', () => {
  it('YYYY年M月D日 (曜) 形式で表示する', () => {
    // 2026-06-12 は金曜日
    expect(formatGifFrameDateLabel('2026-06-12')).toBe('2026年6月12日 (金)');
    // 2026-05-31 は日曜日
    expect(formatGifFrameDateLabel('2026-05-31')).toBe('2026年5月31日 (日)');
  });
});
