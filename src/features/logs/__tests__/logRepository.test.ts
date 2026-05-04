import { db } from '../../../db/database';
import { deleteAllLogData } from '../logRepository';

jest.mock('../../../db/database', () => ({
  db: {
    withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
    runAsync: jest.fn(),
  },
}));

describe('deleteAllLogData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes location points and daily summaries in one transaction', async () => {
    await deleteAllLogData();

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync).toHaveBeenNthCalledWith(1, 'DELETE FROM location_points');
    expect(db.runAsync).toHaveBeenNthCalledWith(2, 'DELETE FROM daily_logs');
  });
});
