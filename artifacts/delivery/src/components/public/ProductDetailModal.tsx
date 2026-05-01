import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { X, Plus, Minus, Clock } from "lucide-react";
import type { Product, ProductAddon } from "@/types";
import { getEffectivePrice, isPromotionActive } from "@/lib/supabase-service";

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  onAddToCart: (quantity: number, selectedAddons: ProductAddon[], weight?: number) => void;
  isStoreOpen: boolean;
  primaryColor?: string;
}

export const ProductDetailModal = ({ isOpen, onClose, product, onAddToCart, isStoreOpen, primaryColor = "#6d28d9" }: ProductDetailModalProps) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<ProductAddon[]>([]);
  const [closeHovered, setCloseHovered] = useState(false);
  const [weight, setWeight] = useState(0.5);

  const isWeighted = product.stock_unit === "kg" || product.stock_unit === "g";
  const inPromo = isPromotionActive(product);
  const currentPrice = getEffectivePrice(product);
  const originalPrice = product.sale_price;
  const discountPct = inPromo && product.promotion_price
    ? Math.round(((originalPrice - product.promotion_price) / originalPrice) * 100)
    : 0;

  const handleAddonToggle = (addon: ProductAddon) => {
    setSelectedAddons(prev => {
      const exists = prev.find(a => a.id === addon.id);
      return exists ? prev.filter(a => a.id !== addon.id) : [...prev, addon];
    });
  };

  const addonsTotal = selectedAddons.reduce((t, a) => t + a.price, 0);

  const calculateTotal = () => {
    if (isWeighted) return (currentPrice * weight + addonsTotal) * quantity;
    return (currentPrice + addonsTotal) * quantity;
  };

  const handleAddToCart = () => {
    onAddToCart(quantity, selectedAddons, isWeighted ? weight : undefined);
    onClose();
    setQuantity(1);
    setSelectedAddons([]);
    setWeight(0.5);
  };

  const formatWeight = (w: number) => `${w.toFixed(3).replace(".", ",")}${product.stock_unit}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent hideCloseButton className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Detalhes do Produto
            <button
              onClick={onClose}
              className="rounded-md p-2 transition-colors"
              onMouseEnter={() => setCloseHovered(true)}
              onMouseLeave={() => setCloseHovered(false)}
              style={closeHovered ? { color: primaryColor, backgroundColor: `${primaryColor}1a` } : {}}
            >
              <X className="w-4 h-4" />
            </button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="relative">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-48 object-cover rounded-lg" />
            ) : (
              <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
                <span className="text-muted-foreground text-4xl font-bold">{product.name.charAt(0)}</span>
              </div>
            )}
            {inPromo && (
              <Badge className="absolute top-2 right-2 bg-red-500 text-white">-{discountPct}%</Badge>
            )}
          </div>

          <div>
            <h3 className="text-xl font-bold text-foreground mb-2">{product.name}</h3>
            {product.description && <p className="text-muted-foreground mb-4">{product.description}</p>}
            <div className="flex items-center space-x-2 mb-4">
              {inPromo && (
                <span className="text-lg text-muted-foreground line-through">
                  R$ {originalPrice.toFixed(2).replace(".", ",")}
                </span>
              )}
              <span className="text-2xl font-bold text-foreground">
                R$ {currentPrice.toFixed(2).replace(".", ",")}
              </span>
              <span className="text-sm text-muted-foreground">/{product.stock_unit}</span>
            </div>
          </div>

          {isWeighted && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Peso ({product.stock_unit})</label>
              <div className="flex items-center space-x-4">
                <Button size="icon" variant="outline" onClick={() => setWeight(Math.max(0.1, weight - 0.1))} disabled={weight <= 0.1}><Minus className="w-4 h-4" /></Button>
                <span className="text-lg font-medium min-w-[80px] text-center">{formatWeight(weight)}</span>
                <Button size="icon" variant="outline" onClick={() => setWeight(weight + 0.1)}><Plus className="w-4 h-4" /></Button>
              </div>
            </div>
          )}

          {product.product_addons && product.product_addons.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-foreground mb-3">Adicionais</h4>
              <div className="space-y-2">
                {[...product.product_addons].sort((a, b) => a.sort_order - b.sort_order).map(addon => (
                  <div
                    key={addon.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedAddons.find(a => a.id === addon.id) ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                    onClick={() => handleAddonToggle(addon)}
                  >
                    <span className="font-medium text-foreground">{addon.name}</span>
                    <span className="font-bold text-foreground">+ R$ {addon.price.toFixed(2).replace(".", ",")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isWeighted && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Quantidade</label>
              <div className="flex items-center space-x-4">
                <Button size="icon" variant="outline" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}><Minus className="w-4 h-4" /></Button>
                <span className="text-lg font-medium min-w-[40px] text-center">{quantity}</span>
                <Button size="icon" variant="outline" onClick={() => setQuantity(quantity + 1)}><Plus className="w-4 h-4" /></Button>
              </div>
            </div>
          )}

          <div className="border-t border-border pt-4">
            {!isStoreOpen && (
              <div className="flex items-center space-x-2 text-yellow-600 mb-4">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Loja fechada — não é possível fazer pedidos</span>
              </div>
            )}
            <Separator className="mb-4" />
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold text-foreground">Total</span>
              <span className="text-2xl font-bold text-foreground">R$ {calculateTotal().toFixed(2).replace(".", ",")}</span>
            </div>
            <Button className="w-full" onClick={handleAddToCart} disabled={!isStoreOpen}>
              Adicionar ao Carrinho
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
