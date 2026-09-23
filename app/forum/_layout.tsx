import { Stack } from 'expo-router';

/**
 * Stack riêng cho nhánh `/forum/*`.
 *
 * `app/_layout.tsx` đặt `headerShown: false` cho toàn app vì các tab tự vẽ
 * header của mình. Nhưng đây là nhánh màn hình ĐẦU TIÊN rời khỏi tab bar, và
 * nếu thừa kế thiết lập đó thì người dùng không còn một chỗ nào nhìn thấy được
 * để quay lại: Android còn nút back cứng, iOS chỉ còn cử chỉ vuốt.
 */
export default function ForumLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerBackTitle: 'Quay lại' }}>
      <Stack.Screen name="[postId]" options={{ headerTitle: 'Bài viết' }} />
      {/*
        Màn soạn bài tự vẽ thanh trên cùng của nó: nút quay lại ở đó phải hỏi
        trước khi vứt bản nháp, mà header của Stack thì không làm được việc đó
        bằng API công khai của expo-router 57.
      */}
      <Stack.Screen name="compose" options={{ headerShown: false }} />
    </Stack>
  );
}
