/**
 * @file app-route-tree.test.ts
 * @description Canh giữ thư mục `app/`: mọi file trong đó đều được expo-router
 * đăng ký thành một route.
 *
 * Bối cảnh: đã từng có ba file test được đặt colocate trong `app/`, và hậu quả
 * không hiện ra ở chỗ dễ thấy:
 * - `app/(auth)/login.test.tsx` trở thành route `/(auth)/login.test` — tức file
 *   test sẽ ship như một màn hình điều hướng được trong app thật.
 * - `app/(tabs)/_layout.test.tsx` làm hỏng phân giải layout của cả nhóm
 *   `(tabs)`, khiến toàn bộ nhóm này BIẾN MẤT khỏi `.expo/types/router.d.ts`,
 *   và `<Redirect href="/(tabs)" />` báo lỗi TS2322.
 *
 * Cả hai chỉ lộ ra khi sinh lại file type; lúc đó typecheck đang xanh vì file
 * type cũ được viết tay. Test này biến điều đó thành lỗi đỏ ngay lập tức.
 *
 * Test cho màn hình trong `app/` đặt ở `__tests__/app/...` (đúng như file này).
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP_DIR = join(__dirname, '..', 'app');

/** Liệt kê đệ quy mọi file trong `app/`, trả về đường dẫn tương đối so với `app/` */
function listFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    const relative = prefix ? `${prefix}/${entry}` : entry;
    return statSync(full).isDirectory() ? listFiles(full, relative) : [relative];
  });
}

describe('cây route trong app/', () => {
  it('không chứa file test nào — mọi file trong app/ đều thành route của expo-router', () => {
    const testFiles = listFiles(APP_DIR).filter((file) => /\.(test|spec)\.[jt]sx?$/.test(file));

    expect(testFiles).toEqual([]);
  });
});
