import { STROLLIA_APP_STORE_URL, STROLLIA_PLAY_STORE_URL, getStrolliaStoreUrl } from '@/config/storeUrls';

describe('ストア URL 設定 storeUrls', () => {
  it('iOSでは App Store の URL を返す', () => {
    expect(getStrolliaStoreUrl('ios')).toBe(STROLLIA_APP_STORE_URL);
    expect(STROLLIA_APP_STORE_URL).toBe('https://apps.apple.com/jp/app/id6777709044');
  });

  it('Androidでは Google Play の URL を返す', () => {
    expect(getStrolliaStoreUrl('android')).toBe(STROLLIA_PLAY_STORE_URL);
    expect(STROLLIA_PLAY_STORE_URL).toBe('https://play.google.com/store/apps/details?id=com.kazuki19992.strollia');
  });

  it('未対応のOSでは App Store の URL を返す', () => {
    expect(getStrolliaStoreUrl('web')).toBe(STROLLIA_APP_STORE_URL);
  });
});
