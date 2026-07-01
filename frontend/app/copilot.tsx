import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";

type Msg = { role: "user" | "ai"; text: string; ts: number };

const SUGGESTIONS = [
  "Top-selling progressive lenses this month",
  "Customers who haven't visited in 6 months",
  "What is my revenue last 30 days?",
  "Which items are running low on stock?",
  "Which brand of frames sold the most recently?",
  "How many unpaid orders do I have?",
];

export default function Copilot() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  useEffect(() => { scrollToEnd(); }, [messages, scrollToEnd]);

  const send = async (q?: string) => {
    const text = (q ?? input).trim();
    if (!text || busy) return;
    setInput("");
    const userMsg: Msg = { role: "user", text, ts: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setBusy(true);
    try {
      const res = await api("/copilot/query", { method: "POST", body: { question: text, session_id: sessionId } });
      if (res?.session_id && !sessionId) setSessionId(res.session_id);
      setMessages((m) => [...m, { role: "ai", text: res?.answer || "(no answer)", ts: Date.now() }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "ai", text: `⚠️ ${e?.message || "Copilot request failed"}`, ts: Date.now() }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      testID="copilot-screen"
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="sparkles" size={18} color={colors.brand} />
            <Text style={styles.title}>AI Sales Copilot</Text>
          </View>
          <Text style={styles.sub}>Ask natural-language questions about your shop</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && (
          <View>
            <View style={styles.introCard}>
              <Ionicons name="bulb-outline" size={20} color={colors.brand} />
              <Text style={styles.introTitle}>Try asking</Text>
              <Text style={styles.introSub}>The copilot answers using your recent orders, customers, and inventory.</Text>
              <View style={styles.suggestGrid}>
                {SUGGESTIONS.map((s, i) => (
                  <Pressable key={i} testID={`copilot-suggest-${i}`} onPress={() => send(s)} style={styles.suggestPill}>
                    <Text style={styles.suggestTxt}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}

        {messages.map((m, i) => (
          <View key={i} style={[styles.msgWrap, m.role === "user" ? styles.msgUser : styles.msgAi]}>
            <Text style={[styles.msgTxt, m.role === "user" && { color: "#fff" }]}>{m.text}</Text>
          </View>
        ))}
        {busy && (
          <View style={[styles.msgWrap, styles.msgAi, { flexDirection: "row", alignItems: "center", gap: spacing.sm }]}>
            <ActivityIndicator size="small" color={colors.brand} />
            <Text style={{ color: colors.muted, fontStyle: "italic" }}>Analyzing your data…</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.inputBar, { paddingBottom: insets.bottom || spacing.md }]}>
        <TextInput
          testID="copilot-input"
          value={input}
          onChangeText={setInput}
          placeholder="Ask anything about your shop…"
          placeholderTextColor={colors.muted}
          style={styles.input}
          onSubmitEditing={() => send()}
          returnKeyType="send"
        />
        <Pressable
          testID="copilot-send"
          onPress={() => send()}
          disabled={busy || !input.trim()}
          style={[styles.sendBtn, (busy || !input.trim()) && { opacity: 0.4 }]}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  backBtn: { padding: spacing.xs, marginBottom: 2 },
  title: { fontSize: sizes.xl, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  introCard: { backgroundColor: colors.brandTertiary, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.lg },
  introTitle: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface, marginTop: spacing.sm },
  introSub: { color: colors.muted, marginTop: 4, fontSize: sizes.sm },
  suggestGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  suggestPill: { paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: colors.brand + "55" },
  suggestTxt: { fontSize: sizes.sm, color: colors.brand, fontWeight: "600" },
  msgWrap: { padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm, maxWidth: "92%" },
  msgUser: { backgroundColor: colors.brand, alignSelf: "flex-end", borderBottomRightRadius: 4 },
  msgAi: { backgroundColor: colors.surfaceSecondary, alignSelf: "flex-start", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  msgTxt: { fontSize: sizes.base, color: colors.onSurface, lineHeight: 20 },
  inputBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 22, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: sizes.base, color: colors.onSurface },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
