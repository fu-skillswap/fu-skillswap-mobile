import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests, setAccessToken } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { resetEnvCache } from '@/core/config/env';
import { HangKoko, KokoChatScreen, TheKoko } from '@/features/koko';
import { donHangDoiDanhSach } from '@/test-utils/nhuongNhip';

const AI = 'https://ai.skillswap.asia';

jest.mock('expo-router', () => {
  const back = jest.fn();
  const replace = jest.fn();
  const push = jest.fn();
  const canGoBack = jest.fn(() => true);
  return {
    useRouter: () => ({ back, replace, push, canGoBack }),
    __mockRouter: { back, replace, push, canGoBack },
  };
});
jest.mock('@/core/net/onlineStatus', () => ({ useIsOffline: () => false }));

let mockCheDo: 'MENTEE' | 'MENTOR' = 'MENTEE';
jest.mock('@/core/roleMode/RoleModeProvider', () => ({
  useRoleMode: () => ({ cheDo: mockCheDo, cheDoKhaDung: [mockCheDo], chuyenCheDo: jest.fn() }),
}));
jest.mock('@/core/auth/AuthProvider', () => ({
  useAuth: () => ({ status: 'authenticated', user: { fullName: 'Nguyễn Thu Hà' } }),
}));

const { __mockRouter: mockRouter } = jest.requireMock<{
  __mockRouter: { push: jest.Mock; back: jest.Mock };
}>('expo-router');

type ThanGui = { messages: { role: string; content: string }[]; stream: boolean };

const server = setupServer();
let queryClient: QueryClient;
const AI_GOC = process.env.EXPO_PUBLIC_AI_URL;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  process.env.EXPO_PUBLIC_AI_URL = AI;
  resetEnvCache();
  __resetApiClientForTests();
  setAccessToken('at-1');
  queryClient = createQueryClient();
  mockCheDo = 'MENTEE';
  mockRouter.push.mockClear();
});
afterEach(() => {
  __resetQueryClientForTests(queryClient);
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => {
  server.close();
  process.env.EXPO_PUBLIC_AI_URL = AI_GOC;
  resetEnvCache();
});

function boc(ui: React.ReactElement) {
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('KokoChatScreen', () => {
  it('chưa hỏi gì: chào bằng tên (bỏ họ) và có bốn câu gợi ý', async () => {
    await boc(<KokoChatScreen />);

    expect(screen.getByText('Chào Thu Hà, mình là Koko!')).toBeTruthy();
    for (const k of ['mentor', 'dat-lich', 'scoin', 'ky-nang']) {
      expect(screen.getByTestId(`goi-y-${k}`)).toBeTruthy();
    }
    // Chưa có gì để xoá.
    expect(screen.getByTestId('nut-tro-chuyen-moi').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('bấm câu gợi ý: gửi JSON một lần kèm token phiên, hiện câu trả lời đã làm sạch và lối sang tab Mentor', async () => {
    let than: ThanGui | null = null;
    let token: string | null = null;
    server.use(
      http.post(`${AI}/v1/chat`, async ({ request }) => {
        than = (await request.json()) as ThanGui;
        token = request.headers.get('Authorization');
        return HttpResponse.json({
          content: 'Bạn xem thử **Trần Minh Quân** nhé.',
          requestId: 'r1',
          sourcesUsed: ['search_mentors'],
        });
      }),
    );

    await boc(<KokoChatScreen />);
    await fireEvent.press(screen.getByTestId('goi-y-mentor'));

    await waitFor(() => expect(screen.getByText('Bạn xem thử Trần Minh Quân nhé.')).toBeTruthy());
    expect(than).toEqual({ messages: [{ role: 'user', content: 'Tìm mentor phù hợp với mục tiêu của mình' }], stream: false });
    expect(token).toBe('Bearer at-1');
    expect(screen.getByText('Đã tra: Danh sách mentor')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('loi-koko-mentor'));
    expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/mentors');
    await donHangDoiDanhSach();
  });

  it('chế độ Mentor: không có lối sang tab Mentor (tab đó không tồn tại ở chế độ này)', async () => {
    mockCheDo = 'MENTOR';
    server.use(
      http.post(`${AI}/v1/chat`, () =>
        HttpResponse.json({ content: 'Có vài mentor.', requestId: 'r1', sourcesUsed: ['search_mentors'] }),
      ),
    );

    await boc(<KokoChatScreen />);
    await fireEvent.press(screen.getByTestId('goi-y-mentor'));

    await waitFor(() => expect(screen.getByText('Có vài mentor.')).toBeTruthy());
    expect(screen.queryByTestId('loi-koko-mentor')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('lượt hai gửi kèm lịch sử; gửi hỏng hiện đúng câu của service và "Gửi lại" gửi đúng lịch sử', async () => {
    const cacThan: ThanGui[] = [];
    let lan = 0;
    server.use(
      http.post(`${AI}/v1/chat`, async ({ request }) => {
        cacThan.push((await request.json()) as ThanGui);
        lan += 1;
        if (lan === 2) {
          return HttpResponse.json({ detail: 'Bạn đã hỏi khá nhiều trong một giờ qua, thử lại sau nhé.' }, { status: 429 });
        }
        return HttpResponse.json({ content: `Trả lời ${lan}`, requestId: `r${lan}`, sourcesUsed: [] });
      }),
    );

    await boc(<KokoChatScreen />);
    await fireEvent.changeText(screen.getByTestId('o-nhap-koko'), '  Câu một  ');
    await fireEvent.press(screen.getByTestId('nut-gui-koko'));
    await waitFor(() => expect(screen.getByText('Trả lời 1')).toBeTruthy());
    // Ô nhập được xoá sau khi gửi.
    expect(screen.getByTestId('o-nhap-koko').props.value).toBe('');

    await fireEvent.changeText(screen.getByTestId('o-nhap-koko'), 'Câu hai');
    await fireEvent.press(screen.getByTestId('nut-gui-koko'));
    await waitFor(() =>
      expect(screen.getByTestId('loi-gui-koko')).toHaveTextContent('Bạn đã hỏi khá nhiều trong một giờ qua, thử lại sau nhé.'),
    );

    await fireEvent.press(screen.getByTestId('nut-gui-lai-koko'));
    await waitFor(() => expect(screen.getByText('Trả lời 3')).toBeTruthy());
    expect(screen.queryByTestId('loi-gui-koko')).toBeNull();

    const lichSu = [
      { role: 'user', content: 'Câu một' },
      { role: 'assistant', content: 'Trả lời 1' },
      { role: 'user', content: 'Câu hai' },
    ];
    expect(cacThan[1].messages).toEqual(lichSu);
    expect(cacThan[2].messages).toEqual(lichSu);
    await donHangDoiDanhSach();
  });

  it('"Cuộc trò chuyện mới" xoá hội thoại, quay về lời chào', async () => {
    server.use(
      http.post(`${AI}/v1/chat`, () => HttpResponse.json({ content: 'Chào bạn!', requestId: 'r1', sourcesUsed: [] })),
    );

    await boc(<KokoChatScreen />);
    await fireEvent.press(screen.getByTestId('goi-y-scoin'));
    await waitFor(() => expect(screen.getByText('Chào bạn!')).toBeTruthy());
    // Lượt gửi khép lại hẳn thì nút mới bấm được (đang chờ Koko thì bị khoá):
    // nhường một nhịp trong act() cho mutation chốt trạng thái.
    await donHangDoiDanhSach();
    expect(screen.getByTestId('nut-tro-chuyen-moi').props.accessibilityState).toMatchObject({ disabled: false });

    await fireEvent.press(screen.getByTestId('nut-tro-chuyen-moi'));
    await waitFor(() => expect(screen.queryByText('Chào bạn!')).toBeNull());
    expect(screen.getByTestId('man-chao-koko')).toBeTruthy();
    await donHangDoiDanhSach();
  });

  it('rời màn rồi quay lại vẫn thấy cuộc trò chuyện đang dở', async () => {
    server.use(
      http.post(`${AI}/v1/chat`, () => HttpResponse.json({ content: 'Còn đây.', requestId: 'r1', sourcesUsed: [] })),
    );

    const lan1 = await boc(<KokoChatScreen />);
    await fireEvent.press(screen.getByTestId('goi-y-scoin'));
    await waitFor(() => expect(screen.getByText('Còn đây.')).toBeTruthy());
    await lan1.unmount();

    await boc(<KokoChatScreen />);
    expect(screen.getByText('Còn đây.')).toBeTruthy();
    await donHangDoiDanhSach();
  });

  it('bản build không có AI: mở bằng đường dẫn thì báo chưa sẵn sàng, không có ô nhập', async () => {
    process.env.EXPO_PUBLIC_AI_URL = '';
    resetEnvCache();

    await boc(<KokoChatScreen />);

    expect(screen.getByText('Koko chưa sẵn sàng')).toBeTruthy();
    expect(screen.queryByTestId('o-nhap-koko')).toBeNull();
  });
});

describe('Lối vào Koko', () => {
  it('card Bảng tin và hàng ghim hộp thư mở /koko', async () => {
    await boc(
      <>
        <TheKoko />
        <HangKoko />
      </>,
    );

    await fireEvent.press(screen.getByTestId('the-koko'));
    await fireEvent.press(screen.getByTestId('hang-koko'));
    expect(mockRouter.push).toHaveBeenNthCalledWith(1, '/koko');
    expect(mockRouter.push).toHaveBeenNthCalledWith(2, '/koko');
  });

  it('bản build không có AI thì cả hai tự ẩn — không dựng nút chết', async () => {
    process.env.EXPO_PUBLIC_AI_URL = '';
    resetEnvCache();

    await boc(
      <>
        <TheKoko />
        <HangKoko />
      </>,
    );

    expect(screen.queryByTestId('the-koko')).toBeNull();
    expect(screen.queryByTestId('hang-koko')).toBeNull();
  });
});
