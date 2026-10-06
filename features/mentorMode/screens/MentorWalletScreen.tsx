/**
 * @file MentorWalletScreen.tsx
 * @description Tab "Ví" của mentor, theo `MentorWallet.dc.html`: thẻ navy "SỐ DƯ
 * KHẢ DỤNG" và danh sách giao dịch gần đây trong một thẻ trắng.
 *
 * ## Chỉ xem — quyết định của chủ sản phẩm (04/10/2026)
 *
 * Bản mobile KHÔNG nạp và KHÔNG rút tiền. Vì vậy so với thiết kế, màn này bỏ:
 * nút "Rút tiền", hàng "Tài khoản nhận tiền" và tab "Yêu cầu rút". Thẻ số dư nói
 * thẳng rằng rút tiền làm trên web.
 *
 * Dòng "Đang tạm giữ …" của thiết kế cũng bỏ: `MentorWalletResponse` chỉ có
 * `availableScoin`, không có số tạm giữ, và tự cộng các dòng `HOLD` trong 15 giao
 * dịch gần nhất sẽ ra một con số sai.
 */

import { ActivityIndicator, FlatList, Text, View } from 'react-native';

import { trangThaiTai } from '@/core/api/queryState';
import { phanCachNghin } from '@/core/format/soLuong';
import { dinhDangNgayCoOffset, nhanNgayNgan } from '@/core/time/offsetDateTime';
import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { ScreenHeader } from '@/core/ui/ScreenHeader';
import { colors, fonts, radius } from '@/core/ui/theme';
import { useMyMentorWallet } from '@/features/mentorMode/hooks/useMentorModeQueries';
import type { LedgerEntryType, WalletTransactionResponse } from '@/features/mentorMode/types';

/**
 * Nhãn giao dịch của ví SETTLEMENT mentor, theo nghĩa thật của từng loại trong
 * `SettlementService.java` (ví mentor chỉ nhận `SettlementEntryType`: RELEASE,
 * HOLD, PAID_OUT, COMMISSION, ADJUSTMENT, VOID — mapper đổi tên sang
 * `LedgerEntryType` cùng tên):
 *
 * - `RELEASE` là TIỀN VÀO: giải ngân buổi học đã hoàn thành (nguồn `BOOKING`),
 *   khoá học (`COURSE_ENROLLMENT`) hay phần chia sau xử lý khiếu nại. Bản web gọi
 *   nó "Hoàn giữ" — sai nghĩa với mentor. Nhãn chi tiết theo nguồn ở `nhanGiaoDich`.
 * - `HOLD`: giữ tiền cho một yêu cầu rút (số dư đã trừ).
 * - `VOID`: yêu cầu rút bị huỷ, tiền giữ trả lại số dư.
 * - `PAID_OUT`: tiền đã chuyển về ngân hàng. `balanceEffectScoin = 0` (số dư đã
 *   trừ ở bước HOLD), nên số tiền phải lấy từ `amountScoin`.
 * - `COMMISSION` chỉ ghi vào tài khoản NỀN TẢNG, không xuất hiện ở ví mentor.
 * - `ISSUE`/`RESERVE`/`CONSUME`/`REFUND` là loại của ví credit mentee — giữ nhãn
 *   để kiểu đủ, không bao giờ tới đây.
 */
export const NHAN_GIAO_DICH: Record<LedgerEntryType, string> = {
  ISSUE: 'Cộng S-coins',
  RESERVE: 'Tạm giữ',
  CONSUME: 'Đã sử dụng',
  RELEASE: 'Thu nhập',
  REFUND: 'Hoàn tiền',
  ADJUSTMENT: 'Điều chỉnh',
  HOLD: 'Tạm giữ để rút tiền',
  PAID_OUT: 'Đã rút về ngân hàng',
  COMMISSION: 'Phí nền tảng',
  VOID: 'Huỷ yêu cầu rút, hoàn số dư',
};

/** Nhãn một dòng: `RELEASE` nói rõ thu nhập từ đâu */
export function nhanGiaoDich(gd: WalletTransactionResponse): string {
  if (!gd.entryType) {
    return 'Giao dịch';
  }
  if (gd.entryType === 'RELEASE') {
    if (gd.sourceType === 'BOOKING') return 'Thu nhập buổi học';
    if (gd.sourceType === 'COURSE_ENROLLMENT') return 'Thu nhập khoá học';
    if (gd.sourceType === 'BOOKING_ISSUE_RESOLUTION') return 'Thu nhập sau xử lý khiếu nại';
  }
  return NHAN_GIAO_DICH[gd.entryType];
}

/** Tông của ô biểu tượng theo chiều tiền */
type Tong = 'vao' | 'ra' | 'giu';

/**
 * Chiều tiền, quyết định theo LOẠI trước rồi mới tới dấu của `balanceEffectScoin`:
 * `PAID_OUT` có ảnh hưởng 0 nhưng là tiền RA, đọc theo dấu sẽ thành "+ 0".
 */
export function tongGiaoDich(gd: WalletTransactionResponse): Tong {
  switch (gd.entryType) {
    case 'HOLD':
    case 'RESERVE':
      return 'giu';
    case 'PAID_OUT':
    case 'CONSUME':
      return 'ra';
    case 'RELEASE':
    case 'VOID':
    case 'ISSUE':
    case 'REFUND':
      return 'vao';
    default: {
      const anhHuong = gd.balanceEffectScoin ?? gd.amountScoin ?? 0;
      return anhHuong >= 0 ? 'vao' : 'ra';
    }
  }
}

/**
 * Độ lớn số tiền hiển thị. `PAID_OUT` (và mọi loại có ảnh hưởng 0) lấy
 * `amountScoin` — số tiền thật của giao dịch.
 */
export function soTienGiaoDich(gd: WalletTransactionResponse): number {
  const anhHuong = gd.balanceEffectScoin ?? 0;
  return Math.abs(gd.entryType === 'PAID_OUT' || anhHuong === 0 ? (gd.amountScoin ?? 0) : anhHuong);
}

const MAU_TONG: Record<Tong, { nen: string; chu: string; dau: string }> = {
  vao: { nen: colors.successSoft, chu: colors.successInk, dau: '+' },
  ra: { nen: colors.neutralSoft, chu: colors.inkBody, dau: '−' },
  giu: { nen: colors.warningSoft, chu: colors.warningInk, dau: '•' },
};

export function MentorWalletScreen() {
  const vi = useMyMentorWallet();
  const trangThai = trangThaiTai({
    isPaused: vi.isPaused,
    isPending: vi.isPending,
    isError: vi.isError,
    coDuLieu: vi.data !== undefined,
  });

  return (
    <Screen testID="man-hinh-vi-mentor">
      <OfflineBanner />
      <View className="px-gutter pb-3 pt-2">
        <ScreenHeader title="Ví S-coins" size="lg" />
      </View>

      {trangThai === 'dang-tai' ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-vi" color={colors.accent} />
        </View>
      ) : trangThai === 'mat-ket-noi' ? (
        <EmptyState title="Không có kết nối" description="Ví sẽ tải khi có mạng trở lại." />
      ) : trangThai === 'loi' || !vi.data ? (
        <ErrorView error={vi.error} onAction={() => void vi.refetch()} />
      ) : (
        <FlatList
          testID="danh-sach-giao-dich"
          data={vi.data.recentTransactions}
          keyExtractor={(gd, i) => gd.id ?? `gd-${i}`}
          contentContainerClassName="grow gap-0 px-gutter pb-28"
          refreshing={vi.isRefetching}
          onRefresh={() => void vi.refetch()}
          ListHeaderComponent={
            <View className="gap-4 pb-4">
              <View className="overflow-hidden rounded-lg bg-brand-deep" style={{ padding: 20, gap: 4 }}>
                <View
                  className="absolute rounded-full"
                  style={{ width: 170, height: 170, right: -50, top: -60, backgroundColor: '#1E3F85' }}
                />
                <Text className="text-caption text-sky-blue" style={{ fontFamily: fonts.semibold, letterSpacing: 1.4 }}>
                  SỐ DƯ KHẢ DỤNG
                </Text>
                <Text testID="so-du-kha-dung" className="text-on-accent" style={{ fontFamily: fonts.extrabold, fontSize: 32, lineHeight: 40 }}>
                  {phanCachNghin(vi.data.availableScoin)}
                </Text>
                <Text className="text-caption-lg text-ink-on-deep" style={{ fontFamily: fonts.regular }}>
                  Rút tiền về ngân hàng thực hiện trên web SkillSwap.
                </Text>
              </View>
              <Text className="text-section-title text-ink" style={{ fontFamily: fonts.bold }}>
                Giao dịch gần đây
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <DongGiaoDich
              gd={item}
              dau={index === 0}
              cuoi={index === (vi.data?.recentTransactions.length ?? 0) - 1}
            />
          )}
          ListEmptyComponent={
            <EmptyState title="Chưa có giao dịch" description="Thu nhập từ các buổi đã hoàn thành sẽ hiện ở đây." />
          }
        />
      )}
    </Screen>
  );
}

function DongGiaoDich({ gd, dau, cuoi }: { gd: WalletTransactionResponse; dau: boolean; cuoi: boolean }) {
  const tong = tongGiaoDich(gd);
  const mau = MAU_TONG[tong];
  const soTien = soTienGiaoDich(gd);
  const ngay = nhanNgayNgan(gd.createdAt) ?? dinhDangNgayCoOffset(gd.createdAt);

  return (
    <View
      testID={`giao-dich-${gd.id ?? 'x'}`}
      className={`flex-row items-center gap-3 border-x border-t border-line bg-surface px-4 ${cuoi ? 'border-b' : ''}`}
      style={[
        { paddingVertical: 14 },
        dau ? { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg } : null,
        cuoi ? { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg } : null,
      ]}
    >
      <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: mau.nen }}>
        <Text style={{ color: mau.chu, fontFamily: fonts.extrabold, fontSize: 18 }}>{mau.dau}</Text>
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-body text-ink" style={{ fontFamily: fonts.bold }}>
          {nhanGiaoDich(gd)}
        </Text>
        {gd.memo ? (
          <Text numberOfLines={1} className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
            {gd.memo}
          </Text>
        ) : null}
      </View>
      <View className="items-end gap-0.5">
        <Text
          className="text-body"
          style={{ fontFamily: fonts.extrabold, color: tong === 'vao' ? colors.successInk : colors.ink }}
        >
          {tong === 'giu' ? phanCachNghin(soTien) : `${mau.dau} ${phanCachNghin(soTien)}`}
        </Text>
        {ngay ? (
          <Text className="text-ink-muted" style={{ fontFamily: fonts.regular, fontSize: 11 }}>
            {ngay}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
