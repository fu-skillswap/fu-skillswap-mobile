import { useRouter } from 'expo-router';

import { MessagesScreen } from '@/features/chat';

/**
 * Hộp thư NGOÀI thanh tab, cho chế độ Mentor.
 *
 * Thanh tab Mentor không có mục Tin nhắn (`core/config/tabs.ts`), nhưng mentor
 * vẫn phải trả lời mentee. Đẩy họ sang `/(tabs)/messages` thì họ đứng trên một
 * tab bị ẩn khỏi thanh — không mục nào sáng. Route này dựng cùng màn hình trong
 * stack của nhánh `/chat` (có gate ở `_layout`), kèm nút quay lại.
 */
export default function ChatInboxRoute() {
  const router = useRouter();
  return (
    <MessagesScreen
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
    />
  );
}
