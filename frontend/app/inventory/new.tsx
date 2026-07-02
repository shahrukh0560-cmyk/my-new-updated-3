import { useCallback, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";

const CATS = [
  { id: "frame", label: "Frame" },
  { id: "lens", label: "Lens" },
  { id: "contact", label: "Contact" },
  { id: "accessory", label: "Accessory" },
];

export default function NewInventory() {
  const router = useRouter();
  const [cat, setCat] = useState<"frame"|"lens"|"contact"|"accessory">("frame");
  const [form, setForm] = useState<any>({
    name: "", brand: "", model: "", color: "", shape: "", material: "",
    lens_index: "", blue_cut: false, photochromic: false, progressive_lens: false, coatings: "",
    price: "", cost: "", mrp: "", gst_rate: "5", hsn_code: "9004",
    stock: "", low_stock_threshold: "3", rack_location: "", supplier: "", warranty_months: "12",
    sku: "", barcode: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useFocusEffect(useCallback(() => {
    (async () => {
      const raw = await AsyncStorage.getItem("opticrm_scan_result");
      if (!raw) return;
      try {
        const { code, ts } = JSON.parse(raw);
        if (code && Date.now() - ts < 15000) {
          await AsyncStorage.removeItem("opticrm_scan_result");
          setForm((f: any) => ({ ...f, barcode: code, sku: f.sku || code }));
        }
      } catch {}
    })();
  }, []));

  const onSave = async () => {
    if (!form.name.trim() || !form.price) { setErr("Name and price are required"); return; }
    setBusy(true); setErr("");
    try {
      await api("/inventory", {
        method: "POST",
        body: {
          name: form.name, category: cat, brand: form.brand, model: form.model, color: form.color,
          shape: form.shape, material: form.material,
          lens_index: form.lens_index ? Number(form.lens_index) : null,
          blue_cut: !!form.blue_cut, photochromic: !!form.photochromic, progressive_lens: !!form.progressive_lens,
          coatings: form.coatings,
          price: Number(form.price) || 0, cost: Number(form.cost) || 0, mrp: form.mrp ? Number(form.mrp) : null,
          gst_rate: Number(form.gst_rate) || 5, hsn_code: form.hsn_code || "9004",
          stock: parseInt(form.stock, 10) || 0,
          low_stock_threshold: parseInt(form.low_stock_threshold, 10) || 3,
          rack_location: form.rack_location, supplier: form.supplier,
          warranty_months: parseInt(form.warranty_months, 10) || 0,
          sku: form.sku, barcode: form.barcode,
        },
      });
      router.back();
    } catch (e: any) { setErr(e.message || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="New Inventory" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Text style={styles.label}>Category</Text>
        <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
          {CATS.map((c) => (
            <Pressable
              key={c.id}
              testID={`new-inv-cat-${c.id}`}
              onPress={() => setCat(c.id as any)}
              style={[styles.chip, cat === c.id && { backgroundColor: colors.brand, borderColor: colors.brand }]}
            >
              <Text style={{ color: cat === c.id ? "#fff" : colors.onSurface, fontWeight: "600" }}>{c.label}</Text>
            </Pressable>
          ))}
        </View>

        {[
          ["name", "Name *"],
          ["brand", "Brand"],
          ["model", "Model"],
          ["color", "Color"],
          ["shape", "Shape (frame)"],
          ["material", "Material"],
          ["lens_index", "Lens index (1.50, 1.56, 1.60, 1.67, 1.74)"],
          ["coatings", "Coatings (e.g. AR, Hydrophobic)"],
          ["sku", "SKU"],
          ["barcode", "Barcode / QR"],
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
        ].map(([k, label]) => (
          <View key={k as string} style={{ marginBottom: spacing.md }}>
            <Text style={styles.label}>{label}</Text>
            {k === "barcode" ? (
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <TextInput
                  testID={`new-inv-${k}-input`}
                  value={form[k as string]}
                  onChangeText={(v) => setForm({ ...form, [k as string]: v })}
                  style={[styles.input, { flex: 1 }]}
                  placeholderTextColor={colors.muted}
                />
                <Pressable testID="new-inv-scan-button" onPress={() => router.push("/scanner?mode=inventory")} style={styles.scanBtn}>
                  <Ionicons name="barcode-outline" size={18} color="#fff" />
                </Pressable>
              </View>
            ) : (
              <TextInput
                testID={`new-inv-${k}-input`}
                value={form[k as string]}
                onChangeText={(v) => setForm({ ...form, [k as string]: v })}
                keyboardType={["price","cost","stock","low_stock_threshold","mrp","gst_rate","warranty_months","lens_index"].includes(k as string) ? "numeric" : "default"}
                style={styles.input}
                placeholderTextColor={colors.muted}
              />
            )}
          </View>
        ))}

        <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap", marginBottom: spacing.md }}>
          {(["blue_cut", "photochromic", "progressive_lens"] as const).map((k) => (
            <Pressable
              key={k}
              testID={`new-inv-toggle-${k}`}
              onPress={() => setForm({ ...form, [k]: !form[k] })}
              style={[styles.toggle, form[k] && { backgroundColor: colors.brand, borderColor: colors.brand }]}
            >
              <Ionicons name={form[k] ? "checkmark" : "close"} size={14} color={form[k] ? "#fff" : colors.muted} />
              <Text style={{ color: form[k] ? "#fff" : colors.onSurface, fontWeight: "600", fontSize: sizes.sm }}>
                {k.replace("_lens", "").replace("_", " ")}
              </Text>
            </Pressable>
          ))}
        </View>
        {err ? <Text style={{ color: colors.error }} testID="new-inv-error">{err}</Text> : null}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable testID="save-inv-button" onPress={onSave} disabled={busy} style={[styles.cta, busy && { opacity: 0.7 }]}>
          <Text style={styles.ctaText}>{busy ? "Saving…" : "Save Item"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: sizes.sm, fontWeight: "600", color: colors.onSurfaceSecondary, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: sizes.lg, color: colors.onSurface },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
  cta: { backgroundColor: colors.brand, padding: spacing.lg, borderRadius: radius.md, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: sizes.lg, fontWeight: "700" },
  scanBtn: { width: 48, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandSecondary, borderRadius: radius.md },
  toggle: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
});
