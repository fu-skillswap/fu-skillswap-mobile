/**
 * @file handlers.ts
 * @description Handler MSW cho luồng đăng ký mentor — đúng hình dạng DTO và đúng
 * các luật nộp hồ sơ của `MentorVerificationService` (cần ít nhất một minh chứng
 * FPTU và một minh chứng chuyên môn; chỉ rút được khi đang chờ duyệt).
 *
 * `GET /api/me/mentor-profile` vẫn thuộc mock của `features/mentorMode` (người
 * dùng mock đã là mentor). Ở đây chỉ mock phần GHI và phần xác thực.
 *
 * URL tải lên trỏ về `https://upload.mock/…` và cũng được mock, để luồng "chọn
 * tệp → gửi" chạy trọn trên máy ở chế độ mock.
 */

import { http } from 'msw';

import { getEnv } from '@/core/config/env';
import { jsonMock } from '@/core/dev/jsonMock';
import type {
  ConfirmDocumentRequest,
  MentorProfileUpsertRequest,
  MentorVerificationDocumentResponse,
  MentorVerificationRequestResponse,
  UploadIntentRequest,
} from '@/features/mentorRegistration/types';

const base = getEnv().apiUrl;
export const MOCK_UPLOAD_HOST = 'https://upload.mock';

function envelope(data: unknown, status = 200) {
  return { timestamp: new Date().toISOString(), status, code: 'SUCCESS', message: 'OK', data };
}

function loi(status: number, code: string, message: string) {
  return jsonMock({ timestamp: new Date().toISOString(), status, code, message, data: null }, { status });
}

function ldt(): string {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 19);
}

let hoSo: MentorVerificationRequestResponse | null = null;
let intents: Record<string, UploadIntentRequest> = {};
let dem = 0;

/** Đưa kho về ban đầu — chỉ dùng trong test */
export function __resetMentorRegistrationMockForTests(ban: MentorVerificationRequestResponse | null = null): void {
  hoSo = ban;
  intents = {};
  dem = 0;
}

function hanhDong(status: MentorVerificationRequestResponse['status']) {
  const soan = status === 'DRAFT' || status === 'NEEDS_REVISION' || status === 'WITHDRAWN' || status === 'REJECTED';
  return { canUploadDocuments: soan, canSubmit: soan, canWithdraw: status === 'PENDING_REVIEW', canUnsubmit: false };
}

export function taoHoSoXacThuc(ghiDe: Partial<MentorVerificationRequestResponse> = {}): MentorVerificationRequestResponse {
  const status = ghiDe.status ?? 'DRAFT';
  return {
    requestId: 'vr1',
    mentorUserId: 'u1',
    status,
    submitNote: null,
    reviewNote: null,
    rejectionReason: null,
    revisionCount: 0,
    submittedAt: null,
    estimatedReviewBy: null,
    reviewTargetHours: 48,
    reviewOverdue: false,
    documents: [],
    allowedActions: hanhDong(status),
    ...ghiDe,
  };
}

function datTrangThai(status: MentorVerificationRequestResponse['status']) {
  if (hoSo) {
    hoSo = { ...hoSo, status, allowedActions: hanhDong(status) };
  }
}

export const mentorRegistrationMockHandlers = [
  http.get(`${base}/api/me/mentor-verification`, () =>
    hoSo ? jsonMock(envelope(hoSo)) : loi(404, 'NOT_FOUND', 'Chưa có hồ sơ xác thực mentor nào'),
  ),

  http.post(`${base}/api/me/mentor-verification/request`, () => {
    if (!hoSo || hoSo.status === 'APPROVED') {
      hoSo = taoHoSoXacThuc();
    } else if (hoSo.status === 'WITHDRAWN' || hoSo.status === 'REJECTED') {
      datTrangThai('DRAFT');
    }
    return jsonMock(envelope(hoSo, 201), { status: 201 });
  }),

  http.put(`${base}/api/me/mentor-profile`, async ({ request }) => {
    const yc = (await request.json()) as MentorProfileUpsertRequest;
    if (!yc.subjectResults?.length) {
      return loi(400, 'BAD_REQUEST', 'Danh sách môn - điểm không được để trống');
    }
    if ([yc.foundationSupportLevel, yc.outputReviewSupportLevel, yc.directionSupportLevel].some((m) => m < 1 || m > 4)) {
      return loi(400, 'BAD_REQUEST', 'Mức độ hỗ trợ phải từ 1 đến 4');
    }
    return jsonMock(envelope({ exists: true, requiredFieldsCompleted: true, ...yc }));
  }),

  http.post(`${base}/api/me/mentor-projects`, async ({ request }) => {
    dem += 1;
    return jsonMock(envelope({ id: `pj-${dem}`, ...((await request.json()) as object) }, 201), { status: 201 });
  }),
  http.put(`${base}/api/me/mentor-projects/:id`, async ({ params, request }) =>
    jsonMock(envelope({ id: params.id, ...((await request.json()) as object) })),
  ),
  http.delete(`${base}/api/me/mentor-projects/:id`, () => jsonMock(envelope(null))),

  http.post(`${base}/api/me/mentor-achievements`, async ({ request }) => {
    dem += 1;
    return jsonMock(envelope({ id: `ac-${dem}`, ...((await request.json()) as object) }, 201), { status: 201 });
  }),
  http.put(`${base}/api/me/mentor-achievements/:id`, async ({ params, request }) =>
    jsonMock(envelope({ id: params.id, ...((await request.json()) as object) })),
  ),
  http.delete(`${base}/api/me/mentor-achievements/:id`, () => jsonMock(envelope(null))),

  http.post(`${base}/api/me/mentor-verification/documents/upload-intents`, async ({ request }) => {
    const yc = (await request.json()) as UploadIntentRequest;
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(yc.contentType)) {
      return loi(400, 'BAD_REQUEST', 'Chỉ hỗ trợ file JPG, PNG hoặc PDF');
    }
    dem += 1;
    const id = `ui-${dem}`;
    intents[id] = yc;
    return jsonMock(
      envelope({ uploadIntentId: id, uploadUrl: `${MOCK_UPLOAD_HOST}/${id}`, expiresAt: null, requiredHeaders: {}, status: 'PENDING' }, 201),
      { status: 201 },
    );
  }),

  http.put(`${MOCK_UPLOAD_HOST}/:id`, () => new Response(null, { status: 200 })),

  http.post(`${base}/api/me/mentor-verification/documents`, async ({ request }) => {
    const yc = (await request.json()) as ConfirmDocumentRequest;
    const intent = intents[yc.uploadIntentId];
    if (!hoSo || !intent) {
      return loi(404, 'NOT_FOUND', 'Không tìm thấy upload intent');
    }
    delete intents[yc.uploadIntentId];
    const tl: MentorVerificationDocumentResponse = {
      id: `doc-${yc.uploadIntentId}`,
      documentType: yc.documentType,
      status: 'UPLOADED',
      storageKind: 'R2',
      originalFilename: intent.filename,
      contentType: intent.contentType,
      sizeBytes: intent.sizeBytes,
      fileUrl: null,
      isActive: true,
      version: 0,
      reviewNote: null,
      rejectedReason: null,
      uploadedAt: ldt(),
    };
    hoSo = { ...hoSo, documents: [...hoSo.documents, tl] };
    return jsonMock(envelope(hoSo, 201), { status: 201 });
  }),

  http.delete(`${base}/api/me/mentor-verification/documents/:id`, ({ params }) => {
    if (!hoSo) {
      return loi(404, 'NOT_FOUND', 'Không tìm thấy tài liệu minh chứng để xóa');
    }
    hoSo = { ...hoSo, documents: hoSo.documents.map((d) => (d.id === params.id ? { ...d, isActive: false } : d)) };
    return jsonMock(envelope(hoSo));
  }),

  http.post(`${base}/api/me/mentor-verification/submit`, () => {
    if (!hoSo) {
      return loi(400, 'BAD_REQUEST', 'Hồ sơ xác thực mentor không hợp lệ');
    }
    const dang = hoSo.documents.filter((d) => d.isActive);
    if (!dang.some((d) => d.documentType === 'FPTU_AFFILIATION_PROOF')) {
      return loi(400, 'BAD_REQUEST', 'Cần tải lên ít nhất một minh chứng FPTU');
    }
    if (!dang.some((d) => d.documentType === 'EXPERTISE_PROOF')) {
      return loi(400, 'BAD_REQUEST', 'Cần tải lên ít nhất một minh chứng năng lực mentoring');
    }
    datTrangThai('PENDING_REVIEW');
    hoSo = hoSo ? { ...hoSo, submittedAt: ldt() } : hoSo;
    return jsonMock(envelope(hoSo));
  }),

  http.post(`${base}/api/me/mentor-verification/withdraw`, () => {
    if (hoSo?.status !== 'PENDING_REVIEW') {
      return loi(400, 'BAD_REQUEST', 'Hồ sơ hiện tại không cho phép rút');
    }
    datTrangThai('WITHDRAWN');
    return jsonMock(envelope(hoSo));
  }),
];
