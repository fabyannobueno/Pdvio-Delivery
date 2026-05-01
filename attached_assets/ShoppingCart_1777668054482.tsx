import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { X, Plus, Minus, ShoppingBag } from "lucide-react";
import type { Store, CartItem } from "@/types";

interface ShoppingCartProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  setCart: (cart: CartItem[]) => void;
  store: Store;
  onCheckout: () => void;
}

export const ShoppingCart = ({ isOpen, onClose, cart, setCart, store, onCheckout }: ShoppingCartProps) => {
  // Format weight display with Brazilian formatting (always 3 decimal places)
  const formatWeight = (weightValue: number, unit: string) => {
    const formattedNumber = weightValue.toFixed(3).replace('.', ',');
    return `${formattedNumber}${unit}`;
  };
  const updateQuantity = (productId: string, selectedAddons: any[], change: number) => {
    setCart(cart.map(item => {
      if (item.productId === productId && JSON.stringify(item.selectedAddons) === JSON.stringify(selectedAddons)) {
        const newQuantity = Math.max(0, item.quantity + change);
        if (newQuantity === 0) {
          return null;
        }
        const addonsTotal = item.selectedAddons.reduce((total, addon) => total + addon.price, 0);
        const basePrice = item.weight ? item.price * item.weight : item.price;
        const newTotalPrice = (basePrice + addonsTotal) * newQuantity;
        return {
          ...item,
          quantity: newQuantity,
          totalPrice: newTotalPrice
        };
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  const updateWeight = (productId: string, selectedAddons: any[], change: number) => {
    setCart(cart.map(item => {
      if (item.productId === productId && JSON.stringify(item.selectedAddons) === JSON.stringify(selectedAddons)) {
        const newWeight = Math.max(0.1, (item.weight || 0.5) + change);
        const addonsTotal = item.selectedAddons.reduce((total, addon) => total + addon.price, 0);
        const newTotalPrice = (item.price * newWeight + addonsTotal) * item.quantity;
        return {
          ...item,
          weight: newWeight,
          totalPrice: newTotalPrice
        };
      }
      return item;
    }));
  };

  const removeItem = (productId: string, selectedAddons: any[]) => {
    setCart(cart.filter(item => !(item.productId === productId && JSON.stringify(item.selectedAddons) === JSON.stringify(selectedAddons))));
  };

  const subtotal = cart.reduce((total, item) => total + item.totalPrice, 0);
  const isUnderMinimum = subtotal < store.minimumOrder;
  const missingAmount = store.minimumOrder - subtotal;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md h-[100dvh] max-h-[100dvh] sm:h-[100vh] sm:max-h-[100vh] overflow-hidden flex flex-col p-0">
        <SheetHeader className="flex-shrink-0 p-6 pb-0">
          <SheetTitle className="flex items-center justify-between">
            Seu Carrinho
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col flex-1 min-h-0">
          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {cart.length > 0 ? (
              <div className="space-y-4">
                {cart.map((item, index) => (
                  <div key={`${item.productId}-${index}`} className="flex items-center space-x-4 p-4 bg-muted/30 rounded-lg">
                    <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                      {item.imageUrl ? (
                        <img 
                          src={item.imageUrl} 
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <span className="text-muted-foreground font-medium">
                            {item.name.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground truncate" data-testid={`text-cart-item-${item.productId}`}>
                        {item.name}
                      </h4>
                      {item.selectedAddons && item.selectedAddons.length > 0 && (
                        <div className="text-xs text-muted-foreground mb-1">
                          {item.selectedAddons.map(addon => `${addon.name} (+R$ ${addon.price.toFixed(2).replace('.', ',')})`).join(', ')}
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {item.weight ? formatWeight(item.weight, item.unit) : `${item.quantity} ${item.unit}`}
                      </p>
                      <p className="text-lg font-bold text-foreground">
                        R$ {item.totalPrice.toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                    <div className="flex flex-col items-center space-y-2">
                      {/* Weight controls for kg/g products */}
                      {(item.unit === 'kg' || item.unit === 'g') && item.weight ? (
                        <div className="flex items-center space-x-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="w-8 h-8"
                            onClick={() => updateWeight(item.productId, item.selectedAddons, -0.1)}
                            disabled={(item.weight || 0.5) <= 0.1}
                            data-testid={`button-decrease-weight-${item.productId}`}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-16 text-center font-medium text-xs" data-testid={`text-weight-${item.productId}`}>
                            {formatWeight(item.weight, item.unit)}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="w-8 h-8"
                            onClick={() => updateWeight(item.productId, item.selectedAddons, 0.1)}
                            data-testid={`button-increase-weight-${item.productId}`}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        /* Quantity controls for unit products */
                        <div className="flex items-center space-x-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="w-8 h-8"
                            onClick={() => updateQuantity(item.productId, item.selectedAddons, -1)}
                            data-testid={`button-decrease-${item.productId}`}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-8 text-center font-medium" data-testid={`text-quantity-${item.productId}`}>
                            {item.quantity}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="w-8 h-8"
                            onClick={() => updateQuantity(item.productId, item.selectedAddons, 1)}
                            data-testid={`button-increase-${item.productId}`}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 h-8"
                        onClick={() => removeItem(item.productId, item.selectedAddons)}
                        data-testid={`button-remove-${item.productId}`}
                      >
                        Remover
                      </Button>
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

          {/* Footer with subtotal and checkout button */}
          {cart.length > 0 && (
            <div className="flex-shrink-0 border-t border-border px-6 py-4 pb-6 space-y-3 bg-background safe-area-inset-bottom">
              <div className="flex justify-between text-lg font-bold text-foreground">
                <span>Subtotal</span>
                <span data-testid="text-subtotal">R$ {subtotal.toFixed(2).replace('.', ',')}</span>
              </div>

              {isUnderMinimum && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg" data-testid="text-minimum-order-warning">
                  Valor mínimo do pedido: R$ {store.minimumOrder.toFixed(2).replace('.', ',')}
                  <br />
                  Faltam R$ {missingAmount.toFixed(2).replace('.', ',')} para atingir o mínimo
                </div>
              )}

              <Button
                className="w-full"
                onClick={onCheckout}
                disabled={cart.length === 0 || isUnderMinimum}
                data-testid="button-checkout"
              >
                Finalizar Pedido
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};