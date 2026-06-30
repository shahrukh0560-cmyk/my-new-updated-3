import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, sizes } from "@/src/theme";

export default function ScreenHeader({ title, right, testID }: { title: string; right?: React.ReactNode; testID?: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.h, { paddingTop: insets.top + spacing.md }]} testID={testID}>
      <Pressable onPress={() => router.back()} style={styles.back} testID="header-back-button" hitSlop={10}>
        <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={{ minWidth: 38, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  h: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  title: { flex: 1, fontSize: sizes.xl, fontWeight: "700", color: colors.onSurface },
});
