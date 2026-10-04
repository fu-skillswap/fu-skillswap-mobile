/**
 * @file MentorStatTile.tsx
 * @description Ô chỉ số trong lưới 2 cột của `MentorDashboard.dc.html`: card bo
 * 20 viền 1px, ô icon 36 bo 12, nhãn 12 màu `ink-muted`, con số 18/800 kèm đơn
 * vị nhỏ 11/600.
 *
 * Ở `features/` chứ không ở `core/ui/`: đây là hình dạng riêng của màn Tổng quan
 * mentor, không màn nào khác dùng. Khi có màn thứ hai cần nó thì mới nâng lên
 * `core/ui/` — nâng sớm là đoán trước một API chưa ai dùng.
 *
 * `giaTri` nhận `string` đã định dạng xong, KHÔNG nhận `number`: quyết định
 * "được phép hiện con số nào, hay phải nói chữ thay thế" là của tầng nghiệp vụ
 * (`moTaDanhGiaMentor`, `phanCachNghin`), và ô này không được tự quyết — một ô
 * nhận `number | null` rồi tự in "0" khi null là cách chắc chắn để nói sai về
 * tiền và về điểm đánh giá.
 */

import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { fonts, radius } from '@/core/ui/theme';

/** Sắc nền của ô icon, theo ba sắc thiết kế dùng trong lưới chỉ số */
export type StatTileTone = 'accent' | 'success' | 'warning';

const TONE_CLASS: Record<StatTileTone, string> = {
  accent: 'bg-surface-tint',
  success: 'bg-success-soft',
  warning: 'bg-warning-soft',
};

export interface MentorStatTileProps {
  label: string;
  /** Con số hoặc chữ ĐÃ định dạng xong — xem JSDoc đầu file */
  giaTri: string;
  /** Đơn vị in nhỏ sau con số ("S-coin", "/ 87 lượt"); bỏ khi không có */
  donVi?: string;
  icon: ReactNode;
  tone?: StatTileTone;
  testID?: string;
}

export function MentorStatTile({
  label,
  giaTri,
  donVi,
  icon,
  tone = 'accent',
  testID,
}: MentorStatTileProps) {
  return (
    <View
      testID={testID}
      // `flexBasis` 45% + `flexGrow` cho ĐÚNG hai ô mỗi hàng mà vẫn giãn kín bề
      // ngang, và tự xuống một ô ở hàng cuối khi số ô là số lẻ. Không hard-code
      // chiều rộng 390 của khung thiết kế (mục 2 của quy ước).
      style={{ flexGrow: 1, flexBasis: '45%', borderRadius: 20 }}
      className="gap-1.5 border border-line bg-surface p-3.5"
    >
      <View
        className={`h-9 w-9 items-center justify-center ${TONE_CLASS[tone]}`}
        style={{ borderRadius: radius.input }}
      >
        {icon}
      </View>
      <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
        {label}
      </Text>
      {/*
        Đơn vị là `<Text>` LỒNG trong `<Text>` con số, đúng như thiết kế (một
        dòng, hai cỡ chữ). Hệ quả cho test: RNTL gộp chữ của cây `<Text>` lại,
        nên `getByText('4.8')` KHÔNG khớp khi có đơn vị — phải tìm theo
        `testID` dưới đây, hoặc theo chuỗi đã gộp ("4.8 / 87 lượt").
      */}
      <Text
        testID={testID ? `${testID}-gia-tri` : undefined}
        className="text-section-title text-ink"
        style={{ fontFamily: fonts.extrabold }}
      >
        {giaTri}
        {donVi ? (
          <Text className="text-tab-label text-ink-muted" style={{ fontFamily: fonts.semibold }}>
            {` ${donVi}`}
          </Text>
        ) : null}
      </Text>
    </View>
  );
}
