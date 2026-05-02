import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Clock, CheckCircle2, ChefHat, Package, Motorbike, MapPin, X, ArrowLeft, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getCompanyBySlug, getDeliveryOrderById, applyThemeColor, formatCurrency } from "@/lib/supabase-service";
import type { Company, DeliveryOrder, DeliveryOrderStatus } from "@/types";

interface StatusStep {
  key: DeliveryOrderStatus;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}

const DELIVERY_STEPS: StatusStep[] = [
  { key: "pending",          label: "Pedido Recebido",    description: "Aguardando confirmação da loja.",                   icon: Clock,       color: "text-gray-500",   bg: "bg-gray-100" },
  { key: "confirmed",        label: "Confirmado",         description: "A loja confirmou seu pedido. 🎉",                   icon: CheckCircle2,color: "text-blue-500",   bg: "bg-blue-100" },
  { key: "preparing",        label: "Em Preparo",         description: "Seu pedido está sendo preparado. 👨‍🍳",              icon: ChefHat,     color: "text-primary",    bg: "bg-primary/10" },
  { key: "out_for_delivery", label: "A Caminho",          description: "O motoboy está a caminho da sua casa. 🛵💨",        icon: Motorbike,   color: "text-blue-600",   bg: "bg-blue-100" },
  { key: "delivered",        label: "Entregue",           description: "Pedido entregue com sucesso! Bom apetite. 😋",      icon: CheckCircle2,color: "text-green-500",  bg: "bg-green-100" },
];

const PICKUP_STEPS: StatusStep[] = [
  { key: "pending",          label: "Pedido Recebido",    description: "Aguardando confirmação da loja.",                   icon: Clock,       color: "text-gray-500",   bg: "bg-gray-100" },
  { key: "confirmed",        label: "Confirmado",         description: "A loja confirmou seu pedido. 🎉",                   icon: CheckCircle2,color: "text-blue-500",   bg: "bg-blue-100" },
  { key: "preparing",        label: "Em Preparo",         description: "Seu pedido está sendo preparado. 👨‍🍳",              icon: ChefHat,     color: "text-primary",    bg: "bg-primary/10" },
  { key: "ready_for_pickup", label: "Pronto p/ Retirada", description: "Seu pedido está pronto! Venha buscar. 🏪",          icon: Package,     color: "text-purple-500", bg: "bg-purple-100" },
  { key: "picked_up",        label: "Retirado",           description: "Pedido retirado. Bom apetite! 😍",                  icon: CheckCircle2,color: "text-green-500",  bg: "bg-green-100" },
];

const STATUS_ORDER: DeliveryOrderStatus[] = [
  "pending", "confirmed", "preparing", "out_for_delivery", "ready_for_pickup", "delivered", "picked_up",
];

const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  ticket: "Vale Refeição",
};

export const OrderTrackingPage = () => {
  const [, params] = useRoute("/:slug/pedido/:orderId");
  const [, navigate] = useLocation();
  const slug = params?.slug ?? "";
  const orderId = params?.orderId ?? "";

  const [company, setCompany] = useState<Company | null>(null);
  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!slug || !orderId) return;
    let cancelled = false;

    const load = async () => {
      const [c, o] = await Promise.all([
        getCompanyBySlug(slug),
        getDeliveryOrderById(orderId),
      ]);
      if (cancelled) return;
      if (c) { setCompany(c); applyThemeColor(c.delivery_primary_color); }
      setOrder(o);
      setLoading(false);
    };

    load();

    const poll = setInterval(async () => {
      const o = await getDeliveryOrderById(orderId);
      if (!cancelled && o) setOrder(o);
    }, 5000);

    return () => { cancelled = true; clearInterval(poll); };
  }, [slug, orderId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <X className="w-12 h-12 text-destructive" />
        <p className="text-lg font-semibold">Pedido não encontrado.</p>
        <Button variant="outline" onClick={() => navigate(`/${slug}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar à loja
        </Button>
      </div>
    );
  }

  const isCancelled = order.status === "cancelled";
  const steps = order.delivery_type === "delivery" ? DELIVERY_STEPS : PICKUP_STEPS;
  const currentIdx = steps.findIndex((s) => s.key === order.status);

  const formatTs = (ts: string) =>
    new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 py-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/20 shrink-0"
          onClick={() => navigate(`/${slug}`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        {company?.delivery_logo_url && (
          <img src={company.delivery_logo_url} alt={company.name}
            className="w-8 h-8 rounded-full object-cover shrink-0" />
        )}
        <div className="min-w-0">
          <p className="font-semibold truncate">{company?.name ?? slug}</p>
          <p className="text-xs opacity-80">
            Pedido #{order.numeric_id ?? orderId.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <div className="ml-auto text-xs opacity-80 shrink-0">
          {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* Cancelado */}
        {isCancelled && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center space-y-2">
            <X className="w-12 h-12 text-destructive mx-auto" />
            <p className="text-lg font-semibold text-destructive">Pedido Cancelado</p>
            <p className="text-sm text-muted-foreground">Entre em contato com a loja para mais informações.</p>
          </div>
        )}

        {/* Timeline */}
        {!isCancelled && (
          <div className="rounded-xl border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground mb-3">
              Pedido em {formatTs(order.created_at)} •{" "}
              {order.delivery_type === "delivery" ? "Entrega" : "Retirada"}
            </p>

            {steps.map((step, idx) => {
              const Icon = step.icon;
              const done = idx < currentIdx;
              const active = idx === currentIdx;
              const pending = idx > currentIdx;
              const isLast = idx === steps.length - 1;

              return (
                <div key={step.key} className="flex gap-3">
                  {/* Icon column */}
                  <div className="flex flex-col items-center">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all
                      ${active ? `${step.bg} ${step.color} ring-2 ring-current ring-offset-1` : ""}
                      ${done ? "bg-green-100 text-green-500" : ""}
                      ${pending ? "bg-muted text-muted-foreground/40" : ""}
                    `}>
                      {done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className={`w-5 h-5 ${active ? "animate-pulse" : ""}`} />}
                    </div>
                    {!isLast && (
                      <div className={`w-0.5 h-8 mt-1 rounded-full ${done ? "bg-green-400" : "bg-border"}`} />
                    )}
                  </div>

                  {/* Content */}
                  <div className={`pb-6 min-w-0 ${isLast ? "pb-0" : ""}`}>
                    <p className={`font-medium text-sm leading-tight ${pending ? "text-muted-foreground/60" : ""} ${active ? step.color : ""}`}>
                      {step.label}
                    </p>
                    {(active || done) && (
                      <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Resumo do pedido */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="font-semibold text-sm">Resumo do Pedido</p>
          <div className="space-y-2">
            {(order.items as import("@/types").CartItem[]).map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <div className="min-w-0 mr-2">
                  <span className="font-medium">{item.quantity}x {item.name}</span>
                  {item.selectedAddons?.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      + {item.selectedAddons.map((a) => a.name).join(", ")}
                    </p>
                  )}
                </div>
                <span className="shrink-0">{formatCurrency(item.totalPrice)}</span>
              </div>
            ))}
          </div>
          <Separator />
          {order.delivery_fee > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Taxa de entrega</span>
              <span>{formatCurrency(order.delivery_fee)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Badge variant="outline" className="text-xs">
              {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {order.delivery_type === "delivery" ? <><Motorbike className="w-3 h-3 mr-1" /> Entrega</> : <><MapPin className="w-3 h-3 mr-1" /> Retirada</>}
            </Badge>
          </div>
        </div>

        {/* Endereço */}
        {order.delivery_type === "delivery" && order.address && (
          <div className="rounded-xl border bg-card p-4 space-y-1">
            <p className="font-semibold text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" /> Endereço de entrega
            </p>
            <p className="text-sm text-muted-foreground">{order.address}</p>
          </div>
        )}

        {/* Observações */}
        {order.notes && (
          <div className="rounded-xl border bg-card p-4 space-y-1">
            <p className="font-semibold text-sm">Observações</p>
            <p className="text-sm text-muted-foreground">{order.notes}</p>
          </div>
        )}

        <Button variant="outline" className="w-full" onClick={() => navigate(`/${slug}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar à loja
        </Button>
      </div>
    </div>
  );
};
