import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Package, Search, Phone, X } from "lucide-react";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useLocation } from "wouter";
import type { Store } from "@/types";

interface MyOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: Store;
}

interface Order {
  id: string;
  sequentialId: string;
  customerPhone: string;
  items: any[];
  total: number;
  status: string;
  createdAt: any;
  storeId: string;
}

export const MyOrdersModal = ({ isOpen, onClose, store }: MyOrdersModalProps) => {
  const [whatsApp, setWhatsApp] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [, setLocation] = useLocation();

  // Function to convert hex to HSL format
  const hexToHsl = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  // Function to apply theme colors
  const applyThemeColors = (store: Store) => {
    const root = document.documentElement;
    if (store.accentColor) {
      root.style.setProperty('--store-accent', store.accentColor);
      root.style.setProperty('--accent', `hsl(${hexToHsl(store.accentColor)})`);
    }
  };

  // Apply theme colors when modal opens
  useEffect(() => {
    if (isOpen && store) {
      applyThemeColors(store);
    }
  }, [isOpen, store]);

  const searchOrders = async () => {
    if (!whatsApp.trim()) return;
    
    console.log('🔍 Iniciando busca de pedidos...');
    console.log('📱 WhatsApp original:', whatsApp);
    
    setLoading(true);
    try {
      // Clean WhatsApp number (remove formatting)
      const cleanWhatsApp = whatsApp.replace(/\D/g, '');
      const formattedWhatsApp = whatsApp.trim();
      console.log('📱 WhatsApp limpo:', cleanWhatsApp);
      console.log('📱 WhatsApp formatado:', formattedWhatsApp);
      console.log('🏪 ID da loja:', store.id);
      
      // Search for both clean and formatted phone numbers
      const cleanPhoneQuery = query(
        collection(db, "orders"),
        where("storeId", "==", store.id),
        where("customerPhone", "==", cleanWhatsApp)
      );
      
      const formattedPhoneQuery = query(
        collection(db, "orders"),
        where("storeId", "==", store.id),
        where("customerPhone", "==", formattedWhatsApp)
      );
      
      console.log('🔍 Executando consultas no Firebase...');
      const [cleanQuerySnapshot, formattedQuerySnapshot] = await Promise.all([
        getDocs(cleanPhoneQuery),
        getDocs(formattedPhoneQuery)
      ]);
      
      console.log('📊 Documentos encontrados (número limpo):', cleanQuerySnapshot.docs.length);
      console.log('📊 Documentos encontrados (número formatado):', formattedQuerySnapshot.docs.length);
      
      // Combine results and remove duplicates
      const allDocs = new Map();
      
      cleanQuerySnapshot.docs.forEach(doc => {
        allDocs.set(doc.id, { id: doc.id, ...doc.data() });
      });
      
      formattedQuerySnapshot.docs.forEach(doc => {
        allDocs.set(doc.id, { id: doc.id, ...doc.data() });
      });
      
      const ordersData = Array.from(allDocs.values()) as Order[];
      
      if (ordersData.length > 0) {
        ordersData.forEach((order, index) => {
          console.log(`📄 Pedido ${index + 1}:`, order.id, order);
        });
      }
      
      // Sort by creation date (most recent first) and limit to 10
      const sortedOrders = ordersData
        .sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 5);
      
      console.log('✅ Pedidos encontrados total:', ordersData.length);
      console.log('✅ Pedidos processados (limitados a 5):', sortedOrders.length);
      
      if (sortedOrders.length > 0) {
        console.log('📅 Primeiro pedido (mais recente):', 
          sortedOrders[0]?.id, 
          'Data:', sortedOrders[0]?.createdAt?.toDate ? 
            sortedOrders[0].createdAt.toDate().toLocaleString('pt-BR') : 
            new Date(sortedOrders[0]?.createdAt).toLocaleString('pt-BR')
        );
        console.log('📅 Último pedido (mais antigo):', 
          sortedOrders[sortedOrders.length - 1]?.id, 
          'Data:', sortedOrders[sortedOrders.length - 1]?.createdAt?.toDate ? 
            sortedOrders[sortedOrders.length - 1].createdAt.toDate().toLocaleString('pt-BR') : 
            new Date(sortedOrders[sortedOrders.length - 1]?.createdAt).toLocaleString('pt-BR')
        );
      }
      setOrders(sortedOrders);
      setSearched(true);
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
      setOrders([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const formatWhatsApp = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return numbers.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      pending: { label: 'Pendente', color: 'bg-yellow-500' },
      confirmed: { label: 'Confirmado', color: 'bg-blue-500' },
      preparing: { label: 'Preparando', color: 'bg-orange-500' },
      ready: { label: 'Pronto', color: 'bg-purple-500' },
      waiting_pickup: { label: 'Aguardando Coleta', color: 'bg-yellow-500' },
      out_for_delivery: { label: 'Em Rota', color: 'bg-blue-500' },
      delivered: { label: 'Entregue', color: 'bg-green-500' },
      picked_up: { label: 'Retirado', color: 'bg-green-500' },
      cancelled: { label: 'Cancelado', color: 'bg-red-500' }
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || { label: status, color: 'bg-gray-500' };
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  const handleOrderClick = (sequentialId: string) => {
    setLocation(`/order/${sequentialId}`);
    handleClose();
  };

  const handleClose = () => {
    setWhatsApp("");
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
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* WhatsApp Input */}
          <div className="flex-shrink-0 space-y-3">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Phone className="w-4 h-4" />
              <span className="hidden sm:inline">Digite seu WhatsApp para consultar seus pedidos</span>
              <span className="sm:hidden">WhatsApp para consultar pedidos</span>
            </div>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <Input
                placeholder="(11) 99999-9999"
                type="tel"
                inputMode="numeric"
                value={whatsApp}
                onChange={(e) => setWhatsApp(formatWhatsApp(e.target.value))}
                maxLength={20}
                className="focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  '--tw-ring-color': store.accentColor || '#3b82f6',
                  '--tw-border-opacity': '1'
                } as React.CSSProperties}
                onFocus={(e) => {
                  if (store.accentColor) {
                    e.target.style.borderColor = store.accentColor;
                    e.target.style.boxShadow = `0 0 0 2px ${store.accentColor}40`;
                  }
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '';
                  e.target.style.boxShadow = '';
                }}
                data-testid="input-whatsapp"
              />
              <Button
                onClick={searchOrders}
                disabled={loading || !whatsApp.trim()}
                className="w-full sm:w-auto flex-shrink-0"
                data-testid="button-search-orders"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span className="ml-2">Buscar</span>
              </Button>
            </div>
          </div>

          {/* Orders List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Buscando pedidos...</span>
              </div>
            ) : searched ? (
              orders.length > 0 ? (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <Card key={order.id}>
                      <CardContent 
                        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleOrderClick(order.sequentialId)}
                        data-testid={`card-order-${order.id}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-medium text-foreground">
                              Pedido #{order.sequentialId}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(order.createdAt)}
                            </p>
                          </div>
                          {getStatusBadge(order.status)}
                        </div>
                        
                        <Separator className="my-3" />
                        
                        <div className="space-y-2 mb-3">
                          {order.items?.map((item, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span>{item.quantity}x {item.name}</span>
                              <span>R$ {item.totalPrice?.toFixed(2).replace('.', ',')}</span>
                            </div>
                          ))}
                        </div>
                        
                        <Separator className="my-3" />
                        
                        <div className="flex justify-between font-medium">
                          <span>Total</span>
                          <span>R$ {order.total?.toFixed(2).replace('.', ',')}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Nenhum pedido encontrado
                  </h3>
                  <p className="text-muted-foreground">
                    Não encontramos pedidos para este WhatsApp em nossa loja.
                  </p>
                </div>
              )
            ) : (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Consulte seus pedidos
                </h3>
                <p className="text-muted-foreground">
                  Digite seu WhatsApp para ver o histórico dos seus últimos 5 pedidos.
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};