/**
 * @file handlers.ts
 * @description Handler MSW cho `/api/mentors/*` dùng trong CHẾ ĐỘ MOCK của app.
 *
 * Đây KHÔNG phải handler của test — lý do tách hai thứ ghi đầy đủ ở
 * `core/auth/mocks/handlers.ts`. Handler ở đây mô tả "một thế giới hợp lý để xem
 * giao diện"; handler trong từng file test mô tả "đúng một tình huống đang kiểm".
 *
 * Dữ liệu cố ý đủ đa dạng để MỌI nhánh giao diện của nhánh mentor có cái để hiện:
 *
 * - **Một mentor `NO_REVIEWS`** (`m3`) để nhìn thấy luật "chưa có đánh giá thì
 *   không hiện sao nào" — xem `features/mentor/rating.ts`. Thiếu nó thì luật quan
 *   trọng nhất của nhánh này không bao giờ xem được trên máy.
 * - **Hai mentor có `match.score = null`** (`m4`, `m6`): backend bỏ trống điểm khớp
 *   khi sort khác `relevance`, và thẻ mentor phải render được mà không cần nó.
 * - Một mentor `headline: null` (`m2`), một mentor `avatarUrl: null` (`m4`), một
 *   mentor `isAvailable: false` (`m5`), một mentor khai thiếu mức hỗ trợ (`m6`).
 * - `m1` có **cả** một dịch vụ `isFree: true` **và** một dịch vụ `isActive: false`,
 *   để hai nhánh lọc/định dạng giá ở màn hồ sơ có cái để lọc.
 * - `m1` có **13 đánh giá** — nhiều hơn một trang (`size` mặc định 10), nên việc
 *   cuộn tải thêm đánh giá xem được thật.
 *
 * **Mốc thời gian viết KHÔNG CÓ OFFSET** (`"2026-09-20T14:05:00"`): gần như mọi
 * trường thời gian của nhánh mentor là `LocalDateTime` phía Java, lên dây đúng
 * như vậy. Viết `...Z` ở đây là dựng một backend khác backend thật, và màn hình sẽ
 * được kiểm trên một định dạng nó sẽ không bao giờ gặp. Ngoại lệ duy nhất là
 * `timestamp` của envelope — đó là trường của `ApiResponse`, không phải của DTO.
 *
 * Lọc và phân trang làm THẬT. Handler trả nguyên danh sách bất kể tham số thì khi
 * xem trên máy, ô tìm kiếm và việc cuộn tải thêm trông y như đang hỏng — đúng thứ
 * chế độ mock sinh ra để kiểm.
 */

import { http } from 'msw';

import type { PageResponse } from '@/core/api/pagination';
import { getEnv } from '@/core/config/env';
import { jsonMock } from '@/core/dev/jsonMock';
import type {
  MentorAchievement,
  MentorDiscoveryCardResponse,
  MentorDiscoveryDetailResponse,
  MentorFeaturedProject,
  MentorRecommendationResponse,
  MentorReputation,
  MentorReviewResponse,
  MentorServiceResponse,
  MentorSubjectResult,
} from '@/features/mentor/types';

/** Bọc dữ liệu vào envelope `ApiResponse<T>` đúng như backend trả về */
function envelope(data: unknown) {
  return {
    timestamp: new Date().toISOString(),
    status: 200,
    code: 'SUCCESS',
    message: 'OK',
    data,
  };
}

/**
 * Phản hồi lỗi theo đúng khuôn envelope của backend.
 *
 * `ErrorCode.NOT_FOUND` của BE là `SYS_0003` (xác minh ở
 * `shared/exception/ErrorCode.java:41`), và `MentorDiscoveryService.java:423`
 * dùng đúng mã đó cho "Không tìm thấy mentor" — nhánh mentor KHÔNG có mã 404
 * riêng, dù `mentor-discovery.md` §7 chỉ liệt kê HTTP status chứ không liệt kê mã.
 */
function loi(status: number, code: string, message: string) {
  return jsonMock(
    { timestamp: new Date().toISOString(), status, code, message, data: null },
    { status },
  );
}

/**
 * Cắt một mảng thành đúng trang mà backend sẽ trả về.
 *
 * `last` là NGUỒN SỰ THẬT mà `getNextPageNumber` dựa vào; tính sai ở đây thì hoặc
 * danh sách dừng sớm, hoặc nó xin mãi một trang không tồn tại.
 */
function layTrang<T>(tatCa: T[], page: number, size: number): PageResponse<T> {
  const batDau = page * size;
  return {
    content: tatCa.slice(batDau, batDau + size),
    page,
    size,
    totalElements: tatCa.length,
    totalPages: Math.max(1, Math.ceil(tatCa.length / size)),
    last: batDau + size >= tatCa.length,
  };
}

function monHoc(
  id: string,
  subjectCode: string,
  subjectName: string,
  scoreValue: number,
  displayOrder: number,
): MentorSubjectResult {
  return { id, subjectCode, subjectName, scoreValue, displayOrder };
}

function duAn(id: string, title: string, projectDescription: string): MentorFeaturedProject {
  return {
    id,
    title,
    pictureUrl: null,
    content: null,
    projectDescription,
    liveDemoUrl: null,
    displayOrder: 1,
    createdAt: '2026-03-12T09:15:00',
    updatedAt: '2026-03-12T09:15:00',
  };
}

function thanhTich(id: string, title: string, awardDescription: string): MentorAchievement {
  return {
    id,
    title,
    pictureUrl: null,
    awardDescription,
    // `LocalDate` phía Java — chỉ có ngày, không có giờ.
    achievedAt: '2026-05-18',
    productHeader: null,
    productDescription: null,
    demoUrl: null,
    displayOrder: 1,
    createdAt: '2026-05-20T10:00:00',
    updatedAt: '2026-05-20T10:00:00',
  };
}

/**
 * Số sao của TỪNG đánh giá, theo mentor — NGUỒN DUY NHẤT của cả uy tín trên thẻ
 * lẫn danh sách đánh giá ở màn hồ sơ.
 *
 * Viết `reviewCount` và `ratingAverage` bằng tay cạnh một danh sách đánh giá
 * riêng là cách chắc chắn để hai số lệch nhau: thẻ hiện "24 đánh giá" mà màn hồ
 * sơ chỉ có 13 dòng trông y như một lỗi đồng bộ của backend. Đã xảy ra đúng một
 * lần ở bản nháp của file này và chính test `handlers.test.ts` bắt được.
 *
 * `m1` có 13 đánh giá — NHIỀU HƠN một trang (`size` mặc định 10 của handler),
 * nên việc cuộn tải thêm đánh giá ở màn hồ sơ xem được thật.
 */
const SAO_DANH_GIA: Record<string, number[]> = {
  m1: [5, 5, 4, 5, 5, 5, 4, 5, 5, 5, 4, 5, 5],
  m2: [5, 5, 5],
  // Mentor MỚI: không có đánh giá nào. Một đánh giá ở đây sẽ làm `ratingState`
  // và danh sách nói hai điều khác nhau.
  m3: [],
  m4: [4, 5, 4, 4, 5, 4, 4, 3, 5, 4, 4],
  m5: [4, 4, 3, 4, 5, 3, 4],
  m6: [5, 4, 5, 5, 4, 5, 5, 4, 5, 5, 4, 5, 5, 4, 5],
};

/** Số buổi đã dạy xong — không suy ra được từ số đánh giá nên khai riêng */
const SO_BUOI_HOAN_THANH: Record<string, number> = {
  m1: 41,
  m2: 6,
  m3: 0,
  m4: 19,
  m5: 12,
  m6: 23,
};

/**
 * Uy tín tính TỪ danh sách sao, không khai tay.
 *
 * `ratingState === 'NO_REVIEWS'` thì `ratingAverage` phải là `null` — backend
 * luôn trả hai thứ đó cùng nhau (`DiscoveryMapper.java:96`), và một fixture lệch
 * sẽ cho màn hình hiện sao cho mentor mới, đúng lời nói dối mà
 * `features/mentor/rating.ts` tồn tại để chặn.
 */
function uyTin(mentorUserId: string): MentorReputation {
  const sao = SAO_DANH_GIA[mentorUserId] ?? [];
  const soBuoi = SO_BUOI_HOAN_THANH[mentorUserId] ?? 0;

  if (sao.length === 0) {
    return {
      ratingState: 'NO_REVIEWS',
      ratingAverage: null,
      reviewCount: 0,
      completedSessions: soBuoi,
    };
  }

  const tong = sao.reduce((a, b) => a + b, 0);
  return {
    ratingState: 'RATED',
    // Backend trả `BigDecimal` một chữ số thập phân; làm tròn ở đây để fixture
    // không mang một số 15 chữ số mà backend không bao giờ phát ra.
    ratingAverage: Number((tong / sao.length).toFixed(1)),
    reviewCount: sao.length,
    completedSessions: soBuoi,
  };
}

/** Thẻ mentor; `overrides` lồng nên mỗi section phải ghi đè cả cục, không trộn nửa vời */
function the(
  overrides: Omit<Partial<MentorDiscoveryCardResponse>, 'reputation'> & {
    identity: MentorDiscoveryCardResponse['identity'];
  },
): MentorDiscoveryCardResponse {
  return {
    mentoring: {
      expertiseDescription: 'Spring Boot, REST API và thiết kế cơ sở dữ liệu',
      foundationSupportLevel: 3,
      outputReviewSupportLevel: 3,
      directionSupportLevel: 2,
    },
    evidence: {
      campusId: 'c1',
      campusName: 'FPT University Hà Nội',
      programId: 'p1',
      programName: 'Công nghệ thông tin',
      specializationId: 's1',
      specializationName: 'Kỹ thuật phần mềm',
      subjectHighlights: [
        monHoc('sh1', 'PRJ301', 'Java Web Application Development', 9.2, 1),
        monHoc('sh2', 'DBI202', 'Database Systems', 8.8, 2),
      ],
      featuredProjects: [duAn('fp1', 'SkillSwap Clone', 'API đặt lịch học 1:1 bằng Spring Boot')],
      achievements: [thanhTich('ac1', 'Giải Nhì FPT Hackathon', 'Đội 4 người, vòng chung kết 2026')],
    },
    availability: { isAvailable: true },
    match: { score: 95.5 },
    ...overrides,
    // SAU `...overrides` có chủ ý: uy tín luôn tính từ `SAO_DANH_GIA`, không chỗ
    // gọi nào được khai tay. Kiểu của `overrides` cũng đã loại `reputation`.
    reputation: uyTin(overrides.identity.mentorUserId),
  };
}

/**
 * Sáu mentor — đủ để `size=2` cho ra ba trang.
 *
 * Dưới năm mentor thì `getNextPageNumber` và chốt chặn `taiTrangKe` không có gì
 * canh, và việc cuộn tải thêm không bao giờ xem được trên máy.
 */
export const MOCK_MENTORS: MentorDiscoveryCardResponse[] = [
  the({
    identity: {
      mentorUserId: 'm1',
      displayName: 'Trần Minh Quân',
      avatarUrl: null,
      headline: 'Backend Developer · Spring Boot & REST API',
      isVerified: true,
      verifiedAt: '2026-05-02T08:30:00',
    },
  }),
  the({
    // `headline: null` — thẻ phải tụt về `expertiseDescription`, không để trống dòng.
    identity: {
      mentorUserId: 'm2',
      displayName: 'Lê Thu Hà',
      avatarUrl: null,
      headline: null,
      isVerified: false,
      verifiedAt: null,
    },
    mentoring: {
      expertiseDescription: 'React Native, Expo và kiểm thử giao diện',
      foundationSupportLevel: 4,
      outputReviewSupportLevel: 4,
      directionSupportLevel: 3,
    },
    evidence: {
      campusId: 'c1',
      campusName: 'FPT University Hà Nội',
      programId: 'p1',
      programName: 'Công nghệ thông tin',
      specializationId: 's1',
      specializationName: 'Kỹ thuật phần mềm',
      subjectHighlights: [monHoc('sh3', 'MMA301', 'Mobile Programming', 9.5, 1)],
      featuredProjects: [],
      achievements: [],
    },
    match: { score: 88 },
  }),
  the({
    // Mentor MỚI: `NO_REVIEWS` và `ratingAverage: null` — đúng cặp mà backend
    // luôn trả cùng nhau (`DiscoveryMapper.java:96`). Thẻ không được hiện sao nào.
    identity: {
      mentorUserId: 'm3',
      displayName: 'Phạm Gia Bảo',
      avatarUrl: null,
      headline: 'Data Analyst · Python & SQL',
      isVerified: false,
      verifiedAt: null,
    },
    mentoring: {
      expertiseDescription: 'Pandas, SQL nâng cao và trực quan hoá dữ liệu',
      foundationSupportLevel: 2,
      outputReviewSupportLevel: 3,
      directionSupportLevel: 1,
    },
    evidence: {
      campusId: 'c2',
      campusName: 'FPT University Hồ Chí Minh',
      programId: 'p2',
      programName: 'Trí tuệ nhân tạo',
      specializationId: 's2',
      specializationName: 'Khoa học dữ liệu',
      subjectHighlights: [monHoc('sh4', 'DWP301', 'Data Warehousing', 8.5, 1)],
      featuredProjects: [],
      achievements: [],
    },
    match: { score: 72.5 },
  }),
  the({
    // `match.score: null` + `avatarUrl: null`.
    identity: {
      mentorUserId: 'm4',
      displayName: 'Vũ Khánh Linh',
      avatarUrl: null,
      headline: 'UX Designer · Figma & Design System',
      isVerified: true,
      verifiedAt: '2026-02-14T11:00:00',
    },
    mentoring: {
      expertiseDescription: 'Nghiên cứu người dùng, wireframe và design system',
      foundationSupportLevel: 3,
      outputReviewSupportLevel: 4,
      directionSupportLevel: 4,
    },
    evidence: {
      campusId: 'c1',
      campusName: 'FPT University Hà Nội',
      programId: 'p3',
      programName: 'Thiết kế đồ hoạ',
      specializationId: 's3',
      specializationName: 'Thiết kế trải nghiệm',
      subjectHighlights: [monHoc('sh5', 'DTG302', 'Typography', 9, 1)],
      featuredProjects: [duAn('fp2', 'Bộ design system cho app học tập', 'Thư viện 48 component')],
      achievements: [],
    },
    match: { score: null },
  }),
  the({
    // `isAvailable: false` — mentor đang tạm không nhận booking.
    identity: {
      mentorUserId: 'm5',
      displayName: 'Đặng Hoàng Nam',
      avatarUrl: null,
      headline: 'DevOps Engineer · Docker & CI/CD',
      isVerified: false,
      verifiedAt: null,
    },
    mentoring: {
      expertiseDescription: 'Docker, GitHub Actions và triển khai trên VPS',
      foundationSupportLevel: 2,
      outputReviewSupportLevel: 2,
      directionSupportLevel: 3,
    },
    evidence: {
      campusId: 'c3',
      campusName: 'FPT University Đà Nẵng',
      programId: 'p1',
      programName: 'Công nghệ thông tin',
      specializationId: 's4',
      specializationName: 'An toàn thông tin',
      subjectHighlights: [],
      featuredProjects: [],
      achievements: [],
    },
    availability: { isAvailable: false },
    match: { score: 64 },
  }),
  the({
    // Khai THIẾU mức hỗ trợ: `null` nghĩa là chưa khai, khác hẳn khai mức thấp
    // nhất — giao diện phải bỏ hẳn chứ không hiện 0.
    identity: {
      mentorUserId: 'm6',
      displayName: 'Nguyễn Bảo Châu',
      avatarUrl: null,
      headline: 'Product Manager · Phân tích yêu cầu',
      isVerified: false,
      verifiedAt: null,
    },
    mentoring: {
      expertiseDescription: 'Viết user story, đo lường sản phẩm và làm việc với dev',
      foundationSupportLevel: 3,
      outputReviewSupportLevel: null,
      directionSupportLevel: null,
    },
    evidence: {
      campusId: 'c2',
      campusName: 'FPT University Hồ Chí Minh',
      programId: 'p4',
      programName: 'Quản trị kinh doanh',
      specializationId: 's5',
      specializationName: 'Quản trị số',
      subjectHighlights: [monHoc('sh6', 'SWR302', 'Software Requirement', 8.2, 1)],
      featuredProjects: [],
      achievements: [],
    },
    match: { score: null },
  }),
];

function dichVu(overrides: Partial<MentorServiceResponse> & { serviceId: string; mentorUserId: string }): MentorServiceResponse {
  return {
    title: 'Review CV 1:1',
    description: 'Soi từng dòng CV, chỉnh lại phần kinh nghiệm theo hướng kết quả.',
    expectedOutcome: 'Một bản CV sửa xong, kèm ghi chú cho từng mục.',
    durationMinutes: 45,
    isFree: false,
    priceScoin: 150_000,
    isActive: true,
    maintainPostSessionChat: true,
    deliveryMode: 'ONE_TO_ONE',
    coverImageUrl: null,
    version: 1,
    createdAt: '2026-04-01T09:00:00',
    updatedAt: '2026-08-11T15:20:00',
    ...overrides,
  };
}

/** Chuyển thẻ mentor thành hồ sơ đầy đủ — hai DTO khác nhau đúng ở chỗ dễ nhầm */
function hoSo(
  card: MentorDiscoveryCardResponse,
  services: MentorServiceResponse[],
  bio: string | null,
): MentorDiscoveryDetailResponse {
  return {
    identity: card.identity,
    mentoring: {
      bio,
      expertiseDescription: card.mentoring.expertiseDescription,
      // Detail khai mức hỗ trợ LỒNG trong `supportLevels`, card khai PHẲNG. Đây
      // là một trong hai chỗ card và detail lệch nhau — xem `types.ts`.
      supportLevels: {
        foundation: card.mentoring.foundationSupportLevel,
        outputReview: card.mentoring.outputReviewSupportLevel,
        direction: card.mentoring.directionSupportLevel,
      },
    },
    services,
    evidence: {
      education: {
        campusId: card.evidence.campusId,
        campusName: card.evidence.campusName,
        programId: card.evidence.programId,
        programName: card.evidence.programName,
        specializationId: card.evidence.specializationId,
        specializationName: card.evidence.specializationName,
        semester: 7,
        alumni: false,
      },
      subjectResults: card.evidence.subjectHighlights,
      featuredProjects: card.evidence.featuredProjects,
      achievements: card.evidence.achievements,
      portfolioUrl: null,
      githubUrl: null,
      authorityContent: {
        publishedArticleCount: 0,
        latestPublishedAt: null,
        recentPublicArticles: [],
      },
    },
    reputation: card.reputation,
    // `availability` của detail là `Boolean` ĐÓNG HỘP (có thể null), của card là
    // `boolean` nguyên thuỷ. Đừng gộp hai kiểu.
    availability: {
      isAvailable: card.availability.isAvailable,
      suspendedUntil: card.availability.isAvailable ? null : '2026-11-01T00:00:00',
      canRequestBooking: card.availability.isAvailable,
    },
  };
}

const DICH_VU_THEO_MENTOR: Record<string, MentorServiceResponse[]> = {
  m1: [
    dichVu({ serviceId: 'sv1', mentorUserId: 'm1' }),
    dichVu({
      serviceId: 'sv2',
      mentorUserId: 'm1',
      title: 'Buổi làm quen miễn phí',
      description: 'Nói nhanh về mục tiêu của bạn và xem hai bên có hợp nhau không.',
      expectedOutcome: 'Một lộ trình phác thảo và quyết định có học tiếp hay không.',
      durationMinutes: 20,
      // `isFree: true` đi cùng `priceScoin: null`: giao diện phải hiện "Miễn phí",
      // KHÔNG hiện "0 S-coins" hay "null S-coins".
      isFree: true,
      priceScoin: null,
      maintainPostSessionChat: false,
    }),
    dichVu({
      serviceId: 'sv3',
      mentorUserId: 'm1',
      title: 'Mock interview backend (đã đóng)',
      description: 'Phỏng vấn thử 60 phút kèm nhận xét chi tiết.',
      expectedOutcome: 'Bản nhận xét theo từng vòng phỏng vấn.',
      durationMinutes: 60,
      priceScoin: 250_000,
      // Mentor đã ĐÓNG dịch vụ này — giao diện phải bỏ hẳn khỏi danh sách.
      isActive: false,
    }),
  ],
  m2: [
    dichVu({
      serviceId: 'sv4',
      mentorUserId: 'm2',
      title: 'Dựng màn hình React Native đầu tiên',
      description: 'Đi từ Expo Router tới một màn hình gọi API có trạng thái tải.',
      expectedOutcome: 'Một màn hình chạy được trên máy thật.',
      durationMinutes: 60,
      priceScoin: 200_000,
    }),
  ],
  m3: [],
  m4: [
    dichVu({
      serviceId: 'sv5',
      mentorUserId: 'm4',
      title: 'Review portfolio thiết kế',
      description: 'Xem lại thứ tự case study và cách kể câu chuyện thiết kế.',
      expectedOutcome: 'Danh sách việc cần sửa, xếp theo mức ảnh hưởng.',
      durationMinutes: 45,
      priceScoin: 180_000,
    }),
  ],
  m5: [
    dichVu({
      serviceId: 'sv6',
      mentorUserId: 'm5',
      title: 'Dựng pipeline CI/CD cho đồ án',
      description: 'GitHub Actions build, test và deploy lên VPS.',
      expectedOutcome: 'Một pipeline xanh chạy được trên repo của bạn.',
      durationMinutes: 90,
      priceScoin: 300_000,
    }),
  ],
  m6: [
    dichVu({
      serviceId: 'sv7',
      mentorUserId: 'm6',
      title: 'Viết user story cho đồ án tốt nghiệp',
      description: 'Chuyển mô tả tính năng thành user story có tiêu chí hoàn thành.',
      expectedOutcome: 'Một backlog gọn, dev đọc là làm được.',
      durationMinutes: 60,
      priceScoin: 160_000,
    }),
  ],
};

const BIO_THEO_MENTOR: Record<string, string | null> = {
  m1: 'Mình làm backend ba năm, chủ yếu Spring Boot. Thích ngồi cùng bạn đọc lỗi thật thay vì giảng lý thuyết.',
  m2: 'Mình dựng app React Native cho hai sản phẩm đã lên store. Hay giúp các bạn qua được bước "chạy trên máy thật".',
  // Mentor mới chưa viết giới thiệu — màn hồ sơ phải bỏ hẳn khối đó.
  m3: null,
  m4: 'Mình thiết kế sản phẩm số, mạnh phần nghiên cứu người dùng và hệ thống component.',
  m5: 'Mình lo hạ tầng và triển khai. Giúp bạn đưa đồ án từ máy cá nhân lên một server thật.',
  m6: 'Mình làm product, quen việc dịch mong muốn của khách thành việc dev làm được.',
};

export const MOCK_MENTOR_DETAILS: Record<string, MentorDiscoveryDetailResponse> =
  Object.fromEntries(
    MOCK_MENTORS.map((card) => [
      card.identity.mentorUserId,
      hoSo(
        card,
        DICH_VU_THEO_MENTOR[card.identity.mentorUserId] ?? [],
        BIO_THEO_MENTOR[card.identity.mentorUserId] ?? null,
      ),
    ]),
  );

function danhGia(
  reviewId: string,
  reviewerDisplayName: string,
  rating: number,
  comment: string | null,
  createdAt: string,
): MentorReviewResponse {
  return {
    reviewId,
    reviewerUserId: `u-${reviewId}`,
    reviewerDisplayName,
    reviewerAvatarUrl: null,
    rating,
    comment,
    createdAt,
  };
}

const TEN_NGUOI_DANH_GIA = [
  'Ngô Bảo Châu',
  'Đinh Khánh Linh',
  'Hoàng Thị Mai',
  'Bùi Quốc Anh',
  'Trịnh Văn Dũng',
  'Lý Thu Trang',
  'Cao Minh Hiếu',
  'Phan Nhật Vy',
  'Dương Tuấn Kiệt',
  'Hồ Ngọc Diệp',
  'Tạ Quang Huy',
  'Lâm Thuỳ Dương',
  'Mai Đức Thắng',
  'Vũ Thanh Hằng',
  'Đỗ Quang Dũng',
];

const NHAN_XET = [
  'Anh chỉ rất sát, buổi học xong là mình sửa được ngay.',
  'Giải thích dễ hiểu, không nói lý thuyết suông.',
  'Buổi học đúng thứ mình đang cần.',
  'Góp ý thẳng và dùng được luôn.',
  'Chuẩn bị bài kỹ, đúng giờ.',
];

/**
 * Danh sách đánh giá sinh TỪ `SAO_DANH_GIA`, nên số dòng luôn khớp `reviewCount`
 * trên thẻ mentor.
 *
 * Đánh giá thứ ba của mỗi mentor có `comment: null` — người dùng chỉ chấm sao
 * chứ không viết gì là chuyện thường, và nhánh "không có nhận xét" của giao diện
 * cần có cái để hiện.
 */
const DANH_GIA_THEO_MENTOR: Record<string, MentorReviewResponse[]> = Object.fromEntries(
  Object.entries(SAO_DANH_GIA).map(([mentorUserId, sao]) => [
    mentorUserId,
    sao.map((diem, i) =>
      danhGia(
        `rv-${mentorUserId}-${i + 1}`,
        TEN_NGUOI_DANH_GIA[i % TEN_NGUOI_DANH_GIA.length],
        diem,
        i === 2 ? null : NHAN_XET[i % NHAN_XET.length],
        // Mốc thời gian KHÔNG offset — đúng `LocalDateTime` của backend. Ngày
        // giảm dần để danh sách trông như sắp theo `createdAt DESC` của BE.
        `2026-09-${String(28 - i).padStart(2, '0')}T${String(9 + (i % 10)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00`,
      ),
    ),
  ]),
);

const base = getEnv().apiUrl;

/** Những trường mà ô tìm kiếm của backend soi vào */
function noiDungTimKiem(mentor: MentorDiscoveryCardResponse): string {
  return [
    mentor.identity.displayName,
    mentor.identity.headline ?? '',
    mentor.mentoring.expertiseDescription ?? '',
    mentor.evidence.specializationName ?? '',
    ...mentor.evidence.subjectHighlights.map((mon) => `${mon.subjectCode} ${mon.subjectName ?? ''}`),
  ]
    .join(' ')
    .toLowerCase();
}

/** So sánh để sắp xếp, dùng cho `sortBy` của `/api/mentors` */
function khoaSapXep(mentor: MentorDiscoveryCardResponse, sortBy: string): number {
  switch (sortBy) {
    case 'ratingAverage':
      return mentor.reputation.ratingAverage ?? -1;
    case 'reviewCount':
      return mentor.reputation.reviewCount;
    case 'completedSessions':
      return mentor.reputation.completedSessions;
    default:
      // `relevance` và `updatedAt` đều dựa vào điểm khớp trong bản mock này.
      return mentor.match.score ?? -1;
  }
}

export const mentorMockHandlers = [
  /**
   * Tìm và lọc mentor.
   *
   * `sortBy` khác `relevance` thì `match.score` bị xoá về `null` — đúng như
   * backend, và đó chính là tình huống thẻ mentor phải render được mà không có
   * điểm khớp. Không làm bước này thì cái bẫy `score: null` chỉ tồn tại ở hai
   * mentor cố định và một màn hình đọc trượt vẫn trông như chạy tốt.
   */
  http.get(`${base}/api/mentors`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    const keyword = (params.get('keyword') ?? '').trim().toLowerCase();
    const sortBy = params.get('sortBy') ?? 'relevance';
    const page = Number(params.get('page') ?? '0');
    const size = Number(params.get('size') ?? '12');

    let khop = MOCK_MENTORS.filter(
      (mentor) => keyword === '' || noiDungTimKiem(mentor).includes(keyword),
    );

    khop = [...khop].sort((a, b) => khoaSapXep(b, sortBy) - khoaSapXep(a, sortBy));
    if (sortBy !== 'relevance') {
      khop = khop.map((mentor) => ({ ...mentor, match: { score: null } }));
    }

    return jsonMock(envelope(layTrang(khop, page, size)));
  }),

  /**
   * Gợi ý mentor theo ngành học — trả về MẢNG, không phải trang (§4.2).
   *
   * PHẢI đăng ký TRƯỚC `/api/mentors/:mentorUserId`, nếu không MSW coi
   * `recommendations` là một `mentorUserId` và trả 404.
   */
  http.get(`${base}/api/mentors/recommendations`, ({ request }) => {
    const limit = Number(new URL(request.url).searchParams.get('limit') ?? '12');

    const goiY: MentorRecommendationResponse[] = MOCK_MENTORS.slice(0, limit).map((mentor) => ({
      mentor,
      matchScore: mentor.match.score,
      matchReasons: [
        `Cùng chuyên ngành ${mentor.evidence.specializationName ?? 'của bạn'}`,
        mentor.reputation.ratingState === 'RATED'
          ? 'Được học viên khác đánh giá tốt'
          : 'Mentor mới, đang nhận học viên đầu tiên',
      ],
    }));

    return jsonMock(envelope(goiY));
  }),

  http.get(`${base}/api/mentors/:mentorUserId`, ({ params }) => {
    const hoSoMentor = MOCK_MENTOR_DETAILS[String(params.mentorUserId)];
    if (!hoSoMentor) {
      return loi(404, 'SYS_0003', 'Không tìm thấy mentor');
    }
    return jsonMock(envelope(hoSoMentor));
  }),

  http.get(`${base}/api/mentors/:mentorUserId/reviews`, ({ request, params }) => {
    const sp = new URL(request.url).searchParams;
    const danhSach = DANH_GIA_THEO_MENTOR[String(params.mentorUserId)];
    if (!danhSach) {
      return loi(404, 'SYS_0003', 'Không tìm thấy mentor');
    }
    return jsonMock(
      envelope(layTrang(danhSach, Number(sp.get('page') ?? '0'), Number(sp.get('size') ?? '10'))),
    );
  }),
];
