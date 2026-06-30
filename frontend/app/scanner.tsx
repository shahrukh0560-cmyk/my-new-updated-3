import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";

// Scanner modes:
//  - lookup: just resolve barcode → show item details
//  - order: scan to push item id into AsyncStorage queue and return
//  - inventory: scan to populate barcode field on inventory/new (returns code)

export default function Scanner() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = (params.mode as string) || "lookup";
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState<string | null>(null);
  const [resolved, setResolved] = useState<any>(null);
  const [err, setErr] = useState("");
  const scannedRef = useRef(false);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleScanned = async ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setCode(data);
    setErr("");
    if (mode === "inventory") {
      await AsyncStorage.setItem("opticrm_scan_result", JSON.stringify({ code: data, ts: Date.now() }));
      router.back();
      return;
    }
    try {
      const item = await api(`/inventory/barcode/${encodeURIComponent(data)}`);
      setResolved(item);
      if (mode === "order") {
        await AsyncStorage.setItem("opticrm_scan_result", JSON.stringify({ item_id: item.id, code: data, ts: Date.now() }));
        // brief delay so user sees the resolved item
        setTimeout(() => router.back(), 800);
      }
    } catch (e: any) {
      setErr(e?.message || "Not found");
      // allow another scan after a short delay
      setTimeout(() => { scannedRef.current = false; }, 1500);
    }
  };

  if (Platform.OS === "web") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <ScreenHeader title="Barcode Scanner" />
        <View style={styles.unsupported}>
          <Ionicons name="laptop-outline" size={36} color={colors.muted} />
          <Text style={styles.unsupportedTxt}>Camera scanning is available on mobile devices only. Open this app in Expo Go on iOS / Android.</Text>
        </View>
      </View>
    );
  }

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: colors.surface }}><ScreenHeader title="Barcode Scanner" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <ScreenHeader title="Barcode Scanner" />
        <View style={styles.unsupported}>
          <Ionicons name="camera-outline" size={36} color={colors.muted} />
          <Text style={styles.unsupportedTxt}>Camera permission is required to scan barcodes & QR codes.</Text>
          <Pressable testID="grant-camera-button" onPress={requestPermission} style={styles.grant}>
            <Text style={styles.grantTxt}>Grant camera access</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <ScreenHeader title="Scan Barcode / QR" />
      <View style={{ flex: 1 }}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "ean8", "upc_a", "code128", "code39", "pdf417"] }}
          onBarcodeScanned={handleScanned}
        />
        <View style={styles.frame} pointerEvents="none">
          <View style={styles.corner} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
        <View style={styles.bottomBox}>
          <Text style={styles.bottomText}>
            {code ? (resolved ? `✓ ${resolved.name} · ₹${resolved.price}` : err || "Scanning…") : "Point camera at a barcode or QR code"}
          </Text>
          {code && (
            <Pressable testID="rescan-button" onPress={() => { scannedRef.current = false; setCode(null); setResolved(null); setErr(""); }} style={styles.rescan}>
              <Text style={styles.rescanTxt}>Scan again</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  unsupported: { flex: 1, padding: spacing.xl, alignItems: "center", justifyContent: "center", gap: spacing.md },
  unsupportedTxt: { textAlign: "center", color: colors.muted, fontSize: sizes.base, lineHeight: 20 },
  grant: { marginTop: spacing.md, backgroundColor: colors.brand, padding: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.md },
  grantTxt: { color: "#fff", fontWeight: "700" },
  frame: { position: "absolute", top: "25%", left: "10%", right: "10%", bottom: "30%" },
  corner: { position: "absolute", top: 0, left: 0, width: 28, height: 28, borderTopWidth: 3, borderLeftWidth: 3, borderColor: "#fff" },
  tr: { top: 0, right: 0, left: undefined, borderLeftWidth: 0, borderRightWidth: 3 },
  bl: { bottom: 0, left: 0, top: undefined, borderTopWidth: 0, borderBottomWidth: 3 },
  br: { bottom: 0, right: 0, top: undefined, left: undefined, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 3, borderBottomWidth: 3 },
  bottomBox: { position: "absolute", bottom: 40, left: spacing.lg, right: spacing.lg, padding: spacing.lg, borderRadius: radius.md, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", gap: spacing.md },
  bottomText: { color: "#fff", textAlign: "center", fontSize: sizes.base },
  rescan: { backgroundColor: colors.brand, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: 18 },
  rescanTxt: { color: "#fff", fontWeight: "700" },
});
