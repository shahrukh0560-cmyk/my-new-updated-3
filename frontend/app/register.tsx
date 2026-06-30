import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";

type Country = { code: string; name: string; currency: string; symbol: string };

const FALLBACK_COUNTRIES: Country[] = [
  { code: "IN", name: "India", currency: "INR", symbol: "₹" },
  { code: "US", name: "United States", currency: "USD", symbol: "$" },
  { code: "GB", name: "United Kingdom", currency: "GBP", symbol: "£" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", symbol: "د.إ" },
  { code: "SG", name: "Singapore", currency: "SGD", symbol: "S$" },
];

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  const [shopName, setShopName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [country, setCountry] = useState<string>("IN");
  const [countries, setCountries] = useState<Country[]>(FALLBACK_COUNTRIES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const list = await api("/countries");
        if (list?.length) setCountries(list);
      } catch { /* offline fallback */ }
    })();
  }, []);

  const active = countries.find((c) => c.code === country) || countries[0];

  const onSubmit = async () => {
    setError("");
    if (!name.trim() || !email.trim() || !password) {
      setError("Name, email and password are required."); return;
    }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    try {
      const displayName = shopName.trim() ? `${name.trim()} · ${shopName.trim()}` : name.trim();
      await register(displayName, email.trim().toLowerCase(), password, country);
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      const msg = e?.message || "";
      setError(/already registered/i.test(msg) ? "An account with this email already exists. Please sign in." : msg || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Image
            source={{ uri: "https://images.unsplash.com/photo-1659622056242-464f9e970009?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient colors={["rgba(26,29,26,0.2)", "rgba(26,29,26,0.85)"]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroContent}>
            <View style={styles.logoRow}>
              <Ionicons name="eye" size={28} color="#fff" />
              <Text style={styles.brand}>OptiCRM</Text>
            </View>
            <Text style={styles.tagline}>Start managing your optical shop</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.sub}>Free 14-day trial · No card required</Text>

          <Text style={styles.label}>Shop name (optional)</Text>
          <TextInput
            testID="register-shop-input"
            value={shopName}
            onChangeText={setShopName}
            placeholder="e.g. ARN Optical, MG Road"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          <Text style={styles.label}>Your name *</Text>
          <TextInput
            testID="register-name-input"
            value={name}
            onChangeText={setName}
            placeholder="Owner / Manager name"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          <Text style={styles.label}>Email *</Text>
          <TextInput
            testID="register-email-input"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@shop.com"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          <Text style={styles.label}>Password *</Text>
          <TextInput
            testID="register-password-input"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="At least 6 characters"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          <Text style={styles.label}>Confirm password *</Text>
          <TextInput
            testID="register-confirm-input"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            placeholder="Re-enter your password"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          <Text style={styles.label}>Country *</Text>
          <Text style={styles.helper}>Used to set your default currency ({active?.symbol} {active?.currency})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {countries.map((c) => {
              const sel = c.code === country;
              return (
                <Pressable
                  key={c.code}
                  testID={`country-chip-${c.code}`}
                  onPress={() => setCountry(c.code)}
                  style={[styles.chip, sel && styles.chipActive]}
                >
                  <Text style={[styles.chipFlag, sel && { color: "#fff" }]}>{c.code}</Text>
                  <Text style={[styles.chipName, sel && { color: "#fff" }]} numberOfLines={1}>{c.name}</Text>
                  <Text style={[styles.chipCur, sel && { color: "rgba(255,255,255,0.85)" }]}>{c.symbol}{c.currency}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {error ? <Text style={styles.error} testID="register-error">{error}</Text> : null}

          <Pressable
            testID="register-submit-button"
            onPress={onSubmit}
            disabled={loading}
            style={({ pressed }) => [styles.cta, (pressed || loading) && { opacity: 0.85 }]}
          >
            <Text style={styles.ctaText}>{loading ? "Creating account…" : "Create account"}</Text>
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerTxt}>Already have an account? </Text>
            <Link href="/login" replace style={styles.link} testID="register-go-to-login">
              <Text style={styles.linkTxt}>Sign in</Text>
            </Link>
          </View>

          <Text style={styles.note}>
            By creating an account, you start on the free trial. You can switch to Starter / Pro / Enterprise from Subscription anytime.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { height: 240, justifyContent: "flex-end", overflow: "hidden" },
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
  label: { marginTop: spacing.md, marginBottom: spacing.xs, fontSize: sizes.sm, color: colors.onSurfaceSecondary, fontWeight: "600" },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: sizes.lg,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cta: { marginTop: spacing.xl, backgroundColor: colors.brand, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center" },
  ctaText: { color: colors.onBrandPrimary, fontSize: sizes.lg, fontWeight: "700" },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: spacing.lg },
  footerTxt: { color: colors.muted, fontSize: sizes.base },
  link: {},
  linkTxt: { color: colors.brand, fontWeight: "700", fontSize: sizes.base },
  note: { textAlign: "center", color: colors.muted, fontSize: sizes.sm, marginTop: spacing.lg, lineHeight: 18 },
  error: { color: colors.error, marginTop: spacing.md, fontSize: sizes.base },
  helper: { fontSize: sizes.sm, color: colors.muted, marginBottom: spacing.sm },
  chipsRow: { gap: spacing.sm, paddingVertical: spacing.xs, paddingHorizontal: 2 },
  chip: { flexShrink: 0, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTertiary, alignItems: "center", minWidth: 96 },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipFlag: { fontSize: 11, fontWeight: "700", color: colors.muted, letterSpacing: 1 },
  chipName: { fontSize: sizes.sm, fontWeight: "700", color: colors.onSurface, marginTop: 2, maxWidth: 130 },
  chipCur: { fontSize: 11, color: colors.muted, marginTop: 2 },
});
