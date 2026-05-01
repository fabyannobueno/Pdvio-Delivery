import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, ShoppingCart as CartIcon, Package, Info } from "lucide-react";
import { useLocation } from "wouter";
import type { Company } from "@/types";

interface DesktopSidebarProps {
  company: Company;
  cartItemCount: number;
  onShowCart: () => void;
  onShowOrders: () => void;
  onShowStoreInfo: () => void;
}

export const DesktopSidebar = ({ company, cartItemCount, onShowCart, onShowOrders, onShowStoreInfo }: DesktopSidebarProps) => {
  const [, setLocation] = useLocation();

  const menuItems = [
    {
      icon: Home,
      label: "Início",
      action: () => setLocation(`/loja/${company.delivery_slug}`)
    },
    {
      icon: CartIcon,
      label: "Meu Carrinho",
      action: onShowCart,
      badge: cartItemCount > 0 ? cartItemCount : undefined
    },
    {
      icon: Package,
      label: "Meus Pedidos",
      action: onShowOrders
    },
    {
      icon: Info,
      label: "Mais Informações",
      action: onShowStoreInfo
    }
  ];

  return (
    <div className="hidden md:block fixed left-0 top-0 bottom-0 w-64 bg-background border-r border-border z-40">
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-8">
          {company.delivery_logo_url ? (
            <img src={company.delivery_logo_url} alt={company.name} className="w-12 h-12 object-cover rounded-full" />
          ) : (
            <div className="w-12 h-12 bg-primary flex items-center justify-center rounded-full">
              <span className="text-white text-lg font-bold">{company.name.charAt(0)}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-foreground truncate">{company.name}</h1>
          </div>
        </div>

        <Card>
          <CardContent className="p-3">
            <nav className="space-y-1">
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Button key={index} variant="ghost" className="w-full justify-start h-11 px-3" onClick={item.action}>
                    <Icon className="w-5 h-5 mr-3" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <Badge className="bg-primary text-primary-foreground text-xs">{item.badge}</Badge>
                    )}
                  </Button>
                );
              })}
            </nav>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
