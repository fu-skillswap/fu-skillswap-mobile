/**
 * @file ensure-router-types.js
 * @description Bảo đảm `.expo/types/router.d.ts` tồn tại trước khi chạy `tsc`.
 *
 * expo-router bật `experiments.typedRoutes`, nên mọi `<Redirect href="...">` và
 * `router.push("...")` được kiểm kiểu theo một union route sinh tự động. File
 * sinh ra nằm trong `.expo/`, mà `.expo/` bị gitignore — nghĩa là trên một bản
 * clone sạch (hoặc trên CI), `npm run typecheck` sẽ fail với TS2322 ở các route
 * literal, dù code hoàn toàn đúng. Người mới vào dự án sẽ tưởng repo hỏng.
 *
 * Expo SDK 57 không có lệnh typegen độc lập (`npx expo --help` chỉ liệt kê
 * start, export, run:*, prebuild, install, customize, config, serve, login...).
 * Đã thử `expo export`: nó bundle xong nhưng KHÔNG sinh `router.d.ts`. Chỉ dev
 * server mới sinh, nên script này bật Metro lên, chờ đúng tới lúc file xuất
 * hiện rồi tắt ngay. Chỉ chạy khi file thật sự thiếu, để `npm run typecheck`
 * hằng ngày vẫn chạy tức thì.
 */

const { spawn, execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const projectRoot = join(__dirname, '..');
const routerTypes = join(projectRoot, '.expo', 'types', 'router.d.ts');
const TIMEOUT_MS = 120_000;
const POLL_MS = 500;

if (existsSync(routerTypes)) {
  process.exit(0);
}

console.log(
  'Chưa có .expo/types/router.d.ts (file sinh tự động, không commit).\n' +
    'Đang bật Metro một lát để sinh type cho typed routes — lần sau sẽ bỏ qua bước này.',
);

/** Tắt cả cây tiến trình: Metro sinh tiến trình con, kill mình nó là còn sót */
function killTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      return;
    } catch {
      // rơi xuống kill() thường bên dưới
    }
  }
  child.kill('SIGTERM');
}

async function main() {
  // Gọi thẳng CLI của expo bằng chính node đang chạy script này, không qua `npx`:
  // trong Git Bash trên Windows, PATH là dạng POSIX (`/c/Program Files/nodejs`)
  // nên Node không tìm thấy `npx.cmd` và lệnh sẽ thất bại một cách khó hiểu.
  const child = spawn(process.execPath, [require.resolve('expo/bin/cli'), 'start'], {
    cwd: projectRoot,
    stdio: 'ignore',
  });

  const startedAt = Date.now();
  try {
    while (Date.now() - startedAt < TIMEOUT_MS) {
      if (existsSync(routerTypes)) {
        return true;
      }
      if (child.exitCode !== null) {
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
    return false;
  } finally {
    killTree(child);
  }
}

main().then((ok) => {
  if (ok) {
    console.log('Đã sinh xong .expo/types/router.d.ts.');
    process.exit(0);
  }
  console.error(
    '\nKhông sinh được .expo/types/router.d.ts. Hãy chạy thủ công một lần rồi thử lại:\n' +
      '  npx expo start --clear   (đợi Metro khởi động xong rồi tắt là đủ)\n' +
      'Nếu vẫn không có, kiểm tra `experiments.typedRoutes` trong app.json.',
  );
  process.exit(1);
});
