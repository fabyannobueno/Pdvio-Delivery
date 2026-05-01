import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { Product } from "@/types";

interface WeightCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  onAddToCart: (weight: number) => void;
}

export const WeightCalculator = ({ isOpen, onClose, product, onAddToCart }: WeightCalculatorProps) => {
  const [displayWeight, setDisplayWeight] = useState("0.500");
  const [inputBuffer, setInputBuffer] = useState("");

  useEffect(() => {
    if (isOpen) {
      setDisplayWeight("0.500");
      setInputBuffer("");
    }
  }, [isOpen]);

  const handleNumberInput = (digit: string) => {
    if (digit === ".") {
      if (!inputBuffer.includes(".")) {
        setInputBuffer(inputBuffer + digit);
      }
    } else {
      const newBuffer = inputBuffer + digit;
      const value = parseFloat(newBuffer);
      
      if (!isNaN(value) && value <= 999.999) {
        setInputBuffer(newBuffer);
        setDisplayWeight(newBuffer);
      }
    }
  };

  const handleClear = () => {
    setInputBuffer("");
    setDisplayWeight("0");
  };

  const handleBackspace = () => {
    if (inputBuffer.length > 0) {
      const newBuffer = inputBuffer.slice(0, -1);
      setInputBuffer(newBuffer);
      setDisplayWeight(newBuffer || "0");
    }
  };

  const setPresetWeight = (weight: number) => {
    const weightStr = weight.toString();
    setInputBuffer(weightStr);
    setDisplayWeight(weightStr);
  };

  const handleAddToCart = () => {
    const weight = parseFloat(displayWeight);
    if (weight > 0) {
      onAddToCart(weight);
    }
  };

  const currentWeight = parseFloat(displayWeight) || 0;
  const totalPrice = currentWeight * product.price;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              <div>{product.name}</div>
              <div className="text-sm font-normal text-muted-foreground">
                R$ {product.price.toFixed(2).replace('.', ',')} por kg
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Weight Display */}
          <div className="text-center">
            <div className="text-4xl font-bold text-foreground mb-2" data-testid="text-display-weight">
              {displayWeight}
            </div>
            <div className="text-lg text-muted-foreground">kg</div>
          </div>

          {/* Calculator Grid */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
              <Button
                key={number}
                variant="outline"
                className="h-12 font-medium"
                onClick={() => handleNumberInput(number.toString())}
                data-testid={`button-number-${number}`}
              >
                {number}
              </Button>
            ))}
            <Button
              variant="outline"
              className="h-12 font-medium"
              onClick={() => handleNumberInput(".")}
              data-testid="button-decimal"
            >
              .
            </Button>
            <Button
              variant="outline"
              className="h-12 font-medium"
              onClick={() => handleNumberInput("0")}
              data-testid="button-number-0"
            >
              0
            </Button>
            <Button
              variant="outline"
              className="h-12 font-medium text-destructive hover:text-destructive"
              onClick={handleBackspace}
              data-testid="button-backspace"
            >
              ⌫
            </Button>
          </div>

          {/* Weight Presets */}
          <div className="grid grid-cols-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPresetWeight(0.25)}
              data-testid="button-preset-025"
            >
              250g
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPresetWeight(0.5)}
              data-testid="button-preset-05"
            >
              500g
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPresetWeight(1.0)}
              data-testid="button-preset-1"
            >
              1kg
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPresetWeight(1.5)}
              data-testid="button-preset-15"
            >
              1,5kg
            </Button>
          </div>

          {/* Price Display */}
          <div className="bg-muted/30 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Preço total</p>
            <p className="text-2xl font-bold text-foreground" data-testid="text-total-price">
              R$ {totalPrice.toFixed(2).replace('.', ',')}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={handleClear}
              data-testid="button-clear"
            >
              Limpar
            </Button>
            <Button 
              className="flex-1"
              onClick={handleAddToCart}
              disabled={currentWeight <= 0}
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
