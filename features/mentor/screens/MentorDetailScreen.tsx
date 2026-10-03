/**
 * @file MentorDetailScreen.tsx
 * @description Hồ sơ mentor, theo `MentorDetail.dc.html`: dải nền `surface-tint`
 * cao 210 với nút back tròn 44, card trắng đè lên dải đó mang avatar 84 và ba ô
 * chỉ số, rồi ba tab Giới thiệu · Dịch vụ · Đánh giá.
 *
 * Danh sách đánh giá là `data` của MỘT `FlatList`; toàn bộ phần hồ sơ và nội dung
 * hai tab còn lại nằm trong `ListHeaderComponent`. Cùng khuôn `PostDetailScreen`:
 * mentor có nhiều đánh giá vẫn cuộn được mà không lồng hai danh sách cuộn.
 *
 * ## Những gì thiết kế có mà màn này CỐ Ý KHÔNG dựng
 *
 * - **CTA "Đặt lịch · 150.000 S-coins"** ở thanh dưới cùng. Màn `Booking` chưa
 *   dựng — chọn khung giờ, báo giá và thanh toán thuộc đợt sau. Dịch vụ vẫn hiện
 *   đủ giá và thời lượng, nhưng dưới dạng thẻ TĨNH, và không có nút nào mời người
 *   dùng chạm. Một nút không đi đâu là nút chết, thứ repo này đã phải phá bỏ hai
 *   lần.
 * - **Nút nhắn tin** cạnh CTA đó: màn `ChatDetail` chưa dựng. Vì cả hai nút của
 *   thanh dưới đều bị bỏ, thanh dưới không được dựng — một `BottomBar` rỗng chỉ
 *   ăn mất 96px cuối màn hình.
 * - **Nút "Lưu mentor"** và **"Chia sẻ"** ở góc phải dải nền. Backend không có
 *   endpoint lưu mentor nào, và không có URL công khai nào của hồ sơ mentor để
 *   chia sẻ.
 * - **Ô chỉ số thứ ba "1:1 / Google Meet"**: `MentorDiscoveryDetailResponse`
 *   không khai nền tảng họp nào (nền tảng được chọn ở bước booking phía mentor).
 *   Ô đó đổi sang số buổi đã dạy xong — dữ liệu thật trên `reputation`.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { trangThaiTai } from '@/core/api/queryState';
import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { IconButton } from '@/core/ui/IconButton';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { SegmentedControl } from '@/core/ui/SegmentedControl';
import type { SegmentedItem } from '@/core/ui/SegmentedControl';
import { Avatar } from '@/core/ui/Avatar';
import { StatusBadge } from '@/core/ui/StatusBadge';
import { colors, fonts, radius, shadows, spacing } from '@/core/ui/theme';
import { MentorRating } from '@/features/mentor/components/MentorRating';
import { MentorReviewItem } from '@/features/mentor/components/MentorReviewItem';
import { MentorServiceCard } from '@/features/mentor/components/MentorServiceCard';
import { SupportLevelBadges } from '@/features/mentor/components/SupportLevelBadges';
import { useMentor, useMentorReviews } from '@/features/mentor/hooks/useMentorQueries';
import { moTaDiemDanhGia } from '@/features/mentor/rating';
import type { MentorDiscoveryDetailResponse } from '@/features/mentor/types';

/** Ba tab của thiết kế, đúng thứ tự và đúng chữ */
type TabHoSo = 'gioi-thieu' | 'dich-vu' | 'danh-gia';

const TAB: readonly SegmentedItem<TabHoSo>[] = [
  { value: 'gioi-thieu', label: 'Giới thiệu' },
  { value: 'dich-vu', label: 'Dịch vụ' },
  { value: 'danh-gia', label: 'Đánh giá' },
];

export interface MentorDetailScreenProps {
  mentorUserId: string;
}

/** Một dòng "nhãn — giá trị"; bỏ HẲN dòng khi không có giá trị */
function Dong({ nhan, giaTri }: { nhan: string; giaTri: string | null | undefined }) {
  if (!giaTri) {
    return null;
  }
  return (
    <View className="flex-row justify-between gap-4 py-1">
      <Text className="text-caption-lg text-ink-muted" style={{ fontFamily: fonts.regular }}>
        {nhan}
      </Text>
      <Text
        className="flex-1 text-right text-caption-lg text-ink"
        style={{ fontFamily: fonts.semibold }}
      >
        {giaTri}
      </Text>
    </View>
  );
}

/** Tiêu đề section 18/700 của thiết kế */
function TieuDeSection({ children }: { children: string }) {
  return (
    <Text className="text-section-title text-ink" style={{ fontFamily: fonts.bold }}>
      {children}
    </Text>
  );
}

/** Một ô trong hàng ba chỉ số của card hồ sơ */
function OChiSo({
  nhan,
  children,
  giua = false,
  testID,
}: {
  nhan: string;
  children: ReactNode;
  /** Ô giữa có viền hai bên, đúng `border-left`/`border-right` của thiết kế */
  giua?: boolean;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      className={`flex-1 items-center gap-0.5 ${giua ? 'border-x border-line' : ''}`}
    >
      {children}
      <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
        {nhan}
      </Text>
    </View>
  );
}

export function MentorDetailScreen({ mentorUserId }: MentorDetailScreenProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabHoSo>('gioi-thieu');

  /**
   * Rời màn hình cho an toàn — cùng khuôn `PostDetailScreen`.
   *
   * Vào thẳng `/mentor/{id}` bằng deep link (`skillswap://mentor/m1`) hay một
   * thông báo đẩy thì stack RỖNG, và `back()` là no-op: người dùng bấm nút quay
   * lại rồi ngồi nhìn đúng màn hình cũ, không hiểu chuyện gì vừa xảy ra.
   */
  const roiDi = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  const mentor = useMentor(mentorUserId);
  const danhGia = useMentorReviews(mentorUserId);

  const trangThai = trangThaiTai({
    isPaused: mentor.isPaused,
    isPending: mentor.isPending,
    isError: mentor.isError,
    coDuLieu: mentor.data !== undefined,
  });

  /*
    Nút back nằm NGOÀI mọi nhánh điều kiện: lúc hồ sơ lỗi, mất mạng hay đang tải
    mới là lúc người dùng cần đường ra nhất, mà đó đúng là những lúc card hồ sơ
    (chỗ thiết kế đặt nút back) không được render.
  */
  const nutQuayLai = (
    <IconButton
      label="Quay lại"
      icon={<ChevronLeft size={22} color={colors.ink} strokeWidth={2} />}
      onPress={roiDi}
      testID="nut-quay-lai"
    />
  );
  // Nhánh lỗi/đang tải không có `contentContainerClassName` của FlatList lo lề,
  // nên nút tự mang lề 20 của thiết kế ở đó.
  const nutQuayLaiCoLe = <View className="px-gutter pt-2">{nutQuayLai}</View>;

  if (trangThai === 'dang-tai') {
    return (
      <Screen testID="man-hinh-ho-so-mentor">
        <OfflineBanner />
        {nutQuayLaiCoLe}
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-ho-so-mentor" color={colors.accent} />
        </View>
      </Screen>
    );
  }

  if (trangThai === 'mat-ket-noi') {
    return (
      <Screen testID="man-hinh-ho-so-mentor">
        <OfflineBanner />
        {nutQuayLaiCoLe}
        <EmptyState
          title="Không có kết nối"
          description="Hồ sơ mentor sẽ tải khi có mạng trở lại."
        />
      </Screen>
    );
  }

  if (trangThai === 'loi' || mentor.data === undefined) {
    return (
      <Screen testID="man-hinh-ho-so-mentor">
        <OfflineBanner />
        {nutQuayLaiCoLe}
        <ErrorView error={mentor.error} onAction={() => void mentor.refetch()} />
      </Screen>
    );
  }

  const hoSo: MentorDiscoveryDetailResponse = mentor.data;
  const diem = moTaDiemDanhGia(hoSo.reputation);
  /*
    Chỉ dịch vụ ĐANG MỞ. Mentor đã đóng một dịch vụ mà vẫn hiện ra là mời người
    dùng vào một thứ không đặt được — và `isActive` tồn tại đúng để nói điều đó.
  */
  const dichVuDangMo = hoSo.services.filter((dv) => dv.isActive);
  const hocVan = hoSo.evidence.education;

  return (
    <Screen testID="man-hinh-ho-so-mentor">
      <OfflineBanner />
      <FlatList
        testID="danh-sach-danh-gia"
        /*
          Danh sách đánh giá chỉ là `data` khi tab Đánh giá đang mở. Để nguyên dữ
          liệu ở hai tab kia thì các đánh giá vẫn render dưới phần nội dung tab
          đang xem — hai nội dung khác nhau dính vào nhau trên cùng một màn.
        */
        data={tab === 'danh-gia' ? danhGia.reviews : []}
        keyExtractor={(item) => item.reviewId}
        renderItem={({ item }) => <MentorReviewItem review={item} />}
        contentContainerClassName="grow gap-3.5 px-gutter pb-12"
        ListHeaderComponent={
          <View className="gap-4">
            <View className="flex-row pt-2">{nutQuayLai}</View>

            {/* Card hồ sơ: bo 24, viền `line`, bóng `shadows.card`, padding 20. */}
            <View
              className="items-center gap-1 rounded-lg border border-line bg-surface"
              style={[{ padding: 20 }, shadows.card]}
            >
              {/*
                Avatar 84 nền `accent` chữ trắng, viền trắng 4px, đè lên mép trên
                card — đúng `margin-top: -62px` của thiết kế.
              */}
              <View
                className="bg-surface"
                style={{
                  marginTop: -62,
                  padding: 4,
                  borderRadius: radius.full,
                }}
              >
                <Avatar
                  name={hoSo.identity.displayName}
                  size={84}
                  tone="accent"
                  testID="anh-mentor"
                />
              </View>

              <View className="flex-row items-center gap-1.5 pt-2">
                <Text
                  className="shrink text-center text-ink"
                  style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 }}
                >
                  {hoSo.identity.displayName}
                </Text>
                {hoSo.identity.isVerified ? (
                  <StatusBadge label="Đã xác minh" tone="accent" testID="dau-xac-minh" />
                ) : null}
              </View>

              {hoSo.identity.headline ? (
                <Text
                  className="text-center text-body text-ink-body"
                  style={{ fontFamily: fonts.regular }}
                >
                  {hoSo.identity.headline}
                </Text>
              ) : null}

              {/* Hàng ba chỉ số, viền trên 1px `line`, padding-top 14. */}
              <View className="mt-3 w-full flex-row border-t border-line pt-3.5">
                <OChiSo nhan="Đánh giá" testID="o-diem-danh-gia">
                  {/*
                    Đi qua `MentorRating` chứ không tự đọc `ratingAverage`: mentor
                    chưa có đánh giá thì ô này nói "Chưa có đánh giá" và KHÔNG có
                    ngôi sao hay con số nào.
                  */}
                  <MentorRating reputation={hoSo.reputation} testID="diem-danh-gia" />
                </OChiSo>
                <OChiSo nhan="Lượt review" giua testID="o-luot-review">
                  <Text
                    className="text-ink"
                    style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 22 }}
                  >
                    {hoSo.reputation.reviewCount}
                  </Text>
                </OChiSo>
                <OChiSo nhan="Buổi đã dạy" testID="o-buoi-da-day">
                  <Text
                    className="text-ink"
                    style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 22 }}
                  >
                    {hoSo.reputation.completedSessions}
                  </Text>
                </OChiSo>
              </View>
            </View>

            <SegmentedControl
              items={TAB}
              value={tab}
              onChange={setTab}
              accessibilityLabel="Thông tin mentor"
              testID="tab-ho-so"
            />

            {tab === 'gioi-thieu' ? (
              <View className="gap-4">
                {hoSo.mentoring.bio ? (
                  <Text
                    className="text-ink-body"
                    style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22 }}
                  >
                    {hoSo.mentoring.bio}
                  </Text>
                ) : null}

                {hoSo.mentoring.expertiseDescription ? (
                  <View className="gap-2">
                    <TieuDeSection>Chuyên môn</TieuDeSection>
                    <Text
                      className="text-ink-body"
                      style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22 }}
                    >
                      {hoSo.mentoring.expertiseDescription}
                    </Text>
                  </View>
                ) : null}

                {/* `null` ở cả ba mức thì component tự trả `null`, không ra hàng rỗng. */}
                <SupportLevelBadges
                  testID="muc-ho-tro"
                  foundation={hoSo.mentoring.supportLevels.foundation}
                  outputReview={hoSo.mentoring.supportLevels.outputReview}
                  direction={hoSo.mentoring.supportLevels.direction}
                />

                <View
                  className="gap-0.5 rounded-lg border border-line bg-surface"
                  style={{ padding: spacing.card }}
                >
                  <TieuDeSection>Học vấn</TieuDeSection>
                  <Dong nhan="Cơ sở" giaTri={hocVan.campusName} />
                  <Dong nhan="Ngành" giaTri={hocVan.programName} />
                  <Dong nhan="Chuyên ngành" giaTri={hocVan.specializationName} />
                  <Dong
                    nhan="Kỳ"
                    giaTri={hocVan.semester != null ? `Kỳ ${hocVan.semester}` : null}
                  />
                  {/*
                    `alumni` là `Boolean` ĐÓNG HỘP phía Java: `null` nghĩa là
                    backend không biết, khác hẳn `false` (đang học). Chỉ nói khi
                    có giá trị thật.
                  */}
                  <Dong
                    nhan="Tình trạng"
                    giaTri={
                      hocVan.alumni == null ? null : hocVan.alumni ? 'Đã tốt nghiệp' : 'Đang học'
                    }
                  />
                </View>
              </View>
            ) : null}

            {tab === 'dich-vu' ? (
              <View className="gap-3">
                {dichVuDangMo.length > 0 ? (
                  dichVuDangMo.map((dv) => <MentorServiceCard key={dv.serviceId} service={dv} />)
                ) : (
                  <Text
                    testID="chua-mo-dich-vu"
                    className="text-body text-ink-muted"
                    style={{ fontFamily: fonts.medium }}
                  >
                    Mentor chưa mở dịch vụ nào.
                  </Text>
                )}
                {/*
                  Nói thẳng là chưa đặt được, thay vì để một danh sách giá trông
                  như sắp bấm được rồi không có nút nào. Xem JSDoc đầu file.
                */}
                {dichVuDangMo.length > 0 ? (
                  <Text
                    className="text-caption text-ink-muted"
                    style={{ fontFamily: fonts.regular, lineHeight: 18 }}
                  >
                    Việc đặt lịch trên ứng dụng đang được hoàn thiện. Hiện bạn xem được giá và
                    thời lượng của từng dịch vụ.
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        onEndReachedThreshold={0.5}
        /*
          `taiTrangKe()` do HOOK trả về, đã bọc chốt chặn ĐỒNG BỘ chống bắn trùng.
          Màn hình KHÔNG dựng lại `useRef`. Chỉ nối khi tab Đánh giá đang mở: hai
          tab kia có `data` rỗng nên `onEndReached` bắn ngay lúc mở màn.
        */
        onEndReached={tab === 'danh-gia' ? danhGia.taiTrangKe : undefined}
        refreshing={mentor.isRefetching}
        onRefresh={() => {
          void mentor.refetch();
          void danhGia.refetch();
        }}
        ListFooterComponent={
          tab === 'danh-gia' && danhGia.isFetchingNextPage ? (
            <View className="py-4">
              <ActivityIndicator testID="dang-tai-danh-gia-ke" color={colors.accent} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          tab !== 'danh-gia' ? null : danhGia.isPaused ? (
            <EmptyState
              title="Không có kết nối"
              description="Đánh giá sẽ tải khi có mạng trở lại."
            />
          ) : danhGia.isPending ? (
            <View className="items-center py-6">
              <ActivityIndicator testID="dang-tai-danh-gia" color={colors.accent} />
            </View>
          ) : danhGia.isError ? (
            <ErrorView error={danhGia.error} onAction={() => void danhGia.refetch()} />
          ) : (
            <EmptyState
              title="Chưa có đánh giá"
              description="Mentor này chưa nhận được đánh giá nào."
            />
          )
        }
      />
    </Screen>
  );
}
