import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, FlatList, Modal } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useBranch } from "@/src/branch";
import { colors, spacing, radius, sizes } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";

export default function NewRepair() {
  const router = useRouter();
  const { activeBranchId } = useBranch();
  const [customers, setCustomers] = useState<any[]>([]);
  const [customer, setCustomer] = useState<any | null>(null);
  const [showCust, setShowCust] = useState(false);
  const [term, setTerm] = useState("");
  const [form, setForm] = useState({ item_description: "", issue: "", estimated_cost: "", advance_paid: "", expected_date: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { (async () => { try { setCustomers(await api("/customers")); } catch (e) { console.warn(e); } })(); }, []);

  const filtered = term ? customers.filter((c) => (c.name || "").toLowerCase().includes(term.toLowerCase()) || (c.phone || "").includes(term)) : customers;

  const onSave = async () => {
    if (!customer) { setErr("Select a customer"); return; }
    if (!form.item_description.trim() || !form.issue.trim()) { setErr("Item description and issue are required"); return; }
    setBusy(true); setErr("");
    try {
      const created = await api("/repair-orders", {
        method: "POST",
        body: {
          customer_id: customer.id,
          item_description: form.item_description,
          issue: form.issue,
          estimated_cost: Number(form.estimated_cost) || 0,
          advance_paid: Number(form.advance_paid) || 0,
          expected_date: form.expected_date,
          notes: form.notes,
          branch_id: activeBranchId || null,
        },
      });
      router.replace(`/repair/${created.id}`);
    } catch (e: any) { setErr(e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="New Repair Order" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}>
        <Text style={styles.label}>Customer *</Text>
        <Pressable testID="repair-select-customer" onPress={() => setShowCust(true)} style={styles.picker}>
          <Text style={{ color: customer ? colors.onSurface : colors.muted, flex: 1 }}>{customer ? `${customer.name} · ${customer.phone}` : "Select customer"}</Text>
          <Ionicons name="chevron-down" size={18} color={colors.muted} />
        </Pressable>

        <Text style={styles.label}>Item description *</Text>
        <TextInput
          testID="repair-item-description"
          value={form.item_description}
          onChangeText={(v) => setForm({ ...form, item_description: v })}
          placeholder="e.g. Ray-Ban Wayfarer black frame"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        <Text style={styles.label}>Issue *</Text>
        <TextInput
          testID="repair-issue"
          value={form.issue}
          onChangeText={(v) => setForm({ ...form, issue: v })}
          placeholder="e.g. Right temple broken, requires soldering"
          placeholderTextColor={colors.muted}
          style={[styles.input, { height: 80, textAlignVertical: "top" }]}
          multiline
        />

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Estimated cost</Text>
            <TextInput testID="repair-est-cost" value={form.estimated_cost} onChangeText={(v) => setForm({ ...form, estimated_cost: v })} keyboardType="numeric" style={styles.input} placeholder="0" placeholderTextColor={colors.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Advance paid</Text>
            <TextInput testID="repair-advance" value={form.advance_paid} onChangeText={(v) => setForm({ ...form, advance_paid: v })} keyboardType="numeric" style={styles.input} placeholder="0" placeholderTextColor={colors.muted} />
          </View>
        </View>

        <Text style={styles.label}>Expected delivery date</Text>
        <TextInput testID="repair-expected-date" value={form.expected_date} onChangeText={(v) => setForm({ ...form, expected_date: v })} style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />

        <Text style={styles.label}>Notes</Text>
        <TextInput testID="repair-notes" value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} style={[styles.input, { height: 70, textAlignVertical: "top" }]} multiline />

        {err ? <Text testID="repair-error" style={{ color: colors.error, marginTop: spacing.md }}>{err}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable testID="save-repair-button" disabled={busy} onPress={onSave} style={[styles.cta, busy && { opacity: 0.7 }]}>
          <Text style={styles.ctaText}>{busy ? "Saving…" : "Create Repair Order"}</Text>
        </Pressable>
      </View>

      <Modal visible={showCust} transparent animationType="slide" onRequestClose={() => setShowCust(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Customer</Text>
              <Pressable onPress={() => setShowCust(false)}><Ionicons name="close" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color={colors.muted} />
              <TextInput testID="repair-cust-search" value={term} onChangeText={setTerm} placeholder="Search by name or phone" placeholderTextColor={colors.muted} style={styles.searchInput} autoCapitalize="none" />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(it) => it.id}
              ListEmptyComponent={<Text style={{ padding: spacing.lg, color: colors.muted, textAlign: "center" }}>No matches</Text>}
              renderItem={({ item }) => (
                <Pressable
                  testID={`repair-cust-pick-${item.id}`}
                  onPress={() => { setCustomer(item); setShowCust(false); setTerm(""); }}
                  style={{ padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}
                >
                  <Text style={{ color: colors.onSurface, fontWeight: "600" }}>{item.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: sizes.sm, marginTop: 2 }}>{item.phone}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: sizes.sm, fontWeight: "600", color: colors.onSurfaceSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: sizes.lg, color: colors.onSurface },
  picker: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
  cta: { backgroundColor: colors.brand, padding: spacing.lg, borderRadius: radius.md, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: sizes.lg, fontWeight: "700" },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "75%" },
  modalHeader: { padding: spacing.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: sizes.xl, fontWeight: "700", color: colors.onSurface },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surfaceSecondary },
  searchInput: { flex: 1, fontSize: sizes.base, color: colors.onSurface, paddingVertical: 4 },
});
