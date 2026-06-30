import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";

export default function Coupons() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ code: "", discount_type: "percent", value: "", min_order: "0", max_discount: "", expires_at: "", usage_limit: "0", active: true, description: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try { setItems(await api("/coupons")); } catch (e) { console.warn(e); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onSave = async () => {
    setErr("");
    if (!form.code.trim() || !form.value.trim()) { setErr("Code and value are required"); return; }
    setBusy(true);
    try {
      await api("/coupons", {
        method: "POST",
        body: {
          code: form.code.trim().toUpperCase(),
          discount_type: form.discount_type as any,
          value: Number(form.value) || 0,
          min_order: Number(form.min_order) || 0,
          max_discount: form.max_discount ? Number(form.max_discount) : null,
          expires_at: form.expires_at,
          usage_limit: Number(form.usage_limit) || 0,
          active: form.active,
          description: form.description,
        },
      });
      setShow(false);
      setForm({ code: "", discount_type: "percent", value: "", min_order: "0", max_discount: "", expires_at: "", usage_limit: "0", active: true, description: "" });
      load();
    } catch (e: any) { setErr(e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  const removeCoupon = async (id: string) => {
    try { await api(`/coupons/${id}`, { method: "DELETE" }); load(); } catch (e) { console.warn(e); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="coupons-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="coupons-back"><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Coupon Codes</Text>
          <Text style={styles.sub}>{items.length} coupon{items.length === 1 ? "" : "s"}</Text>
        </View>
        <Pressable testID="new-coupon-button" onPress={() => setShow(true)} style={styles.newBtn}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.newBtnTxt}>New</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="pricetag-outline" size={32} color={colors.muted} /><Text style={styles.emptyTxt}>No coupons yet</Text></View>}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        renderItem={({ item }) => (
          <View style={styles.card} testID={`coupon-${item.code}`}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Text style={styles.code}>{item.code}</Text>
                <View style={[styles.badge, { backgroundColor: item.active ? colors.brandTertiary : "#FAD3D4" }]}>
                  <Text style={[styles.badgeTxt, { color: item.active ? colors.success : colors.error }]}>{item.active ? "ACTIVE" : "INACTIVE"}</Text>
                </View>
              </View>
              <Text style={styles.discount}>{item.discount_type === "percent" ? `${item.value}% off` : `₹${item.value} off`}{item.min_order ? ` · Min ₹${item.min_order}` : ""}</Text>
              {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
              <Text style={styles.muted}>Uses: {item.uses || 0}{item.usage_limit ? ` / ${item.usage_limit}` : ""}{item.expires_at ? ` · Expires ${item.expires_at}` : ""}</Text>
            </View>
            <Pressable testID={`delete-coupon-${item.id}`} onPress={() => removeCoupon(item.id)} hitSlop={8}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </Pressable>
          </View>
        )}
      />

      <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
        <View style={modalStyles.wrap}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={modalStyles.card}>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
              <View style={modalStyles.head}>
                <Text style={modalStyles.title}>New Coupon</Text>
                <Pressable onPress={() => setShow(false)} testID="close-coupon-modal"><Ionicons name="close" size={22} color={colors.onSurface} /></Pressable>
              </View>
              <Text style={styles.label}>Code *</Text>
              <TextInput testID="coupon-code-field" value={form.code} onChangeText={(v) => setForm({ ...form, code: v })} autoCapitalize="characters" placeholder="WELCOME10" placeholderTextColor={colors.muted} style={styles.input} />
              <Text style={styles.label}>Type</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {(["percent", "flat"] as const).map((t) => (
                  <Pressable key={t} testID={`coupon-type-${t}`} onPress={() => setForm({ ...form, discount_type: t })} style={[styles.typeChip, form.discount_type === t && styles.typeChipActive]}>
                    <Text style={[styles.typeChipTxt, form.discount_type === t && { color: "#fff" }]}>{t === "percent" ? "Percentage" : "Flat amount"}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Value *</Text>
                  <TextInput testID="coupon-value-field" value={form.value} onChangeText={(v) => setForm({ ...form, value: v })} keyboardType="numeric" placeholder={form.discount_type === "percent" ? "10" : "100"} placeholderTextColor={colors.muted} style={styles.input} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Min order</Text>
                  <TextInput value={form.min_order} onChangeText={(v) => setForm({ ...form, min_order: v })} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} style={styles.input} />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Max discount</Text>
                  <TextInput value={form.max_discount} onChangeText={(v) => setForm({ ...form, max_discount: v })} keyboardType="numeric" placeholder="cap (optional)" placeholderTextColor={colors.muted} style={styles.input} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Usage limit</Text>
                  <TextInput value={form.usage_limit} onChangeText={(v) => setForm({ ...form, usage_limit: v })} keyboardType="numeric" placeholder="0 = unlimited" placeholderTextColor={colors.muted} style={styles.input} />
                </View>
              </View>
              <Text style={styles.label}>Expires (YYYY-MM-DD)</Text>
              <TextInput value={form.expires_at} onChangeText={(v) => setForm({ ...form, expires_at: v })} placeholder="2026-12-31" placeholderTextColor={colors.muted} style={styles.input} />
              <Text style={styles.label}>Description</Text>
              <TextInput value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} placeholder="Internal note" placeholderTextColor={colors.muted} style={styles.input} />
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md }}>
                <Text style={{ color: colors.onSurface, fontWeight: "600" }}>Active</Text>
                <Switch testID="coupon-active-switch" value={form.active} onValueChange={(v) => setForm({ ...form, active: v })} trackColor={{ true: colors.brand }} />
              </View>
              {err ? <Text style={{ color: colors.error, marginTop: spacing.sm }}>{err}</Text> : null}
              <Pressable testID="save-coupon-button" disabled={busy} onPress={onSave} style={[styles.cta, { marginTop: spacing.lg }, busy && { opacity: 0.7 }]}>
                <Text style={styles.ctaText}>{busy ? "Saving…" : "Save coupon"}</Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
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
  card: { padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md },
  code: { fontSize: sizes.xl, fontWeight: "700", color: colors.brand, letterSpacing: 1 },
  discount: { fontSize: sizes.base, color: colors.onSurface, fontWeight: "600", marginTop: 2 },
  desc: { fontSize: sizes.sm, color: colors.onSurfaceSecondary, marginTop: 2 },
  muted: { fontSize: sizes.sm, color: colors.muted, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeTxt: { fontSize: 10, fontWeight: "700" },
  empty: { padding: spacing.xxl, alignItems: "center" },
  emptyTxt: { color: colors.muted, fontSize: sizes.base, marginTop: spacing.sm },
  label: { fontSize: sizes.sm, fontWeight: "600", color: colors.onSurfaceSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: sizes.base, color: colors.onSurface },
  typeChip: { flex: 1, paddingVertical: spacing.md, alignItems: "center", borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTertiary },
  typeChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  typeChipTxt: { color: colors.muted, fontWeight: "600" },
  cta: { backgroundColor: colors.brand, padding: spacing.lg, borderRadius: radius.md, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: sizes.lg, fontWeight: "700" },
});

const modalStyles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  card: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%" },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  title: { fontSize: sizes.xl, fontWeight: "700", color: colors.onSurface },
});
