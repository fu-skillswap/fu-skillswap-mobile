import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { createQueryClient } from '@/core/api/queryClient';
import {
  useMentor,
  useMentorRecommendations,
  useMentorReviews,
  useMentorSearch,
} from '@/features/mentor/hooks/useMentorQueries';
import type { BoLocTimMentor } from '@/features/mentor/mentorRepo';

const BASE = 'https://api.skillswap.asia';

function envelope(data: unknown) {
  return { timestamp: '2026-10-01T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

/** Một `PageResponse<T>` tối giản — chỉ đủ field để hook đọc được */
function trang(content: unknown[], page: number, last: boolean) {
  return { content, page, size: 2, totalElements: 4, totalPages: 2, last };
}

const server = setupServer();

/** Một QueryClient cho mỗi test — xem Global Constraints. */
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
});
afterEach(() => {
  queryClient.clear();
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useMentorSearch', () => {
  it('gộp nhiều trang offset thành một mảng phẳng', async () => {
    const trangDaGui: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/api/mentors`, ({ request }) => {
        const p = new URL(request.url).searchParams.get('page');
        trangDaGui.push(p);
        return HttpResponse.json(
          envelope(
            p === '1' ? trang([{ id: 3 }, { id: 4 }], 1, true) : trang([{ id: 1 }, { id: 2 }], 0, false),
          ),
        );
      }),
    );

    const { result } = await renderHook(() => useMentorSearch({}), { wrapper });
    await waitFor(() => expect(result.current.mentors).toHaveLength(2));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.mentors).toHaveLength(4));
    // Trang kế tiếp phải là SỐ TRANG, không phải cursor. Trang đầu gửi `page=0`
    // tường minh: `cleanParams` của repo lọc theo `undefined`/chuỗi rỗng chứ
    // không theo tính truthy, nên số 0 vẫn rời máy.
    expect(trangDaGui).toEqual(['0', '1']);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('`page` rác trong bộ lọc KHÔNG ghi đè số trang của hook', async () => {
    // Kiểu `BoLocTimMentor` đã chặn `page` ở tầng biên dịch, nhưng dữ liệu có thể
    // tới từ chỗ không được kiểm kiểu (route param, JSON lưu lại). Cast ở đây là
    // CỐ Ý: nó dựng lại đúng tình huống đó để khoá thứ tự spread trong `queryFn`
    // (`page: pageParam` phải nằm SAU `...filters`).
    const boLocCoRac = { size: 2, page: 7 } as unknown as BoLocTimMentor;
    const trangDaGui: (string | null)[] = [];
    const sizeDaGui: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/api/mentors`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        const p = params.get('page');
        trangDaGui.push(p);
        sizeDaGui.push(params.get('size'));
        return HttpResponse.json(
          envelope(p === '1' ? trang([{ id: 2 }], 1, true) : trang([{ id: 1 }], 0, false)),
        );
      }),
    );

    const { result } = await renderHook(() => useMentorSearch(boLocCoRac), { wrapper });
    await waitFor(() => expect(result.current.mentors).toHaveLength(1));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.mentors).toHaveLength(2));
    expect(trangDaGui).toEqual(['0', '1']);
    // `size` thì NGƯỢC LẠI: là bộ lọc hợp lệ và phải tới được backend.
    expect(sizeDaGui).toEqual(['2', '2']);
  });

  it('taiTrangKe gọi hai lần trong cùng một tick chỉ xin trang kế MỘT lần', async () => {
    // Chốt chặn nằm trong hook (`useChotChanTrangKe`). Bỏ `useRef` đi thì cả hai
    // lần gọi cùng đọc `isFetchingNextPage === false` của lần render cũ và trang 1
    // rời máy hai lượt — danh sách bị nối trùng.
    const trangDaGui: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/api/mentors`, ({ request }) => {
        const p = new URL(request.url).searchParams.get('page');
        trangDaGui.push(p);
        return HttpResponse.json(
          envelope(p === '1' ? trang([{ id: 2 }], 1, true) : trang([{ id: 1 }], 0, false)),
        );
      }),
    );

    const { result } = await renderHook(() => useMentorSearch({}), { wrapper });
    await waitFor(() => expect(result.current.mentors).toHaveLength(1));

    // Hai lời gọi trong CÙNG một tick, không await ở giữa — đúng như FlatList bắn
    // `onEndReached` hai lần trong một frame.
    await act(async () => {
      result.current.taiTrangKe();
      result.current.taiTrangKe();
    });

    await waitFor(() => expect(result.current.mentors).toHaveLength(2));
    expect(trangDaGui.filter((p) => p === '1')).toHaveLength(1);
  });

  it('taiTrangKe không xin gì khi đã hết trang', async () => {
    let soGoi = 0;
    server.use(
      http.get(`${BASE}/api/mentors`, () => {
        soGoi += 1;
        return HttpResponse.json(envelope(trang([{ id: 1 }], 0, true)));
      }),
    );

    const { result } = await renderHook(() => useMentorSearch({}), { wrapper });
    await waitFor(() => expect(result.current.mentors).toHaveLength(1));

    await act(async () => {
      result.current.taiTrangKe();
    });

    expect(soGoi).toBe(1);
  });
});

describe('useMentorRecommendations', () => {
  it('trả về mảng gợi ý, không bọc trong trang', async () => {
    server.use(
      http.get(`${BASE}/api/mentors/recommendations`, () =>
        HttpResponse.json(
          envelope([
            {
              mentor: { identity: { mentorUserId: 'm1' } },
              matchScore: 90,
              matchReasons: ['Cùng chuyên ngành'],
            },
          ]),
        ),
      ),
    );

    const { result } = await renderHook(() => useMentorRecommendations(), { wrapper });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data?.[0]?.matchReasons).toEqual(['Cùng chuyên ngành']);
  });

  it('`limit` tới được backend', async () => {
    // Không có test này thì bỏ hẳn tham số trong `queryFn` vẫn xanh, và màn hình
    // xin 5 gợi ý sẽ nhận về số mặc định của backend.
    let limitDaGui: string | null = 'chua-goi';
    server.use(
      http.get(`${BASE}/api/mentors/recommendations`, ({ request }) => {
        limitDaGui = new URL(request.url).searchParams.get('limit');
        return HttpResponse.json(envelope([]));
      }),
    );

    const { result } = await renderHook(() => useMentorRecommendations(5), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(limitDaGui).toBe('5');
  });

  it('hai `limit` khác nhau KHÔNG dùng chung ô cache', async () => {
    // `limit` phải nằm trong khoá query. Thiếu nó thì hook thứ hai đọc lại kết quả
    // của hook thứ nhất: màn hình xin 2 gợi ý nhận về đúng 1.
    let soGoi = 0;
    server.use(
      http.get(`${BASE}/api/mentors/recommendations`, ({ request }) => {
        soGoi += 1;
        const soLuong = Number(new URL(request.url).searchParams.get('limit'));
        return HttpResponse.json(
          envelope(
            Array.from({ length: soLuong }, (_unused, i) => ({
              mentor: { identity: { mentorUserId: `m${i}` } },
              matchScore: 90,
              matchReasons: [],
            })),
          ),
        );
      }),
    );

    const { result } = await renderHook(
      () => ({ it: useMentorRecommendations(1), nhieu: useMentorRecommendations(2) }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.it.data).toHaveLength(1));
    await waitFor(() => expect(result.current.nhieu.data).toHaveLength(2));
    expect(soGoi).toBe(2);
  });
});

describe('useMentorSearch — enabled', () => {
  it('`enabled` false thì KHÔNG có request nào rời máy', async () => {
    // Màn hình tắt truy vấn này khi người dùng chưa gõ gì. MSW đang bật
    // `onUnhandledRequest: 'error'`, nhưng handler có đăng ký nên không bắt được
    // bằng cách đó — phải đếm.
    let soGoi = 0;
    server.use(
      http.get(`${BASE}/api/mentors`, () => {
        soGoi += 1;
        return HttpResponse.json(envelope(trang([], 0, true)));
      }),
    );

    const { result } = await renderHook(() => useMentorSearch({ keyword: '' }, false), {
      wrapper,
    });

    await waitFor(() => expect(result.current.mentors).toEqual([]));
    expect(soGoi).toBe(0);
  });
});

describe('useMentor', () => {
  it('tải hồ sơ mentor đầy đủ', async () => {
    server.use(
      http.get(`${BASE}/api/mentors/m1`, () =>
        HttpResponse.json(envelope({ identity: { mentorUserId: 'm1', displayName: 'Mentor Một' } })),
      ),
    );

    const { result } = await renderHook(() => useMentor('m1'), { wrapper });

    await waitFor(() => expect(result.current.data?.identity.mentorUserId).toBe('m1'));
  });

  it('id rỗng thì KHÔNG gọi đường dẫn cụt', async () => {
    // Thiếu chốt này thì mỗi lần route chưa có tham số sẽ có một
    // `GET /api/mentors/` rời máy — xem `useForumPost` của nhánh diễn đàn.
    let soGoi = 0;
    server.use(
      http.get(`${BASE}/api/mentors`, () => {
        soGoi += 1;
        return HttpResponse.json(envelope({}));
      }),
      http.get(`${BASE}/api/mentors/`, () => {
        soGoi += 1;
        return HttpResponse.json(envelope({}));
      }),
    );

    const { result } = await renderHook(() => useMentor(''), { wrapper });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(result.current.data).toBeUndefined();
    expect(soGoi).toBe(0);
  });
});

/** Handler phân trang đánh giá: trang 0 còn tiếp, trang 1 là trang cuối. */
function dungHandlerDanhGia(trangDaGui: (string | null)[]) {
  return http.get(`${BASE}/api/mentors/m1/reviews`, ({ request }) => {
    const p = new URL(request.url).searchParams.get('page');
    trangDaGui.push(p);
    return HttpResponse.json(
      envelope(
        p === '1'
          ? trang([{ reviewId: 'r2' }], 1, true)
          : trang([{ reviewId: 'r1' }], 0, false),
      ),
    );
  });
}

describe('useMentorReviews', () => {
  it('gộp các trang đánh giá và gửi đúng dãy số trang', async () => {
    // Phải ĐỌC query string, không chỉ đếm bản ghi: một hook gửi `size=0` thay vì
    // `page=0` vẫn nối đủ hai trang nếu handler bỏ qua tham số.
    const trangDaGui: (string | null)[] = [];
    server.use(dungHandlerDanhGia(trangDaGui));

    const { result } = await renderHook(() => useMentorReviews('m1'), { wrapper });
    await waitFor(() => expect(result.current.reviews).toHaveLength(1));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.reviews).toHaveLength(2));
    expect(trangDaGui).toEqual(['0', '1']);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('taiTrangKe gọi hai lần trong cùng một tick chỉ xin trang kế MỘT lần', async () => {
    const trangDaGui: (string | null)[] = [];
    server.use(dungHandlerDanhGia(trangDaGui));

    const { result } = await renderHook(() => useMentorReviews('m1'), { wrapper });
    await waitFor(() => expect(result.current.reviews).toHaveLength(1));

    await act(async () => {
      result.current.taiTrangKe();
      result.current.taiTrangKe();
    });

    await waitFor(() => expect(result.current.reviews).toHaveLength(2));
    expect(trangDaGui.filter((p) => p === '1')).toHaveLength(1);
  });

  it('chạy cùng `useMentor` trên một QueryClient KHÔNG ghi đè hồ sơ', async () => {
    // Đây là màn hồ sơ mentor: hai hook sống cùng lúc. Nếu đánh giá dùng khoá
    // `detail(id)` thì hai truy vấn khác hình dạng cùng ghi vào một ô cache và hồ
    // sơ bị thay bằng trang đánh giá.
    server.use(
      http.get(`${BASE}/api/mentors/m1`, () =>
        HttpResponse.json(envelope({ identity: { mentorUserId: 'm1', displayName: 'Mentor Một' } })),
      ),
      http.get(`${BASE}/api/mentors/m1/reviews`, () =>
        HttpResponse.json(envelope(trang([{ reviewId: 'r1' }], 0, true))),
      ),
    );

    const { result } = await renderHook(
      () => ({ hoSo: useMentor('m1'), danhGia: useMentorReviews('m1') }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.danhGia.reviews).toHaveLength(1));
    await waitFor(() =>
      expect(result.current.hoSo.data?.identity.displayName).toBe('Mentor Một'),
    );
    expect(result.current.hoSo.data?.identity.displayName).toBe('Mentor Một');
  });

  it('id rỗng thì KHÔNG gọi đường dẫn cụt', async () => {
    // Đối xứng với `useMentor('')`: đường dẫn `/api/mentors//reviews` là rác.
    // Phải ĐẾM chứ không dựa vào `onUnhandledRequest: 'error'` — một query lỗi
    // cũng để lại `reviews` rỗng y như một query bị tắt.
    let soGoi = 0;
    server.use(
      http.get(`${BASE}/api/mentors/:mentorUserId/reviews`, () => {
        soGoi += 1;
        return HttpResponse.json(envelope(trang([], 0, true)));
      }),
      http.get(`${BASE}/api/mentors//reviews`, () => {
        soGoi += 1;
        return HttpResponse.json(envelope(trang([], 0, true)));
      }),
    );

    const { result } = await renderHook(() => useMentorReviews(''), { wrapper });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(soGoi).toBe(0);
  });
});
