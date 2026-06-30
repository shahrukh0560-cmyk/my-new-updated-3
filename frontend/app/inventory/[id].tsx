import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";

export default function InventoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<any>(null);
  const [stock, setStock] = useState("");

  const load = useCallback(async () => {
    try {
      const list = await api(`/inventory`);
      const found = list.find((i: any) => i.id === id);
      setItem(found);
      if (found) setStock(String(found.stock));
    } catch (e) { console.warn(e); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveStock = async () => {
    try {
      await api(`/inventory/${id}`, { method: "PUT", body: { stock: parseInt(stock, 10) || 0 } });
      load();
    } catch (e) { console.warn(e); }
  };

  const del = async () => {
    try { await api(`/inventory/${id}`, { method: "DELETE" }); router.back(); } catch (e) { console.warn(e); }
  };

  if (!item) return <View style={{ flex: 1, backgroundColor: colors.surface }}><ScreenHeader title="Loading…" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader
        title={item.name}
        right={
          <Pressable testID="delete-inv-button" onPress={del} hitSlop={10}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={styles.card}>
          <Text style={styles.label}>Category</Text>
          <Text style={styles.val}>{item.category}</Text>
          {!!item.brand && <><Text style={styles.label}>Brand</Text><Text style={styles.val}>{item.brand}</Text></>}
          {!!item.model && <><Text style={styles.label}>Model</Text><Text style={styles.val}>{item.model}</Text></>}
          {!!item.color && <><Text style={styles.label}>Color</Text><Text style={styles.val}>{item.color}</Text></>}
          {!!item.sku && <><Text style={styles.label}>SKU</Text><Text style={styles.val}>{item.sku}</Text></>}
          <Text style={styles.label}>Price</Text>
          <Text style={styles.val}>₹{item.price}</Text>
          <Text style={styles.label}>Cost</Text>
          <Text style={styles.val}>₹{item.cost || 0}</Text>
          <Text style={styles.label}>Low-stock threshold</Text>
          <Text style={styles.val}>{item.low_stock_threshold}</Text>
        </View>

        <View style={[styles.card, { marginTop: spacing.lg }]}>
          <Text style={styles.label}>Update Stock</Text>
          <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
            <TextInput
              testID="update-stock-input"
              value={stock}
              onChangeText={setStock}
              keyboardType="numeric"
              style={[styles.input, { flex: 1 }]}
            />
            <Pressable testID="update-stock-button" onPress={saveStock} style={styles.cta}>
              <Text style={styles.ctaText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  label: { fontSize: sizes.sm, color: colors.muted, marginTop: spacing.sm, fontWeight: "600" },
  val: { fontSize: sizes.lg, color: colors.onSurface, fontWeight: "600", marginTop: 2 },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: sizes.lg, color: colors.onSurface },
  cta: { backgroundColor: colors.brand, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md },
  ctaText: { color: "#fff", fontWeight: "700" },
});
