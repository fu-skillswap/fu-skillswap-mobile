import { ApiClientError } from '@/core/api/errors';
import { __resetQueryClientForTests, createQueryClient, shouldRetryQuery } from '@/core/api/queryClient';

describe('shouldRetryQuery', () => {
  it('không retry lỗi 4xx vì thử lại cũng không đổi kết quả', () => {
    expect(shouldRetryQuery(0, new ApiClientError(404, 'SYS_0003', 'Không tìm thấy'))).toBe(false);
    expect(shouldRetryQuery(0, new ApiClientError(403, 'AUTH_1002', 'Không có quyền'))).toBe(false);
  });

  it('không retry lỗi 429 để tôn trọng rate limit của backend', () => {
    expect(shouldRetryQuery(0, new ApiClientError(429, 'TOO_MANY_REQUESTS', 'Chậm lại'))).toBe(
      false,
    );
  });

  it('retry tối đa 2 lần với lỗi 5xx', () => {
    const error = new ApiClientError(500, 'SYS_0010', 'Internal error');

    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(1, error)).toBe(true);
    expect(shouldRetryQuery(2, error)).toBe(false);
  });

  it('retry khi mất mạng (status 0) để dữ liệu tự lấp đầy lúc có sóng lại', () => {
    expect(shouldRetryQuery(0, new ApiClientError(0, 'NETWORK_ERROR', 'Network Error'))).toBe(true);
  });
});

describe('__resetQueryClientForTests', () => {
  it('gỡ cả bộ hẹn giờ gcTime của mutation, thứ mà clear() bỏ sót', () => {
    // `QueryCache.clear()` gọi `query.destroy()`, còn `MutationCache.clear()`
    // thì KHÔNG gọi `mutation.destroy()`. Bộ hẹn giờ 5 phút còn sót lại giữ
    // event loop của Node sống và Jest treo với "Jest did not exit one second
    // after the test run has completed".
    jest.useFakeTimers();
    try {
      // Mutation hẹn giờ dọn rác ngay từ lúc được dựng.
      const chiClear = createQueryClient();
      chiClear.getMutationCache().build(chiClear, { mutationFn: async () => 'xong' });
      chiClear.clear();
      // Mutation đã biến khỏi cache, nhưng hẹn giờ của nó thì chưa.
      expect(jest.getTimerCount()).toBe(1);

      const daDon = createQueryClient();
      daDon.getMutationCache().build(daDon, { mutationFn: async () => 'xong' });
      expect(jest.getTimerCount()).toBe(2);

      __resetQueryClientForTests(daDon);

      // Chỉ còn đúng cái hẹn giờ mà `clear()` bỏ sót ở trên.
      expect(jest.getTimerCount()).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
