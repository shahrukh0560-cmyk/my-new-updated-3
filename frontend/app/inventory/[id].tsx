import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform, Modal, KeyboardAvoidingView } from "react-native";
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
  const [showEdit, setShowEdit] = useState(false);

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
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Pressable testID="edit-inv-button" onPress={() => setShowEdit(true)} hitSlop={10}>
              <Ionicons name="create-outline" size={20} color={colors.brand} />
            </Pressable>
            <Pressable testID="delete-inv-button" onPress={del} hitSlop={10}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </Pressable>
          </View>
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

      <EditInventoryModal
        visible={showEdit}
        item={item}
        onClose={() => setShowEdit(false)}
        onSaved={() => { setShowEdit(false); load(); }}
      />
    </View>
  );
}

function EditInventoryModal({ visible, item, onClose, onSaved }: any) {
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Initialize form when opened
  useFocusEffect(useCallback(() => {}, []));
  // Use useState initializer pattern with a ref-like check
  const initFor = (item as any)?.id + ":" + (visible ? "1" : "0");
  // Simple sync when visibility changes
  if (visible && item && form.__initFor !== initFor) {
    const initial: any = {
      __initFor: initFor,
      id: item.id,
      name: item.name || "",
      category: item.category || "frame",
      brand: item.brand || "",
      model: item.model || "",
      color: item.color || "",
      shape: item.shape || "",
      material: item.material || "",
      lens_index: item.lens_index !== undefined && item.lens_index !== null ? String(item.lens_index) : "",
      blue_cut: !!item.blue_cut,
      photochromic: !!item.photochromic,
      progressive_lens: !!item.progressive_lens,
      coatings: item.coatings || "",
      price: item.price !== undefined && item.price !== null ? String(item.price) : "",
      cost: item.cost !== undefined && item.cost !== null ? String(item.cost) : "",
      mrp: item.mrp !== undefined && item.mrp !== null ? String(item.mrp) : "",
      gst_rate: item.gst_rate !== undefined && item.gst_rate !== null ? String(item.gst_rate) : "5",
      hsn_code: item.hsn_code || "9004",
      stock: item.stock !== undefined ? String(item.stock) : "0",
      low_stock_threshold: item.low_stock_threshold !== undefined ? String(item.low_stock_threshold) : "3",
      rack_location: item.rack_location || "",
      supplier: item.supplier || "",
      warranty_months: item.warranty_months !== undefined ? String(item.warranty_months) : "12",
      sku: item.sku || "",
      barcode: item.barcode || "",
    };
    setForm(initial);
    setErr("");
  }

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const onSave = async () => {
    if (!form.name?.trim() || !form.price) { setErr("Name and price are required"); return; }
    setBusy(true); setErr("");
    try {
      const body = {
        name: form.name,
        category: form.category,
        brand: form.brand,
        model: form.model,
        color: form.color,
        shape: form.shape,
        material: form.material,
        lens_index: form.lens_index ? Number(form.lens_index) : null,
        blue_cut: !!form.blue_cut,
        photochromic: !!form.photochromic,
        progressive_lens: !!form.progressive_lens,
        coatings: form.coatings,
        price: Number(form.price) || 0,
        cost: Number(form.cost) || 0,
        mrp: form.mrp ? Number(form.mrp) : null,
        gst_rate: Number(form.gst_rate) || 5,
        hsn_code: form.hsn_code || "9004",
        stock: parseInt(form.stock, 10) || 0,
        low_stock_threshold: parseInt(form.low_stock_threshold, 10) || 3,
        rack_location: form.rack_location,
        supplier: form.supplier,
        warranty_months: parseInt(form.warranty_months, 10) || 0,
        sku: form.sku,
        barcode: form.barcode,
      };
      await api(`/inventory/${form.id}`, { method: "PUT", body });
      onSaved();
    } catch (e: any) {
      setErr(e?.message || "Failed to update item");
    } finally { setBusy(false); }
  };

  const CATS = [
    { id: "frame", label: "Frame" },
    { id: "lens", label: "Lens" },
    { id: "contact", label: "Contact" },
    { id: "accessory", label: "Accessory" },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={editStyles.wrap}>
        <View style={editStyles.card}>
          <View style={editStyles.header}>
            <Text style={editStyles.title}>Edit Inventory</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={colors.onSurface} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            <Text style={editStyles.label}>Category</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md, flexWrap: "wrap" }}>
              {CATS.map((c) => (
                <Pressable
                  key={c.id}
                  testID={`edit-inv-cat-${c.id}`}
                  onPress={() => set("category", c.id)}
                  style={[editStyles.chip, form.category === c.id && { backgroundColor: colors.brand, borderColor: colors.brand }]}
                >
                  <Text style={{ color: form.category === c.id ? "#fff" : colors.onSurface, fontWeight: "600" }}>{c.label}</Text>
                </Pressable>
              ))}
            </View>
            {([
              ["name", "Name *"],
              ["brand", "Brand"],
              ["model", "Model"],
              ["color", "Color"],
              ["shape", "Shape"],
              ["material", "Material"],
              ["lens_index", "Lens index"],
              ["coatings", "Coatings"],
              ["sku", "SKU"],
              ["barcode", "Barcode"],
              ["price", "Selling Price *"],
              ["mrp", "MRP"],
              ["cost", "Cost"],
              ["gst_rate", "GST rate %"],
              ["hsn_code", "HSN code"],
              ["stock", "Stock"],
              ["low_stock_threshold", "Low-stock threshold"],
              ["rack_location", "Rack location"],
              ["supplier", "Supplier"],
              ["warranty_months", "Warranty (months)"],
            ] as const).map(([k, label]) => (
              <View key={k} style={{ marginBottom: spacing.md }}>
                <Text style={editStyles.label}>{label}</Text>
                <TextInput
                  testID={`edit-inv-${k}-input`}
                  value={form[k] || ""}
                  onChangeText={(v) => set(k, v)}
                  keyboardType={(["price","cost","stock","low_stock_threshold","mrp","gst_rate","warranty_months","lens_index"] as string[]).includes(k) ? "numeric" : "default"}
                  style={editStyles.input}
                  placeholderTextColor={colors.muted}
                />
              </View>
            ))}
            <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap", marginBottom: spacing.md }}>
              {(["blue_cut", "photochromic", "progressive_lens"] as const).map((k) => (
                <Pressable
                  key={k}
                  testID={`edit-inv-toggle-${k}`}
                  onPress={() => set(k, !form[k])}
                  style={[editStyles.toggle, form[k] && { backgroundColor: colors.brand, borderColor: colors.brand }]}
                >
                  <Ionicons name={form[k] ? "checkmark" : "close"} size={14} color={form[k] ? "#fff" : colors.muted} />
                  <Text style={{ color: form[k] ? "#fff" : colors.onSurface, fontWeight: "600", fontSize: sizes.sm }}>
                    {k.replace("_lens", "").replace("_", " ")}
                  </Text>
                </Pressable>
              ))}
            </View>
            {err ? <Text style={{ color: colors.error, marginTop: spacing.sm }} testID="edit-inv-error">{err}</Text> : null}
            <Pressable
              testID="save-edit-inv-button"
              onPress={onSave}
              disabled={busy}
              style={[editStyles.cta, { marginTop: spacing.md }, busy && { opacity: 0.7 }]}
            >
              <Text style={editStyles.ctaTxt}>{busy ? "Saving…" : "Update Item"}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const editStyles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  card: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%" },
  header: { padding: spacing.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: sizes.xl, fontWeight: "700", color: colors.onSurface },
  label: { fontSize: sizes.sm, fontWeight: "600", color: colors.onSurfaceSecondary, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: sizes.base, color: colors.onSurface },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  toggle: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  cta: { backgroundColor: colors.brand, padding: spacing.md, borderRadius: radius.md, alignItems: "center" },
  ctaTxt: { color: "#fff", fontWeight: "700", fontSize: sizes.base },
});

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
