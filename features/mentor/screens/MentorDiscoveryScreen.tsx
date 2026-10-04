/**
 * @file MentorDiscoveryScreen.tsx
 * @description Tab 2 "Tìm Mentor", theo `Mentors.dc.html`: tiêu đề 26/700, ô tìm
 * kiếm pill cao 52, hàng chip ngang, dòng đếm kết quả, rồi danh sách thẻ mentor.
 *
 * ## Hai nguồn dữ liệu, chọn theo việc người dùng đang làm gì
 *
 * - Chưa gõ gì VÀ đang để chip "Phù hợp nhất" → `useMentorRecommendations()`:
 *   backend tự tính theo ngành học, và chỉ danh sách này mới có lý do gợi ý.
 * - Có từ khoá HOẶC đã chọn một kiểu sắp xếp khác → `useMentorSearch()`.
 *
 * Gom luật đó vào đây để `MentorCard` không phải tự nhớ mình đang ở danh sách nào.
 *
 * ## Chỗ thiết kế KHÔNG khớp được với API, và đã xử thế nào
 *
 * 1. **Hàng chip trong thiết kế là lĩnh vực** ("Tất cả · Tech · Data · Design ·
 *    PM · Marketing") — đó là dữ liệu mẫu vẽ từ bản web. Backend lọc theo
 *    `specializationId`/`campusId` (UUID), và repo mobile CHƯA có endpoint nào
 *    liệt kê chuyên ngành hay cơ sở, nên một hàng chip lĩnh vực sẽ phải ghi cứng
 *    sáu chuỗi không khớp dữ liệu thật. Hàng chip giữ nguyên DÁNG nhưng đổi sang
 *    **sắp xếp** — `sortBy` là bộ lọc duy nhất của `/api/mentors` mà mobile có đủ
 *    thông tin để dùng ngay, và nó có thật trong `MentorSortBy`.
 * 2. **Nút lọc tròn 44 ở góc phải bị BỎ.** Nó mở một bảng lọc theo cơ sở và
 *    chuyên ngành — cùng lý do ở trên: chưa có danh mục để điền vào bảng đó. Dựng
 *    nút mở một bảng rỗng là dựng nút chết.
 *
 * Thiết kế cũng không có lối sang chat/nhắn tin ở màn này, nên không có gì bị bỏ
 * thêm ở phần đó.
 */

import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { trangThaiTai } from '@/core/api/queryState';
import { useDebouncedValue } from '@/core/hooks/useDebouncedValue';
import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { FilterTabs } from '@/core/ui/FilterTabs';
import type { FilterTabItem } from '@/core/ui/FilterTabs';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { ScreenHeader } from '@/core/ui/ScreenHeader';
import { colors, controlHeight, fonts } from '@/core/ui/theme';
import { MentorCard } from '@/features/mentor/components/MentorCard';
import {
  useMentorRecommendations,
  useMentorSearch,
} from '@/features/mentor/hooks/useMentorQueries';
import type { MentorSortBy } from '@/features/mentor/types';

/**
 * Từ khoá phải đứng yên bấy nhiêu mili giây mới được đưa vào query key.
 *
 * Export ra để test nhường đúng khoảng này cho debounce (`nhuongChoDebounce`)
 * thay vì chép lại con số — chép lại thì sửa ở đây là test âm thầm sai nhịp.
 * `ForumFeedScreen` export hằng của nó vì lý do y vậy.
 */
export const DO_TRE_TIM_KIEM_MS = 350;

/**
 * Hàng chip sắp xếp, dùng đúng `MentorSortBy` của backend.
 *
 * `relevance` đứng đầu và mang nghĩa đặc biệt: nó là chip MẶC ĐỊNH, và khi nó
 * được chọn mà ô tìm kiếm còn trống thì màn hình hiện danh sách GỢI Ý
 * (`/recommendations`) chứ không gọi `/api/mentors`. Nhãn "Gợi ý cho bạn" nói
 * đúng điều đó.
 */
const CHIP_SAP_XEP: readonly FilterTabItem<MentorSortBy>[] = [
  { value: 'relevance', label: 'Gợi ý cho bạn' },
  { value: 'ratingAverage', label: 'Đánh giá cao' },
  { value: 'reviewCount', label: 'Nhiều đánh giá' },
  { value: 'completedSessions', label: 'Dạy nhiều nhất' },
  { value: 'updatedAt', label: 'Mới cập nhật' },
];

export function MentorDiscoveryScreen() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [sapXep, setSapXep] = useState<MentorSortBy>('relevance');

  // Ô nhập cập nhật tức thì để không giật chữ; chỉ giá trị đã lắng mới đi vào
  // query key — xem JSDoc của `useDebouncedValue`.
  const timKiem = useDebouncedValue(keyword.trim(), DO_TRE_TIM_KIEM_MS);
  const dungTimKiem = timKiem.length > 0 || sapXep !== 'relevance';

  const goiY = useMentorRecommendations();
  /*
    `enabled` là tham số TƯỜNG MINH của hook: `useMentorSearch({})` là một truy
    vấn hợp lệ (xem toàn bộ mentor) nên hook không thể tự đoán, và màn hình là nơi
    biết người dùng đang xem gợi ý hay đang tìm. Chưa tới lượt tìm kiếm thì không
    có request nào rời máy.
  */
  const timThay = useMentorSearch(
    { keyword: timKiem || undefined, sortBy: sapXep },
    dungTimKiem,
  );

  const danhSach = dungTimKiem ? timThay.mentors : (goiY.data ?? []).map((item) => item.mentor);
  const query = dungTimKiem ? timThay : goiY;

  /*
    Lý do gợi ý chỉ có ở `/recommendations`. Tra theo `identity.mentorUserId` —
    bản phẳng `mentorUserId` bị `@JsonIgnore` nên không có trong JSON, và một
    `Map` khoá `undefined` sẽ im lặng không khớp mentor nào.
  */
  const lyDoTheoMentor = new Map<string, string[]>(
    (goiY.data ?? []).map((item) => [item.mentor.identity.mentorUserId, item.matchReasons]),
  );

  // Quy cờ của TanStack thành MỘT trạng thái — luật và hai cái bẫy nằm ở JSDoc
  // của `core/api/queryState.ts`, đừng tự suy diễn lại ở đây.
  const trangThai = trangThaiTai({
    isPaused: query.isPaused,
    isPending: query.isPending,
    isError: query.isError,
    coDuLieu: danhSach.length > 0,
  });

  /*
    Dòng đếm 13px của thiết kế. Khi tìm kiếm, con số phải là `totalElements` của
    backend chứ KHÔNG phải số thẻ đang có trong tay: mới tải một trang mà ghi
    "12 mentor phù hợp" là nói sai về số kết quả. Gợi ý thì không phân trang, nên
    độ dài mảng chính là tổng.
  */
  const tongKetQua = dungTimKiem
    ? timThay.data?.pages[0]?.totalElements
    : danhSach.length;

  const moHoSo = (mentorUserId: string) => router.push(`/mentor/${mentorUserId}`);

  return (
    <Screen testID="man-hinh-tim-mentor">
      <OfflineBanner />

      <View className="gap-4 px-gutter pb-3 pt-2">
        {/* Không truyền `onBack`: màn này là một tab, không có gì để quay lại. */}
        <ScreenHeader title="Tìm Mentor" size="lg" />

        {/* Pill cao 52, nền trắng viền `line`, icon kính lúp màu `accent`. */}
        <View
          className="flex-row items-center gap-2.5 rounded-full border border-line bg-surface px-4"
          style={{ height: controlHeight.lg }}
        >
          <Search size={20} color={colors.accent} strokeWidth={2} />
          <TextInput
            accessibilityLabel="Tìm mentor"
            // Thiết kế viết "Tên, kỹ năng, công ty…" — bỏ "công ty" vì DTO mentor
            // không có trường nơi làm việc nào, gõ tên công ty vào sẽ không ra gì.
            placeholder="Tên, kỹ năng, môn học…"
            placeholderTextColor={colors.inkMuted}
            value={keyword}
            onChangeText={setKeyword}
            returnKeyType="search"
            className="min-w-0 flex-1 text-ink"
            style={{ fontFamily: fonts.medium, fontSize: 14 }}
          />
        </View>

        <FilterTabs
          items={CHIP_SAP_XEP}
          value={sapXep}
          onChange={setSapXep}
          accessibilityLabel="Sắp xếp mentor"
          testID="sap-xep"
        />
      </View>

      {trangThai === 'dang-tai' ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-mentor" color={colors.accent} />
        </View>
      ) : trangThai === 'mat-ket-noi' ? (
        <EmptyState
          title="Không có kết nối"
          description="Danh sách mentor sẽ tải khi có mạng trở lại."
        />
      ) : trangThai === 'loi' ? (
        <ErrorView error={query.error} onAction={() => void query.refetch()} />
      ) : (
        <FlatList
          testID="danh-sach-mentor"
          data={danhSach}
          keyExtractor={(item) => item.identity.mentorUserId}
          renderItem={({ item }) => (
            <MentorCard
              mentor={item}
              onPress={moHoSo}
              // Lý do gợi ý chỉ thuộc danh sách gợi ý; dán nó lên kết quả tìm
              // kiếm là gán cho backend một lời giải thích nó không đưa ra.
              matchReasons={
                dungTimKiem ? undefined : lyDoTheoMentor.get(item.identity.mentorUserId)
              }
            />
          )}
          // `grow` để EmptyState (flex-1) căn giữa được theo chiều dọc; lề và gap
          // đặt ở contentContainer chứ không ở `Screen` — lề ở khung ngoài sẽ cắt
          // luôn vùng cuộn.
          contentContainerClassName="grow gap-3.5 px-gutter pb-28 pt-1"
          ListHeaderComponent={
            <View className="gap-3 pb-2">
              {query.isError ? (
                <Pressable
                  testID="loi-tai-lai-nen"
                  accessibilityRole="button"
                  onPress={() => void query.refetch()}
                  className="rounded-md bg-neutral-soft px-3 py-2"
                >
                  <Text
                    className="text-caption-lg text-danger"
                    style={{ fontFamily: fonts.medium }}
                  >
                    Không tải được danh sách mới. Chạm để thử lại.
                  </Text>
                </Pressable>
              ) : null}

              {tongKetQua != null && danhSach.length > 0 ? (
                <Text
                  testID="dong-dem-ket-qua"
                  className="text-caption-lg text-ink-muted"
                  style={{ fontFamily: fonts.medium }}
                >
                  {dungTimKiem
                    ? `${tongKetQua} mentor phù hợp`
                    : `${tongKetQua} mentor gợi ý cho bạn`}
                </Text>
              ) : null}
            </View>
          }
          onEndReachedThreshold={0.5}
          /*
            `taiTrangKe()` do HOOK trả về, đã bọc chốt chặn ĐỒNG BỘ chống bắn
            trùng (`useChotChanTrangKe`). Màn hình KHÔNG dựng lại `useRef` lần
            nữa — diễn đàn đã sinh ra hai bản y hệt nhau vì để màn hình tự dựng.

            Danh sách gợi ý không phân trang, nên chỉ nối handler khi đang tìm.
          */
          onEndReached={dungTimKiem ? timThay.taiTrangKe : undefined}
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          ListFooterComponent={
            timThay.isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator testID="dang-tai-trang-ke" color={colors.accent} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title={dungTimKiem ? 'Không tìm thấy mentor nào' : 'Chưa có gợi ý nào'}
              description={
                dungTimKiem
                  ? 'Thử từ khoá khác, hoặc chọn lại "Gợi ý cho bạn" để xem mentor theo ngành học.'
                  : 'Hoàn thành hồ sơ sinh viên để chúng tôi gợi ý mentor phù hợp hơn.'
              }
            />
          }
        />
      )}
    </Screen>
  );
}
