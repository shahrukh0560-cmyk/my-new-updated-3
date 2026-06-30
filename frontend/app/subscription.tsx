import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";

export default function Subscription() {
  const [plans, setPlans] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([api("/subscription/plans"), api("/subscription/me")]);
      setPlans(p); setMe(s);
    } catch (e) { console.warn(e); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const choose = async (planId: string) => {
    setBusy(planId); setToast("");
    try {
      const res = await api("/subscription/start", { method: "POST", body: { plan_id: planId } });
      setToast(res.note || "Plan activated");
      load();
    } catch (e: any) { setToast(e?.message || "Failed"); }
    finally { setBusy(null); setTimeout(() => setToast(""), 4000); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader title="Subscription" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={styles.banner} testID="mock-banner">
          <Ionicons name="information-circle" size={18} color={colors.brand} />
          <Text style={styles.bannerTxt}>Razorpay payment gateway is MOCKED. Add RAZORPAY_KEY_ID/SECRET to enable live charges.</Text>
        </View>

        {me?.plan && (
          <View style={styles.currentCard} testID="current-plan-card">
            <Text style={styles.currentLabel}>Current Plan</Text>
            <Text style={styles.currentName}>{me.plan.name}</Text>
            <Text style={styles.currentPrice}>{me.plan.price > 0 ? `₹${me.plan.price} / month` : `Free · ${me.plan.trial_days} days trial`}</Text>
            {me.expires_at && <Text style={styles.currentExp}>Renews / expires {new Date(me.expires_at).toLocaleDateString()}</Text>}
          </View>
        )}

        {plans.map((p) => {
          const isCurrent = me?.plan_id === p.id;
          return (
            <View key={p.id} style={[styles.planCard, isCurrent && { borderColor: colors.brand, borderWidth: 2 }]} testID={`plan-${p.id}`}>
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{p.name}</Text>
                <Text style={styles.planPrice}>{p.price > 0 ? `₹${p.price}` : "Free"}<Text style={styles.planPriceUnit}>{p.price > 0 ? " /mo" : ""}</Text></Text>
              </View>
              {p.features.map((f: string, i: number) => (
                <View key={i} style={styles.featRow}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={styles.feat}>{f}</Text>
                </View>
              ))}
              <Pressable
                testID={`subscribe-${p.id}`}
                disabled={busy === p.id || isCurrent}
                onPress={() => choose(p.id)}
                style={[styles.choose, isCurrent && { backgroundColor: colors.surfaceTertiary }, busy === p.id && { opacity: 0.7 }]}
              >
                <Text style={[styles.chooseTxt, isCurrent && { color: colors.muted }]}>
                  {isCurrent ? "Active" : busy === p.id ? "Activating…" : (p.price > 0 ? "Subscribe (Mock)" : "Start Free Trial")}
                </Text>
              </Pressable>
            </View>
          );
        })}

        {!!toast && <Text style={styles.toast} testID="sub-toast">{toast}</Text>}

        {me?.billing_history?.length > 0 && (
          <View style={{ marginTop: spacing.xl }} testID="billing-history">
            <Text style={styles.histTitle}>Billing History</Text>
            {me.billing_history.slice(-5).reverse().map((b: any, i: number) => (
              <View key={i} style={styles.histRow}>
                <Text style={styles.histId}>{b.razorpay_order_id}</Text>
                <Text style={styles.histAmt}>₹{b.amount}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  bannerTxt: { color: colors.onBrandTertiary, fontSize: sizes.sm, flex: 1 },
  currentCard: { backgroundColor: colors.surfaceInverse, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.lg },
  currentLabel: { color: colors.brandSecondary, fontSize: sizes.sm, fontWeight: "700", letterSpacing: 0.5 },
  currentName: { color: "#fff", fontSize: sizes.xxxl, fontWeight: "800", marginTop: 4 },
  currentPrice: { color: "#fff", fontSize: sizes.lg, marginTop: 4 },
  currentExp: { color: colors.brandSecondary, fontSize: sizes.sm, marginTop: spacing.sm },
  planCard: { backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: spacing.md },
  planName: { fontSize: sizes.xl, fontWeight: "700", color: colors.onSurface },
  planPrice: { fontSize: sizes.xxl, fontWeight: "800", color: colors.brand },
  planPriceUnit: { fontSize: sizes.sm, color: colors.muted, fontWeight: "500" },
  featRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
  feat: { color: colors.onSurfaceSecondary, fontSize: sizes.base },
  choose: { marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.brand, borderRadius: radius.md, alignItems: "center" },
  chooseTxt: { color: "#fff", fontWeight: "700", fontSize: sizes.lg },
  toast: { textAlign: "center", color: colors.brand, marginTop: spacing.md, fontSize: sizes.sm },
  histTitle: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.sm },
  histRow: { flexDirection: "row", justifyContent: "space-between", padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border },
  histId: { fontFamily: "Courier", fontSize: sizes.sm, color: colors.muted },
  histAmt: { fontWeight: "700", color: colors.onSurface },
});
