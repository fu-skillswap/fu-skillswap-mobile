/**
 * @file studioMock.ts
 * @description Handler MSW cho lịch dạy, dịch vụ và Google Calendar của mentor —
 * đúng hình dạng DTO thật. Slot sinh theo đồng hồ thật (lịch đã qua thì vô
 * nghĩa), lên dây là `Instant` UTC có `Z` như backend.
 *
 * `let` chứ không `const`: tạo slot, ngừng slot, sửa và bật/tắt dịch vụ ghi thật
 * vào kho để tải lại thấy đúng điều vừa làm. Mọi thao tác có `expectedVersion`
 * đều kiểm version như backend (409 khi lệch).
 */

import { http } from 'msw';

import { getEnv } from '@/core/config/env';
import { jsonMock } from '@/core/dev/jsonMock';
import { congNgay, dauTuan, homNayVN, isoNgay } from '@/core/time/lichTuan';
import type { NgayLich } from '@/core/time/lichTuan';
import type {
  CreateMentorServiceRequest,
  CreateSlotRequest,
  GoogleCalendarStatusResponse,
  MentorManagedSlotResponse,
  MentorServiceManagementResponse,
  SlotServiceBasic,
  UpdateMentorServiceRequest,
} from '@/features/mentorMode/types';

const base = getEnv().apiUrl;

function envelope(data: unknown) {
  return { timestamp: new Date().toISOString(), status: 200, code: 'SUCCESS_0200', message: 'Thành công', data };
}

function loi(status: number, code: string, message: string) {
  return jsonMock({ timestamp: new Date().toISOString(), status, code, message, data: null }, { status });
}

/** Phụ phí mentee trả thêm và phí nền tảng trừ của mentor — chỉ để mock có số */
const PHU_PHI = 0.1;
const PHI_NEN_TANG = 0.1;

function tinhGia(isFree: boolean, gia: number) {
  return isFree
    ? { basePriceScoin: 0, publicPriceScoin: 0, estimatedMentorPayoutScoin: 0 }
    : {
        basePriceScoin: gia,
        publicPriceScoin: Math.round(gia * (1 + PHU_PHI)),
        estimatedMentorPayoutScoin: Math.round(gia * (1 - PHI_NEN_TANG)),
      };
}

function dichVu(
  serviceId: string,
  title: string,
  durationMinutes: number,
  gia: number,
  ghiDe: Partial<MentorServiceManagementResponse> = {},
): MentorServiceManagementResponse {
  return {
    serviceId,
    mentorUserId: 'mentor-0001',
    title,
    description: 'Đọc và góp ý trực tiếp, tập trung vào điều bạn đang vướng.',
    expectedOutcome: 'Biết rõ cần sửa gì và làm theo thứ tự nào.',
    durationMinutes,
    isFree: gia === 0,
    ...tinhGia(gia === 0, gia),
    isActive: true,
    maintainPostSessionChat: true,
    deliveryMode: 'ONE_TO_ONE',
    coverAssetId: null,
    coverImageUrl: null,
    version: 1,
    createdAt: '2026-08-01T09:00:00',
    updatedAt: '2026-09-20T10:00:00',
    ...ghiDe,
  };
}

let MOCK_DICH_VU: MentorServiceManagementResponse[] = [
  dichVu('msv1', 'Review CV 1:1', 45, 150_000),
  dichVu('msv2', 'Mock interview PM', 60, 250_000),
  dichVu('msv3', 'Định hướng nghề Product', 30, 0, { isActive: false }),
];

function dichVuGanSlot(): SlotServiceBasic[] {
  return MOCK_DICH_VU.filter((d) => d.isActive).map((d) => ({
    serviceId: d.serviceId,
    title: d.title,
    durationMinutes: d.durationMinutes,
    isFree: d.isFree,
    priceScoin: d.publicPriceScoin,
    bindingRemoval: null,
  }));
}

function instantVN(ngay: NgayLich, gio: number, phut: number): string {
  return new Date(Date.UTC(ngay.nam, ngay.thang - 1, ngay.ngay, gio - 7, phut)).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function slotMau(
  slotId: string,
  ngay: NgayLich,
  [gBd, pBd, gKt, pKt]: [number, number, number, number],
  ghiDe: Partial<MentorManagedSlotResponse> = {},
): MentorManagedSlotResponse {
  return {
    slotId,
    startAt: instantVN(ngay, gBd, pBd),
    endAt: instantVN(ngay, gKt, pKt),
    timezone: 'Asia/Ho_Chi_Minh',
    isActive: true,
    note: null,
    services: dichVuGanSlot(),
    version: 0,
    pendingBookingCount: 0,
    lockingBookingCount: 0,
    hasLockingBooking: false,
    timeMutation: { mode: 'ALLOWED', restrictionCode: null, affectedPendingBookingCount: 0 },
    deactivation: { mode: 'ALLOWED', restrictionCode: null, affectedPendingBookingCount: 0 },
    canEditNote: true,
    ...ghiDe,
  };
}

/** Slot hai tuần quanh "hôm nay" — sinh một lần khi module nạp */
function sinhSlot(): MentorManagedSlotResponse[] {
  const thuHai = dauTuan(homNayVN());
  const ketQua: MentorManagedSlotResponse[] = [];
  for (let i = 0; i < 14; i++) {
    const ngay = congNgay(thuHai, i);
    if (i % 7 === 2 || i % 7 === 6) {
      continue;
    }
    ketQua.push(slotMau(`ms-${isoNgay(ngay)}-sang`, ngay, [8, 0, 10, 0]));
    ketQua.push(
      slotMau(`ms-${isoNgay(ngay)}-toi`, ngay, [19, 0, 21, 30], {
        pendingBookingCount: i % 3 === 0 ? 1 : 0,
        lockingBookingCount: i % 2 === 0 ? 1 : 0,
        hasLockingBooking: i % 2 === 0,
        deactivation:
          i % 2 === 0
            ? { mode: 'BLOCKED_BY_LOCKING_BOOKING', restrictionCode: 'SLOT_HAS_LOCKING_BOOKING', affectedPendingBookingCount: 0 }
            : { mode: 'ALLOWED', restrictionCode: null, affectedPendingBookingCount: 0 },
      }),
    );
  }
  return ketQua;
}

let MOCK_SLOT: MentorManagedSlotResponse[] = sinhSlot();

const MOCK_LICH_GOOGLE: GoogleCalendarStatusResponse = {
  connected: false,
  syncEnabled: false,
  email: null,
  grantedScopes: [],
  needsReconnect: false,
  lastSyncStatus: null,
  lastSyncAt: null,
  lastSyncErrorCode: null,
  lastSyncErrorMessage: null,
};

export const studioMockHandlers = [
  http.get(`${base}/api/me/availability-slots`, ({ request }) => {
    const sp = new URL(request.url).searchParams;
    const tu = sp.get('fromDate') ?? '0000-00-00';
    const den = sp.get('toDate') ?? '9999-99-99';
    const khop = MOCK_SLOT.filter((s) => {
      const ngay = new Date(Date.parse(s.startAt) + 7 * 3_600_000).toISOString().slice(0, 10);
      return s.isActive && ngay >= tu && ngay <= den;
    });
    return jsonMock(envelope(khop));
  }),

  http.post(`${base}/api/me/availability-slots`, async ({ request }) => {
    const body = (await request.json()) as Partial<CreateSlotRequest>;
    const bd = Date.parse(body.startAt ?? '');
    const kt = Date.parse(body.endAt ?? '');
    if (!body.serviceIds || body.serviceIds.length === 0) {
      return loi(400, 'SYS_0001', 'serviceIds không được để trống');
    }
    if (!Number.isFinite(bd) || !Number.isFinite(kt) || kt <= bd) {
      return loi(400, 'SYS_0001', 'Giờ kết thúc phải sau giờ bắt đầu');
    }
    if (bd <= Date.now()) {
      return loi(400, 'SYS_0001', 'Không thể tạo slot trong quá khứ');
    }
    const trung = MOCK_SLOT.some((s) => s.isActive && Date.parse(s.startAt) < kt && Date.parse(s.endAt) > bd);
    if (trung) {
      return loi(409, 'BOOK_4093', 'Khung giờ bị trùng với một slot đang mở');
    }
    const moi: MentorManagedSlotResponse = {
      ...slotMau(`ms-moi-${MOCK_SLOT.length + 1}`, { nam: 2000, thang: 1, ngay: 1 }, [0, 0, 0, 0]),
      startAt: body.startAt ?? '',
      endAt: body.endAt ?? '',
      note: body.note?.trim() || null,
      services: dichVuGanSlot().filter((d) => body.serviceIds?.includes(d.serviceId)),
    };
    MOCK_SLOT = [...MOCK_SLOT, moi];
    return jsonMock(envelope(moi));
  }),

  http.post(`${base}/api/me/availability-slots/:slotId/deactivate`, async ({ params, request }) => {
    const slot = MOCK_SLOT.find((s) => s.slotId === String(params.slotId));
    if (!slot) {
      return loi(404, 'SYS_0003', 'Không tìm thấy slot');
    }
    const body = (await request.json()) as { expectedVersion?: number };
    if (body.expectedVersion !== slot.version) {
      return loi(409, 'SYS_0004', 'Slot vừa thay đổi, vui lòng tải lại');
    }
    if (slot.deactivation?.mode !== 'ALLOWED') {
      return loi(409, 'BOOK_4094', 'Slot đã có lịch được chốt, không thể ngừng');
    }
    const daNgung = { ...slot, isActive: false, version: (slot.version ?? 0) + 1 };
    MOCK_SLOT = MOCK_SLOT.map((s) => (s.slotId === slot.slotId ? daNgung : s));
    return jsonMock(envelope(daNgung));
  }),

  http.get(`${base}/api/me/google-calendar/status`, () => jsonMock(envelope(MOCK_LICH_GOOGLE))),

  /** Đăng ký TRƯỚC `/:serviceId` để `constraints` không bị coi là một id */
  http.get(`${base}/api/me/mentor-services/constraints`, () =>
    jsonMock(envelope({ allowedDurationMinutes: [30, 45, 60, 90], minimumPriceScoinPerMinute: 1000, maximumPriceScoinPerMinute: 20000 })),
  ),

  http.get(`${base}/api/me/mentor-services`, () => jsonMock(envelope(MOCK_DICH_VU))),

  http.get(`${base}/api/me/mentor-services/:serviceId`, ({ params }) => {
    const dv = MOCK_DICH_VU.find((d) => d.serviceId === String(params.serviceId));
    return dv ? jsonMock(envelope(dv)) : loi(404, 'SYS_0003', 'Không tìm thấy dịch vụ');
  }),

  http.post(`${base}/api/me/mentor-services`, async ({ request }) => {
    const body = (await request.json()) as CreateMentorServiceRequest;
    if (!body.title?.trim() || !body.description?.trim() || !body.expectedOutcome?.trim()) {
      return loi(400, 'SYS_0001', 'Tên, mô tả và kết quả mong đợi không được để trống');
    }
    const moi = dichVu(`msv-moi-${MOCK_DICH_VU.length + 1}`, body.title.trim(), body.durationMinutes, body.isFree ? 0 : body.priceScoin, {
      description: body.description.trim(),
      expectedOutcome: body.expectedOutcome.trim(),
      maintainPostSessionChat: body.maintainPostSessionChat,
    });
    MOCK_DICH_VU = [...MOCK_DICH_VU, moi];
    return jsonMock(envelope(moi));
  }),

  http.put(`${base}/api/me/mentor-services/:serviceId`, async ({ params, request }) => {
    const dv = MOCK_DICH_VU.find((d) => d.serviceId === String(params.serviceId));
    if (!dv) {
      return loi(404, 'SYS_0003', 'Không tìm thấy dịch vụ');
    }
    const body = (await request.json()) as UpdateMentorServiceRequest;
    if (body.expectedVersion !== dv.version) {
      return loi(409, 'SYS_0004', 'Dịch vụ vừa được sửa ở nơi khác, vui lòng tải lại');
    }
    const daSua: MentorServiceManagementResponse = {
      ...dv,
      title: body.title.trim(),
      description: body.description.trim(),
      expectedOutcome: body.expectedOutcome.trim(),
      isFree: body.isFree,
      ...tinhGia(body.isFree, body.priceScoin),
      maintainPostSessionChat: body.maintainPostSessionChat,
      version: dv.version + 1,
    };
    MOCK_DICH_VU = MOCK_DICH_VU.map((d) => (d.serviceId === dv.serviceId ? daSua : d));
    return jsonMock(envelope(daSua));
  }),

  http.patch(`${base}/api/me/mentor-services/:serviceId/active`, async ({ params, request }) => {
    const dv = MOCK_DICH_VU.find((d) => d.serviceId === String(params.serviceId));
    if (!dv) {
      return loi(404, 'SYS_0003', 'Không tìm thấy dịch vụ');
    }
    const body = (await request.json()) as { isActive?: boolean; expectedVersion?: number };
    if (body.expectedVersion !== dv.version) {
      return loi(409, 'SYS_0004', 'Dịch vụ vừa được sửa ở nơi khác, vui lòng tải lại');
    }
    const daDoi = { ...dv, isActive: body.isActive === true, version: dv.version + 1 };
    MOCK_DICH_VU = MOCK_DICH_VU.map((d) => (d.serviceId === dv.serviceId ? daDoi : d));
    return jsonMock(envelope(daDoi));
  }),
];
