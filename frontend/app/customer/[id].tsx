import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";

const RX_FIELDS = ["od_sph","od_cyl","od_axis","od_add","os_sph","os_cyl","os_axis","os_add","pd"] as const;
type RxKey = typeof RX_FIELDS[number];

export default function CustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [c, setC] = useState<any>(null);
  const [showRx, setShowRx] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setC(await api(`/customers/${id}`)); } catch (e) { console.warn(e); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const [aiError, setAiError] = useState("");
  const generateAI = async (rxId: string) => {
    setAiBusy(rxId);
    setAiError("");
    try {
      const res = await api(`/customers/${id}/prescriptions/${rxId}/ai-summary`, { method: "POST" });
      if (res?.error) setAiError(res.error);
      await load();
    } catch (e: any) { setAiError(e?.message || "AI service unavailable."); }
    finally { setAiBusy(null); }
  };

  const removeCustomer = async () => {
    try { await api(`/customers/${id}`, { method: "DELETE" }); router.back(); } catch (e) { console.warn(e); }
  };

  if (!c) return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader title="Loading…" />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader
        title={c.name}
        right={
          <Pressable testID="delete-customer-button" onPress={removeCustomer} hitSlop={10}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={styles.card}>
          <Row icon="call-outline" text={c.phone} />
          {!!c.email && <Row icon="mail-outline" text={c.email} />}
          {!!c.address && <Row icon="location-outline" text={c.address} />}
          {!!c.dob && <Row icon="calendar-outline" text={c.dob} />}
          {!!c.notes && <Row icon="document-text-outline" text={c.notes} />}
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
          <Pressable testID="sms-reminder-button" style={[styles.actionBtn, { backgroundColor: colors.brandSecondary }]} onPress={() => setShowReminder(true)}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color="#fff" />
            <Text style={styles.actionTxt}>SMS / WhatsApp</Text>
          </Pressable>
          <Pressable testID="new-order-from-customer" style={[styles.actionBtn, { backgroundColor: colors.brand }]} onPress={() => router.push({ pathname: "/order/new", params: { customer_id: c.id } })}>
            <Ionicons name="cart-outline" size={16} color="#fff" />
            <Text style={styles.actionTxt}>New Order</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xl }}>
          <Text style={styles.sectionTitle}>Prescriptions</Text>
          <Pressable testID="add-rx-button" onPress={() => setShowRx(true)} style={styles.addRx}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: sizes.sm }}>Add Rx</Text>
          </Pressable>
        </View>

        {(c.prescriptions || []).length === 0 && (
          <View style={styles.emptyRx}><Text style={{ color: colors.muted }}>No prescriptions yet</Text></View>
        )}

        {(c.prescriptions || []).map((rx: any) => (
          <View key={rx.id} style={styles.rxCard} testID={`rx-card-${rx.id}`}>
            <Text style={styles.rxDate}>Rx · {rx.date}</Text>
            <View style={styles.rxGrid}>
              <View style={styles.rxCol}>
                <Text style={styles.rxColHeader}>Eye</Text>
                <Text style={styles.rxEyeLabel}>OD</Text>
                <Text style={styles.rxEyeLabel}>OS</Text>
              </View>
              {(["SPH","CYL","AXIS","ADD"] as const).map((h, i) => {
                const odKey = ["od_sph","od_cyl","od_axis","od_add"][i] as RxKey;
                const osKey = ["os_sph","os_cyl","os_axis","os_add"][i] as RxKey;
                return (
                  <View key={h} style={styles.rxCol}>
                    <Text style={styles.rxColHeader}>{h}</Text>
                    <Text style={styles.rxVal}>{fmt(rx[odKey])}</Text>
                    <Text style={styles.rxVal}>{fmt(rx[osKey])}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.rxPD}>PD: <Text style={{ fontFamily: "Courier", fontWeight: "700" }}>{fmt(rx.pd)}</Text></Text>
            {!!rx.notes && <Text style={styles.rxNotes}>{rx.notes}</Text>}

            <View style={styles.aiBox}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={styles.aiTitle}>AI Summary</Text>
                <Pressable
                  testID={`generate-ai-${rx.id}`}
                  onPress={() => generateAI(rx.id)}
                  disabled={aiBusy === rx.id}
                  style={styles.aiBtn}
                >
                  <Ionicons name="sparkles-outline" size={14} color={colors.brand} />
                  <Text style={styles.aiBtnText}>{aiBusy === rx.id ? "Generating…" : rx.ai_summary ? "Regenerate" : "Generate"}</Text>
                </Pressable>
              </View>
              {rx.ai_summary ? (
                <Text style={styles.aiText} testID={`ai-summary-${rx.id}`}>{rx.ai_summary}</Text>
              ) : aiError && aiBusy === null ? (
                <Text style={[styles.aiText, { color: colors.error }]} testID={`ai-error-${rx.id}`}>{aiError}</Text>
              ) : (
                <Text style={[styles.aiText, { color: colors.muted, fontStyle: "italic" }]}>Tap Generate for a Gemini summary.</Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <RxModal
        visible={showRx}
        onClose={() => setShowRx(false)}
        onSave={async (body: any) => {
          await api(`/customers/${id}/prescriptions`, { method: "POST", body });
          setShowRx(false);
          load();
        }}
      />
      <ReminderModal
        visible={showReminder}
        customerName={c.name}
        onClose={() => setShowReminder(false)}
        onSend={async (channel: string, message: string) => {
          await api("/reminders", { method: "POST", body: { customer_id: id, channel, message } });
          setShowReminder(false);
        }}
      />
    </View>
  );
}

function fmt(v: any) { return v === null || v === undefined || v === "" ? "—" : String(v); }

function Row({ icon, text }: any) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 }}>
      <Ionicons name={icon} size={16} color={colors.muted} />
      <Text style={{ color: colors.onSurface, fontSize: sizes.base, flex: 1 }}>{text}</Text>
    </View>
  );
}

function RxModal({ visible, onClose, onSave }: any) {
  const [form, setForm] = useState<any>({ date: new Date().toISOString().slice(0,10) });
  const set = (k: string, v: string) => setForm({ ...form, [k]: v });
  const parseNum = (v: string) => v === "" ? null : Number(v);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Prescription</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={colors.onSurface} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            <Text style={styles.label}>Date</Text>
            <TextInput testID="rx-date-input" value={form.date} onChangeText={(v) => set("date", v)} style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
            {(["od","os"] as const).map((eye) => (
              <View key={eye}>
                <Text style={[styles.label, { marginTop: spacing.md }]}>{eye === "od" ? "Right (OD)" : "Left (OS)"}</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {(["sph","cyl","axis","add"] as const).map((k) => (
                    <View key={k} style={{ flex: 1 }}>
                      <Text style={styles.miniLabel}>{k.toUpperCase()}</Text>
                      <TextInput
                        testID={`rx-${eye}-${k}-input`}
                        value={form[`${eye}_${k}`] ?? ""}
                        onChangeText={(v) => set(`${eye}_${k}`, v)}
                        style={styles.input}
                        keyboardType="numbers-and-punctuation"
                        placeholderTextColor={colors.muted}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))}
            <Text style={[styles.label, { marginTop: spacing.md }]}>PD</Text>
            <TextInput testID="rx-pd-input" value={form.pd ?? ""} onChangeText={(v) => set("pd", v)} style={styles.input} keyboardType="numbers-and-punctuation" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { marginTop: spacing.md }]}>Notes</Text>
            <TextInput testID="rx-notes-input" value={form.notes ?? ""} onChangeText={(v) => set("notes", v)} style={[styles.input, { height: 70, textAlignVertical: "top" }]} multiline placeholderTextColor={colors.muted} />
            <Pressable
              testID="save-rx-button"
              onPress={() => {
                const body: any = { date: form.date };
                ["od_sph","od_cyl","od_add","os_sph","os_cyl","os_add","pd"].forEach(k => body[k] = parseNum(form[k] ?? ""));
                ["od_axis","os_axis"].forEach(k => body[k] = form[k] ? parseInt(form[k], 10) : null);
                body.notes = form.notes ?? "";
                onSave(body);
              }}
              style={[styles.cta, { marginTop: spacing.lg }]}
            >
              <Text style={styles.ctaText}>Save Prescription</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ReminderModal({ visible, onClose, onSend, customerName }: any) {
  const [channel, setChannel] = useState<"sms"|"whatsapp">("sms");
  const [msg, setMsg] = useState(`Hi ${customerName}, this is a friendly reminder from your optical shop.`);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Send Reminder</Text>
            <Pressable onPress={() => { setSent(false); onClose(); }}><Ionicons name="close" size={22} color={colors.onSurface} /></Pressable>
          </View>
          <View style={{ padding: spacing.lg }}>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
              {(["sms","whatsapp"] as const).map((ch) => (
                <Pressable
                  key={ch}
                  testID={`channel-${ch}`}
                  onPress={() => setChannel(ch)}
                  style={[styles.chip, channel === ch && { backgroundColor: colors.brand, borderColor: colors.brand }]}
                >
                  <Text style={{ color: channel === ch ? "#fff" : colors.onSurface, fontWeight: "600" }}>{ch === "sms" ? "SMS" : "WhatsApp"}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Message</Text>
            <TextInput testID="reminder-message-input" value={msg} onChangeText={setMsg} style={[styles.input, { height: 100, textAlignVertical: "top" }]} multiline placeholderTextColor={colors.muted} />
            {sent && <Text style={{ color: colors.success, marginTop: spacing.md, textAlign: "center" }} testID="reminder-sent-toast">✓ Reminder queued (MOCKED)</Text>}
            <Pressable
              testID="send-reminder-button"
              disabled={sending}
              onPress={async () => {
                setSending(true);
                try { await onSend(channel, msg); } catch (e) { console.warn(e); }
                setSending(false);
                setSent(true);
                setTimeout(() => { setSent(false); onClose(); }, 2200);
              }}
              style={[styles.cta, { marginTop: spacing.lg }, sending && { opacity: 0.7 }]}
            >
              <Text style={styles.ctaText}>{sending ? "Sending…" : `Send via ${channel.toUpperCase()}`}</Text>
            </Pressable>
            <Text style={{ color: colors.muted, fontSize: sizes.sm, textAlign: "center", marginTop: spacing.sm }}>
              Note: SMS/WhatsApp delivery is MOCKED. Add Twilio credentials to enable real sending.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: 4 },
  sectionTitle: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface },
  addRx: { backgroundColor: colors.brand, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 4 },
  emptyRx: { padding: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  rxCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  rxDate: { fontSize: sizes.base, fontWeight: "700", color: colors.brand, marginBottom: spacing.sm },
  rxGrid: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.sm, padding: spacing.sm },
  rxCol: { flex: 1, alignItems: "center", gap: 4 },
  rxColHeader: { fontSize: 10, color: colors.muted, fontWeight: "700", letterSpacing: 0.5 },
  rxEyeLabel: { fontSize: sizes.sm, fontWeight: "700", color: colors.onSurface, fontFamily: "Courier" },
  rxVal: { fontSize: sizes.base, color: colors.onSurface, fontFamily: "Courier", fontVariant: ["tabular-nums"] },
  rxPD: { marginTop: spacing.sm, color: colors.onSurfaceSecondary, fontSize: sizes.sm },
  rxNotes: { marginTop: spacing.sm, color: colors.onSurfaceSecondary, fontSize: sizes.sm, fontStyle: "italic" },
  aiBox: { marginTop: spacing.md, backgroundColor: colors.brandTertiary, padding: spacing.md, borderRadius: radius.md },
  aiTitle: { fontWeight: "700", color: colors.onBrandTertiary, fontSize: sizes.base },
  aiBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  aiBtnText: { color: colors.brand, fontWeight: "700", fontSize: sizes.sm },
  aiText: { marginTop: spacing.sm, color: colors.onBrandTertiary, fontSize: sizes.base, lineHeight: 20 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: spacing.md, borderRadius: radius.md },
  actionTxt: { color: "#fff", fontWeight: "700", fontSize: sizes.sm },
  label: { fontSize: sizes.sm, fontWeight: "600", color: colors.onSurfaceSecondary, marginBottom: spacing.xs },
  miniLabel: { fontSize: 10, fontWeight: "700", color: colors.muted, marginBottom: 4 },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: sizes.base, color: colors.onSurface },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%" },
  modalHeader: { padding: spacing.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: sizes.xl, fontWeight: "700", color: colors.onSurface },
  cta: { backgroundColor: colors.brand, padding: spacing.lg, borderRadius: radius.md, alignItems: "center" },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: sizes.lg },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
});
