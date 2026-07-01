import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, FlatList, Modal } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/src/api";
import { colors, spacing, radius, sizes } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";
import { useBranch } from "@/src/branch";

const currency = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function NewOrder() {
  const params = useLocalSearchParams<{ customer_id?: string }>();
  const router = useRouter();
  const { activeBranchId } = useBranch();
  const [customers, setCustomers] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [customer, setCustomer] = useState<any | null>(null);
  const [lines, setLines] = useState<{ item: any; quantity: number }[]>([]);
  const [discount, setDiscount] = useState("0");
  const [paid, setPaid] = useState("0");
  const [notes, setNotes] = useState("");
  const [showCust, setShowCust] = useState(false);
  const [showNewCust, setShowNewCust] = useState(false);
  const [showItem, setShowItem] = useState(false);
  const [showNewItem, setShowNewItem] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [newCust, setNewCust] = useState<{ name: string; phone: string; email: string }>({ name: "", phone: "", email: "" });
  const [newCustErr, setNewCustErr] = useState("");
  const [newCustBusy, setNewCustBusy] = useState(false);
  const [newItem, setNewItem] = useState<{ name: string; category: string; price: string; stock: string; brand: string }>({ name: "", category: "frame", price: "", stock: "1", brand: "" });
  const [newItemErr, setNewItemErr] = useState("");
  const [newItemBusy, setNewItemBusy] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const [cs, inv] = await Promise.all([api("/customers"), api("/inventory")]);
      setCustomers(cs); setInventory(inv);
      if (params.customer_id) {
        const c = cs.find((x: any) => x.id === params.customer_id);
        if (c) setCustomer(c);
      }
    } catch (e) { console.warn(e); }
  }, [params.customer_id]);

  useEffect(() => { load(); }, [load]);

  // Pick up barcode scan results dropped by /scanner?mode=order
  useFocusEffect(useCallback(() => {
    (async () => {
      const raw = await AsyncStorage.getItem("opticrm_scan_result");
      if (!raw) return;
      try {
        const { item_id, ts } = JSON.parse(raw);
        if (item_id && Date.now() - ts < 15000) {
          await AsyncStorage.removeItem("opticrm_scan_result");
          const item = inventory.find((x: any) => x.id === item_id);
          if (item) {
            setLines((prev) => {
              const idx = prev.findIndex((l) => l.item.id === item.id);
              if (idx >= 0) return prev.map((l, i) => i === idx ? { ...l, quantity: l.quantity + 1 } : l);
              return [...prev, { item, quantity: 1 }];
            });
          }
        }
      } catch {}
    })();
  }, [inventory]));

  const subtotal = lines.reduce((s, l) => s + (l.item.price * l.quantity), 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));
  const due = Math.max(0, total - (Number(paid) || 0));

  const onSubmit = async () => {
    if (!customer) { setErr("Select a customer"); return; }
    if (lines.length === 0) { setErr("Add at least one item"); return; }
    setBusy(true); setErr("");
    try {
      const order = await api("/orders", {
        method: "POST",
        body: {
          customer_id: customer.id,
          lines: lines.map((l) => ({ item_id: l.item.id, quantity: l.quantity })),
          discount: Number(discount) || 0,
          paid: Number(paid) || 0,
          notes,
          branch_id: activeBranchId || customer.branch_id || null,
        },
      });
      router.replace(`/order/${order.id}`);
    } catch (e: any) { setErr(e.message || "Failed"); }
    finally { setBusy(false); }
  };

  const createInlineCustomer = async () => {
    setNewCustErr("");
    if (!newCust.name.trim() || !newCust.phone.trim()) {
      setNewCustErr("Name and phone are required");
      return;
    }
    setNewCustBusy(true);
    try {
      const created = await api("/customers", {
        method: "POST",
        body: {
          name: newCust.name.trim(),
          phone: newCust.phone.trim(),
          email: newCust.email.trim(),
          branch_id: activeBranchId || null,
        },
      });
      setCustomers((prev) => [created, ...prev]);
      setCustomer(created);
      setNewCust({ name: "", phone: "", email: "" });
      setShowNewCust(false);
      setShowCust(false);
    } catch (e: any) {
      setNewCustErr(e?.message || "Failed to create customer");
    } finally {
      setNewCustBusy(false);
    }
  };

  const createInlineInventory = async () => {
    setNewItemErr("");
    const price = Number(newItem.price);
    const stock = Number(newItem.stock);
    if (!newItem.name.trim() || !Number.isFinite(price) || price <= 0) {
      setNewItemErr("Name and a valid price are required");
      return;
    }
    setNewItemBusy(true);
    try {
      const created = await api("/inventory", {
        method: "POST",
        body: {
          name: newItem.name.trim(),
          category: newItem.category,
          brand: newItem.brand.trim(),
          price,
          stock: Number.isFinite(stock) ? Math.max(1, stock) : 1,
          branch_id: activeBranchId || null,
        },
      });
      setInventory((prev) => [created, ...prev]);
      setLines((prev) => [...prev, { item: created, quantity: 1 }]);
      setNewItem({ name: "", category: "frame", price: "", stock: "1", brand: "" });
      setShowNewItem(false);
      setShowItem(false);
    } catch (e: any) {
      setNewItemErr(e?.message || "Failed to create inventory item");
    } finally {
      setNewItemBusy(false);
    }
  };

  const applyCoupon = async () => {
    setCouponMsg("");
    if (!coupon.trim()) return;
    try {
      const sub = lines.reduce((s, l) => s + (l.item.price * l.quantity), 0);
      const r = await api(`/coupons/validate?code=${encodeURIComponent(coupon.trim())}&subtotal=${sub}`, { method: "POST" });
      setCouponDiscount(r.discount);
      setDiscount(String(r.discount));
      setCouponMsg(`Coupon applied: -₹${r.discount}`);
    } catch (e: any) {
      setCouponDiscount(0);
      setCouponMsg(e?.message || "Invalid coupon");
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="New Order" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 200 }}>
        <Text style={styles.section}>Customer</Text>
        <Pressable testID="select-customer-button" onPress={() => setShowCust(true)} style={styles.picker}>
          <Text style={{ color: customer ? colors.onSurface : colors.muted, flex: 1 }}>{customer ? `${customer.name} · ${customer.phone}` : "Select customer"}</Text>
          <Ionicons name="chevron-down" size={18} color={colors.muted} />
        </Pressable>

        <Text style={[styles.section, { marginTop: spacing.lg }]}>Items</Text>
        {lines.map((l, idx) => (
          <View key={idx} style={styles.lineRow} testID={`order-line-${idx}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lineName}>{l.item.name}</Text>
              <Text style={styles.lineSub}>{currency(l.item.price)} × {l.quantity}</Text>
            </View>
            <View style={styles.qty}>
              <Pressable
                testID={`qty-dec-${idx}`}
                onPress={() => setLines(lines.map((x, i) => i === idx ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))}
                style={styles.qtyBtn}
              ><Text style={styles.qtyBtnText}>−</Text></Pressable>
              <Text style={styles.qtyN}>{l.quantity}</Text>
              <Pressable
                testID={`qty-inc-${idx}`}
                onPress={() => setLines(lines.map((x, i) => i === idx ? { ...x, quantity: x.quantity + 1 } : x))}
                style={styles.qtyBtn}
              ><Text style={styles.qtyBtnText}>+</Text></Pressable>
            </View>
            <Pressable onPress={() => setLines(lines.filter((_, i) => i !== idx))} testID={`remove-line-${idx}`} hitSlop={10}>
              <Ionicons name="close-circle" size={20} color={colors.error} />
            </Pressable>
          </View>
        ))}

        <Pressable testID="add-item-button" onPress={() => setShowItem(true)} style={styles.addItemBtn}>
          <Ionicons name="add-circle-outline" size={18} color={colors.brand} />
          <Text style={{ color: colors.brand, fontWeight: "700" }}>Add inventory item</Text>
        </Pressable>
        <Pressable
          testID="scan-item-button"
          onPress={() => router.push("/scanner?mode=order")}
          style={[styles.addItemBtn, { marginTop: spacing.sm, borderColor: colors.brandSecondary }]}
        >
          <Ionicons name="barcode-outline" size={18} color={colors.brandSecondary} />
          <Text style={{ color: colors.brandSecondary, fontWeight: "700" }}>Scan barcode to add</Text>
        </Pressable>

        <Text style={[styles.section, { marginTop: spacing.lg }]}>Payment</Text>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Discount</Text>
            <TextInput testID="order-discount-input" value={discount} onChangeText={setDiscount} keyboardType="numeric" style={styles.input} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Paid</Text>
            <TextInput testID="order-paid-input" value={paid} onChangeText={setPaid} keyboardType="numeric" style={styles.input} />
          </View>
        </View>
        <Text style={[styles.label, { marginTop: spacing.md }]}>Notes</Text>
        <TextInput testID="order-notes-input" value={notes} onChangeText={setNotes} style={[styles.input, { height: 70, textAlignVertical: "top" }]} multiline />

        <View style={styles.couponWrap}>
          <TextInput
            testID="coupon-code-input"
            value={coupon}
            onChangeText={setCoupon}
            placeholder="Coupon code"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            style={styles.couponInput}
          />
          <Pressable testID="apply-coupon-button" onPress={applyCoupon} style={styles.couponBtn}>
            <Text style={styles.couponBtnTxt}>Apply</Text>
          </Pressable>
        </View>
        {couponMsg ? <Text testID="coupon-message" style={{ marginTop: spacing.xs, color: couponDiscount > 0 ? colors.success : colors.error, fontSize: sizes.sm }}>{couponMsg}</Text> : null}

        {err ? <Text style={{ color: colors.error, marginTop: spacing.md }} testID="order-error">{err}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm }}>
          <Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalVal}>{currency(subtotal)}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm }}>
          <Text style={styles.totalLabel}>Total</Text><Text style={[styles.totalVal, { color: colors.brand }]}>{currency(total)}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md }}>
          <Text style={styles.totalLabel}>Due</Text><Text style={[styles.totalVal, { color: colors.warning }]}>{currency(due)}</Text>
        </View>
        <Pressable testID="submit-order-button" onPress={onSubmit} disabled={busy} style={[styles.cta, busy && { opacity: 0.7 }]}>
          <Text style={styles.ctaText}>{busy ? "Saving…" : "Save Order"}</Text>
        </Pressable>
      </View>

      <PickerModal
        visible={showCust}
        title="Select Customer"
        data={customers}
        searchable
        onClose={() => setShowCust(false)}
        renderLabel={(c: any) => `${c.name} · ${c.phone}`}
        searchFilter={(c: any, term: string) => {
          const t = term.toLowerCase();
          return (c.name || "").toLowerCase().includes(t) || (c.phone || "").toLowerCase().includes(t) || (c.email || "").toLowerCase().includes(t);
        }}
        testIDPrefix="pick-customer"
        onPick={(c) => { setCustomer(c); setShowCust(false); }}
        header={
          <Pressable
            testID="picker-add-new-customer"
            onPress={() => setShowNewCust(true)}
            style={styles.addNewRow}
          >
            <View style={styles.addNewIcon}><Ionicons name="person-add" size={18} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addNewTitle}>Add new customer</Text>
              <Text style={styles.addNewSub}>Create & select in one step</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.brand} />
          </Pressable>
        }
      />

      <Modal visible={showNewCust} transparent animationType="slide" onRequestClose={() => setShowNewCust(false)}>
        <View style={styles.modalWrap}>
          <View style={[styles.modalCard, { padding: spacing.lg, paddingBottom: spacing.xxl }]}>
            <View style={styles.newCustHeader}>
              <Text style={styles.modalTitle}>New Customer</Text>
              <Pressable onPress={() => setShowNewCust(false)} testID="close-new-customer"><Ionicons name="close" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              testID="inline-cust-name"
              value={newCust.name}
              onChangeText={(v) => setNewCust({ ...newCust, name: v })}
              placeholder="Customer name"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <Text style={styles.label}>Phone *</Text>
            <TextInput
              testID="inline-cust-phone"
              value={newCust.phone}
              onChangeText={(v) => setNewCust({ ...newCust, phone: v })}
              keyboardType="phone-pad"
              placeholder="+91 9000000000"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <Text style={styles.label}>Email (optional)</Text>
            <TextInput
              testID="inline-cust-email"
              value={newCust.email}
              onChangeText={(v) => setNewCust({ ...newCust, email: v })}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="email@example.com"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            {newCustErr ? <Text testID="inline-cust-error" style={{ color: colors.error, marginTop: spacing.sm }}>{newCustErr}</Text> : null}
            <Pressable
              testID="save-inline-customer"
              disabled={newCustBusy}
              onPress={createInlineCustomer}
              style={[styles.cta, { marginTop: spacing.lg }, newCustBusy && { opacity: 0.7 }]}
            >
              <Text style={styles.ctaText}>{newCustBusy ? "Saving…" : "Create & select"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <PickerModal
        visible={showItem}
        title="Add Item"
        data={inventory}
        searchable
        onClose={() => setShowItem(false)}
        renderLabel={(i: any) => `${i.name}${i.brand ? " · " + i.brand : ""} · ${currency(i.price)} · ${i.stock > 0 ? `Stk ${i.stock}` : "Out of stock"}`}
        searchFilter={(i: any, term: string) => {
          const t = term.toLowerCase();
          return (i.name || "").toLowerCase().includes(t) || (i.brand || "").toLowerCase().includes(t) || (i.sku || "").toLowerCase().includes(t) || (i.barcode || "").toLowerCase().includes(t);
        }}
        testIDPrefix="pick-item"
        onPick={(it) => { setLines([...lines, { item: it, quantity: 1 }]); setShowItem(false); }}
        header={
          <Pressable
            testID="picker-add-new-inventory"
            onPress={() => setShowNewItem(true)}
            style={styles.addNewRow}
          >
            <View style={[styles.addNewIcon, { backgroundColor: colors.brandSecondary }]}><Ionicons name="add-circle" size={18} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.addNewTitle, { color: colors.brandSecondary }]}>Add new inventory item</Text>
              <Text style={styles.addNewSub}>Create & add to this order</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.brandSecondary} />
          </Pressable>
        }
      />

      <Modal visible={showNewItem} transparent animationType="slide" onRequestClose={() => setShowNewItem(false)}>
        <View style={styles.modalWrap}>
          <View style={[styles.modalCard, { padding: spacing.lg, paddingBottom: spacing.xxl }]}>
            <View style={styles.newCustHeader}>
              <Text style={styles.modalTitle}>New Inventory Item</Text>
              <Pressable onPress={() => setShowNewItem(false)} testID="close-new-inventory"><Ionicons name="close" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              testID="inline-item-name"
              value={newItem.name}
              onChangeText={(v) => setNewItem({ ...newItem, name: v })}
              placeholder="e.g. Ray-Ban Wayfarer"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <Text style={styles.label}>Category *</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm }}>
              {(["frame", "lens", "contact", "accessory"] as const).map((c) => (
                <Pressable
                  key={c}
                  testID={`inline-item-cat-${c}`}
                  onPress={() => setNewItem({ ...newItem, category: c })}
                  style={[styles.catChip, newItem.category === c && styles.catChipActive]}
                >
                  <Text style={[styles.catChipTxt, newItem.category === c && styles.catChipTxtActive]}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Brand</Text>
            <TextInput
              testID="inline-item-brand"
              value={newItem.brand}
              onChangeText={(v) => setNewItem({ ...newItem, brand: v })}
              placeholder="Brand"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Price *</Text>
                <TextInput
                  testID="inline-item-price"
                  value={newItem.price}
                  onChangeText={(v) => setNewItem({ ...newItem, price: v })}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Stock</Text>
                <TextInput
                  testID="inline-item-stock"
                  value={newItem.stock}
                  onChangeText={(v) => setNewItem({ ...newItem, stock: v })}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
              </View>
            </View>
            {newItemErr ? <Text testID="inline-item-error" style={{ color: colors.error, marginTop: spacing.sm }}>{newItemErr}</Text> : null}
            <Pressable
              testID="save-inline-inventory"
              disabled={newItemBusy}
              onPress={createInlineInventory}
              style={[styles.cta, { marginTop: spacing.lg }, newItemBusy && { opacity: 0.7 }]}
            >
              <Text style={styles.ctaText}>{newItemBusy ? "Saving…" : "Create & add to order"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function PickerModal({ visible, title, data, onClose, onPick, renderLabel, testIDPrefix, header, searchable, searchFilter }: any) {
  const [term, setTerm] = useState("");
  useEffect(() => { if (!visible) setTerm(""); }, [visible]);
  const filtered = searchable && term && searchFilter ? (data || []).filter((d: any) => searchFilter(d, term)) : (data || []);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={colors.onSurface} /></Pressable>
          </View>
          {searchable ? (
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color={colors.muted} />
              <TextInput
                testID={`${testIDPrefix}-search`}
                value={term}
                onChangeText={setTerm}
                placeholder="Search…"
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
                autoCapitalize="none"
              />
              {term ? (
                <Pressable onPress={() => setTerm("")} hitSlop={8} testID={`${testIDPrefix}-search-clear`}>
                  <Ionicons name="close-circle" size={18} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <FlatList
            data={filtered}
            keyExtractor={(it) => it.id}
            ListHeaderComponent={header}
            ListEmptyComponent={<Text style={{ padding: spacing.lg, color: colors.muted, textAlign: "center" }}>{term ? "No matches" : "No items"}</Text>}
            renderItem={({ item }) => (
              <Pressable
                testID={`${testIDPrefix}-${item.id}`}
                onPress={() => onPick(item)}
                style={{ padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}
              >
                <Text style={{ color: colors.onSurface, fontSize: sizes.base, fontWeight: "500" }}>{renderLabel(item)}</Text>
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: sizes.lg, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.sm },
  picker: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  lineRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  lineName: { color: colors.onSurface, fontWeight: "600", fontSize: sizes.base },
  lineSub: { color: colors.muted, fontSize: sizes.sm, marginTop: 2 },
  qty: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  qtyBtnText: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  qtyN: { fontWeight: "700", fontSize: sizes.base, minWidth: 18, textAlign: "center" },
  addItemBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.brand, backgroundColor: colors.brandTertiary + "40" },
  label: { fontSize: sizes.sm, fontWeight: "600", color: colors.onSurfaceSecondary, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: sizes.lg, color: colors.onSurface },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
  totalLabel: { color: colors.muted, fontSize: sizes.base },
  totalVal: { color: colors.onSurface, fontSize: sizes.lg, fontWeight: "700" },
  cta: { backgroundColor: colors.brand, padding: spacing.lg, borderRadius: radius.md, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: sizes.lg, fontWeight: "700" },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "75%" },
  modalHeader: { padding: spacing.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: sizes.xl, fontWeight: "700", color: colors.onSurface },
  addNewRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, margin: spacing.md, borderRadius: radius.md, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brand },
  addNewIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  addNewTitle: { fontSize: sizes.base, fontWeight: "700", color: colors.brand },
  addNewSub: { fontSize: sizes.sm, color: colors.onSurfaceSecondary, marginTop: 2 },
  newCustHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surfaceSecondary },
  searchInput: { flex: 1, fontSize: sizes.base, color: colors.onSurface, paddingVertical: 4 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTertiary },
  catChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  catChipTxt: { fontSize: sizes.sm, fontWeight: "600", color: colors.muted, textTransform: "capitalize" },
  catChipTxtActive: { color: "#fff" },
  couponWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  couponInput: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: sizes.base, color: colors.onSurface },
  couponBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.brandSecondary, borderRadius: radius.md },
  couponBtnTxt: { color: "#fff", fontWeight: "700" },
});
