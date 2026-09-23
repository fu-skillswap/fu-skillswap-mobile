/**
 * @file ComposeScreen.tsx
 * @description Soạn bài mới hoặc sửa bài có sẵn.
 *
 * Giới hạn của backend được tôn trọng ngay trên giao diện (tiêu đề ≤ 200, nội
 * dung ≤ 5000, phải có chủ đề) để không tiêu một lượt trong hạn mức 5 bài/10
 * phút chỉ để nhận về lỗi validate.
 *
 * Hai lỗi của backend được hiện NGUYÊN VĂN ngay dưới form, không gộp vào "có
 * lỗi xảy ra": `FORUM_4201` (từ ngữ vi phạm) và `429` (đăng quá nhanh hoặc
 * trùng bài trong 15 phút). Cả hai đều KHÔNG kèm nút thử lại: gửi lại y nguyên
 * nội dung đó chắc chắn hỏng tiếp, và mỗi lần gửi lại vẫn tính vào hạn mức —
 * đúng luật mà `core/ui/ErrorView.tsx` áp cho `action: 'NONE'`.
 */

import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';

import { toUserMessage } from '@/core/api/errors';
import { trangThaiTai } from '@/core/api/queryState';
import { Button } from '@/core/ui/Button';
import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { colors } from '@/core/ui/theme';
import { TopicChips } from '@/features/forum/components/TopicChips';
import { useCreatePost, useUpdatePost } from '@/features/forum/hooks/useForumMutations';
import { useForumPost, useForumTopics } from '@/features/forum/hooks/useForumQueries';

/** Giới hạn của backend, forum.md §3.5 */
const TITLE_MAX = 200;
const CONTENT_MAX = 5000;

export function ComposeScreen({ postId }: { postId?: string }) {
  const router = useRouter();
  const dangSua = postId !== undefined && postId.length > 0;

  const topics = useForumTopics();
  // Ở chế độ tạo mới, `useForumPost('')` tự tắt (xem `enabled` trong hook) nên
  // không có request nào đi ra.
  const baiCanSua = useForumPost(dangSua ? postId : '');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [topicId, setTopicId] = useState<string | null>(null);

  /**
   * Chỉ nạp bài cũ vào form ĐÚNG MỘT LẦN.
   *
   * Không dùng `useState(existing.data?.title ?? '')`: lần render đầu query còn
   * rỗng, giá trị khởi tạo là chuỗi trống và sẽ không bao giờ được cập nhật khi
   * dữ liệu về — form sửa bài luôn trắng trơn. Còn nếu đồng bộ lại mỗi lần
   * `data` đổi thì một lần refetch nền sẽ xoá đúng thứ người dùng đang gõ dở.
   */
  const daNapBaiCu = useRef(false);
  useEffect(() => {
    if (daNapBaiCu.current || !baiCanSua.data) {
      return;
    }
    daNapBaiCu.current = true;
    setTitle(baiCanSua.data.title);
    setContent(baiCanSua.data.content);
    setTopicId(baiCanSua.data.forumTopic.id);
  }, [baiCanSua.data]);

  const taoBai = useCreatePost();
  const suaBai = useUpdatePost(dangSua ? postId : '');
  const guiBai = dangSua ? suaBai : taoBai;

  const guiDuoc =
    title.trim().length > 0 &&
    title.length <= TITLE_MAX &&
    content.trim().length > 0 &&
    content.length <= CONTENT_MAX &&
    topicId !== null;

  const gui = () => {
    if (!guiDuoc || topicId === null) {
      return;
    }
    guiBai.mutate(
      { title: title.trim(), content: content.trim(), forumTopicId: topicId },
      { onSuccess: () => router.back() },
    );
  };

  // Chỉ chế độ SỬA mới phải chờ dữ liệu; chế độ tạo mới có query bị tắt nên
  // `isPending` của nó đứng yên ở true mãi mãi và không nói lên điều gì.
  const trangThaiBaiCu = trangThaiTai({
    isPaused: baiCanSua.isPaused,
    isPending: baiCanSua.isPending,
    isError: baiCanSua.isError,
    coDuLieu: baiCanSua.data !== undefined,
  });

  if (dangSua && trangThaiBaiCu === 'dang-tai') {
    return (
      <Screen testID="man-hinh-soan-bai">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-bai-can-sua" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (dangSua && trangThaiBaiCu === 'mat-ket-noi') {
    return (
      <Screen testID="man-hinh-soan-bai">
        <OfflineBanner />
        <EmptyState
          title="Không có kết nối"
          description="Bài viết sẽ tải khi có mạng trở lại."
        />
      </Screen>
    );
  }

  if (dangSua && trangThaiBaiCu === 'loi') {
    // Đây là lỗi ĐỌC bài cũ, không phải lỗi ghi: thử lại ở đây vô hại và không
    // đụng tới hạn mức đăng bài, nên nút hành động được phép xuất hiện.
    return (
      <Screen testID="man-hinh-soan-bai">
        <ErrorView error={baiCanSua.error} onAction={() => void baiCanSua.refetch()} />
      </Screen>
    );
  }

  const loi = guiBai.isError ? toUserMessage(guiBai.error) : null;

  return (
    <Screen testID="man-hinh-soan-bai">
      <OfflineBanner />
      <ScrollView contentContainerClassName="gap-3 p-4">
        <TextInput
          accessibilityLabel="Tiêu đề bài viết"
          placeholder="Tiêu đề"
          value={title}
          onChangeText={setTitle}
          maxLength={TITLE_MAX}
          className="h-control-lg rounded-md border border-border-color bg-surface px-3 text-text-main"
        />
        <Text className="text-right text-xs text-text-muted">
          {title.length}/{TITLE_MAX}
        </Text>

        <TopicChips topics={topics.data ?? []} selectedTopicId={topicId} onSelect={setTopicId} />

        <TextInput
          accessibilityLabel="Nội dung bài viết"
          placeholder="Nội dung"
          value={content}
          onChangeText={setContent}
          maxLength={CONTENT_MAX}
          multiline
          className="min-h-40 rounded-md border border-border-color bg-surface p-3 text-text-main"
        />
        <Text className="text-right text-xs text-text-muted">
          {content.length}/{CONTENT_MAX}
        </Text>

        {loi ? (
          // Khối đứng yên dưới ô nhập, KHÔNG phải toast trôi đi: người dùng cần
          // đọc lại câu của backend trong lúc sửa chính nội dung vừa gõ.
          <View testID="loi-gui-bai" className="gap-1 rounded-md bg-danger-soft p-3">
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
          label={dangSua ? 'Lưu thay đổi' : 'Đăng bài'}
          onPress={gui}
          busy={guiBai.isPending}
          disabled={!guiDuoc}
          testID="nut-dang-bai"
        />
      </ScrollView>
    </Screen>
  );
}
