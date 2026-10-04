/**
 * @file guiHoSo.test.ts
 * @description Chuỗi "Gửi hồ sơ" chạy trên handler mock THẬT (luật nộp của
 * backend), chỉ thay bước đẩy tệp lên kho lưu trữ.
 */

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { __resetApiClientForTests } from '@/core/api/client';
import { taoHoSoMentorRong } from '@/features/mentorMode/mocks/mentorModeFixture';
import type { BanNhapMentor } from '@/features/mentorRegistration/dangKyMentor';
import { banNhapTuHoSo, duAnRong, monHocRong } from '@/features/mentorRegistration/dangKyMentor';
import { dangKyRepo } from '@/features/mentorRegistration/dangKyRepo';
import { guiHoSoMentor, LoiMinhChung } from '@/features/mentorRegistration/guiHoSo';
import { __resetMentorRegistrationMockForTests, mentorRegistrationMockHandlers } from '@/features/mentorRegistration/mocks/handlers';
import { taiTepLenUrl } from '@/features/mentorRegistration/taiTep';

jest.mock('@/features/mentorRegistration/taiTep', () => ({ taiTepLenUrl: jest.fn(async () => undefined) }));
const mockTaiTep = jest.mocked(taiTepLenUrl);

const BASE = 'https://api.skillswap.asia';
const server = setupServer(...mentorRegistrationMockHandlers);
const khongCho = async () => undefined;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => mockTaiTep.mockClear());
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
  __resetApiClientForTests();
  __resetMentorRegistrationMockForTests();
});
afterAll(() => server.close());

const tep = (k: string) => ({ khoa: k, ten: `${k}.pdf`, uri: `file://${k}`, contentType: 'application/pdf', kichThuoc: 1024 });

function banNhap(): BanNhapMentor {
  return {
    ...banNhapTuHoSo(taoHoSoMentorRong()),
    tieuDe: 'Senior Backend Engineer',
    moTaChuyenMon: 'Năm năm làm Spring Boot.',
    sdt: '0912345678',
    monHoc: [{ ...monHocRong(), ma: 'PRJ301', ten: 'Java Web', diem: '9' }],
    duAn: [{ ...duAnRong(), tieuDe: 'SkillSwap' }],
    mucNenTang: 3,
    mucReview: 3,
    mucDinhHuong: 3,
    baoTruocPhut: '120',
    hanMoNgay: '30',
    dongY: true,
    tepFptu: tep('fptu'),
    tepChuyenMon: [tep('cert')],
  };
}

/** Giả lập setState: áp các cập nhật vào một bản nháp sống */
function trinhGiu(b: BanNhapMentor) {
  const hop = { b };
  return { hop, capNhat: (f: (x: BanNhapMentor) => BanNhapMentor) => void (hop.b = f(hop.b)) };
}

describe('guiHoSoMentor', () => {
  it('đi đủ chuỗi và kết thúc ở trạng thái chờ duyệt', async () => {
    const { hop, capNhat } = trinhGiu(banNhap());

    await guiHoSoMentor(hop.b, capNhat, khongCho);

    const xt = await dangKyRepo.getVerification();
    expect(xt?.status).toBe('PENDING_REVIEW');
    expect(xt?.documents.map((d) => d.documentType).sort()).toEqual(['EXPERTISE_PROOF', 'FPTU_AFFILIATION_PROOF']);
    expect(mockTaiTep).toHaveBeenCalledTimes(2);
    // Kết quả từng bước đã ghi vào bản nháp
    expect(hop.b.duAn[0].id).toBeTruthy();
    expect(hop.b.tepFptu).toBeNull();
    expect(hop.b.tepChuyenMon).toEqual([]);
  });

  it('hỏng ở bước tải tệp chuyên môn: lần gửi lại KHÔNG tạo dự án thứ hai, KHÔNG tải lại tệp FPTU', async () => {
    const { hop, capNhat } = trinhGiu(banNhap());
    const ghi: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method !== 'GET') ghi.push(`${request.method} ${new URL(request.url).pathname}`);
    });
    mockTaiTep.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('mất mạng'));

    await expect(guiHoSoMentor(hop.b, capNhat, khongCho)).rejects.toBeInstanceOf(LoiMinhChung);
    expect(hop.b.tepFptu).toBeNull();
    expect(hop.b.tepChuyenMon).toHaveLength(1);

    await guiHoSoMentor(hop.b, capNhat, khongCho);

    expect(ghi.filter((g) => g === 'POST /api/me/mentor-projects')).toHaveLength(1);
    expect(ghi.filter((g) => g.startsWith('PUT /api/me/mentor-projects/'))).toHaveLength(1);
    expect(mockTaiTep).toHaveBeenCalledTimes(3);
    expect((await dangKyRepo.getVerification())?.status).toBe('PENDING_REVIEW');
  });

  it('xác nhận tài liệu được thử lại khi backend chưa thấy upload intent', async () => {
    let lan = 0;
    server.use(
      http.post(`${BASE}/api/me/mentor-verification/documents`, () => {
        lan += 1;
        if (lan === 1) {
          return HttpResponse.json({ timestamp: 't', status: 404, code: 'NOT_FOUND', message: 'Không tìm thấy upload intent', data: null }, { status: 404 });
        }
        return HttpResponse.json({ timestamp: 't', status: 201, code: 'SUCCESS', message: 'OK', data: null });
      }),
    );
    const cho = jest.fn(async () => undefined);
    const { hop, capNhat } = trinhGiu({ ...banNhap(), tepChuyenMon: [] });

    // Nộp sẽ hỏng (mock không ghi tài liệu), nhưng điều cần kiểm là lần thử lại.
    await guiHoSoMentor(hop.b, capNhat, cho).catch(() => undefined);

    expect(lan).toBe(2);
    expect(cho).toHaveBeenCalledWith(350);
  });

  it('dự án đã bấm xoá được xoá trên server rồi rời hàng chờ xoá', async () => {
    const ghi: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'DELETE') ghi.push(new URL(request.url).pathname);
    });
    const { hop, capNhat } = trinhGiu({ ...banNhap(), xoaDuAn: ['pj-cu'] });

    await guiHoSoMentor(hop.b, capNhat, khongCho);

    expect(ghi).toEqual(['/api/me/mentor-projects/pj-cu']);
    expect(hop.b.xoaDuAn).toEqual([]);
  });
});
