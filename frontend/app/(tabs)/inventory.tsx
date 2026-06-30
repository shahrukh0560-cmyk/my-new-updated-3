import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ScrollView } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useBranch } from "@/src/branch";
import { useCurrency } from "@/src/currency";
import BranchSwitcher from "@/src/components/BranchSwitcher";
import { colors, spacing, radius, sizes } from "@/src/theme";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "frame", label: "Frames" },
  { id: "lens", label: "Lenses" },
  { id: "contact", label: "Contacts" },
];

export default function Inventory() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeBranchId } = useBranch();
  const { format: currency } = useCurrency();
  const [items, setItems] = useState<any[]>([]);
  const [cat, setCat] = useState("all");

  const load = useCallback(async (c: string) => {
    try {
      const params = new URLSearchParams();
      if (c !== "all") params.set("category", c);
      if (activeBranchId) params.set("branch_id", activeBranchId);
      const d = await api(`/inventory${params.toString() ? `?${params}` : ""}`);
      setItems(d);
    } catch (e) { console.warn(e); }
  }, [activeBranchId]);

  useFocusEffect(useCallback(() => { load(cat); }, [load, cat]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Text style={styles.title}>Inventory</Text>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <BranchSwitcher />
          </View>
          <Pressable testID="add-inventory-button" onPress={() => router.push("/inventory/new")} style={styles.addBtn}>
            <Ionicons name="add" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.md, paddingRight: spacing.md }}
          style={{ marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg }}
        >
          {CATEGORIES.map((c) => {
            const active = cat === c.id;
            return (
              <Pressable
                key={c.id}
                testID={`category-chip-${c.id}`}
                onPress={() => setCat(c.id)}
                style={[styles.chip, active && { backgroundColor: colors.brand, borderColor: colors.brand }]}
              >
                <Text style={[styles.chipText, active && { color: colors.onBrandPrimary }]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }}
        ListEmptyComponent={
          <View style={styles.empty} testID="inventory-empty">
            <Ionicons name="cube-outline" size={36} color={colors.muted} />
            <Text style={styles.emptyText}>No items</Text>
          </View>
        }
        renderItem={({ item }) => {
          const low = item.stock <= item.low_stock_threshold;
          return (
            <Pressable
              testID={`inventory-card-${item.id}`}
              style={styles.card}
              onPress={() => router.push(`/inventory/${item.id}`)}
            >
              <View style={[styles.thumb, { backgroundColor: item.category === "frame" ? colors.brandTertiary : colors.surfaceTertiary }]}>
                <Ionicons
                  name={item.category === "frame" ? "glasses-outline" : item.category === "lens" ? "scan-circle-outline" : "ellipse-outline"}
                  size={32}
                  color={colors.brand}
                />
              </View>
              <View style={[styles.statusDot, { backgroundColor: item.stock === 0 ? colors.error : low ? colors.warning : colors.success }]} />
              <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.cardBrand} numberOfLines={1}>{item.brand || item.category}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                <Text style={styles.cardPrice}>{currency(item.price)}</Text>
                <Text style={[styles.cardStock, low && { color: colors.error, fontWeight: "700" }]}>Stk {item.stock}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface },
  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipText: { fontSize: sizes.sm, color: colors.onSurface, fontWeight: "600" },
  card: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, position: "relative" },
  thumb: { height: 80, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  statusDot: { position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: 4 },
  cardName: { fontSize: sizes.base, fontWeight: "600", color: colors.onSurface },
  cardBrand: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  cardPrice: { fontSize: sizes.base, fontWeight: "700", color: colors.brand },
  cardStock: { fontSize: sizes.sm, color: colors.onSurfaceSecondary },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyText: { fontSize: sizes.lg, fontWeight: "600", color: colors.onSurface, marginTop: spacing.md },
});
