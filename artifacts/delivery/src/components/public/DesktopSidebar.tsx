import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, ShoppingCart as CartIcon, Package, Info, User, LogOut, KeyRound, LogIn } from "lucide-react";
import { useLocation } from "wouter";
import type { Company, CustomerSession } from "@/types";

interface DesktopSidebarProps {
  company: Company;
  cartItemCount: number;
  onShowCart: () => void;
  onShowOrders: () => void;
  onShowStoreInfo: () => void;
  customer: CustomerSession | null;
  onShowAuth: () => void;
  onLogout: () => void;
  onChangePassword: () => void;
}

export const DesktopSidebar = ({ company, cartItemCount, onShowCart, onShowOrders, onShowStoreInfo, customer, onShowAuth, onLogout, onChangePassword }: DesktopSidebarProps) => {
  const [, setLocation] = useLocation();

  const menuItems = [
    { icon: Home, label: "Início", action: () => setLocation(`/${company.delivery_slug}`) },
    { icon: CartIcon, label: "Meu Carrinho", action: onShowCart, badge: cartItemCount > 0 ? cartItemCount : undefined },
    { icon: Package, label: "Meus Pedidos", action: onShowOrders },
    { icon: Info, label: "Mais Informações", action: onShowStoreInfo }
  ];

  return (
    <div className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-background border-r border-border z-40">
      <div className="p-6 flex flex-col h-full">
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

        <Card className="flex-1 flex flex-col">
          <CardContent className="p-3 flex flex-col h-full">
            <nav className="space-y-1 flex-1">
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

            <div className="border-t border-border pt-3 mt-3 space-y-1">
              {customer ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{customer.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{customer.email || customer.phone}</p>
                    </div>
                  </div>
                  <Button variant="ghost" className="w-full justify-start h-10 px-3 text-sm" onClick={onChangePassword}>
                    <KeyRound className="w-4 h-4 mr-2" />
                    Alterar senha
                  </Button>
                  <Button variant="ghost" className="w-full justify-start h-10 px-3 text-sm text-red-500 hover:text-red-600 hover:bg-red-50" onClick={onLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair
                  </Button>
                </>
              ) : (
                <Button variant="ghost" className="w-full justify-start h-10 px-3 text-sm" onClick={onShowAuth}>
                  <LogIn className="w-4 h-4 mr-2" />
                  Entrar / Criar conta
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
