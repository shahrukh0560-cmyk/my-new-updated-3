import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useBranch } from "@/src/branch";
import { useCurrency } from "@/src/currency";
import { colors, spacing, radius, sizes } from "@/src/theme";

const STATUS_COLORS: Record<string, string> = {
  received: "#7C57B5",
  diagnosed: "#0EA5E9",
  in_repair: "#F59E0B",
  ready: "#10B981",
  delivered: "#6B7280",
  cancelled: "#DC2626",
};

export default function RepairList() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeBranchId } = useBranch();
  const { format } = useCurrency();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const path = `/repair-orders${activeBranchId ? `?branch_id=${activeBranchId}` : ""}`;
      const data = await api(path);
      setItems(data || []);
    } catch (e) { console.warn(e); }
  }, [activeBranchId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="repair-orders-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="repair-back">
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Repair Orders</Text>
          <Text style={styles.sub}>{items.length} repair{items.length === 1 ? "" : "s"}</Text>
        </View>
        <Pressable testID="new-repair-button" onPress={() => router.push("/repair/new")} style={styles.newBtn}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.newBtnTxt}>New</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brand} />}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="construct-outline" size={32} color={colors.muted} /><Text style={styles.emptyTxt}>No repair orders yet</Text></View>}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        renderItem={({ item }) => (
          <Pressable
            testID={`repair-card-${item.id}`}
            onPress={() => router.push(`/repair/${item.id}`)}
            style={styles.card}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.customer_name}</Text>
                <Text style={styles.cardSub}>{item.repair_no}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: (STATUS_COLORS[item.status] || colors.brand) + "20" }]}>
                <Text style={[styles.statusTxt, { color: STATUS_COLORS[item.status] || colors.brand }]}>{(item.status || "").replace("_", " ").toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.itemDesc} numberOfLines={2}>{item.item_description}</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              <Text style={styles.cardSub}>Est. {format(item.estimated_cost || 0)}</Text>
              <Text style={styles.cardSub}>{item.expected_date || "—"}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.xs },
  title: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brand, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.md },
  newBtnTxt: { color: "#fff", fontWeight: "700", fontSize: sizes.sm },
  card: { padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  cardTitle: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface },
  cardSub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  itemDesc: { fontSize: sizes.base, color: colors.onSurfaceSecondary },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusTxt: { fontSize: 11, fontWeight: "700" },
  empty: { padding: spacing.xxl, alignItems: "center", gap: spacing.sm },
  emptyTxt: { color: colors.muted, fontSize: sizes.base, marginTop: spacing.sm },
});
