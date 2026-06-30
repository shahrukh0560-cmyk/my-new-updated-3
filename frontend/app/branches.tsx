import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";

export default function Branches() {
  const [list, setList] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", address: "", phone: "", gstin: "" });

  const load = useCallback(async () => {
    try { setList(await api("/branches")); } catch (e) { console.warn(e); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    if (!form.name.trim() || !form.code.trim()) return;
    try {
      await api("/branches", { method: "POST", body: form });
      setForm({ name: "", code: "", address: "", phone: "", gstin: "" });
      setShow(false);
      load();
    } catch (e) { console.warn(e); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader
        title="Branches"
        right={
          <Pressable testID="add-branch-button" onPress={() => setShow(!show)} hitSlop={10}>
            <Ionicons name={show ? "close" : "add"} size={22} color={colors.brand} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {show && (
          <View style={styles.form} testID="branch-form">
            {(["name", "code", "address", "phone", "gstin"] as const).map((k) => (
              <View key={k} style={{ marginBottom: spacing.md }}>
                <Text style={styles.label}>{k === "gstin" ? "GSTIN" : k.charAt(0).toUpperCase() + k.slice(1)}{(k === "name" || k === "code") ? " *" : ""}</Text>
                <TextInput
                  testID={`branch-${k}-input`}
                  value={(form as any)[k]}
                  onChangeText={(v) => setForm({ ...form, [k]: v })}
                  style={styles.input}
                  placeholderTextColor={colors.muted}
                />
              </View>
            ))}
            <Pressable testID="save-branch-button" onPress={save} style={styles.cta}>
              <Text style={styles.ctaText}>Save Branch</Text>
            </Pressable>
          </View>
        )}

        {list.length === 0 ? (
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: spacing.xl }}>No branches yet</Text>
        ) : list.map((b) => (
          <View key={b.id} style={styles.row} testID={`branch-row-${b.id}`}>
            <View style={[styles.codeBadge, { backgroundColor: colors.brand }]}>
              <Text style={styles.codeTxt}>{b.code}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{b.name}</Text>
              {!!b.address && <Text style={styles.sub}>{b.address}</Text>}
              {!!b.phone && <Text style={styles.sub}>{b.phone}</Text>}
              {!!b.gstin && <Text style={styles.gstin}>GSTIN: {b.gstin}</Text>}
            </View>
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  label: { fontSize: sizes.sm, fontWeight: "600", color: colors.onSurfaceSecondary, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: sizes.lg, color: colors.onSurface },
  cta: { backgroundColor: colors.brand, padding: spacing.md, borderRadius: radius.md, alignItems: "center" },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: sizes.lg },
  row: { flexDirection: "row", gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, alignItems: "flex-start" },
  codeBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  codeTxt: { color: "#fff", fontWeight: "700", fontSize: sizes.sm },
  name: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  gstin: { fontSize: sizes.sm, color: colors.brand, marginTop: 4, fontFamily: "Courier" },
});
