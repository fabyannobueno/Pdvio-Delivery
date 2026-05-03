import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Menu, Home, ShoppingCart as CartIcon, Package, Info, User, LogOut, KeyRound, LogIn } from "lucide-react";
import type { Company, CustomerSession } from "@/types";

interface MobileNavbarProps {
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

export const MobileNavbar = ({ company, cartItemCount, onShowCart, onShowOrders, onShowStoreInfo, customer, onShowAuth, onLogout, onChangePassword }: MobileNavbarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [, setLocation] = useLocation();

  const menuItems = [
    { icon: Home, label: "Início", action: () => { setLocation(`/${company.delivery_slug}`); setIsOpen(false); } },
    { icon: CartIcon, label: "Meu Carrinho", action: () => { onShowCart(); setIsOpen(false); }, badge: cartItemCount > 0 ? cartItemCount : undefined },
    { icon: Package, label: "Meus Pedidos", action: () => { onShowOrders(); setIsOpen(false); } },
    { icon: Info, label: "Mais Informações", action: () => { onShowStoreInfo(); setIsOpen(false); } },
  ];

  return (
    <>
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
              <div className="p-6 flex flex-col h-full">
                <nav className="space-y-2 flex-1">
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

                <div className="border-t border-border pt-4 space-y-2">
                  {customer ? (
                    <>
                      <div className="flex items-center gap-3 px-4 py-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{customer.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{customer.email || customer.phone}</p>
                        </div>
                      </div>
                      <Button variant="ghost" className="w-full justify-start h-11 px-4" onClick={() => { onChangePassword(); setIsOpen(false); }}>
                        <KeyRound className="w-4 h-4 mr-3" />
                        Alterar senha
                      </Button>
                      <Button variant="ghost" className="w-full justify-start h-11 px-4 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => { setIsOpen(false); setConfirmLogout(true); }}>
                        <LogOut className="w-4 h-4 mr-3" />
                        Sair
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" className="w-full justify-start h-11 px-4" onClick={() => { onShowAuth(); setIsOpen(false); }}>
                      <LogIn className="w-4 h-4 mr-3" />
                      Entrar / Criar conta
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
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
