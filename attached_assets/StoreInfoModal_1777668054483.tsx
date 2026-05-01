import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MapPin, 
  Phone, 
  Clock, 
  Globe, 
  Star,
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  Receipt,
  Truck,
  ShoppingBag,
  X,
  ExternalLink,
  DollarSign
} from "lucide-react";
import { 
  SiInstagram,
  SiFacebook,
  SiX,
  SiTiktok,
  SiYoutube,
  SiLinkedin,
  SiThreads
} from "react-icons/si";
import type { Store } from "@/types";
import { useEffect } from "react";

interface StoreInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: Store;
  reviewStats?: { averageRating: number; totalReviews: number };
}

export const StoreInfoModal = ({ isOpen, onClose, store, reviewStats }: StoreInfoModalProps) => {
  // Function to convert hex to HSL format
  const hexToHsl = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  // Function to apply theme colors
  const applyThemeColors = (store: Store) => {
    const root = document.documentElement;
    if (store.primaryColor) {
      root.style.setProperty('--store-primary', store.primaryColor);
      root.style.setProperty('--primary', `hsl(${hexToHsl(store.primaryColor)})`);
    }
  };

  // Apply theme colors when modal opens
  useEffect(() => {
    if (isOpen && store) {
      applyThemeColors(store);
    }
  }, [isOpen, store]);
  const formatPhoneNumber = (phone: string) => {
    const numbers = phone.replace(/\D/g, '');
    if (numbers.length === 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  };

  const formatOperatingHours = () => {
    if (!store.operatingHours || store.operatingHours.length === 0) {
      return "Horários não informados";
    }

    return store.operatingHours.map(hour => {
      if (!hour.isOpen) {
        return `${hour.day}: Fechado`;
      }
      return `${hour.day}: ${hour.openTime} - ${hour.closeTime}`;
    }).join('\n');
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'pix': return <Smartphone className="w-4 h-4" />;
      case 'creditCard': return <CreditCard className="w-4 h-4" />;
      case 'debitCard': return <CreditCard className="w-4 h-4" />;
      case 'cash': return <Banknote className="w-4 h-4" />;
      case 'voucher': return <Receipt className="w-4 h-4" />;
      default: return <Wallet className="w-4 h-4" />;
    }
  };

  const getPaymentMethodName = (method: string) => {
    switch (method) {
      case 'pix': return 'PIX';
      case 'creditCard': return 'Cartão de Crédito';
      case 'debitCard': return 'Cartão de Débito';
      case 'cash': return 'Dinheiro';
      case 'voucher': return 'Vale Refeição';
      default: return method;
    }
  };

  const getEnabledPaymentMethods = () => {
    if (!store.paymentMethods) return [];
    
    return Object.entries(store.paymentMethods)
      .filter(([_, enabled]) => enabled)
      .map(([method, _]) => method);
  };

  const formatReviewText = (count: number): string => {
    if (count === 0) return "Nenhuma avaliação";
    if (count === 1) return "1 avaliação";
    return `${count} avaliações`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {store.faviconUrl ? (
                <img 
                  src={store.faviconUrl} 
                  alt={`${store.name} favicon`}
                  className="w-10 h-10 object-cover"
                />
              ) : (
                <div className="w-10 h-10 bg-primary flex items-center justify-center">
                  <span className="text-white text-lg font-bold">
                    {store.name.charAt(0)}
                  </span>
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold">{store.name}</h1>
                {reviewStats && reviewStats.totalReviews > 0 && (
                  <div className="flex items-center space-x-1 text-sm">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span>
                      {reviewStats.averageRating.toFixed(1)} ({formatReviewText(reviewStats.totalReviews)})
                    </span>
                  </div>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Description */}
          {store.description && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-2">Sobre</h3>
                <p className="text-muted-foreground">{store.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Contact Information */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium mb-4">Informações de Contato</h3>
              <div className="space-y-3">
                {store.address && (
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Endereço</p>
                      <p className="text-muted-foreground">{store.address}</p>
                    </div>
                  </div>
                )}
                
                {store.whatsapp && (
                  <div className="flex items-center space-x-3">
                    <Phone className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">WhatsApp</p>
                      <p className="text-muted-foreground">{formatPhoneNumber(store.whatsapp)}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Operating Hours */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                Horário de Funcionamento
              </h3>
              <div className="space-y-2">
                {store.operatingHours && store.operatingHours.length > 0 ? (
                  store.operatingHours.map((hour, index) => (
                    <div key={index} className="flex justify-between">
                      <span className="font-medium">{hour.day}</span>
                      <span className={hour.isOpen ? "text-foreground" : "text-muted-foreground"}>
                        {hour.isOpen ? `${hour.openTime} - ${hour.closeTime}` : "Fechado"}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">Horários não informados</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Delivery Information */}
          {(store.deliveryTime || store.pickupTime || store.minimumOrder || store.deliveryFee) && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-4">Informações de Entrega</h3>
                <div className="space-y-3">
                  {store.deliveryTime && (
                    <div className="flex items-center space-x-3">
                      <Truck className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Tempo de Entrega</p>
                        <p className="text-muted-foreground">{store.deliveryTime}</p>
                      </div>
                    </div>
                  )}
                  
                  {store.pickupTime && (
                    <div className="flex items-center space-x-3">
                      <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Tempo de Retirada</p>
                        <p className="text-muted-foreground">{store.pickupTime}</p>
                      </div>
                    </div>
                  )}
                  
                  {store.minimumOrder && store.minimumOrder > 0 && (
                    <div className="flex items-center space-x-3">
                      <DollarSign className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Pedido Mínimo</p>
                        <p className="text-muted-foreground">
                          R$ {store.minimumOrder.toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {store.deliveryFee !== undefined && (
                    <div className="flex items-center space-x-3">
                      <Truck className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Taxa de Entrega</p>
                        <p className="text-muted-foreground">
                          {store.deliveryFee === 0 ? 'Grátis' : `R$ ${store.deliveryFee.toFixed(2).replace('.', ',')}`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Methods */}
          {getEnabledPaymentMethods().length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-4">Formas de Pagamento</h3>
                <div className="flex flex-wrap gap-2">
                  {getEnabledPaymentMethods().map((method) => (
                    <Badge 
                      key={method} 
                      className="flex items-center space-x-1 border-transparent text-white hover:opacity-90" 
                      style={{ backgroundColor: store.primaryColor || '#3b82f6' }}
                    >
                      {getPaymentMethodIcon(method)}
                      <span>{getPaymentMethodName(method)}</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Social Media Links */}
          {(() => {
            const socialLinks = store.socialLinks;
            const hasAnyLink = socialLinks && Object.values(socialLinks).some(link => link && link.trim() !== '');
            
            if (!hasAnyLink) return null;
            
            const getSocialIcon = (platform: string) => {
              switch (platform) {
                case 'instagram': return <SiInstagram className="w-4 h-4" />;
                case 'facebook': return <SiFacebook className="w-4 h-4" />;
                case 'twitter': return <SiX className="w-4 h-4" />;
                case 'tiktok': return <SiTiktok className="w-4 h-4" />;
                case 'youtube': return <SiYoutube className="w-4 h-4" />;
                case 'linkedin': return <SiLinkedin className="w-4 h-4" />;
                case 'threads': return <SiThreads className="w-4 h-4" />;
                case 'kwai': return <Globe className="w-4 h-4" />;
                case 'googleBusiness': return <MapPin className="w-4 h-4" />;
                case 'website': return <ExternalLink className="w-4 h-4" />;
                default: return <Globe className="w-4 h-4" />;
              }
            };
            
            const getSocialLabel = (platform: string) => {
              switch (platform) {
                case 'instagram': return 'Instagram';
                case 'facebook': return 'Facebook';
                case 'twitter': return 'X (Twitter)';
                case 'tiktok': return 'TikTok';
                case 'youtube': return 'YouTube';
                case 'linkedin': return 'LinkedIn';
                case 'threads': return 'Threads';
                case 'kwai': return 'Kwai';
                case 'googleBusiness': return 'Google Meu Negócio';
                case 'website': return 'Site Oficial';
                default: return platform;
              }
            };
            
            return (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium mb-4 flex items-center">
                    <Globe className="w-5 h-5 mr-2" />
                    Redes Sociais
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(socialLinks).map(([platform, link]) => {
                      if (!link || link.trim() === '') return null;
                      
                      return (
                        <a
                          key={platform}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                          data-testid={`link-social-${platform}`}
                        >
                          <div className="text-muted-foreground group-hover:text-foreground transition-colors">
                            {getSocialIcon(platform)}
                          </div>
                          <span className="text-sm font-medium group-hover:text-foreground transition-colors">
                            {getSocialLabel(platform)}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Footer */}
          <div className="pt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              Powered by{" "}
              <a 
                href="https://www.deliveryx.shop/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-blue-500 transition-colors underline"
              >
                DeliveryX
              </a>
            </p>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};