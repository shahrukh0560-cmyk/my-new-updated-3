import { useCallback, useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform, Modal, KeyboardAvoidingView } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, spacing, radius, sizes } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";
import { openWhatsApp, orderSummaryMessage } from "@/src/utils/whatsapp";

const currency = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const STATUSES = [
  { key: "received", label: "Received", icon: "checkmark-done-outline" },
  { key: "frame_selected", label: "Frame Selected", icon: "glasses-outline" },
  { key: "lens_ordered", label: "Lens Ordered", icon: "cart-outline" },
  { key: "lab_processing", label: "Lab Processing", icon: "flask-outline" },
  { key: "edging", label: "Edging", icon: "construct-outline" },
  { key: "fitting", label: "Fitting", icon: "build-outline" },
  { key: "qc", label: "Quality Check", icon: "shield-checkmark-outline" },
  { key: "ready", label: "Ready", icon: "checkmark-circle-outline" },
  { key: "delivered", label: "Delivered", icon: "bag-handle-outline" },
];

const STATUS_COLORS: any = {
  received: colors.brand,
  frame_selected: colors.brand,
  lens_ordered: colors.brandSecondary,
  lab_processing: "#7C57B5",
  edging: "#7C57B5",
  fitting: colors.warning,
  qc: colors.warning,
  ready: colors.success,
  delivered: colors.success,
  cancelled: colors.error,
};

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth() as any;
  const [o, setO] = useState<any>(null);
  const [pay, setPay] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [showEdit, setShowEdit] = useState(false);

  const load = useCallback(async () => {
    try { setO(await api(`/orders/${id}`)); } catch (e) { console.warn(e); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addPayment = async () => {
    const amt = Number(pay);
    if (!amt || amt <= 0) return;
    try { await api(`/orders/${id}/payment?amount=${amt}`, { method: "POST" }); setPay(""); load(); } catch (e) { console.warn(e); }
  };

  const setStatus = async (status: string) => {
    setBusy(true);
    try { await api(`/orders/${id}/status`, { method: "POST", body: { status } }); load(); } catch (e) { console.warn(e); }
    finally { setBusy(false); }
  };

  const sendReviewRequest = () => {
    if (!o) return;
    const reviewUrl = user?.google_review_url || "";
    const biz = user?.business_name || "our store";
    if (!reviewUrl) {
      setToast("Add your Google review URL in Settings first.");
      setTimeout(() => setToast(""), 4000);
      return;
    }
    const first = (o.customer_name || "").split(" ")[0] || "there";
    const msg = `Hi ${first}! Thank you for choosing ${biz}. If you loved our service, could you spare 30s to leave us a Google review? ⭐️\n${reviewUrl}`;
    openWhatsApp(o.customer_phone, msg);
  };

  const shareInvoice = async () => {
    if (!o) return;
    setToast("");
    try {
      const html = buildInvoiceHTML(o);
      if (Platform.OS === "web") {
        const w = window.open("", "_blank");
        if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
        return;
      }
      const Print = await import("expo-print");
      const Sharing = await import("expo-sharing");
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `Invoice ${o.invoice_no}` });
      } else {
        setToast("PDF saved at " + uri);
      }
    } catch (e: any) { setToast(e?.message || "Failed to generate invoice"); }
    finally { setTimeout(() => setToast(""), 4000); }
  };

  if (!o) return <View style={{ flex: 1, backgroundColor: colors.surface }}><ScreenHeader title="Loading…" /></View>;

  const currentIdx = STATUSES.findIndex((s) => s.key === o.fulfillment_status);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader
        title={`${o.invoice_no || "Order"}`}
        right={
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Pressable testID="edit-order-button" onPress={() => setShowEdit(true)} hitSlop={10}>
              <Ionicons name="create-outline" size={20} color={colors.brand} />
            </Pressable>
            <Pressable
              testID="whatsapp-order-button"
              onPress={() => openWhatsApp(o.customer_phone, orderSummaryMessage(o))}
              hitSlop={10}
            >
              <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
            </Pressable>
            <Pressable testID="share-invoice-button" onPress={shareInvoice} hitSlop={10}>
              <Ionicons name="share-outline" size={20} color={colors.brand} />
            </Pressable>
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <View style={styles.card}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={styles.invoiceNo}>{o.invoice_no}</Text>
              <Text style={styles.dateText}>{new Date(o.created_at).toLocaleString()}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[o.fulfillment_status] || colors.brand) + "22" }]}>
              <Text style={{ color: STATUS_COLORS[o.fulfillment_status] || colors.brand, fontWeight: "700", fontSize: 11 }}>
                {(o.fulfillment_status || "received").toUpperCase().replace("_", " ")}
              </Text>
            </View>
          </View>
          <Text style={styles.cust}>{o.customer_name} · {o.customer_phone}</Text>

          <Text style={styles.section}>Items</Text>
          {o.lines.map((l: any, i: number) => (
            <View key={i} style={styles.lineRow} testID={`detail-line-${i}`}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontWeight: "600" }}>{l.name}</Text>
                <Text style={{ color: colors.muted, fontSize: sizes.sm }}>{currency(l.price)} × {l.quantity} · GST {l.gst_rate}%</Text>
              </View>
              <Text style={{ fontWeight: "700", color: colors.onSurface }}>{currency(l.total)}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, { marginTop: spacing.md }]}>
          <SummaryRow label="Subtotal" value={currency(o.subtotal)} />
          <SummaryRow label="GST" value={currency(o.gst_amount || 0)} />
          <SummaryRow label="Discount" value={`- ${currency(o.discount || 0)}`} />
          <View style={styles.div} />
          <SummaryRow label="Total" value={currency(o.total)} bold />
          <SummaryRow label="Paid" value={currency(o.paid)} />
          <SummaryRow label="Due" value={currency(o.due)} bold color={o.due > 0 ? colors.warning : colors.success} />
        </View>

        <View style={[styles.card, { marginTop: spacing.md }]} testID="pipeline-card">
          <Text style={styles.section}>Fulfillment Pipeline</Text>
          <View style={styles.pipeline}>
            {STATUSES.map((s, i) => {
              const reached = i <= currentIdx;
              return (
                <Pressable
                  key={s.key}
                  testID={`pipeline-${s.key}`}
                  disabled={busy}
                  onPress={() => setStatus(s.key)}
                  style={[styles.pipeStep, reached && { backgroundColor: STATUS_COLORS[s.key] || colors.brand, borderColor: STATUS_COLORS[s.key] || colors.brand }]}
                >
                  <Ionicons name={s.icon as any} size={14} color={reached ? "#fff" : colors.muted} />
                  <Text style={[styles.pipeTxt, reached && { color: "#fff" }]}>{s.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            testID="cancel-order-button"
            disabled={busy || o.fulfillment_status === "cancelled" || o.fulfillment_status === "delivered"}
            onPress={() => setStatus("cancelled")}
            style={[styles.cancelBtn, (o.fulfillment_status === "cancelled" || o.fulfillment_status === "delivered") && { opacity: 0.4 }]}
          >
            <Ionicons name="close-circle-outline" size={14} color={colors.error} />
            <Text style={{ color: colors.error, fontWeight: "700", fontSize: sizes.sm }}>Cancel order</Text>
          </Pressable>
        </View>

        {(o.timeline || []).length > 0 && (
          <View style={[styles.card, { marginTop: spacing.md }]} testID="timeline-card">
            <Text style={styles.section}>History</Text>
            {[...o.timeline].reverse().map((t: any, i: number) => (
              <View key={i} style={styles.tlRow}>
                <View style={[styles.tlDot, { backgroundColor: STATUS_COLORS[t.status] || colors.brand }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.tlTitle}>{t.status.replace("_", " ").toUpperCase()}{t.by ? ` · ${t.by}` : ""}</Text>
                  <Text style={styles.tlSub}>{new Date(t.at).toLocaleString()}{t.note ? ` · ${t.note}` : ""}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {o.due > 0 && (
          <View style={[styles.card, { marginTop: spacing.md }]} testID="add-payment-card">
            <Text style={styles.section}>Add Payment</Text>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <TextInput
                testID="payment-amount-input"
                value={pay}
                onChangeText={setPay}
                placeholder={`Up to ${currency(o.due)}`}
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                style={[styles.input, { flex: 1 }]}
              />
              <Pressable testID="record-payment-button" onPress={addPayment} style={styles.cta}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.ctaText}> Record</Text>
              </Pressable>
            </View>
          </View>
        )}

        {!!o.notes && (
          <View style={[styles.card, { marginTop: spacing.md }]}>
            <Text style={styles.section}>Notes</Text>
            <Text style={{ color: colors.onSurfaceSecondary }}>{o.notes}</Text>
          </View>
        )}

        {o.fulfillment_status === "delivered" && (
          <Pressable
            testID="send-review-request"
            onPress={sendReviewRequest}
            style={[styles.reviewBtn]}
          >
            <Ionicons name="star" size={18} color="#fff" />
            <Text style={styles.reviewTxt}>Ask for Google Review on WhatsApp</Text>
          </Pressable>
        )}

        {!!toast && <Text style={styles.toast} testID="invoice-toast">{toast}</Text>}
      </ScrollView>

      <OrderEditModal
        visible={showEdit}
        order={o}
        onClose={() => setShowEdit(false)}
        onSaved={() => { setShowEdit(false); load(); }}
      />
    </View>
  );
}

function OrderEditModal({ visible, order, onClose, onSaved }: any) {
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (visible && order) {
      setForm({
        discount: String(order.discount ?? 0),
        notes: order.notes || "",
        customer_address: order.customer_address || "",
        customer_gstin: order.customer_gstin || "",
        expected_delivery_date: order.expected_delivery_date || "",
      });
      setErr("");
    }
  }, [visible, order]);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const onSave = async () => {
    setBusy(true); setErr("");
    try {
      const body: any = {
        discount: Number(form.discount) || 0,
        notes: form.notes || "",
        customer_address: form.customer_address || "",
        customer_gstin: form.customer_gstin || "",
        expected_delivery_date: form.expected_delivery_date || "",
      };
      await api(`/orders/${order.id}`, { method: "PATCH", body });
      onSaved();
    } catch (e: any) { setErr(e?.message || "Failed to update order"); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Order</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={colors.onSurface} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            <Text style={styles.editLabel}>Discount (₹)</Text>
            <TextInput
              testID="edit-order-discount"
              value={form.discount}
              onChangeText={(v) => set("discount", v)}
              keyboardType="numeric"
              style={styles.input}
              placeholderTextColor={colors.muted}
            />
            <Text style={[styles.editLabel, { marginTop: spacing.md }]}>Notes</Text>
            <TextInput
              testID="edit-order-notes"
              value={form.notes}
              onChangeText={(v) => set("notes", v)}
              style={[styles.input, { height: 80, textAlignVertical: "top" }]}
              multiline
              placeholderTextColor={colors.muted}
            />
            <Text style={[styles.editLabel, { marginTop: spacing.md }]}>Customer address (for invoice)</Text>
            <TextInput
              testID="edit-order-address"
              value={form.customer_address}
              onChangeText={(v) => set("customer_address", v)}
              style={styles.input}
              placeholderTextColor={colors.muted}
            />
            <Text style={[styles.editLabel, { marginTop: spacing.md }]}>Customer GSTIN</Text>
            <TextInput
              testID="edit-order-gstin"
              value={form.customer_gstin}
              onChangeText={(v) => set("customer_gstin", v)}
              autoCapitalize="characters"
              style={styles.input}
              placeholderTextColor={colors.muted}
            />
            <Text style={[styles.editLabel, { marginTop: spacing.md }]}>Expected delivery date (YYYY-MM-DD)</Text>
            <TextInput
              testID="edit-order-expected-date"
              value={form.expected_delivery_date}
              onChangeText={(v) => set("expected_delivery_date", v)}
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
            />
            {err ? <Text style={{ color: colors.error, marginTop: spacing.sm }}>{err}</Text> : null}
            <Pressable
              testID="save-order-edit-button"
              onPress={onSave}
              disabled={busy}
              style={[styles.cta, { marginTop: spacing.lg, flexDirection: "row", justifyContent: "center" }, busy && { opacity: 0.7 }]}
            >
              <Text style={styles.ctaText}>{busy ? "Saving…" : "Update Order"}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SummaryRow({ label, value, bold, color }: any) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
      <Text style={{ color: colors.muted, fontSize: sizes.base }}>{label}</Text>
      <Text style={{ color: color || colors.onSurface, fontWeight: bold ? "700" : "500", fontSize: sizes.base }}>{value}</Text>
    </View>
  );
}

function buildInvoiceHTML(o: any) {
  const inr = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const lines = o.lines.map((l: any) => `
    <tr>
      <td>${escapeHtml(l.name)}</td>
      <td>${l.hsn_code || "-"}</td>
      <td style="text-align:center">${l.quantity}</td>
      <td style="text-align:right">${inr(l.price)}</td>
      <td style="text-align:center">${l.gst_rate}%</td>
      <td style="text-align:right">${inr(l.gst_amount)}</td>
      <td style="text-align:right">${inr(l.total)}</td>
    </tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
    *{box-sizing:border-box;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
    body{padding:32px;color:#1A1D1A}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #4A5D4E;padding-bottom:16px;margin-bottom:24px}
    .brand{color:#4A5D4E;font-size:28px;font-weight:800;letter-spacing:.5px}
    .meta{text-align:right;color:#4A4D4A;font-size:13px}
    .meta b{color:#1A1D1A;font-size:16px}
    .box{display:flex;gap:24px;margin-bottom:18px}
    .box>div{flex:1;background:#F7F8F7;padding:14px;border-radius:8px}
    .box h4{margin:0 0 6px;font-size:11px;letter-spacing:.5px;color:#8A8D8A;text-transform:uppercase}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th{background:#EEF0EE;text-align:left;padding:10px;font-size:12px;color:#4A4D4A;text-transform:uppercase;letter-spacing:.4px}
    td{padding:10px;border-bottom:1px solid #E5E7E5;font-size:13px}
    .tot{margin-top:12px;width:300px;margin-left:auto}
    .tot tr td{border:0;padding:6px 8px}
    .tot .grand{background:#4A5D4E;color:#fff;border-radius:6px}
    .footer{margin-top:36px;color:#8A8D8A;font-size:11px;text-align:center}
  </style></head><body>
    <div class="head">
      <div>
        <div class="brand">OptiCRM · ARN Optical</div>
        <div style="color:#8A8D8A;font-size:12px;margin-top:4px">Tax Invoice</div>
      </div>
      <div class="meta">
        <b>${o.invoice_no || ""}</b><br/>${new Date(o.created_at).toLocaleString()}
      </div>
    </div>
    <div class="box">
      <div>
        <h4>Bill To</h4>
        <div><b>${escapeHtml(o.customer_name || "")}</b></div>
        <div>${escapeHtml(o.customer_phone || "")}</div>
        ${o.customer_address ? `<div>${escapeHtml(o.customer_address)}</div>` : ""}
        ${o.customer_gstin ? `<div>GSTIN: ${escapeHtml(o.customer_gstin)}</div>` : ""}
      </div>
      <div>
        <h4>Order</h4>
        <div>Status: <b>${(o.fulfillment_status || "received").replace("_", " ")}</b></div>
        <div>Payment: <b>${o.payment_status}</b></div>
      </div>
    </div>
    <table>
      <thead><tr><th>Item</th><th>HSN</th><th>Qty</th><th>Price</th><th>GST</th><th>GST ₹</th><th>Total</th></tr></thead>
      <tbody>${lines}</tbody>
    </table>
    <table class="tot">
      <tr><td>Subtotal</td><td style="text-align:right">${inr(o.subtotal)}</td></tr>
      <tr><td>GST</td><td style="text-align:right">${inr(o.gst_amount || 0)}</td></tr>
      <tr><td>Discount</td><td style="text-align:right">-${inr(o.discount || 0)}</td></tr>
      <tr class="grand"><td><b>Grand Total</b></td><td style="text-align:right"><b>${inr(o.total)}</b></td></tr>
      <tr><td>Paid</td><td style="text-align:right">${inr(o.paid)}</td></tr>
      <tr><td>Balance Due</td><td style="text-align:right"><b>${inr(o.due)}</b></td></tr>
    </table>
    <div class="footer">Thank you for choosing ARN Optical. This is a system-generated invoice.</div>
  </body></html>`;
}

function escapeHtml(s: string) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  invoiceNo: { fontSize: sizes.lg, fontWeight: "700", color: colors.brand, fontFamily: "Courier" },
  dateText: { color: colors.muted, fontSize: sizes.sm, marginTop: 2 },
  cust: { color: colors.onSurface, marginTop: spacing.sm, fontWeight: "600" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  section: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface, marginTop: spacing.md, marginBottom: spacing.sm },
  lineRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  div: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: sizes.lg, color: colors.onSurface },
  cta: { flexDirection: "row", alignItems: "center", backgroundColor: colors.brand, paddingHorizontal: spacing.lg, borderRadius: radius.md },
  ctaText: { color: "#fff", fontWeight: "700" },
  pipeline: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  pipeStep: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTertiary },
  pipeTxt: { fontSize: 11, color: colors.muted, fontWeight: "700" },
  cancelBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: spacing.md, padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.error + "55" },
  tlRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: 6 },
  tlDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  tlTitle: { fontSize: sizes.sm, fontWeight: "700", color: colors.onSurface },
  tlSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  toast: { textAlign: "center", color: colors.brand, marginTop: spacing.md },
  reviewBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: "#F59E0B", padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  reviewTxt: { color: "#fff", fontWeight: "700", fontSize: sizes.base },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%" },
  modalHeader: { padding: spacing.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: sizes.xl, fontWeight: "700", color: colors.onSurface },
  editLabel: { fontSize: sizes.sm, fontWeight: "600", color: colors.onSurfaceSecondary, marginBottom: spacing.xs },
});
