import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";

const INR = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const PLAN_META: Record<string, { name: string; color: string }> = {
  trial: { name: "Trial", color: colors.muted },
  starter: { name: "Starter", color: colors.brandSecondary },
  pro: { name: "Pro", color: colors.brand },
  enterprise: { name: "Enterprise", color: colors.warning },
};

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Guard: redirect non-super_admins
  useEffect(() => {
    if (user && user.role !== "super_admin") router.replace("/(tabs)/dashboard");
  }, [user, router]);

  const load = useCallback(async () => {
    try {
      setError("");
      const m = await api("/admin/metrics");
      setMetrics(m);
    } catch (e: any) {
      setError(e?.message || "Failed to load metrics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };
  const onLogout = async () => { await logout(); router.replace("/login"); };

  if (loading) {
    return <View style={[styles.center, { paddingTop: insets.top }]}><ActivityIndicator size="large" color={colors.brand} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Super Admin</Text>
          <Text style={styles.title}>Platform Console</Text>
          <Text style={styles.sub}>{user?.email}</Text>
        </View>
        <Pressable testID="admin-logout" onPress={onLogout} style={styles.iconBtn}>
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Revenue row */}
        <View style={styles.row}>
          <MetricCard testID="metric-mrr" label="MRR" value={INR(metrics?.mrr || 0)} icon="trending-up" tint={colors.brand} accent />
          <MetricCard testID="metric-arr" label="ARR (proj.)" value={INR(metrics?.arr || 0)} icon="cash-outline" tint={colors.success} />
        </View>

        <View style={styles.row}>
          <MetricCard testID="metric-gmv" label="Platform GMV" value={INR(metrics?.platform_gmv || 0)} icon="swap-horizontal-outline" tint={colors.brandSecondary} />
          <MetricCard testID="metric-gst" label="GST Collected" value={INR(metrics?.platform_gst || 0)} icon="receipt-outline" tint={colors.warning} />
        </View>

        {/* Tenants row */}
        <Pressable testID="go-tenants" onPress={() => router.push("/admin/tenants")} style={styles.bigCard}>
          <View style={styles.bigCardHead}>
            <View>
              <Text style={styles.bigCardLabel}>Total Shops</Text>
              <Text style={styles.bigCardValue}>{metrics?.total_tenants || 0}</Text>
            </View>
            <View style={[styles.iconWrap, { backgroundColor: colors.brandTertiary }]}>
              <Ionicons name="storefront-outline" size={26} color={colors.brand} />
            </View>
          </View>
          <View style={styles.miniRow}>
            <MiniStat color={colors.success} label="Active" value={metrics?.active_tenants || 0} />
            <MiniStat color={colors.error} label="Suspended" value={metrics?.suspended_tenants || 0} />
            <MiniStat color={colors.brandSecondary} label="New 7d" value={metrics?.new_tenants_7d || 0} />
            <MiniStat color={colors.warning} label="New 30d" value={metrics?.new_tenants_30d || 0} />
          </View>
          <View style={styles.cta}>
            <Text style={styles.ctaTxt}>Manage tenants</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.brand} />
          </View>
        </Pressable>

        {/* Plan breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Subscription Mix</Text>
          {Object.entries(metrics?.plan_breakdown || {}).map(([pid, count]: any) => {
            const meta = PLAN_META[pid] || { name: pid, color: colors.muted };
            const total = Object.values(metrics?.plan_breakdown || {}).reduce((a: number, b: any) => a + Number(b), 0) as number;
            const pct = total > 0 ? Math.round((Number(count) / total) * 100) : 0;
            return (
              <View key={pid} style={styles.planRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.planHead}>
                    <Text style={styles.planName}>{meta.name}</Text>
                    <Text style={styles.planCount}>{count} shops · {pct}%</Text>
                  </View>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: meta.color }]} />
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Aggregate usage */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Platform Usage</Text>
          <View style={styles.usageGrid}>
            <UsageTile icon="people-outline" label="Customers" value={metrics?.total_customers || 0} color={colors.brand} />
            <UsageTile icon="glasses-outline" label="Inventory" value={metrics?.total_inventory || 0} color={colors.brandSecondary} />
            <UsageTile icon="receipt-outline" label="Orders" value={metrics?.total_orders || 0} color={colors.success} />
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <Pressable testID="admin-action-tenants" onPress={() => router.push("/admin/tenants")} style={styles.actionTile}>
            <Ionicons name="business-outline" size={20} color={colors.brand} />
            <Text style={styles.actionTxt}>Tenants</Text>
          </Pressable>
          <Pressable testID="admin-action-broadcast" onPress={() => router.push("/admin/broadcast")} style={styles.actionTile}>
            <Ionicons name="megaphone-outline" size={20} color={colors.brand} />
            <Text style={styles.actionTxt}>Broadcast</Text>
          </Pressable>
          <Pressable testID="admin-action-signups" onPress={() => router.push({ pathname: "/admin/tenants", params: { sort: "new" } } as any)} style={styles.actionTile}>
            <Ionicons name="sparkles-outline" size={20} color={colors.brand} />
            <Text style={styles.actionTxt}>Signups</Text>
          </Pressable>
        </View>

        <View style={[styles.actionsRow, { marginTop: spacing.md }]}>
          <Pressable testID="admin-action-coupons" onPress={() => router.push("/admin/coupons")} style={styles.actionTile}>
            <Ionicons name="pricetag-outline" size={20} color={colors.brand} />
            <Text style={styles.actionTxt}>Coupons</Text>
          </Pressable>
          <Pressable testID="admin-action-referrals" onPress={() => router.push("/admin/referrals")} style={styles.actionTile}>
            <Ionicons name="people-circle-outline" size={20} color={colors.brand} />
            <Text style={styles.actionTxt}>Referrals</Text>
          </Pressable>
          <Pressable testID="admin-action-repairs" onPress={() => router.push("/admin/repairs")} style={styles.actionTile}>
            <Ionicons name="construct-outline" size={20} color={colors.brand} />
            <Text style={styles.actionTxt}>Repairs</Text>
          </Pressable>
        </View>
        <View style={[styles.actionsRow, { marginTop: spacing.md }]}>
          <Pressable testID="admin-action-wishes" onPress={() => router.push("/admin/wishes")} style={styles.actionTile}>
            <Ionicons name="gift-outline" size={20} color={colors.brand} />
            <Text style={styles.actionTxt}>Wishes Log</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function MetricCard({ label, value, icon, tint, accent, testID }: { label: string; value: string; icon: any; tint: string; accent?: boolean; testID?: string }) {
  return (
    <View testID={testID} style={[styles.metric, accent && { backgroundColor: colors.brand }]}>
      <View style={styles.metricHead}>
        <Text style={[styles.metricLabel, accent && { color: "rgba(255,255,255,0.85)" }]}>{label}</Text>
        <View style={[styles.metricIcon, { backgroundColor: accent ? "rgba(255,255,255,0.18)" : tint + "22" }]}>
          <Ionicons name={icon} size={16} color={accent ? "#fff" : tint} />
        </View>
      </View>
      <Text style={[styles.metricValue, accent && { color: "#fff" }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function MiniStat({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <View style={styles.miniStat}>
      <View style={[styles.miniDot, { backgroundColor: color }]} />
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function UsageTile({ icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <View style={styles.usageTile}>
      <View style={[styles.usageIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.usageValue}>{value}</Text>
      <Text style={styles.usageLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, backgroundColor: colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: colors.border },
  eyebrow: { fontSize: sizes.sm, fontWeight: "700", color: colors.brand, letterSpacing: 1, textTransform: "uppercase" },
  title: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface, marginTop: 2 },
  sub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  iconBtn: { padding: spacing.sm },
  error: { color: colors.error, marginBottom: spacing.md },
  row: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  metric: { flex: 1, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  metricHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metricLabel: { fontSize: sizes.sm, color: colors.muted, fontWeight: "600" },
  metricIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  metricValue: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface, marginTop: spacing.sm },
  bigCard: { backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  bigCardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bigCardLabel: { fontSize: sizes.sm, color: colors.muted, fontWeight: "600" },
  bigCardValue: { fontSize: sizes.xxxl, fontWeight: "700", color: colors.onSurface, marginTop: 4 },
  iconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  miniRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md, flexWrap: "wrap" },
  miniStat: { flexDirection: "row", alignItems: "center", gap: 6 },
  miniDot: { width: 8, height: 8, borderRadius: 4 },
  miniValue: { fontSize: sizes.base, fontWeight: "700", color: colors.onSurface },
  miniLabel: { fontSize: sizes.sm, color: colors.muted },
  cta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md, alignSelf: "flex-start", paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, width: "100%", justifyContent: "center" },
  ctaTxt: { color: colors.brand, fontWeight: "700", fontSize: sizes.base },
  card: { backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  cardTitle: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.md },
  planRow: { marginBottom: spacing.md },
  planHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  planName: { fontSize: sizes.base, fontWeight: "700", color: colors.onSurface },
  planCount: { fontSize: sizes.sm, color: colors.muted },
  barBg: { height: 6, backgroundColor: colors.surfaceTertiary, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  usageGrid: { flexDirection: "row", gap: spacing.md },
  usageTile: { flex: 1, alignItems: "center", padding: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md },
  usageIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  usageValue: { fontSize: sizes.xl, fontWeight: "700", color: colors.onSurface },
  usageLabel: { fontSize: sizes.sm, color: colors.muted },
  actionsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  actionTile: { flex: 1, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", gap: 6 },
  actionTxt: { fontSize: sizes.sm, fontWeight: "700", color: colors.onSurface },
});
