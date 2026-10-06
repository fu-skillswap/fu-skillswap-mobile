/**
 * @file index.ts
 * @description API công khai của feature Koko (trợ lý AI). Tầng `app/` và các
 * feature khác chỉ import từ đây.
 */

export { HangKoko, TheKoko } from '@/features/koko/components/LoiVaoKoko';
export { kokoKhaDung } from '@/features/koko/kokoRepo';
export { KokoChatScreen } from '@/features/koko/screens/KokoChatScreen';
