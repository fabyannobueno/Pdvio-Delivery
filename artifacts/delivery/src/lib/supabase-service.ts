import { supabase } from "./supabase";
import type { Company, Product, CartItem } from "../types";

export async function getCompanyBySlug(slug: string): Promise<Company | null> {
  // Try exact match first
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .ilike("delivery_slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getCompanyBySlug error:", error.message);

    // Try case-insensitive fallback without filter to diagnose RLS issues
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
    // Log all slugs to diagnose mismatch
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

  // Support both Portuguese string days ("Sexta") and numeric days (5)
  const todayHours = hours.find((entry) =>
    entry.day === todayPt || entry.day === (dayIndex as unknown as string)
  );
  if (!todayHours || !todayHours.isOpen) return false;

  return currentTime >= todayHours.openTime && currentTime <= todayHours.closeTime;
}

export async function createDeliveryOrder(params: {
  companyId: string;
  items: CartItem[];
  paymentMethod: string;
  notes?: string;
  deliveryType: "delivery" | "pickup";
  deliveryFee: number;
  customerName: string;
  customerPhone: string;
  address?: string;
}): Promise<{ id: string; numeric_id?: number } | null> {
  const subtotal = params.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const total = subtotal + (params.deliveryType === "delivery" ? params.deliveryFee : 0);

  const { data: order, error } = await supabase
    .from("delivery_orders")
    .insert({
      company_id: params.companyId,
      customer_name: params.customerName,
      customer_phone: params.customerPhone,
      address: params.address ?? null,
      delivery_type: params.deliveryType,
      items: params.items,
      subtotal,
      delivery_fee: params.deliveryType === "delivery" ? params.deliveryFee : 0,
      total,
      payment_method: params.paymentMethod,
      notes: params.notes ?? null,
      status: "pending",
    })
    .select()
    .single();

  if (error || !order) {
    console.error("Error creating delivery order:", error);
    return null;
  }

  return { id: order.id, numeric_id: order.numeric_id };
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
  total: number;
  deliveryFee: number;
  paymentMethod: string;
  deliveryType: "delivery" | "pickup";
  customerName: string;
  customerPhone: string;
  address?: string;
  notes?: string;
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

  msg += `\n💰 *Total: R$ ${params.total.toFixed(2).replace(".", ",")}*`;
  if (params.deliveryFee > 0) {
    msg += `\n  (incl. taxa entrega: R$ ${params.deliveryFee.toFixed(2).replace(".", ",")})`;
  }
  msg += `\n💳 *Pagamento:* ${paymentLabels[params.paymentMethod] ?? params.paymentMethod}\n`;

  if (params.deliveryType === "delivery" && params.address) {
    msg += `\n🏠 *Endereço:* ${params.address}\n`;
  } else {
    msg += `\n🏪 *Retirada na loja*\n`;
  }

  msg += `\n📍 *Cliente:* ${params.customerName}`;
  msg += `\n📱 *Telefone:* ${params.customerPhone}`;

  if (params.notes) {
    msg += `\n\n📝 *Obs:* ${params.notes}`;
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

export function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}
