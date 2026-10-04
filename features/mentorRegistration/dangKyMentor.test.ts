import { taoHoSoMentor, taoHoSoMentorRong } from '@/features/mentorMode/mocks/mentorModeFixture';
import type { BanNhapMentor } from '@/features/mentorRegistration/dangKyMentor';
import {
  banNhapTuHoSo,
  buocChuaXong,
  kiemBuoc,
  localDateThanhNgay,
  monHocRong,
  ngayThanhLocalDate,
  taoYeuCauHoSoMentor,
  taoYeuCauThanhTich,
  thanhTichRong,
  tinhTrangDangKy,
} from '@/features/mentorRegistration/dangKyMentor';
import { taoHoSoXacThuc } from '@/features/mentorRegistration/mocks/handlers';

const KHONG_CO = { FPTU_AFFILIATION_PROOF: 0, EXPERTISE_PROOF: 0 };
const DU_TAI_LIEU = { FPTU_AFFILIATION_PROOF: 1, EXPERTISE_PROOF: 1 };

function du(): BanNhapMentor {
  return {
    ...banNhapTuHoSo(taoHoSoMentorRong()),
    tieuDe: 'Senior Backend Engineer',
    moTaChuyenMon: 'Năm năm làm Spring Boot và hệ thống thanh toán.',
    sdt: '0912345678',
    monHoc: [{ ...monHocRong(), ma: 'prj301', ten: 'Java Web', diem: '9,5' }],
    mucNenTang: 3,
    mucReview: 4,
    mucDinhHuong: 2,
    baoTruocPhut: '120',
    hanMoNgay: '30',
    dongY: true,
  };
}

describe('ngày LocalDate', () => {
  it('đổi qua lại dd/mm/yyyy ↔ yyyy-mm-dd, từ chối ngày không có thật', () => {
    expect(ngayThanhLocalDate('1/6/2025')).toBe('2025-06-01');
    expect(ngayThanhLocalDate('31/02/2025')).toBeNull();
    expect(ngayThanhLocalDate('2025-06-01')).toBeNull();
    expect(localDateThanhNgay('2025-06-01')).toBe('01/06/2025');
    expect(localDateThanhNgay(null)).toBe('');
  });
});

describe('banNhapTuHoSo', () => {
  it('hồ sơ chưa có: form rỗng, mặc định sẵn sàng nhận lịch, lấy policy mặc định của backend', () => {
    const rong = taoHoSoMentorRong();
    const b = banNhapTuHoSo(rong);

    expect(b.tieuDe).toBe('');
    expect(b.monHoc).toEqual([]);
    expect(b.nhanLich).toBe(true);
    expect(b.baoTruocPhut).toBe(String(rong.minimumBookingLeadTimeMinutes));
  });

  it('hồ sơ có sẵn: nạp môn, dự án, thành tích kèm id để lần gửi sau là SỬA', () => {
    const hoSo = taoHoSoMentor({
      featuredProjects: [{ id: 'pj1', title: 'App', pictureUrl: null, content: 'Lead', projectDescription: null, liveDemoUrl: null, displayOrder: 0, createdAt: null, updatedAt: null }],
      achievements: [{ id: 'ac1', title: 'Giải nhất', pictureUrl: null, awardDescription: null, achievedAt: '2025-06-01', productHeader: null, productDescription: null, demoUrl: null, displayOrder: 0, createdAt: null, updatedAt: null }],
    });

    const b = banNhapTuHoSo(hoSo);

    expect(b.duAn[0]).toMatchObject({ id: 'pj1', tieuDe: 'App', vaiTro: 'Lead' });
    expect(b.thanhTich[0]).toMatchObject({ id: 'ac1', ngay: '01/06/2025' });
  });
});

describe('kiemBuoc', () => {
  it('bước 1: ô trống vào "còn thiếu", ô gõ sai mới báo đỏ', () => {
    const b = { ...du(), tieuDe: '', sdt: '012345' };
    const kq = kiemBuoc(b, 1, KHONG_CO);

    expect(kq.conThieu).toMatch(/tiêu đề chuyên môn/);
    expect(kq.loi.tieuDe).toBeUndefined();
    expect(kq.loi.sdt).toBeDefined();
  });

  it('bước 1: mô tả quá 1000 ký tự bị chặn (backend), dù web cho tới 1500', () => {
    expect(kiemBuoc({ ...du(), moTaChuyenMon: 'a'.repeat(1001) }, 1, KHONG_CO).loi.moTaChuyenMon).toBeDefined();
  });

  it('bước 2: cần ít nhất một môn, mã không trùng, điểm 0–10, đủ hai loại minh chứng', () => {
    expect(kiemBuoc({ ...du(), monHoc: [] }, 2, DU_TAI_LIEU).conThieu).toMatch(/ít nhất một môn học/);

    const trung = { ...du(), monHoc: [{ ...monHocRong(), ma: 'PRJ301', ten: 'A', diem: '8' }, { ...monHocRong(), ma: 'prj301', ten: 'B', diem: '11' }] };
    const kq = kiemBuoc(trung, 2, DU_TAI_LIEU);
    expect(Object.values(kq.loi)).toEqual(expect.arrayContaining(['Mã môn bị trùng.', 'Điểm từ 0 đến 10.']));

    expect(kiemBuoc(du(), 2, KHONG_CO).conThieu).toMatch(/minh chứng sinh viên FPTU, minh chứng chuyên môn/);
    expect(kiemBuoc(du(), 2, DU_TAI_LIEU).conThieu).toBeNull();
  });

  it('bước 2: tệp mới chọn cũng tính là có minh chứng; quá 3 tệp chuyên môn bị chặn', () => {
    const tep = (k: string) => ({ khoa: k, ten: `${k}.pdf`, uri: 'file://x', contentType: 'application/pdf', kichThuoc: 10 });
    const b = { ...du(), tepFptu: tep('f'), tepChuyenMon: [tep('a'), tep('b')] };

    expect(kiemBuoc(b, 2, KHONG_CO).conThieu).toBeNull();
    expect(kiemBuoc(b, 2, { FPTU_AFFILIATION_PROOF: 0, EXPERTISE_PROOF: 2 }).loi.tepChuyenMon).toMatch(/Tối đa 3/);
  });

  it('bước 3: thành tích không bắt buộc, nhưng đã thêm thì cần tên và ngày đúng dạng', () => {
    expect(kiemBuoc(du(), 3, KHONG_CO).conThieu).toBeNull();
    const t = { ...thanhTichRong(), ngay: '32/13/2025' };
    const kq = kiemBuoc({ ...du(), thanhTich: [t] }, 3, KHONG_CO);
    expect(kq.conThieu).toMatch(/tên của mọi thành tích/);
    expect(kq.loi[`thanhTich.${t.khoa}.ngay`]).toBeDefined();
  });

  it('bước 5: thiếu mức nào thì nói mức đó', () => {
    expect(kiemBuoc({ ...du(), mucReview: null }, 5, KHONG_CO).conThieu).toBe('Còn thiếu mức review đồ án / code.');
  });

  it('bước 6: phải đồng ý điều khoản', () => {
    expect(kiemBuoc({ ...du(), dongY: false }, 6, KHONG_CO).conThieu).toBe('Còn thiếu đồng ý điều khoản.');
  });

  it('buocChuaXong chỉ ra bước đầu tiên còn thiếu', () => {
    expect(buocChuaXong({ ...du(), mucNenTang: null }, DU_TAI_LIEU)).toBe(5);
    expect(buocChuaXong(du(), KHONG_CO)).toBe(2);
    expect(buocChuaXong(du(), DU_TAI_LIEU)).toBeNull();
  });
});

describe('dựng body', () => {
  it('chuẩn hoá mã môn, đọc điểm có dấu phẩy, gửi múi giờ kinh doanh', () => {
    const yc = taoYeuCauHoSoMentor(du());

    expect(yc.subjectResults).toEqual([{ subjectCode: 'PRJ301', subjectName: 'Java Web', scoreValue: 9.5 }]);
    expect(yc).toMatchObject({ githubUrl: null, bookingTimezone: 'Asia/Ho_Chi_Minh', minimumBookingLeadTimeMinutes: 120 });
  });

  it('thành tích gửi ngày dạng LocalDate', () => {
    expect(taoYeuCauThanhTich({ ...thanhTichRong(), tieuDe: 'A', ngay: '01/06/2025' }).achievedAt).toBe('2025-06-01');
  });
});

describe('tinhTrangDangKy', () => {
  it('chờ duyệt / đã duyệt / còn lại là soạn', () => {
    expect(tinhTrangDangKy(taoHoSoXacThuc({ status: 'PENDING_REVIEW' }), null)).toBe('cho-duyet');
    expect(tinhTrangDangKy(taoHoSoXacThuc({ status: 'APPROVED' }), null)).toBe('da-duyet');
    expect(tinhTrangDangKy(null, taoHoSoMentor({ mentorStatus: 'ACTIVE' }))).toBe('da-duyet');
    expect(tinhTrangDangKy(taoHoSoXacThuc({ status: 'NEEDS_REVISION' }), null)).toBe('soan');
    expect(tinhTrangDangKy(null, taoHoSoMentorRong())).toBe('soan');
  });
});
