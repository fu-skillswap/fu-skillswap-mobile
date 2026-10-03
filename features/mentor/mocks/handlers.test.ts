/**
 * @file handlers.test.ts
 * @description Kiểm handler mock của nhánh mentor bằng cách cho REPO THẬT đọc nó.
 *
 * Không có một assertion nào nhìn trực tiếp vào fixture rồi so với chính nó:
 * fixture bịa sai hình dạng DTO là lớp lỗi repo này đã dính nhiều lần, và chỉ
 * đường đi `mentorRepo → apiClient → envelope` mới bắt được. Luật hiển thị điểm
 * đánh giá cũng được kiểm qua chính `moTaDiemDanhGia()` — hàm mà giao diện dùng —
 * thay vì so chuỗi bằng tay.
 */

import { setupServer } from 'msw/node';

import { __resetApiClientForTests } from '@/core/api/client';
import { getNextPageNumber } from '@/core/api/pagination';
import { ApiClientError } from '@/core/api/errors';
import { mentorRepo } from '@/features/mentor/mentorRepo';
import { mentorMockHandlers } from '@/features/mentor/mocks/handlers';
import { moTaDiemDanhGia } from '@/features/mentor/rating';

const server = setupServer(...mentorMockHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => __resetApiClientForTests());
afterAll(() => server.close());

describe('handler mock của nhánh mentor', () => {
  it('danh sách trả về ĐÚNG hình dạng PageResponse mà repo thật mong đợi', async () => {
    const trang = await mentorRepo.searchMentors({});

    expect(trang.content.length).toBeGreaterThan(0);
    expect(trang.page).toBe(0);
    expect(typeof trang.totalElements).toBe('number');
    expect(typeof trang.last).toBe('boolean');

    const mentor = trang.content[0];
    // Đọc qua section LỒNG: `MentorDiscoveryCardResponse.java` đánh `@JsonIgnore`
    // lên `mentorUserId`/`displayName`/`ratingState`/`matchScore` phẳng, nên một
    // fixture viết phẳng sẽ cho giao diện đọc ra `undefined` mà `tsc` không chặn.
    expect(mentor.identity.mentorUserId).toBeTruthy();
    expect(mentor.identity.displayName).toBeTruthy();
    expect(mentor.reputation.ratingState).toBeTruthy();
    expect(typeof mentor.availability.isAvailable).toBe('boolean');
    expect(Array.isArray(mentor.evidence.subjectHighlights)).toBe(true);
  });

  it('có ít nhất một mentor CHƯA có đánh giá, và nó KHÔNG có điểm để hiện', async () => {
    const trang = await mentorRepo.searchMentors({ size: 50 });

    const chuaCo = trang.content.filter(
      (mentor) => !moTaDiemDanhGia(mentor.reputation).coDiem,
    );

    expect(chuaCo.length).toBeGreaterThan(0);
    // `ratingAverage` phải là `null` cùng lúc với `NO_REVIEWS`: backend luôn trả
    // hai thứ đó cùng nhau, và một fixture lệch sẽ cho màn hình hiện sao cho
    // mentor mới — đúng lời nói dối mà `rating.ts` tồn tại để chặn.
    for (const mentor of chuaCo) {
      expect(mentor.reputation.ratingState).toBe('NO_REVIEWS');
      expect(mentor.reputation.ratingAverage).toBeNull();
      expect(moTaDiemDanhGia(mentor.reputation).diem).toBeNull();
    }
  });

  it('có ít nhất một mentor ĐÃ có đánh giá, điểm định dạng được một chữ số', async () => {
    const trang = await mentorRepo.searchMentors({ size: 50 });

    const daCo = trang.content.filter((mentor) => moTaDiemDanhGia(mentor.reputation).coDiem);

    expect(daCo.length).toBeGreaterThan(0);
    for (const mentor of daCo) {
      const mo = moTaDiemDanhGia(mentor.reputation);
      expect(mentor.reputation.ratingState).toBe('RATED');
      expect(mo.diem).toMatch(/^\d\.\d$/);
      expect(mo.soLuot).toBeGreaterThan(0);
    }
  });

  it('có ít nhất một mentor match.score là null — thẻ phải sống mà không cần điểm khớp', async () => {
    const trang = await mentorRepo.searchMentors({ size: 50 });

    expect(trang.content.some((mentor) => mentor.match.score === null)).toBe(true);
    expect(trang.content.some((mentor) => mentor.match.score !== null)).toBe(true);
  });

  it('sort khác relevance thì điểm khớp bị bỏ trống ở MỌI mentor, đúng như backend', async () => {
    const trang = await mentorRepo.searchMentors({ size: 50, sortBy: 'ratingAverage' });

    expect(trang.content.length).toBeGreaterThan(0);
    expect(trang.content.every((mentor) => mentor.match.score === null)).toBe(true);
  });

  it('gợi ý trả về MẢNG, mỗi phần tử có lý do gợi ý không rỗng', async () => {
    // Đăng ký handler `/recommendations` SAU `/:mentorUserId` sẽ làm MSW coi
    // "recommendations" là một id và trả 404 — test này là chỗ bắt được điều đó.
    const goiY = await mentorRepo.getRecommendations();

    expect(Array.isArray(goiY)).toBe(true);
    expect(goiY.length).toBeGreaterThan(0);
    for (const item of goiY) {
      expect(item.mentor.identity.mentorUserId).toBeTruthy();
      expect(item.matchReasons.length).toBeGreaterThan(0);
      expect(item.matchReasons.every((ly) => ly.length > 0)).toBe(true);
    }
  });

  it('limit của gợi ý được tôn trọng, không trả nguyên danh sách', async () => {
    const goiY = await mentorRepo.getRecommendations(2);

    expect(goiY).toHaveLength(2);
  });

  it('tìm theo từ khoá LỌC THẬT, bỏ các mentor không khớp', async () => {
    const tuKhoa = 'React Native';

    const trang = await mentorRepo.searchMentors({ keyword: tuKhoa, size: 50 });
    const tatCa = await mentorRepo.searchMentors({ size: 50 });

    expect(trang.content.length).toBeGreaterThan(0);
    // Không có vế này thì một handler trả nguyên danh sách vẫn xanh.
    expect(trang.content.length).toBeLessThan(tatCa.content.length);
  });

  it('từ khoá rỗng nghĩa là KHÔNG lọc, không phải tìm chuỗi rỗng', async () => {
    const trang = await mentorRepo.searchMentors({ keyword: '', size: 50 });
    const tatCa = await mentorRepo.searchMentors({ size: 50 });

    expect(trang.content).toHaveLength(tatCa.content.length);
  });

  it('phân trang THẬT: trang đầu chưa phải trang cuối khi fixture nhiều hơn size', async () => {
    const trangDau = await mentorRepo.searchMentors({ size: 2, page: 0 });

    expect(trangDau.content).toHaveLength(2);
    expect(trangDau.last).toBe(false);
    // Đi qua chính hàm mà `useInfiniteQuery` dùng: `last` sai thì danh sách hoặc
    // dừng sớm, hoặc xin mãi một trang không tồn tại.
    expect(getNextPageNumber(trangDau)).toBe(1);

    const trangKe = await mentorRepo.searchMentors({ size: 2, page: 1 });
    expect(trangKe.content[0].identity.mentorUserId).not.toBe(
      trangDau.content[0].identity.mentorUserId,
    );

    const trangCuoi = await mentorRepo.searchMentors({ size: 50, page: 0 });
    expect(trangCuoi.last).toBe(true);
    expect(getNextPageNumber(trangCuoi)).toBeUndefined();
  });

  it('hồ sơ lấy đúng mentor được hỏi, không phải mentor đầu danh sách', async () => {
    const trang = await mentorRepo.searchMentors({ size: 50 });
    const mentorThuHai = trang.content[1];

    const hoSo = await mentorRepo.getMentor(mentorThuHai.identity.mentorUserId);

    expect(hoSo.identity.mentorUserId).toBe(mentorThuHai.identity.mentorUserId);
    expect(hoSo.identity.displayName).toBe(mentorThuHai.identity.displayName);
    expect(hoSo.identity.mentorUserId).not.toBe(trang.content[0].identity.mentorUserId);
  });

  it('mọi mentor trong danh sách đều mở được hồ sơ — không có thẻ nào dẫn vào 404', async () => {
    const trang = await mentorRepo.searchMentors({ size: 50 });

    for (const mentor of trang.content) {
      const hoSo = await mentorRepo.getMentor(mentor.identity.mentorUserId);
      // Detail khai mức hỗ trợ LỒNG trong `supportLevels`, card khai PHẲNG —
      // đọc trượt ở đây ra `undefined` mà không lỗi kiểu nào chặn.
      expect(hoSo.mentoring.supportLevels).toBeDefined();
      expect(hoSo.reputation.ratingState).toBe(mentor.reputation.ratingState);
      expect(Array.isArray(hoSo.services)).toBe(true);
    }
  });

  it('hỏi một mentor không tồn tại thì lỗi 404 đúng mã của backend', async () => {
    // `ErrorView` đọc `status`/`code` để chọn thông điệp; trả 200 với `data: null`
    // ở đây sẽ làm màn hồ sơ trắng trơn thay vì hiện lỗi.
    const err = await mentorRepo.getMentor('khong-ton-tai').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(404);
    expect((err as ApiClientError).code).toBe('SYS_0003');
  });

  it('có mentor mở CẢ dịch vụ miễn phí LẪN dịch vụ đã đóng, đủ cho hai nhánh giao diện', async () => {
    const trang = await mentorRepo.searchMentors({ size: 50 });
    const hoSoCacMentor = await Promise.all(
      trang.content.map((mentor) => mentorRepo.getMentor(mentor.identity.mentorUserId)),
    );
    const moiDichVu = hoSoCacMentor.flatMap((hoSo) => hoSo.services);

    expect(moiDichVu.some((dv) => dv.isFree)).toBe(true);
    expect(moiDichVu.some((dv) => !dv.isFree)).toBe(true);
    expect(moiDichVu.some((dv) => !dv.isActive)).toBe(true);
    // Dịch vụ miễn phí phải để `priceScoin` TRỐNG, không phải 0: `0 S-coins` và
    // "Miễn phí" là hai câu khác nhau, và `priceScoin` là `nullable` thật.
    expect(moiDichVu.filter((dv) => dv.isFree).every((dv) => dv.priceScoin === null)).toBe(true);
    expect(moiDichVu.filter((dv) => !dv.isFree).every((dv) => (dv.priceScoin ?? 0) > 0)).toBe(true);
  });

  it('đánh giá có nhiều hơn một trang, và mốc thời gian là LocalDateTime KHÔNG offset', async () => {
    const trang = await mentorRepo.getMentorReviews('m1', {});

    expect(trang.content.length).toBeGreaterThan(0);
    expect(trang.last).toBe(false);
    expect(getNextPageNumber(trang)).toBe(1);

    for (const review of trang.content) {
      expect(review.rating).toBeGreaterThanOrEqual(1);
      expect(review.rating).toBeLessThanOrEqual(5);
      // `LocalDateTime` lên dây KHÔNG có offset. Fixture viết `...Z` là dựng một
      // backend khác backend thật, và màn hình sẽ được kiểm trên một định dạng nó
      // không bao giờ gặp.
      expect(review.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    }

    // Phải có cả đánh giá KHÔNG nhận xét: người dùng chỉ chấm sao là chuyện thường.
    const tatCa = await mentorRepo.getMentorReviews('m1', { size: 50 });
    expect(tatCa.content.some((review) => review.comment === null)).toBe(true);
    expect(tatCa.content.some((review) => review.comment !== null)).toBe(true);
  });

  it('mentor CHƯA có đánh giá thì danh sách đánh giá rỗng, không phải lỗi', async () => {
    const trang = await mentorRepo.searchMentors({ size: 50 });
    const mentorMoi = trang.content.find(
      (mentor) => mentor.reputation.ratingState === 'NO_REVIEWS',
    );

    expect(mentorMoi).toBeDefined();
    const danhGia = await mentorRepo.getMentorReviews(
      mentorMoi?.identity.mentorUserId ?? '',
      {},
    );

    expect(danhGia.content).toHaveLength(0);
    expect(danhGia.last).toBe(true);
  });

  it('số đánh giá handler trả về khớp reviewCount trên thẻ mentor', async () => {
    // Thẻ hiện con số, màn hồ sơ hiện danh sách. Hai số lệch nhau trông y như
    // một lỗi đồng bộ của backend.
    const trang = await mentorRepo.searchMentors({ size: 50 });

    for (const mentor of trang.content) {
      const danhGia = await mentorRepo.getMentorReviews(mentor.identity.mentorUserId, {
        size: 50,
      });
      expect(danhGia.content).toHaveLength(mentor.reputation.reviewCount);
    }
  });

  it('điểm trung bình trên thẻ đúng bằng trung bình số sao của danh sách đánh giá', async () => {
    // Thẻ nói "4.8" mà 13 dòng đánh giá cộng lại ra 4.2 là một fixture tự nói dối
    // mình. Người xem trên máy không có cách nào biết, và một màn hình đọc trượt
    // sang đúng con số sai vẫn trông như chạy tốt.
    const trang = await mentorRepo.searchMentors({ size: 50 });

    for (const mentor of trang.content) {
      const danhGia = await mentorRepo.getMentorReviews(mentor.identity.mentorUserId, {
        size: 50,
      });

      if (danhGia.content.length === 0) {
        expect(mentor.reputation.ratingAverage).toBeNull();
        continue;
      }

      const tong = danhGia.content.reduce((a, review) => a + review.rating, 0);
      const trungBinh = Number((tong / danhGia.content.length).toFixed(1));
      expect(mentor.reputation.ratingAverage).toBe(trungBinh);
    }
  });
});
