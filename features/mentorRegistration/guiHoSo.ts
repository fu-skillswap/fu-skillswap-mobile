/**
 * @file guiHoSo.ts
 * @description Chuỗi lời gọi khi bấm "Gửi hồ sơ", đúng thứ tự bản web
 * (`useMentorRegistration.onSubmit`):
 *
 * 1. Mở hồ sơ xác thực (backend trả lại bản đang có nếu đã mở).
 * 2. Lưu hồ sơ mentor.
 * 3. Xoá các dự án / thành tích người dùng đã bấm xoá, rồi tạo mới hoặc sửa phần
 *    còn lại.
 * 4. Tải minh chứng: xin URL → đẩy tệp → xác nhận (thử lại khi backend chưa kịp
 *    thấy upload intent, như web).
 * 5. Nộp cho admin duyệt.
 *
 * ## Vì sao báo tiến độ ra ngoài sau MỖI bước ghi
 *
 * Chuỗi có thể hỏng giữa chừng (mất mạng, tệp bị từ chối). Mỗi bước thành công
 * gọi `capNhat` để ghi kết quả vào bản nháp: dự án vừa tạo nhận `id`, tệp vừa
 * xác nhận rời hàng chờ, id đã xoá rời hàng xoá. Bấm gửi lại thì chỉ làm phần
 * CÒN THIẾU — không tạo dự án thứ hai, không tải lại tệp đã lên.
 */

import { ApiClientError } from '@/core/api/errors';
import type { BanNhapMentor, TepChon } from '@/features/mentorRegistration/dangKyMentor';
import { taoYeuCauDuAn, taoYeuCauHoSoMentor, taoYeuCauThanhTich } from '@/features/mentorRegistration/dangKyMentor';
import { dangKyRepo } from '@/features/mentorRegistration/dangKyRepo';
import { taiTepLenUrl } from '@/features/mentorRegistration/taiTep';
import type { VerificationDocumentType } from '@/features/mentorRegistration/types';

export type CapNhatBanNhap = (doi: (b: BanNhapMentor) => BanNhapMentor) => void;

/** Lỗi ở bước tải minh chứng — màn hình nói rõ tệp nào, và tệp vẫn được giữ */
export class LoiMinhChung extends Error {
  constructor(
    public readonly loai: VerificationDocumentType,
    public readonly nguyenNhan: unknown,
  ) {
    super(
      loai === 'FPTU_AFFILIATION_PROOF'
        ? 'Chưa tải được minh chứng FPTU. Tệp vẫn được giữ, vui lòng thử gửi lại.'
        : 'Chưa tải được minh chứng chuyên môn. Tệp vẫn được giữ, vui lòng thử gửi lại.',
    );
    this.name = 'LoiMinhChung';
  }
}

/** Khoảng chờ giữa các lần xác nhận lại — giống web (0, 350, 800 ms) */
export const CHO_XAC_NHAN_MS = [0, 350, 800];

function chuaThayUploadIntent(loi: unknown): boolean {
  return (
    loi instanceof ApiClientError &&
    loi.status === 404 &&
    loi.message.toLocaleLowerCase('vi').includes('upload intent')
  );
}

async function taiMotTep(tep: TepChon, loai: VerificationDocumentType, cho: (ms: number) => Promise<void>) {
  const intent = await dangKyRepo.createUploadIntent({
    filename: tep.ten,
    contentType: tep.contentType,
    sizeBytes: tep.kichThuoc,
  });
  await taiTepLenUrl(intent.uploadUrl, tep.uri, tep.contentType, intent.requiredHeaders);
  for (let lan = 0; lan < CHO_XAC_NHAN_MS.length; lan += 1) {
    if (CHO_XAC_NHAN_MS[lan] > 0) {
      await cho(CHO_XAC_NHAN_MS[lan]);
    }
    try {
      await dangKyRepo.confirmDocument({ documentType: loai, uploadIntentId: intent.uploadIntentId });
      return;
    } catch (loi) {
      if (!chuaThayUploadIntent(loi) || lan === CHO_XAC_NHAN_MS.length - 1) {
        throw loi;
      }
    }
  }
}

const NGU = (ms: number) => new Promise<void>((xong) => setTimeout(xong, ms));

export async function guiHoSoMentor(
  b: BanNhapMentor,
  capNhat: CapNhatBanNhap,
  cho: (ms: number) => Promise<void> = NGU,
): Promise<void> {
  await dangKyRepo.requestVerification();
  await dangKyRepo.saveProfile(taoYeuCauHoSoMentor(b));

  for (const id of b.xoaDuAn) {
    await dangKyRepo.deleteProject(id);
    capNhat((x) => ({ ...x, xoaDuAn: x.xoaDuAn.filter((y) => y !== id) }));
  }
  for (const id of b.xoaThanhTich) {
    await dangKyRepo.deleteAchievement(id);
    capNhat((x) => ({ ...x, xoaThanhTich: x.xoaThanhTich.filter((y) => y !== id) }));
  }

  for (const d of b.duAn) {
    if (d.id) {
      await dangKyRepo.updateProject(d.id, taoYeuCauDuAn(d));
    } else {
      const moi = await dangKyRepo.createProject(taoYeuCauDuAn(d));
      capNhat((x) => ({ ...x, duAn: x.duAn.map((y) => (y.khoa === d.khoa ? { ...y, id: moi.id } : y)) }));
    }
  }
  for (const t of b.thanhTich) {
    if (t.id) {
      await dangKyRepo.updateAchievement(t.id, taoYeuCauThanhTich(t));
    } else {
      const moi = await dangKyRepo.createAchievement(taoYeuCauThanhTich(t));
      capNhat((x) => ({ ...x, thanhTich: x.thanhTich.map((y) => (y.khoa === t.khoa ? { ...y, id: moi.id } : y)) }));
    }
  }

  if (b.tepFptu) {
    try {
      await taiMotTep(b.tepFptu, 'FPTU_AFFILIATION_PROOF', cho);
    } catch (loi) {
      throw new LoiMinhChung('FPTU_AFFILIATION_PROOF', loi);
    }
    capNhat((x) => ({ ...x, tepFptu: null }));
  }
  for (const tep of b.tepChuyenMon) {
    try {
      await taiMotTep(tep, 'EXPERTISE_PROOF', cho);
    } catch (loi) {
      throw new LoiMinhChung('EXPERTISE_PROOF', loi);
    }
    capNhat((x) => ({ ...x, tepChuyenMon: x.tepChuyenMon.filter((y) => y.khoa !== tep.khoa) }));
  }

  await dangKyRepo.submit({ submitNote: 'Nộp hồ sơ xác thực Mentor', termsAccepted: b.dongY });
}
