import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { __resetApiClientForTests } from '@/core/api/client';
import { ApiClientError } from '@/core/api/errors';
import { profileRepo } from '@/features/profile/profileRepo';

const BASE = 'https://api.skillswap.asia';

function envelope(data: unknown) {
  return { timestamp: '2026-09-30T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

/**
 * Hồ sơ đầy đủ theo `identity.md` §5.1.
 * Ngành dùng `nameVi`/`nameEn` — DTO ngành và chuyên ngành KHÔNG có field `name`
 * (§4.2, §4.3); chỉ cơ sở mới có `name` (§4.1).
 */
const HO_SO = {
  userId: 'u1',
  email: 'sinhvien@fpt.edu.vn',
  studentCode: 'HE180001',
  displayName: 'Nguyễn Văn A',
  avatarUrl: null,
  campus: { id: 'c1', code: 'HL', name: 'FPT University Hà Nội', city: 'Hà Nội' },
  program: {
    id: 'p1',
    code: 'CNTT',
    nameVi: 'Công nghệ thông tin',
    nameEn: 'Information Technology',
  },
  specialization: null,
  semester: 5,
  intakeYear: 2022,
  isAlumni: false,
  graduationYear: null,
  bio: 'Thích backend',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

describe('profileRepo.getStudentProfile', () => {
  it('có hồ sơ thì trả về nguyên payload', async () => {
    server.use(
      http.get(`${BASE}/api/me/student-profile`, () => HttpResponse.json(envelope(HO_SO))),
    );

    const hoSo = await profileRepo.getStudentProfile();

    expect(hoSo?.studentCode).toBe('HE180001');
    expect(hoSo?.campus?.name).toBe('FPT University Hà Nội');
    expect(hoSo?.program?.nameVi).toBe('Công nghệ thông tin');
  });

  it('gọi đúng endpoint GET /api/me/student-profile', async () => {
    // Sai endpoint thì mọi test khác vẫn xanh nhờ handler được viết theo đúng
    // đường dẫn sai đó; chỉ một lần khẳng định độc lập mới bắt được.
    const duongDanDaGoi: string[] = [];
    server.use(
      http.get(`${BASE}/api/me/student-profile`, ({ request }) => {
        duongDanDaGoi.push(`${request.method} ${new URL(request.url).pathname}`);
        return HttpResponse.json(envelope(HO_SO));
      }),
    );

    await profileRepo.getStudentProfile();

    expect(duongDanDaGoi).toEqual(['GET /api/me/student-profile']);
  });

  it('CHƯA có hồ sơ (404) thì trả null, KHÔNG ném lỗi', async () => {
    // `identity.md` §5.1 nói rõ 404 là trạng thái bình thường sau lần đăng nhập
    // đầu. Để nó ném ra thì màn hình Hồ sơ sẽ hiện ErrorView "Hệ thống đang bận"
    // cho một người dùng hoàn toàn bình thường, và họ không hiểu mình phải làm gì.
    server.use(
      http.get(`${BASE}/api/me/student-profile`, () =>
        HttpResponse.json(
          {
            timestamp: '',
            status: 404,
            // §7 không liệt kê mã nghiệp vụ cho 404 hồ sơ; đây là chỗ giữ chỗ,
            // code dưới test không đọc tới field này.
            code: 'PROFILE_4041',
            message: 'Chưa có hồ sơ',
            data: null,
          },
          { status: 404 },
        ),
      ),
    );

    await expect(profileRepo.getStudentProfile()).resolves.toBeNull();
  });

  it('lỗi 500 thì VẪN ném — chỉ 404 mới là "chưa có"', async () => {
    // Nuốt luôn cả 5xx thành `null` sẽ làm màn hình báo "chưa có hồ sơ" khi
    // thực ra backend đang sập: nói dối người dùng.
    server.use(
      http.get(`${BASE}/api/me/student-profile`, () =>
        HttpResponse.json(
          { timestamp: '', status: 500, code: 'SYS_0010', message: 'Lỗi', data: null },
          { status: 500 },
        ),
      ),
    );

    await expect(profileRepo.getStudentProfile()).rejects.toBeInstanceOf(ApiClientError);
    await expect(profileRepo.getStudentProfile()).rejects.toMatchObject({ status: 500 });
  });

  it('lỗi 401 cũng VẪN ném — hết phiên không phải là "chưa có hồ sơ"', async () => {
    // Bắt `status >= 400` thay vì đúng 404 sẽ biến một phiên hết hạn thành lời
    // mời tạo hồ sơ, và người dùng bấm mãi không ra gì.
    server.use(
      http.get(`${BASE}/api/me/student-profile`, () =>
        HttpResponse.json(
          { timestamp: '', status: 401, code: 'AUTH_1001', message: 'Chưa xác thực', data: null },
          { status: 401 },
        ),
      ),
      // `apiClient` thấy 401 là tự gọi refresh một lần; để refresh cũng 401 thì
      // nó dừng lại và ném ra ngoài như trên máy thật khi phiên đã chết.
      http.post(`${BASE}/api/auth/refresh`, () =>
        HttpResponse.json(
          { timestamp: '', status: 401, code: 'AUTH_1003', message: 'Hết phiên', data: null },
          { status: 401 },
        ),
      ),
    );

    await expect(profileRepo.getStudentProfile()).rejects.toBeInstanceOf(ApiClientError);
  });
});
