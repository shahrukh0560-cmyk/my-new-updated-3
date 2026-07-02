import { useCallback, useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";
import { openWhatsApp } from "@/src/utils/whatsapp";
import DateField from "@/src/components/DateField";

const RX_FIELDS = ["od_sph","od_cyl","od_axis","od_add","os_sph","os_cyl","os_axis","os_add","pd"] as const;
type RxKey = typeof RX_FIELDS[number];

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function CustomerDetail() {
  const { id, existing } = useLocalSearchParams<{ id: string; existing?: string }>();
  const router = useRouter();
  const [c, setC] = useState<any>(null);
  const [showRx, setShowRx] = useState(false);
  const [editRx, setEditRx] = useState<any>(null);
  const [showEditCust, setShowEditCust] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [existingBanner, setExistingBanner] = useState(existing === "1");
  const [rxSharingId, setRxSharingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (existingBanner) {
      const t = setTimeout(() => setExistingBanner(false), 5000);
      return () => clearTimeout(t);
    }
  }, [existingBanner]);

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

  const shareRxAsPdf = async (rx: any) => {
    if (!c) return;
    setRxSharingId(rx.id);
    setToast("");
    try {
      if (Platform.OS === "web") {
        // Web: get a signed public link, then open WhatsApp with the link
        const res = await api(`/customers/${id}/prescriptions/${rx.id}/share-link`, { method: "POST" });
        const link = res?.url;
        if (!link) throw new Error("Could not create share link");
        const msg = `Hi ${c.name || ""},\nYour eyewear prescription (PDF): ${link}\n(Link valid for 7 days)`;
        openWhatsApp(c.phone, msg);
        setToast("WhatsApp opened — attach or send the PDF link");
      } else {
        // Native: download the PDF with auth then use the share sheet
        let token: string | null = null;
        try { token = await SecureStore.getItemAsync("opticrm_token"); } catch {}
        const url = `${BACKEND}/api/customers/${id}/prescriptions/${rx.id}/pdf`;
        const filename = `Rx-${(c.name || "customer").replace(/\s+/g, "_")}-${rx.date || ""}.pdf`;
        const dest = `${FileSystem.cacheDirectory}${filename}`;
        const download = await FileSystem.downloadAsync(url, dest, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(download.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Share prescription" });
        } else {
          setToast("Downloaded PDF but sharing not available on this device");
        }
      }
    } catch (e: any) {
      setToast(e?.message || "Failed to share prescription PDF");
    } finally {
      setRxSharingId(null);
      setTimeout(() => setToast(""), 4500);
    }
  };

  const deleteRx = async (rxId: string) => {
    try { await api(`/customers/${id}/prescriptions/${rxId}`, { method: "DELETE" }); load(); } catch (e) { console.warn(e); }
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
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Pressable testID="edit-customer-button" onPress={() => setShowEditCust(true)} hitSlop={10}>
              <Ionicons name="create-outline" size={20} color={colors.brand} />
            </Pressable>
            <Pressable testID="delete-customer-button" onPress={removeCustomer} hitSlop={10}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </Pressable>
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {existingBanner && (
          <View style={styles.existingBanner} testID="existing-customer-banner">
            <Ionicons name="information-circle" size={18} color={colors.warning} />
            <Text style={styles.existingTxt}>A customer with this mobile already exists — showing their record.</Text>
          </View>
        )}
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

        {!!toast && <Text style={styles.toastLine} testID="rx-share-toast">{toast}</Text>}

        {(c.prescriptions || []).map((rx: any) => (
          <View key={rx.id} style={styles.rxCard} testID={`rx-card-${rx.id}`}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.rxDate}>Rx · {rx.date}</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pressable
                  testID={`edit-rx-${rx.id}`}
                  onPress={() => setEditRx(rx)}
                  style={[styles.rxIconBtn, { backgroundColor: colors.brandSecondary }]}
                  hitSlop={6}
                >
                  <Ionicons name="create-outline" size={14} color="#fff" />
                </Pressable>
                <Pressable
                  testID={`delete-rx-${rx.id}`}
                  onPress={() => deleteRx(rx.id)}
                  style={[styles.rxIconBtn, { backgroundColor: colors.error }]}
                  hitSlop={6}
                >
                  <Ionicons name="trash-outline" size={14} color="#fff" />
                </Pressable>
                <Pressable
                  testID={`whatsapp-rx-${rx.id}`}
                  onPress={() => shareRxAsPdf(rx)}
                  disabled={rxSharingId === rx.id}
                  style={[styles.waRxBtn, rxSharingId === rx.id && { opacity: 0.6 }]}
                  hitSlop={6}
                >
                  <Ionicons name="logo-whatsapp" size={14} color="#fff" />
                  <Text style={styles.waRxTxt}>{rxSharingId === rx.id ? "…" : "Send PDF"}</Text>
                </Pressable>
              </View>
            </View>
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
        visible={showRx || !!editRx}
        initial={editRx}
        onClose={() => { setShowRx(false); setEditRx(null); }}
        onSave={async (body: any) => {
          if (editRx) {
            await api(`/customers/${id}/prescriptions/${editRx.id}`, { method: "PUT", body });
          } else {
            await api(`/customers/${id}/prescriptions`, { method: "POST", body });
          }
          setShowRx(false); setEditRx(null);
          load();
        }}
      />
      <EditCustomerModal
        visible={showEditCust}
        customer={c}
        onClose={() => setShowEditCust(false)}
        onSaved={() => { setShowEditCust(false); load(); }}
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

function RxModal({ visible, onClose, onSave, initial }: any) {
  const [form, setForm] = useState<any>({ date: new Date().toISOString().slice(0,10) });
  useEffect(() => {
    if (initial) {
      const f: any = { date: initial.date || new Date().toISOString().slice(0,10) };
      ["od_sph","od_cyl","od_axis","od_add","os_sph","os_cyl","os_axis","os_add","pd","notes","doctor_name","rx_type"].forEach((k) => {
        if (initial[k] !== undefined && initial[k] !== null) f[k] = String(initial[k]);
      });
      setForm(f);
    } else if (visible) {
      setForm({ date: new Date().toISOString().slice(0,10) });
    }
  }, [initial, visible]);
  const set = (k: string, v: string) => setForm({ ...form, [k]: v });
  const parseNum = (v: string) => v === "" || v === undefined ? null : Number(v);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{initial ? "Edit Prescription" : "New Prescription"}</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={colors.onSurface} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            <Text style={styles.label}>Date</Text>
            <DateField testID="rx-date-input" value={form.date} onChange={(v) => set("date", v)} />
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
              <Text style={styles.ctaText}>{initial ? "Update Prescription" : "Save Prescription"}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function EditCustomerModal({ visible, customer, onClose, onSaved }: any) {
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (visible && customer) {
      setForm({
        name: customer.name || "",
        phone: customer.phone || "",
        email: customer.email || "",
        address: customer.address || "",
        dob: customer.dob || "",
        birthday: customer.birthday || "",
        anniversary: customer.anniversary || "",
        gstin: customer.gstin || "",
        notes: customer.notes || "",
        branch_id: customer.branch_id || null,
      });
      setErr("");
    }
  }, [visible, customer]);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const onSave = async () => {
    if (!form.name?.trim() || !form.phone?.trim()) { setErr("Name and phone are required"); return; }
    setBusy(true); setErr("");
    try {
      await api(`/customers/${customer.id}`, { method: "PUT", body: form });
      onSaved();
    } catch (e: any) { setErr(e?.message || "Failed to update"); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Customer</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={colors.onSurface} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            {(["name","phone","email","address","dob","birthday","anniversary","gstin","notes"] as const).map((k) => {
              const isDate = k === "dob" || k === "birthday" || k === "anniversary";
              return (
                <View key={k} style={{ marginBottom: spacing.md }}>
                  <Text style={styles.label}>{
                    k === "dob" ? "Date of birth" :
                    k === "birthday" ? "Birthday" :
                    k === "anniversary" ? "Anniversary" :
                    k === "gstin" ? "GSTIN" :
                    k[0].toUpperCase() + k.slice(1)
                  }{(k === "name" || k === "phone") ? " *" : ""}</Text>
                  {isDate ? (
                    <DateField
                      testID={`edit-customer-${k}-input`}
                      value={form[k] || ""}
                      onChange={(v) => set(k, v)}
                    />
                  ) : (
                    <TextInput
                      testID={`edit-customer-${k}-input`}
                      value={form[k] || ""}
                      onChangeText={(v) => set(k, v)}
                      style={[styles.input, k === "notes" && { height: 90, textAlignVertical: "top" }]}
                      multiline={k === "notes"}
                      autoCapitalize={k === "email" ? "none" : "sentences"}
                      keyboardType={k === "phone" ? "phone-pad" : k === "email" ? "email-address" : "default"}
                      placeholderTextColor={colors.muted}
                    />
                  )}
                </View>
              );
            })}
            {err ? <Text style={{ color: colors.error }} testID="edit-customer-error">{err}</Text> : null}
            <Pressable testID="save-edit-customer-button" onPress={onSave} disabled={busy} style={[styles.cta, { marginTop: spacing.lg }, busy && { opacity: 0.7 }]}>
              <Text style={styles.ctaText}>{busy ? "Saving…" : "Update Customer"}</Text>
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
  waRxBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#25D366", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  waRxTxt: { color: "#fff", fontWeight: "700", fontSize: 11 },
  rxIconBtn: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  existingBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.warning + "22", borderRadius: radius.md, borderWidth: 1, borderColor: colors.warning + "55", marginBottom: spacing.md },
  existingTxt: { color: colors.warning, flex: 1, fontSize: sizes.sm, fontWeight: "600" },
  toastLine: { color: colors.brand, marginTop: spacing.md, textAlign: "center", fontWeight: "700", fontSize: sizes.sm },
});
