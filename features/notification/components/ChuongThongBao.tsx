/**
 * @file ChuongThongBao.tsx
 * @description Nút chuông tròn 44 ở đầu Bảng tin (`Main.dc.html`) và Tổng quan
 * mentor (`MentorDashboard.dc.html`), dẫn sang màn Thông báo.
 *
 * Chấm cam CHỈ hiện khi `/unread-count` trả về một số lớn hơn 0. Đang tải, lỗi,
 * hay mất mạng thì không có chấm — nói "không biết" bằng cách im lặng, không bằng
 * một chấm luôn sáng.
 */

import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { View } from 'react-native';

import { IconButton } from '@/core/ui/IconButton';
import { colors } from '@/core/ui/theme';
import { THAM_DO_SO_CHUA_DOC_MS, useUnreadNotificationCount } from '@/features/notification/hooks/useNotifications';

export interface ChuongThongBaoProps {
  /** Chu kỳ tải lại số chưa đọc; test truyền `false` */
  thamDoMs?: number | false;
}

export function ChuongThongBao({ thamDoMs = THAM_DO_SO_CHUA_DOC_MS }: ChuongThongBaoProps) {
  const router = useRouter();
  const dem = useUnreadNotificationCount(thamDoMs);
  const soChuaDoc = dem.data?.unreadCount ?? 0;

  return (
    <View>
      <IconButton
        testID="nut-thong-bao"
        label={soChuaDoc > 0 ? `Thông báo, ${soChuaDoc} chưa đọc` : 'Thông báo'}
        icon={<Bell size={22} color={colors.ink} strokeWidth={2} />}
        onPress={() => router.push('/notifications')}
      />
      {soChuaDoc > 0 ? (
        <View
          testID="cham-thong-bao-moi"
          pointerEvents="none"
          className="absolute rounded-full bg-warning"
          style={{ top: 8, right: 9, width: 10, height: 10, borderWidth: 2, borderColor: colors.surface }}
        />
      ) : null}
    </View>
  );
}
