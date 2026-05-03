import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { X, Truck, Home, UtensilsCrossed, CreditCard, Smartphone, DollarSign, Receipt, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createDeliveryOrder, sendWhatsAppOrder, generateOrderWhatsAppMessage, formatCurrency } from "@/lib/supabase-service";
import type { Company, CartItem, PaymentMethod, DeliveryType, MesaParams } from "@/types";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  setCart: (cart: CartItem[]) => void;
  company: Company;
  mesaParams?: MesaParams;
}

const PAYMENT_METHODS = [
  { id: "pix" as PaymentMethod, name: "PIX", icon: Smartphone, description: "Pagamento instantâneo" },
  { id: "credit_card" as PaymentMethod, name: "Cartão de Crédito", icon: CreditCard, description: "Cartão de crédito" },
  { id: "debit_card" as PaymentMethod, name: "Cartão de Débito", icon: CreditCard, description: "Cartão de débito" },
  { id: "cash" as PaymentMethod, name: "Dinheiro", icon: DollarSign, description: "Pagamento em espécie" },
  { id: "ticket" as PaymentMethod, name: "Vale Refeição", icon: Receipt, description: "VR, VA, Sodexo, etc." },
];

export const CheckoutModal = ({ isOpen, onClose, cart, setCart, company, mesaParams }: CheckoutModalProps) => {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const isMesaMode = !!mesaParams;
  const initialDeliveryType: DeliveryType = isMesaMode ? "dine_in" : "delivery";

  const [deliveryType, setDeliveryType] = useState<DeliveryType>(initialDeliveryType);
  const [customerData, setCustomerData] = useState({ name: "", phone: "", cep: "", street: "", number: "", neighborhood: "", city: "", state: "" });
  const [orderNotes, setOrderNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const availablePayments = PAYMENT_METHODS.filter(pm =>
    company.payment_settings?.enabled?.includes(pm.id)
  );
  const defaultPayment = (availablePayments.find(p => p.id === "pix") ?? availablePayments[0])?.id as PaymentMethod ?? "pix";
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>(defaultPayment);
  const [needsChange, setNeedsChange] = useState(false);
  const [changeFor, setChangeFor] = useState("");

  useEffect(() => {
    if (isMesaMode) setDeliveryType("dine_in");
  }, [isMesaMode, isOpen]);

  useEffect(() => {
    const saved = localStorage.getItem(`customer_${company.id}`);
    if (saved) {
      try { setCustomerData(JSON.parse(saved)); } catch {}
    }
  }, [company.id]);

  useEffect(() => {
    if (customerData.name || customerData.phone) {
      localStorage.setItem(`customer_${company.id}`, JSON.stringify(customerData));
    }
  }, [customerData, company.id]);

  const subtotal = cart.reduce((t, i) => t + i.totalPrice, 0);
  const freeDelivery = company.delivery_free_threshold && subtotal >= company.delivery_free_threshold;
  const deliveryFee = deliveryType === "delivery" ? (freeDelivery ? 0 : (company.delivery_fee || 0)) : 0;
  const total = subtotal + deliveryFee;

  const searchCep = async (cep: string) => {
    const cleaned = cep.replace(/\D/g, "");
    if (cleaned.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setCustomerData(prev => ({ ...prev, street: data.logradouro || "", neighborhood: data.bairro || "", city: data.localidade || "", state: data.uf || "" }));
      } else {
        toast({ title: "CEP não encontrado", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao buscar CEP", variant: "destructive" });
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numbers = e.target.value.replace(/\D/g, "");
    const formatted = numbers.replace(/(\d{5})(\d{1,3})/, "$1-$2");
    setCustomerData(prev => ({ ...prev, cep: formatted }));
    if (numbers.length === 8) searchCep(numbers);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numbers = e.target.value.replace(/\D/g, "").slice(0, 11);
    let formatted = numbers;
    if (numbers.length > 10) {
      formatted = numbers.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    } else if (numbers.length > 6) {
      formatted = numbers.replace(/(\d{2})(\d{4,5})(\d{0,4})/, "($1) $2-$3");
    } else if (numbers.length > 2) {
      formatted = numbers.replace(/(\d{2})(\d+)/, "($1) $2");
    } else if (numbers.length > 0) {
      formatted = `(${numbers}`;
    }
    setCustomerData(prev => ({ ...prev, phone: formatted }));
  };

  const parseChangeFor = () => {
    const digits = changeFor.replace(/\D/g, "");
    return digits ? parseInt(digits, 10) / 100 : 0;
  };

  const handleChangeForInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    const num = parseInt(digits || "0", 10) / 100;
    setChangeFor(num > 0 ? num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "");
  };

  const buildAddress = () => {
    const parts = [customerData.street, customerData.number, customerData.neighborhood, customerData.city, customerData.state].filter(Boolean);
    return parts.join(", ");
  };

  const canCheckout = () => {
    if (!customerData.name.trim() || customerData.name.trim().length < 2) return false;
    if (customerData.phone.replace(/\D/g, "").length < 10) return false;
    if (deliveryType === "delivery" && (!customerData.street || !customerData.number || !customerData.neighborhood)) return false;
    if (selectedPayment === "cash" && needsChange) {
      const val = parseChangeFor();
      if (val <= 0 || val < total) return false;
    }
    return true;
  };

  const handleCheckout = async () => {
    if (!canCheckout()) return;
    setLoading(true);

    try {
      const address = deliveryType === "delivery" ? buildAddress() : undefined;
      const tableIdentifier = deliveryType === "dine_in" ? mesaParams?.mesa : undefined;
      const companyId = mesaParams?.empresa ?? company.id;

      const changeNote = selectedPayment === "cash" && needsChange && changeFor
        ? `Troco para: ${changeFor} (troco: ${(parseChangeFor() - total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`
        : null;
      const fullNotes = [orderNotes, changeNote].filter(Boolean).join(" | ");

      const changeForVal = selectedPayment === "cash" && needsChange ? parseChangeFor() : undefined;
      const changeAmountVal = changeForVal ? parseFloat((changeForVal - total).toFixed(2)) : undefined;

      const sale = await createDeliveryOrder({
        companyId,
        items: cart,
        paymentMethod: selectedPayment,
        notes: fullNotes || undefined,
        deliveryType,
        deliveryFee,
        customerName: customerData.name,
        customerPhone: customerData.phone,
        address,
        tableIdentifier,
        changeFor: changeForVal,
        changeAmount: changeAmountVal,
        comandaId: mesaParams?.comanda,
      });

      if (!sale) throw new Error("Erro ao criar pedido");

      if (deliveryType !== "dine_in") {
        const orderId = sale.numeric_id ?? sale.id;
        const trackingUrl = `${window.location.origin}/${company.delivery_slug}/pedido/${orderId}`;

        const message = generateOrderWhatsAppMessage({
          company,
          items: cart,
          total,
          deliveryFee,
          paymentMethod: selectedPayment,
          deliveryType,
          customerName: customerData.name,
          customerPhone: customerData.phone,
          address,
          notes: orderNotes,
          changeNote: changeNote ?? undefined,
          trackingUrl,
        });

        if (company.delivery_whatsapp) {
          const storeWhatsApp = company.delivery_whatsapp.replace(/\D/g, "");
          window.open(`https://wa.me/${storeWhatsApp}?text=${encodeURIComponent(message)}`, "_blank");
        } else if (company.wapi_instance_id) {
          await sendWhatsAppOrder(company, message, customerData.phone);
        }
      }

      setCart([]);
      localStorage.removeItem(`cart_${company.id}`);
      onClose();
      navigate(`/${company.delivery_slug}/pedido/${sale.numeric_id ?? sale.id}`);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao finalizar pedido", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const deliveryOptions: { value: DeliveryType; label: string; icon: React.ComponentType<{ className?: string }>; time?: string }[] = isMesaMode
    ? [{ value: "dine_in", label: "Comer aqui", icon: UtensilsCrossed, time: mesaParams?.mesa }]
    : [
        { value: "delivery", label: "Entrega", icon: Truck, time: company.delivery_time },
        { value: "pickup", label: "Retirada", icon: Home, time: company.delivery_pickup_time },
      ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Finalizar Pedido
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Mesa banner */}
          {isMesaMode && mesaParams && (
            <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-4 py-3">
              <UtensilsCrossed className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="font-semibold text-primary text-sm">Pedido para a mesa</p>
                <p className="text-xs text-muted-foreground">{mesaParams.mesa} — seu pedido será adicionado à comanda</p>
              </div>
              <Badge className="ml-auto" variant="secondary">{mesaParams.mesa}</Badge>
            </div>
          )}

          {/* Tipo de entrega */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Tipo de Pedido</Label>
            <div className={`grid gap-3 ${deliveryOptions.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {deliveryOptions.map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => !isMesaMode && setDeliveryType(opt.value)}
                    disabled={isMesaMode}
                    className={`flex flex-col items-center p-4 rounded-lg border-2 transition-colors ${
                      deliveryType === opt.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    } ${isMesaMode ? "cursor-default" : ""}`}
                  >
                    <Icon className="w-6 h-6 mb-2" />
                    <span className="font-medium">{opt.label}</span>
                    {opt.time && <span className="text-xs text-muted-foreground">{opt.time}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dados do cliente */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Seus Dados</Label>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input id="name" placeholder="Seu nome completo" value={customerData.name} onChange={e => setCustomerData(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="phone">Telefone / WhatsApp *</Label>
                <Input id="phone" placeholder="(11) 99999-9999" type="tel" value={customerData.phone} onChange={handlePhoneChange} />
              </div>
            </div>
          </div>

          {/* Endereço (apenas entrega) */}
          {deliveryType === "delivery" && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Endereço de Entrega</Label>
              <div>
                <Label htmlFor="cep">CEP</Label>
                <Input id="cep" placeholder="00000-000" value={customerData.cep} onChange={handleCepChange} maxLength={9} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label htmlFor="street">Rua *</Label>
                  <Input id="street" placeholder="Rua" value={customerData.street} onChange={e => setCustomerData(p => ({ ...p, street: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="number">Número *</Label>
                  <Input id="number" placeholder="123" value={customerData.number} onChange={e => setCustomerData(p => ({ ...p, number: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="neighborhood">Bairro *</Label>
                  <Input id="neighborhood" placeholder="Bairro" value={customerData.neighborhood} onChange={e => setCustomerData(p => ({ ...p, neighborhood: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="city">Cidade</Label>
                  <Input id="city" placeholder="Cidade" value={customerData.city} onChange={e => setCustomerData(p => ({ ...p, city: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {/* Forma de pagamento */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Forma de Pagamento</Label>
            <RadioGroup value={selectedPayment} onValueChange={v => setSelectedPayment(v as PaymentMethod)}>
              <div className="space-y-2">
                {availablePayments.map(pm => {
                  const Icon = pm.icon;
                  return (
                    <div key={pm.id} className={`flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${selectedPayment === pm.id ? "border-primary bg-primary/5" : "border-border"}`} onClick={() => setSelectedPayment(pm.id)}>
                      <RadioGroupItem value={pm.id} id={pm.id} />
                      <Icon className="w-5 h-5 text-muted-foreground" />
                      <div className="flex-1">
                        <Label htmlFor={pm.id} className="cursor-pointer font-medium">{pm.name}</Label>
                        <p className="text-xs text-muted-foreground">{pm.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </RadioGroup>
          </div>

          {/* Troco (apenas dinheiro) */}
          {selectedPayment === "cash" && (
            <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="font-medium">Precisa de troco?</Label>
                <button
                  type="button"
                  onClick={() => { setNeedsChange(v => !v); setChangeFor(""); }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${needsChange ? "bg-primary" : "bg-muted-foreground/30"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${needsChange ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              {needsChange && (
                <div className="space-y-1">
                  <Label htmlFor="change-for" className="text-sm font-medium block">Troco para quanto? <span className="text-destructive">*</span></Label>
                  <Input
                    id="change-for"
                    placeholder="R$ 0,00"
                    inputMode="numeric"
                    value={changeFor}
                    onChange={handleChangeForInput}
                    className={parseChangeFor() > 0 && parseChangeFor() < total ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {parseChangeFor() > 0 && parseChangeFor() < total && (
                    <p className="text-xs text-destructive">O valor deve ser maior ou igual ao total do pedido ({total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}).</p>
                  )}
                  {parseChangeFor() >= total && parseChangeFor() > 0 && (
                    <p className="text-xs text-green-600 font-medium">Troco a devolver: {(parseChangeFor() - total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Observações */}
          <div>
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea id="notes" placeholder="Alguma observação sobre o pedido..." value={orderNotes} onChange={e => setOrderNotes(e.target.value)} className="min-h-[80px]" />
          </div>

          {/* Resumo */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {deliveryType === "delivery" && (
              <div className="flex justify-between text-sm">
                <span>Taxa de entrega</span>
                <span className={deliveryFee === 0 ? "text-green-600" : ""}>
                  {deliveryFee === 0 ? "Grátis" : formatCurrency(deliveryFee)}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <Button className="w-full h-12 text-base" onClick={handleCheckout} disabled={!canCheckout() || loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...</> : "Confirmar Pedido"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
