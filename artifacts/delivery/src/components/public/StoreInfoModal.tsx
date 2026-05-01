import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Clock, Truck, ShoppingBag, X, DollarSign, Instagram, Facebook } from "lucide-react";
import type { Company } from "@/types";

const DAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

interface StoreInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company;
}

export const StoreInfoModal = ({ isOpen, onClose, company }: StoreInfoModalProps) => {
  const formatPhone = (phone: string) => {
    const n = phone.replace(/\D/g, "");
    if (n.length === 11) return n.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    return phone;
  };

  const whatsappNumber = company.delivery_whatsapp
    ? company.delivery_whatsapp.replace(/\D/g, "")
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {company.delivery_logo_url ? (
                <img src={company.delivery_logo_url} alt={company.name} className="w-10 h-10 object-cover rounded-full" />
              ) : (
                <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-full">
                  <span className="text-white text-lg font-bold">{company.name.charAt(0)}</span>
                </div>
              )}
              <h1 className="text-xl font-bold">{company.name}</h1>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {company.delivery_description && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-2">Sobre</h3>
                <p className="text-muted-foreground">{company.delivery_description}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium mb-4">Informações de Contato</h3>
              <div className="space-y-3">
                {company.address && (
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Endereço</p>
                      <p className="text-muted-foreground">{company.address}</p>
                    </div>
                  </div>
                )}
                {company.delivery_whatsapp && (
                  <div className="flex items-center space-x-3">
                    <Phone className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">WhatsApp</p>
                      {whatsappNumber ? (
                        <a
                          href={`https://wa.me/${whatsappNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:underline"
                        >
                          {formatPhone(company.delivery_whatsapp)}
                        </a>
                      ) : (
                        <p className="text-muted-foreground">{company.delivery_whatsapp}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {company.delivery_operating_hours && company.delivery_operating_hours.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-4 flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Horário de Funcionamento
                </h3>
                <div className="space-y-2">
                  {company.delivery_operating_hours.map(h => (
                    <div key={h.day} className="flex justify-between">
                      <span className="font-medium">{DAY_NAMES[h.day]}</span>
                      <span className={h.isOpen ? "text-foreground" : "text-muted-foreground"}>
                        {h.isOpen ? `${h.openTime} — ${h.closeTime}` : "Fechado"}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium mb-4">Informações de Entrega</h3>
              <div className="space-y-3">
                {company.delivery_time && (
                  <div className="flex items-center space-x-3">
                    <Truck className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Tempo de Entrega</p>
                      <p className="text-muted-foreground">{company.delivery_time}</p>
                    </div>
                  </div>
                )}
                {company.delivery_pickup_time && (
                  <div className="flex items-center space-x-3">
                    <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Tempo de Retirada</p>
                      <p className="text-muted-foreground">{company.delivery_pickup_time}</p>
                    </div>
                  </div>
                )}
                {company.delivery_min_order > 0 && (
                  <div className="flex items-center space-x-3">
                    <DollarSign className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Pedido Mínimo</p>
                      <p className="text-muted-foreground">R$ {company.delivery_min_order.toFixed(2).replace(".", ",")}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center space-x-3">
                  <Truck className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Taxa de Entrega</p>
                    <p className="text-muted-foreground">
                      {company.delivery_fee === 0
                        ? "Grátis"
                        : `R$ ${company.delivery_fee.toFixed(2).replace(".", ",")}`}
                      {company.delivery_free_threshold && company.delivery_free_threshold > 0 && (
                        <span className="ml-1 text-green-600">
                          (grátis a partir de R$ {company.delivery_free_threshold.toFixed(2).replace(".", ",")})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {(company.delivery_instagram || company.delivery_facebook) && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-4">Redes Sociais</h3>
                <div className="flex gap-3">
                  {company.delivery_instagram && (
                    <a
                      href={`https://instagram.com/${company.delivery_instagram.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-pink-600 hover:underline"
                    >
                      <Instagram className="w-4 h-4" />
                      {company.delivery_instagram}
                    </a>
                  )}
                  {company.delivery_facebook && (
                    <a
                      href={company.delivery_facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:underline"
                    >
                      <Facebook className="w-4 h-4" />
                      Facebook
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
