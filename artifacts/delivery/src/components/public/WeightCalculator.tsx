import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { Product } from "@/types";
import { getEffectivePrice } from "@/lib/supabase-service";

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
    if (isOpen) { setDisplayWeight("0.500"); setInputBuffer(""); }
  }, [isOpen]);

  const handleNumberInput = (digit: string) => {
    if (digit === ".") {
      if (!inputBuffer.includes(".")) setInputBuffer(inputBuffer + digit);
    } else {
      const newBuffer = inputBuffer + digit;
      const value = parseFloat(newBuffer);
      if (!isNaN(value) && value <= 999.999) { setInputBuffer(newBuffer); setDisplayWeight(newBuffer); }
    }
  };

  const handleClear = () => { setInputBuffer(""); setDisplayWeight("0"); };
  const handleBackspace = () => {
    if (inputBuffer.length > 0) {
      const nb = inputBuffer.slice(0, -1);
      setInputBuffer(nb);
      setDisplayWeight(nb || "0");
    }
  };
  const setPresetWeight = (w: number) => { setInputBuffer(w.toString()); setDisplayWeight(w.toString()); };

  const currentWeight = parseFloat(displayWeight) || 0;
  const price = getEffectivePrice(product);
  const totalPrice = currentWeight * price;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              <div>{product.name}</div>
              <div className="text-sm font-normal text-muted-foreground">
                R$ {price.toFixed(2).replace(".", ",")} por {product.stock_unit}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-foreground mb-2">{displayWeight}</div>
            <div className="text-lg text-muted-foreground">{product.stock_unit}</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <Button key={n} variant="outline" className="h-12 font-medium" onClick={() => handleNumberInput(n.toString())}>{n}</Button>
            ))}
            <Button variant="outline" className="h-12 font-medium" onClick={() => handleNumberInput(".")}>.</Button>
            <Button variant="outline" className="h-12 font-medium" onClick={() => handleNumberInput("0")}>0</Button>
            <Button variant="outline" className="h-12 font-medium text-destructive hover:text-destructive" onClick={handleBackspace}>⌫</Button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[{label:"250g",val:0.25},{label:"500g",val:0.5},{label:"1kg",val:1.0},{label:"1,5kg",val:1.5}].map(p => (
              <Button key={p.label} variant="outline" size="sm" onClick={() => setPresetWeight(p.val)}>{p.label}</Button>
            ))}
          </div>
          <div className="bg-muted/30 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Preço total</p>
            <p className="text-2xl font-bold text-foreground">R$ {totalPrice.toFixed(2).replace(".", ",")}</p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" className="flex-1" onClick={handleClear}>Limpar</Button>
            <Button className="flex-1" onClick={() => { onAddToCart(currentWeight); onClose(); }} disabled={currentWeight <= 0}>
              Adicionar ao Carrinho
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
