import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Home, ShoppingCart as CartIcon, Package, Info, User, LogOut, KeyRound, LogIn, Pencil } from "lucide-react";
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
  onShowProfile: () => void;
}

export const DesktopSidebar = ({ company, cartItemCount, onShowCart, onShowOrders, onShowStoreInfo, customer, onShowAuth, onLogout, onChangePassword, onShowProfile }: DesktopSidebarProps) => {
  const [, setLocation] = useLocation();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const menuItems = [
    { icon: Home, label: "Início", action: () => setLocation(`/${company.delivery_slug}`) },
    { icon: CartIcon, label: "Meu Carrinho", action: onShowCart, badge: cartItemCount > 0 ? cartItemCount : undefined },
    { icon: Package, label: "Meus Pedidos", action: onShowOrders },
    { icon: Info, label: "Mais Informações", action: onShowStoreInfo },
  ];

  return (
    <>
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
                    <button type="button" onClick={onShowProfile} className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 hover:bg-muted transition-colors group text-left">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{customer.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{customer.email || customer.phone}</p>
                      </div>
                      <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                    </button>
                    <Button variant="ghost" className="w-full justify-start h-10 px-3 text-sm" onClick={onChangePassword}>
                      <KeyRound className="w-4 h-4 mr-2" />
                      Alterar senha
                    </Button>
                    <Button variant="ghost" className="w-full justify-start h-10 px-3 text-sm text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setConfirmLogout(true)}>
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

      <AlertDialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair da conta</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja sair?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={onLogout}>Sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
