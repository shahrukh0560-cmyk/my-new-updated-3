import { Platform, Linking } from "react-native";

// Build a wa.me URL. If phone is provided, opens chat with that contact; otherwise opens share sheet.
export function buildWhatsAppUrl(phone: string | undefined | null, message: string): string {
  const raw = (phone || "").replace(/[^0-9+]/g, "").replace(/^\+/, "");
  const text = encodeURIComponent(message || "");
  return raw ? `https://wa.me/${raw}?text=${text}` : `https://wa.me/?text=${text}`;
}

// Open WhatsApp in a new tab (web) or via deep link (native).
export async function openWhatsApp(phone: string | undefined | null, message: string) {
  const url = buildWhatsAppUrl(phone, message);
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
    }
  } else {
    try {
      await Linking.openURL(url);
    } catch {
      // Fallback
      await Linking.openURL(url.replace("wa.me", "api.whatsapp.com/send"));
    }
  }
}

// Compose an order summary that reads well in WhatsApp.
export function orderSummaryMessage(o: any, currencySymbol = "₹"): string {
  const c = currencySymbol;
  const fmt = (n: number) => `${c}${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const lines = (o.lines || []).map((l: any) => `• ${l.name} × ${l.quantity} — ${fmt(l.total)}`).join("\n");
  const status = String(o.fulfillment_status || "received").replace(/_/g, " ").toUpperCase();
  const parts = [
    `Hi ${o.customer_name || ""} 👋`,
    `Here's your order summary from OptiCRM:`,
    ``,
    `Invoice: ${o.invoice_no}`,
    `Date: ${new Date(o.created_at).toLocaleString()}`,
    `Status: ${status}`,
    ``,
    `Items:`,
    lines || "(no items)",
    ``,
    `Subtotal: ${fmt(o.subtotal)}`,
    `GST: ${fmt(o.gst_amount || 0)}`,
    o.discount ? `Discount: -${fmt(o.discount)}` : null,
    `*Total: ${fmt(o.total)}*`,
    `Paid: ${fmt(o.paid)}`,
    o.due > 0 ? `*Balance Due: ${fmt(o.due)}*` : `Fully Paid ✅`,
    ``,
    `Thank you for choosing us!`,
  ].filter(Boolean);
  return parts.join("\n");
}

// Compose a prescription snapshot that reads well in WhatsApp.
export function prescriptionMessage(customer: any, rx: any): string {
  const val = (v: any) => (v === null || v === undefined || v === "" ? "—" : String(v));
  const rows = [
    `           SPH    CYL    AXIS   ADD`,
    `OD :   ${val(rx.od_sph)}   ${val(rx.od_cyl)}   ${val(rx.od_axis)}   ${val(rx.od_add)}`,
    `OS :   ${val(rx.os_sph)}   ${val(rx.os_cyl)}   ${val(rx.os_axis)}   ${val(rx.os_add)}`,
  ].join("\n");
  const parts = [
    `Hi ${customer.name || ""} 👋`,
    `Your eyewear prescription from OptiCRM:`,
    ``,
    `Date: ${rx.date}`,
    rx.rx_type ? `Type: ${rx.rx_type}` : null,
    rx.doctor_name ? `Doctor: ${rx.doctor_name}` : null,
    ``,
    "```",
    rows,
    "```",
    `PD: ${val(rx.pd)}${rx.near_pd ? ` · Near PD: ${val(rx.near_pd)}` : ""}`,
    rx.notes ? `\nNotes: ${rx.notes}` : null,
    rx.ai_summary ? `\nSummary: ${rx.ai_summary}` : null,
    ``,
    `Please keep this for your records.`,
  ].filter(Boolean);
  return parts.join("\n");
}
