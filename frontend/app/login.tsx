import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { authenticateBio, enableBio, isBioEnabled, isBiometricAvailable } from "@/src/biometric";
import { colors, spacing, radius, sizes } from "@/src/theme";

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("superadmin@opticrm.com");
  const [password, setPassword] = useState("SuperAdmin@2026");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bioReady, setBioReady] = useState(false);

  // Detect biometric availability on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const avail = await isBiometricAvailable();
        const on = await isBioEnabled();
        if (!cancelled) setBioReady(avail && on);
      } catch {
        if (!cancelled) setBioReady(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const goAfterLogin = () => router.replace("/");

  const onBio = async () => {
    setError("");
    const creds = await authenticateBio();
    if (!creds) return;
    setLoading(true);
    try {
      await login(creds.email, creds.password);
      goAfterLogin();
    } catch (e: any) {
      setError(e?.message || "Biometric login failed");
    } finally { setLoading(false); }
  };

  const onSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      // Offer to save creds for biometric on next login (silent, only if available)
      try {
        if (await isBiometricAvailable()) {
          await enableBio(email.trim(), password);
        }
      } catch {
        // ignore – biometric storage is optional
      }
      goAfterLogin();
    } catch (e: any) {
      setError(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Image
            source={{ uri: "https://images.unsplash.com/photo-1659622056242-464f9e970009?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient
            colors={["rgba(26,29,26,0.2)", "rgba(26,29,26,0.85)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroContent}>
            <View style={styles.logoRow}>
              <Ionicons name="eye" size={28} color="#fff" />
              <Text style={styles.brand}>OptiCRM</Text>
            </View>
            <Text style={styles.tagline}>Customers · Prescriptions · Inventory</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.sub}>Sign in to manage your shop</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="login-email-input"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@shop.com"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            testID="login-password-input"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          {error ? <Text style={styles.error} testID="login-error">{error}</Text> : null}

          <Pressable
            testID="login-submit-button"
            onPress={onSubmit}
            disabled={loading}
            style={({ pressed }) => [styles.cta, (pressed || loading) && { opacity: 0.85 }]}
          >
            <Text style={styles.ctaText}>{loading ? "Signing in…" : "Sign In"}</Text>
          </Pressable>

          {bioReady && (
            <Pressable testID="bio-login-button" onPress={onBio} disabled={loading} style={styles.bioBtn}>
              <Ionicons name="finger-print" size={20} color={colors.brand} />
              <Text style={styles.bioTxt}>Sign in with biometrics</Text>
            </Pressable>
          )}

          <View style={styles.signupRow}>
            <Text style={styles.signupTxt}>New to OptiCRM? </Text>
            <Pressable testID="go-to-register" onPress={() => router.push("/register")} hitSlop={6}>
              <Text style={styles.signupLink}>Create an account</Text>
            </Pressable>
          </View>

          <Text style={styles.hint}>Demo: superadmin@opticrm.com / SuperAdmin@2026</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { height: 320, justifyContent: "flex-end", overflow: "hidden" },
  heroContent: { padding: spacing.xl, paddingBottom: spacing.xxl },
  logoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brand: { color: "#fff", fontSize: 28, fontWeight: "700", letterSpacing: 0.5 },
  tagline: { color: "rgba(255,255,255,0.85)", marginTop: spacing.sm, fontSize: sizes.lg },
  card: {
    backgroundColor: colors.surfaceSecondary,
    marginTop: -spacing.xl,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xl,
    paddingTop: spacing.xxl,
    flex: 1,
  },
  title: { fontSize: sizes.xxl, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: sizes.base, color: colors.muted, marginTop: spacing.xs },
  label: { marginTop: spacing.lg, marginBottom: spacing.xs, fontSize: sizes.sm, color: colors.onSurfaceSecondary, fontWeight: "600" },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: sizes.lg,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cta: {
    marginTop: spacing.xl,
    backgroundColor: colors.brand,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
  },
  ctaText: { color: colors.onBrandPrimary, fontSize: sizes.lg, fontWeight: "700" },
  bioBtn: { marginTop: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand },
  bioTxt: { color: colors.brand, fontWeight: "700", fontSize: sizes.base },
  signupRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: spacing.lg },
  signupTxt: { color: colors.muted, fontSize: sizes.base },
  signupLink: { color: colors.brand, fontWeight: "700", fontSize: sizes.base },
  hint: { textAlign: "center", color: colors.muted, marginTop: spacing.lg, fontSize: sizes.sm },
  error: { color: colors.error, marginTop: spacing.md, fontSize: sizes.base },
});
