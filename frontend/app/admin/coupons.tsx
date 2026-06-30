import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";

export default function AdminCoupons() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api("/admin/coupons-all")); } catch (e) { console.warn(e); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="admin-coupons-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>All Coupons</Text>
          <Text style={styles.sub}>{items.length} across all tenants</Text>
        </View>
      </View>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="pricetag-outline" size={32} color={colors.muted} /><Text style={styles.emptyTxt}>No coupons yet</Text></View>}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        renderItem={({ item }) => (
          <View style={styles.card} testID={`admin-coupon-${item.id}`}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Text style={styles.code}>{item.code}</Text>
                <View style={[styles.badge, { backgroundColor: item.active ? colors.brandTertiary : "#FAD3D4" }]}>
                  <Text style={[styles.badgeTxt, { color: item.active ? colors.success : colors.error }]}>{item.active ? "ACTIVE" : "INACTIVE"}</Text>
                </View>
              </View>
              <Text style={styles.discount}>{item.discount_type === "percent" ? `${item.value}% off` : `₹${item.value} off`}</Text>
              <Text style={styles.muted}>Uses: {item.uses || 0}{item.usage_limit ? ` / ${item.usage_limit}` : ""}</Text>
              <Text style={styles.muted}>Tenant: {item.created_by || item.owner_id?.slice(0, 8)}</Text>
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
  card: { padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  code: { fontSize: sizes.xl, fontWeight: "700", color: colors.brand, letterSpacing: 1 },
  discount: { fontSize: sizes.base, color: colors.onSurface, fontWeight: "600", marginTop: 2 },
  muted: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeTxt: { fontSize: 10, fontWeight: "700" },
  empty: { padding: spacing.xxl, alignItems: "center" },
  emptyTxt: { color: colors.muted, fontSize: sizes.base, marginTop: spacing.sm },
});
