import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";

const INR = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const PLANS = [
  { id: "trial", name: "Trial", days: 14 },
  { id: "starter", name: "Starter", days: 30 },
  { id: "pro", name: "Pro", days: 30 },
  { id: "enterprise", name: "Enterprise", days: 30 },
];

function confirm(title: string, msg: string, onYes: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${msg}`)) onYes();
  } else {
    Alert.alert(title, msg, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", style: "destructive", onPress: onYes },
    ]);
  }
}

export default function TenantDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api(`/admin/tenants/${id}`);
      setData(d);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading || !data) {
    return <View style={[styles.center, { paddingTop: insets.top }]}><ActivityIndicator color={colors.brand} /></View>;
  }

  const t = data.tenant;
  const m = data.metrics;
  const sub = data.metrics?.subscription;
  const isSuspended = t.status === "suspended";

  const toggleStatus = async () => {
    const newStatus = isSuspended ? "active" : "suspended";
    confirm(
      newStatus === "suspended" ? "Suspend tenant?" : "Reactivate tenant?",
      newStatus === "suspended"
        ? `${t.email} will be blocked from signing in. Existing data is preserved.`
        : `${t.email} will be able to sign in again.`,
      async () => {
        setActing(true);
        try {
          await api(`/admin/tenants/${id}/status`, { method: "POST", body: { status: newStatus } });
          await load();
        } catch (e: any) { Alert.alert("Error", e?.message || "Failed"); }
        finally { setActing(false); }
      }
    );
  };

  const grantPlan = async (planId: string, days: number) => {
    confirm(
      `Grant ${planId.toUpperCase()}?`,
      `Complimentary ${planId} for ${days} days. Skips Razorpay charge.`,
      async () => {
        setActing(true);
        try {
          await api(`/admin/tenants/${id}/subscription`, { method: "POST", body: { plan_id: planId, days } });
          await load();
        } catch (e: any) { Alert.alert("Error", e?.message || "Failed"); }
        finally { setActing(false); }
      }
    );
  };

  const onDelete = () => {
    confirm(
      "Delete tenant permanently?",
      `Wipes ALL data for ${t.email} (customers, orders, inventory, branches, sub-users, subscription). This cannot be undone.`,
      async () => {
        setActing(true);
        try {
          await api(`/admin/tenants/${id}`, { method: "DELETE" });
          router.back();
        } catch (e: any) { Alert.alert("Error", e?.message || "Failed"); setActing(false); }
      }
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{t.name || t.email}</Text>
          <Text style={styles.sub}>{t.email}</Text>
        </View>
        {isSuspended && (
          <View style={styles.suspendBadge}>
            <Ionicons name="warning" size={12} color={colors.error} />
            <Text style={styles.suspendTxt}>SUSPENDED</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        {/* Subscription */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Subscription</Text>
          <View style={styles.planNow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.planNowLabel}>Current plan</Text>
              <Text style={styles.planNowVal}>{(sub?.plan_id || "trial").toUpperCase()}</Text>
              {sub?.expires_at ? (
                <Text style={styles.planNowExp}>Expires {new Date(sub.expires_at).toLocaleDateString()}</Text>
              ) : null}
            </View>
            <View style={[styles.subStatus, { backgroundColor: sub?.status === "active" ? colors.brandTertiary : "#FAD3D4" }]}>
              <Text style={[styles.subStatusTxt, { color: sub?.status === "active" ? colors.success : colors.error }]}>
                {(sub?.status || "inactive").toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.cardSub}>Grant complimentary plan (skips Razorpay)</Text>
          <View style={styles.planGrid}>
            {PLANS.map((p) => (
              <Pressable
                key={p.id}
                testID={`grant-${p.id}`}
                disabled={acting}
                onPress={() => grantPlan(p.id, p.days)}
                style={[styles.planBtn, sub?.plan_id === p.id && styles.planBtnActive]}
              >
                <Text style={[styles.planBtnTxt, sub?.plan_id === p.id && styles.planBtnTxtActive]}>{p.name}</Text>
                <Text style={[styles.planBtnDays, sub?.plan_id === p.id && { color: "rgba(255,255,255,0.85)" }]}>{p.days}d</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Metrics */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Usage</Text>
          <View style={styles.metricGrid}>
            <MetricBlock label="Customers" value={m.customers} icon="people-outline" color={colors.brand} />
            <MetricBlock label="Inventory" value={m.inventory} icon="glasses-outline" color={colors.brandSecondary} />
            <MetricBlock label="Orders" value={m.orders} icon="receipt-outline" color={colors.success} />
            <MetricBlock label="Branches" value={m.branches} icon="business-outline" color={colors.warning} />
            <MetricBlock label="Revenue" value={INR(m.revenue)} icon="cash-outline" color={colors.success} wide />
            <MetricBlock label="Due" value={INR(m.due)} icon="alert-circle-outline" color={colors.error} wide />
          </View>
        </View>

        {/* Branches */}
        {data.branches?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Branches ({data.branches.length})</Text>
            {data.branches.map((b: any) => (
              <View key={b.id} style={styles.listRow}>
                <Ionicons name="business-outline" size={16} color={colors.brand} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.listRowTitle}>{b.name}</Text>
                  {b.address ? <Text style={styles.listRowSub}>{b.address}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Recent orders */}
        {data.recent_orders?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent orders</Text>
            {data.recent_orders.map((o: any) => (
              <View key={o.id} style={styles.listRow}>
                <Ionicons name="receipt-outline" size={16} color={colors.brand} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.listRowTitle}>{o.invoice_no} · {o.customer_name}</Text>
                  <Text style={styles.listRowSub}>{INR(o.total)} · {o.payment_status}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Danger zone */}
        <View style={[styles.card, { borderColor: colors.error + "55" }]}>
          <Text style={[styles.cardTitle, { color: colors.error }]}>Admin actions</Text>
          <Pressable
            testID="toggle-suspend"
            disabled={acting}
            onPress={toggleStatus}
            style={[styles.dangerBtn, { backgroundColor: isSuspended ? colors.brandTertiary : "#FAD3D4" }]}
          >
            <Ionicons name={isSuspended ? "refresh-circle-outline" : "pause-circle-outline"} size={18} color={isSuspended ? colors.success : colors.error} />
            <Text style={[styles.dangerBtnTxt, { color: isSuspended ? colors.success : colors.error }]}>
              {isSuspended ? "Reactivate tenant" : "Suspend tenant"}
            </Text>
          </Pressable>
          <Pressable
            testID="delete-tenant"
            disabled={acting}
            onPress={onDelete}
            style={[styles.dangerBtn, { backgroundColor: colors.error }]}
          >
            <Ionicons name="trash-outline" size={18} color="#fff" />
            <Text style={[styles.dangerBtnTxt, { color: "#fff" }]}>Delete tenant permanently</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function MetricBlock({ label, value, icon, color, wide }: { label: string; value: any; icon: any; color: string; wide?: boolean }) {
  return (
    <View style={[styles.metricBlock, wide && { width: "100%" }]}>
      <View style={[styles.metricIcon, { backgroundColor: color + "22" }]}><Ionicons name={icon} size={16} color={color} /></View>
      <Text style={styles.metricVal} numberOfLines={1}>{value}</Text>
      <Text style={styles.metricLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingBottom: spacing.md, backgroundColor: colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  backBtn: { padding: spacing.sm },
  title: { fontSize: sizes.xl, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  suspendBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FAD3D4", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  suspendTxt: { fontSize: 10, fontWeight: "800", color: colors.error, letterSpacing: 0.5 },
  card: { padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  cardTitle: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.md },
  cardSub: { fontSize: sizes.sm, color: colors.muted, marginTop: spacing.md, marginBottom: spacing.sm },
  planNow: { flexDirection: "row", alignItems: "center" },
  planNowLabel: { fontSize: sizes.sm, color: colors.muted },
  planNowVal: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface, marginTop: 2 },
  planNowExp: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  subStatus: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 6 },
  subStatusTxt: { fontSize: sizes.sm, fontWeight: "800", letterSpacing: 0.5 },
  planGrid: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  planBtn: { flex: 1, minWidth: "22%", padding: spacing.md, alignItems: "center", borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  planBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  planBtnTxt: { fontSize: sizes.base, fontWeight: "700", color: colors.onSurface },
  planBtnTxtActive: { color: "#fff" },
  planBtnDays: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metricBlock: { width: "31%", padding: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, alignItems: "flex-start", gap: 6 },
  metricIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  metricVal: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface },
  metricLbl: { fontSize: sizes.sm, color: colors.muted },
  listRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  listRowTitle: { fontSize: sizes.base, fontWeight: "600", color: colors.onSurface },
  listRowSub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  dangerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm },
  dangerBtnTxt: { fontSize: sizes.base, fontWeight: "700" },
});
