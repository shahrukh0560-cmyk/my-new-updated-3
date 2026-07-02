import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, sizes } from "@/src/theme";

// Storage / API format: YYYY-MM-DD  (ISO date)
// Display format:      DD/MM/YYYY

export function isoToDisplay(iso: string | undefined | null): string {
  if (!iso) return "";
  // Accept full ISO datetime by trimming to first 10 chars.
  const s = String(iso).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return String(iso);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function displayToIso(disp: string | undefined | null): string {
  if (!disp) return "";
  const s = String(disp).trim();
  // Already ISO?
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // DD/MM/YYYY or DD-MM-YYYY
  const m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(s);
  if (!m) return "";
  const d = m[1].padStart(2, "0");
  const mo = m[2].padStart(2, "0");
  let y = m[3];
  if (y.length === 2) y = (parseInt(y, 10) > 50 ? "19" : "20") + y;
  return `${y}-${mo}-${d}`;
}

type Props = {
  value: string | null | undefined;   // ISO YYYY-MM-DD
  onChange: (iso: string) => void;
  placeholder?: string;
  testID?: string;
  minDate?: string;                    // ISO
  maxDate?: string;                    // ISO
  disabled?: boolean;
  compact?: boolean;
};

export default function DateField({ value, onChange, placeholder = "DD/MM/YYYY", testID, minDate, maxDate, disabled, compact }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const displayValue = useMemo(() => isoToDisplay(value || ""), [value]);
  const webInputRef = useRef<any>(null);

  const onWebChange = useCallback((e: any) => {
    onChange(e?.target?.value || "");
  }, [onChange]);

  if (Platform.OS === "web") {
    // React-Native-Web renders <input>-like via createElement.
    // We keep the DD/MM/YYYY overlay label but let users click the icon to open the OS date picker.
    return (
      <View style={[styles.wrap, compact && styles.wrapCompact]} testID={testID}>
        <View pointerEvents="none" style={styles.displayLabel}>
          <Text style={displayValue ? styles.txt : styles.placeholder}>{displayValue || placeholder}</Text>
        </View>
        {/* Native HTML input positioned invisibly on top so clicks anywhere open the picker */}
        {React.createElement("input", {
          ref: webInputRef,
          type: "date",
          value: value || "",
          onChange: onWebChange,
          min: minDate,
          max: maxDate,
          disabled,
          "aria-label": placeholder,
          style: {
            position: "absolute",
            inset: 0,
            opacity: 0,
            cursor: disabled ? "not-allowed" : "pointer",
            border: "none",
            width: "100%",
            height: "100%",
          },
          "data-testid": (testID || "") + "-input",
        })}
        <View pointerEvents="none" style={styles.iconWrap}>
          <Ionicons name="calendar-outline" size={18} color={colors.muted} />
        </View>
      </View>
    );
  }

  // Native: use @react-native-community/datetimepicker if available, else fallback to iOS/Android bridged
  let DateTimePicker: any = null;
  try {
    // Optional import — will fail gracefully if not installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    DateTimePicker = require("@react-native-community/datetimepicker").default;
  } catch {}

  const currentDate = value ? new Date(value + "T00:00:00") : new Date();
  return (
    <>
      <Pressable
        testID={testID}
        onPress={() => !disabled && setShowPicker(true)}
        style={[styles.wrap, compact && styles.wrapCompact, disabled && { opacity: 0.5 }]}
      >
        <Text style={displayValue ? styles.txt : styles.placeholder}>{displayValue || placeholder}</Text>
        <Ionicons name="calendar-outline" size={18} color={colors.muted} />
      </Pressable>
      {showPicker && DateTimePicker && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowPicker(false)}>
            <View style={styles.pickerCard}>
              <DateTimePicker
                value={currentDate}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                minimumDate={minDate ? new Date(minDate + "T00:00:00") : undefined}
                maximumDate={maxDate ? new Date(maxDate + "T00:00:00") : undefined}
                onChange={(event: any, d?: Date) => {
                  if (Platform.OS === "android") setShowPicker(false);
                  if (event.type === "dismissed") return;
                  if (d) {
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, "0");
                    const day = String(d.getDate()).padStart(2, "0");
                    onChange(`${y}-${m}-${day}`);
                  }
                }}
              />
              {Platform.OS === "ios" && (
                <Pressable testID={(testID || "date") + "-done"} onPress={() => setShowPicker(false)} style={styles.doneBtn}>
                  <Text style={styles.doneTxt}>Done</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
  },
  wrapCompact: { paddingVertical: 8, paddingHorizontal: 10, minHeight: 36 },
  displayLabel: { flexDirection: "row", alignItems: "center", flex: 1 },
  iconWrap: { position: "absolute", right: spacing.md, top: 0, bottom: 0, justifyContent: "center" },
  txt: { fontSize: sizes.lg, color: colors.onSurface, fontWeight: "500" },
  placeholder: { fontSize: sizes.lg, color: colors.muted },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: spacing.lg },
  pickerCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, minWidth: 300 },
  doneBtn: { backgroundColor: colors.brand, padding: spacing.md, borderRadius: radius.sm, marginTop: spacing.sm, alignItems: "center" },
  doneTxt: { color: "#fff", fontWeight: "700" },
});
