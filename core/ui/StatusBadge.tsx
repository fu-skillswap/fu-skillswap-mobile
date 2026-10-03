/**
 * @file StatusBadge.tsx
 * @description Nhãn trạng thái pill 11/700, padding 5×10 — giá trị lấy từ
 * `renderVals()` của `MyBookings`.
 *
 * Component chỉ nhận `tone`, KHÔNG map từ mã trạng thái booking sang màu:
 * danh sách trạng thái (Đang chờ · Đang diễn ra · Đã hoàn thành · Vắng mặt ·
 * Bị từ chối · Quá hạn · Mentee hủy · Mentor hủy) là kiến thức của tầng
 * nghiệp vụ, không phải của `core/ui`.
 */

import { Text, View } from 'react-native';

import { fonts } from '@/core/ui/theme';

/**
 * - `accent` nền `accent` chữ trắng — đang diễn ra
 * - `warning` nền `warning-soft` chữ `warning-ink` — đang chờ
 * - `success` nền `success-soft` chữ `success-ink` — đã hoàn thành
 * - `neutral` nền `neutral-soft` chữ `ink-muted` — đã hủy / quá hạn
 */
export type StatusTone = 'accent' | 'warning' | 'success' | 'neutral';

export interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  testID?: string;
}

const TONE_CLASS: Record<StatusTone, string> = {
  accent: 'bg-accent',
  warning: 'bg-warning-soft',
  success: 'bg-success-soft',
  neutral: 'bg-neutral-soft',
};

const TONE_TEXT_CLASS: Record<StatusTone, string> = {
  accent: 'text-on-accent',
  warning: 'text-warning-ink',
  success: 'text-success-ink',
  neutral: 'text-ink-muted',
};

export function StatusBadge({ label, tone = 'neutral', testID }: StatusBadgeProps) {
  return (
    <View
      // Nhãn trạng thái là chữ, không phải nút: không có vai trò bấm, và
      // `shrink-0` để nó không bị bóp khi tên mentor dài.
      className={`shrink-0 rounded-full px-2.5 ${TONE_CLASS[tone]}`}
      style={{ paddingVertical: 5 }}
      testID={testID}
    >
      <Text
        className={`text-tab-label ${TONE_TEXT_CLASS[tone]}`}
        style={{ fontFamily: fonts.bold }}
      >
        {label}
      </Text>
    </View>
  );
}
