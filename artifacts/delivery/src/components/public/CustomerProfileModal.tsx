import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Loader2, CheckCircle, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Company, CustomerSession } from "@/types";

interface CustomerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company;
  session: CustomerSession;
  onUpdated: (updated: CustomerSession) => void;
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export const CustomerProfileModal = ({ isOpen, onClose, company, session, onUpdated }: CustomerProfileModalProps) => {
  const primaryColor = company.delivery_primary_color || "#6d28d9";
  const [closeHovered, setCloseHovered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState(session.name);
  const [phone, setPhone] = useState(session.phone || "");
  const [email, setEmail] = useState(session.email || "");

  useEffect(() => {
    if (isOpen) {
      setName(session.name);
      setPhone(session.phone || "");
      setEmail(session.email || "");
      setError("");
      setSuccess(false);
    }
  }, [isOpen, session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || name.trim().length < 2) { setError("Nome deve ter ao menos 2 caracteres."); return; }

    setLoading(true);
    const emailChanged = (email.toLowerCase().trim() || null) !== (session.email?.toLowerCase().trim() || null);

    const { error: err } = await supabase
      .from("customers")
      .update({
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        email: email ? email.toLowerCase().trim() : null,
        ...(emailChanged ? { email_verified: false } : {}),
      })
      .eq("id", session.id);
    setLoading(false);

    if (err) { setError("Erro ao salvar. Tente novamente."); return; }

    setSuccess(true);
    onUpdated({ ...session, name: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined });
    setTimeout(() => { setSuccess(false); onClose(); }, 1200);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent hideCloseButton className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Meu Perfil
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-2 transition-colors"
              onMouseEnter={() => setCloseHovered(true)}
              onMouseLeave={() => setCloseHovered(false)}
              style={closeHovered ? { color: primaryColor, backgroundColor: `${primaryColor}1a` } : {}}
            ><X className="w-4 h-4" /></button>
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center space-y-2">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
            <p className="text-green-600 font-medium">Perfil atualizado!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="profile-name">Nome</Label>
              <Input id="profile-name" placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-phone">Telefone / WhatsApp</Label>
              <Input id="profile-phone" placeholder="(11) 99999-9999" type="tel" value={phone} onChange={e => setPhone(maskPhone(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-email">E-mail</Label>
              <Input id="profile-email" placeholder="seu@email.com" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
