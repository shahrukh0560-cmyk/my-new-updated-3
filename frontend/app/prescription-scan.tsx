import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Platform } from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";

export default function PrescriptionScanner() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  const capture = useCallback(async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true); setErr(""); setResult(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: true, skipProcessing: false });
      if (!photo?.base64) throw new Error("Capture failed");
      const r = await api("/prescription/ai-scan", { method: "POST", body: { image_base64: photo.base64, mime_type: "image/jpeg" } });
      setResult(r.extracted);
    } catch (e: any) { setErr(e?.message || "Scan failed"); }
    finally { setBusy(false); }
  }, [busy]);

  const pickFromLibrary = useCallback(async () => {
    setBusy(true); setErr(""); setResult(null);
    try {
      // Use expo-document-picker as ImagePicker isn't in deps; gracefully fall back
      const DocumentPicker: any = await import("expo-document-picker").catch(() => null);
      if (!DocumentPicker) throw new Error("Picker not available");
      const res = await DocumentPicker.getDocumentAsync({ type: ["image/jpeg", "image/png", "image/jpg"], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) { setBusy(false); return; }
      const asset = res.assets[0];
      const FileSystem: any = await import("expo-file-system/legacy");
      const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const r = await api("/prescription/ai-scan", { method: "POST", body: { image_base64: b64, mime_type: asset.mimeType || "image/jpeg" } });
      setResult(r.extracted);
    } catch (e: any) { setErr(e?.message || "Scan failed"); }
    finally { setBusy(false); }
  }, []);

  if (!permission) return <View style={{ flex: 1, backgroundColor: colors.surface }}><ScreenHeader title="AI Prescription Scanner" /></View>;

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <ScreenHeader title="AI Prescription Scanner" />
        <View style={styles.permWrap}>
          <Ionicons name="camera-outline" size={48} color={colors.muted} />
          <Text style={styles.permTxt}>Camera permission is required to scan prescriptions</Text>
          <Pressable testID="grant-camera-button" onPress={requestPermission} style={styles.cta}>
            <Text style={styles.ctaTxt}>Grant Camera Access</Text>
          </Pressable>
          <Pressable testID="pick-from-library-fallback" onPress={pickFromLibrary} style={[styles.cta, { backgroundColor: colors.brandSecondary, marginTop: spacing.sm }]}>
            <Text style={styles.ctaTxt}>Or pick from library</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }} testID="prescription-scanner-screen">
      <ScreenHeader title="AI Prescription Scanner" />
      <View style={styles.cameraWrap}>
        {Platform.OS !== "web" ? (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "#111", alignItems: "center", justifyContent: "center" }]}>
            <Ionicons name="camera-outline" size={48} color="#fff" />
            <Text style={{ color: "#fff", marginTop: 12 }}>Camera not available on web. Use Pick from library.</Text>
          </View>
        )}
        <View style={styles.frameOverlay} pointerEvents="none">
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
      </View>

      <View style={styles.bottom}>
        <View style={styles.controls}>
          <Pressable testID="pick-library-button" onPress={pickFromLibrary} disabled={busy} style={[styles.sideBtn, busy && { opacity: 0.5 }]}>
            <Ionicons name="images-outline" size={22} color="#fff" />
          </Pressable>
          <Pressable testID="capture-button" onPress={capture} disabled={busy} style={[styles.shutter, busy && { opacity: 0.5 }]}>
            {busy ? <ActivityIndicator color="#000" /> : <View style={styles.shutterInner} />}
          </Pressable>
          <Pressable testID="prescription-scan-back" onPress={() => router.back()} style={styles.sideBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </View>

        {err ? <Text testID="rx-scan-error" style={styles.err}>{err}</Text> : null}

        {result ? (
          <ScrollView style={styles.resultWrap} contentContainerStyle={{ padding: spacing.lg }} testID="rx-scan-result">
            <Text style={styles.resultTitle}>Extracted Prescription</Text>
            <View style={styles.eyeRow}>
              <EyeBlock label="OD (Right)" sph={result.od_sph} cyl={result.od_cyl} axis={result.od_axis} add={result.od_add} va={result.od_va} />
              <EyeBlock label="OS (Left)" sph={result.os_sph} cyl={result.os_cyl} axis={result.os_axis} add={result.os_add} va={result.os_va} />
            </View>
            <Row label="PD" value={result.pd} />
            <Row label="Near PD" value={result.near_pd} />
            <Row label="Type" value={result.rx_type} />
            <Row label="Doctor" value={result.doctor_name} />
            <Row label="Diagnosis" value={result.diagnosis} />
            <Row label="Date" value={result.date} />
            <Row label="Confidence" value={result.confidence != null ? `${Math.round((result.confidence || 0) * 100)}%` : "—"} />
            {result.notes ? <Row label="Notes" value={result.notes} /> : null}
            <Pressable testID="rx-scan-retake" onPress={() => setResult(null)} style={[styles.cta, { marginTop: spacing.lg }]}>
              <Text style={styles.ctaTxt}>Scan another</Text>
            </Pressable>
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

function EyeBlock({ label, sph, cyl, axis, add, va }: any) {
  return (
    <View style={styles.eye}>
      <Text style={styles.eyeTitle}>{label}</Text>
      <Row label="SPH" value={sph} compact />
      <Row label="CYL" value={cyl} compact />
      <Row label="AXIS" value={axis} compact />
      <Row label="ADD" value={add} compact />
      <Row label="VA" value={va} compact />
    </View>
  );
}

function Row({ label, value, compact }: { label: string; value: any; compact?: boolean }) {
  const display = value == null || value === "" ? "—" : String(value);
  return (
    <View style={[styles.row, compact && { paddingVertical: 4 }]}>
      <Text style={[styles.rowLabel, compact && { width: 60 }]}>{label}</Text>
      <Text style={styles.rowValue}>{display}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  permWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  permTxt: { color: colors.onSurfaceSecondary, fontSize: sizes.base, textAlign: "center", marginVertical: spacing.md },
  cta: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center" },
  ctaTxt: { color: "#fff", fontWeight: "700", fontSize: sizes.base },
  cameraWrap: { flex: 1, position: "relative" },
  frameOverlay: { position: "absolute", top: "20%", left: "10%", right: "10%", bottom: "20%" },
  corner: { position: "absolute", width: 28, height: 28, borderColor: "#10E27D", borderWidth: 3 },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  bottom: { backgroundColor: "rgba(0,0,0,0.85)", paddingBottom: spacing.lg, maxHeight: "60%" },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingVertical: spacing.lg },
  sideBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  shutter: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: "rgba(255,255,255,0.3)" },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff", borderWidth: 2, borderColor: "#000" },
  err: { color: "#FCA5A5", textAlign: "center", paddingHorizontal: spacing.lg },
  resultWrap: { backgroundColor: colors.surface, maxHeight: "100%" },
  resultTitle: { fontSize: sizes.xl, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.md },
  eyeRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  eye: { flex: 1, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  eyeTitle: { fontSize: sizes.base, fontWeight: "700", color: colors.brand, marginBottom: 6 },
  row: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { width: 110, color: colors.muted, fontSize: sizes.sm, fontWeight: "600" },
  rowValue: { flex: 1, color: colors.onSurface, fontSize: sizes.base },
});
