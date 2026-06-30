import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useBranch } from "@/src/branch";
import BranchSwitcher from "@/src/components/BranchSwitcher";
import { colors, spacing, radius, sizes } from "@/src/theme";

export default function Customers() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeBranchId } = useBranch();
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState("");

  const load = useCallback(async (query: string) => {
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (activeBranchId) params.set("branch_id", activeBranchId);
      const path = `/customers${params.toString() ? `?${params}` : ""}`;
      const d = await api(path);
      setList(d);
    } catch (e) { console.warn(e); }
  }, [activeBranchId]);

  useFocusEffect(useCallback(() => { load(q); }, [load, q]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Text style={styles.title}>Customers</Text>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <BranchSwitcher />
          </View>
          <Pressable
            testID="add-customer-button"
            onPress={() => router.push("/customer/new")}
            style={styles.addBtn}
          >
            <Ionicons name="add" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            testID="customer-search-input"
            placeholder="Search by name, phone, email"
            placeholderTextColor={colors.muted}
            value={q}
            onChangeText={setQ}
            style={styles.searchInput}
          />
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        ListEmptyComponent={
          <View style={styles.empty} testID="customers-empty">
            <Ionicons name="people-outline" size={36} color={colors.muted} />
            <Text style={styles.emptyText}>No customers yet</Text>
            <Text style={styles.emptySub}>Tap + to add your first customer</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`customer-row-${item.id}`}
            style={styles.row}
            onPress={() => router.push(`/customer/${item.id}`)}
          >
            <View style={styles.avatar}><Text style={styles.avatarText}>{item.name?.charAt(0).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.sub}>{item.phone}{item.email ? ` · ${item.email}` : ""}</Text>
              <Text style={styles.rxBadge}>{(item.prescriptions || []).length} prescription(s)</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface },
  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  searchBox: { marginTop: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: sizes.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.onBrandTertiary, fontWeight: "700", fontSize: sizes.lg },
  name: { fontSize: sizes.lg, fontWeight: "600", color: colors.onSurface },
  sub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  rxBadge: { fontSize: 11, color: colors.brand, marginTop: 4, fontWeight: "600" },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyText: { fontSize: sizes.lg, fontWeight: "600", color: colors.onSurface, marginTop: spacing.md },
  emptySub: { fontSize: sizes.base, color: colors.muted },
});
