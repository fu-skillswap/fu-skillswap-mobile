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
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

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
  // Mở lại chốt khi chuyển sang bài khác trong cùng một instance. Hiện
  // `router.push` luôn dựng instance mới nên chưa với tới được, nhưng một lần
  // `router.setParams`/`replace` sau này sẽ khiến form sửa bài B hiện nội dung
  // bài A mà không có gì báo.
  useEffect(() => {
    daNapBaiCu.current = false;
  }, [postId]);
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

  /**
   * Có gì đang gõ dở mà chưa gửi không?
   *
   * Ở chế độ sửa, "bản nháp" nghĩa là KHÁC bài gốc — mở form sửa rồi thoát ngay
   * không phải là mất gì cả.
   */
  const coBanNhap = dangSua
    ? title !== (baiCanSua.data?.title ?? '') ||
      content !== (baiCanSua.data?.content ?? '') ||
      topicId !== (baiCanSua.data?.forumTopic.id ?? null)
    : title.trim().length > 0 || content.trim().length > 0;

  const [dangHoiRoiDi, setDangHoiRoiDi] = useState(false);

  /** Rời màn hình cho an toàn: stack có thể rỗng nếu vào thẳng bằng deep link. */
  const roiDi = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  }, [router]);

  const thuRoiDi = useCallback(() => {
    if (coBanNhap) {
      setDangHoiRoiDi(true);
      return;
    }
    roiDi();
  }, [coBanNhap, roiDi]);

  // Nút back cứng của Android cũng phải đi qua cùng một câu hỏi, nếu không nó là
  // một đường thoát bí mật làm mất trắng tới 5000 ký tự vừa gõ.
  useEffect(() => {
    const dangKy = BackHandler.addEventListener('hardwareBackPress', () => {
      thuRoiDi();
      return true;
    });
    return () => dangKy.remove();
  }, [thuRoiDi]);

  const gui = () => {
    if (!guiDuoc || topicId === null) {
      return;
    }
    guiBai.mutate(
      { title: title.trim(), content: content.trim(), forumTopicId: topicId },
      { onSuccess: roiDi },
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

  // Chủ đề là bắt buộc để đăng bài, nên tải chủ đề hỏng KHÔNG được nuốt lặng
  // bằng `topics.data ?? []`: form vẫn vẽ đầy đủ, nút Đăng bài khoá vĩnh viễn,
  // và người dùng không có cách nào biết vì sao hay thử lại.
  const trangThaiChuDe = trangThaiTai({
    isPaused: topics.isPaused,
    isPending: topics.isPending,
    isError: topics.isError,
    coDuLieu: (topics.data?.length ?? 0) > 0,
  });

  if (dangSua && trangThaiBaiCu === 'loi') {
    // Đây là lỗi ĐỌC bài cũ, không phải lỗi ghi: thử lại ở đây vô hại và không
    // đụng tới hạn mức đăng bài, nên nút hành động được phép xuất hiện.
    return (
      <Screen testID="man-hinh-soan-bai">
        <ErrorView error={baiCanSua.error} onAction={() => void baiCanSua.refetch()} />
      </Screen>
    );
  }

  if (trangThaiChuDe === 'mat-ket-noi') {
    return (
      <Screen testID="man-hinh-soan-bai">
        <OfflineBanner />
        <EmptyState
          title="Không có kết nối"
          description="Danh sách chủ đề sẽ tải khi có mạng trở lại."
        />
      </Screen>
    );
  }

  if (trangThaiChuDe === 'loi') {
    // Lỗi ĐỌC danh sách chủ đề: thử lại vô hại, không đụng hạn mức đăng bài.
    return (
      <Screen testID="man-hinh-soan-bai">
        <ErrorView error={topics.error} onAction={() => void topics.refetch()} />
      </Screen>
    );
  }

  const loi = guiBai.isError ? toUserMessage(guiBai.error) : null;

  return (
    <Screen testID="man-hinh-soan-bai">
      <OfflineBanner />

      {/*
        Thanh trên cùng tự vẽ thay cho header của Stack: nút quay lại phải đi qua
        `thuRoiDi` để hỏi trước khi vứt bản nháp. `app/forum/_layout.tsx` vì thế
        tắt header cho riêng route này.
      */}
      <View className="flex-row items-center gap-3 border-b border-border-light px-4 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          testID="nut-quay-lai"
          onPress={thuRoiDi}
        >
          <Text className="text-base text-primary">Quay lại</Text>
        </Pressable>
        <Text className="text-base font-semibold text-text-main">
          {dangSua ? 'Sửa bài viết' : 'Đăng bài mới'}
        </Text>
      </View>

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

        <TopicChips
          topics={topics.data ?? []}
          selectedTopicId={topicId}
          onSelect={setTopicId}
          // "Tất cả" nghĩa là bỏ lọc — ở đây nó sẽ đọc thành "bỏ chủ đề" và
          // khoá nút Đăng bài mà không giải thích gì.
          choPhepBoChon={false}
        />

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

      <Modal
        visible={dangHoiRoiDi}
        transparent
        animationType="fade"
        onRequestClose={() => setDangHoiRoiDi(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-8">
          <View testID="hop-xac-nhan-roi-di" className="w-full gap-3 rounded-lg bg-surface p-4">
            <Text className="text-base font-semibold text-text-main">Bỏ bài đang soạn?</Text>
            <Text className="text-text-secondary">
              Nội dung bạn vừa gõ chưa được gửi đi và sẽ mất.
            </Text>
            <View className="flex-row justify-end gap-2">
              <Button
                label="Soạn tiếp"
                variant="secondary"
                onPress={() => setDangHoiRoiDi(false)}
                testID="nut-soan-tiep"
              />
              <Button label="Bỏ luôn" variant="danger" onPress={roiDi} testID="nut-bo-ban-nhap" />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
