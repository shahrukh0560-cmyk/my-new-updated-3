import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useBranch } from "@/src/branch";
import { useCurrency } from "@/src/currency";
import BranchSwitcher from "@/src/components/BranchSwitcher";
import { colors, spacing, radius, sizes } from "@/src/theme";

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { activeBranchId } = useBranch();
  const { format } = useCurrency();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const path = `/dashboard${activeBranchId ? `?branch_id=${activeBranchId}` : ""}`;
      const d = await api(path);
      setData(d);
    } catch (e) {
      console.warn(e);
    }
  }, [activeBranchId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello} numberOfLines={1}>Hello, {user?.name?.split(" ")[0] || "Staff"}</Text>
          <Text style={styles.hint}>Here is your shop today</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <BranchSwitcher />
          <Pressable
            testID="logout-button"
            onPress={async () => { await logout(); router.replace("/login"); }}
            style={styles.iconBtn}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.onSurface} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* Quick actions */}
        <View style={styles.quickRow}>
          <Pressable testID="quick-new-order" onPress={() => router.push("/order/new")} style={[styles.quick, { backgroundColor: colors.brand }]}>
            <View style={styles.quickIcon}><Ionicons name="receipt-outline" size={22} color="#fff" /></View>
            <Text style={styles.quickTitle}>New Order</Text>
            <Text style={styles.quickSub}>Bill a customer</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" style={styles.quickArrow} />
          </Pressable>
          <Pressable testID="quick-new-customer" onPress={() => router.push("/customer/new")} style={[styles.quick, { backgroundColor: colors.brandSecondary }]}>
            <View style={styles.quickIcon}><Ionicons name="person-add-outline" size={22} color="#fff" /></View>
            <Text style={styles.quickTitle}>New Customer</Text>
            <Text style={styles.quickSub}>Capture a walk-in</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" style={styles.quickArrow} />
          </Pressable>
        </View>
        <View style={styles.quickRow}>
          <Pressable testID="quick-repair-orders" onPress={() => router.push("/repair")} style={[styles.quick, { backgroundColor: "#F59E0B" }]}>
            <View style={styles.quickIcon}><Ionicons name="construct-outline" size={22} color="#fff" /></View>
            <Text style={styles.quickTitle}>Repair Orders</Text>
            <Text style={styles.quickSub}>{(data?.repair_open || 0)} open · {(data?.repair_ready || 0)} ready</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" style={styles.quickArrow} />
          </Pressable>
          <Pressable testID="quick-prescription-scan" onPress={() => router.push("/prescription-scan")} style={[styles.quick, { backgroundColor: "#7C57B5" }]}>
            <View style={styles.quickIcon}><Ionicons name="scan-outline" size={22} color="#fff" /></View>
            <Text style={styles.quickTitle}>AI Rx Scan</Text>
            <Text style={styles.quickSub}>Camera prescription scan</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" style={styles.quickArrow} />
          </Pressable>
        </View>

        {(data?.birthdays_today?.length || data?.anniversaries_today?.length) ? (
          <Pressable
            testID="celebrations-banner"
            onPress={() => router.push("/wishes")}
            style={styles.celeBanner}
          >
            <View style={styles.celeIcon}><Ionicons name="gift" size={20} color="#EC4899" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.celeTitle}>Celebrations today</Text>
              <Text style={styles.celeSub}>
                {(data?.birthdays_today?.length || 0)} birthday(s) · {(data?.anniversaries_today?.length || 0)} anniversary(ies)
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#EC4899" />
          </Pressable>
        ) : null}

        <View style={styles.metricsRow}>
          <MetricCard testID="metric-revenue-today" label="Today's Revenue" value={format(data?.revenue_today)} icon="cash-outline" tint={colors.brand} />
          <MetricCard testID="metric-revenue-month" label="This Month" value={format(data?.revenue_month)} icon="trending-up-outline" tint={colors.success} />
        </View>
        <View style={styles.metricsRow}>
          <MetricCard testID="metric-pending-due" label="Pending Due" value={format(data?.pending_due)} icon="alert-circle-outline" tint={colors.warning} />
          <MetricCard testID="metric-customers" label="Customers" value={String(data?.customers_count || 0)} icon="people-outline" tint={colors.brandSecondary} />
        </View>
        <View style={styles.metricsRow}>
          <MetricCard testID="metric-gst" label="GST collected (mo.)" value={format(data?.gst_collected_month)} icon="receipt-outline" tint={colors.brand} />
          <MetricCard testID="metric-orders-today" label="Orders Today" value={String(data?.orders_today || 0)} icon="cart-outline" tint={colors.success} />
        </View>

        <Section title="Low Stock Alerts" testID="section-low-stock">
          {(!data?.low_stock?.length) ? (
            <EmptyHint icon="checkmark-circle-outline" text="All items above threshold" />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.md }}>
              {data.low_stock.map((it: any) => (
                <View key={it.id} style={styles.lowCard} testID={`low-stock-${it.id}`}>
                  <View style={[styles.dot, { backgroundColor: it.stock === 0 ? colors.error : colors.warning }]} />
                  <Text style={styles.lowName} numberOfLines={1}>{it.name}</Text>
                  <Text style={styles.lowSub}>{it.brand || it.category}</Text>
                  <Text style={styles.lowStock}>Stock: <Text style={{ color: colors.error, fontWeight: "700" }}>{it.stock}</Text></Text>
                </View>
              ))}
            </ScrollView>
          )}
        </Section>

        <Section title="Recent Customers" testID="section-recent-customers">
          {(!data?.recent_customers?.length) ? (
            <EmptyHint icon="people-outline" text="No customers yet" />
          ) : data.recent_customers.map((c: any) => (
            <Pressable
              key={c.id}
              testID={`recent-customer-${c.id}`}
              style={styles.row}
              onPress={() => router.push(`/customer/${c.id}`)}
            >
              <View style={styles.avatar}><Text style={styles.avatarText}>{(c.name || "?").charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{c.name}</Text>
                <Text style={styles.rowSub}>{c.phone}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </Section>

        <Section title="Recent Orders" testID="section-recent-orders">
          {(!data?.recent_orders?.length) ? (
            <EmptyHint icon="receipt-outline" text="No orders yet" />
          ) : data.recent_orders.map((o: any) => (
            <Pressable key={o.id} testID={`recent-order-${o.id}`} style={styles.row} onPress={() => router.push(`/order/${o.id}`)}>
              <View style={[styles.badge, { backgroundColor: o.payment_status === "paid" ? colors.brandTertiary : colors.surfaceTertiary }]}>
                <Text style={{ color: o.payment_status === "paid" ? colors.success : colors.warning, fontWeight: "700", fontSize: 11 }}>{(o.payment_status || "unpaid").toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{o.customer_name}</Text>
                <Text style={styles.rowSub}>{format(o.total)} · {o.lines?.length || 0} items</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </Section>
      </ScrollView>
    </View>
  );
}

function MetricCard({ label, value, icon, tint, testID }: any) {
  return (
    <View style={styles.metric} testID={testID}>
      <View style={[styles.metricIcon, { backgroundColor: tint + "22" }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children, testID }: any) {
  return (
    <View style={{ marginTop: spacing.xl }} testID={testID}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ marginTop: spacing.md }}>{children}</View>
    </View>
  );
}

function EmptyHint({ icon, text }: any) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={22} color={colors.muted} />
      <Text style={{ color: colors.muted, marginLeft: spacing.sm }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  hello: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface },
  hint: { fontSize: sizes.base, color: colors.muted, marginTop: 2 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  quickRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  quick: { flex: 1, padding: spacing.lg, borderRadius: radius.lg, overflow: "hidden" },
  quickIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  quickTitle: { color: "#fff", fontSize: sizes.lg, fontWeight: "700" },
  quickSub: { color: "rgba(255,255,255,0.8)", fontSize: sizes.sm, marginTop: 2 },
  quickArrow: { position: "absolute", right: spacing.lg, bottom: spacing.lg },
  metricsRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  metric: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  metricIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  metricValue: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface },
  metricLabel: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  sectionTitle: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface },
  lowCard: { width: 160, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  lowName: { fontSize: sizes.base, fontWeight: "600", color: colors.onSurface },
  lowSub: { fontSize: sizes.sm, color: colors.muted },
  lowStock: { fontSize: sizes.sm, color: colors.onSurfaceSecondary, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.onBrandTertiary, fontWeight: "700" },
  rowTitle: { fontSize: sizes.base, fontWeight: "600", color: colors.onSurface },
  rowSub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm },
  empty: { padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center" },
  celeBanner: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: "#FCE7F3", borderWidth: 1, borderColor: "#EC4899", marginBottom: spacing.md },
  celeIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  celeTitle: { fontSize: sizes.base, fontWeight: "700", color: "#831843" },
  celeSub: { fontSize: sizes.sm, color: "#831843", marginTop: 2 },
});
