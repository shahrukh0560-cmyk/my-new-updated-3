import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";

const STATUS_COLORS: Record<string, string> = {
  received: "#7C57B5",
  diagnosed: "#0EA5E9",
  in_repair: "#F59E0B",
  ready: "#10B981",
  delivered: "#6B7280",
  cancelled: "#DC2626",
};

export default function AdminRepairs() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api("/admin/repair-orders-all")); } catch (e) { console.warn(e); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="admin-repairs-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>All Repair Orders</Text>
          <Text style={styles.sub}>{items.length} platform-wide</Text>
        </View>
      </View>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="construct-outline" size={32} color={colors.muted} /><Text style={styles.emptyTxt}>No repair orders yet</Text></View>}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        renderItem={({ item }) => (
          <View style={styles.card} testID={`admin-repair-${item.id}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.repair_no}</Text>
              <Text style={styles.muted}>{item.customer_name} · {item.customer_phone}</Text>
              <Text style={styles.muted} numberOfLines={1}>{item.item_description}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[item.status] || colors.muted) + "20" }]}>
              <Text style={[styles.badgeTxt, { color: STATUS_COLORS[item.status] || colors.muted }]}>{(item.status || "").replace("_", " ").toUpperCase()}</Text>
            </View>
          </View>
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
  card: { padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, flexDirection: "row", alignItems: "center" },
  cardTitle: { fontSize: sizes.base, fontWeight: "700", color: colors.onSurface },
  muted: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeTxt: { fontSize: 10, fontWeight: "700" },
  empty: { padding: spacing.xxl, alignItems: "center" },
  emptyTxt: { color: colors.muted, fontSize: sizes.base, marginTop: spacing.sm },
});
