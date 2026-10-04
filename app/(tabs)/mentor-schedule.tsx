import { Text, View } from 'react-native';

import { fonts } from '@/core/ui/theme';

/**
 * Vỏ rỗng của tab "Lịch dạy" (`MentorSchedule.dc.html`) — chưa dựng đợt này.
 *
 * Tab vẫn có mặt trên thanh Mentor vì một thanh tab thiếu mục sẽ làm mentor
 * tưởng app mất chức năng, còn một tab nói thẳng "đang hoàn thiện" thì không nói
 * sai điều gì.
 *
 * KHÔNG dựng nút nào ở đây. Màn thật cần ba thứ mà đợt này không làm:
 * `GET /api/mentor/availability-slots` (`MentorAvailabilitySlotController`), các
 * template khả dụng (`AvailabilityTemplateController`) và luồng kết nối Google
 * Calendar (`GoogleCalendarController`). Một nút "Thêm khung giờ" chưa nối được
 * gì chỉ là một nút chết — mục 6 của `docs/quy-uoc-dung-giao-dien.md`.
 */
export default function MentorScheduleRoute() {
  return (
    <View
      testID="vo-rong-lich-day"
      className="flex-1 items-center justify-center gap-1 bg-surface-page px-gutter"
    >
      <Text className="text-section-title text-ink" style={{ fontFamily: fonts.bold }}>
        Lịch dạy
      </Text>
      <Text className="text-body text-ink-muted" style={{ fontFamily: fonts.medium }}>
        Đang hoàn thiện
      </Text>
    </View>
  );
}
