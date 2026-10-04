import { useLocalSearchParams } from 'expo-router';

import { ComposeScreen } from '@/features/forum';

export default function ComposeRoute() {
  // `useLocalSearchParams<T>` chỉ nhận `T extends Record<string, string | string[]>`
  // (xem node_modules/expo-router/build/typed-routes/types.d.ts), nên KHÔNG khai
  // được `{ postId?: string }` như plan viết — `string | undefined` không khớp
  // ràng buộc. Route này là route tĩnh nên typed-routes cũng không sinh tham số
  // nào cho nó; `postId` chỉ có mặt khi mở từ nút "Sửa bài", vì vậy phải tự quy
  // về `undefined` thay vì tin vào kiểu.
  const params = useLocalSearchParams<{ postId: string }>();
  const postId = params.postId || undefined;

  return <ComposeScreen postId={postId} />;
}
