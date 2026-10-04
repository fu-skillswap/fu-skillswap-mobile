/**
 * @file MentorScheduleScreen.tsx
 * @description Tab "Lịch dạy" của mentor, theo `MentorSchedule.dc.html` và
 * `MentorServices.dc.html`: tiêu đề "Dịch vụ & Lịch dạy" và một segmented control
 * đổi giữa hai phần.
 *
 * - **Lịch dạy**: thẻ trạng thái Google Calendar, dải 7 ngày (chấm = có slot),
 *   danh sách slot của ngày theo ba trạng thái (giờ rảnh viền đứt, đang có yêu
 *   cầu chờ nền vàng, đã chốt lịch nền `accent`), và nút "Thêm giờ rảnh" mở hộp
 *   tạo slot.
 * - **Dịch vụ**: thẻ từng dịch vụ có công tắc bật/tắt nhận đặt, giá công khai
 *   và nhãn trạng thái; chạm để sửa, "Tạo dịch vụ mới" ở cuối.
 *
 * ## Những gì thiết kế có mà màn này CỐ Ý KHÔNG dựng
 *
 * - **Nút "Quản lý" Google Calendar**: kết nối cần luồng OAuth trên trình duyệt
 *   (`/api/me/google-calendar/authorization-context`), làm trên web. Thẻ chỉ báo
 *   trạng thái.
 * - **Tên mentee trong từng slot**: slot của mentor chỉ có số lượng
 *   (`pendingBookingCount`, `lockingBookingCount`), không có booking đi kèm. Chạm
 *   vào slot có yêu cầu thì sang tab Booking để xử lý.
 * - **Lịch lặp hàng tuần (template)**: đợt sau.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { toUserMessage } from '@/core/api/errors';
import { phanCachNghin } from '@/core/format/soLuong';
import { cacNgayTrongTuan, congNgay, dauTuan, homNayVN, isoNgay } from '@/core/time/lichTuan';
import type { NgayLich } from '@/core/time/lichTuan';
import { Button } from '@/core/ui/Button';
import { Chip } from '@/core/ui/Chip';
import { ErrorView } from '@/core/ui/ErrorView';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { ScreenHeader } from '@/core/ui/ScreenHeader';
import { SegmentedControl } from '@/core/ui/SegmentedControl';
import { StatusBadge } from '@/core/ui/StatusBadge';
import { Switch } from '@/core/ui/Switch';
import { TextField } from '@/core/ui/TextField';
import { WeekStrip } from '@/core/ui/WeekStrip';
import { colors, fonts, gradientButton, radius, shadows, spacing } from '@/core/ui/theme';
import {
  useCreateSlot,
  useDeactivateSlot,
  useGoogleCalendarStatus,
  useMyServices,
  useMySlots,
  useSetServiceActive,
} from '@/features/mentorMode/hooks/useMentorStudio';
import { gioVN, instantTuGioVN, nhomSlotMentorTheoNgay } from '@/features/mentorMode/lichDay';
import type { MentorManagedSlotResponse, MentorServiceManagementResponse } from '@/features/mentorMode/types';

type Phan = 'lich' | 'dich-vu';

const PHAN: readonly { value: Phan; label: string }[] = [
  { value: 'lich', label: 'Lịch dạy' },
  { value: 'dich-vu', label: 'Dịch vụ' },
];

const SO_TUAN_TOI_DA = 3;

export interface MentorScheduleScreenProps {
  /** Đồng hồ cho test; mặc định giờ thật */
  bayGioMs?: number;
}

export function MentorScheduleScreen({ bayGioMs }: MentorScheduleScreenProps) {
  const [phan, setPhan] = useState<Phan>('lich');

  return (
    <Screen testID="man-hinh-lich-day">
      <OfflineBanner />
      <View className="gap-3.5 px-gutter pb-3 pt-2">
        <ScreenHeader title="Dịch vụ & Lịch dạy" size="lg" />
        <SegmentedControl
          items={PHAN}
          value={phan}
          onChange={setPhan}
          accessibilityLabel="Phần"
          testID="phan-lich-day"
        />
      </View>
      {phan === 'lich' ? <PhanLichDay bayGioMs={bayGioMs} /> : <PhanDichVu />}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Lịch dạy
// ---------------------------------------------------------------------------

/** Trạng thái hiển thị của một slot */
export function trangThaiSlot(slot: MentorManagedSlotResponse): 'chot' | 'cho' | 'ranh' {
  if (slot.hasLockingBooking || slot.lockingBookingCount > 0) {
    return 'chot';
  }
  return slot.pendingBookingCount > 0 ? 'cho' : 'ranh';
}

function PhanLichDay({ bayGioMs }: { bayGioMs?: number }) {
  const router = useRouter();
  const homNay = homNayVN(bayGioMs);
  const [tuan, setTuan] = useState(0);
  const thuHai = congNgay(dauTuan(homNay), tuan * 7);
  const cacNgay = cacNgayTrongTuan(thuHai);
  const [ngayChon, setNgayChon] = useState<string>(isoNgay(homNay));
  const ngay = cacNgay.some((o) => o.iso === ngayChon) ? ngayChon : cacNgay[0].iso;
  const oNgay = cacNgay.find((o) => o.iso === ngay) ?? cacNgay[0];

  const slots = useMySlots(cacNgay[0].iso, cacNgay[6].iso);
  const lichGoogle = useGoogleCalendarStatus();
  const ngung = useDeactivateSlot();
  const theoNgay = useMemo(() => nhomSlotMentorTheoNgay(slots.data ?? []), [slots.data]);
  const trongNgay = theoNgay.get(ngay) ?? [];
  const [moThem, setMoThem] = useState(false);
  const [slotChon, setSlotChon] = useState<MentorManagedSlotResponse | null>(null);

  const doiTuan = (buoc: number) => {
    const moi = Math.min(SO_TUAN_TOI_DA, Math.max(0, tuan + buoc));
    setTuan(moi);
    setNgayChon(isoNgay(congNgay(dauTuan(homNay), moi * 7)));
  };

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" contentContainerClassName="gap-3.5 px-gutter pb-32">
        <TheLichGoogle trangThai={lichGoogle.data ?? null} dangTai={lichGoogle.isPending} />

        <View className="flex-row items-center justify-between">
          <Text className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
            {`Tháng ${oNgay.thang}, ${oNgay.nam}`}
          </Text>
          <View className="flex-row">
            <NutTuan huong="lui" disabled={tuan === 0} onPress={() => doiTuan(-1)} />
            <NutTuan huong="tien" disabled={tuan >= SO_TUAN_TOI_DA} onPress={() => doiTuan(1)} />
          </View>
        </View>

        <WeekStrip
          days={cacNgay}
          selected={ngay}
          onSelect={setNgayChon}
          hasDot={(o) => (theoNgay.get(o.iso)?.length ?? 0) > 0}
          testIDPrefix="ngay-day"
        />

        <View className="flex-row items-baseline justify-between">
          <Text testID="tieu-de-ngay" className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
            {`${oNgay.tenThu}, ${oNgay.ngay}/${oNgay.thang}`}
          </Text>
          <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
            GMT+7
          </Text>
        </View>

        {slots.isPending && slots.fetchStatus !== 'idle' ? (
          <ActivityIndicator testID="dang-tai-slot" color={colors.accent} />
        ) : slots.isError ? (
          <ErrorView error={slots.error} onAction={() => void slots.refetch()} />
        ) : trongNgay.length === 0 ? (
          <View className="rounded-md border border-dashed border-line bg-surface p-4" style={{ borderWidth: 1.5 }}>
            <Text className="text-body text-ink" style={{ fontFamily: fonts.bold }}>
              Chưa có giờ rảnh
            </Text>
            <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
              Bấm “Thêm giờ rảnh” để mentee đặt lịch với bạn.
            </Text>
          </View>
        ) : (
          trongNgay.map((slot) => (
            <OSlot
              key={slot.slotId}
              slot={slot}
              onPress={() =>
                trangThaiSlot(slot) === 'ranh' ? setSlotChon(slot) : router.push('/(tabs)/mentor-bookings')
              }
            />
          ))
        )}
      </ScrollView>

      {/* FAB "Thêm giờ rảnh" — pill gradient như thiết kế. Ngày đã qua thì ẩn:
          backend từ chối slot trong quá khứ, không dựng nút chắc chắn hỏng. */}
      {ngay >= isoNgay(homNay) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thêm giờ rảnh"
          onPress={() => setMoThem(true)}
          testID="nut-them-gio-ranh"
          className="absolute flex-row items-center gap-2 overflow-hidden rounded-full px-5"
          style={[{ right: spacing.gutter, bottom: 20, height: 52 }, shadows.button]}
        >
          <NenGradient />
          <View className="flex-row items-center gap-2">
            <Plus size={20} color={colors.onAccent} strokeWidth={2.4} />
            <Text className="text-body text-on-accent" style={{ fontFamily: fonts.bold }}>
              Thêm giờ rảnh
            </Text>
          </View>
        </Pressable>
      ) : null}

      <HopThemSlot mo={moThem} ngay={oNgay} onDong={() => setMoThem(false)} />

      <Modal visible={slotChon !== null} transparent animationType="slide" onRequestClose={() => setSlotChon(null)}>
        <View className="flex-1 justify-end bg-black/40">
          <View testID="hop-thoai-slot" className="gap-3 rounded-t-lg bg-surface p-4">
            <Text className="text-base text-ink" style={{ fontFamily: fonts.bold }}>
              {slotChon ? `Giờ rảnh ${gioVN(slotChon.startAt)} – ${gioVN(slotChon.endAt)}` : ''}
            </Text>
            {slotChon?.deactivation?.mode === 'ALLOWED' && slotChon.version != null ? (
              <Button
                label="Ngừng nhận lịch ở khung này"
                variant="danger"
                busy={ngung.isPending}
                onPress={() =>
                  ngung.mutate(
                    {
                      slotId: slotChon.slotId,
                      expectedVersion: slotChon.version ?? 0,
                    },
                    { onSuccess: () => setSlotChon(null) },
                  )
                }
                testID="nut-ngung-slot"
              />
            ) : (
              <Text className="text-caption-lg text-ink-muted" style={{ fontFamily: fonts.regular }}>
                Khung này đang có yêu cầu liên quan, hãy xử lý trên web.
              </Text>
            )}
            {ngung.isError ? (
              <Text className="text-caption-lg text-danger" style={{ fontFamily: fonts.medium }}>
                {toUserMessage(ngung.error).title}
              </Text>
            ) : null}
            <Button label="Đóng" variant="secondary" onPress={() => setSlotChon(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function NenGradient() {
  return (
    <LinearGradient
      colors={[gradientButton[0], gradientButton[1]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    />
  );
}

function TheLichGoogle({
  trangThai,
  dangTai,
}: {
  trangThai: {
    connected: boolean;
    needsReconnect: boolean;
    email: string | null;
  } | null;
  dangTai: boolean;
}) {
  if (dangTai || !trangThai) {
    return null;
  }
  const ok = trangThai.connected && !trangThai.needsReconnect;
  return (
    <View
      testID="the-lich-google"
      className="flex-row items-center gap-3 rounded-md border border-line bg-surface px-3.5 py-3"
    >
      <View
        className={`items-center justify-center ${ok ? 'bg-success-soft' : 'bg-neutral-soft'}`}
        style={{ width: 40, height: 40, borderRadius: 12 }}
      >
        <RefreshCw size={20} color={ok ? colors.successInk : colors.inkMuted} strokeWidth={2} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-body text-ink" style={{ fontFamily: fonts.bold }}>
          Google Calendar
        </Text>
        <Text
          className={`text-caption ${ok ? 'text-success-ink' : 'text-ink-muted'}`}
          style={{ fontFamily: fonts.medium }}
        >
          {ok
            ? 'Đang đồng bộ lịch rảnh tự động'
            : trangThai.needsReconnect
              ? 'Cần kết nối lại trên web SkillSwap'
              : 'Chưa kết nối — kết nối trên web để tự tạo Google Meet'}
        </Text>
      </View>
    </View>
  );
}

function OSlot({ slot, onPress }: { slot: MentorManagedSlotResponse; onPress: () => void }) {
  const tt = trangThaiSlot(slot);
  const bd = gioVN(slot.startAt) ?? '--:--';
  const kt = gioVN(slot.endAt) ?? '--:--';
  const dichVu = slot.services.map((d) => d.title).join(' · ');
  const tieuDe =
    tt === 'chot'
      ? `Đã chốt ${slot.lockingBookingCount || 1} lịch`
      : tt === 'cho'
        ? `${slot.pendingBookingCount} yêu cầu đang chờ`
        : 'Giờ rảnh';
  const kieu =
    tt === 'chot'
      ? { lop: 'bg-accent', chu: 'text-on-accent' }
      : tt === 'cho'
        ? { lop: 'bg-warning-soft', chu: 'text-warning-ink' }
        : {
            lop: 'border border-dashed border-accent bg-surface',
            chu: 'text-accent',
          };

  return (
    <View className="flex-row gap-3">
      <Text className="pt-3 text-caption-lg text-ink-body" style={{ width: 46, fontFamily: fonts.bold }}>
        {bd}
      </Text>
      <Pressable
        testID={`slot-${slot.slotId}`}
        accessibilityRole="button"
        accessibilityLabel={`${tieuDe}, ${bd} đến ${kt}`}
        onPress={onPress}
        className={`flex-1 gap-0.5 px-3.5 py-2.5 ${kieu.lop}`}
        style={{
          borderRadius: radius.md,
          borderWidth: tt === 'ranh' ? 1.5 : 0,
        }}
      >
        <Text className={`text-body ${kieu.chu}`} style={{ fontFamily: fonts.bold }}>
          {tieuDe}
        </Text>
        <Text
          numberOfLines={1}
          className={`text-caption ${kieu.chu}`}
          style={{ fontFamily: fonts.regular, opacity: 0.9 }}
        >
          {`${bd} – ${kt}${dichVu ? ` · ${dichVu}` : ''}`}
        </Text>
      </Pressable>
    </View>
  );
}

function NutTuan({ huong, disabled, onPress }: { huong: 'lui' | 'tien'; disabled: boolean; onPress: () => void }) {
  const Icon = huong === 'lui' ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={huong === 'lui' ? 'Tuần trước' : 'Tuần sau'}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="items-center justify-center rounded-full"
      style={{ width: spacing.touch, height: spacing.touch }}
    >
      <Icon size={20} color={disabled ? colors.line : colors.ink} strokeWidth={2} />
    </Pressable>
  );
}

/** Kiểm form tạo slot; `null` khi gửi được */
export function loiTaoSlot(input: {
  batDau: string;
  ketThuc: string;
  soDichVu: number;
  ngay: NgayLich;
}): string | null {
  const bd = instantTuGioVN(input.ngay, input.batDau);
  const kt = instantTuGioVN(input.ngay, input.ketThuc);
  if (!bd || !kt) {
    return 'Giờ viết theo dạng 24 giờ, ví dụ 08:00.';
  }
  if (Date.parse(kt) <= Date.parse(bd)) {
    return 'Giờ kết thúc phải sau giờ bắt đầu.';
  }
  if (input.soDichVu === 0) {
    return 'Chọn ít nhất một dịch vụ cho khung giờ này.';
  }
  return null;
}

function HopThemSlot({ mo, ngay, onDong }: { mo: boolean; ngay: NgayLich & { tenThu: string }; onDong: () => void }) {
  const dichVu = useMyServices();
  const tao = useCreateSlot();
  const [batDau, setBatDau] = useState('08:00');
  const [ketThuc, setKetThuc] = useState('10:00');
  const [chon, setChon] = useState<string[]>([]);
  const dangMo = (dichVu.data ?? []).filter((d) => d.isActive);
  const loi = loiTaoSlot({ batDau, ketThuc, soDichVu: chon.length, ngay });

  const gui = () => {
    const bd = instantTuGioVN(ngay, batDau);
    const kt = instantTuGioVN(ngay, ketThuc);
    if (loi || !bd || !kt) {
      return;
    }
    tao.mutate(
      { startAt: bd, endAt: kt, serviceIds: chon },
      {
        onSuccess: () => {
          setChon([]);
          onDong();
        },
      },
    );
  };

  return (
    <Modal visible={mo} transparent animationType="slide" onRequestClose={onDong}>
      <KeyboardAvoidingView
        className="flex-1 justify-end bg-black/40"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View testID="hop-them-slot" className="gap-3 rounded-t-lg bg-surface p-4">
          <Text className="text-base text-ink" style={{ fontFamily: fonts.bold }}>
            {`Thêm giờ rảnh · ${ngay.tenThu}, ${ngay.ngay}/${ngay.thang}`}
          </Text>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextField
                label="Bắt đầu"
                value={batDau}
                onChangeText={setBatDau}
                placeholder="08:00"
                testID="o-bat-dau"
              />
            </View>
            <View className="flex-1">
              <TextField
                label="Kết thúc"
                value={ketThuc}
                onChangeText={setKetThuc}
                placeholder="10:00"
                testID="o-ket-thuc"
              />
            </View>
          </View>
          <Text className="text-caption-lg text-ink" style={{ fontFamily: fonts.semibold }}>
            Dịch vụ mentee được đặt trong khung này
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {dangMo.map((d) => (
              <Chip
                key={d.serviceId}
                label={d.title}
                selected={chon.includes(d.serviceId)}
                onPress={() =>
                  setChon((cu) =>
                    cu.includes(d.serviceId) ? cu.filter((x) => x !== d.serviceId) : [...cu, d.serviceId],
                  )
                }
                testID={`chon-dv-slot-${d.serviceId}`}
              />
            ))}
          </View>
          <Text
            className={`text-caption ${tao.isError ? 'text-danger' : 'text-ink-muted'}`}
            style={{ fontFamily: fonts.medium }}
          >
            {tao.isError ? toUserMessage(tao.error).description : (loi ?? 'Giờ Việt Nam (GMT+7).')}
          </Text>
          <Button
            label="Lưu giờ rảnh"
            busy={tao.isPending}
            disabled={loi !== null}
            onPress={gui}
            testID="nut-luu-slot"
          />
          <Button label="Huỷ" variant="secondary" onPress={onDong} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Dịch vụ
// ---------------------------------------------------------------------------

function PhanDichVu() {
  const router = useRouter();
  const dichVu = useMyServices();
  const doiTrangThai = useSetServiceActive();

  if (dichVu.isPending && dichVu.fetchStatus !== 'idle') {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator testID="dang-tai-dich-vu" color={colors.accent} />
      </View>
    );
  }
  if (dichVu.isError || !dichVu.data) {
    return <ErrorView error={dichVu.error} onAction={() => void dichVu.refetch()} />;
  }

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-3.5 px-gutter pb-28">
      {doiTrangThai.isError ? (
        <Text testID="loi-doi-trang-thai" className="text-caption-lg text-danger" style={{ fontFamily: fonts.medium }}>
          {toUserMessage(doiTrangThai.error).title}
        </Text>
      ) : null}
      {dichVu.data.map((dv) => (
        <TheDichVu
          key={dv.serviceId}
          dv={dv}
          dangDoi={doiTrangThai.isPending && doiTrangThai.variables?.serviceId === dv.serviceId}
          onDoi={(isActive) =>
            doiTrangThai.mutate({
              serviceId: dv.serviceId,
              isActive,
              expectedVersion: dv.version,
            })
          }
          onPress={() => router.push(`/mentor-service/${dv.serviceId}`)}
        />
      ))}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/mentor-service/new')}
        testID="nut-tao-dich-vu"
        className="flex-row items-center justify-center gap-2 rounded-lg border border-dashed border-accent"
        style={{ height: 52, borderWidth: 1.5 }}
      >
        <Plus size={18} color={colors.accent} strokeWidth={2.4} />
        <Text className="text-body text-accent" style={{ fontFamily: fonts.bold }}>
          Tạo dịch vụ mới
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function TheDichVu({
  dv,
  dangDoi,
  onDoi,
  onPress,
}: {
  dv: MentorServiceManagementResponse;
  dangDoi: boolean;
  onDoi: (isActive: boolean) => void;
  onPress: () => void;
}) {
  return (
    <View className="gap-3 rounded-lg border border-line bg-surface" style={[{ padding: spacing.card }, shadows.card]}>
      <View className="flex-row items-start gap-3">
        <Pressable
          testID={`dich-vu-${dv.serviceId}`}
          accessibilityRole="button"
          accessibilityLabel={`Sửa dịch vụ ${dv.title}`}
          onPress={onPress}
          className="min-w-0 flex-1 gap-1"
        >
          <Text className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
            {dv.title}
          </Text>
          <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
            {`${dv.durationMinutes} phút · ${dv.deliveryMode === 'GROUP' ? 'Nhóm' : '1:1'}`}
          </Text>
        </Pressable>
        <Switch
          value={dv.isActive}
          onValueChange={onDoi}
          disabled={dangDoi}
          accessibilityLabel={`Mở nhận đặt: ${dv.title}`}
          testID={`cong-tac-${dv.serviceId}`}
        />
      </View>
      <View className="flex-row items-center justify-between border-t border-line pt-3">
        <Text className="text-body-lg text-ink" style={{ fontFamily: fonts.extrabold }}>
          {dv.isFree ? 'Miễn phí' : dv.publicPriceScoin != null ? `${phanCachNghin(dv.publicPriceScoin)} S-coins` : '—'}
        </Text>
        <StatusBadge label={dv.isActive ? 'Đang mở' : 'Đã đóng'} tone={dv.isActive ? 'success' : 'neutral'} />
      </View>
    </View>
  );
}
