/**
 * @file types.ts
 * @description DTO của nhánh chat, port từ source Java của backend
 * (`modules/chat/dto/...`, `shared/dto/response/CursorPageResponse.java`).
 *
 * Mọi mốc thời gian ở đây là `Instant` — lên dây là UTC có hậu tố `Z`
 * (`"2026-10-04T14:04:00Z"`). Đọc bằng `features/chat/thoiGian.ts`, KHÔNG bằng
 * `docLocalDateTime()` (trả `null`) và không in thẳng mặt đồng hồ của chuỗi (đó
 * là giờ UTC, lệch 7 tiếng so với giờ Việt Nam).
 */

/** `domain/ConversationType.java` */
export type ConversationType = 'DIRECT' | 'GROUP';

/** `domain/ConversationStatus.java` */
export type ConversationStatus = 'ACTIVE' | 'LOCKED';

/** `domain/ChatMessagingAccess.java` */
export type ChatMessagingAccess = 'OPEN' | 'READ_ONLY';

/** `domain/ChatReadOnlyReason.java` */
export type ChatReadOnlyReason =
  | 'ADMIN_LOCKED'
  | 'ACCOUNT_RESTRICTED'
  | 'UNDER_REVIEW'
  | 'PARTICIPANT_BLOCKED'
  | 'GROUP_MEMBERSHIP_REVOKED'
  | 'NO_EFFECTIVE_BOOKING'
  | 'CHAT_WINDOW_EXPIRED';

/**
 * `dto/response/ConversationResponse.java`. Thứ tự field giữ như record Java.
 *
 * Các `long`/`boolean` nguyên thuỷ phía Java (unreadCount, canSendMessages…)
 * không bao giờ null; các `String`/`UUID`/`Instant` thì có thể.
 */
export interface ConversationResponse {
  id: string;
  type: ConversationType;
  status: ConversationStatus;
  otherUserId: string | null;
  otherUserName: string | null;
  otherUserAvatarUrl: string | null;
  lastMessageContent: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  unreadCount: number;
  myLastReadSequence: number;
  otherLastReadSequence: number;
  messagingAccess: ChatMessagingAccess;
  canSendMessages: boolean;
  canUploadAttachments: boolean;
  canDownloadAttachments: boolean;
  readOnlyReason: ChatReadOnlyReason | null;
  messagingWindowEndsAt: string | null;
  postSessionChatPermanent: boolean;
  participantCount: number | null;
  contextType: string | null;
  bookingId: string | null;
  courseId: string | null;
  courseTitle: string | null;
  mentorUserId: string | null;
  mentorName: string | null;
  mentorAvatarUrl: string | null;
  /** Câu backend soạn sẵn để nói với người dùng khi chat bị khoá — hiện nguyên văn */
  userActionMessage: string | null;
  retryable: boolean;
}

/** `domain/MessageType.java` */
export type MessageType = 'TEXT' | 'SYSTEM';

/** `domain/MessageState.java` */
export type MessageState = 'ACTIVE' | 'DELETED';

/** `dto/response/ChatAttachmentResponse.java` */
export interface ChatAttachmentResponse {
  attachmentId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  inlineCapable: boolean;
  downloadable: boolean;
  expiresAt: string | null;
  state: string;
}

/** `dto/response/MessageResponse.java` */
export interface MessageResponse {
  id: string;
  /** `Long` đóng hộp — có thể `null` với tin đang gửi; sắp theo trường này */
  sequence: number | null;
  conversationId: string;
  senderId: string | null;
  senderName: string | null;
  messageType: MessageType;
  content: string | null;
  state: MessageState;
  version: number | null;
  editedAt: string | null;
  deletedAt: string | null;
  /** `Boolean` đóng hộp — `null` nghĩa là backend không biết, khác `false` */
  isReadByOther: boolean | null;
  attachments: ChatAttachmentResponse[] | null;
  createdAt: string;
  isMine: boolean;
}

/** `dto/request/SendMessageRequest.java` */
export interface SendMessageRequest {
  /** FE tự sinh và GIỮ NGUYÊN khi gửi lại — backend dùng nó để chống tin trùng */
  clientMessageId: string;
  content: string;
  replyToMessageId: string | null;
  attachmentIntentIds: string[];
}

/** Giới hạn `@Size(max = 2000)` của `SendMessageRequest.content` */
export const NOI_DUNG_TIN_TOI_DA = 2000;

/** `dto/request/ConversationReadRequest.java` */
export interface ConversationReadRequest {
  lastReadSequence: number;
}

/** `dto/response/ConversationReadResponse.java` */
export interface ConversationReadResponse {
  conversationId: string;
  myLastReadSequence: number;
  otherLastReadSequence: number;
  unreadCount: number;
}
