import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { __resetApiClientForTests } from '@/core/api/client';
import { mentorRepo } from '@/features/mentor/mentorRepo';
import type {
  MentorServiceDeliveryMode,
  MentorServiceResponse,
} from '@/features/mentor/types';

const BASE = 'https://api.skillswap.asia';

function envelope(data: unknown) {
  return { timestamp: '2026-10-01T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

function trang(content: unknown[]) {
  return {
    content,
    page: 0,
    size: 12,
    totalElements: content.length,
    totalPages: 1,
    last: true,
  };
}

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

describe('mentorRepo', () => {
  it('gợi ý mentor gửi limit và trả về MẢNG, không phải trang', async () => {
    // `GET /api/mentors/recommendations` trả `MentorRecommendationResponse[]`,
    // khác mọi endpoint khác của nhánh này (đều là PageResponse).
    let seen: string | null = null;
    server.use(
      http.get(`${BASE}/api/mentors/recommendations`, ({ request }) => {
        seen = new URL(request.url).searchParams.get('limit');
        return HttpResponse.json(envelope([{ mentor: {}, matchScore: 95.5, matchReasons: ['a'] }]));
      }),
    );

    const ketQua = await mentorRepo.getRecommendations(8);

    expect(Array.isArray(ketQua)).toBe(true);
    expect(seen).toBe('8');
  });

  it('tìm mentor gửi đúng tên query param của backend', async () => {
    let seen = null as URLSearchParams | null;
    server.use(
      http.get(`${BASE}/api/mentors`, ({ request }) => {
        seen = new URL(request.url).searchParams;
        return HttpResponse.json(envelope(trang([])));
      }),
    );

    await mentorRepo.searchMentors({
      page: 2,
      size: 24,
      keyword: 'spring',
      campusId: 'c1',
      specializationId: 's1',
      sortBy: 'ratingAverage',
      direction: 'ASC',
    });

    expect(seen?.get('page')).toBe('2');
    expect(seen?.get('size')).toBe('24');
    expect(seen?.get('keyword')).toBe('spring');
    expect(seen?.get('campusId')).toBe('c1');
    expect(seen?.get('specializationId')).toBe('s1');
    expect(seen?.get('sortBy')).toBe('ratingAverage');
    expect(seen?.get('direction')).toBe('ASC');
  });

  it('bỏ hẳn tham số rỗng thay vì gửi chuỗi trống', async () => {
    // `keyword=` làm backend hiểu là "tìm chuỗi rỗng" chứ không phải "không lọc".
    let seen = null as URLSearchParams | null;
    server.use(
      http.get(`${BASE}/api/mentors`, ({ request }) => {
        seen = new URL(request.url).searchParams;
        return HttpResponse.json(envelope(trang([])));
      }),
    );

    await mentorRepo.searchMentors({ keyword: '', campusId: undefined });

    expect(seen?.has('keyword')).toBe(false);
    expect(seen?.has('campusId')).toBe(false);
  });

  it('GIỮ tham số page 0 — đó là trang đầu, không phải giá trị rỗng', async () => {
    // `page: 0` là falsy. Lọc theo tính truthy sẽ bỏ nó đi và backend dùng mặc
    // định — tình cờ cũng là 0, nên lỗi này ẩn cho tới khi ai đó đổi mặc định.
    let seen = null as URLSearchParams | null;
    server.use(
      http.get(`${BASE}/api/mentors`, ({ request }) => {
        seen = new URL(request.url).searchParams;
        return HttpResponse.json(envelope(trang([])));
      }),
    );

    await mentorRepo.searchMentors({ page: 0 });

    expect(seen?.get('page')).toBe('0');
  });

  it('lấy chi tiết mentor theo id', async () => {
    server.use(
      http.get(`${BASE}/api/mentors/m1`, () =>
        HttpResponse.json(envelope({ identity: { mentorUserId: 'm1' } })),
      ),
    );

    await expect(mentorRepo.getMentor('m1')).resolves.toMatchObject({
      identity: { mentorUserId: 'm1' },
    });
  });

  it('lấy đánh giá của mentor, truyền đúng page và size', async () => {
    let seen = null as URLSearchParams | null;
    server.use(
      http.get(`${BASE}/api/mentors/m1/reviews`, ({ request }) => {
        seen = new URL(request.url).searchParams;
        return HttpResponse.json(envelope(trang([{ reviewId: 'r1' }])));
      }),
    );

    const page = await mentorRepo.getMentorReviews('m1', { page: 1, size: 20 });

    expect(page.content).toHaveLength(1);
    expect(seen?.get('page')).toBe('1');
    expect(seen?.get('size')).toBe('20');
  });

  it('dịch vụ của mentor đọc được nguyên hình dạng DTO thật', async () => {
    // Phép kiểm của riêng người thực hiện: doc §3 đang CŨ hơn source Java
    // (`MentorServiceResponse.java` có thêm `coverImageUrl`, và `deliveryMode` là
    // enum chứ không phải chuỗi tự do). Fixture ở đây dựng theo source Java, và
    // repo thật phải trả nó về nguyên vẹn chứ không rơi mất field nào.
    const dichVu: MentorServiceResponse = {
      serviceId: 'sv1',
      mentorUserId: 'm1',
      title: 'Review CV xin thực tập',
      description: 'Chỉ ra điểm yếu của CV',
      expectedOutcome: 'CV rõ điểm mạnh',
      durationMinutes: 60,
      isFree: false,
      priceScoin: 110,
      isActive: true,
      maintainPostSessionChat: false,
      deliveryMode: 'ONE_TO_ONE',
      coverImageUrl: null,
      version: 4,
      createdAt: '2026-06-20T09:00:00',
      updatedAt: '2026-06-24T10:00:00',
    };
    server.use(
      http.get(`${BASE}/api/mentors/m1`, () =>
        HttpResponse.json(envelope({ identity: { mentorUserId: 'm1' }, services: [dichVu] })),
      ),
    );

    const hoSo = await mentorRepo.getMentor('m1');

    expect(hoSo.services[0]).toEqual(dichVu);
  });

  it('deliveryMode là union đóng, không phải chuỗi tự do', () => {
    // Phép kiểm ở tầng KIỂU của riêng người thực hiện: `deliveryMode` là enum
    // `MentorServiceDeliveryMode` phía Java, chỉ có `ONE_TO_ONE`. Nếu ai đó nới
    // kiểu này về `string` thì dòng `@ts-expect-error` dưới đây thành vô ích và
    // `npm run typecheck` đỏ — đó chính là cách test này tự bảo vệ mình.
    // @ts-expect-error — 'GROUP' không phải giá trị enum nào của backend
    const sai: MentorServiceDeliveryMode = 'GROUP';

    expect(sai).toBe('GROUP');
  });

  it('không nhầm đường dẫn đánh giá với đường dẫn chi tiết mentor', async () => {
    // Phép kiểm của riêng người thực hiện: MSW đang bật `onUnhandledRequest:
    // 'error'`, nhưng `/api/mentors/m1` khớp cả hai nếu ai đó viết sai path —
    // chỉ đăng ký ĐÚNG handler reviews thì gọi sai chỗ sẽ ném lỗi.
    server.use(
      http.get(`${BASE}/api/mentors/m1/reviews`, () =>
        HttpResponse.json(envelope(trang([{ reviewId: 'r1' }]))),
      ),
    );

    await expect(mentorRepo.getMentorReviews('m1', {})).resolves.toMatchObject({ last: true });
  });
});
