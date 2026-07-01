import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { api, flushQueue } from "@/src/api";
import { isOnline, getQueue } from "@/src/offline";
import { colors, spacing, radius, sizes } from "@/src/theme";

const TILES = [
  { key: "copilot", icon: "sparkles-outline", label: "AI Sales Copilot", color: "#7C57B5", route: "/copilot" },
  { key: "copilot-actions", icon: "flash-outline", label: "Copilot Actions", color: "#F59E0B", route: "/copilot-actions" },
  { key: "bulk-barcode", icon: "barcode-outline", label: "Bulk Barcode Print", color: colors.brand, route: "/bulk-barcode" },
  { key: "repair", icon: "construct-outline", label: "Repair Orders", color: "#F59E0B", route: "/repair" },
  { key: "rxscan", icon: "scan-outline", label: "AI Rx Scanner", color: "#7C57B5", route: "/prescription-scan" },
  { key: "wishes", icon: "gift-outline", label: "B'day & Anniversary", color: "#EC4899", route: "/wishes" },
  { key: "coupons", icon: "pricetag-outline", label: "Coupon Codes", color: colors.brand, route: "/coupons", adminOnly: true },
  { key: "referrals", icon: "people-circle-outline", label: "Customer Referrals", color: colors.brandSecondary, route: "/referrals" },
  { key: "share-app", icon: "share-social-outline", label: "Refer OptiCRM", color: "#10B981", route: "/share-app" },
  { key: "branches", icon: "business-outline", label: "Branches", color: colors.brand, route: "/branches" },
  { key: "branches-data", icon: "grid-outline", label: "Manage All Branches", color: colors.brand, route: "/branches-data", adminOnly: true },
  { key: "staff", icon: "people-outline", label: "Staff & Users", color: colors.brandSecondary, route: "/staff", adminOnly: true },
  { key: "data", icon: "swap-vertical-outline", label: "Import / Export", color: "#7C57B5", route: "/data", adminOnly: true },
  { key: "reports", icon: "analytics-outline", label: "Reports & GST", color: colors.success, route: "/reports" },
  { key: "subscription", icon: "diamond-outline", label: "Subscription", color: colors.warning, route: "/subscription" },
  { key: "scanner", icon: "qr-code-outline", label: "Barcode Scan", color: colors.brand, route: "/scanner?mode=lookup" },
  { key: "reminders", icon: "chatbubble-ellipses-outline", label: "Reminders Log", color: colors.brandSecondary, route: "/reminders" },
  { key: "settings", icon: "settings-outline", label: "Settings", color: colors.onSurfaceSecondary, route: "/settings" },
];

export default function More() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, syncing, lastSyncedAt, resync } = useAuth();
  const [sub, setSub] = useState<any>(null);
  const [broadcast, setBroadcast] = useState<any>(null);
  const [online, setOnline] = useState(true);
  const [queueLen, setQueueLen] = useState(0);

  const load = useCallback(async () => {
    try {
      const [s, on, br] = await Promise.all([api("/subscription/me"), isOnline(), api("/broadcasts/latest").catch(() => ({}))]);
      setSub(s); setOnline(on); setBroadcast(br && br.id ? br : null);
      const q = await getQueue(); setQueueLen(q.length);
      if (on && q.length) {
        const r = await flushQueue();
        if (r.flushed) {
          const q2 = await getQueue(); setQueueLen(q2.length);
        }
      }
    } catch (e) { console.warn(e); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>More</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}><Text style={styles.avatarTxt}>{(user?.name || "?").charAt(0).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user?.name}</Text>
            <Text style={styles.profileSub}>{user?.email} · {user?.role}</Text>
            {sub?.plan && (
              <View style={styles.planChip}>
                <Ionicons name="diamond" size={10} color={colors.brand} />
                <Text style={styles.planTxt}>{sub.plan.name}</Text>
              </View>
            )}
          </View>
          <Pressable testID="more-logout-button" onPress={async () => { await logout(); router.replace("/login"); }} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
          </Pressable>
        </View>

        <View style={[styles.statusCard, { backgroundColor: online ? colors.brandTertiary : "#FAD3D4" }]} testID="connectivity-card">
          <Ionicons name={online ? "cloud-done-outline" : "cloud-offline-outline"} size={20} color={online ? colors.success : colors.error} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "700", color: colors.onSurface }}>{online ? "Online" : "Offline"}</Text>
            <Text style={{ color: colors.muted, fontSize: sizes.sm }}>
              {queueLen ? `${queueLen} change(s) queued${online ? " — syncing…" : " — will sync when online"}` : "All changes synced"}
            </Text>
          </View>
          <Pressable testID="more-resync-button" onPress={resync} disabled={syncing || !online} style={styles.syncBtn} hitSlop={8}>
            <Ionicons name={syncing ? "sync" : "refresh-outline"} size={18} color={syncing ? colors.muted : colors.brand} />
          </Pressable>
        </View>
        {lastSyncedAt ? (
          <Text testID="last-synced-at" style={styles.syncStamp}>
            Last synced {new Date(lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        ) : null}

        {broadcast ? (
          <View testID="broadcast-banner" style={[styles.statusCard, {
            backgroundColor: broadcast.severity === "critical" ? "#FAD3D4" : broadcast.severity === "warning" ? "#FBE7CC" : colors.brandTertiary,
          }]}>
            <Ionicons
              name={broadcast.severity === "critical" ? "alert-circle" : broadcast.severity === "warning" ? "warning" : "information-circle"}
              size={22}
              color={broadcast.severity === "critical" ? colors.error : broadcast.severity === "warning" ? colors.warning : colors.brand}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700", color: colors.onSurface }}>{broadcast.title}</Text>
              <Text style={{ color: colors.onSurfaceSecondary, fontSize: sizes.sm, marginTop: 2 }}>{broadcast.message}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.grid}>
          {TILES.filter((t) => !t.adminOnly || user?.role === "owner" || user?.role === "admin" || user?.role === "super_admin").map((t) => (
            <Pressable
              key={t.key}
              testID={`more-tile-${t.key}`}
              onPress={() => router.push(t.route as any)}
              style={styles.tile}
            >
              <View style={[styles.tileIcon, { backgroundColor: t.color + "22" }]}>
                <Ionicons name={t.icon as any} size={22} color={t.color} />
              </View>
              <Text style={styles.tileLabel}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.footnote}>OptiCRM · v2.0 · Made for ARN Optical</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface },
  profileCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontSize: sizes.xl, fontWeight: "700" },
  profileName: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface },
  profileSub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  planChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandTertiary, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 6 },
  planTxt: { color: colors.brand, fontSize: 11, fontWeight: "700" },
  logoutBtn: { padding: spacing.sm },
  statusCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  syncBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.5)" },
  syncStamp: { textAlign: "right", color: colors.muted, fontSize: 11, marginTop: 4, paddingHorizontal: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
  tile: { width: "47%", padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "flex-start" },
  tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  tileLabel: { fontSize: sizes.base, fontWeight: "700", color: colors.onSurface },
  footnote: { textAlign: "center", color: colors.muted, fontSize: sizes.sm, marginTop: spacing.xl },
});
