// Currency helper that respects the tenant's locale + currency. Falls back to INR/en-IN.
import { useAuth } from "./auth";

const SYMBOL_MAP: Record<string, string> = {
  INR: "₹", USD: "$", GBP: "£", EUR: "€",
  AED: "د.إ", SAR: "﷼", AUD: "A$", SGD: "S$", CAD: "C$",
  PKR: "₨", BDT: "৳", LKR: "₨", NPR: "₨",
};

export function formatCurrency(amount: number | string | null | undefined, currency: string = "INR", locale: string = "en-IN", opts: { maximumFractionDigits?: number } = {}): string {
  const n = Number(amount || 0);
  const sym = SYMBOL_MAP[currency] || "";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: opts.maximumFractionDigits ?? 0,
    }).format(n);
  } catch {
    return `${sym}${n.toLocaleString(locale, { maximumFractionDigits: opts.maximumFractionDigits ?? 0 })}`;
  }
}

export function useCurrency() {
  const { user } = useAuth();
  const currency = (user?.currency as string) || "INR";
  const locale = (user?.locale as string) || "en-IN";
  const symbol = (user?.currency_symbol as string) || SYMBOL_MAP[currency] || "₹";
  return {
    currency, locale, symbol,
    format: (amount: number | string | null | undefined, opts?: { maximumFractionDigits?: number }) =>
      formatCurrency(amount, currency, locale, opts),
  };
}
