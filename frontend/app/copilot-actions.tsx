import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";

const QUICK_ACTIONS = [
  { key: "discount", label: "Send 15% off to dormant customers (6 months)", prompt: "Send 15% off to customers who haven't visited in 6 months" },
  { key: "review", label: "Ask for Google reviews from recent deliveries", prompt: "Send Google review requests to customers whose orders were delivered in the last 30 days" },
  { key: "restock", label: "Show me items to restock", prompt: "Which items are running low and I should reorder?" },
  { key: "welcome-back", label: "Welcome back for 3+ month absentees", prompt: "Send 10% welcome-back offer to customers who haven't visited in 90 days" },
];

export default function CopilotActions() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [err, setErr] = useState("");
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const runPlan = useCallback(async (q?: string) => {
    const text = (q ?? prompt).trim();
    if (!text) return;
    setBusy(true); setErr(""); setPlan(null); setSentIds(new Set());
    try {
      const res = await api("/copilot/plan-action", { method: "POST", body: { prompt: text } });
      setPlan(res);
    } catch (e: any) {
      setErr(e?.message || "Copilot could not plan this action");
    } finally {
      setBusy(false);
    }
  }, [prompt]);

  const openTarget = async (t: any) => {
    if (!t?.whatsapp_url) return;
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.open(t.whatsapp_url, "_blank");
      } else {
        await Linking.openURL(t.whatsapp_url);
      }
      setSentIds((s) => { const n = new Set(s); n.add(t.id); return n; });
    } catch {}
  };

  const openAllRemaining = async () => {
    if (!plan?.targets) return;
    const remaining = plan.targets.filter((t: any) => !sentIds.has(t.id) && t.whatsapp_url).slice(0, 8);
    for (const t of remaining) {
      await openTarget(t);
      await new Promise((r) => setTimeout(r, 400));
    }
  };

  const finalizeCampaign = async () => {
    if (!plan) return;
    try {
      await api("/copilot/record-campaign", {
        method: "POST",
        body: { intent: plan.intent, sent_customer_ids: Array.from(sentIds) },
      });
      router.back();
    } catch (e) { console.warn(e); }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      testID="copilot-actions-screen"
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="flash" size={18} color={colors.brand} />
            <Text style={styles.title}>Copilot Actions</Text>
          </View>
          <Text style={styles.sub}>AI does the work — draft & send WhatsApp campaigns</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <View style={styles.promptBox}>
          <TextInput
            testID="copilot-action-prompt"
            value={prompt}
            onChangeText={setPrompt}
            placeholder="e.g. Send 20% discount to customers dormant 6+ months"
            placeholderTextColor={colors.muted}
            multiline
            style={styles.promptInput}
          />
          <Pressable
            testID="copilot-action-run"
            onPress={() => runPlan()}
            disabled={busy || !prompt.trim()}
            style={[styles.runBtn, (busy || !prompt.trim()) && { opacity: 0.5 }]}
          >
            <Ionicons name="sparkles" size={16} color="#fff" />
            <Text style={styles.runTxt}>{busy ? "Planning…" : "Plan action"}</Text>
          </Pressable>
        </View>

        {!plan && !busy && (
          <>
            <Text style={styles.sectionHead}>Quick actions</Text>
            {QUICK_ACTIONS.map((qa) => (
              <Pressable key={qa.key} testID={`quick-${qa.key}`} onPress={() => runPlan(qa.prompt)} style={styles.quickCard}>
                <View style={styles.quickIcon}><Ionicons name="arrow-forward-circle" size={20} color={colors.brand} /></View>
                <Text style={styles.quickLabel}>{qa.label}</Text>
              </Pressable>
            ))}
          </>
        )}

        {busy && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={{ color: colors.muted, marginTop: spacing.sm }}>AI is analysing your data…</Text>
          </View>
        )}

        {err ? <Text style={{ color: colors.error, marginTop: spacing.md }} testID="copilot-action-error">{err}</Text> : null}

        {plan && !busy && (
          <View style={{ marginTop: spacing.md }}>
            <View style={styles.planCard}>
              <Text style={styles.planIntent}>Intent: {plan.intent}</Text>
              <Text style={styles.planSummary}>{plan.summary}</Text>
              {plan.draft_message ? (
                <View style={styles.messageBox}>
                  <Text style={styles.messageLabel}>Draft message</Text>
                  <Text style={styles.messageTxt}>{plan.draft_message}</Text>
                </View>
              ) : null}
            </View>

            {plan.count > 0 && plan.intent !== "restock_alert" ? (
              <View style={styles.actionsBar}>
                <Pressable testID="copilot-send-all" onPress={openAllRemaining} style={[styles.bulkBtn, { backgroundColor: "#25D366" }]}>
                  <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                  <Text style={styles.bulkTxt}>Open first {Math.min(8, (plan.count || 0) - sentIds.size)} on WhatsApp</Text>
                </Pressable>
                <Pressable testID="copilot-record-done" onPress={finalizeCampaign} style={[styles.bulkBtn, { backgroundColor: colors.brand }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text style={styles.bulkTxt}>Done ({sentIds.size} sent)</Text>
                </Pressable>
              </View>
            ) : null}

            {(plan.targets || []).map((t: any) => (
              <View key={t.id + (t.invoice_no || "")} style={styles.targetCard} testID={`target-${t.id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.targetName}>{t.name || "(unknown)"}</Text>
                  {t.phone ? <Text style={styles.targetSub}>{t.phone}{t.invoice_no ? ` · ${t.invoice_no}` : ""}</Text> : null}
                  {plan.intent === "restock_alert" ? (
                    <Text style={styles.targetSub}>Stock: {t.stock ?? 0} · Threshold: {t.threshold ?? "-"}{t.supplier ? ` · Supplier: ${t.supplier}` : ""}</Text>
                  ) : null}
                </View>
                {t.whatsapp_url ? (
                  <Pressable
                    testID={`target-send-${t.id}`}
                    onPress={() => openTarget(t)}
                    style={[styles.sendBtn, sentIds.has(t.id) && { backgroundColor: colors.success }]}
                  >
                    <Ionicons name={sentIds.has(t.id) ? "checkmark" : "logo-whatsapp"} size={16} color="#fff" />
                    <Text style={styles.sendTxt}>{sentIds.has(t.id) ? "Sent" : "Send"}</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}

            {plan.count === 0 && (
              <View style={styles.empty}>
                <Ionicons name="information-circle-outline" size={24} color={colors.muted} />
                <Text style={styles.emptyTxt}>No matching records found for this action.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  backBtn: { padding: spacing.xs, marginBottom: 2 },
  title: { fontSize: sizes.xl, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  promptBox: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  promptInput: { fontSize: sizes.base, color: colors.onSurface, minHeight: 60, textAlignVertical: "top" },
  runBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.brand, paddingVertical: 10, borderRadius: radius.sm, marginTop: spacing.sm },
  runTxt: { color: "#fff", fontWeight: "700" },
  sectionHead: { fontSize: sizes.sm, fontWeight: "700", color: colors.muted, marginTop: spacing.lg, marginBottom: spacing.sm, letterSpacing: 0.5, textTransform: "uppercase" },
  quickCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  quickIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  quickLabel: { flex: 1, fontSize: sizes.base, color: colors.onSurface, fontWeight: "600" },
  loading: { padding: spacing.xxxl, alignItems: "center" },
  planCard: { backgroundColor: colors.brandTertiary, padding: spacing.lg, borderRadius: radius.md },
  planIntent: { fontSize: sizes.sm, color: colors.muted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  planSummary: { fontSize: sizes.lg, color: colors.onSurface, fontWeight: "700", marginTop: 4 },
  messageBox: { backgroundColor: "#fff", padding: spacing.md, borderRadius: radius.sm, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  messageLabel: { fontSize: sizes.sm, color: colors.muted, fontWeight: "700" },
  messageTxt: { fontSize: sizes.base, color: colors.onSurface, marginTop: 4, lineHeight: 20 },
  actionsBar: { flexDirection: "row", gap: spacing.sm, marginVertical: spacing.md },
  bulkBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: radius.sm },
  bulkTxt: { color: "#fff", fontWeight: "700", fontSize: sizes.sm },
  targetCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  targetName: { fontSize: sizes.base, color: colors.onSurface, fontWeight: "600" },
  targetSub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  sendBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#25D366", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  sendTxt: { color: "#fff", fontWeight: "700", fontSize: sizes.sm },
  empty: { alignItems: "center", padding: spacing.xl, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  emptyTxt: { color: colors.muted, marginTop: spacing.sm },
});
