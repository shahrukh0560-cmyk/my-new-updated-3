import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function InventoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<any>(null);
  const [stock, setStock] = useState("");
  const [labelCount, setLabelCount] = useState("1");
  const [labelSize, setLabelSize] = useState<"small" | "medium" | "large">("small");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

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

  const printBarcode = async () => {
    setBusy(true); setToast("");
    try {
      const n = Math.max(1, Math.min(parseInt(labelCount, 10) || 1, 100));
      // Get token — needed because the PDF endpoint is authenticated
      let token: string | null = null;
      try {
        if (Platform.OS === "web") token = globalThis.localStorage?.getItem("opticrm_token") ?? null;
        else token = await SecureStore.getItemAsync("opticrm_token");
      } catch {}
      const url = `${BACKEND}/api/inventory/${id}/barcode-label.pdf?count=${n}&size=${labelSize}`;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (Platform.OS === "web") {
        const objUrl = URL.createObjectURL(blob);
        const w = window.open(objUrl, "_blank");
        if (w) {
          setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 600);
        }
        setToast(`Opened ${n} label${n === 1 ? "" : "s"} for printing`);
      } else {
        setToast("Barcode PDF downloaded");
      }
    } catch (e: any) {
      setToast(e?.message || "Failed to generate barcode");
    } finally {
      setBusy(false);
      setTimeout(() => setToast(""), 4000);
    }
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
          {!!item.barcode && <><Text style={styles.label}>Barcode</Text><Text style={[styles.val, { fontFamily: "Courier" }]}>{item.barcode}</Text></>}
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

        <View style={[styles.card, { marginTop: spacing.lg }]} testID="barcode-label-card">
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs }}>
            <Ionicons name="barcode-outline" size={20} color={colors.brand} />
            <Text style={[styles.label, { marginTop: 0, fontSize: sizes.base }]}>Print Barcode Labels</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: sizes.sm, marginBottom: spacing.md }}>
            Auto-generates Code128 labels (name, price, barcode) for this SKU.
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
            {(["small", "medium", "large"] as const).map((s) => (
              <Pressable
                key={s}
                testID={`label-size-${s}`}
                onPress={() => setLabelSize(s)}
                style={[styles.sizePill, labelSize === s && styles.sizePillActive]}
              >
                <Text style={[styles.sizePillTxt, labelSize === s && styles.sizePillTxtActive]}>
                  {s === "small" ? "50×25mm" : s === "medium" ? "60×40mm" : "80×50mm"}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: sizes.sm, marginBottom: 4 }}>Number of labels</Text>
              <TextInput
                testID="label-count-input"
                value={labelCount}
                onChangeText={setLabelCount}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
            <Pressable
              testID="print-barcode-button"
              disabled={busy}
              onPress={printBarcode}
              style={[styles.cta, { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end" }, busy && { opacity: 0.6 }]}
            >
              <Ionicons name="print-outline" size={16} color="#fff" />
              <Text style={styles.ctaText}>{busy ? "…" : "Print"}</Text>
            </Pressable>
          </View>
          {!!toast && <Text style={styles.toast} testID="barcode-toast">{toast}</Text>}
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
  sizePill: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTertiary },
  sizePillActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  sizePillTxt: { fontSize: sizes.sm, color: colors.onSurfaceSecondary, fontWeight: "600" },
  sizePillTxtActive: { color: "#fff" },
  toast: { color: colors.brand, marginTop: spacing.sm, fontSize: sizes.sm, textAlign: "center" },
});
