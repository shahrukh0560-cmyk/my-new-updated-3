import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  converted: "#0EA5E9",
  rewarded: "#10B981",
};

export default function Referrals() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [show, setShow] = useState(false);
  const [referrer, setReferrer] = useState<any | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [term, setTerm] = useState("");
  const [form, setForm] = useState({ referred_name: "", referred_phone: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const [refs, cs] = await Promise.all([api("/referrals"), api("/customers")]);
      setItems(refs); setCustomers(cs);
    } catch (e) { console.warn(e); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = term ? customers.filter((c) => (c.name || "").toLowerCase().includes(term.toLowerCase()) || (c.phone || "").includes(term)) : customers;

  const onSave = async () => {
    setErr("");
    if (!referrer) { setErr("Select the referring customer"); return; }
    if (!form.referred_name.trim() || !form.referred_phone.trim()) { setErr("Referred name and phone required"); return; }
    setBusy(true);
    try {
      await api("/referrals", { method: "POST", body: { referrer_customer_id: referrer.id, ...form } });
      setShow(false); setReferrer(null);
      setForm({ referred_name: "", referred_phone: "", notes: "" });
      load();
    } catch (e: any) { setErr(e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  const convert = async (id: string) => {
    try { await api(`/referrals/${id}/convert?reward_points=100`, { method: "POST" }); load(); } catch (e) { console.warn(e); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="referrals-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="referrals-back"><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Referrals</Text>
          <Text style={styles.sub}>{items.length} referral{items.length === 1 ? "" : "s"}</Text>
        </View>
        <Pressable testID="new-referral-button" onPress={() => setShow(true)} style={styles.newBtn}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.newBtnTxt}>Add</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="people-circle-outline" size={32} color={colors.muted} /><Text style={styles.emptyTxt}>No referrals yet</Text></View>}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        renderItem={({ item }) => (
          <View style={styles.card} testID={`referral-${item.id}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.referred_name}</Text>
              <Text style={styles.muted}>{item.referred_phone}</Text>
              <Text style={[styles.muted, { marginTop: 4 }]}>by <Text style={{ color: colors.brand, fontWeight: "700" }}>{item.referrer_name}</Text></Text>
              {item.reward_points ? <Text style={[styles.muted, { color: colors.success }]}>+{item.reward_points} pts awarded</Text> : null}
            </View>
            <View style={{ alignItems: "flex-end", gap: spacing.sm }}>
              <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[item.status] || colors.muted) + "20" }]}>
                <Text style={[styles.badgeTxt, { color: STATUS_COLORS[item.status] || colors.muted }]}>{(item.status || "").toUpperCase()}</Text>
              </View>
              {item.status !== "rewarded" ? (
                <Pressable testID={`convert-referral-${item.id}`} onPress={() => convert(item.id)} style={styles.convertBtn}>
                  <Text style={styles.convertBtnTxt}>Reward +100 pts</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      />

      <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
        <View style={modal.wrap}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={modal.card}>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
              <View style={modal.head}>
                <Text style={modal.title}>New Referral</Text>
                <Pressable onPress={() => setShow(false)} testID="close-referral-modal"><Ionicons name="close" size={22} color={colors.onSurface} /></Pressable>
              </View>
              <Text style={styles.label}>Referring customer *</Text>
              <Pressable testID="referral-pick-referrer" onPress={() => setShowPicker(true)} style={styles.picker}>
                <Text style={{ color: referrer ? colors.onSurface : colors.muted, flex: 1 }}>{referrer ? `${referrer.name} · ${referrer.phone}` : "Choose customer"}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.muted} />
              </Pressable>
              <Text style={styles.label}>Referred person name *</Text>
              <TextInput testID="referral-name" value={form.referred_name} onChangeText={(v) => setForm({ ...form, referred_name: v })} placeholder="Friend / family name" placeholderTextColor={colors.muted} style={styles.input} />
              <Text style={styles.label}>Referred phone *</Text>
              <TextInput testID="referral-phone" value={form.referred_phone} onChangeText={(v) => setForm({ ...form, referred_phone: v })} keyboardType="phone-pad" placeholder="+91 9000000000" placeholderTextColor={colors.muted} style={styles.input} />
              <Text style={styles.label}>Notes</Text>
              <TextInput value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} placeholder="Optional" placeholderTextColor={colors.muted} style={styles.input} />
              {err ? <Text style={{ color: colors.error, marginTop: spacing.sm }}>{err}</Text> : null}
              <Pressable testID="save-referral-button" disabled={busy} onPress={onSave} style={[styles.cta, { marginTop: spacing.lg }, busy && { opacity: 0.7 }]}>
                <Text style={styles.ctaText}>{busy ? "Saving…" : "Save referral"}</Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <View style={modal.wrap}>
          <View style={modal.card}>
            <View style={[modal.head, { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={modal.title}>Select Customer</Text>
              <Pressable onPress={() => setShowPicker(false)}><Ionicons name="close" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color={colors.muted} />
              <TextInput testID="referral-search" value={term} onChangeText={setTerm} placeholder="Search…" placeholderTextColor={colors.muted} style={styles.searchInput} autoCapitalize="none" />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(it) => it.id}
              ListEmptyComponent={<Text style={{ padding: spacing.lg, color: colors.muted, textAlign: "center" }}>No matches</Text>}
              renderItem={({ item }) => (
                <Pressable testID={`referral-pick-${item.id}`} onPress={() => { setReferrer(item); setShowPicker(false); setTerm(""); }} style={{ padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ color: colors.onSurface, fontWeight: "600" }}>{item.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: sizes.sm, marginTop: 2 }}>{item.phone}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.xs },
  title: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brand, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.md },
  newBtnTxt: { color: "#fff", fontWeight: "700", fontSize: sizes.sm },
  card: { padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, flexDirection: "row", alignItems: "flex-start" },
  cardTitle: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface },
  muted: { fontSize: sizes.sm, color: colors.muted },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeTxt: { fontSize: 10, fontWeight: "700" },
  convertBtn: { backgroundColor: colors.brand, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.sm },
  convertBtnTxt: { color: "#fff", fontWeight: "700", fontSize: sizes.sm },
  empty: { padding: spacing.xxl, alignItems: "center" },
  emptyTxt: { color: colors.muted, fontSize: sizes.base, marginTop: spacing.sm },
  label: { fontSize: sizes.sm, fontWeight: "600", color: colors.onSurfaceSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: sizes.base, color: colors.onSurface },
  picker: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  cta: { backgroundColor: colors.brand, padding: spacing.lg, borderRadius: radius.md, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: sizes.lg, fontWeight: "700" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surfaceSecondary },
  searchInput: { flex: 1, fontSize: sizes.base, color: colors.onSurface, paddingVertical: 4 },
});

const modal = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  card: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%" },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  title: { fontSize: sizes.xl, fontWeight: "700", color: colors.onSurface },
});
