import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Home, ShoppingCart as CartIcon, Package, Info } from "lucide-react";
import type { Company } from "@/types";

interface MobileNavbarProps {
  company: Company;
  cartItemCount: number;
  onShowCart: () => void;
  onShowOrders: () => void;
  onShowStoreInfo: () => void;
}

export const MobileNavbar = ({ company, cartItemCount, onShowCart, onShowOrders, onShowStoreInfo }: MobileNavbarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();

  const menuItems = [
    {
      icon: Home,
      label: "Início",
      action: () => {
        setLocation(`/${company.delivery_slug}`);
        setIsOpen(false);
      }
    },
    {
      icon: CartIcon,
      label: "Meu Carrinho",
      action: () => { onShowCart(); setIsOpen(false); },
      badge: cartItemCount > 0 ? cartItemCount : undefined
    },
    {
      icon: Package,
      label: "Meus Pedidos",
      action: () => { onShowOrders(); setIsOpen(false); }
    },
    {
      icon: Info,
      label: "Mais Informações",
      action: () => { onShowStoreInfo(); setIsOpen(false); }
    }
  ];

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center space-x-3">
          {company.delivery_logo_url ? (
            <img src={company.delivery_logo_url} alt={company.name} className="w-8 h-8 object-cover rounded-full" />
          ) : (
            <div className="w-8 h-8 bg-primary flex items-center justify-center rounded-full">
              <span className="text-white text-sm font-bold">{company.name.charAt(0)}</span>
            </div>
          )}
          <h1 className="text-lg font-semibold text-foreground truncate">{company.name}</h1>
        </div>

        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 p-0">
            <SheetHeader className="p-6 pb-4 border-b border-border">
              <SheetTitle className="text-left">Menu</SheetTitle>
            </SheetHeader>
            <div className="p-6">
              <nav className="space-y-2">
                {menuItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <Button key={index} variant="ghost" className="w-full justify-start h-12 px-4" onClick={item.action}>
                      <Icon className="w-5 h-5 mr-3" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge && (
                        <span className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {item.badge}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </nav>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};
