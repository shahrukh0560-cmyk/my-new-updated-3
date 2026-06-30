import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";

const SEVERITIES = [
  { id: "info", label: "Info", color: colors.brand, icon: "information-circle-outline" },
  { id: "warning", label: "Warning", color: colors.warning, icon: "warning-outline" },
  { id: "critical", label: "Critical", color: colors.error, icon: "alert-circle-outline" },
] as const;

export default function Broadcast() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<"info" | "warning" | "critical">("info");
  const [list, setList] = useState<any[]>([]);
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { const d = await api("/admin/broadcasts"); setList(d || []); } catch {}
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onSend = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert("Missing", "Title and message are required.");
      return;
    }
    setPosting(true);
    try {
      await api("/admin/broadcast", { method: "POST", body: { title: title.trim(), message: message.trim(), severity } });
      setTitle(""); setMessage(""); setSeverity("info");
      await load();
    } catch (e: any) { Alert.alert("Error", e?.message || "Failed"); }
    finally { setPosting(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Platform Broadcast</Text>
          <Text style={styles.sub}>Send announcement to all tenants</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.label}>Severity</Text>
          <View style={styles.row}>
            {SEVERITIES.map((s) => (
              <Pressable
                key={s.id}
                testID={`severity-${s.id}`}
                onPress={() => setSeverity(s.id as any)}
                style={[styles.sevBtn, severity === s.id && { backgroundColor: s.color + "22", borderColor: s.color }]}
              >
                <Ionicons name={s.icon as any} size={18} color={severity === s.id ? s.color : colors.muted} />
                <Text style={[styles.sevTxt, severity === s.id && { color: s.color }]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Title</Text>
          <TextInput
            testID="broadcast-title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Scheduled maintenance"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          <Text style={styles.label}>Message</Text>
          <TextInput
            testID="broadcast-message"
            value={message}
            onChangeText={setMessage}
            placeholder="Detail the announcement"
            placeholderTextColor={colors.muted}
            style={[styles.input, { minHeight: 120, textAlignVertical: "top" }]}
            multiline
          />

          <Pressable testID="broadcast-send" disabled={posting} onPress={onSend} style={({ pressed }) => [styles.cta, (pressed || posting) && { opacity: 0.85 }]}>
            <Ionicons name="send" size={18} color="#fff" />
            <Text style={styles.ctaTxt}>{posting ? "Sending…" : "Send broadcast"}</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Recent broadcasts</Text>
        {loading ? (
          <ActivityIndicator color={colors.brand} />
        ) : list.length === 0 ? (
          <Text style={styles.empty}>No broadcasts yet.</Text>
        ) : (
          list.map((b) => {
            const meta = SEVERITIES.find((s) => s.id === b.severity) || SEVERITIES[0];
            return (
              <View key={b.id} style={[styles.histCard, { borderLeftColor: meta.color }]}>
                <View style={styles.histHead}>
                  <Ionicons name={meta.icon as any} size={16} color={meta.color} />
                  <Text style={[styles.histSev, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
                  <Text style={styles.histDate}>{new Date(b.created_at).toLocaleString()}</Text>
                </View>
                <Text style={styles.histTitle}>{b.title}</Text>
                <Text style={styles.histMsg}>{b.message}</Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingBottom: spacing.md, backgroundColor: colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  backBtn: { padding: spacing.sm },
  title: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  card: { padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  label: { fontSize: sizes.sm, fontWeight: "600", color: colors.onSurfaceSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  row: { flexDirection: "row", gap: spacing.sm },
  sevBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTertiary },
  sevTxt: { fontSize: sizes.sm, fontWeight: "700", color: colors.muted },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, fontSize: sizes.base, color: colors.onSurface, borderWidth: 1, borderColor: colors.border },
  cta: { marginTop: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, padding: spacing.md, borderRadius: radius.md },
  ctaTxt: { color: "#fff", fontWeight: "700", fontSize: sizes.base },
  section: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.md },
  empty: { color: colors.muted, textAlign: "center", padding: spacing.lg },
  histCard: { padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, marginBottom: spacing.sm },
  histHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  histSev: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  histDate: { fontSize: sizes.sm, color: colors.muted, marginLeft: "auto" },
  histTitle: { fontSize: sizes.base, fontWeight: "700", color: colors.onSurface },
  histMsg: { fontSize: sizes.sm, color: colors.onSurfaceSecondary, marginTop: 4 },
});
