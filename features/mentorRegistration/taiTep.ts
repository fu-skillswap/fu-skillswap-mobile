/**
 * @file taiTep.ts
 * @description Đẩy một tệp trên máy lên URL tải lên mà backend cấp (S3/R2
 * presigned `PUT`). Tách riêng để test thay được: Jest không đọc được `uri`
 * `file://` của điện thoại.
 *
 * KHÔNG đi qua `apiClient`: URL tải lên là của kho lưu trữ, không phải của
 * backend — gắn token đăng nhập vào đó là để lộ token cho bên thứ ba.
 */

export class LoiTaiTep extends Error {
  constructor(public readonly status: number) {
    super(`Tải tệp lên thất bại (HTTP ${status})`);
    this.name = 'LoiTaiTep';
  }
}

export async function taiTepLenUrl(
  uploadUrl: string,
  uri: string,
  contentType: string,
  headerBatBuoc: Record<string, string> | null,
): Promise<void> {
  // `fetch(uri)` của React Native đọc được `file://` / `content://` thành Blob.
  const noiDung = await (await fetch(uri)).blob();
  const phanHoi = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, ...(headerBatBuoc ?? {}) },
    body: noiDung,
  });
  if (!phanHoi.ok) {
    throw new LoiTaiTep(phanHoi.status);
  }
}
