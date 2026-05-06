import { STROLLIA_PLUS_ENTITLEMENT_ID } from '../premiumCatalog';
import { getDefaultPremiumAccessState, resolvePremiumAccessState, RevenueCatClient } from '../revenueCatAccess';

describe('RevenueCat課金状態 revenueCatAccess', () => {
  it('未接続時はPlus無効の既定状態を返す', () => {
    expect(getDefaultPremiumAccessState()).toEqual({
      isPlusActive: false,
      entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID,
    });
  });

  it('RevenueCatクライアントからPlus有効状態を解決する', async () => {
    const client: RevenueCatClient = {
      hasActiveEntitlement: jest.fn().mockResolvedValue(true),
    };

    await expect(resolvePremiumAccessState(client)).resolves.toEqual({
      isPlusActive: true,
      entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID,
    });
    expect(client.hasActiveEntitlement).toHaveBeenCalledWith(STROLLIA_PLUS_ENTITLEMENT_ID);
  });
});
