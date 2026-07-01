import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Switch, TextInput } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { isBiometricAvailable, isBioEnabled, disableBio } from "@/src/biometric";
import { clearQueue } from "@/src/offline";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";

export default function Settings() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [bioAvail, setBioAvail] = useState(false);
  const [bioOn, setBioOn] = useState(false);
  const [msg, setMsg] = useState("");
  const [sub, setSub] = useState<any>(null);
  const [reminderDays, setReminderDays] = useState("7");
  const [expiryInfo, setExpiryInfo] = useState<any>(null);
  const [biz, setBiz] = useState({ business_name: "", business_address: "", google_review_url: "" });
  const [bizBusy, setBizBusy] = useState(false);

  useEffect(() => {
    setBiz({
      business_name: user?.business_name || "",
      business_address: user?.business_address || "",
      google_review_url: user?.google_review_url || "",
    });
  }, [user]);

  const saveBiz = async () => {
    setBizBusy(true);
    try {
      await api("/settings/business", { method: "PUT", body: biz });
      await refreshUser();
      setMsg("Business profile updated.");
    } catch (e: any) { setMsg(e?.message || "Failed to save"); }
    finally { setBizBusy(false); }
  };

  useFocusEffect(useCallback(() => {
    (async () => {
      setBioAvail(await isBiometricAvailable());
      setBioOn(await isBioEnabled());
      try {
        const s = await api("/subscription/me");
        setSub(s);
        setReminderDays(String(s.reminder_days ?? 7));
        const r = await api("/subscription/expiry-reminder");
        setExpiryInfo(r);
      } catch (e) { console.warn(e); }
    })();
  }, []));

  const toggleBio = async (val: boolean) => {
    if (val) {
      setMsg("Sign out and sign in again to enable biometric (we'll save the current credentials securely).");
      return;
    }
    await disableBio();
    setBioOn(false);
    setMsg("Biometric login disabled.");
  };

  const toggleAutoRenew = async (val: boolean) => {
    try {
      const r = await api("/subscription/auto-renew", { method: "POST", body: { auto_renew: val, reminder_days: Number(reminderDays) || 7 } });
      setSub(r);
      setMsg(val ? "Auto-renewal enabled" : "Auto-renewal disabled");
    } catch (e: any) { setMsg(e?.message || "Failed"); }
  };

  const saveReminderDays = async () => {
    try {
      const r = await api("/subscription/auto-renew", { method: "POST", body: { auto_renew: !!sub?.auto_renew, reminder_days: Number(reminderDays) || 7 } });
      setSub(r);
      setMsg(`Expiry reminder set to ${reminderDays} day(s) before`);
    } catch (e: any) { setMsg(e?.message || "Failed"); }
  };

  const isAdmin = user?.role === "owner" || user?.role === "admin" || user?.role === "super_admin";

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        {/* Subscription */}
        <Card title="Subscription">
          {expiryInfo?.expiring_soon ? (
            <View style={styles.warnBanner} testID="expiry-banner">
              <Ionicons name="alert-circle" size={18} color={colors.warning} />
              <Text style={styles.warnTxt}>Your {sub?.plan?.name || sub?.plan_id} plan expires in {expiryInfo.days_left} day(s).</Text>
            </View>
          ) : null}
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Auto-renewal</Text>
              <Text style={styles.rowSub}>{sub?.auto_renew ? "Will automatically renew before expiry" : "Disabled"}</Text>
            </View>
            <Switch
              testID="auto-renew-switch"
              value={!!sub?.auto_renew}
              onValueChange={toggleAutoRenew}
              trackColor={{ true: colors.brand }}
            />
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.rowTitle}>Expiry reminder</Text>
            <Text style={styles.rowSub}>Notify me before expiry (days)</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, alignItems: "center" }}>
              <TextInput
                testID="reminder-days-input"
                value={reminderDays}
                onChangeText={setReminderDays}
                keyboardType="numeric"
                style={[styles.input, { width: 100 }]}
              />
              <Pressable testID="save-reminder-days" onPress={saveReminderDays} style={styles.smallBtn}>
                <Text style={styles.smallBtnTxt}>Save</Text>
              </Pressable>
            </View>
          </View>
          <Pressable testID="manage-subscription" onPress={() => router.push("/subscription")} style={styles.linkRow}>
            <Ionicons name="diamond-outline" size={18} color={colors.brand} />
            <Text style={styles.linkTxt}>Manage Plan</Text>
          </Pressable>
        </Card>

        {/* Business Profile */}
        {isAdmin ? (
          <Card title="Business Profile">
            <Text style={styles.rowSub}>These details appear on invoices, prescriptions & referral messages.</Text>
            <View style={{ marginTop: spacing.md }}>
              <Text style={styles.rowTitle}>Business name</Text>
              <TextInput
                testID="biz-name-input"
                value={biz.business_name}
                onChangeText={(v) => setBiz({ ...biz, business_name: v })}
                placeholder="e.g. Shahrukh Opticals"
                placeholderTextColor={colors.muted}
                style={[styles.input, { marginTop: 6 }]}
              />
              <Text style={[styles.rowTitle, { marginTop: spacing.md }]}>Business address</Text>
              <TextInput
                testID="biz-address-input"
                value={biz.business_address}
                onChangeText={(v) => setBiz({ ...biz, business_address: v })}
                placeholder="e.g. Shop 42, MG Road, Bengaluru"
                placeholderTextColor={colors.muted}
                style={[styles.input, { marginTop: 6 }]}
              />
              <Text style={[styles.rowTitle, { marginTop: spacing.md }]}>Google Review URL</Text>
              <Text style={styles.rowSub}>Used by "Ask for Review" on delivered orders & Copilot review campaigns.</Text>
              <TextInput
                testID="google-review-url-input"
                value={biz.google_review_url}
                onChangeText={(v) => setBiz({ ...biz, google_review_url: v })}
                autoCapitalize="none"
                keyboardType="url"
                placeholder="https://g.page/r/xxxxxxxx/review"
                placeholderTextColor={colors.muted}
                style={[styles.input, { marginTop: 6 }]}
              />
              <Pressable
                testID="save-business-profile"
                onPress={saveBiz}
                disabled={bizBusy}
                style={[styles.smallBtn, { alignSelf: "flex-start", marginTop: spacing.md }, bizBusy && { opacity: 0.6 }]}
              >
                <Text style={styles.smallBtnTxt}>{bizBusy ? "Saving…" : "Save Business Profile"}</Text>
              </Pressable>
            </View>
          </Card>
        ) : null}

        {/* Engagement */}
        {isAdmin ? (
          <Card title="Engagement">
            <NavRow testID="settings-coupons" icon="pricetag-outline" label="Coupon codes" sub="Discount codes for orders" onPress={() => router.push("/coupons")} />
            <NavRow testID="settings-referrals" icon="people-circle-outline" label="Referral system" sub="Reward customers who refer others" onPress={() => router.push("/referrals")} />
            <NavRow testID="settings-wishes" icon="gift-outline" label="Birthday & anniversary wishes" sub="Send today's celebration messages" onPress={() => router.push("/wishes")} />
            <NavRow testID="settings-repair" icon="construct-outline" label="Repair orders" sub="Track frame & lens repairs" onPress={() => router.push("/repair")} />
            <NavRow testID="settings-ai-scan" icon="scan-outline" label="AI Prescription Scanner" sub="Scan paper prescription with camera" onPress={() => router.push("/prescription-scan")} />
          </Card>
        ) : null}

        <Card title="Security">
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Biometric login</Text>
              <Text style={styles.rowSub}>{bioAvail ? (bioOn ? "Enabled" : "Not enabled") : "Not available on this device"}</Text>
            </View>
            <Switch
              testID="bio-switch"
              value={bioOn}
              disabled={!bioAvail}
              onValueChange={toggleBio}
              trackColor={{ true: colors.brand }}
            />
          </View>
        </Card>

        <Card title="Offline sync">
          <Pressable
            testID="clear-queue-button"
            onPress={async () => { await clearQueue(); setMsg("Cleared pending offline changes."); }}
            style={styles.linkRow}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={[styles.linkTxt, { color: colors.error }]}>Clear pending offline queue</Text>
          </Pressable>
        </Card>

        <Card title="Account">
          <Text style={styles.rowTitle}>{user?.name}</Text>
          <Text style={styles.rowSub}>{user?.email}</Text>
          <Text style={styles.rowSub}>Role: {user?.role}</Text>
        </Card>

        {!!msg && <Text style={styles.toast} testID="settings-toast">{msg}</Text>}
      </ScrollView>
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function NavRow({ testID, icon, label, sub, onPress }: { testID: string; icon: any; label: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.navRow}>
      <View style={styles.navIcon}><Ionicons name={icon} size={20} color={colors.brand} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  cardTitle: { fontSize: sizes.sm, color: colors.muted, fontWeight: "700", letterSpacing: 0.5, marginBottom: spacing.sm, textTransform: "uppercase" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, paddingVertical: spacing.xs },
  rowTitle: { fontSize: sizes.base, color: colors.onSurface, fontWeight: "600" },
  rowSub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, marginTop: spacing.sm },
  linkTxt: { fontSize: sizes.base, fontWeight: "600", color: colors.brand },
  toast: { textAlign: "center", color: colors.brand, marginTop: spacing.md, fontSize: sizes.sm },
  navRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  navIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  warnBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "#FBE7CC", padding: spacing.sm, borderRadius: radius.sm, marginBottom: spacing.md },
  warnTxt: { color: colors.onSurface, fontWeight: "600", flex: 1, fontSize: sizes.sm },
  input: { backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, fontSize: sizes.base, color: colors.onSurface },
  smallBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.sm },
  smallBtnTxt: { color: "#fff", fontWeight: "700" },
});
