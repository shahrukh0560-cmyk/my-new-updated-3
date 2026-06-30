import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useAuth } from "@/src/auth";
import { api, tokenStore } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function DataManager() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<{ customers: number; inventory: number; orders: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [resultKind, setResultKind] = useState<"ok" | "err">("ok");
  const [mode, setMode] = useState<"customers" | "inventory" | "sales">("customers");

  const isAdmin = user?.role === "owner" || user?.role === "admin" || user?.role === "super_admin";

  const loadStats = useCallback(async () => {
    try {
      const [c, i, o] = await Promise.all([api("/customers"), api("/inventory"), api("/orders")]);
      setStats({ customers: (c || []).length, inventory: (i || []).length, orders: (o || []).length });
    } catch {
      setStats({ customers: 0, inventory: 0, orders: 0 });
    }
  }, []);

  useFocusEffect(useCallback(() => { loadStats(); }, [loadStats]));

  const showResult = (msg: string, kind: "ok" | "err" = "ok") => {
    setResult(msg); setResultKind(kind);
    setTimeout(() => setResult(null), 6000);
  };

  const downloadFile = async (path: string, filename: string, mime: string) => {
    setBusy(filename); setResult(null);
    try {
      const token = await tokenStore.get();
      const res = await fetch(`${BASE}/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      if (Platform.OS === "web") {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        showResult(`Downloaded ${filename}`);
      } else {
        const isText = mime.startsWith("text/");
        if (isText) {
          const txt = await res.text();
          const fileUri = (FileSystem as any).cacheDirectory + filename;
          await FileSystem.writeAsStringAsync(fileUri, txt, { encoding: FileSystem.EncodingType.UTF8 });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, { mimeType: mime, dialogTitle: filename });
            showResult(`Exported ${filename}`);
          } else {
            showResult(`Saved to ${fileUri}`);
          }
        } else {
          // Binary (xlsx / pdf) — base64 encode
          const buf = await res.arrayBuffer();
          const b64 = bufferToBase64(buf);
          const fileUri = (FileSystem as any).cacheDirectory + filename;
          await FileSystem.writeAsStringAsync(fileUri, b64, { encoding: FileSystem.EncodingType.Base64 });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, { mimeType: mime, dialogTitle: filename });
            showResult(`Exported ${filename}`);
          } else {
            showResult(`Saved to ${fileUri}`);
          }
        }
      }
    } catch (e: any) {
      showResult(e?.message || "Export failed", "err");
    } finally {
      setBusy(null);
    }
  };

  const downloadCsv = (path: string, filename: string) => downloadFile(path, filename, "text/csv");
  const downloadXlsx = (path: string, filename: string) => downloadFile(path, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const downloadPdf = (path: string, filename: string) => downloadFile(path, filename, "application/pdf");

  const importCustomers = async () => {
    await runImport({
      requiredColumns: ["name", "phone"],
      buildRow: (r, headers, idx) => ({
        name: (r[idx("name")] || "").trim(),
        phone: (r[idx("phone")] || "").trim(),
        email: idx("email") >= 0 ? (r[idx("email")] || "").trim() : "",
        address: idx("address") >= 0 ? (r[idx("address")] || "").trim() : "",
        dob: idx("dob") >= 0 ? (r[idx("dob")] || "").trim() : "",
        gstin: idx("gstin") >= 0 ? (r[idx("gstin")] || "").trim() : "",
        notes: idx("notes") >= 0 ? (r[idx("notes")] || "").trim() : "",
      }),
      endpoint: "/customers-import",
      label: "customers",
    });
  };

  const importInventory = async () => {
    await runImport({
      requiredColumns: ["name", "category", "price"],
      buildRow: (r, headers, idx) => {
        const num = (col: string) => {
          const i = idx(col); if (i < 0) return undefined;
          const v = (r[i] || "").trim(); if (!v) return undefined;
          const n = Number(v); return Number.isFinite(n) ? n : undefined;
        };
        const bool = (col: string) => {
          const i = idx(col); if (i < 0) return false;
          const v = (r[i] || "").trim().toLowerCase();
          return v === "yes" || v === "true" || v === "1" || v === "y";
        };
        const str = (col: string) => {
          const i = idx(col); return i >= 0 ? (r[i] || "").trim() : "";
        };
        return {
          name: str("name"),
          category: (str("category") || "frame").toLowerCase(),
          price: num("price") ?? 0,
          cost: num("cost") ?? 0,
          brand: str("brand"),
          model: str("model"),
          color: str("color"),
          shape: str("shape"),
          material: str("material"),
          lens_index: num("lens_index"),
          blue_cut: bool("blue_cut"),
          photochromic: bool("photochromic"),
          progressive_lens: bool("progressive_lens"),
          coatings: str("coatings"),
          mrp: num("mrp"),
          gst_rate: num("gst_rate"),
          hsn_code: str("hsn_code") || "9004",
          stock: num("stock") ?? 0,
          low_stock_threshold: num("low_stock_threshold") ?? 3,
          rack_location: str("rack_location"),
          supplier: str("supplier"),
          warranty_months: num("warranty_months") ?? 0,
          sku: str("sku"),
          barcode: str("barcode"),
        };
      },
      endpoint: "/inventory-import",
      label: "inventory",
    });
  };

  const importSales = async () => {
    await runImport({
      requiredColumns: ["customer_name", "total"],
      buildRow: (r, headers, idx) => {
        const num = (col: string) => {
          const i = idx(col); if (i < 0) return undefined;
          const v = (r[i] || "").trim(); if (!v) return undefined;
          const n = Number(v); return Number.isFinite(n) ? n : undefined;
        };
        const str = (col: string) => {
          const i = idx(col); return i >= 0 ? (r[i] || "").trim() : "";
        };
        return {
          invoice_no: str("invoice_no"),
          date: str("date"),
          customer_name: str("customer_name"),
          customer_phone: str("customer_phone"),
          subtotal: num("subtotal"),
          gst_amount: num("gst_amount") ?? 0,
          discount: num("discount") ?? 0,
          total: num("total") ?? 0,
          paid: num("paid") ?? 0,
          payment_status: (str("payment_status") || undefined) as any,
          notes: str("notes"),
        };
      },
      endpoint: "/sales-import",
      label: "sales",
    });
  };

  const runImport = async ({
    requiredColumns, buildRow, endpoint, label,
  }: {
    requiredColumns: string[];
    buildRow: (row: string[], headers: string[], idx: (k: string) => number) => any;
    endpoint: string;
    label: string;
  }) => {
    setBusy(`import-${label}`); setResult(null);
    try {
      const DocumentPicker = await import("expo-document-picker").catch(() => null as any);
      let csvText = "";

      if (DocumentPicker) {
        const res = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values", "application/vnd.ms-excel", "*/*"], copyToCacheDirectory: true });
        if (res.canceled || !res.assets?.[0]) { setBusy(null); return; }
        const asset = res.assets[0];
        csvText = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
      } else if (Platform.OS === "web") {
        csvText = await new Promise<string>((resolve, reject) => {
          const input = document.createElement("input");
          input.type = "file"; input.accept = ".csv,text/csv";
          input.onchange = () => {
            const f = input.files?.[0]; if (!f) return reject(new Error("No file"));
            const r = new FileReader();
            r.onload = () => resolve(String(r.result || "")); r.onerror = () => reject(r.error);
            r.readAsText(f);
          };
          input.click();
        });
      } else {
        throw new Error("Document picker not available");
      }

      const rows = parseCsv(csvText);
      if (rows.length < 2) throw new Error("CSV is empty or missing data rows");
      const headers = rows[0].map((h) => h.trim().toLowerCase());
      const idx = (k: string) => headers.indexOf(k);
      const missing = requiredColumns.filter((c) => idx(c) === -1);
      if (missing.length) throw new Error(`CSV must contain columns: ${missing.join(", ")}`);

      const records = rows.slice(1).filter((r) => r.some((c) => c && c.trim())).map((r) => buildRow(r, headers, idx));
      if (records.length === 0) throw new Error("No data rows found in CSV");

      const out = await api(endpoint, { method: "POST", body: { rows: records, skip_duplicates: true } });
      const msg = `Imported ${out.imported} ${label}, skipped ${out.skipped_duplicates} duplicate(s)${out.errors?.length ? `, ${out.errors.length} error(s)` : ""}`;
      showResult(msg);
      loadStats();
    } catch (e: any) {
      showResult(e?.message || "Import failed", "err");
    } finally {
      setBusy(null);
    }
  };

  if (!isAdmin) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="lock-closed-outline" size={36} color={colors.muted} />
        <Text style={styles.lockTxt}>Admin access only</Text>
        <Pressable onPress={() => router.back()} style={styles.linkBtn}><Text style={styles.linkTxt}>Go back</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="data-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="data-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Data Import / Export</Text>
          <Text style={styles.sub}>Backup, migrate, and bulk-add customers</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        {/* Mode switcher */}
        <View style={styles.segment}>
          {(["customers", "inventory", "sales"] as const).map((m) => (
            <Pressable
              key={m}
              testID={`data-tab-${m}`}
              onPress={() => setMode(m)}
              style={[styles.segmentBtn, mode === m && styles.segmentBtnActive]}
            >
              <Ionicons name={m === "customers" ? "people-outline" : m === "inventory" ? "glasses-outline" : "receipt-outline"} size={16} color={mode === m ? "#fff" : colors.muted} />
              <Text style={[styles.segmentTxt, mode === m && styles.segmentTxtActive]}>{m === "customers" ? "Customers" : m === "inventory" ? "Inventory" : "Sales"}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.statCard}>
          <View style={[styles.iconWrap, { backgroundColor: colors.brandTertiary }]}>
            <Ionicons name={mode === "customers" ? "people-outline" : mode === "inventory" ? "glasses-outline" : "receipt-outline"} size={22} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statValue}>{mode === "customers" ? (stats?.customers ?? "—") : mode === "inventory" ? (stats?.inventory ?? "—") : (stats?.orders ?? "—")}</Text>
            <Text style={styles.statLabel}>Total {mode === "sales" ? "orders/invoices" : mode} in your account</Text>
          </View>
        </View>

        {mode === "customers" ? (
          <>
            <Text style={styles.section}>Export</Text>
            <View style={styles.formatRow}>
              <FormatBtn label="CSV" icon="document-outline" testID="export-customers-csv" onPress={() => downloadCsv("/customers.csv", "customers.csv")} busy={busy === "customers.csv"} />
              <FormatBtn label="Excel" icon="grid-outline" testID="export-customers-xlsx" onPress={() => downloadXlsx("/customers.xlsx", "customers.xlsx")} busy={busy === "customers.xlsx"} tint={colors.success} />
              <FormatBtn label="PDF" icon="document-text-outline" testID="export-customers-pdf" onPress={() => downloadPdf("/customers.pdf", "customers.pdf")} busy={busy === "customers.pdf"} tint={colors.error} />
            </View>
            <Text style={styles.sectionHint}>Export customers in your preferred format</Text>

            <Text style={styles.section}>Import</Text>
            <Pressable
              testID="download-template-button"
              onPress={() => downloadCsv("/customers-template.csv", "customers_template.csv")}
              disabled={!!busy}
              style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: "#FBE7CC" }]}>
                <Ionicons name="document-text-outline" size={22} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Download CSV Template</Text>
                <Text style={styles.actionSub}>Get the customer import template with sample data</Text>
              </View>
              {busy === "customers_template.csv" ? <ActivityIndicator color={colors.brand} /> : <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
            </Pressable>

            <Pressable
              testID="import-customers-button"
              onPress={importCustomers}
              disabled={!!busy}
              style={({ pressed }) => [styles.actionCardCta, pressed && { opacity: 0.9 }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
                <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionTitle, { color: "#fff" }]}>Import Customers from CSV</Text>
                <Text style={[styles.actionSub, { color: "rgba(255,255,255,0.85)" }]}>Required columns: name, phone</Text>
              </View>
              {busy === "import-customers" ? <ActivityIndicator color="#fff" /> : <Ionicons name="chevron-forward" size={18} color="#fff" />}
            </Pressable>
          </>
        ) : mode === "inventory" ? (
          <>
            <Text style={styles.section}>Export</Text>
            <View style={styles.formatRow}>
              <FormatBtn label="CSV" icon="document-outline" testID="export-inventory-csv" onPress={() => downloadCsv("/inventory.csv", "inventory.csv")} busy={busy === "inventory.csv"} />
              <FormatBtn label="Excel" icon="grid-outline" testID="export-inventory-xlsx" onPress={() => downloadXlsx("/inventory.xlsx", "inventory.xlsx")} busy={busy === "inventory.xlsx"} tint={colors.success} />
              <FormatBtn label="PDF" icon="document-text-outline" testID="export-inventory-pdf" onPress={() => downloadPdf("/inventory.pdf", "inventory.pdf")} busy={busy === "inventory.pdf"} tint={colors.error} />
            </View>
            <Text style={styles.sectionHint}>Export inventory in your preferred format</Text>

            <Text style={styles.section}>Import</Text>
            <Pressable
              testID="download-inventory-template-button"
              onPress={() => downloadCsv("/inventory-template.csv", "inventory_template.csv")}
              disabled={!!busy}
              style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: "#FBE7CC" }]}>
                <Ionicons name="document-text-outline" size={22} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Download Inventory Template</Text>
                <Text style={styles.actionSub}>Frame & lens template with examples</Text>
              </View>
              {busy === "inventory_template.csv" ? <ActivityIndicator color={colors.brand} /> : <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
            </Pressable>

            <Pressable
              testID="import-inventory-button"
              onPress={importInventory}
              disabled={!!busy}
              style={({ pressed }) => [styles.actionCardCta, pressed && { opacity: 0.9 }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
                <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionTitle, { color: "#fff" }]}>Import Inventory from CSV</Text>
                <Text style={[styles.actionSub, { color: "rgba(255,255,255,0.85)" }]}>Required: name, category, price</Text>
              </View>
              {busy === "import-inventory" ? <ActivityIndicator color="#fff" /> : <Ionicons name="chevron-forward" size={18} color="#fff" />}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.section}>Export</Text>
            <View style={styles.formatRow}>
              <FormatBtn label="CSV" icon="document-outline" testID="export-sales-csv" onPress={() => downloadCsv("/reports/sales.csv", "sales.csv")} busy={busy === "sales.csv"} />
              <FormatBtn label="Excel" icon="grid-outline" testID="export-sales-xlsx" onPress={() => downloadXlsx("/reports/sales.xlsx", "sales.xlsx")} busy={busy === "sales.xlsx"} tint={colors.success} />
              <FormatBtn label="PDF" icon="document-text-outline" testID="export-sales-pdf" onPress={() => downloadPdf("/reports/sales.pdf", "sales.pdf")} busy={busy === "sales.pdf"} tint={colors.error} />
            </View>
            <Text style={styles.sectionHint}>Use Reports → Sales for date-filtered exports</Text>

            <Text style={styles.section}>Import historical invoices</Text>
            <Pressable
              testID="download-sales-template-button"
              onPress={() => downloadCsv("/sales-template.csv", "sales_template.csv")}
              disabled={!!busy}
              style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: "#FBE7CC" }]}>
                <Ionicons name="document-text-outline" size={22} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Download Sales Template</Text>
                <Text style={styles.actionSub}>Migrate historical invoices from a spreadsheet</Text>
              </View>
              {busy === "sales_template.csv" ? <ActivityIndicator color={colors.brand} /> : <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
            </Pressable>

            <Pressable
              testID="import-sales-button"
              onPress={importSales}
              disabled={!!busy}
              style={({ pressed }) => [styles.actionCardCta, pressed && { opacity: 0.9 }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
                <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionTitle, { color: "#fff" }]}>Import Sales from CSV</Text>
                <Text style={[styles.actionSub, { color: "rgba(255,255,255,0.85)" }]}>Required: customer_name, total</Text>
              </View>
              {busy === "import-sales" ? <ActivityIndicator color="#fff" /> : <Ionicons name="chevron-forward" size={18} color="#fff" />}
            </Pressable>
          </>
        )}

        {result ? (
          <View testID="data-result" style={[styles.result, { backgroundColor: resultKind === "ok" ? colors.brandTertiary : "#FAD3D4" }]}>
            <Ionicons name={resultKind === "ok" ? "checkmark-circle" : "alert-circle"} size={18} color={resultKind === "ok" ? colors.success : colors.error} />
            <Text style={[styles.resultTxt, { color: resultKind === "ok" ? colors.onSurface : colors.error }]}>{result}</Text>
          </View>
        ) : null}

        <Text style={styles.footnote}>
          {mode === "customers"
            ? "Tip: Re-importing skips records that share a phone number with an existing customer."
            : mode === "inventory"
            ? "Tip: Re-importing skips items that share a SKU with an existing inventory item."
            : "Tip: Re-importing skips invoices that share an invoice_no with an existing record."}
        </Text>
      </ScrollView>
    </View>
  );
}

function bufferToBase64(buf: ArrayBuffer): string {
  // RN-safe base64 encoder
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  if (typeof btoa !== "undefined") return btoa(binary);
  // Fallback for environments without btoa
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < binary.length;) {
    const c1 = binary.charCodeAt(i++);
    const c2 = i < binary.length ? binary.charCodeAt(i++) : NaN;
    const c3 = i < binary.length ? binary.charCodeAt(i++) : NaN;
    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4);
    const e3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6);
    const e4 = isNaN(c3) ? 64 : c3 & 63;
    out += chars.charAt(e1) + chars.charAt(e2) + chars.charAt(e3) + chars.charAt(e4);
  }
  return out;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === "\"") {
        if (text[i + 1] === "\"") { field += "\""; i++; }
        else { inQuotes = false; }
      } else { field += ch; }
    } else {
      if (ch === "\"") inQuotes = true;
      else if (ch === ",") { cur.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (field.length || cur.length) { cur.push(field); rows.push(cur); cur = []; field = ""; }
        if (ch === "\r" && text[i + 1] === "\n") i++;
      } else { field += ch; }
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

function FormatBtn({ label, icon, onPress, busy, testID, tint }: { label: string; icon: any; onPress: () => void; busy: boolean; testID: string; tint?: string }) {
  const color = tint || colors.brand;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.formatBtn, { borderColor: color + "55" }, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.formatIcon, { backgroundColor: color + "1a" }]}>
        {busy ? <ActivityIndicator color={color} /> : <Ionicons name={icon} size={20} color={color} />}
      </View>
      <Text style={[styles.formatLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, gap: spacing.md },
  lockTxt: { fontSize: sizes.lg, fontWeight: "600", color: colors.onSurface, marginTop: spacing.md },
  linkBtn: { padding: spacing.md },
  linkTxt: { color: colors.brand, fontWeight: "700" },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBtn: { padding: spacing.xs },
  title: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  statCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 4, gap: 4, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  segmentBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: spacing.sm, borderRadius: radius.sm },
  segmentBtnActive: { backgroundColor: colors.brand },
  segmentTxt: { fontSize: sizes.base, fontWeight: "600", color: colors.muted },
  segmentTxtActive: { color: "#fff" },
  statValue: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface },
  statLabel: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  section: { marginTop: spacing.xl, marginBottom: spacing.sm, fontSize: sizes.sm, color: colors.muted, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  actionCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  actionCardCta: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, backgroundColor: colors.brand, borderRadius: radius.md, marginBottom: spacing.sm },
  actionTitle: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface },
  actionSub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  result: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  resultTxt: { flex: 1, fontSize: sizes.base, fontWeight: "600" },
  footnote: { textAlign: "center", color: colors.muted, fontSize: sizes.sm, marginTop: spacing.xl },
  formatRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  formatBtn: { flex: 1, paddingVertical: spacing.md, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1.5, backgroundColor: colors.surfaceSecondary, gap: 6 },
  formatIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  formatLabel: { fontSize: sizes.base, fontWeight: "700" },
  sectionHint: { fontSize: sizes.sm, color: colors.muted, marginTop: spacing.xs, marginBottom: spacing.sm, paddingHorizontal: 2 },
});
