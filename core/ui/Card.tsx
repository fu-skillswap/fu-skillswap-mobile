/**
 * @file Card.tsx
 * @description Khối nội dung bo 24 của thiết kế. Có ba sắc nền xuất hiện trong
 * `screens/*.dc.html`: trắng (`surface`, mặc định), navy (`brand-deep` — thẻ
 * Koko và ví), và xanh nhạt (`surface-tint` — khối mời "Trở thành Mentor").
 *
 * `elevated` tách riêng vì thiết kế dùng bóng rất tiết kiệm: chỉ card trong
 * danh sách có bóng, còn các section trong màn hình form thì chỉ có viền 1px.
 */

import type { ReactNode } from 'react';
import { View } from 'react-native';

import { shadows, spacing } from '@/core/ui/theme';

export type CardTone = 'surface' | 'navy' | 'tint';

export interface CardProps {
  children: ReactNode;
  tone?: CardTone;
  /** Bóng `0 8px 32px rgba(15,45,107,0.06)`; chỉ dùng cho card trắng */
  elevated?: boolean;
  /**
   * Bỏ padding 16 và cắt nội dung theo bo góc — dùng cho card chỉ chứa
   * `ListRow`, vì mỗi hàng tự có padding riêng và divider phải chạm sát mép.
   */
  flush?: boolean;
  testID?: string;
}

const TONE_CLASS: Record<CardTone, string> = {
  surface: 'border border-line bg-surface',
  navy: 'bg-brand-deep',
  tint: 'bg-surface-tint',
};

export function Card({
  children,
  tone = 'surface',
  elevated = false,
  flush = false,
  testID,
}: CardProps) {
  return (
    <View
      testID={testID}
      className={`rounded-lg ${TONE_CLASS[tone]} ${flush ? 'overflow-hidden' : ''}`}
      style={[
        flush ? null : { padding: spacing.card },
        elevated && tone === 'surface' ? shadows.card : null,
      ]}
    >
      {children}
    </View>
  );
}
