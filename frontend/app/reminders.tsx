import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";

export default function Reminders() {
  const [list, setList] = useState<any[]>([]);

  const load = useCallback(async () => {
    try { setList(await api("/reminders")); } catch (e) { console.warn(e); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader title="Reminders Log" />
      <FlatList
        data={list}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding: spacing.lg }}
        ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: "center", marginTop: spacing.xxl }}>No reminders sent yet</Text>}
        renderItem={({ item }) => (
          <View style={styles.row} testID={`reminder-${item.id}`}>
            <View style={[styles.icon, { backgroundColor: item.channel === "whatsapp" ? "#22c55e" + "22" : colors.brand + "22" }]}>
              <Ionicons name={item.channel === "whatsapp" ? "logo-whatsapp" : "chatbubble-outline"} size={18} color={item.channel === "whatsapp" ? "#22c55e" : colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.customer_name} · {item.phone}</Text>
              <Text style={styles.msg} numberOfLines={2}>{item.message}</Text>
              <Text style={styles.meta}>{new Date(item.sent_at).toLocaleString()} · {item.status}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  name: { fontWeight: "700", color: colors.onSurface, fontSize: sizes.base },
  msg: { color: colors.onSurfaceSecondary, fontSize: sizes.sm, marginTop: 2 },
  meta: { color: colors.muted, fontSize: 11, marginTop: 4, fontFamily: "Courier" },
});
