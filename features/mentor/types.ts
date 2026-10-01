/**
 * @file types.ts
 * @description DTO nhánh mentor, port từ
 * `fu-skillswap-be/docs/frontend-guide/mentor-discovery.md` §2–§4 và ĐỐI CHIẾU với
 * source Java trong `fu-skillswap-be/src/main/java/.../modules/mentor/dto/response/`.
 *
 * Chỗ nào doc và source Java lệch nhau thì source Java thắng — doc §3 đang cũ hơn
 * code (thiếu `coverImageUrl` của dịch vụ và `pictureUrl` của thành tích).
 */

/** Mentor đã có đánh giá hay chưa — quyết định có được hiện điểm sao không */
export type RatingState = 'NO_REVIEWS' | 'RATED';

export type MentorSortBy =
  | 'relevance'
  | 'ratingAverage'
  | 'reviewCount'
  | 'completedSessions'
  | 'updatedAt';

/**
 * Hình thức diễn ra dịch vụ.
 *
 * Doc §3 khai `string`, nhưng `MentorServiceDeliveryMode.java` là enum và hiện chỉ
 * có duy nhất một giá trị. Khai union để `tsc` bắt được giá trị lạ ngay tại chỗ.
 */
export type MentorServiceDeliveryMode = 'ONE_TO_ONE';

export interface MentorSubjectResult {
  id: string;
  subjectCode: string;
  subjectName: string | null;
  scoreValue: number;
  displayOrder: number;
}

export interface MentorFeaturedProject {
  id: string;
  title: string;
  pictureUrl: string | null;
  content: string | null;
  projectDescription: string | null;
  liveDemoUrl: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MentorAchievement {
  id: string;
  title: string;
  /** Có trong `MentorAchievementResponse.java` nhưng doc §3 chưa cập nhật */
  pictureUrl: string | null;
  awardDescription: string | null;
  /** `LocalDate` phía Java — chỉ có ngày, không có giờ (ví dụ "2026-06-20") */
  achievedAt: string | null;
  productHeader: string | null;
  productDescription: string | null;
  demoUrl: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MentorPublicArticlePreview {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImageUrl: string | null;
  readingTimeMinutes: number;
  publishedAt: string;
}

/** Một dịch vụ mentor mở bán. Thứ tự field giữ đúng như record Java. */
export interface MentorServiceResponse {
  serviceId: string;
  mentorUserId: string;
  title: string;
  description: string;
  expectedOutcome: string;
  durationMinutes: number;
  isFree: boolean;
  /**
   * Giá cuối người học trả, tính bằng S-Coin. `MentorServiceResponse.java` khai
   * `nullable = true`, nên màn hình phải chịu được `null` chứ không chỉ chịu được 0.
   */
  priceScoin: number | null;
  isActive: boolean;
  maintainPostSessionChat: boolean;
  deliveryMode: MentorServiceDeliveryMode;
  /** Có trong source Java nhưng doc §3 chưa cập nhật */
  coverImageUrl: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface MentorIdentity {
  mentorUserId: string;
  displayName: string;
  avatarUrl: string | null;
  headline: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
}

export interface MentorReputation {
  ratingState: RatingState;
  /** LUÔN `null` khi `ratingState === 'NO_REVIEWS'` */
  ratingAverage: number | null;
  reviewCount: number;
  completedSessions: number;
}

/** Thẻ mentor trong danh sách (§2) */
export interface MentorDiscoveryCardResponse {
  identity: MentorIdentity;
  mentoring: {
    expertiseDescription: string | null;
    foundationSupportLevel: number | null;
    outputReviewSupportLevel: number | null;
    directionSupportLevel: number | null;
  };
  evidence: {
    campusId: string | null;
    campusName: string | null;
    programId: string | null;
    programName: string | null;
    specializationId: string | null;
    specializationName: string | null;
    /** Tối đa 2 item nổi bật */
    subjectHighlights: MentorSubjectResult[];
    /** Tối đa 2 item nổi bật */
    featuredProjects: MentorFeaturedProject[];
    /** Tối đa 2 item nổi bật */
    achievements: MentorAchievement[];
  };
  reputation: MentorReputation;
  availability: {
    isAvailable: boolean;
  };
  match: {
    /** Có thể `null`, nhất là khi sort khác `relevance` */
    score: number | null;
  };
}

/** Hồ sơ mentor đầy đủ (§3) */
export interface MentorDiscoveryDetailResponse {
  identity: MentorIdentity;
  mentoring: {
    bio: string | null;
    expertiseDescription: string | null;
    supportLevels: {
      /** 1–4 */
      foundation: number | null;
      outputReview: number | null;
      direction: number | null;
    };
  };
  services: MentorServiceResponse[];
  evidence: {
    education: {
      campusId: string | null;
      campusName: string | null;
      programId: string | null;
      programName: string | null;
      specializationId: string | null;
      specializationName: string | null;
      semester: number | null;
      alumni: boolean | null;
    };
    subjectResults: MentorSubjectResult[];
    featuredProjects: MentorFeaturedProject[];
    achievements: MentorAchievement[];
    portfolioUrl: string | null;
    githubUrl: string | null;
    authorityContent: {
      publishedArticleCount: number;
      latestPublishedAt: string | null;
      recentPublicArticles: MentorPublicArticlePreview[];
    };
  };
  reputation: MentorReputation;
  availability: {
    isAvailable: boolean | null;
    suspendedUntil: string | null;
    canRequestBooking: boolean;
  };
}

/** Một đánh giá của mentor (§4.1) */
export interface MentorReviewResponse {
  reviewId: string;
  reviewerUserId: string;
  reviewerDisplayName: string;
  reviewerAvatarUrl: string | null;
  /** 1–5 */
  rating: number;
  comment: string | null;
  createdAt: string;
}

/**
 * Một gợi ý mentor (§4.2).
 *
 * `matchScore` là `BigDecimal` trong `MentorRecommendationResponse.java`. Backend
 * KHÔNG cấu hình gì cho Jackson ngoài `time-zone` (`application.yaml`), không có
 * `ObjectMapper` bean hay `Jackson2ObjectMapperBuilderCustomizer` nào, nên nó
 * serialize theo mặc định: số JSON, không phải chuỗi.
 */
export interface MentorRecommendationResponse {
  mentor: MentorDiscoveryCardResponse;
  matchScore: number | null;
  matchReasons: string[];
}
