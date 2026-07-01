import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

type SizeKey = "small" | "medium" | "large";

export default function BulkBarcode() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [size, setSize] = useState<SizeKey>("small");
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const inv = await api("/inventory");
        setItems(inv || []);
      } catch (e) { console.warn(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = term
    ? items.filter((i) => (i.name || "").toLowerCase().includes(term.toLowerCase()) || (i.sku || "").toLowerCase().includes(term.toLowerCase()) || (i.barcode || "").includes(term))
    : items;

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = { ...s };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });
  };

  const setCount = (id: string, count: number) => {
    const c = Math.max(1, Math.min(100, count || 1));
    setSelected((s) => ({ ...s, [id]: c }));
  };

  const totalLabels = Object.values(selected).reduce((a, b) => a + b, 0);

  const selectAllPrintable = () => {
    const next: Record<string, number> = {};
    filtered.forEach((i: any) => {
      if (i.barcode || i.sku) next[i.id] = 1;
    });
    setSelected(next);
  };

  const clear = () => setSelected({});

  const printBulk = useCallback(async () => {
    const rows = Object.entries(selected).map(([item_id, count]) => ({ item_id, count }));
    if (rows.length === 0) return;
    setBusy(true); setToast("");
    try {
      let token: string | null = null;
      try {
        if (Platform.OS === "web") token = globalThis.localStorage?.getItem("opticrm_token") ?? null;
        else token = await SecureStore.getItemAsync("opticrm_token");
      } catch {}
      const url = `${BACKEND}/api/inventory/barcode-labels.pdf`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ items: rows, size }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 120)}`);
      const blob = await res.blob();
      if (Platform.OS === "web") {
        const objUrl = URL.createObjectURL(blob);
        const w = window.open(objUrl, "_blank");
        if (w) {
          setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 600);
        }
        setToast(`Opened ${totalLabels} label${totalLabels === 1 ? "" : "s"} for printing`);
      } else {
        // On native, save file to cache and open via Sharing
        const filename = `barcode-labels-${Date.now()}.pdf`;
        const dest = `${FileSystem.cacheDirectory}${filename}`;
        // Read blob as base64
        const reader: any = new FileReader();
        const b64 = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(String(reader.result).split(",")[1] || "");
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        await FileSystem.writeAsStringAsync(dest, b64, { encoding: FileSystem.EncodingType.Base64 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(dest, { mimeType: "application/pdf", dialogTitle: "Print barcode labels" });
        }
        setToast(`Generated ${totalLabels} labels`);
      }
    } catch (e: any) {
      setToast(e?.message || "Failed to generate labels");
    } finally {
      setBusy(false);
      setTimeout(() => setToast(""), 5000);
    }
  }, [selected, size, totalLabels]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="bulk-barcode-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="barcode-outline" size={20} color={colors.brand} />
            <Text style={styles.title}>Bulk Barcode Print</Text>
          </View>
          <Text style={styles.sub}>Select items · choose size · print single PDF</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.muted} />
          <TextInput
            testID="bulk-barcode-search"
            value={term}
            onChangeText={setTerm}
            placeholder="Search by name, SKU, barcode"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.sizeRow}>
          {((["small", "medium", "large"] as const)).map((s) => (
            <Pressable key={s} testID={`bulk-size-${s}`} onPress={() => setSize(s)} style={[styles.sizePill, size === s && styles.sizePillActive]}>
              <Text style={[styles.sizeTxt, size === s && styles.sizeTxtActive]}>
                {s === "small" ? "50×25" : s === "medium" ? "60×40" : "80×50"}mm
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.actionRow}>
          <Pressable testID="bulk-select-all" onPress={selectAllPrintable} style={styles.smallLink}>
            <Text style={styles.smallLinkTxt}>Select all printable</Text>
          </Pressable>
          {Object.keys(selected).length > 0 && (
            <Pressable testID="bulk-clear" onPress={clear} style={styles.smallLink}>
              <Text style={[styles.smallLinkTxt, { color: colors.error }]}>Clear</Text>
            </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ padding: spacing.xxxl, alignItems: "center" }}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}>
          {filtered.length === 0 ? (
            <Text style={{ color: colors.muted, textAlign: "center", padding: spacing.xl }}>No items match your search.</Text>
          ) : filtered.map((it: any) => {
            const printable = !!(it.barcode || it.sku);
            const on = !!selected[it.id];
            return (
              <Pressable
                key={it.id}
                testID={`bulk-item-${it.id}`}
                onPress={() => printable && toggle(it.id)}
                style={[styles.itemRow, on && styles.itemRowOn, !printable && { opacity: 0.5 }]}
              >
                <View style={[styles.checkbox, on && styles.checkboxOn]}>
                  {on && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{it.name}</Text>
                  <Text style={styles.itemSub}>{it.brand ? `${it.brand} · ` : ""}₹{it.price}{it.stock !== undefined ? ` · Stk ${it.stock}` : ""}</Text>
                  <Text style={[styles.itemCode, !printable && { color: colors.error }]}>{it.barcode || it.sku || "No SKU / barcode"}</Text>
                </View>
                {on && (
                  <View style={styles.countBox}>
                    <Pressable testID={`bulk-dec-${it.id}`} onPress={(e) => { e.stopPropagation?.(); setCount(it.id, (selected[it.id] || 1) - 1); }} hitSlop={8} style={styles.countBtn}>
                      <Ionicons name="remove" size={14} color="#fff" />
                    </Pressable>
                    <TextInput
                      testID={`bulk-count-${it.id}`}
                      value={String(selected[it.id])}
                      onChangeText={(v) => setCount(it.id, parseInt(v, 10) || 1)}
                      keyboardType="numeric"
                      style={styles.countInput}
                    />
                    <Pressable testID={`bulk-inc-${it.id}`} onPress={(e) => { e.stopPropagation?.(); setCount(it.id, (selected[it.id] || 1) + 1); }} hitSlop={8} style={styles.countBtn}>
                      <Ionicons name="add" size={14} color="#fff" />
                    </Pressable>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: (insets.bottom || 8) + spacing.md }]}>
        {!!toast && <Text style={styles.toast} testID="bulk-toast">{toast}</Text>}
        <Pressable
          testID="bulk-print-button"
          onPress={printBulk}
          disabled={busy || totalLabels === 0}
          style={[styles.cta, (busy || totalLabels === 0) && { opacity: 0.4 }]}
        >
          <Ionicons name="print" size={18} color="#fff" />
          <Text style={styles.ctaTxt}>{busy ? "Generating…" : `Print ${totalLabels} label${totalLabels === 1 ? "" : "s"}`}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  backBtn: { padding: spacing.xs, marginBottom: 2 },
  title: { fontSize: sizes.xl, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  controls: { padding: spacing.md, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surfaceSecondary },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceTertiary, paddingHorizontal: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, paddingVertical: 8, color: colors.onSurface, fontSize: sizes.base },
  sizeRow: { flexDirection: "row", gap: 6 },
  sizePill: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTertiary },
  sizePillActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  sizeTxt: { fontSize: sizes.sm, color: colors.onSurfaceSecondary, fontWeight: "600" },
  sizeTxtActive: { color: "#fff" },
  actionRow: { flexDirection: "row", gap: spacing.md },
  smallLink: { paddingVertical: 4 },
  smallLinkTxt: { color: colors.brand, fontWeight: "700", fontSize: sizes.sm },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  itemRowOn: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  itemName: { fontSize: sizes.base, fontWeight: "600", color: colors.onSurface },
  itemSub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  itemCode: { fontSize: 11, color: colors.brandSecondary, marginTop: 2, fontFamily: "Courier" },
  countBox: { flexDirection: "row", alignItems: "center", gap: 4 },
  countBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  countInput: { width: 40, textAlign: "center", padding: 4, backgroundColor: "#fff", borderRadius: 6, borderWidth: 1, borderColor: colors.border, color: colors.onSurface },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.brand, paddingVertical: 14, borderRadius: radius.md },
  ctaTxt: { color: "#fff", fontWeight: "700", fontSize: sizes.base },
  toast: { textAlign: "center", color: colors.brand, marginBottom: spacing.sm, fontWeight: "700" },
});
