import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Loader2, CheckCircle, User, Camera, Trash2, Lock } from "lucide-react";
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

function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatCpfDisplay(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11) return raw;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function resizeImageToBase64(file: File, maxSize = 500): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) { height = Math.round((height * maxSize) / width); width = maxSize; }
      } else {
        if (height > maxSize) { width = Math.round((width * maxSize) / height); height = maxSize; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas context")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
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
  const [document, setDocument] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(session.avatar_url || null);
  const [avatarBase64, setAvatarBase64] = useState<string | null | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasDocument = !!session.document;

  useEffect(() => {
    if (isOpen) {
      setName(session.name);
      setPhone(session.phone || "");
      setEmail(session.email || "");
      setDocument("");
      setAvatarPreview(session.avatar_url || null);
      setAvatarBase64(undefined);
      setError("");
      setSuccess(false);
    }
  }, [isOpen, session]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Selecione uma imagem válida."); return; }
    try {
      const base64 = await resizeImageToBase64(file, 500);
      setAvatarPreview(base64);
      setAvatarBase64(base64);
      setError("");
    } catch {
      setError("Erro ao processar imagem.");
    }
    e.target.value = "";
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setAvatarBase64(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || name.trim().length < 2) { setError("Nome deve ter ao menos 2 caracteres."); return; }

    setLoading(true);
    const emailChanged = (email.toLowerCase().trim() || null) !== (session.email?.toLowerCase().trim() || null);

    const updatePayload: Record<string, unknown> = {
      name: name.trim(),
      phone: phone ? phone.trim() : null,
      email: email ? email.toLowerCase().trim() : null,
      ...(emailChanged ? { email_verified: false } : {}),
    };

    if (avatarBase64 !== undefined) {
      updatePayload.avatar_url = avatarBase64;
    }

    const newDocumentDigits = document.replace(/\D/g, "");
    if (!hasDocument && newDocumentDigits.length === 11) {
      updatePayload.document = newDocumentDigits;
    }

    const { error: err } = await supabase
      .from("customers")
      .update(updatePayload)
      .eq("id", session.id);
    setLoading(false);

    if (err) { setError("Erro ao salvar. Tente novamente."); return; }

    const newAvatar = avatarBase64 !== undefined ? (avatarBase64 ?? undefined) : session.avatar_url;
    const newDocument = !hasDocument && newDocumentDigits.length === 11 ? newDocumentDigits : session.document;

    setSuccess(true);
    onUpdated({
      ...session,
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      avatar_url: newAvatar,
      document: newDocument,
    });
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

            {/* Avatar */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative group">
                <div
                  className="w-20 h-20 rounded-full overflow-hidden border-2 flex items-center justify-center bg-muted cursor-pointer"
                  style={{ borderColor: primaryColor }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-9 h-9 text-muted-foreground" />
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                </div>
                {avatarPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center hover:opacity-80"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                Alterar foto
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

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

            <div className="space-y-1">
              <Label htmlFor="profile-cpf" className="flex items-center gap-1.5">
                CPF
                {hasDocument && <Lock className="w-3 h-3 text-muted-foreground" />}
              </Label>
              {hasDocument ? (
                <Input
                  id="profile-cpf"
                  value={formatCpfDisplay(session.document!)}
                  readOnly
                  disabled
                  className="bg-muted text-muted-foreground cursor-not-allowed"
                />
              ) : (
                <Input
                  id="profile-cpf"
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  value={document}
                  onChange={e => setDocument(maskCpf(e.target.value))}
                  maxLength={14}
                />
              )}
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
