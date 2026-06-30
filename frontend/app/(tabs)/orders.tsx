import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useBranch } from "@/src/branch";
import { useCurrency } from "@/src/currency";
import BranchSwitcher from "@/src/components/BranchSwitcher";
import { colors, spacing, radius, sizes } from "@/src/theme";

export default function Orders() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeBranchId } = useBranch();
  const { format: currency } = useCurrency();
  const [orders, setOrders] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const path = `/orders${activeBranchId ? `?branch_id=${activeBranchId}` : ""}`;
      const d = await api(path);
      setOrders(d);
    } catch (e) { console.warn(e); }
  }, [activeBranchId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Orders</Text>
        <View style={{ flex: 1, alignItems: "flex-end", marginRight: spacing.sm }}>
          <BranchSwitcher />
        </View>
        <Pressable testID="new-order-button" onPress={() => router.push("/order/new")} style={styles.addBtn}>
          <Ionicons name="add" size={20} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        ListEmptyComponent={
          <View style={styles.empty} testID="orders-empty">
            <Ionicons name="receipt-outline" size={36} color={colors.muted} />
            <Text style={styles.emptyText}>No orders yet</Text>
            <Text style={styles.emptySub}>Tap + to create your first order</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`order-row-${item.id}`}
            style={styles.row}
            onPress={() => router.push(`/order/${item.id}`)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.customer_name}</Text>
              <Text style={styles.sub}>{item.lines?.length || 0} item(s) · {new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.amount}>{currency(item.total)}</Text>
              <View style={[styles.badge, item.payment_status === "paid" ? styles.paid : item.payment_status === "partial" ? styles.partial : styles.unpaid]}>
                <Text style={styles.badgeText}>{(item.payment_status || "unpaid").toUpperCase()}</Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface },
  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  name: { fontSize: sizes.lg, fontWeight: "600", color: colors.onSurface },
  sub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  amount: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface },
  badge: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  paid: { backgroundColor: colors.brandTertiary },
  partial: { backgroundColor: "#FFEBC2" },
  unpaid: { backgroundColor: "#FAD3D4" },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyText: { fontSize: sizes.lg, fontWeight: "600", color: colors.onSurface, marginTop: spacing.md },
  emptySub: { fontSize: sizes.base, color: colors.muted },
});
