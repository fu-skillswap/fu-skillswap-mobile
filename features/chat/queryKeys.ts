/** Khoá TanStack Query của nhánh chat */
export const chatKeys = {
  all: ['chat'] as const,
  inbox: () => [...chatKeys.all, 'inbox'] as const,
  conversation: (conversationId: string) => [...chatKeys.all, 'conversation', conversationId] as const,
  messages: (conversationId: string) => [...chatKeys.all, 'messages', conversationId] as const,
};
