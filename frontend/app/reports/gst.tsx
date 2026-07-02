import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Platform, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, spacing, radius, sizes } from "@/src/theme";
import DateField from "@/src/components/DateField";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

function firstOfMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function GstReport() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth() as any;
  const sym = user?.currency_symbol || "₹";
  const [start, setStart] = useState<string>(firstOfMonthIso());
  const [end, setEnd] = useState<string>(todayIso());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState("");

  const money = (n: number) => `${sym}${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const q = new URLSearchParams();
      if (start) q.append("start", start);
      if (end) q.append("end", end);
      const res = await api(`/reports/gst?${q.toString()}`);
      setData(res);
    } catch (e: any) {
      setErr(e?.message || "Failed to load GST report");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [start, end]);

  useEffect(() => { load(); }, [load]);

  const downloadExcel = async () => {
    setDownloading(true); setToast("");
    try {
      let token: string | null = null;
      try {
        if (Platform.OS === "web") token = globalThis.localStorage?.getItem("opticrm_token") ?? null;
        else token = await SecureStore.getItemAsync("opticrm_token");
      } catch {}
      const q = new URLSearchParams();
      if (start) q.append("start", start);
      if (end) q.append("end", end);
      const url = `${BACKEND}/api/reports/sales.xlsx?${q.toString()}`;
      if (Platform.OS === "web") {
        const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const blob = await r.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl; a.download = `GST-report-${start}-to-${end}.xlsx`;
        document.body.appendChild(a); a.click(); a.remove();
        setToast("Excel downloaded.");
      } else {
        const dest = `${FileSystem.cacheDirectory}GST-report-${start}-to-${end}.xlsx`;
        const dl = await FileSystem.downloadAsync(url, dest, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(dl.uri);
        setToast("Excel ready — shared.");
      }
    } catch (e: any) {
      setToast(e?.message || "Failed to download");
    } finally {
      setDownloading(false);
      setTimeout(() => setToast(""), 4500);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="gst-report-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="document-text" size={18} color={colors.brand} />
            <Text style={styles.title}>GST-Ready Report</Text>
          </View>
          <Text style={styles.sub}>CGST/SGST/IGST breakdown · GSTR-ready</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
      >
        <View style={styles.filtersCard}>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>From</Text>
              <DateField testID="gst-start-date" value={start} onChange={setStart} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>To</Text>
              <DateField testID="gst-end-date" value={end} onChange={setEnd} />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
            <Pressable testID="gst-refresh" onPress={load} style={[styles.smallBtn, { flex: 1 }]}>
              <Ionicons name="refresh" size={14} color="#fff" />
              <Text style={styles.smallBtnTxt}>Refresh</Text>
            </Pressable>
            <Pressable testID="gst-download" onPress={downloadExcel} disabled={downloading} style={[styles.smallBtn, { flex: 1, backgroundColor: colors.brandSecondary }, downloading && { opacity: 0.7 }]}>
              <Ionicons name="download-outline" size={14} color="#fff" />
              <Text style={styles.smallBtnTxt}>{downloading ? "…" : "Excel"}</Text>
            </Pressable>
          </View>
        </View>

        {!!toast && <Text style={styles.toast} testID="gst-toast">{toast}</Text>}
        {err ? <Text style={{ color: colors.error, marginTop: spacing.md }}>{err}</Text> : null}

        {loading ? (
          <View style={{ padding: spacing.xxxl, alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
        ) : data ? (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Period Summary</Text>
              <View style={styles.summaryGrid}>
                <SumItem label="Orders" value={String(data.total_orders || 0)} />
                <SumItem label="Taxable Value" value={money(data.total_taxable)} strong />
                <SumItem label="CGST" value={money(data.total_cgst)} />
                <SumItem label="SGST" value={money(data.total_sgst)} />
                <SumItem label="IGST" value={money(data.total_igst)} />
                <SumItem label="Total GST" value={money(data.total_gst)} strong />
              </View>
              <View style={styles.invoiceTotal}>
                <Text style={styles.invoiceTotalLabel}>Total Invoice Value (Incl. GST)</Text>
                <Text style={styles.invoiceTotalVal}>{money(data.total_invoice_value)}</Text>
              </View>
            </View>

            <Text style={styles.sectionHead}>Breakdown by HSN + Rate</Text>
            {(!data.rows || data.rows.length === 0) ? (
              <View style={styles.empty}>
                <Ionicons name="information-circle-outline" size={24} color={colors.muted} />
                <Text style={styles.emptyTxt}>No taxable sales in this period.</Text>
              </View>
            ) : (
              <View style={styles.tableCard}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>HSN</Text>
                  <Text style={[styles.tableHeaderCell, { width: 44, textAlign: "center" }]}>Rate</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.3, textAlign: "right" }]}>Taxable</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>GST</Text>
                </View>
                {data.rows.map((row: any) => (
                  <View key={row.key} style={styles.tableRow} testID={`gst-row-${row.key}`}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tableCell}>{row.hsn_code}</Text>
                      <Text style={styles.tableCellSub}>{row.lines} line{row.lines === 1 ? "" : "s"} · Qty {row.quantity}</Text>
                    </View>
                    <Text style={[styles.tableCell, { width: 44, textAlign: "center", fontWeight: "700", color: colors.brand }]}>{row.gst_rate}%</Text>
                    <Text style={[styles.tableCell, { flex: 1.3, textAlign: "right" }]}>{money(row.taxable)}</Text>
                    <View style={{ flex: 1, alignItems: "flex-end" }}>
                      <Text style={[styles.tableCell, { fontWeight: "700" }]}>{money(row.gst)}</Text>
                      <Text style={styles.tableCellSub}>C {money(row.cgst)} · S {money(row.sgst)}{row.igst ? ` · I ${money(row.igst)}` : ""}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.hint}>
              <Ionicons name="bulb-outline" size={14} color={colors.brand} />
              <Text style={styles.hintTxt}>Values match your invoices. Filed as GSTR-1 (outward supplies).</Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SumItem({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.sumItem}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={[styles.sumVal, strong && { color: colors.brand, fontWeight: "800" }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  backBtn: { padding: spacing.xs, marginBottom: 2 },
  title: { fontSize: sizes.xl, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  filtersCard: { backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  filterLabel: { fontSize: sizes.sm, color: colors.muted, fontWeight: "600", marginBottom: 4 },
  smallBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, padding: 10, backgroundColor: colors.brand, borderRadius: radius.sm },
  smallBtnTxt: { color: "#fff", fontWeight: "700", fontSize: sizes.sm },
  summaryCard: { backgroundColor: colors.brand, padding: spacing.lg, borderRadius: radius.md, marginTop: spacing.lg },
  summaryTitle: { color: "rgba(255,255,255,0.85)", fontSize: sizes.sm, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.md },
  sumItem: { width: "30%", padding: spacing.sm, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: radius.sm },
  sumLabel: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "600" },
  sumVal: { color: "#fff", fontSize: sizes.lg, fontWeight: "700", marginTop: 4 },
  invoiceTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: spacing.md, marginTop: spacing.md, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)" },
  invoiceTotalLabel: { color: "rgba(255,255,255,0.85)", fontSize: sizes.base, fontWeight: "600" },
  invoiceTotalVal: { color: "#fff", fontSize: sizes.xxl, fontWeight: "800" },
  sectionHead: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
  tableCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  tableHeader: { flexDirection: "row", padding: spacing.md, backgroundColor: colors.surfaceTertiary, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  tableHeaderCell: { fontSize: sizes.sm, fontWeight: "700", color: colors.onSurfaceSecondary },
  tableRow: { flexDirection: "row", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm, alignItems: "center" },
  tableCell: { fontSize: sizes.sm, color: colors.onSurface },
  tableCellSub: { fontSize: 10, color: colors.muted, marginTop: 2 },
  empty: { alignItems: "center", padding: spacing.xxl, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  emptyTxt: { color: colors.muted, marginTop: spacing.sm },
  hint: { flexDirection: "row", gap: spacing.sm, alignItems: "center", padding: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.md, marginTop: spacing.lg },
  hintTxt: { color: colors.brand, fontSize: sizes.sm, flex: 1 },
  toast: { textAlign: "center", color: colors.success, marginTop: spacing.md, fontWeight: "700" },
});
