import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";

export default function Wishes() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<{ birthdays: any[]; anniversaries: any[]; date: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try { setData(await api("/customers/celebrations/today")); } catch (e) { console.warn(e); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sendWish = async (cid: string, occasion: "birthday" | "anniversary") => {
    try {
      await api("/customers/wishes/send", { method: "POST", body: { customer_id: cid, occasion, channel: "whatsapp" } });
      setSentIds(new Set([...sentIds, cid + ":" + occasion]));
    } catch (e: any) { Alert.alert("Failed", e?.message || "Could not send"); }
  };

  const sendAll = async (occasion: "birthday" | "anniversary") => {
    try {
      const r = await api(`/customers/wishes/send-bulk?occasion=${occasion}&channel=whatsapp`, { method: "POST" });
      Alert.alert("Sent", `${r.sent} ${occasion} wish(es) sent`);
      const list = occasion === "birthday" ? (data?.birthdays || []) : (data?.anniversaries || []);
      const next = new Set(sentIds);
      list.forEach((c) => next.add(c.id + ":" + occasion));
      setSentIds(next);
    } catch (e: any) { Alert.alert("Failed", e?.message || "Could not send"); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="wishes-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="wishes-back"><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Celebrations Today</Text>
          <Text style={styles.sub}>{data?.date || ""}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <Section
          icon="gift-outline"
          color="#EC4899"
          title="Birthdays"
          count={data?.birthdays?.length || 0}
          onSendAll={() => sendAll("birthday")}
          customers={data?.birthdays || []}
          sentIds={sentIds}
          occasion="birthday"
          onSend={sendWish}
        />
        <Section
          icon="heart-outline"
          color="#F59E0B"
          title="Anniversaries"
          count={data?.anniversaries?.length || 0}
          onSendAll={() => sendAll("anniversary")}
          customers={data?.anniversaries || []}
          sentIds={sentIds}
          occasion="anniversary"
          onSend={sendWish}
        />
      </ScrollView>
    </View>
  );
}

function Section({ icon, color, title, count, customers, onSendAll, onSend, sentIds, occasion }: any) {
  return (
    <View style={[styles.card, { marginBottom: spacing.lg, borderColor: color + "33" }]}>
      <View style={styles.cardHead}>
        <View style={[styles.headIcon, { backgroundColor: color + "22" }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.muted}>{count} customer{count === 1 ? "" : "s"} today</Text>
        </View>
        {count > 0 ? (
          <Pressable testID={`send-all-${occasion}`} onPress={onSendAll} style={[styles.sendAllBtn, { backgroundColor: color }]}>
            <Ionicons name="paper-plane-outline" size={14} color="#fff" />
            <Text style={styles.sendAllTxt}>Send all</Text>
          </Pressable>
        ) : null}
      </View>
      {count === 0 ? (
        <Text style={styles.empty}>No {title.toLowerCase()} today</Text>
      ) : (
        customers.map((c: any) => {
          const key = c.id + ":" + occasion;
          const sent = sentIds.has(key);
          return (
            <View key={c.id} style={styles.row} testID={`wish-row-${c.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.muted}>{c.phone}</Text>
              </View>
              <Pressable
                testID={`send-${occasion}-${c.id}`}
                disabled={sent}
                onPress={() => onSend(c.id, occasion)}
                style={[styles.sendBtn, { borderColor: color }, sent && { backgroundColor: color + "22" }]}
              >
                <Ionicons name={sent ? "checkmark" : "logo-whatsapp"} size={14} color={color} />
                <Text style={[styles.sendBtnTxt, { color }]}>{sent ? "Sent" : "Send"}</Text>
              </Pressable>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.xs },
  title: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  card: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, backgroundColor: colors.surfaceSecondary },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  headIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface },
  muted: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  sendAllBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm },
  sendAllTxt: { color: "#fff", fontWeight: "700", fontSize: sizes.sm },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  name: { fontSize: sizes.base, fontWeight: "600", color: colors.onSurface },
  sendBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1 },
  sendBtnTxt: { fontWeight: "700", fontSize: sizes.sm },
  empty: { color: colors.muted, fontStyle: "italic", paddingVertical: spacing.sm },
});
