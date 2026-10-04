import { setupServer } from 'msw/node';

import { __resetApiClientForTests } from '@/core/api/client';
import { MOCK_USER } from '@/core/auth/mocks/handlers';
import { docLocalDateTime } from '@/core/time/localDateTime';
import { docOffsetDateTime } from '@/core/time/offsetDateTime';
import { mentorModeRepo } from '@/features/mentorMode/mentorModeRepo';
import { mentorModeMockHandlers } from '@/features/mentorMode/mocks/handlers';
import { moTaTrangThaiMentor } from '@/features/mentorMode/mentorProfileDisplay';

/**
 * Cho REPO THẬT đọc fixture, không assert vào fixture.
 *
 * Một fixture bịa sai hình dạng vẫn khớp mọi assertion viết tay so nó với chính
 * nó. Chỉ khi `mentorModeRepo` — đúng hàm màn hình gọi — đọc được nó thì mới
 * biết hình dạng đúng.
 */
const server = setupServer(...mentorModeMockHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => __resetApiClientForTests());
afterAll(() => server.close());

describe('handler mock của chế độ Mentor', () => {
  it('repo thật đọc được hồ sơ, và hồ sơ gắn đúng người dùng mock', async () => {
    const hoSo = await mentorModeRepo.getMyMentorProfile();

    // Lệch id thì màn `MentorMore` dẫn "Xem hồ sơ công khai" sang một mentor
    // khác, và trong chế độ mock thì không có gì báo cho biết.
    expect(hoSo.userId).toBe(MOCK_USER.publicId);
    expect(hoSo.displayName).toBe(MOCK_USER.fullName);
    expect(hoSo.exists).toBe(true);
  });

  it('hồ sơ ở trạng thái ACTIVE để nhánh "Xem hồ sơ công khai" xem được trên máy', async () => {
    const hoSo = await mentorModeRepo.getMyMentorProfile();

    expect(moTaTrangThaiMentor(hoSo.mentorStatus).xemDuocHoSoCongKhai).toBe(true);
  });

  it('mốc thời gian của hồ sơ là LocalDateTime — repo thật đọc được, KHÔNG có offset', async () => {
    // Viết chuỗi có offset ở đây là dựng một backend khác backend thật, và
    // `docLocalDateTime()` sẽ trả `null` cho mọi mốc.
    const hoSo = await mentorModeRepo.getMyMentorProfile();

    expect(docLocalDateTime(hoSo.verifiedAt)).not.toBeNull();
    expect(docLocalDateTime(hoSo.createdAt)).not.toBeNull();
    expect(hoSo.verifiedAt).not.toMatch(/(Z|[+-]\d{2}:\d{2})$/);
  });

  it('điểm đánh giá và số lượt là số, đọc được bằng toFixed', async () => {
    // `BigDecimal` của Java lên dây thành số JSON. Một fixture viết `"4.8"`
    // (chuỗi) vẫn hiện ra đúng trên màn hình nhưng `toFixed()` sẽ ném.
    const hoSo = await mentorModeRepo.getMyMentorProfile();

    expect(typeof hoSo.ratingAverage).toBe('number');
    expect(typeof hoSo.reviewCount).toBe('number');
  });

  it('repo thật đọc được ví, và số dư là số không-null', async () => {
    // `availableScoin` khai `Integer` nhưng mapper gán từ `int` nguyên thuỷ nên
    // không bao giờ null — fixture phải giữ đúng điều đó.
    const vi = await mentorModeRepo.getMyMentorWallet();

    expect(typeof vi.availableScoin).toBe('number');
    expect(vi.recentTransactions.length).toBeGreaterThan(0);
  });

  it('mốc giao dịch ví là OffsetDateTime — CÓ offset, đọc bằng helper của nhánh kia', async () => {
    // Hai khuôn nằm cạnh nhau trong cùng một feature; đây là chỗ dễ "chuẩn hoá"
    // sai nhất.
    const vi = await mentorModeRepo.getMyMentorWallet();

    for (const tx of vi.recentTransactions) {
      expect(docOffsetDateTime(tx.createdAt)).not.toBeNull();
      // Và helper của hồ sơ phải TỪ CHỐI nó — bằng chứng hai khuôn thật sự khác.
      expect(docLocalDateTime(tx.createdAt)).toBeNull();
    }
  });

  it('giao dịch ví mentor LUÔN có originType null', async () => {
    // `WalletQueryService.toSettlementTransactionResponse()` gán cứng `null`:
    // trường đó chỉ có nghĩa với credit của mentee.
    const vi = await mentorModeRepo.getMyMentorWallet();

    expect(vi.recentTransactions.every((tx) => tx.originType === null)).toBe(true);
  });

  it('có cả giao dịch cộng và giao dịch trừ', async () => {
    // Nhánh số âm của `phanCachNghin()` không phải giả thuyết: phí nền tảng và
    // việc giữ tiền cho yêu cầu rút đều là `balanceEffectScoin` âm.
    const vi = await mentorModeRepo.getMyMentorWallet();
    const hieuUng = vi.recentTransactions.map((tx) => tx.balanceEffectScoin ?? 0);

    expect(hieuUng.some((n) => n > 0)).toBe(true);
    expect(hieuUng.some((n) => n < 0)).toBe(true);
  });
});
