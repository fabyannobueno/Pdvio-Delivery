export type PromotionKind = "category_percent" | "product_buy_x_pay_y";
export type CouponKind = "percent" | "fixed";

export interface Promotion {
  id: string;
  company_id: string;
  name: string;
  kind: PromotionKind;
  category: string | null;
  product_id: string | null;
  discount_percent: number | null;
  buy_qty: number | null;
  pay_qty: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Coupon {
  id: string;
  company_id: string;
  code: string;
  kind: CouponKind;
  value: number;
  min_purchase: number;
  max_uses: number | null;
  max_uses_per_customer: number | null;
  uses_count: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

function isActiveNow(starts_at: string | null, ends_at: string | null, now: Date = new Date()): boolean {
  if (starts_at && new Date(starts_at).getTime() > now.getTime()) return false;
  if (ends_at && new Date(ends_at).getTime() < now.getTime()) return false;
  return true;
}

export function isEnginePromotionActive(p: Promotion, now: Date = new Date()): boolean {
  return p.is_active && isActiveNow(p.starts_at, p.ends_at, now);
}

export function isCouponActive(c: Coupon, now: Date = new Date()): boolean {
  if (!c.is_active) return false;
  if (!isActiveNow(c.starts_at, c.ends_at, now)) return false;
  if (c.max_uses != null && c.uses_count >= c.max_uses) return false;
  return true;
}

export interface CartLineInput {
  productId: string;
  category: string | null;
  basePrice: number;
  quantity: number;
}

export interface CartLineDiscount {
  unitDiscount: number;
  freeQuantity: number;
  appliedPromotionIds: string[];
}

export interface PromotionsResult {
  perLine: CartLineDiscount[];
  totalDiscount: number;
  applied: Array<{ id: string; name: string; amount: number }>;
}

const norm = (s: string | null | undefined) =>
  (s ?? "").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function applyPromotions(
  lines: CartLineInput[],
  promotions: Promotion[],
  now: Date = new Date(),
): PromotionsResult {
  const active = promotions.filter((p) => isEnginePromotionActive(p, now));
  const perLine: CartLineDiscount[] = lines.map(() => ({
    unitDiscount: 0,
    freeQuantity: 0,
    appliedPromotionIds: [],
  }));
  const appliedMap = new Map<string, { id: string; name: string; amount: number }>();

  for (const promo of active.filter((p) => p.kind === "category_percent")) {
    if (!promo.category || promo.discount_percent == null) continue;
    const target = norm(promo.category);
    const pct = promo.discount_percent / 100;
    lines.forEach((line, i) => {
      if (norm(line.category) !== target) return;
      const cur = perLine[i];
      const remaining = Math.max(0, line.basePrice - cur.unitDiscount);
      const extra = Math.floor(remaining * pct * 100) / 100;
      if (extra <= 0) return;
      cur.unitDiscount += extra;
      cur.appliedPromotionIds.push(promo.id);
      const amount = extra * line.quantity;
      const prev = appliedMap.get(promo.id) ?? { id: promo.id, name: promo.name, amount: 0 };
      prev.amount += amount;
      appliedMap.set(promo.id, prev);
    });
  }

  for (const promo of active.filter((p) => p.kind === "product_buy_x_pay_y")) {
    if (!promo.product_id || !promo.buy_qty || promo.pay_qty == null) continue;
    const buy = promo.buy_qty;
    const pay = promo.pay_qty;
    if (buy <= 0 || pay < 0 || pay >= buy) continue;
    const freePerGroup = buy - pay;
    const lineIdxs = lines
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => l.productId === promo.product_id && Number.isInteger(l.quantity));
    const totalQty = lineIdxs.reduce((s, { l }) => s + l.quantity, 0);
    if (totalQty < buy) continue;
    let totalFree = Math.floor(totalQty / buy) * freePerGroup;
    for (const { l, i } of lineIdxs) {
      if (totalFree <= 0) break;
      const cur = perLine[i];
      const free = Math.min(l.quantity, totalFree);
      cur.freeQuantity += free;
      cur.appliedPromotionIds.push(promo.id);
      totalFree -= free;
      const amount = free * (l.basePrice - cur.unitDiscount);
      const prev = appliedMap.get(promo.id) ?? { id: promo.id, name: promo.name, amount: 0 };
      prev.amount += amount;
      appliedMap.set(promo.id, prev);
    }
  }

  let totalDiscount = 0;
  perLine.forEach((d, i) => {
    const line = lines[i];
    totalDiscount += d.unitDiscount * line.quantity + d.freeQuantity * (line.basePrice - d.unitDiscount);
  });

  return {
    perLine,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    applied: Array.from(appliedMap.values()).map((a) => ({ ...a, amount: Math.round(a.amount * 100) / 100 })),
  };
}

export function computeCouponDiscount(coupon: Coupon, subtotal: number): number {
  if (subtotal <= 0) return 0;
  if (coupon.kind === "percent") {
    return Math.floor(subtotal * Math.min(100, Math.max(0, coupon.value)) / 100 * 100) / 100;
  }
  return Math.min(subtotal, Math.floor(coupon.value * 100) / 100);
}
