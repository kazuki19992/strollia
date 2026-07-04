import {
  STROLLIA_PLUS_ENTITLEMENT_ID,
  STROLLIA_PLUS_MONTHLY_PRODUCT_ID,
  STROLLIA_PLUS_YEARLY_PRODUCT_ID,
  PREMIUM_CUSTOMIZATION_ITEMS,
} from '@/features/premium/premiumCatalog';

describe('premiumCatalog 定数・型', () => {
  describe('STROLLIA_PLUS_ENTITLEMENT_ID', () => {
    it('RevenueCat上の権利IDが "Strollia Plus" である', () => {
      expect(STROLLIA_PLUS_ENTITLEMENT_ID).toBe('Strollia Plus');
    });
  });

  describe('STROLLIA_PLUS_MONTHLY_PRODUCT_ID', () => {
    it('月額商品IDが "strollia_plus_monthly" である', () => {
      expect(STROLLIA_PLUS_MONTHLY_PRODUCT_ID).toBe('strollia_plus_monthly');
    });
  });

  describe('STROLLIA_PLUS_YEARLY_PRODUCT_ID', () => {
    it('年額商品IDが "strollia_plus_yearly" である', () => {
      expect(STROLLIA_PLUS_YEARLY_PRODUCT_ID).toBe('strollia_plus_yearly');
    });
  });

  describe('PREMIUM_CUSTOMIZATION_ITEMS', () => {
    it('少なくとも1件の項目が存在する', () => {
      expect(PREMIUM_CUSTOMIZATION_ITEMS.length).toBeGreaterThan(0);
    });

    it('各項目に id / title / description が含まれる', () => {
      for (const item of PREMIUM_CUSTOMIZATION_ITEMS) {
        expect(typeof item.id).toBe('string');
        expect(item.id.length).toBeGreaterThan(0);
        expect(typeof item.title).toBe('string');
        expect(item.title.length).toBeGreaterThan(0);
        expect(typeof item.description).toBe('string');
        expect(item.description.length).toBeGreaterThan(0);
      }
    });

    it('userLocationIcon 項目が含まれる', () => {
      const item = PREMIUM_CUSTOMIZATION_ITEMS.find((i) => i.id === 'userLocationIcon');
      expect(item).toBeDefined();
    });

    it('各項目の id が重複しない', () => {
      const ids = PREMIUM_CUSTOMIZATION_ITEMS.map((i) => i.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });
  });
});
