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
 * hiện rồi tắt ngay.
 *
 * QUAN TRỌNG — vì sao không chỉ kiểm "file có tồn tại không":
 *
 * Bản đầu `exit(0)` ngay khi thấy file. Hậu quả lộ ra lúc đổi tên ba route
 * (`booking→mentors`, `schedule→bookings`, `assistant→messages`) ngày
 * 04/10/2026: file cũ ở lại, và vì nó là một UNION chứa CẢ tên cũ lẫn tên mới
 * nên `tsc` xanh trên cả hai — typecheck nói dối về việc route cũ đã hết. Nó
 * còn tích luỹ rác (`/../core/ui/IconButton`) do một Metro treo từ phiên khác
 * ghi đè bằng module graph của nó.
 *
 * Nên script lưu kèm DANH SÁCH FILE ROUTE lúc sinh (`route-files.json`) và sinh
 * lại khi danh sách đổi. Chỉ so danh sách file chứ không so nội dung: thêm/xoá/
 * đổi tên route là đúng lúc union phải đổi, còn sửa ruột một màn thì không.
 * Danh sách khớp thì vẫn thoát ngay, nên `npm run typecheck` hằng ngày không
 * chậm đi.
 */

const { spawn, execFileSync } = require('node:child_process');
const {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} = require('node:fs');
const { dirname, join } = require('node:path');

const projectRoot = join(__dirname, '..');
const routerTypes = join(projectRoot, '.expo', 'types', 'router.d.ts');
const appDir = join(projectRoot, 'app');
/** Danh sach file route luc router.d.ts duoc sinh - de biet khi nao phai sinh lai */
const routeStamp = join(projectRoot, '.expo', 'types', 'route-files.json');
/** Port rieng cho Metro cua script — tranh dung do voi dev server o 8081 */
const PORT_RIENG = 8099;
const TIMEOUT_MS = 120_000;
const POLL_MS = 500;

/** Moi file trong `app/`, sap xep - `app/` chi chua route (xem app-route-tree.test.ts) */
function listRouteFiles(dir, prefix = '') {
  return readdirSync(dir)
    .flatMap((entry) => {
      const full = join(dir, entry);
      const relative = prefix ? `${prefix}/${entry}` : entry;
      return statSync(full).isDirectory() ? listRouteFiles(full, relative) : [relative];
    })
    .sort();
}

const routeFiles = listRouteFiles(appDir);

/** File type con dung khi no ton tai VA cay route khong doi tu luc sinh */
function conDung() {
  if (!existsSync(routerTypes) || !existsSync(routeStamp)) {
    return false;
  }
  try {
    return JSON.stringify(JSON.parse(readFileSync(routeStamp, 'utf8'))) === JSON.stringify(routeFiles);
  } catch {
    return false;
  }
}

if (conDung()) {
  process.exit(0);
}

// Xoa file cu TRUOC khi sinh lai: neu khong, vong cho ben duoi thay ngay file
// cu va ket luan "da sinh xong" ma chua co gi moi duoc ghi.
if (existsSync(routerTypes)) {
  rmSync(routerTypes, { force: true });
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
  // Port RIENG, khong phai 8081: dev server cua nguoi dung thuong giu 8081, va
  // khi do Metro cua script khong bat len duoc ("Input is required, but
  // 'npx expo' is in non-interactive mode") nen khong sinh duoc type. Te hon
  // nua, dev server dang chay se tu ghi de `router.d.ts` bang module graph cua
  // no — da xay ra hai lan ngay 04/10/2026, mot lan lam bien mat
  // `/mentor/[mentorUserId]` va them `/../core/ui/IconButton` nhu mot route.
  const child = spawn(
    process.execPath,
    [require.resolve('expo/bin/cli'), 'start', '--port', String(PORT_RIENG)],
    {
      cwd: projectRoot,
      stdio: 'ignore',
    },
  );

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
    mkdirSync(dirname(routeStamp), { recursive: true });
    writeFileSync(routeStamp, JSON.stringify(routeFiles, null, 2));
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
