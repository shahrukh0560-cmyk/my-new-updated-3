import { useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";

export default function NewCustomer() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", dob: "", birthday: "", anniversary: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) { setErr("Name and phone are required"); return; }
    setBusy(true); setErr("");
    try {
      const c = await api("/customers", { method: "POST", body: form });
      router.replace(`/customer/${c.id}`);
    } catch (e: any) { setErr(e.message || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="New Customer" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {(["name","phone","email","address","dob","birthday","anniversary","notes"] as const).map((k) => (
          <View key={k} style={{ marginBottom: spacing.md }}>
            <Text style={styles.label}>{
              k === "dob" ? "Date of birth (YYYY-MM-DD)" :
              k === "birthday" ? "Birthday (YYYY-MM-DD)" :
              k === "anniversary" ? "Anniversary (YYYY-MM-DD)" :
              k[0].toUpperCase() + k.slice(1)
            }{(k==="name"||k==="phone")?" *":""}</Text>
            <TextInput
              testID={`new-customer-${k}-input`}
              value={(form as any)[k]}
              onChangeText={(v) => setForm({ ...form, [k]: v })}
              style={[styles.input, k === "notes" && { height: 90, textAlignVertical: "top" }]}
              multiline={k === "notes"}
              autoCapitalize={k === "email" ? "none" : "sentences"}
              keyboardType={k === "phone" ? "phone-pad" : k === "email" ? "email-address" : "default"}
              placeholder={k === "birthday" || k === "anniversary" || k === "dob" ? "YYYY-MM-DD" : ""}
              placeholderTextColor={colors.muted}
            />
          </View>
        ))}
        {err ? <Text style={{ color: colors.error }} testID="new-customer-error">{err}</Text> : null}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable testID="save-customer-button" onPress={onSave} disabled={busy} style={[styles.cta, busy && { opacity: 0.7 }]}>
          <Text style={styles.ctaText}>{busy ? "Saving…" : "Save Customer"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: sizes.sm, fontWeight: "600", color: colors.onSurfaceSecondary, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: sizes.lg, color: colors.onSurface },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
  cta: { backgroundColor: colors.brand, padding: spacing.lg, borderRadius: radius.md, alignItems: "center" },
  ctaText: { color: colors.onBrandPrimary, fontSize: sizes.lg, fontWeight: "700" },
});
