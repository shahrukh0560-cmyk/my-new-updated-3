import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, spacing, radius, sizes } from "@/src/theme";

export default function BranchesData() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const sym = (user as any)?.currency_symbol || "₹";
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");

  const money = (n: number) => `${sym}${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const load = useCallback(async () => {
    try {
      setErr("");
      const data = await api("/branches/metrics");
      setRows(data || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Totals across branches
  const totals = rows.reduce(
    (acc, r) => ({
      customers: acc.customers + (r.customers || 0),
      inventory: acc.inventory + (r.inventory || 0),
      low_stock: acc.low_stock + (r.low_stock || 0),
      orders_30d: acc.orders_30d + (r.orders_30d || 0),
      revenue_30d: acc.revenue_30d + (r.revenue_30d || 0),
      revenue_lifetime: acc.revenue_lifetime + (r.revenue_lifetime || 0),
      unpaid_due: acc.unpaid_due + (r.unpaid_due || 0),
    }),
    { customers: 0, inventory: 0, low_stock: 0, orders_30d: 0, revenue_30d: 0, revenue_lifetime: 0, unpaid_due: 0 },
  );

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="branches-data-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="branches-data-back">
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Multi-branch</Text>
          <Text style={styles.title}>Manage All Branches</Text>
          <Text style={styles.sub}>Per-branch performance across your entire tenant</Text>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
      >
        {err ? <Text style={styles.err}>{err}</Text> : null}

        <View style={styles.totalCard} testID="branches-total-card">
          <Text style={styles.totalTitle}>All Branches Combined</Text>
          <View style={styles.totalGrid}>
            <TotalItem label="Customers" value={totals.customers.toString()} icon="people-outline" />
            <TotalItem label="Inventory" value={totals.inventory.toString()} icon="glasses-outline" />
            <TotalItem label="Orders 30d" value={totals.orders_30d.toString()} icon="receipt-outline" />
            <TotalItem label="Revenue 30d" value={money(totals.revenue_30d)} icon="trending-up" />
            <TotalItem label="Lifetime Rev" value={money(totals.revenue_lifetime)} icon="cash-outline" />
            <TotalItem label="Unpaid Due" value={money(totals.unpaid_due)} icon="alert-circle-outline" color={totals.unpaid_due > 0 ? colors.warning : colors.success} />
          </View>
        </View>

        <Text style={styles.sectionHead}>By Branch</Text>

        {rows.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="business-outline" size={32} color={colors.muted} />
            <Text style={styles.emptyTxt}>No branches yet. Add branches to see per-branch metrics.</Text>
            <Pressable testID="go-to-branches" onPress={() => router.push("/branches")} style={[styles.cta, { marginTop: spacing.md }]}>
              <Text style={styles.ctaTxt}>Manage Branches</Text>
            </Pressable>
          </View>
        ) : rows.map((b: any, idx: number) => (
          <View key={b.branch_id || `nb-${idx}`} style={styles.branchCard} testID={`branch-metric-${b.code || idx}`}>
            <View style={styles.branchHead}>
              <View style={[styles.codeBadge, { backgroundColor: b.branch_id ? colors.brand : colors.muted }]}>
                <Text style={styles.codeTxt}>{b.code || "N/A"}</Text>
              </View>
              <Text style={styles.branchName}>{b.name}</Text>
              {b.low_stock > 0 && (
                <View style={styles.lowChip}>
                  <Ionicons name="warning-outline" size={12} color={colors.warning} />
                  <Text style={styles.lowChipTxt}>{b.low_stock} low</Text>
                </View>
              )}
            </View>
            <View style={styles.metricsRow}>
              <Mini icon="people-outline" label="Customers" value={String(b.customers)} />
              <Mini icon="glasses-outline" label="Items" value={String(b.inventory)} />
              <Mini icon="receipt-outline" label="Orders 30d" value={String(b.orders_30d)} />
            </View>
            <View style={styles.metricsRow}>
              <Mini icon="trending-up" label="Revenue 30d" value={money(b.revenue_30d)} strong />
              <Mini icon="cash-outline" label="Lifetime" value={money(b.revenue_lifetime)} strong />
              <Mini icon="alert-circle-outline" label="Due" value={money(b.unpaid_due)} color={b.unpaid_due > 0 ? colors.warning : colors.success} strong />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function TotalItem({ label, value, icon, color }: { label: string; value: string; icon: any; color?: string }) {
  return (
    <View style={styles.totalItem}>
      <Ionicons name={icon} size={16} color={color || colors.brand} />
      <Text style={styles.totalItemLabel}>{label}</Text>
      <Text style={[styles.totalItemVal, color && { color }]}>{value}</Text>
    </View>
  );
}

function Mini({ icon, label, value, strong, color }: { icon: any; label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <View style={styles.mini}>
      <View style={styles.miniIconRow}>
        <Ionicons name={icon} size={12} color={colors.muted} />
        <Text style={styles.miniLabel}>{label}</Text>
      </View>
      <Text style={[styles.miniVal, strong && { fontSize: sizes.base, fontWeight: "700" }, color && { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, backgroundColor: colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  backBtn: { padding: spacing.xs, marginBottom: 2 },
  eyebrow: { fontSize: sizes.sm, fontWeight: "700", color: colors.brand, letterSpacing: 1, textTransform: "uppercase" },
  title: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface, marginTop: 2 },
  sub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  err: { color: colors.error, marginBottom: spacing.md },
  totalCard: { backgroundColor: colors.brand, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.lg },
  totalTitle: { color: "rgba(255,255,255,0.85)", fontSize: sizes.sm, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  totalGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.md },
  totalItem: { width: "46%", padding: spacing.md, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: radius.sm },
  totalItemLabel: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "600", marginTop: 4 },
  totalItemVal: { color: "#fff", fontSize: sizes.lg, fontWeight: "700", marginTop: 2 },
  sectionHead: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.md },
  branchCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  branchHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  codeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  codeTxt: { color: "#fff", fontWeight: "700", fontSize: sizes.sm },
  branchName: { flex: 1, fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface },
  lowChip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.warning + "22", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  lowChipTxt: { color: colors.warning, fontSize: 11, fontWeight: "700" },
  metricsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  mini: { flex: 1, backgroundColor: colors.surfaceTertiary, padding: spacing.md, borderRadius: radius.sm },
  miniIconRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  miniLabel: { fontSize: 10, color: colors.muted, fontWeight: "600" },
  miniVal: { fontSize: sizes.sm, color: colors.onSurface, fontWeight: "600", marginTop: 4 },
  empty: { alignItems: "center", padding: spacing.xxl, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  emptyTxt: { color: colors.muted, marginTop: spacing.sm, textAlign: "center" },
  cta: { backgroundColor: colors.brand, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md },
  ctaTxt: { color: "#fff", fontWeight: "700" },
});
