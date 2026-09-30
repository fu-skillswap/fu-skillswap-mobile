import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as banRong from '@/core/dev/mockHandlers.empty';
import * as banThat from '@/core/dev/mockHandlers';

const GOC = join(__dirname, '..', '..');

/**
 * Chế độ mock giữ MSW khỏi bundle phát hành bằng cách cho `metro.config.js` đổi
 * hướng `core/dev/mockHandlers` sang `core/dev/mockHandlers.empty`. Cơ chế đó có
 * hai điểm vỡ âm thầm, và đây là hai test canh đúng chúng.
 *
 * Bối cảnh: bản đầu tiên của chế độ mock dùng `require('msw/native')` bên trong
 * một nhánh `if` và JSDoc khẳng định điều đó giữ MSW khỏi bundle. **Sai.**
 * `require()` chỉ hoãn việc THỰC THI; Metro phân tích tĩnh và vẫn đưa module vào
 * graph. Đo trên bundle thật: 4.1MB → 5.0MB (+26%), và `grep` trên `.hbc` tìm
 * thấy cả `setupServer` lẫn fixture `HE180001`.
 */
describe('cơ chế loại mock khỏi bundle phát hành', () => {
  it('bản rỗng có ĐỦ mọi export của bản thật', () => {
    // Thiếu một export thì bản build phát hành vỡ lúc chạy với "undefined is not
    // a function", mà `npm test` và `typecheck` đều không thấy gì — cả hai luôn
    // dùng bản thật. Đây là chỗ duy nhất phát hiện được ở tầng test.
    const thieu = Object.keys(banThat).filter((ten) => !(ten in banRong));

    expect(thieu).toEqual([]);
  });

  it('`mockServer.ts` KHÔNG được import msw trực tiếp', () => {
    // Bất biến "một seam duy nhất": MSW chỉ được import trong `mockHandlers.ts`,
    // file duy nhất mà Metro đổi hướng. Thêm một điểm import thứ hai ở bất cứ đâu
    // là thêm một chỗ phải nhớ đổi hướng — và chỗ bị quên sẽ lặng lẽ kéo MSW vào
    // bundle phát hành trở lại, không ai biết cho tới lúc đo kích thước bundle.
    const nguon = readFileSync(join(GOC, 'core', 'dev', 'mockServer.ts'), 'utf8');

    expect(nguon).not.toMatch(/from\s+'msw/);
    expect(nguon).not.toMatch(/require\(\s*'msw/);
  });

  it('bản rỗng KHÔNG import gì ở tầng giá trị', () => {
    // `import type` bị xoá lúc biên dịch nên vô hại; một `import` thường thì
    // không, và nó làm bản rỗng mất hết ý nghĩa.
    const nguon = readFileSync(join(GOC, 'core', 'dev', 'mockHandlers.empty.ts'), 'utf8');
    const dongImport = nguon
      .split('\n')
      .filter((dong) => /^\s*import\s/.test(dong) && !/^\s*import\s+type\s/.test(dong));

    expect(dongImport).toEqual([]);
  });

  it('`metro.config.js` có đổi hướng, và mặc định là LOẠI BỎ mock', () => {
    // Hướng an toàn phải nằm ở phía mặc định: quên đặt biến môi trường thì mất
    // chế độ mock, chứ không phải lỡ ship MSW.
    const nguon = readFileSync(join(GOC, 'metro.config.js'), 'utf8');

    expect(nguon).toContain('mockHandlers.empty');
    expect(nguon).toContain("EXPO_PUBLIC_MOCK_MODE === '1'");
  });
});
