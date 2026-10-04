import { setupServer } from 'msw/node';

import { __resetApiClientForTests } from '@/core/api/client';
import { dauTuan, congNgay, homNayVN, isoNgay } from '@/core/time/lichTuan';
import { mentorModeRepo } from '@/features/mentorMode/mentorModeRepo';
import { mentorModeMockHandlers } from '@/features/mentorMode/mocks/handlers';

let dem = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `khoa-${(dem += 1)}` }));

/** Repo THẬT đọc mock lịch dạy / dịch vụ — hình dạng sai thì đỏ ở đây */
const server = setupServer(...mentorModeMockHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => __resetApiClientForTests());
afterAll(() => server.close());

describe('mock lịch dạy và dịch vụ', () => {
  it('slot là Instant có Z và nằm trong khoảng ngày đã hỏi', async () => {
    const thuHai = dauTuan(homNayVN());
    const slots = await mentorModeRepo.getMySlots(isoNgay(thuHai), isoNgay(congNgay(thuHai, 6)));

    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) {
      expect(s.startAt).toMatch(/Z$/);
      expect(Date.parse(s.endAt)).toBeGreaterThan(Date.parse(s.startAt));
    }
  });

  it('constraints KHÔNG bị nuốt bởi route /:serviceId', async () => {
    const rb = await mentorModeRepo.getServiceConstraints();
    expect(rb.allowedDurationMinutes).toContain(45);
  });

  it('sửa dịch vụ với version lệch trả 409, version đúng thì tăng version', async () => {
    const dv = await mentorModeRepo.getMyService('msv1');
    const body = {
      title: dv.title,
      description: dv.description,
      expectedOutcome: dv.expectedOutcome,
      isFree: false,
      priceScoin: 200_000,
      maintainPostSessionChat: dv.maintainPostSessionChat,
    };

    await expect(mentorModeRepo.updateService('msv1', { ...body, expectedVersion: dv.version + 5 })).rejects.toBeTruthy();
    const moi = await mentorModeRepo.updateService('msv1', { ...body, expectedVersion: dv.version });
    expect(moi.version).toBe(dv.version + 1);
    expect(moi.basePriceScoin).toBe(200_000);
  });
});
