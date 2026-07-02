import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, sizes } from "@/src/theme";

type Payload = {
  error?: string;
  message?: string;
  feature?: string;
  current_plan?: string;
  current_plan_name?: string;
  required_plan?: string;
  required_plan_name?: string;
  required_plan_price?: number;
};

type Ctx = {
  open: (info: Payload) => void;
  close: () => void;
};

const PaywallContext = React.createContext<Ctx | null>(null);

export function PaywallProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [info, setInfo] = useState<Payload | null>(null);

  const open = React.useCallback((data: Payload) => setInfo(data || {}), []);
  const close = React.useCallback(() => setInfo(null), []);

  // Global 402 listener installed on window (Web + RN via patched fetch elsewhere)
  useEffect(() => {
    (globalThis as any).__opticrmPaywall = { open, close };
    return () => { (globalThis as any).__opticrmPaywall = null; };
  }, [open, close]);

  return (
    <PaywallContext.Provider value={{ open, close }}>
      {children}
      <Modal visible={!!info} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          <View style={styles.card} testID="paywall-modal">
            <View style={styles.iconWrap}>
              <Ionicons name="diamond" size={38} color="#F59E0B" />
            </View>
            <Text style={styles.title}>{info?.required_plan_name ? `Unlock with ${info.required_plan_name}` : "Upgrade required"}</Text>
            <Text style={styles.body}>{info?.message || "This feature is available on higher plans."}</Text>
            {info?.required_plan_price !== undefined ? (
              <View style={styles.priceBox}>
                <Text style={styles.priceValue}>₹{info.required_plan_price}<Text style={styles.priceUnit}>{(info.required_plan || "").includes("yearly") ? " / year" : " / month"}</Text></Text>
                <Text style={styles.priceHint}>{info?.current_plan_name ? `Current plan: ${info.current_plan_name}` : ""}</Text>
              </View>
            ) : null}
            <ScrollView style={{ maxHeight: 180, marginTop: spacing.sm }}>
              <Text style={styles.perksTitle}>What you get:</Text>
              {[
                "Unlimited customers, inventory & orders",
                "Multi-branch & staff (Pro)",
                "Advanced AI Copilot with actions (Pro)",
                "GST reports & branded PDFs",
                "WhatsApp campaigns (Pro)",
              ].map((p) => (
                <View key={p} style={styles.perkRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={styles.perkTxt}>{p}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.actionRow}>
              <Pressable testID="paywall-dismiss" style={styles.secondaryBtn} onPress={close}>
                <Text style={styles.secondaryTxt}>Not now</Text>
              </Pressable>
              <Pressable
                testID="paywall-upgrade"
                style={styles.primaryBtn}
                onPress={() => { close(); router.push("/subscription"); }}
              >
                <Ionicons name="rocket" size={16} color="#fff" />
                <Text style={styles.primaryTxt}>View plans</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </PaywallContext.Provider>
  );
}

export function usePaywall() {
  const ctx = React.useContext(PaywallContext);
  if (!ctx) throw new Error("usePaywall must be within PaywallProvider");
  return ctx;
}

// Utility for anywhere in the app (works even outside provider via global handle)
export function openPaywall(info: Payload) {
  const handle: any = (globalThis as any).__opticrmPaywall;
  if (handle?.open) handle.open(info);
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg || 16, padding: spacing.xl, width: "100%", maxWidth: 440 },
  iconWrap: { alignItems: "center", marginBottom: spacing.sm },
  title: { fontSize: sizes.xl, fontWeight: "700", color: colors.onSurface, textAlign: "center" },
  body: { fontSize: sizes.base, color: colors.muted, textAlign: "center", marginTop: spacing.sm },
  priceBox: { backgroundColor: colors.brandTertiary, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md, alignItems: "center" },
  priceValue: { fontSize: 28, fontWeight: "800", color: colors.brand },
  priceUnit: { fontSize: sizes.base, fontWeight: "600", color: colors.brand },
  priceHint: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
  perksTitle: { fontSize: sizes.sm, fontWeight: "700", color: colors.onSurfaceSecondary, marginBottom: spacing.xs },
  perkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 6 },
  perkTxt: { color: colors.onSurface, fontSize: sizes.sm, flex: 1 },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  secondaryBtn: { flex: 1, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  secondaryTxt: { color: colors.onSurfaceSecondary, fontWeight: "700" },
  primaryBtn: { flex: 1, flexDirection: "row", gap: 6, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  primaryTxt: { color: "#fff", fontWeight: "700" },
});
