import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";

const ROLES = [
  { id: "staff", label: "Staff", desc: "Day-to-day operations, orders, customers" },
  { id: "admin", label: "Admin", desc: "Full access incl. branches, settings, imports" },
];

export default function NewStaff() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"staff" | "admin">("staff");
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await api("/branches");
        if (!cancelled) setBranches(b || []);
      } catch { /* silent — branches optional */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const onSubmit = async () => {
    setErr("");
    if (!name.trim() || !email.trim() || password.length < 6) {
      setErr("Name, valid email, and password (min 6 chars) are required");
      return;
    }
    setLoading(true);
    try {
      await api("/staff", { method: "POST", body: { name: name.trim(), email: email.trim().toLowerCase(), password, role, branch_id: branchId } });
      router.back();
    } catch (e: any) {
      setErr(e?.message || "Failed to create staff");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="new-staff-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Add Team Member</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Full name</Text>
        <TextInput testID="staff-name-input" value={name} onChangeText={setName} placeholder="e.g. Priya Sharma" placeholderTextColor={colors.muted} style={styles.input} />

        <Text style={styles.label}>Email</Text>
        <TextInput testID="staff-email-input" value={email} onChangeText={setEmail} placeholder="staff@shop.com" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" style={styles.input} />

        <Text style={styles.label}>Temporary password</Text>
        <TextInput testID="staff-password-input" value={password} onChangeText={setPassword} placeholder="Min 6 characters" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} />
        <Text style={styles.hint}>Share this with the team member. They can change it later.</Text>

        <Text style={styles.label}>Role</Text>
        {ROLES.map((r) => (
          <Pressable
            key={r.id}
            testID={`role-option-${r.id}`}
            onPress={() => setRole(r.id as "staff" | "admin")}
            style={[styles.roleCard, role === r.id && styles.roleCardActive]}
          >
            <View style={[styles.radio, role === r.id && styles.radioActive]}>
              {role === r.id && <View style={styles.radioDot} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.roleLabel}>{r.label}</Text>
              <Text style={styles.roleDesc}>{r.desc}</Text>
            </View>
          </Pressable>
        ))}

        {branches.length > 0 && (
          <>
            <Text style={styles.label}>Assign to branch (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              <Pressable
                testID="branch-chip-all"
                onPress={() => setBranchId(null)}
                style={[styles.chip, branchId === null && styles.chipActive]}
              >
                <Ionicons name="globe-outline" size={14} color={branchId === null ? "#fff" : colors.muted} />
                <Text style={[styles.chipTxt, branchId === null && styles.chipTxtActive]}>All branches</Text>
              </Pressable>
              {branches.map((b) => (
                <Pressable
                  key={b.id}
                  testID={`branch-chip-${b.id}`}
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

        {err ? <Text style={styles.err} testID="staff-error">{err}</Text> : null}

        <Pressable
          testID="staff-submit-button"
          onPress={onSubmit}
          disabled={loading}
          style={({ pressed }) => [styles.cta, (pressed || loading) && { opacity: 0.85 }]}
        >
          <Ionicons name="person-add-outline" size={18} color={colors.onBrandPrimary} />
          <Text style={styles.ctaTxt}>{loading ? "Creating…" : "Create Account"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBtn: { padding: spacing.xs },
  title: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface },
  label: { marginTop: spacing.lg, marginBottom: spacing.xs, fontSize: sizes.sm, color: colors.onSurfaceSecondary, fontWeight: "600" },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, fontSize: sizes.lg, color: colors.onSurface, borderWidth: 1, borderColor: colors.border },
  hint: { fontSize: sizes.sm, color: colors.muted, marginTop: 6 },
  roleCard: { flexDirection: "row", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, marginBottom: spacing.sm, alignItems: "center" },
  roleCardActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: colors.brand },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  roleLabel: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface },
  roleDesc: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  chipsRow: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.xs, paddingHorizontal: 2 },
  chip: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipTxt: { fontSize: sizes.sm, color: colors.onSurface, fontWeight: "600", maxWidth: 180 },
  chipTxtActive: { color: "#fff" },
  err: { color: colors.error, marginTop: spacing.md, fontSize: sizes.base },
  cta: { marginTop: spacing.xl, backgroundColor: colors.brand, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.sm },
  ctaTxt: { color: colors.onBrandPrimary, fontSize: sizes.lg, fontWeight: "700" },
});
