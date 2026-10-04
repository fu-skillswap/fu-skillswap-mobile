/**
 * @file datLichFixture.ts
 * @description Dữ liệu giả cho luồng đặt lịch: lịch rảnh, khung giờ chính xác và
 * báo giá — đúng hình dạng DTO thật của backend.
 *
 * ## Vì sao sinh theo "bây giờ" thay vì ghi cứng ngày
 *
 * Lịch rảnh chỉ có nghĩa khi nằm ở TƯƠNG LAI. Một fixture ghi cứng "06/10/2026"
 * sẽ thành lịch đã qua sau vài ngày và màn chọn lịch ở chế độ mock trống trơn mà
 * không ai hiểu vì sao. Mọi hàm ở đây nhận `bayGioMs` để test cố định được.
 *
 * ## Vì sao import dịch vụ từ mock của feature mentor
 *
 * Slot phải mang ĐÚNG `serviceId` mà màn hồ sơ mentor đang hiện, nếu không bấm
 * "Đặt lịch" ở hồ sơ sẽ ra một màn chọn lịch trống. Chép lại danh sách dịch vụ
 * thì hai bản sẽ lệch nhau; đây là mã chỉ chạy ở chế độ mock (bị metro loại khỏi
 * bản phát hành), nên import thẳng là cách ít sai nhất.
 */

import { MOCK_MENTOR_DETAILS } from '@/features/mentor/mocks/handlers';
import { CHINH_SACH_HOAN_TIEN } from '@/features/booking/mocks/bookingFixture';
import { congNgay, homNayVN, isoNgay } from '@/features/booking/lichTuan';
import type { NgayLich } from '@/features/booking/lichTuan';
import type {
  AvailabilitySlotServiceBasicResponse,
  BookingQuoteResponse,
  MentorAvailabilitySlotResponse,
  ServiceSlotCandidateItemResponse,
  ServiceSlotCandidatesResponse,
} from '@/features/booking/types';

/** Hai khung rảnh mỗi ngày, giờ Việt Nam: [giờ bắt đầu, phút, giờ kết thúc, phút] */
const KHUNG_TRONG_NGAY: readonly [number, number, number, number][] = [
  [8, 0, 10, 0],
  [19, 0, 21, 30],
];

/** Mentor nghỉ thứ Tư và Chủ nhật (0 = thứ Hai) — để dải ngày có ô không chọn được */
const THU_NGHI = new Set([2, 6]);

/** Phụ phí nền tảng mentee trả thêm, đúng `calculateMenteeVisiblePrice()` của backend */
const PHU_PHI = 0.1;

function hai(so: number): string {
  return String(so).padStart(2, '0');
}

/** `LocalDateTime` giờ Việt Nam, đúng khuôn backend lên dây */
function localDateTime(ngay: NgayLich, gio: number, phut: number): string {
  return `${isoNgay(ngay)}T${hai(gio)}:${hai(phut)}:00`;
}

/** Mốc epoch (ms) của một giờ Việt Nam */
function mocMs(ngay: NgayLich, gio: number, phut: number): number {
  return Date.UTC(ngay.nam, ngay.thang - 1, ngay.ngay, gio - 7, phut);
}

/** `Instant` UTC, khuôn Jackson: `"2026-10-06T12:00:00Z"` */
function instant(ms: number): string {
  return new Date(ms).toISOString().replace('.000Z', 'Z');
}

/** `OffsetDateTime` giờ Việt Nam: `"2026-10-06T19:00:00+07:00"` */
function offsetVN(ms: number): string {
  const d = new Date(ms + 7 * 3_600_000);
  return `${d.getUTCFullYear()}-${hai(d.getUTCMonth() + 1)}-${hai(d.getUTCDate())}T${hai(d.getUTCHours())}:${hai(d.getUTCMinutes())}:00+07:00`;
}

function docNgay(iso: string): NgayLich | null {
  const khop = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return khop ? { nam: Number(khop[1]), thang: Number(khop[2]), ngay: Number(khop[3]) } : null;
}

function thuCua(ngay: NgayLich): number {
  const soNgay = Math.round(Date.UTC(ngay.nam, ngay.thang - 1, ngay.ngay) / 86_400_000);
  return (((soNgay + 3) % 7) + 7) % 7;
}

/** Dịch vụ đang mở của mentor, rút gọn về hình dạng gắn vào slot */
export function dichVuCuaMentor(mentorUserId: string): AvailabilitySlotServiceBasicResponse[] {
  const hoSo = MOCK_MENTOR_DETAILS[mentorUserId];
  if (!hoSo) {
    return [];
  }
  return hoSo.services
    .filter((dv) => dv.isActive)
    .map((dv) => ({
      serviceId: dv.serviceId,
      title: dv.title,
      durationMinutes: dv.durationMinutes,
      isFree: dv.isFree,
      priceScoin: dv.priceScoin,
      bindingRemoval: null,
    }));
}

/** `slotId` ổn định, đọc ngược được ra ngày và khung */
function slotIdCua(mentorUserId: string, ngay: NgayLich, khung: number): string {
  return `slot-${mentorUserId}-${isoNgay(ngay)}-${khung}`;
}

/** Bóc `slotId` do `slotIdCua` sinh; `null` nếu không phải id của fixture này */
export function docSlotId(
  slotId: string,
): { mentorUserId: string; ngay: NgayLich; khung: number } | null {
  const khop = /^slot-(.+)-(\d{4}-\d{2}-\d{2})-(\d)$/.exec(slotId);
  if (!khop) {
    return null;
  }
  const ngay = docNgay(khop[2]);
  const khung = Number(khop[3]);
  return ngay && khung < KHUNG_TRONG_NGAY.length ? { mentorUserId: khop[1], ngay, khung } : null;
}

/**
 * Parent slot của mentor từ `fromDate` tới `toDate` (mặc định như backend: thứ Hai
 * tuần này tới Chủ nhật tuần sau). Chỉ trả khung CHƯA bắt đầu.
 */
export function taoLichRanh(
  mentorUserId: string,
  fromDate: string | null,
  toDate: string | null,
  bayGioMs: number = Date.now(),
): MentorAvailabilitySlotResponse[] {
  const services = dichVuCuaMentor(mentorUserId);
  if (services.length === 0) {
    return [];
  }

  const homNay = homNayVN(bayGioMs);
  const thuHai = congNgay(homNay, -thuCua(homNay));
  const tu = (fromDate ? docNgay(fromDate) : null) ?? thuHai;
  const den = (toDate ? docNgay(toDate) : null) ?? congNgay(thuHai, 13);

  const ketQua: MentorAvailabilitySlotResponse[] = [];
  for (let ngay = tu; isoNgay(ngay) <= isoNgay(den); ngay = congNgay(ngay, 1)) {
    if (THU_NGHI.has(thuCua(ngay))) {
      continue;
    }
    KHUNG_TRONG_NGAY.forEach(([gioBd, phutBd, gioKt, phutKt], khung) => {
      if (mocMs(ngay, gioBd, phutBd) <= bayGioMs) {
        return;
      }
      ketQua.push({
        slotId: slotIdCua(mentorUserId, ngay, khung),
        startTime: localDateTime(ngay, gioBd, phutBd),
        endTime: localDateTime(ngay, gioKt, phutKt),
        timezone: 'Asia/Ho_Chi_Minh',
        pendingRequestCount: khung === 1 ? 1 : 0,
        acceptedSlotCount: 0,
        services,
      });
    });
  }
  return ketQua;
}

/**
 * Khung giờ chính xác của một dịch vụ trong một slot: cắt slot thành các đoạn dài
 * đúng `durationMinutes`, đoạn sau nối đoạn trước.
 *
 * Đoạn thứ hai của khung tối bị một booking ĐÃ CHỐT chặn — để màn hình luôn có
 * một ô "đã kín" mà hiện, đúng như thiết kế gạch ngang chữ.
 */
export function taoKhungGio(
  slotId: string,
  serviceId: string,
  bayGioMs: number = Date.now(),
): ServiceSlotCandidatesResponse | null {
  const slot = docSlotId(slotId);
  if (!slot) {
    return null;
  }
  const dichVu = dichVuCuaMentor(slot.mentorUserId).find((dv) => dv.serviceId === serviceId);
  if (!dichVu) {
    return null;
  }

  const [gioBd, phutBd, gioKt, phutKt] = KHUNG_TRONG_NGAY[slot.khung];
  const batDauSlot = mocMs(slot.ngay, gioBd, phutBd);
  const ketThucSlot = mocMs(slot.ngay, gioKt, phutKt);
  const doDai = dichVu.durationMinutes * 60_000;

  const khung: ServiceSlotCandidateItemResponse[] = [];
  for (let bd = batDauSlot, i = 0; bd + doDai <= ketThucSlot; bd += doDai, i++) {
    const biChan = slot.khung === 1 && i === 1;
    const daQua = bd <= bayGioMs;
    khung.push({
      startTime: offsetVN(bd).slice(0, 19),
      endTime: offsetVN(bd + doDai).slice(0, 19),
      startAt: instant(bd),
      endAt: instant(bd + doDai),
      pendingCount: 0,
      remainingPendingQuota: biChan ? 0 : 3,
      isSelectable: !biChan && !daQua,
      reasonIfBlocked: biChan ? 'Khung giờ đã có booking được chốt' : daQua ? 'Khung giờ đã qua' : null,
      blockedByAcceptedBooking: biChan,
      blockingBookingId: biChan ? 'b-chan' : null,
      blockingServiceId: biChan ? serviceId : null,
      blockingServiceTitle: biChan ? dichVu.title : null,
      blockedBySameService: biChan,
      blockedByDifferentService: false,
      bookingConflictNote: biChan ? 'Đã có người đặt cùng dịch vụ' : null,
    });
  }

  return {
    slotId,
    serviceId,
    serviceDurationMinutes: dichVu.durationMinutes,
    candidateServiceSlots: khung,
  };
}

/** Báo giá cho một khung giờ; `null` khi slot, dịch vụ hoặc giờ không khớp fixture */
export function taoBaoGia(
  slotId: string,
  serviceId: string,
  startAt: string,
  bayGioMs: number = Date.now(),
): BookingQuoteResponse | null {
  const khungGio = taoKhungGio(slotId, serviceId, bayGioMs);
  const khung = khungGio?.candidateServiceSlots.find(
    (k) => Date.parse(k.startAt) === Date.parse(startAt),
  );
  if (!khungGio || !khung || !khung.isSelectable) {
    return null;
  }
  const slot = docSlotId(slotId);
  const dichVu = slot
    ? dichVuCuaMentor(slot.mentorUserId).find((dv) => dv.serviceId === serviceId)
    : undefined;
  if (!dichVu) {
    return null;
  }

  const gia = dichVu.isFree ? 0 : (dichVu.priceScoin ?? 0);
  const phaiTra = dichVu.isFree ? 0 : Math.round(gia * (1 + PHU_PHI));
  const batDauMs = Date.parse(khung.startAt);

  return {
    slotId,
    serviceId,
    serviceTitle: dichVu.title,
    durationMinutes: dichVu.durationMinutes,
    scheduledStartAt: offsetVN(batDauMs),
    scheduledEndAt: offsetVN(Date.parse(khung.endAt)),
    // Mentor có 24 giờ để phản hồi, nhưng không quá giờ học.
    pendingExpireAt: offsetVN(Math.min(bayGioMs + 24 * 3_600_000, batDauMs)),
    paymentWindowMinutes: 240,
    paymentPreparationBufferMinutes: 120,
    pricing: {
      pricingVersion: 'v1',
      calculatedAt: offsetVN(bayGioMs),
      serviceId,
      priceScoin: gia,
      priceBeforeCampaignScoin: phaiTra,
      campaignDiscountScoin: 0,
      estimatedPayableScoin: phaiTra,
      campaignName: null,
      isEstimate: true,
      disclaimer: dichVu.isFree ? null : 'Giá đã gồm phụ phí nền tảng, có thể thay đổi khi thanh toán.',
    },
    cancellationRefundPolicy: CHINH_SACH_HOAN_TIEN,
    isEstimate: true,
    disclaimer: 'Báo giá chưa giữ chỗ. Khung giờ chỉ được giữ khi mentor chấp nhận.',
  };
}
