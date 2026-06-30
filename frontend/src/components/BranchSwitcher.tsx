import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useBranch } from "@/src/branch";
import { colors, spacing, radius, sizes } from "@/src/theme";

/**
 * Pill button that opens a modal to switch the active branch. The selected
 * branch is exposed via `useBranch()` and used by Customers / Inventory /
 * Orders / Reports / Dashboard screens.
 */
export default function BranchSwitcher({ compact = false }: { compact?: boolean }) {
  const { branches, activeBranchId, setActiveBranchId } = useBranch();
  const [open, setOpen] = useState(false);

  if (!branches.length) {
    // Don't render the switcher until at least one branch exists.
    return null;
  }
  const active = branches.find((b) => b.id === activeBranchId) || null;
  const label = active ? (active.code ? `${active.code}` : active.name) : "All branches";

  return (
    <>
      <Pressable testID="branch-switcher-button" onPress={() => setOpen(true)} style={[styles.pill, compact && styles.pillCompact]}>
        <Ionicons name={active ? "business" : "globe-outline"} size={14} color={colors.brand} />
        <Text style={styles.pillTxt} numberOfLines={1}>{label}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.title}>Active branch</Text>
          <Text style={styles.sub}>Filter customers, inventory, orders & reports by branch.</Text>
          <FlatList
            data={[{ id: "__all__", name: "All branches", code: "", _all: true }, ...branches.map((b) => ({ ...b, _all: false }))]}
            keyExtractor={(it) => it.id}
            renderItem={({ item }: any) => {
              const selected = item._all ? !activeBranchId : activeBranchId === item.id;
              return (
                <Pressable
                  testID={item._all ? "switcher-option-all" : `switcher-option-${item.id}`}
                  onPress={async () => { await setActiveBranchId(item._all ? null : item.id); setOpen(false); }}
                  style={[styles.row, selected && styles.rowActive]}
                >
                  <View style={[styles.iconWrap, selected && { backgroundColor: colors.brand }]}>
                    <Ionicons name={item._all ? "globe-outline" : "business"} size={18} color={selected ? "#fff" : colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    {item.code ? <Text style={styles.code}>{item.code}</Text> : null}
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={22} color={colors.brand} />}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.brandTertiary, maxWidth: 180 },
  pillCompact: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  pillTxt: { color: colors.brand, fontWeight: "700", fontSize: sizes.sm, maxWidth: 120 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl, maxHeight: "70%" },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md },
  title: { fontSize: sizes.xl, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: sizes.sm, color: colors.muted, marginTop: 2, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, marginBottom: spacing.sm },
  rowActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  name: { fontSize: sizes.base, fontWeight: "700", color: colors.onSurface },
  code: { fontSize: sizes.sm, color: colors.muted, marginTop: 2 },
});
