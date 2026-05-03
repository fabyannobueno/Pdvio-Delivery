import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Eye, EyeOff, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { signupCustomer, loginCustomer, findCustomerByEmail, sendPasswordResetEmail } from "@/lib/supabase-service";
import type { Company, CustomerSession } from "@/types";

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company;
  onAuthenticated: (session: CustomerSession) => void;
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function looksLikePhone(value: string): boolean {
  const first = value.replace(/\s/g, "")[0];
  return !!first && !value.includes("@") && (first === "(" || /\d/.test(first));
}

export const CustomerAuthModal = ({ isOpen, onClose, company, onAuthenticated }: CustomerAuthModalProps) => {
  const primaryColor = company.delivery_primary_color || "#6d28d9";
  const [closeHovered, setCloseHovered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [loginId, setLoginId] = useState("");
  const loginIsPhone = looksLikePhone(loginId);
  const [loginPass, setLoginPass] = useState("");
  const [showLoginPass, setShowLoginPass] = useState(false);

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPass, setSignupPass] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [showSignupPass, setShowSignupPass] = useState(false);

  const [forgotView, setForgotView] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!loginId.trim() || !loginPass) { setError("Preencha todos os campos."); return; }
    setLoading(true);
    const customer = await loginCustomer({ companyId: company.id, identifier: loginId, password: loginPass });
    setLoading(false);
    if (!customer) { setError("Identificador ou senha incorretos."); return; }
    onAuthenticated({ id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, companyId: company.id });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!signupName.trim()) { setError("Informe seu nome."); return; }
    if (!signupEmail.trim() && !signupPhone.trim()) { setError("Informe e-mail ou telefone."); return; }
    if (!signupPass) { setError("Informe uma senha."); return; }
    if (signupPass.length < 6) { setError("Senha deve ter ao menos 6 caracteres."); return; }
    if (signupPass !== signupConfirm) { setError("Senhas não coincidem."); return; }
    setLoading(true);
    const customer = await signupCustomer({
      companyId: company.id,
      name: signupName,
      email: signupEmail.trim() || undefined,
      phone: signupPhone.trim() || undefined,
      password: signupPass,
    });
    setLoading(false);
    if (!customer) { setError("E-mail ou telefone já cadastrado."); return; }
    onAuthenticated({ id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, companyId: company.id });
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!forgotEmail.trim()) { setError("Informe seu e-mail."); return; }
    setLoading(true);
    const customer = await findCustomerByEmail(company.id, forgotEmail);
    if (!customer) {
      setLoading(false);
      setError("Nenhuma conta encontrada com este e-mail.");
      return;
    }
    const slug = window.location.pathname.split("/")[1];
    const resetUrl = `${window.location.origin}/${slug}/reset-senha?id=${customer.id}`;
    await sendPasswordResetEmail({
      toEmail: customer.email!,
      toName: customer.name,
      resetUrl,
      storeName: company.name,
    });
    setLoading(false);
    setForgotSent(true);
  };

  const resetForgot = () => {
    setForgotView(false);
    setForgotSent(false);
    setForgotEmail("");
    setError("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent hideCloseButton className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {forgotView ? (
              <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={resetForgot}>
                <ArrowLeft className="w-4 h-4" /> Voltar
              </button>
            ) : (
              <span>Acesse sua conta</span>
            )}
            <button
              onClick={onClose}
              className="rounded-md p-2 transition-colors"
              onMouseEnter={() => setCloseHovered(true)}
              onMouseLeave={() => setCloseHovered(false)}
              style={closeHovered ? { color: primaryColor, backgroundColor: `${primaryColor}1a` } : {}}
            ><X className="w-4 h-4" /></button>
          </DialogTitle>
        </DialogHeader>

        {forgotView ? (
          <div className="space-y-4">
            {forgotSent ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle className="w-10 h-10 text-green-500" />
                <p className="font-medium">E-mail enviado!</p>
                <p className="text-sm text-muted-foreground">Verifique sua caixa de entrada e siga o link para redefinir a senha.</p>
                <Button variant="outline" className="mt-2" onClick={resetForgot}>Voltar ao login</Button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <p className="text-sm text-muted-foreground">Informe o e-mail cadastrado e enviaremos um link para redefinir sua senha.</p>
                <div className="space-y-1">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Enviar link
                </Button>
              </form>
            )}
          </div>
        ) : (
          <Tabs defaultValue="login" onValueChange={() => setError("")}>
            <TabsList className="w-full mb-4">
              <TabsTrigger value="login" className="flex-1">Entrar</TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <Label>E-mail ou telefone</Label>
                  <Input
                    placeholder="seu@email.com ou (11) 99999-9999"
                    value={loginId}
                    inputMode={loginIsPhone ? "numeric" : "email"}
                    autoComplete="username"
                    onChange={e => {
                      const v = e.target.value;
                      setLoginId(looksLikePhone(v) ? maskPhone(v) : v);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Senha</Label>
                  <div className="relative">
                    <Input type={showLoginPass ? "text" : "password"} placeholder="••••••" value={loginPass} onChange={e => setLoginPass(e.target.value)} autoComplete="current-password" className="pr-10" />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowLoginPass(v => !v)}>
                      {showLoginPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Entrar
                </Button>
                <button
                  type="button"
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
                  onClick={() => { setError(""); setForgotView(true); }}
                >
                  Esqueceu a senha?
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-1">
                  <Label>Nome completo</Label>
                  <Input placeholder="Seu nome" value={signupName} onChange={e => setSignupName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>E-mail</Label>
                  <Input type="email" placeholder="seu@email.com" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} autoComplete="email" />
                </div>
                <div className="space-y-1">
                  <Label>Telefone</Label>
                  <Input
                    placeholder="(11) 99999-9999"
                    value={signupPhone}
                    inputMode="numeric"
                    autoComplete="tel"
                    onChange={e => setSignupPhone(maskPhone(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Senha</Label>
                  <div className="relative">
                    <Input type={showSignupPass ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={signupPass} onChange={e => setSignupPass(e.target.value)} autoComplete="new-password" className="pr-10" />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowSignupPass(v => !v)}>
                      {showSignupPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Confirmar senha</Label>
                  <div className="relative">
                    <Input type={showSignupPass ? "text" : "password"} placeholder="Repita a senha" value={signupConfirm} onChange={e => setSignupConfirm(e.target.value)} autoComplete="new-password" className="pr-10" />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowSignupPass(v => !v)}>
                      {showSignupPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Criar conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
