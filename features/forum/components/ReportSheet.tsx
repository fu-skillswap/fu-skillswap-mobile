/**
 * @file ReportSheet.tsx
 * @description Hộp báo cáo vi phạm cho một bài viết hoặc một bình luận.
 *
 * Dùng `Modal` TỰ VẼ, không `Alert.alert`: `Alert` là hộp thoại chặn của hệ điều
 * hành, không nằm trong cây React nên không kiểm được bằng test, và trong môi
 * trường tự động hoá nó chặn luôn luồng đang chạy. Cùng khuôn với hộp xác nhận
 * xoá bài của `PostDetailScreen`.
 *
 * Thuần trình bày: không gọi API, không biết tới TanStack Query. Người gọi giữ
 * mutation và truyền `busy` / `error` / `daGui` vào — nhờ vậy test của component
 * này không cần dựng HTTP.
 *
 * Backend giới hạn 10 báo cáo trong 30 phút (forum.md §6.1), nên khối lỗi ở đây
 * KHÔNG kèm nút thử lại: bấm lại vẫn hỏng và vẫn tiêu một lượt.
 */

import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { toUserMessage } from '@/core/api/errors';
import { Button } from '@/core/ui/Button';
import type { ForumReportCreateRequest, ForumReportReason } from '@/features/forum/types';

/** Giới hạn của backend, forum.md §6.1 */
const DESCRIPTION_MAX = 1000;

/**
 * Nhãn tiếng Việt cho từng lý do, giữ đúng thứ tự trong `forum.md` §6.1.
 * Mã lý do là hợp đồng với backend — đừng đổi, chỉ đổi nhãn.
 */
const LY_DO: { value: ForumReportReason; label: string }[] = [
  { value: 'SPAM', label: 'Spam, quảng cáo rác' },
  { value: 'OFF_TOPIC', label: 'Lạc đề, không liên quan' },
  { value: 'HARASSMENT', label: 'Quấy rối, công kích cá nhân' },
  { value: 'MISLEADING', label: 'Thông tin sai lệch, lừa đảo' },
  { value: 'OTHER', label: 'Lý do khác' },
];

/** Đối tượng đang bị báo cáo */
export interface ReportTarget {
  targetType: 'POST' | 'COMMENT';
  targetId: string;
}

export interface ReportSheetProps {
  visible: boolean;
  target: ReportTarget;
  onClose: () => void;
  onSubmit: (input: ForumReportCreateRequest) => void;
  /** Đang gửi: nút Gửi quay và không nhận thêm lần bấm nào */
  busy?: boolean;
  /** Lỗi của lần gửi gần nhất, hiện nguyên văn câu của backend */
  error?: unknown;
  /** Đã gửi xong: thay form bằng lời xác nhận để người dùng không gửi lần nữa */
  daGui?: boolean;
}

export function ReportSheet({
  visible,
  target,
  onClose,
  onSubmit,
  busy = false,
  error,
  daGui = false,
}: ReportSheetProps) {
  const [reason, setReason] = useState<ForumReportReason | null>(null);
  const [description, setDescription] = useState('');

  const loi = error === undefined || error === null ? null : toUserMessage(error);

  const gui = () => {
    // Nút đã `disabled`, nhưng luật "phải có lý do" là của backend nên nó được
    // chốt ở đây luôn: một `reasonType` thiếu chỉ nhận 400 mà vẫn tiêu một lượt
    // trong hạn mức 10 báo cáo/30 phút.
    if (reason === null) {
      return;
    }
    onSubmit({
      ...target,
      reasonType: reason,
      // Chuỗi rỗng là "mô tả rỗng" chứ không phải "không có mô tả"; `undefined`
      // mới bị bỏ hẳn khỏi payload.
      description: description.trim() || undefined,
    });
  };

  return (
    <Modal
      testID="hop-thoai-bao-cao"
      visible={visible}
      transparent
      animationType="slide"
      // Nút back cứng của Android cũng phải đóng được hộp này, nếu không người
      // dùng bị kẹt trong một hộp không có đường thoát.
      onRequestClose={onClose}
    >
      {/*
        Hộp này có ô "Mô tả chi tiết" và nút "Gửi báo cáo" NẰM DƯỚI nó, dính đáy
        màn hình. Trên iOS bàn phím phủ lên app chứ không co view, nên không có
        lớp này thì gõ mô tả xong cả nút Gửi lẫn nút Đóng đều nằm dưới bàn phím —
        và vì đây là `Modal` nên không cuộn được để lấy lại. Tệ hơn ô bình luận
        ở màn chi tiết, vì mất luôn đường thoát nhìn thấy được.
      */}
      <KeyboardAvoidingView
        testID="vung-tranh-ban-phim-bao-cao"
        className="flex-1 justify-end bg-black/40"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View testID="hop-bao-cao" className="gap-3 rounded-t-lg bg-surface p-4">
          <Text className="text-base font-semibold text-text-main">
            {target.targetType === 'POST' ? 'Báo cáo bài viết' : 'Báo cáo bình luận'}
          </Text>

          {daGui ? (
            <View testID="da-gui-bao-cao" className="gap-1 rounded-md bg-success-soft p-3">
              <Text className="font-semibold text-success">Đã gửi báo cáo</Text>
              <Text className="text-text-secondary">
                Đội kiểm duyệt sẽ xem lại nội dung này. Cảm ơn bạn đã báo cho chúng tôi.
              </Text>
            </View>
          ) : (
            <>
              {LY_DO.map((item) => (
                <Pressable
                  key={item.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: reason === item.value }}
                  onPress={() => setReason(item.value)}
                  className={`rounded-md border p-3 ${
                    reason === item.value
                      ? 'border-primary bg-primary-light'
                      : 'border-border-color'
                  }`}
                >
                  <Text className="text-text-main">{item.label}</Text>
                </Pressable>
              ))}

              <TextInput
                accessibilityLabel="Mô tả chi tiết"
                placeholder="Mô tả thêm (không bắt buộc)"
                value={description}
                onChangeText={setDescription}
                maxLength={DESCRIPTION_MAX}
                multiline
                className="min-h-20 rounded-md border border-border-color p-3 text-text-main"
              />

              {loi ? (
                // Khối đứng yên, KHÔNG nút thử lại: xem JSDoc đầu file.
                <View testID="loi-gui-bao-cao" className="gap-1 rounded-md bg-danger-soft p-3">
                  <Text className="font-semibold text-danger">{loi.title}</Text>
                  <Text className="text-danger">{loi.description}</Text>
                  {loi.retryAfterSeconds ? (
                    <Text className="text-danger">
                      Vui lòng thử lại sau {loi.retryAfterSeconds} giây.
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <Button
                label="Gửi báo cáo"
                onPress={gui}
                busy={busy}
                disabled={reason === null}
                testID="nut-gui-bao-cao"
              />
            </>
          )}

          <Button label="Đóng" onPress={onClose} variant="secondary" testID="nut-dong-bao-cao" />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
