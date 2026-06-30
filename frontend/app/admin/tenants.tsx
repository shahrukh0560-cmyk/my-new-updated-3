import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";

type Tenant = {
  id: string;
  email: string;
  name: string;
  status?: string;
  created_at?: string;
  metrics?: { customers: number; orders: number; revenue: number; branches: number };
  subscription?: { plan_id?: string; status?: string; expires_at?: string };
};

const INR = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const PLAN_COLOR: Record<string, string> = {
  trial: colors.muted,
  starter: colors.brandSecondary,
  pro: colors.brand,
  enterprise: colors.warning,
};

export default function AdminTenants() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "suspended">("all");
  const [items, setItems] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (filter !== "all") params.set("status", filter);
      const qs = params.toString();
      const data = await api(`/admin/tenants${qs ? `?${qs}` : ""}`);
      setItems(data || []);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [q, filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="admin-back" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Tenants</Text>
          <Text style={styles.sub}>{items.length} shop{items.length === 1 ? "" : "s"} registered</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            testID="tenant-search"
            value={q}
            onChangeText={setQ}
            onSubmitEditing={() => load()}
            placeholder="Search by email or shop name"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {q ? (
            <Pressable onPress={() => { setQ(""); setTimeout(load, 0); }}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.tabs}>
        {(["all", "active", "suspended"] as const).map((t) => (
          <Pressable
            key={t}
            testID={`filter-${t}`}
            onPress={() => { setFilter(t); }}
            style={[styles.tab, filter === t && styles.tabActive]}
          >
            <Text style={[styles.tabTxt, filter === t && styles.tabTxtActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="storefront-outline" size={48} color={colors.muted} />
              <Text style={styles.emptyTxt}>No tenants found</Text>
            </View>
          }
          renderItem={({ item }) => {
            const planId = item.subscription?.plan_id || "trial";
            const isSuspended = item.status === "suspended";
            return (
              <Pressable
                testID={`tenant-card-${item.id}`}
                onPress={() => router.push(`/admin/tenant/${item.id}` as any)}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }, isSuspended && { borderColor: colors.error, borderWidth: 1 }]}
              >
                <View style={styles.cardHead}>
                  <View style={styles.avatar}><Text style={styles.avatarTxt}>{item.name?.charAt(0).toUpperCase() || "?"}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName} numberOfLines={1}>{item.name || item.email}</Text>
                    <Text style={styles.cardEmail} numberOfLines={1}>{item.email}</Text>
                  </View>
                  <View style={[styles.planChip, { backgroundColor: (PLAN_COLOR[planId] || colors.muted) + "22" }]}>
                    <Text style={[styles.planChipTxt, { color: PLAN_COLOR[planId] || colors.muted }]}>{planId.toUpperCase()}</Text>
                  </View>
                </View>
                {isSuspended && (
                  <View style={styles.suspendBadge}>
                    <Ionicons name="warning" size={12} color={colors.error} />
                    <Text style={styles.suspendTxt}>SUSPENDED</Text>
                  </View>
                )}
                <View style={styles.statsRow}>
                  <Stat label="Customers" value={item.metrics?.customers ?? 0} />
                  <Stat label="Orders" value={item.metrics?.orders ?? 0} />
                  <Stat label="Branches" value={item.metrics?.branches ?? 0} />
                  <Stat label="Revenue" value={INR(item.metrics?.revenue ?? 0)} small />
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function Stat({ label, value, small }: { label: string; value: any; small?: boolean }) {
  return (
    <View style={styles.statBlock}>
      <Text style={[styles.statVal, small && { fontSize: sizes.sm }]} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingBottom: spacing.md, backgroundColor: colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  backBtn: { padding: spacing.sm },
  title: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  searchRow: { padding: spacing.md, paddingBottom: 0 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, fontSize: sizes.base, color: colors.onSurface },
  tabs: { flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  tab: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  tabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabTxt: { fontSize: sizes.sm, fontWeight: "600", color: colors.muted },
  tabTxtActive: { color: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: spacing.md },
  emptyTxt: { color: colors.muted, fontSize: sizes.base },
  card: { padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontWeight: "700", fontSize: sizes.lg },
  cardName: { fontSize: sizes.base, fontWeight: "700", color: colors.onSurface },
  cardEmail: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  planChip: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 6 },
  planChipTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  suspendBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: "#FAD3D4", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: spacing.sm },
  suspendTxt: { fontSize: 10, fontWeight: "800", color: colors.error, letterSpacing: 0.5 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  statBlock: { alignItems: "center", flex: 1 },
  statVal: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface },
  statLbl: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
});
