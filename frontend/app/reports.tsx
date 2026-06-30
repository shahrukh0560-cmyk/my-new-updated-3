import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput, KeyboardAvoidingView } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { api, tokenStore } from "@/src/api";
import { useBranch } from "@/src/branch";
import { useCurrency } from "@/src/currency";
import BranchSwitcher from "@/src/components/BranchSwitcher";
import { colors, spacing, radius, sizes } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

type Preset = "today" | "week" | "month" | "year" | "all" | "custom";
type Period = "" | "daily" | "monthly" | "yearly";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeFor(preset: Preset): { start?: string; end?: string } {
  const now = new Date();
  if (preset === "all") return {};
  if (preset === "today") {
    const s = new Date(now); s.setHours(0, 0, 0, 0);
    return { start: fmtDate(s) };
  }
  if (preset === "week") {
    const s = new Date(now); s.setDate(now.getDate() - 7);
    return { start: fmtDate(s) };
  }
  if (preset === "month") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: fmtDate(s) };
  }
  if (preset === "year") {
    const s = new Date(now.getFullYear(), 0, 1);
    return { start: fmtDate(s) };
  }
  return {};
}

export default function Reports() {
  const { activeBranchId } = useBranch();
  const { format: currency, locale } = useCurrency();
  const [tab, setTab] = useState<"sales" | "gst" | "inventory">("sales");
  const [sales, setSales] = useState<any>(null);
  const [gst, setGst] = useState<any>(null);
  const [inv, setInv] = useState<any>(null);
  const [preset, setPreset] = useState<Preset>("month");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [period, setPeriod] = useState<Period>("monthly");
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");

  const buildSalesQuery = useCallback(() => {
    const p = new URLSearchParams();
    let { start, end } = rangeFor(preset);
    if (preset === "custom") {
      if (customStart) start = customStart;
      if (customEnd) end = customEnd;
    }
    if (start) p.set("start", start);
    if (end) p.set("end", end);
    if (activeBranchId) p.set("branch_id", activeBranchId);
    if (period) p.set("period", period);
    return p.toString();
  }, [preset, customStart, customEnd, activeBranchId, period]);

  const load = useCallback(async () => {
    try {
      const sq = buildSalesQuery();
      const [s, g, i] = await Promise.all([
        api(`/reports/sales${sq ? `?${sq}` : ""}`),
        api(`/reports/gst${activeBranchId ? `?branch_id=${activeBranchId}` : ""}`),
        api(`/reports/inventory${activeBranchId ? `?branch_id=${activeBranchId}` : ""}`),
      ]);
      setSales(s); setGst(g); setInv(i);
    } catch (e) { console.warn(e); }
  }, [buildSalesQuery, activeBranchId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const exportCSV = async () => {
    setExporting(true); setExportMsg("");
    try {
      const tok = await tokenStore.get();
      const headers: Record<string, string> = tok ? { Authorization: `Bearer ${tok}` } : {};
      const qs = buildSalesQuery();
      const res = await fetch(`${BACKEND}/api/reports/sales.csv${qs ? `?${qs}` : ""}`, { headers });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || "export failed"}`);
      }
      const csv = await res.text();
      const filename = `sales_${preset}${preset === "custom" && customStart ? `_${customStart}` : ""}.csv`;

      if (Platform.OS === "web") {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        setExportMsg(`Downloaded ${filename}`);
      } else {
        const uri = (FileSystem.documentDirectory || FileSystem.cacheDirectory) + filename;
        await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: "text/csv", dialogTitle: filename, UTI: "public.comma-separated-values-text" });
          setExportMsg(`Shared ${filename}`);
        } else {
          setExportMsg(`Saved to ${uri}`);
        }
      }
    } catch (e: any) {
      setExportMsg(e?.message || "Export failed");
    } finally {
      setExporting(false);
      setTimeout(() => setExportMsg(""), 4000);
    }
  };

  const formatPeriodLabel = (key: string): string => {
    try {
      if (period === "yearly") return key;
      if (period === "monthly") {
        const [y, m] = key.split("-").map(Number);
        return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: "short", year: "numeric" });
      }
      if (period === "daily") {
        return new Date(key).toLocaleDateString(locale, { day: "2-digit", month: "short" });
      }
    } catch {}
    return key;
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="Reports & GST" right={<BranchSwitcher compact />} />

      <View style={styles.tabs}>
        {(["sales", "gst", "inventory"] as const).map((t) => (
          <Pressable
            key={t}
            testID={`report-tab-${t}`}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && { backgroundColor: colors.brand }]}
          >
            <Text style={[styles.tabTxt, tab === t && { color: "#fff" }]}>
              {t === "sales" ? "Sales" : t === "gst" ? "GST" : "Inventory"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        {tab === "sales" && (
          <>
            {/* Date range presets */}
            <Text style={styles.sectionHead}>Period</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {([
                ["today", "Today"], ["week", "Last 7d"], ["month", "This month"],
                ["year", "This year"], ["all", "All-time"], ["custom", "Custom"],
              ] as const).map(([k, label]) => {
                const sel = preset === k;
                return (
                  <Pressable key={k} testID={`preset-${k}`} onPress={() => setPreset(k)} style={[styles.chip, sel && styles.chipActive]}>
                    <Text style={[styles.chipTxt, sel && { color: "#fff" }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {preset === "custom" && (
              <View style={styles.rangeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Start (YYYY-MM-DD)</Text>
                  <TextInput
                    testID="custom-start-input"
                    value={customStart}
                    onChangeText={setCustomStart}
                    placeholder="2025-12-01"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    style={styles.dateInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>End (YYYY-MM-DD)</Text>
                  <TextInput
                    testID="custom-end-input"
                    value={customEnd}
                    onChangeText={setCustomEnd}
                    placeholder="2025-12-31"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    style={styles.dateInput}
                  />
                </View>
              </View>
            )}

            <Text style={[styles.sectionHead, { marginTop: spacing.md }]}>Group by</Text>
            <View style={styles.segment}>
              {([["", "None"], ["daily", "Daily"], ["monthly", "Monthly"], ["yearly", "Yearly"]] as const).map(([k, label]) => {
                const sel = period === k;
                return (
                  <Pressable key={k || "none"} testID={`period-${k || "none"}`} onPress={() => setPeriod(k as Period)} style={[styles.segmentBtn, sel && styles.segmentBtnActive]}>
                    <Text style={[styles.segmentTxt, sel && { color: "#fff" }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {sales && (
              <>
                <View style={[styles.summary, { marginTop: spacing.md }]}>
                  <Stat label="Orders" value={String(sales.total_orders)} />
                  <Stat label="Revenue" value={currency(sales.total_revenue)} highlight />
                  <Stat label="Due" value={currency(sales.total_due)} color={colors.warning} />
                  <Stat label="GST" value={currency(sales.total_gst)} />
                  <Stat label="Discount" value={currency(sales.total_discount)} />
                </View>

                <Pressable testID="export-sales-csv" onPress={exportCSV} disabled={exporting} style={styles.exportBtn}>
                  <Ionicons name="download-outline" size={16} color="#fff" />
                  <Text style={styles.exportTxt}>{exporting ? "Exporting…" : `Export ${preset === "custom" ? `${customStart || "…"} → ${customEnd || "today"}` : preset} (CSV)`}</Text>
                </Pressable>
                {!!exportMsg && <Text style={styles.toast} testID="export-toast">{exportMsg}</Text>}

                {!!period && sales.series?.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>{period.charAt(0).toUpperCase() + period.slice(1)} breakdown</Text>
                    {(() => {
                      const max = Math.max(1, ...sales.series.map((r: any) => r.revenue));
                      return sales.series.map((r: any) => (
                        <View key={r.period} style={styles.barRow} testID={`series-row-${r.period}`}>
                          <View style={{ flex: 1 }}>
                            <View style={styles.barRowTop}>
                              <Text style={styles.barLabel}>{formatPeriodLabel(r.period)}</Text>
                              <Text style={styles.barValue}>{currency(r.revenue)}</Text>
                            </View>
                            <View style={styles.barTrack}>
                              <View style={[styles.barFill, { width: `${Math.round((r.revenue / max) * 100)}%` }]} />
                            </View>
                            <Text style={styles.barSub}>{r.orders} order(s){r.due ? ` · due ${currency(r.due)}` : ""}</Text>
                          </View>
                        </View>
                      ));
                    })()}
                  </>
                )}

                <Text style={styles.sectionTitle}>Recent invoices</Text>
                {sales.orders.slice(0, 30).map((o: any) => (
                  <View key={o.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowMain}>{o.invoice_no || o.id.slice(0, 8)} · {o.customer_name}</Text>
                      <Text style={styles.rowSub}>{new Date(o.created_at).toLocaleDateString(locale)} · GST {currency(o.gst_amount || 0)}{o.is_imported ? " · imported" : ""}</Text>
                    </View>
                    <Text style={styles.rowAmt}>{currency(o.total)}</Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {tab === "gst" && gst && (
          <>
            <View style={styles.summary}>
              <Stat label="Taxable" value={currency(gst.total_taxable)} />
              <Stat label="GST Total" value={currency(gst.total_gst)} highlight />
              <Stat label="Invoices" value={String(gst.total_orders)} />
            </View>
            <Text style={styles.sectionTitle}>GST by HSN × Rate</Text>
            {gst.rows.length === 0 ? <Text style={{ color: colors.muted }}>No GST records yet</Text> : gst.rows.map((r: any) => (
              <View key={r.key} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowMain}>HSN {r.hsn_code} @ {r.gst_rate}%</Text>
                  <Text style={styles.rowSub}>{r.lines} line(s) · Taxable {currency(r.taxable)}</Text>
                </View>
                <Text style={styles.rowAmt}>{currency(r.gst)}</Text>
              </View>
            ))}
          </>
        )}

        {tab === "inventory" && inv && (
          <>
            <View style={styles.summary}>
              <Stat label="Items" value={String(inv.total_items)} />
              <Stat label="Stock Value" value={currency(inv.total_value)} highlight />
              <Stat label="Low Stock" value={String(inv.low_stock_count)} color={colors.warning} />
              <Stat label="Out of Stock" value={String(inv.out_of_stock_count)} color={colors.error} />
            </View>
            <Text style={styles.sectionTitle}>By category</Text>
            {Object.entries(inv.by_category).map(([catKey, v]: any) => (
              <View key={catKey} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowMain}>{catKey === "lens" ? "Lenses" : catKey === "accessory" ? "Accessories" : catKey[0].toUpperCase() + catKey.slice(1) + "s"}</Text>
                  <Text style={styles.rowSub}>{v.count} item(s) · {v.stock} units in stock</Text>
                </View>
                <Text style={styles.rowAmt}>{currency(v.value)}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Stat({ label, value, highlight, color }: any) {
  return (
    <View style={[styles.stat, highlight && { backgroundColor: colors.brand }]}>
      <Text style={[styles.statLabel, highlight && { color: colors.brandTertiary }]}>{label}</Text>
      <Text style={[styles.statValue, highlight && { color: "#fff" }, !highlight && color && { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  tab: { paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  tabTxt: { fontWeight: "700", color: colors.onSurface, fontSize: sizes.sm },
  sectionHead: { fontSize: sizes.sm, color: colors.muted, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.xs },
  chipsRow: { gap: spacing.sm, paddingVertical: spacing.xs, paddingHorizontal: 2 },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, justifyContent: "center" },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipTxt: { fontSize: sizes.sm, color: colors.onSurface, fontWeight: "600" },
  rangeRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  label: { fontSize: sizes.sm, color: colors.onSurfaceSecondary, fontWeight: "600", marginBottom: 4 },
  dateInput: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: sizes.base, color: colors.onSurface },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 4, gap: 4, borderWidth: 1, borderColor: colors.border },
  segmentBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: "center", borderRadius: radius.sm },
  segmentBtnActive: { backgroundColor: colors.brand },
  segmentTxt: { fontSize: sizes.sm, fontWeight: "600", color: colors.muted },
  summary: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  stat: { width: "48%", padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  statLabel: { fontSize: sizes.sm, color: colors.muted, fontWeight: "600" },
  statValue: { fontSize: sizes.xl, fontWeight: "800", color: colors.onSurface, marginTop: 4 },
  exportBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.success, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  exportTxt: { color: "#fff", fontWeight: "700", fontSize: sizes.base },
  toast: { color: colors.brand, textAlign: "center", marginBottom: spacing.md, fontSize: sizes.sm },
  sectionTitle: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface, marginTop: spacing.md, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs },
  rowMain: { fontWeight: "600", color: colors.onSurface, fontSize: sizes.base },
  rowSub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  rowAmt: { fontWeight: "700", color: colors.brand, fontSize: sizes.base },
  barRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs },
  barRowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  barLabel: { fontWeight: "700", color: colors.onSurface, fontSize: sizes.base },
  barValue: { fontWeight: "700", color: colors.brand, fontSize: sizes.base },
  barTrack: { height: 6, backgroundColor: colors.surfaceTertiary, borderRadius: 3, marginTop: 6, overflow: "hidden" },
  barFill: { height: 6, backgroundColor: colors.brand, borderRadius: 3 },
  barSub: { fontSize: sizes.sm, color: colors.muted, marginTop: 4 },
});
