// Biometric login helper
import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "opticrm_bio_enabled";
const CRED_KEY = "opticrm_bio_creds";

export async function isBiometricAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const hw = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return hw && enrolled;
  } catch {
    return false;
  }
}

export async function isBioEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) === "1";
}

export async function enableBio(email: string, password: string) {
  await AsyncStorage.setItem(KEY, "1");
  await AsyncStorage.setItem(CRED_KEY, JSON.stringify({ email, password }));
}

export async function disableBio() {
  await AsyncStorage.removeItem(KEY);
  await AsyncStorage.removeItem(CRED_KEY);
}

export async function authenticateBio(): Promise<{ email: string; password: string } | null> {
  const ok = await isBiometricAvailable();
  if (!ok) return null;
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: "Sign in to OptiCRM",
    fallbackLabel: "Use password",
    cancelLabel: "Cancel",
  });
  if (!res.success) return null;
  const raw = await AsyncStorage.getItem(CRED_KEY);
  return raw ? JSON.parse(raw) : null;
}
