import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Clock, ShoppingBag, X, DollarSign, Instagram, Facebook, Youtube, Linkedin, Send, Globe, Twitter, CreditCard, Smartphone, Receipt, Wallet } from "lucide-react";
import type { Company } from "@/types";

const MotoIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5.5" cy="17.5" r="2.5"/>
    <circle cx="18.5" cy="17.5" r="2.5"/>
    <path d="M8 17.5h7"/>
    <path d="M14 17.5V11l-3-4H8l-2 4h1.5"/>
    <path d="M14 7h3l2 4.5"/>
    <path d="M11 7h3"/>
  </svg>
);


const DAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

const PAYMENT_METHODS: { id: string; name: string; icon: React.ElementType }[] = [
  { id: "pix", name: "PIX", icon: Smartphone },
  { id: "credit_card", name: "Cartão de Crédito", icon: CreditCard },
  { id: "debit_card", name: "Cartão de Débito", icon: CreditCard },
  { id: "cash", name: "Dinheiro", icon: DollarSign },
  { id: "ticket", name: "Vale Refeição", icon: Receipt },
];

interface StoreInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company;
}

function formatAddress(raw: string): string {
  try {
    const obj = JSON.parse(raw);
    const parts = [
      obj.logradouro,
      obj.numero ? `nº ${obj.numero}` : null,
      obj.complemento || null,
      obj.bairro,
      obj.cidade && obj.estado ? `${obj.cidade} — ${obj.estado}` : obj.cidade || obj.estado,
      obj.cep ? `CEP ${obj.cep}` : null,
    ].filter(Boolean);
    return parts.join(", ");
  } catch {
    return raw;
  }
}

export const StoreInfoModal = ({ isOpen, onClose, company }: StoreInfoModalProps) => {
  const [closeHovered, setCloseHovered] = useState(false);
  const primaryColor = company.delivery_primary_color || "#6d28d9";

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
      <DialogContent hideCloseButton className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center space-x-3 min-w-0">
              {company.delivery_logo_url ? (
                <img src={company.delivery_logo_url} alt={company.name} className="w-10 h-10 object-cover rounded-full flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-full flex-shrink-0">
                  <span className="text-white text-lg font-bold">{company.name.charAt(0)}</span>
                </div>
              )}
              <h1 className="text-xl font-bold truncate">{company.name}</h1>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-2 transition-colors flex-shrink-0"
              onMouseEnter={() => setCloseHovered(true)}
              onMouseLeave={() => setCloseHovered(false)}
              style={closeHovered ? { color: primaryColor, backgroundColor: `${primaryColor}1a` } : {}}
            ><X className="w-4 h-4" /></button>
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
                    <MapPin className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium">Endereço</p>
                      <p className="text-muted-foreground break-words">{formatAddress(company.address)}</p>
                    </div>
                  </div>
                )}
                {company.delivery_whatsapp && (
                  <div className="flex items-center space-x-3">
                    <Phone className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium">WhatsApp</p>
                      {whatsappNumber ? (
                        <a
                          href={`https://wa.me/${whatsappNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:underline truncate block"
                        >
                          {formatPhone(company.delivery_whatsapp)}
                        </a>
                      ) : (
                        <p className="text-muted-foreground truncate">{company.delivery_whatsapp}</p>
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
                      <span className="font-medium">{typeof h.day === "number" ? DAY_NAMES[h.day] : h.day}</span>
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
                    <MotoIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium">Tempo de Entrega</p>
                      <p className="text-muted-foreground break-words">{company.delivery_time}</p>
                    </div>
                  </div>
                )}
                {company.delivery_pickup_time && (
                  <div className="flex items-center space-x-3">
                    <ShoppingBag className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium">Tempo de Retirada</p>
                      <p className="text-muted-foreground break-words">{company.delivery_pickup_time}</p>
                    </div>
                  </div>
                )}
                {company.delivery_min_order > 0 && (
                  <div className="flex items-center space-x-3">
                    <DollarSign className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium">Pedido Mínimo</p>
                      <p className="text-muted-foreground">R$ {company.delivery_min_order.toFixed(2).replace(".", ",")}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start space-x-3">
                  <MotoIcon className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium">Taxa de Entrega</p>
                    <p className="text-muted-foreground break-words">
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

          {company.payment_settings?.enabled && company.payment_settings.enabled.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Formas de Pagamento
                </h3>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_METHODS.filter(pm => company.payment_settings!.enabled.includes(pm.id)).map(pm => {
                    const Icon = pm.icon;
                    return (
                      <div key={pm.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm">
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span>{pm.name}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {(company.delivery_instagram || company.delivery_facebook || company.delivery_tiktok || company.delivery_twitter || company.delivery_youtube || company.delivery_linkedin || company.delivery_telegram || company.delivery_site) && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-4">Redes Sociais e Site</h3>
                <div className="flex flex-col gap-3 min-w-0">
                  {company.delivery_instagram && (
                    <a href={company.delivery_instagram} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 text-pink-600 hover:underline min-w-0">
                      <Instagram className="w-5 h-5 flex-shrink-0" />
                      <span>Instagram</span>
                    </a>
                  )}
                  {company.delivery_facebook && (
                    <a href={company.delivery_facebook} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 text-blue-600 hover:underline min-w-0">
                      <Facebook className="w-5 h-5 flex-shrink-0" />
                      <span>Facebook</span>
                    </a>
                  )}
                  {company.delivery_tiktok && (
                    <a href={company.delivery_tiktok} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 text-foreground hover:underline min-w-0">
                      <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
                      </svg>
                      <span>TikTok</span>
                    </a>
                  )}
                  {company.delivery_twitter && (
                    <a href={company.delivery_twitter} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 text-foreground hover:underline min-w-0">
                      <Twitter className="w-5 h-5 flex-shrink-0" />
                      <span>X (Twitter)</span>
                    </a>
                  )}
                  {company.delivery_youtube && (
                    <a href={company.delivery_youtube} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 text-red-600 hover:underline min-w-0">
                      <Youtube className="w-5 h-5 flex-shrink-0" />
                      <span>YouTube</span>
                    </a>
                  )}
                  {company.delivery_linkedin && (
                    <a href={company.delivery_linkedin} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 text-blue-700 hover:underline min-w-0">
                      <Linkedin className="w-5 h-5 flex-shrink-0" />
                      <span>LinkedIn</span>
                    </a>
                  )}
                  {company.delivery_telegram && (
                    <a href={company.delivery_telegram} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 text-sky-500 hover:underline min-w-0">
                      <Send className="w-5 h-5 flex-shrink-0" />
                      <span>Telegram</span>
                    </a>
                  )}
                  {company.delivery_site && (
                    <a href={company.delivery_site} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 text-primary hover:underline min-w-0">
                      <Globe className="w-5 h-5 flex-shrink-0" />
                      <span>Site</span>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="pt-2 border-t flex flex-col items-center gap-1">
          <span className="text-xs text-muted-foreground">Powered by</span>
          <a
            href="https://www.pdvio.com.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-80 hover:opacity-100 transition-opacity"
          >
            <img src="/logo.png" alt="PDVIO" className="h-6 object-contain" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
};
