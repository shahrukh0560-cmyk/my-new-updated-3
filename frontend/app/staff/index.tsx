import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";

type StaffUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  branch_id?: string | null;
  status?: string;
  created_at?: string;
};

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  owner: { label: "Owner", color: colors.brand, bg: colors.brandTertiary },
  admin: { label: "Admin", color: colors.warning, bg: "#FBE7CC" },
  staff: { label: "Staff", color: colors.brandSecondary, bg: "#E5EBE6" },
};

export default function StaffList() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [list, setList] = useState<StaffUser[]>([]);
  const [branches, setBranches] = useState<Record<string, { name: string; code?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");

  const canManage = user?.role === "owner" || user?.role === "admin" || user?.role === "super_admin";

  const load = useCallback(async () => {
    try {
      setErr("");
      const [d, b] = await Promise.all([api("/staff"), api("/branches").catch(() => [])]);
      setList(d || []);
      const map: Record<string, { name: string; code?: string }> = {};
      for (const x of (b || [])) map[x.id] = { name: x.name, code: x.code };
      setBranches(map);
    } catch (e: any) {
      setErr(e?.message || "Failed to load staff");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]} testID="staff-loader">
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="staff-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="staff-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Staff & Users</Text>
          <Text style={styles.sub}>Manage team members and roles</Text>
        </View>
        {canManage && (
          <Pressable
            testID="add-staff-button"
            onPress={() => router.push("/staff/new")}
            style={styles.addBtn}
          >
            <Ionicons name="add" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        )}
      </View>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
        ListEmptyComponent={
          <View style={styles.empty} testID="staff-empty">
            <Ionicons name="people-outline" size={36} color={colors.muted} />
            <Text style={styles.emptyText}>No team members yet</Text>
            <Text style={styles.emptySub}>Tap + to invite your first staff member</Text>
          </View>
        }
        renderItem={({ item }) => {
          const meta = ROLE_META[item.role] || ROLE_META.staff;
          const isMe = item.id === user?.id;
          return (
            <Pressable
              testID={`staff-row-${item.id}`}
              style={styles.row}
              onPress={() => item.role !== "owner" && router.push(`/staff/${item.id}` as any)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{(item.name || "?").charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{item.name}</Text>
                  {isMe && <Text style={styles.youChip}>You</Text>}
                </View>
                <Text style={styles.sub}>{item.email}</Text>
                <View style={styles.metaRow}>
                  <View style={[styles.roleChip, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.roleTxt, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                  {item.branch_id && branches[item.branch_id] ? (
                    <View style={[styles.roleChip, { backgroundColor: colors.brandTertiary, flexDirection: "row", alignItems: "center", gap: 4 }]}>
                      <Ionicons name="business-outline" size={11} color={colors.brand} />
                      <Text style={[styles.roleTxt, { color: colors.brand }]}>{branches[item.branch_id].code || branches[item.branch_id].name}</Text>
                    </View>
                  ) : null}
                  {item.status === "suspended" && (
                    <View style={[styles.roleChip, { backgroundColor: "#FAD3D4" }]}>
                      <Text style={[styles.roleTxt, { color: colors.error }]}>Suspended</Text>
                    </View>
                  )}
                </View>
              </View>
              {item.role !== "owner" && <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBtn: { padding: spacing.xs },
  title: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  err: { color: colors.error, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyText: { fontSize: sizes.lg, fontWeight: "600", color: colors.onSurface, marginTop: spacing.md },
  emptySub: { fontSize: sizes.base, color: colors.muted },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: colors.onBrandTertiary, fontWeight: "700", fontSize: sizes.lg },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { fontSize: sizes.lg, fontWeight: "600", color: colors.onSurface },
  youChip: { fontSize: 10, fontWeight: "700", color: colors.brand, backgroundColor: colors.brandTertiary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  metaRow: { flexDirection: "row", gap: spacing.sm, marginTop: 6 },
  roleChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: "flex-start" },
  roleTxt: { fontSize: 11, fontWeight: "700" },
});
