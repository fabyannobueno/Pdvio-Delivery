import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Eye, EyeOff, Loader2 } from "lucide-react";
import { updateCustomerPassword } from "@/lib/supabase-service";
import type { Company, CustomerSession } from "@/types";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company;
  session: CustomerSession;
}

export const ChangePasswordModal = ({ isOpen, onClose, company, session }: ChangePasswordModalProps) => {
  const primaryColor = company.delivery_primary_color || "#6d28d9";
  const [closeHovered, setCloseHovered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const reset = () => { setCurrent(""); setNext(""); setConfirm(""); setError(""); setSuccess(false); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!current || !next || !confirm) { setError("Preencha todos os campos."); return; }
    if (next.length < 6) { setError("Nova senha deve ter ao menos 6 caracteres."); return; }
    if (next !== confirm) { setError("Senhas não coincidem."); return; }
    setLoading(true);
    const result = await updateCustomerPassword({ customerId: session.id, currentPassword: current, newPassword: next });
    setLoading(false);
    if (!result.ok) { setError(result.error || "Erro ao atualizar."); return; }
    setSuccess(true);
    setTimeout(() => { reset(); onClose(); }, 1500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => { reset(); onClose(); }}>
      <DialogContent hideCloseButton className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Alterar senha
            <button
              onClick={() => { reset(); onClose(); }}
              className="rounded-md p-2 transition-colors"
              onMouseEnter={() => setCloseHovered(true)}
              onMouseLeave={() => setCloseHovered(false)}
              style={closeHovered ? { color: primaryColor, backgroundColor: `${primaryColor}1a` } : {}}
            ><X className="w-4 h-4" /></button>
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center">
            <p className="text-green-600 font-medium">Senha alterada com sucesso!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Senha atual</Label>
              <div className="relative">
                <Input type={showPass ? "text" : "password"} placeholder="••••••" value={current} onChange={e => setCurrent(e.target.value)} className="pr-10" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPass(v => !v)}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Nova senha</Label>
              <Input type={showPass ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={next} onChange={e => setNext(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Confirmar nova senha</Label>
              <Input type={showPass ? "text" : "password"} placeholder="Repita a nova senha" value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Alterar senha
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
