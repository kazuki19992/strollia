import { requestStoreReview } from '../storeReview';

const mockIsAvailableAsync = jest.fn();
const mockRequestReview = jest.fn();

jest.mock('expo-store-review', () => ({
  isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
  requestReview: (...args: unknown[]) => mockRequestReview(...args),
}));

describe('ストアレビュー要求 requestStoreReview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestReview.mockResolvedValue(undefined);
  });

  it('利用可能なときrequestReviewを呼ぶ', async () => {
    mockIsAvailableAsync.mockResolvedValue(true);

    await requestStoreReview();

    expect(mockRequestReview).toHaveBeenCalledTimes(1);
  });

  it('利用不可のときrequestReviewを呼ばない', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);

    await requestStoreReview();

    expect(mockRequestReview).not.toHaveBeenCalled();
  });
});
