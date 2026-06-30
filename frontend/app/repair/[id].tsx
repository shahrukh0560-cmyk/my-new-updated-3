import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useCurrency } from "@/src/currency";
import { colors, spacing, radius, sizes } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";

const STATUSES = ["received", "diagnosed", "in_repair", "ready", "delivered", "cancelled"] as const;
type Status = typeof STATUSES[number];

const STATUS_COLORS: Record<string, string> = {
  received: "#7C57B5",
  diagnosed: "#0EA5E9",
  in_repair: "#F59E0B",
  ready: "#10B981",
  delivered: "#6B7280",
  cancelled: "#DC2626",
};

export default function RepairDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { format } = useCurrency();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await api(`/repair-orders/${id}`)); } catch (e) { console.warn(e); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setStatus = async (status: Status) => {
    setBusy(status);
    try {
      await api(`/repair-orders/${id}/status`, { method: "POST", body: { status } });
      await load();
    } catch (e: any) { console.warn(e); }
    finally { setBusy(null); }
  };

  if (!data) return <View style={{ flex: 1, backgroundColor: colors.surface }}><ScreenHeader title="Repair" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader title={data.repair_no || "Repair"} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brand} />}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{data.customer_name}</Text>
          <Text style={styles.muted}>{data.customer_phone}</Text>
          <View style={[styles.statusPill, { backgroundColor: (STATUS_COLORS[data.status] || colors.brand) + "22", alignSelf: "flex-start", marginTop: spacing.sm }]}>
            <Text style={[styles.statusTxt, { color: STATUS_COLORS[data.status] || colors.brand }]}>{(data.status || "").replace("_", " ").toUpperCase()}</Text>
          </View>
        </View>

        <View style={[styles.card, { marginTop: spacing.md }]}>
          <Text style={styles.sectionTitle}>Repair details</Text>
          <Row label="Item" value={data.item_description} />
          <Row label="Issue" value={data.issue} />
          <Row label="Estimated cost" value={format(data.estimated_cost || 0)} />
          <Row label="Advance paid" value={format(data.advance_paid || 0)} />
          <Row label="Expected" value={data.expected_date || "—"} />
          {data.notes ? <Row label="Notes" value={data.notes} /> : null}
        </View>

        <View style={[styles.card, { marginTop: spacing.md }]}>
          <Text style={styles.sectionTitle}>Update status</Text>
          <View style={styles.chipRow}>
            {STATUSES.map((s) => (
              <Pressable
                key={s}
                testID={`repair-status-${s}`}
                disabled={busy !== null || data.status === s}
                onPress={() => setStatus(s)}
                style={[styles.chip, { borderColor: STATUS_COLORS[s] }, data.status === s && { backgroundColor: STATUS_COLORS[s] + "22" }]}
              >
                <Text style={[styles.chipTxt, { color: STATUS_COLORS[s] }]}>{s.replace("_", " ")}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.card, { marginTop: spacing.md }]}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          {(data.timeline || []).map((t: any, idx: number) => (
            <View key={idx} style={styles.timelineRow}>
              <View style={[styles.dot, { backgroundColor: STATUS_COLORS[t.status] || colors.brand }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontWeight: "600", textTransform: "capitalize" }}>{(t.status || "").replace("_", " ")}</Text>
                {t.note ? <Text style={styles.muted}>{t.note}</Text> : null}
                <Text style={[styles.muted, { fontSize: 11 }]}>{new Date(t.at).toLocaleString()}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: sizes.xl, fontWeight: "700", color: colors.onSurface },
  muted: { color: colors.muted, fontSize: sizes.sm, marginTop: 2 },
  sectionTitle: { fontSize: sizes.sm, color: colors.muted, fontWeight: "700", letterSpacing: 0.5, marginBottom: spacing.sm, textTransform: "uppercase" },
  row: { flexDirection: "row", paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { width: 130, color: colors.muted, fontSize: sizes.sm },
  rowValue: { flex: 1, color: colors.onSurface, fontSize: sizes.base, fontWeight: "500" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusTxt: { fontSize: 11, fontWeight: "700" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1.5 },
  chipTxt: { fontSize: sizes.sm, fontWeight: "700", textTransform: "capitalize" },
  timelineRow: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: "flex-start" },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
});
