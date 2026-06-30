import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";

const ROLES: Array<{ id: "staff" | "admin"; label: string }> = [
  { id: "staff", label: "Staff" },
  { id: "admin", label: "Admin" },
];

export default function EditStaff() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [staff, setStaff] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [role, setRole] = useState<"staff" | "admin">("staff");
  const [status, setStatus] = useState<"active" | "suspended">("active");
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const [list, bs] = await Promise.all([api(`/staff`), api(`/branches`).catch(() => [])]);
      setBranches(bs || []);
      const s = (list || []).find((u: any) => u.id === id);
      if (s) {
        setStaff(s);
        setName(s.name || "");
        setRole((s.role === "admin" ? "admin" : "staff") as any);
        setStatus((s.status === "suspended" ? "suspended" : "active") as any);
        setBranchId(s.branch_id || null);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onSave = async () => {
    setErr(""); setBusy(true);
    try {
      const body: any = { name, role, status, branch_id: branchId };
      if (newPassword.length >= 6) body.password = newPassword;
      await api(`/staff/${id}`, { method: "PUT", body });
      router.back();
    } catch (e: any) {
      setErr(e?.message || "Failed to save");
    } finally { setBusy(false); }
  };

  const onDelete = async () => {
    setBusy(true);
    try {
      await api(`/staff/${id}`, { method: "DELETE" });
      router.back();
    } catch (e: any) {
      setErr(e?.message || "Failed to delete");
    } finally { setBusy(false); }
  };

  if (loading) {
    return <View style={[styles.center, { paddingTop: insets.top }]}><ActivityIndicator size="large" color={colors.brand} /></View>;
  }
  if (!staff) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={{ color: colors.muted }}>Staff member not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.linkBtn}><Text style={styles.linkTxt}>Go back</Text></Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="edit-staff-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Edit Member</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <View style={styles.metaCard}>
          <View style={styles.avatar}><Text style={styles.avatarTxt}>{(staff.name || "?").charAt(0).toUpperCase()}</Text></View>
          <View>
            <Text style={styles.metaEmail}>{staff.email}</Text>
            <Text style={styles.metaSub}>Joined {staff.created_at ? new Date(staff.created_at).toLocaleDateString() : "—"}</Text>
          </View>
        </View>

        <Text style={styles.label}>Name</Text>
        <TextInput testID="edit-name-input" value={name} onChangeText={setName} style={styles.input} placeholderTextColor={colors.muted} />

        <Text style={styles.label}>Role</Text>
        <View style={styles.segment}>
          {ROLES.map((r) => (
            <Pressable
              key={r.id}
              testID={`edit-role-${r.id}`}
              onPress={() => setRole(r.id)}
              style={[styles.segmentBtn, role === r.id && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentTxt, role === r.id && styles.segmentTxtActive]}>{r.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Status</Text>
        <View style={styles.segment}>
          {(["active", "suspended"] as const).map((s) => (
            <Pressable
              key={s}
              testID={`edit-status-${s}`}
              onPress={() => setStatus(s)}
              style={[styles.segmentBtn, status === s && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentTxt, status === s && styles.segmentTxtActive]}>{s === "active" ? "Active" : "Suspended"}</Text>
            </Pressable>
          ))}
        </View>

        {branches.length > 0 && (
          <>
            <Text style={styles.label}>Branch assignment</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              <Pressable
                testID="edit-branch-chip-all"
                onPress={() => setBranchId(null)}
                style={[styles.chip, branchId === null && styles.chipActive]}
              >
                <Ionicons name="globe-outline" size={14} color={branchId === null ? "#fff" : colors.muted} />
                <Text style={[styles.chipTxt, branchId === null && styles.chipTxtActive]}>All branches</Text>
              </Pressable>
              {branches.map((b) => (
                <Pressable
                  key={b.id}
                  testID={`edit-branch-chip-${b.id}`}
                  onPress={() => setBranchId(b.id)}
                  style={[styles.chip, branchId === b.id && styles.chipActive]}
                >
                  <Ionicons name="business-outline" size={14} color={branchId === b.id ? "#fff" : colors.muted} />
                  <Text style={[styles.chipTxt, branchId === b.id && styles.chipTxtActive]} numberOfLines={1}>
                    {b.code ? `${b.code} · ${b.name}` : b.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        <Text style={styles.label}>Reset password (optional)</Text>
        <TextInput testID="edit-password-input" value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Leave blank to keep current" placeholderTextColor={colors.muted} style={styles.input} />

        {err ? <Text style={styles.err} testID="edit-staff-error">{err}</Text> : null}

        <Pressable testID="save-staff-button" onPress={onSave} disabled={busy} style={({ pressed }) => [styles.cta, (pressed || busy) && { opacity: 0.85 }]}>
          <Text style={styles.ctaTxt}>{busy ? "Saving…" : "Save Changes"}</Text>
        </Pressable>

        <Pressable testID="delete-staff-button" onPress={onDelete} disabled={busy} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
          <Text style={styles.deleteTxt}>Remove Member</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, gap: spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBtn: { padding: spacing.xs },
  title: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface },
  label: { marginTop: spacing.lg, marginBottom: spacing.xs, fontSize: sizes.sm, color: colors.onSurfaceSecondary, fontWeight: "600" },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, fontSize: sizes.lg, color: colors.onSurface, borderWidth: 1, borderColor: colors.border },
  metaCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: colors.onBrandTertiary, fontWeight: "700", fontSize: sizes.xl },
  metaEmail: { fontSize: sizes.base, fontWeight: "600", color: colors.onSurface },
  metaSub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 4, gap: 4, borderWidth: 1, borderColor: colors.border },
  segmentBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: "center", borderRadius: radius.sm },
  segmentBtnActive: { backgroundColor: colors.brand },
  segmentTxt: { fontSize: sizes.base, fontWeight: "600", color: colors.muted },
  segmentTxtActive: { color: "#fff" },
  chipsRow: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.xs, paddingHorizontal: 2 },
  chip: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipTxt: { fontSize: sizes.sm, color: colors.onSurface, fontWeight: "600", maxWidth: 180 },
  chipTxtActive: { color: "#fff" },
  err: { color: colors.error, marginTop: spacing.md, fontSize: sizes.base },
  cta: { marginTop: spacing.xl, backgroundColor: colors.brand, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  ctaTxt: { color: colors.onBrandPrimary, fontSize: sizes.lg, fontWeight: "700" },
  deleteBtn: { marginTop: spacing.md, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.error },
  deleteTxt: { color: colors.error, fontWeight: "700", fontSize: sizes.base },
  linkBtn: { padding: spacing.md },
  linkTxt: { color: colors.brand, fontWeight: "700" },
});
