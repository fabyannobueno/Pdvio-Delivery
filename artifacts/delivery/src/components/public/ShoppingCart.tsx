import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { X, Plus, Minus, ShoppingBag } from "lucide-react";
import type { Company, CartItem } from "@/types";
import { formatCurrency } from "@/lib/supabase-service";

interface ShoppingCartProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  setCart: (cart: CartItem[]) => void;
  company: Company;
  onCheckout: () => void;
}

export const ShoppingCart = ({ isOpen, onClose, cart, setCart, company, onCheckout }: ShoppingCartProps) => {
  const updateQuantity = (productId: string, addons: CartItem["selectedAddons"], change: number) => {
    setCart(
      cart
        .map(item => {
          if (item.productId === productId && JSON.stringify(item.selectedAddons) === JSON.stringify(addons)) {
            const newQty = Math.max(0, item.quantity + change);
            if (newQty === 0) return null as unknown as CartItem;
            const addonsTotal = item.selectedAddons.reduce((t, a) => t + a.price, 0);
            const basePrice = item.weight ? item.price * item.weight : item.price;
            return { ...item, quantity: newQty, totalPrice: (basePrice + addonsTotal) * newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const updateWeight = (productId: string, addons: CartItem["selectedAddons"], change: number) => {
    setCart(cart.map(item => {
      if (item.productId === productId && JSON.stringify(item.selectedAddons) === JSON.stringify(addons)) {
        const newWeight = Math.max(0.1, (item.weight || 0.5) + change);
        const addonsTotal = item.selectedAddons.reduce((t, a) => t + a.price, 0);
        return { ...item, weight: newWeight, totalPrice: (item.price * newWeight + addonsTotal) * item.quantity };
      }
      return item;
    }));
  };

  const removeItem = (productId: string, addons: CartItem["selectedAddons"]) => {
    setCart(cart.filter(i => !(i.productId === productId && JSON.stringify(i.selectedAddons) === JSON.stringify(addons))));
  };

  const subtotal = cart.reduce((t, i) => t + i.totalPrice, 0);
  const minOrder = company.delivery_min_order || 0;
  const isUnderMinimum = subtotal < minOrder;
  const missingAmount = minOrder - subtotal;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col p-0 [&>button:first-child]:hidden">
        <SheetHeader className="flex-shrink-0 p-6 pb-0">
          <SheetTitle className="flex items-center justify-between">
            Seu Carrinho
            <button
              onClick={onClose}
              className="rounded-md p-2 transition-colors"
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.color = "hsl(var(--primary))";
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "hsl(var(--primary) / 0.1)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.color = "";
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "";
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {cart.length > 0 ? (
              <div className="space-y-4">
                {cart.map((item, index) => (
                  <div key={`${item.productId}-${index}`} className="flex items-center space-x-4 p-4 bg-muted/30 rounded-lg">
                    <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <span className="text-muted-foreground font-medium">{item.name.charAt(0)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground truncate">{item.name}</h4>
                      {item.selectedAddons?.length > 0 && (
                        <div className="text-xs text-muted-foreground mb-1">
                          {item.selectedAddons.map(a => `${a.name} (+R$ ${a.price.toFixed(2).replace(".", ",")})`).join(", ")}
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {item.weight ? `${item.weight.toFixed(3).replace(".", ",")}${item.unit}` : `${item.quantity} ${item.unit}`}
                      </p>
                      <p className="text-lg font-bold text-foreground">R$ {item.totalPrice.toFixed(2).replace(".", ",")}</p>
                    </div>
                    <div className="flex flex-col items-center space-y-2">
                      {(item.unit === "kg" || item.unit === "g") && item.weight ? (
                        <div className="flex items-center space-x-2">
                          <Button size="icon" variant="outline" className="w-8 h-8" onClick={() => updateWeight(item.productId, item.selectedAddons, -0.1)} disabled={(item.weight || 0.5) <= 0.1}><Minus className="w-3 h-3" /></Button>
                          <span className="w-16 text-center font-medium text-xs">{item.weight.toFixed(3).replace(".", ",")}kg</span>
                          <Button size="icon" variant="outline" className="w-8 h-8" onClick={() => updateWeight(item.productId, item.selectedAddons, 0.1)}><Plus className="w-3 h-3" /></Button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Button size="icon" variant="outline" className="w-8 h-8" onClick={() => updateQuantity(item.productId, item.selectedAddons, -1)}><Minus className="w-3 h-3" /></Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button size="icon" variant="outline" className="w-8 h-8" onClick={() => updateQuantity(item.productId, item.selectedAddons, 1)}><Plus className="w-3 h-3" /></Button>
                        </div>
                      )}
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 h-8" onClick={() => removeItem(item.productId, item.selectedAddons)}>Remover</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Carrinho vazio</h3>
                <p className="text-muted-foreground">Adicione produtos ao seu carrinho para continuar</p>
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="flex-shrink-0 border-t border-border px-6 py-4 pb-6 space-y-3 bg-background">
              <div className="flex justify-between text-lg font-bold text-foreground">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {isUnderMinimum && minOrder > 0 && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  Valor mínimo do pedido: {formatCurrency(minOrder)}<br />
                  Faltam {formatCurrency(missingAmount)} para atingir o mínimo
                </div>
              )}
              <Button className="w-full" onClick={onCheckout} disabled={cart.length === 0 || isUnderMinimum}>
                Finalizar Pedido
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
