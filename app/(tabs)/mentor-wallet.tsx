import { Text, View } from 'react-native';

import { fonts } from '@/core/ui/theme';

/**
 * Vỏ rỗng của tab "Ví" (`MentorWallet.dc.html`) — chưa dựng đợt này.
 *
 * ## Vì sao hoãn, chứ không phải vì thiếu API
 *
 * API đã có đủ: `GET /api/me/mentor-wallet` trả số dư khả dụng và 15 giao dịch
 * gần nhất (`WalletController`, `MentorWalletResponse`), và repo mobile đã khai
 * nó ở `features/mentorMode/mentorModeRepo.ts` — màn Tổng quan đang dùng chính
 * endpoint đó để hiện số dư.
 *
 * Thứ còn thiếu là một QUYẾT ĐỊNH SẢN PHẨM: thiết kế có khối "Yêu cầu rút tiền"
 * (payout), và mục 4.1 của `docs/quy-uoc-dung-giao-dien.md` nói rõ payout là
 * luồng KHÁC nạp tiền nên không nằm trong lệnh cấm consumption-only — nhưng
 * **phải hỏi chủ sản phẩm trước khi cho rút ngay trong app**. Câu trả lời chưa
 * có. Dựng màn ví bây giờ buộc phải chọn một trong hai: hoặc dựng lối rút tiền
 * mà chưa được phép, hoặc dựng một màn ví cố ý thiếu mất khối chính của nó rồi
 * phải làm lại. Vì vậy cả màn được hoãn, không phải cắt đôi.
 *
 * KHÔNG dựng nút nào ở đây — kể cả nút nạp tiền (bị cấm thẳng ở mục 4.1) lẫn nút
 * rút tiền (chưa được phép).
 */
export default function MentorWalletRoute() {
  return (
    <View
      testID="vo-rong-vi-mentor"
      className="flex-1 items-center justify-center gap-1 bg-surface-page px-gutter"
    >
      <Text className="text-section-title text-ink" style={{ fontFamily: fonts.bold }}>
        Ví S-coin
      </Text>
      <Text className="text-body text-ink-muted" style={{ fontFamily: fonts.medium }}>
        Đang hoàn thiện
      </Text>
      <Text
        className="pt-1 text-center text-caption-lg text-ink-muted"
        style={{ fontFamily: fonts.regular }}
      >
        Số dư khả dụng của bạn đang hiện ở tab Tổng quan.
      </Text>
    </View>
  );
}
