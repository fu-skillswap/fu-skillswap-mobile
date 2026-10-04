import { useLocalSearchParams } from 'expo-router';

import { ChatScreen } from '@/features/chat';

export default function ChatRoute() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  return <ChatScreen conversationId={typeof conversationId === 'string' ? conversationId : ''} />;
}
