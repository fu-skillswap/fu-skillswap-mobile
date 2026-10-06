import { Redirect } from 'expo-router';

import { useRoleMode } from '@/core/roleMode/RoleModeProvider';
import { ForumFeedScreen } from '@/features/forum';

/**
 * Route gốc của nhóm `(tabs)` — mọi lối vào app (`app/index.tsx`, màn đăng
 * nhập, màn "không hỗ trợ", và mọi chỗ `replace('/(tabs)')` khi stack rỗng) đều
 * rơi vào đây.
 *
 * Ở chế độ Mentor, Bảng tin bị ẩn khỏi thanh tab (`href: null`), nên nếu cứ vẽ
 * nó thì mentor mở app sẽ đứng trên Bảng tin của mentee, không mục nào trên thanh
 * tab được chọn. Chuyển hướng sang Tổng quan ở ĐÚNG một chỗ này thay vì sửa từng
 * lối vào. `dangTai` không cần chờ ở đây: `app/(tabs)/_layout.tsx` không vẽ màn
 * con nào khi chế độ chưa đọc xong.
 */
export default function ForumTab() {
  const { cheDo } = useRoleMode();
  if (cheDo === 'MENTOR') {
    return <Redirect href="/(tabs)/mentor-dashboard" />;
  }
  return <ForumFeedScreen />;
}
