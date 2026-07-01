import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Share, Platform } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";
import { openWhatsApp } from "@/src/utils/whatsapp";

export default function ShareApp() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    try {
      setErr("");
      const d = await api("/referrals/my-code");
      setData(d);
    } catch (e: any) {
      setErr(e?.message || "Failed to load referral code");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const record = async (channel: string) => {
    try { await api("/referrals/record-share", { method: "POST", body: { channel } }); } catch {}
  };

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2500);
  };

  const shareViaWhatsApp = async () => {
    if (!data) return;
    await record("whatsapp");
    openWhatsApp(null, data.share_message);
  };

  const shareViaSystem = async () => {
    if (!data) return;
    await record("copy");
    try {
      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && (navigator as any).share) {
          await (navigator as any).share({ title: "OptiCRM", text: data.share_message, url: data.share_url });
          return;
        }
      } else {
        await Share.share({ message: data.share_message, url: data.share_url });
        return;
      }
    } catch {}
    // fallback to copy
    await copyLink();
  };

  const copyLink = async () => {
    if (!data) return;
    await record("copy");
    try {
      await Clipboard.setStringAsync(data.share_url);
      showToast("Referral link copied to clipboard");
    } catch { showToast("Copy failed"); }
  };

  const copyMessage = async () => {
    if (!data) return;
    await record("copy");
    try {
      await Clipboard.setStringAsync(data.share_message);
      showToast("Referral message copied");
    } catch { showToast("Copy failed"); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="share-app-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Referral Program</Text>
          <Text style={styles.title}>Share OptiCRM</Text>
          <Text style={styles.sub}>Invite other shops — earn credits when they sign up</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        {loading ? (
          <View style={{ padding: spacing.xxl, alignItems: "center" }}><ActivityIndicator size="large" color={colors.brand} /></View>
        ) : err ? (
          <Text style={{ color: colors.error }}>{err}</Text>
        ) : (
          <>
            <View style={styles.heroCard}>
              <Ionicons name="gift" size={40} color="#fff" />
              <Text style={styles.heroTitle}>Your Referral Code</Text>
              <Pressable onPress={copyLink} testID="copy-code-btn">
                <Text style={styles.code}>{data?.code}</Text>
              </Pressable>
              <Text style={styles.heroSub}>Tap the code to copy the invite link</Text>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statVal}>{data?.shares || 0}</Text>
                  <Text style={styles.statLbl}>Shares</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statVal}>{data?.signups || 0}</Text>
                  <Text style={styles.statLbl}>Signups</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionHead}>Share via</Text>
            <View style={styles.grid}>
              <ShareTile testID="share-whatsapp" icon="logo-whatsapp" color="#25D366" label="WhatsApp" onPress={shareViaWhatsApp} />
              <ShareTile testID="share-system" icon="share-social-outline" color={colors.brand} label="More apps" onPress={shareViaSystem} />
              <ShareTile testID="share-copy-link" icon="link-outline" color={colors.brandSecondary} label="Copy link" onPress={copyLink} />
              <ShareTile testID="share-copy-msg" icon="clipboard-outline" color={"#7C57B5"} label="Copy message" onPress={copyMessage} />
            </View>

            <Text style={styles.sectionHead}>Preview</Text>
            <View style={styles.previewCard}>
              <Text style={styles.previewTxt}>{data?.share_message}</Text>
            </View>

            <Text style={styles.sectionHead}>How it works</Text>
            <View style={styles.stepsCard}>
              <Step n={1} title="Share your code" desc="Send the invite via WhatsApp or any messaging app." />
              <Step n={2} title="They sign up" desc={`New shops use ${data?.code} at signup to enter your referral.`} />
              <Step n={3} title="You earn credits" desc="Once they subscribe, we credit both your accounts." />
            </View>
          </>
        )}
        {!!toast && <Text style={styles.toast} testID="share-toast">{toast}</Text>}
      </ScrollView>
    </View>
  );
}

function ShareTile({ icon, color, label, onPress, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
    </Pressable>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepBadge}><Text style={styles.stepBadgeTxt}>{n}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  backBtn: { padding: spacing.xs, marginBottom: 2 },
  eyebrow: { fontSize: sizes.sm, fontWeight: "700", color: colors.brand, letterSpacing: 1, textTransform: "uppercase" },
  title: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface, marginTop: 2 },
  sub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  heroCard: { alignItems: "center", padding: spacing.xl, backgroundColor: colors.brand, borderRadius: radius.md, marginBottom: spacing.lg },
  heroTitle: { color: "rgba(255,255,255,0.85)", fontSize: sizes.sm, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: spacing.md },
  code: { color: "#fff", fontSize: 36, fontWeight: "800", letterSpacing: 3, marginTop: 6, fontFamily: "Courier" },
  heroSub: { color: "rgba(255,255,255,0.75)", fontSize: sizes.sm, marginTop: spacing.sm },
  statsRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)", width: "100%", justifyContent: "center" },
  stat: { alignItems: "center" },
  statVal: { color: "#fff", fontSize: sizes.xxl, fontWeight: "700" },
  statLbl: { color: "rgba(255,255,255,0.75)", fontSize: sizes.sm, marginTop: 2 },
  sectionHead: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.md, marginTop: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginBottom: spacing.lg },
  tile: { width: "47%", padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "flex-start" },
  tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  tileLabel: { fontSize: sizes.base, fontWeight: "700", color: colors.onSurface },
  previewCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  previewTxt: { fontSize: sizes.base, color: colors.onSurface, lineHeight: 22 },
  stepsCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.md },
  stepBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  stepBadgeTxt: { color: "#fff", fontWeight: "700" },
  stepTitle: { fontSize: sizes.base, fontWeight: "700", color: colors.onSurface },
  stepDesc: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  toast: { textAlign: "center", color: colors.success, marginTop: spacing.md, fontWeight: "700" },
});
