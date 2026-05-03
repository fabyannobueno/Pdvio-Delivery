import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Clock, CheckCircle2, ChefHat, Package, Motorbike, MapPin, X, ArrowLeft, Loader2, UtensilsCrossed, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { getCompanyBySlug, getDeliveryOrderById, applyThemeColor, formatCurrency, restoreOrderStock, getOrderReview, submitOrderReview } from "@/lib/supabase-service";
import { supabase } from "@/lib/supabase";
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

const DINE_IN_STEPS: StatusStep[] = [
  { key: "pending",   label: "Pedido Enviado",         description: "Aguardando ser adicionado à comanda.",           icon: Clock,       color: "text-gray-500",  bg: "bg-gray-100" },
  { key: "confirmed", label: "Adicionado à Comanda",   description: "Seu pedido foi adicionado à comanda! 🍽️",        icon: CheckCircle2,color: "text-green-500", bg: "bg-green-100" },
  { key: "preparing", label: "Em Preparo",             description: "Seu pedido está sendo preparado. 👨‍🍳",           icon: ChefHat,     color: "text-primary",   bg: "bg-primary/10" },
  { key: "delivered", label: "Servido",                description: "Bom apetite! 😋",                                icon: CheckCircle2,color: "text-green-500", bg: "bg-green-100" },
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
  const [comandaConfirmed, setComandaConfirmed] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [savedReview, setSavedReview] = useState<{ rating: number; comment?: string } | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

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
      if (c) {
        setCompany(c);
        applyThemeColor(c.delivery_primary_color);
        document.title = `Pedido | ${c.name}`;
        if (c.delivery_logo_url) {
          let favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
          if (!favicon) { favicon = document.createElement("link"); favicon.rel = "icon"; document.head.appendChild(favicon); }
          favicon.type = c.delivery_logo_url.startsWith("data:") ? c.delivery_logo_url.split(";")[0].replace("data:", "") : "image/png";
          favicon.href = c.delivery_logo_url;
        }
      }
      setOrder(o);
      if (o?.comanda_id) setComandaConfirmed(true);
      setLoading(false);
    };

    load();

    const poll = setInterval(async () => {
      const o = await getDeliveryOrderById(orderId);
      if (!cancelled && o) {
        setOrder(o);
        if (o.comanda_id && !comandaConfirmed) setComandaConfirmed(true);
      }
    }, 5000);

    return () => { cancelled = true; clearInterval(poll); };
  }, [slug, orderId]);

  // Realtime subscription: comanda_id filled + cancellation stock restore
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order_tracking_${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "delivery_orders", filter: `id=eq.${orderId}` },
        (payload) => {
          const prev = payload.old as Partial<DeliveryOrder>;
          const updated = payload.new as DeliveryOrder;
          setOrder(updated);

          if (updated.comanda_id && !comandaConfirmed) {
            setComandaConfirmed(true);
          }

          // Restore stock when order is cancelled (only once, when prev status wasn't cancelled)
          if (updated.status === "cancelled" && prev.status !== "cancelled") {
            restoreOrderStock({
              companyId: updated.company_id,
              items: updated.items as import("@/types").CartItem[],
              orderId: updated.id,
              numericId: updated.numeric_id,
            }).catch(console.error);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId, comandaConfirmed]);

  const FINAL_STATUSES: DeliveryOrderStatus[] = ["delivered", "picked_up"];

  useEffect(() => {
    if (!order || !FINAL_STATUSES.includes(order.status)) return;
    getOrderReview(order.id).then((review) => {
      if (review) setSavedReview(review);
    });
  }, [order?.status]);

  const handleSubmitReview = async () => {
    if (!order || !company || reviewRating === 0) return;
    setReviewSubmitting(true);
    const ok = await submitOrderReview({
      companyId: company.id,
      orderId: order.id,
      orderNumericId: order.numeric_id,
      customerName: order.customer_name,
      deliveryType: order.delivery_type,
      tableIdentifier: order.mesa_id ?? undefined,
      rating: reviewRating,
      comment: reviewComment,
    });
    setReviewSubmitting(false);
    if (ok) setSavedReview({ rating: reviewRating, comment: reviewComment || undefined });
  };

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
  const isDineIn = order.delivery_type === "dine_in";
  const steps = isDineIn ? DINE_IN_STEPS : order.delivery_type === "delivery" ? DELIVERY_STEPS : PICKUP_STEPS;
  const rawIdx = steps.findIndex((s) => s.key === order.status);
  const currentIdx = (isDineIn && comandaConfirmed && rawIdx < 1) ? 1 : rawIdx;

  const formatTs = (ts: string) =>
    new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 py-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/20 shrink-0"
          onClick={() => { window.scrollTo({ top: 0, behavior: "instant" }); navigate(`/${slug}`); }}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        {company?.delivery_logo_url && (
          <img src={company.delivery_logo_url} alt={company.name}
            className="w-8 h-8 rounded-full object-cover shrink-0 bg-white" />
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

        {/* Comanda confirmada — dine_in */}
        {isDineIn && comandaConfirmed && (
          <div className="rounded-xl border border-green-300 bg-green-50 p-4 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-800">Pedido adicionado à comanda!</p>
              <p className="text-sm text-green-700">Seus itens foram adicionados à comanda{order.table_identifier ? ` da ${order.table_identifier}` : ""}. Em breve serão preparados.</p>
            </div>
          </div>
        )}

        {/* Aguardando comanda — dine_in pending */}
        {isDineIn && !comandaConfirmed && order.status === "pending" && (
          <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4 flex items-start gap-3">
            <UtensilsCrossed className="w-6 h-6 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-800">Aguardando adição à comanda</p>
              <p className="text-sm text-yellow-700">Seu pedido foi enviado e será adicionado à comanda{order.table_identifier ? ` da ${order.table_identifier}` : ""} em instantes.</p>
            </div>
          </div>
        )}

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
              {isDineIn ? `Mesa: ${order.table_identifier ?? "—"}` : order.delivery_type === "delivery" ? "Entrega" : "Retirada"}
            </p>

            {steps.map((step, idx) => {
              const Icon = step.icon;
              const safeIdx = currentIdx >= 0 ? currentIdx : 0;
              const done = idx < safeIdx;
              const active = idx === safeIdx;
              const pending = idx > safeIdx;

              const isLast = idx === steps.length - 1;

              return (
                <div key={step.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all
                      ${active ? `${step.bg} ${step.color} ring-2 ring-current ring-offset-1` : ""}
                      ${done ? "bg-green-100 text-green-500" : ""}
                      ${pending ? "bg-muted text-muted-foreground/30" : ""}
                    `}>
                      {done
                        ? <CheckCircle2 className="w-5 h-5" />
                        : <Icon className={`w-5 h-5 ${active ? "animate-pulse" : ""}`} />
                      }
                    </div>
                    {!isLast && (
                      <div className={`w-0.5 h-8 mt-1 rounded-full ${done ? "bg-green-400" : "bg-border"}`} />
                    )}
                  </div>
                  <div className={`pb-6 min-w-0 ${isLast ? "pb-0" : ""}`}>
                    <p className={`font-medium text-sm leading-tight
                      ${active ? step.color : ""}
                      ${done ? "text-foreground" : ""}
                      ${pending ? "text-muted-foreground/40" : ""}
                    `}>
                      {step.label}
                    </p>
                    {active && (
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
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {isDineIn
                ? <><UtensilsCrossed className="w-3 h-3 mr-1" /> {order.table_identifier ?? "Mesa"}</>
                : order.delivery_type === "delivery"
                  ? <><Motorbike className="w-3 h-3 mr-1" /> Entrega</>
                  : <><MapPin className="w-3 h-3 mr-1" /> Retirada</>
              }
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

        {/* Avaliação do pedido */}
        {FINAL_STATUSES.includes(order.status) && (
          <div className="rounded-xl border bg-card p-5 space-y-4">
            {savedReview ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <p className="font-semibold text-sm">Sua avaliação</p>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-7 h-7 ${star <= savedReview.rating ? "fill-yellow-400 text-yellow-400" : "fill-muted text-muted-foreground"}`}
                    />
                  ))}
                </div>
                {savedReview.comment && (
                  <p className="text-sm text-muted-foreground italic">"{savedReview.comment}"</p>
                )}
                <p className="text-xs text-muted-foreground">Obrigado pelo seu feedback!</p>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="font-semibold text-sm">Como foi a sua experiência?</p>
                  <p className="text-xs text-muted-foreground">Sua avaliação é importante para nós</p>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      onMouseEnter={() => setReviewHover(star)}
                      onMouseLeave={() => setReviewHover(0)}
                      className="p-0.5 transition-transform hover:scale-110 focus:outline-none"
                      aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          star <= (reviewHover || reviewRating)
                            ? "fill-yellow-400 text-yellow-400"
                            : "fill-muted text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {reviewRating > 0 && (
                  <Textarea
                    placeholder="Deixe um comentário (opcional)"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={3}
                    className="resize-none text-sm"
                  />
                )}
                <Button
                  onClick={handleSubmitReview}
                  disabled={reviewRating === 0 || reviewSubmitting}
                  className="w-full"
                  size="sm"
                >
                  {reviewSubmitting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                  ) : (
                    "Enviar avaliação"
                  )}
                </Button>
              </>
            )}
          </div>
        )}

      </div>

      {/* Footer */}
      <footer className="border-t mt-4 py-6 flex flex-col items-center gap-2">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} {company?.name ?? slug}. Todos os direitos reservados.
        </p>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-muted-foreground">Powered by</span>
          <a href="https://www.pdvio.com.br/" target="_blank" rel="noopener noreferrer"
            className="opacity-80 hover:opacity-100 transition-opacity">
            <img src="/logo.png" alt="PDVIO" className="h-6 object-contain" />
          </a>
        </div>
      </footer>
    </div>
  );
};
