import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Package, Search, Phone, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Company, Sale } from "@/types";

interface MyOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  completed: { label: "Concluído", color: "bg-green-500" },
  cancelled: { label: "Cancelado", color: "bg-red-500" },
  refunded: { label: "Reembolsado", color: "bg-orange-500" },
};

export const MyOrdersModal = ({ isOpen, onClose, company }: MyOrdersModalProps) => {
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) return numbers.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    return numbers.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, "+$1 ($2) $3-$4");
  };

  const searchOrders = async () => {
    if (!phone.trim()) return;
    setLoading(true);

    try {
      const cleanPhone = phone.replace(/\D/g, "");

      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          sale_items (
            id, product_name, quantity, unit_price, subtotal, addons
          )
        `)
        .eq("company_id", company.id)
        .ilike("notes", `%${cleanPhone}%`)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error searching orders:", error);
        setOrders([]);
      } else {
        setOrders((data || []) as Sale[]);
      }
    } catch (err) {
      console.error("Error:", err);
      setOrders([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  const handleClose = () => {
    setPhone("");
    setOrders([]);
    setSearched(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Package className="w-5 h-5 mr-2" />
              Meus Pedidos
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose}><X className="w-4 h-4" /></Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex-shrink-0 space-y-3">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Phone className="w-4 h-4" />
              <span>Digite seu telefone para consultar pedidos</span>
            </div>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <Input
                placeholder="(11) 99999-9999"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={e => setPhone(formatPhone(e.target.value))}
                maxLength={20}
                onKeyDown={e => e.key === "Enter" && searchOrders()}
              />
              <Button onClick={searchOrders} disabled={loading || !phone.trim()} className="w-full sm:w-auto">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="ml-2">Buscar</span>
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : searched ? (
              orders.length > 0 ? (
                <div className="space-y-4">
                  {orders.map(order => {
                    const status = STATUS_MAP[order.status] || { label: order.status, color: "bg-gray-500" };
                    return (
                      <Card key={order.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-medium text-foreground">
                                Pedido #{order.numeric_id || order.id.slice(0, 8)}
                              </h3>
                              <p className="text-sm text-muted-foreground">{formatDate(order.created_at)}</p>
                            </div>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${status.color}`}>
                              {status.label}
                            </span>
                          </div>

                          <Separator className="my-3" />

                          <div className="space-y-1 mb-3">
                            {order.sale_items?.map((item, i) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span>{item.quantity}x {item.product_name}</span>
                                <span>R$ {item.subtotal.toFixed(2).replace(".", ",")}</span>
                              </div>
                            ))}
                          </div>

                          <Separator className="my-3" />

                          <div className="flex justify-between font-medium">
                            <span>Total</span>
                            <span>R$ {order.total.toFixed(2).replace(".", ",")}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum pedido encontrado</h3>
                  <p className="text-muted-foreground">Verifique o número informado e tente novamente.</p>
                </div>
              )
            ) : (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Informe seu telefone para buscar seus pedidos</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
