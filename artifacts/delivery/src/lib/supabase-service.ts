import { supabase } from "./supabase";
import type { Company, Product, CartItem, DeliveryType, Customer } from "../types";
import bcrypt from "bcryptjs";

export async function getCompanyBySlug(slug: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .ilike("delivery_slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getCompanyBySlug error:", error.message);
    const { data: probe } = await supabase.from("companies").select("id").limit(1);
    if (!probe || probe.length === 0) {
      console.error(
        "RLS ISSUE: anon key cannot read from 'companies' table. " +
        "Add a SELECT policy in Supabase: CREATE POLICY \"anon_read\" ON companies FOR SELECT USING (true);"
      );
    }
    return null;
  }

  if (!data) {
    const { data: allCompanies } = await supabase
      .from("companies")
      .select("id, name, delivery_slug, delivery_enabled")
      .limit(20);
    console.warn(`No company found with delivery_slug ilike "${slug}". Available companies:`, JSON.stringify(allCompanies));
    return null;
  }

  return data as Company;
}

export async function getProductsByCompanyId(
  companyId: string
): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(
      `
      *,
      product_addons (
        id, name, price, sort_order
      )
    `
    )
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data) return [];
  return data as Product[];
}

export function getEffectivePrice(product: Product): number {
  const today = new Date().toISOString().split("T")[0];
  const inPromotion =
    product.is_promotion &&
    product.promotion_price != null &&
    (!product.promotion_start || product.promotion_start <= today) &&
    (!product.promotion_end || product.promotion_end >= today);
  return inPromotion ? product.promotion_price! : product.sale_price;
}

export function isPromotionActive(product: Product): boolean {
  const today = new Date().toISOString().split("T")[0];
  return !!(
    product.is_promotion &&
    product.promotion_price != null &&
    (!product.promotion_start || product.promotion_start <= today) &&
    (!product.promotion_end || product.promotion_end >= today)
  );
}

const PT_WEEKDAYS: Record<number, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

export function isStoreOpen(company: Company): boolean {
  const hours = company.delivery_operating_hours;
  if (!hours || hours.length === 0) return true;

  const now = new Date();
  const tz = "America/Sao_Paulo";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const enWeekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "";
  const dayIndex = enWeekdays.indexOf(weekdayStr);
  const todayPt = PT_WEEKDAYS[dayIndex] ?? "";

  const h = (parts.find((p) => p.type === "hour")?.value ?? "00").padStart(2, "0");
  const m = (parts.find((p) => p.type === "minute")?.value ?? "00").padStart(2, "0");
  const currentTime = `${h}:${m}`;

  const todayHours = hours.find((entry) =>
    entry.day === todayPt || entry.day === (dayIndex as unknown as string)
  );
  if (!todayHours || !todayHours.isOpen) return false;

  return currentTime >= todayHours.openTime && currentTime <= todayHours.closeTime;
}

export async function fetchActivePromotions(companyId: string) {
  if (!companyId) return [];
  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true);
  if (error) { console.warn("[promotions] fetch failed:", error.message); return []; }
  return data ?? [];
}

export async function validateCoupon(
  code: string,
  subtotal: number,
  companyId: string,
  customerId?: string | null,
): Promise<{ ok: boolean; coupon?: import("./promotions-engine").Coupon; discount?: number; error?: string }> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { ok: false, error: "Digite um código de cupom." };

  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("company_id", companyId)
    .ilike("code", trimmed)
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, error: "Falha ao validar cupom." };
  if (!data) return { ok: false, error: "Cupom não encontrado." };

  const c = data as import("./promotions-engine").Coupon;
  const now = new Date();
  if (!c.is_active) return { ok: false, error: "Cupom desativado." };
  if (c.starts_at && new Date(c.starts_at) > now) return { ok: false, error: "Cupom ainda não está válido." };
  if (c.ends_at && new Date(c.ends_at) < now) return { ok: false, error: "Cupom expirado." };
  if (c.max_uses != null && c.uses_count >= c.max_uses) return { ok: false, error: "Cupom esgotado." };
  if (subtotal < Number(c.min_purchase ?? 0)) {
    return { ok: false, error: `Compra mínima de ${Number(c.min_purchase || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} para usar este cupom.` };
  }

  if (c.max_uses_per_customer != null && customerId) {
    const { count } = await supabase
      .from("coupon_uses")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", c.id)
      .eq("customer_id", customerId);
    if (count != null && count >= c.max_uses_per_customer) {
      return { ok: false, error: c.max_uses_per_customer === 1 ? "Este cupom já foi utilizado por você." : `Você já usou este cupom ${c.max_uses_per_customer}x (limite atingido).` };
    }
  }

  const { computeCouponDiscount } = await import("./promotions-engine");
  const discount = computeCouponDiscount(c, subtotal);
  if (discount <= 0) return { ok: false, error: "Cupom não gera desconto neste subtotal." };
  return { ok: true, coupon: c, discount };
}

export async function consumeCoupon(
  coupon: import("./promotions-engine").Coupon,
  ctx: { companyId: string; customerId?: string; customerName: string; orderId?: string; discountAmount: number },
): Promise<void> {
  await supabase.from("coupons").update({ uses_count: (coupon.uses_count ?? 0) + 1 }).eq("id", coupon.id);
  if (ctx.customerId) {
    try {
      await supabase.from("coupon_uses").insert({
        company_id: ctx.companyId,
        coupon_id: coupon.id,
        coupon_code: coupon.code,
        customer_id: ctx.customerId,
        customer_name: ctx.customerName,
        order_id: ctx.orderId ?? null,
        discount_amount: ctx.discountAmount,
      });
    } catch (e) { console.warn("[coupons] falha ao gravar coupon_uses:", e); }
  }
}

export async function createDeliveryOrder(params: {
  companyId: string;
  items: CartItem[];
  paymentMethod: string;
  notes?: string;
  deliveryType: DeliveryType;
  deliveryFee: number;
  customerName: string;
  customerPhone: string;
  address?: string;
  tableIdentifier?: string;
  changeFor?: number;
  changeAmount?: number;
  comandaId?: string;
  promotionDiscount?: number;
  couponCode?: string;
}): Promise<{ id: string; numeric_id?: number } | null> {
  const subtotal = params.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const fee = params.deliveryType === "delivery" ? params.deliveryFee : 0;
  const totalDiscount = params.promotionDiscount ?? 0;
  const total = Math.max(0, subtotal + fee - totalDiscount);

  const { data: order, error: orderErr } = await supabase
    .from("delivery_orders")
    .insert({
      company_id: params.companyId,
      customer_name: params.customerName,
      customer_phone: params.customerPhone,
      address: params.address ?? null,
      delivery_type: params.deliveryType,
      table_identifier: params.tableIdentifier ?? null,
      items: params.items,
      subtotal,
      delivery_fee: fee,
      discount_amount: totalDiscount,
      coupon_code: params.couponCode ?? null,
      total,
      payment_method: params.paymentMethod,
      change_for: params.changeFor ?? null,
      change_amount: params.changeAmount ?? null,
      comanda_id: params.comandaId ?? null,
      notes: params.notes ?? null,
      status: "pending",
    })
    .select()
    .single();

  if (orderErr || !order) {
    console.error("Error creating delivery order:", orderErr);
    return null;
  }

  // Sales + sale_items (only for non dine_in)
  if (params.deliveryType !== "dine_in") {
    const saleNotes = [
      params.notes,
      `Cliente: ${params.customerName}`,
      `Tel: ${params.customerPhone}`,
      params.deliveryType === "delivery"
        ? `Endereço: ${params.address}`
        : "Retirada na loja",
      `Pedido #${order.numeric_id}`,
    ].filter(Boolean).join(" | ");

    const { data: sale } = await supabase
      .from("sales")
      .insert({
        company_id: params.companyId,
        subtotal,
        discount_amount: 0,
        total,
        payment_method: params.paymentMethod,
        payment_amount: total,
        change_amount: 0,
        notes: saleNotes,
        status: "pending",
      })
      .select()
      .single();

    if (sale) {
      const saleItems = params.items.map((item) => ({
        sale_id: sale.id,
        product_id: item.productId ?? null,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        discount_amount: 0,
        subtotal: item.totalPrice,
        addons: item.selectedAddons ?? [],
        notes: null,
      }));
      await supabase.from("sale_items").insert(saleItems);
    }
  }

  // Stock movements (negative) + decrement stock_quantity — ALL delivery types
  const stockItems = params.items.filter((item) => item.productId);
  if (stockItems.length > 0) {
    const movements = stockItems.map((item) => ({
      company_id: params.companyId,
      product_id: item.productId,
      kind: "sale",
      quantity: -(item.weight ?? item.quantity),
      reference: `Pedido #${order.numeric_id}`,
      notes: `Venda ${params.deliveryType === "dine_in" ? "mesa" : "delivery"} — ${item.name}`,
    }));
    const { error: movErr } = await supabase.from("stock_movements").insert(movements);
    if (movErr) console.error("Error creating stock movements:", movErr);

    for (const item of stockItems) {
      const qty = item.weight ?? item.quantity;
      const { error } = await supabase.rpc("decrement_product_stock", {
        p_product_id: item.productId,
        p_qty: qty,
      });
      if (error) console.error("decrement_product_stock error:", error.message);
    }
  }

  return { id: order.id, numeric_id: order.numeric_id };
}

export async function restoreOrderStock(params: {
  companyId: string;
  items: CartItem[];
  orderId: string;
  numericId?: number;
}): Promise<void> {
  const stockItems = params.items.filter((item) => item.productId);
  if (stockItems.length === 0) return;

  const movements = stockItems.map((item) => ({
    company_id: params.companyId,
    product_id: item.productId,
    kind: "cancellation",
    quantity: item.weight ?? item.quantity,
    reference: `Cancelamento #${params.numericId ?? params.orderId.slice(0, 8)}`,
    notes: `Estorno cancelamento — ${item.name}`,
  }));
  const { error: movErr } = await supabase.from("stock_movements").insert(movements);
  if (movErr) console.error("Error creating cancellation movements:", movErr);

  for (const item of stockItems) {
    const qty = item.weight ?? item.quantity;
    const { error } = await supabase.rpc("restore_product_stock", {
      p_product_id: item.productId,
      p_qty: qty,
    });
    if (error) console.error("restore_product_stock error:", error.message);
  }
}

export async function callWaiter(params: {
  companyId: string;
  tableLabel: string;
  comandaId?: string;
}): Promise<boolean> {
  const { error } = await supabase.from("waiter_calls").insert({
    company_id: params.companyId,
    table_label: params.tableLabel,
    comanda_id: params.comandaId ?? null,
  });
  if (error) {
    console.error("Error calling waiter:", error);
    return false;
  }
  return true;
}

export async function getDeliveryOrderById(
  orderId: string
): Promise<import("../types").DeliveryOrder | null> {
  const isNumeric = /^\d+$/.test(orderId);
  const query = supabase.from("delivery_orders").select("*");
  const { data, error } = await (isNumeric
    ? query.eq("numeric_id", Number(orderId))
    : query.eq("id", orderId)
  ).single();
  if (error || !data) return null;
  return data as import("../types").DeliveryOrder;
}

export async function sendWhatsAppOrder(
  company: Company,
  message: string,
  customerPhone: string
): Promise<void> {
  if (!company.wapi_instance_id || !company.wapi_token) return;

  const phone = customerPhone.replace(/\D/g, "");

  try {
    await fetch(
      `https://api.w-api.app/v1/message/send-text?instanceId=${company.wapi_instance_id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${company.wapi_token}`,
        },
        body: JSON.stringify({
          phone: `55${phone}`,
          message,
        }),
      }
    );
  } catch (err) {
    console.error("WhatsApp send error:", err);
  }
}

export function generateOrderWhatsAppMessage(params: {
  company: Company;
  items: CartItem[];
  subtotal: number;
  promotionDiscount?: number;
  couponDiscount?: number;
  couponCode?: string;
  total: number;
  deliveryFee: number;
  paymentMethod: string;
  deliveryType: DeliveryType;
  customerName: string;
  customerPhone: string;
  address?: string;
  tableIdentifier?: string;
  notes?: string;
  changeNote?: string;
  trackingUrl?: string;
}): string {
  const paymentLabels: Record<string, string> = {
    pix: "PIX",
    cash: "Dinheiro",
    credit_card: "Cartão de Crédito",
    debit_card: "Cartão de Débito",
    ticket: "Vale Refeição",
  };

  let msg = `🛍️ *Novo pedido — ${params.company.name}*\n\n`;
  msg += `📋 *Itens:*\n`;

  for (const item of params.items) {
    msg += `• ${item.quantity}x ${item.name}`;
    if (item.selectedAddons?.length) {
      msg += `\n  + ${item.selectedAddons.map((a) => a.name).join(", ")}`;
    }
    msg += ` — R$ ${item.totalPrice.toFixed(2).replace(".", ",")}\n`;
  }

  msg += `\n💰 *Subtotal: R$ ${params.subtotal.toFixed(2).replace(".", ",")}*`;
  if (params.promotionDiscount && params.promotionDiscount > 0) {
    msg += `\n🏷️ *Promoções:* − R$ ${params.promotionDiscount.toFixed(2).replace(".", ",")}`;
  }
  if (params.couponDiscount && params.couponDiscount > 0) {
    msg += `\n🏷️ *Cupom${params.couponCode ? ` (${params.couponCode})` : ""}:* − R$ ${params.couponDiscount.toFixed(2).replace(".", ",")}`;
  }
  msg += `\n💰 *Total: R$ ${params.total.toFixed(2).replace(".", ",")}*`;
  if (params.deliveryFee > 0) {
    msg += `\n  (incl. taxa entrega: R$ ${params.deliveryFee.toFixed(2).replace(".", ",")})`;
  }
  msg += `\n💳 *Pagamento:* ${paymentLabels[params.paymentMethod] ?? params.paymentMethod}`;
  if (params.changeNote) msg += `\n💵 *${params.changeNote}*`;
  msg += `\n`;

  if (params.deliveryType === "dine_in" && params.tableIdentifier) {
    msg += `\n🍽️ *Mesa:* ${params.tableIdentifier}\n`;
  } else if (params.deliveryType === "delivery" && params.address) {
    msg += `\n🏠 *Endereço:* ${params.address}\n`;
  } else {
    msg += `\n🏪 *Retirada na loja*\n`;
  }

  msg += `\n📍 *Cliente:* ${params.customerName}`;
  msg += `\n📱 *Telefone:* ${params.customerPhone}`;

  if (params.notes) {
    msg += `\n\n📝 *Obs:* ${params.notes}`;
  }

  if (params.trackingUrl) {
    msg += `\n\n🔍 *Acompanhe seu pedido:*\n${params.trackingUrl}`;
  }

  return msg;
}

export function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyThemeColor(primaryColor: string): void {
  const hsl = hexToHsl(primaryColor);
  document.documentElement.style.setProperty("--primary", hsl);
  document.documentElement.style.setProperty("--ring", hsl);
}

export async function getOrderReview(orderId: string): Promise<{ rating: number; comment?: string } | null> {
  const { data } = await supabase
    .from("order_reviews")
    .select("rating, comment")
    .eq("order_id", orderId)
    .maybeSingle();
  if (!data) return null;
  return { rating: data.rating, comment: data.comment ?? undefined };
}

export async function submitOrderReview(params: {
  companyId: string;
  orderId: string;
  orderNumericId?: number;
  customerName?: string;
  deliveryType?: string;
  tableIdentifier?: string;
  rating: number;
  comment?: string;
}): Promise<boolean> {
  const { error } = await supabase.from("order_reviews").insert({
    company_id: params.companyId,
    order_id: params.orderId,
    order_numeric_id: params.orderNumericId ?? null,
    customer_name: params.customerName ?? null,
    delivery_type: params.deliveryType ?? null,
    table_identifier: params.tableIdentifier ?? null,
    rating: params.rating,
    comment: params.comment?.trim() || null,
  });
  if (error) { console.error("Error submitting review:", error); return false; }
  return true;
}

export function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

// ─── Customer Auth ─────────────────────────────────────────────────────────

export async function signupCustomer(params: {
  companyId: string;
  name: string;
  email?: string;
  phone?: string;
  password: string;
  document?: string;
}): Promise<{ customer: Customer | null; error?: "identifier_taken" | "cpf_taken" | "unknown" }> {
  const identifier = params.email?.toLowerCase().trim() || params.phone?.trim();
  if (!identifier) return { customer: null, error: "unknown" };

  const existing = await _findCustomer(params.companyId, identifier);
  if (existing) return { customer: null, error: "identifier_taken" };

  const cpfDigits = params.document?.replace(/\D/g, "").trim() || null;

  if (cpfDigits) {
    const { data: cpfExists } = await supabase
      .from("customers")
      .select("id")
      .eq("company_id", params.companyId)
      .eq("document", cpfDigits)
      .maybeSingle();
    if (cpfExists) return { customer: null, error: "cpf_taken" };
  }

  const password_hash = await bcrypt.hash(params.password, 10);
  const hasEmail = !!params.email?.trim();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      company_id: params.companyId,
      name: params.name.trim(),
      email: params.email?.toLowerCase().trim() || null,
      phone: params.phone?.trim() || null,
      password_hash,
      email_verified: !hasEmail,
      document: cpfDigits,
    })
    .select()
    .single();

  if (error) { console.error("signupCustomer error:", error); return { customer: null, error: "unknown" }; }
  return { customer: data as Customer };
}

export async function loginCustomer(params: {
  companyId: string;
  identifier: string;
  password: string;
}): Promise<{ customer: Customer | null; unverified?: boolean; unverifiedCustomer?: Customer }> {
  const id = params.identifier.toLowerCase().trim();
  const customer = await _findCustomer(params.companyId, id);
  if (!customer || !customer.password_hash) return { customer: null };
  const ok = await bcrypt.compare(params.password, customer.password_hash);
  if (!ok) return { customer: null };
  if (customer.email && customer.email_verified === false) return { customer: null, unverified: true, unverifiedCustomer: customer };
  return { customer };
}

export async function verifyCustomerEmail(customerId: string): Promise<boolean> {
  const { error } = await supabase
    .from("customers")
    .update({ email_verified: true })
    .eq("id", customerId);
  return !error;
}

export async function updateCustomerPassword(params: {
  customerId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase
    .from("customers")
    .select("password_hash")
    .eq("id", params.customerId)
    .single();

  if (error || !data) return { ok: false, error: "Cliente não encontrado." };
  if (!data.password_hash) return { ok: false, error: "Sem senha cadastrada." };

  const match = await bcrypt.compare(params.currentPassword, data.password_hash);
  if (!match) return { ok: false, error: "Senha atual incorreta." };

  const password_hash = await bcrypt.hash(params.newPassword, 10);
  const { error: updErr } = await supabase
    .from("customers")
    .update({ password_hash })
    .eq("id", params.customerId);

  if (updErr) return { ok: false, error: "Erro ao atualizar senha." };
  return { ok: true };
}

async function _findCustomer(companyId: string, identifier: string): Promise<Customer | null> {
  const isEmail = identifier.includes("@");
  const col = isEmail ? "email" : "phone";
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("company_id", companyId)
    .ilike(col, identifier)
    .maybeSingle();
  return data as Customer | null;
}

export async function findCustomerByEmail(companyId: string, email: string): Promise<Customer | null> {
  const { data } = await supabase
    .from("customers")
    .select("id, name, email")
    .eq("company_id", companyId)
    .ilike("email", email.toLowerCase().trim())
    .maybeSingle();
  return data as Customer | null;
}

export async function updateCustomerAddress(customerId: string, address: {
  cep?: string; street?: string; number?: string; complement?: string;
  neighborhood?: string; city?: string; state?: string;
}): Promise<boolean> {
  const { error } = await supabase
    .from("customers")
    .update({
      address_cep: address.cep || null,
      address_street: address.street || null,
      address_number: address.number || null,
      address_complement: address.complement || null,
      address_neighborhood: address.neighborhood || null,
      address_city: address.city || null,
      address_state: address.state || null,
    })
    .eq("id", customerId);
  return !error;
}

export async function resetCustomerPassword(customerId: string, newPassword: string): Promise<boolean> {
  const password_hash = await bcrypt.hash(newPassword, 10);
  const { error } = await supabase
    .from("customers")
    .update({ password_hash })
    .eq("id", customerId);
  return !error;
}

function _emailTemplate(params: {
  storeColor: string;
  title: string;
  toName: string;
  body: string;
  ctaUrl: string;
  ctaLabel: string;
  footer?: string;
}): string {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <div style="background:${params.storeColor};padding:24px 32px;border-radius:12px 12px 0 0;text-align:center">
        <img src="https://app.pdvio.com.br/logo-pdvio-light.png" alt="PDVIO" style="height:32px;object-fit:contain" />
      </div>
      <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none">
        <h2 style="color:#111;margin:0 0 8px">${params.title}</h2>
        <p style="color:#444">Olá, <strong>${params.toName}</strong>!</p>
        <p style="color:#444">${params.body}</p>
        <p style="margin:32px 0;text-align:center">
          <a href="${params.ctaUrl}" style="background:${params.storeColor};color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
            ${params.ctaLabel}
          </a>
        </p>
        <p style="color:#9ca3af;font-size:12px;margin:0">${params.footer ?? "Se você não solicitou, ignore este e-mail."}</p>
      </div>
    </div>`;
}

async function _sendBrevoEmail(to: { email: string; name: string }, subject: string, htmlContent: string): Promise<boolean> {
  const apiKey = import.meta.env.VITE_BREVO_API_KEY;
  if (!apiKey) { console.error("VITE_BREVO_API_KEY not set"); return false; }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "accept": "application/json", "api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ sender: { name: "PDVIO", email: "no-reply@pdvio.com.br" }, to: [to], subject, htmlContent }),
    });
    return res.ok;
  } catch (e) { console.error("_sendBrevoEmail error:", e); return false; }
}

export async function sendPasswordResetEmail(params: {
  toEmail: string;
  toName: string;
  resetUrl: string;
  storeName: string;
  storeColor: string;
}): Promise<boolean> {
  return _sendBrevoEmail(
    { email: params.toEmail, name: params.toName },
    `Redefinição de senha — ${params.storeName}`,
    _emailTemplate({
      storeColor: params.storeColor,
      title: "Redefinir sua senha",
      toName: params.toName,
      body: `Clique no botão abaixo para alterar a senha do seu perfil na <strong>${params.storeName}</strong>.`,
      ctaUrl: params.resetUrl,
      ctaLabel: "Redefinir senha",
    }),
  );
}

export async function sendEmailVerification(params: {
  toEmail: string;
  toName: string;
  verifyUrl: string;
  storeName: string;
  storeColor: string;
}): Promise<boolean> {
  return _sendBrevoEmail(
    { email: params.toEmail, name: params.toName },
    `Confirme seu e-mail — ${params.storeName}`,
    _emailTemplate({
      storeColor: params.storeColor,
      title: "Confirme seu e-mail",
      toName: params.toName,
      body: `Clique no botão abaixo para confirmar seu e-mail e ativar sua conta na <strong>${params.storeName}</strong>.`,
      ctaUrl: params.verifyUrl,
      ctaLabel: "Confirmar e-mail",
      footer: "Se você não criou uma conta, ignore este e-mail.",
    }),
  );
}
