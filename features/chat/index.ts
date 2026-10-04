/**
 * @file index.ts
 * @description API công khai của feature chat. Tầng `app/` chỉ import từ đây.
 */

export { ChatScreen } from '@/features/chat/screens/ChatScreen';
export { MessagesScreen } from '@/features/chat/screens/MessagesScreen';
export { useConversations } from '@/features/chat/hooks/useChat';
