import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";

export default function AdminWishes() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api("/admin/wishes-all")); } catch (e) { console.warn(e); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="admin-wishes-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Wishes Log</Text>
          <Text style={styles.sub}>{items.length} sent across tenants</Text>
        </View>
      </View>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="gift-outline" size={32} color={colors.muted} /><Text style={styles.emptyTxt}>No wishes yet</Text></View>}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        renderItem={({ item }) => (
          <View style={styles.card} testID={`admin-wish-${item.id}`}>
            <View style={[styles.icon, { backgroundColor: item.occasion === "birthday" ? "#FCE7F3" : "#FEF3C7" }]}>
              <Ionicons name={item.occasion === "birthday" ? "gift" : "heart"} size={18} color={item.occasion === "birthday" ? "#EC4899" : "#F59E0B"} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.customer_name}</Text>
              <Text style={styles.muted}>{item.channel.toUpperCase()} · {item.occasion}</Text>
              <Text style={styles.msg} numberOfLines={2}>{item.message}</Text>
              <Text style={[styles.muted, { fontSize: 11, marginTop: 4 }]}>{new Date(item.sent_at).toLocaleString()}</Text>
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
  card: { padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: sizes.base, fontWeight: "700", color: colors.onSurface },
  muted: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  msg: { fontSize: sizes.sm, color: colors.onSurfaceSecondary, marginTop: 4 },
  empty: { padding: spacing.xxl, alignItems: "center" },
  emptyTxt: { color: colors.muted, fontSize: sizes.base, marginTop: spacing.sm },
});
