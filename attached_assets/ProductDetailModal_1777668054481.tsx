import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { X, Plus, Minus, Clock, Users } from "lucide-react";
import type { Product, ProductAddon } from "@/types";

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  onAddToCart: (quantity: number, selectedAddons: ProductAddon[], weight?: number) => void;
  isStoreOpen: boolean;
}

export const ProductDetailModal = ({ 
  isOpen, 
  onClose, 
  product, 
  onAddToCart, 
  isStoreOpen 
}: ProductDetailModalProps) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<ProductAddon[]>([]);
  const [weight, setWeight] = useState<number>(0.5); // For kg/g products

  // Format weight display with Brazilian formatting (always 3 decimal places)
  const formatWeight = (weightValue: number, unit: string) => {
    const formattedNumber = weightValue.toFixed(3).replace('.', ',');
    return `${formattedNumber}${unit}`;
  };

  // Check if promotion is active
  const isPromotionActive = () => {
    if (!product.isOnPromotion || !product.promotionStartDate || !product.promotionEndDate) {
      return false;
    }
    
    const now = new Date();
    // Handle Firebase Timestamp if needed
    let startDate: Date;
    let endDate: Date;
    
    if (typeof product.promotionStartDate === 'string') {
      startDate = new Date(product.promotionStartDate);
    } else if (product.promotionStartDate instanceof Date) {
      startDate = product.promotionStartDate;
    } else {
      // Firebase Timestamp
      startDate = new Date((product.promotionStartDate as any).seconds * 1000);
    }
    
    if (typeof product.promotionEndDate === 'string') {
      endDate = new Date(product.promotionEndDate);
    } else if (product.promotionEndDate instanceof Date) {
      endDate = product.promotionEndDate;
    } else {
      // Firebase Timestamp
      endDate = new Date((product.promotionEndDate as any).seconds * 1000);
    }
    
    return now >= startDate && now <= endDate;
  };

  const currentPrice = isPromotionActive() && product.promotionPrice 
    ? product.promotionPrice 
    : product.price;

  const discountPercentage = isPromotionActive() && product.promotionPrice 
    ? Math.round(((product.price - product.promotionPrice) / product.price) * 100)
    : 0;

  const handleAddonToggle = (addon: ProductAddon) => {
    setSelectedAddons(prev => {
      const exists = prev.find(a => a.id === addon.id);
      if (exists) {
        return prev.filter(a => a.id !== addon.id);
      } else {
        return [...prev, addon];
      }
    });
  };

  const addonsTotal = selectedAddons.reduce((total, addon) => total + addon.price, 0);
  
  const calculateTotal = () => {
    if (product.unit === 'kg' || product.unit === 'g') {
      return (currentPrice * weight + addonsTotal) * quantity;
    }
    return (currentPrice + addonsTotal) * quantity;
  };

  const handleAddToCart = () => {
    if (product.unit === 'kg' || product.unit === 'g') {
      onAddToCart(quantity, selectedAddons, weight);
    } else {
      onAddToCart(quantity, selectedAddons);
    }
    onClose();
    // Reset values
    setQuantity(1);
    setSelectedAddons([]);
    setWeight(0.5);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Detalhes do Produto
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product Image */}
          <div className="relative">
            {product.imageUrl ? (
              <img 
                src={product.imageUrl} 
                alt={product.name}
                className="w-full h-48 object-cover rounded-lg"
              />
            ) : (
              <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
                <span className="text-muted-foreground text-2xl font-medium">
                  {product.name.charAt(0)}
                </span>
              </div>
            )}
            
            {/* Promotion badge */}
            {isPromotionActive() && (
              <Badge className="absolute top-2 right-2 bg-red-500 text-white">
                -{discountPercentage}%
              </Badge>
            )}
          </div>

          {/* Product Info */}
          <div>
            <h3 className="text-xl font-bold text-foreground mb-2" data-testid="text-product-name">
              {product.name}
            </h3>
            <p className="text-muted-foreground mb-4">
              {product.description}
            </p>

            {/* Price */}
            <div className="flex items-center space-x-2 mb-4">
              {isPromotionActive() && product.promotionPrice && (
                <span className="text-lg text-muted-foreground line-through">
                  R$ {product.price.toFixed(2).replace('.', ',')}
                </span>
              )}
              <span className="text-2xl font-bold text-foreground">
                R$ {currentPrice.toFixed(2).replace('.', ',')}
              </span>
              <span className="text-sm text-muted-foreground">
                /{product.unit}
              </span>
            </div>

            {/* Serving size */}
            {product.servingSize && (
              <div className="flex items-center space-x-1 text-sm text-muted-foreground mb-4">
                <Users className="w-4 h-4" />
                <span>Serve {product.servingSize} pessoa{product.servingSize > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* Weight selection for kg/g products */}
          {(product.unit === 'kg' || product.unit === 'g') && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Peso ({product.unit})
              </label>
              <div className="flex items-center space-x-4">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setWeight(Math.max(0.1, weight - 0.1))}
                  disabled={weight <= 0.1}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-lg font-medium min-w-[60px] text-center">
                  {formatWeight(weight, product.unit)}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setWeight(weight + 0.1)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Add-ons */}
          {product.hasAddons && product.addons.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-foreground mb-3">Adicionais</h4>
              <div className="space-y-2">
                {product.addons.map((addon) => (
                  <div
                    key={addon.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedAddons.find(a => a.id === addon.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                    onClick={() => handleAddonToggle(addon)}
                  >
                    <div>
                      <span className="font-medium text-foreground">{addon.name}</span>
                    </div>
                    <span className="font-bold text-foreground">
                      + R$ {addon.price.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quantity - only for non-weight products */}
          {product.unit !== 'kg' && product.unit !== 'g' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Quantidade
              </label>
              <div className="flex items-center space-x-4">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-lg font-medium min-w-[40px] text-center">
                  {quantity}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Footer with total and add button */}
          <div className="border-t border-border pt-4">
            {/* Store closed notice */}
            {!isStoreOpen && (
              <div className="flex items-center space-x-2 text-yellow-600 mb-4">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Loja fechada - não é possível fazer pedidos</span>
              </div>
            )}

            <Separator className="mb-4" />
            
            {/* Total */}
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold text-foreground">Total</span>
              <span className="text-2xl font-bold text-foreground">
                R$ {calculateTotal().toFixed(2).replace('.', ',')}
              </span>
            </div>

            <Button
              className="w-full"
              onClick={handleAddToCart}
              disabled={!isStoreOpen}
              data-testid="button-add-to-cart"
            >
              Adicionar ao Carrinho
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};