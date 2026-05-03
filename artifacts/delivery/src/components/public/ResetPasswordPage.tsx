import { useState, useEffect } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import { getCompanyBySlug, resetCustomerPassword, applyThemeColor } from "@/lib/supabase-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Loader2, CheckCircle, XCircle } from "lucide-react";
import type { Company } from "@/types";

export const ResetPasswordPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearch();
  const [, navigate] = useLocation();

  const customerId = new URLSearchParams(search).get("id") || "";

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    getCompanyBySlug(slug).then(co => {
      if (co) {
        setCompany(co);
        applyThemeColor(co.delivery_primary_color || "#6d28d9");
        document.title = `Redefinir senha — ${co.name}`;
      }
      setLoading(false);
    });
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!customerId) { setError("Link inválido ou expirado."); return; }
    if (newPass.length < 6) { setError("Senha deve ter ao menos 6 caracteres."); return; }
    if (newPass !== confirm) { setError("Senhas não coincidem."); return; }
    setSaving(true);
    const ok = await resetCustomerPassword(customerId, newPass);
    setSaving(false);
    if (!ok) { setError("Erro ao redefinir senha. Tente novamente."); return; }
    setDone(true);
    setTimeout(() => navigate(`/${slug}`), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="pb-2">
          {company && (
            <div className="flex items-center gap-3 mb-2">
              {company.delivery_logo_url ? (
                <img src={company.delivery_logo_url} alt={company.name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-white font-bold">{company.name.charAt(0)}</span>
                </div>
              )}
              <span className="font-semibold text-foreground">{company.name}</span>
            </div>
          )}
          <CardTitle className="text-xl">Redefinir senha</CardTitle>
        </CardHeader>

        <CardContent>
          {!customerId ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <XCircle className="w-10 h-10 text-destructive" />
              <p className="font-medium">Link inválido ou expirado.</p>
              <Button variant="outline" onClick={() => navigate(`/${slug}`)}>Voltar ao cardápio</Button>
            </div>
          ) : done ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
              <p className="font-medium text-green-700">Senha redefinida com sucesso!</p>
              <p className="text-sm text-muted-foreground">Redirecionando...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label>Nova senha</Label>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPass(v => !v)}>
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Confirmar nova senha</Label>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    placeholder="Repita a senha"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPass(v => !v)}>
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Redefinir senha
              </Button>
              <Button type="button" variant="ghost" className="w-full text-sm" onClick={() => navigate(`/${slug}`)}>
                Voltar ao cardápio
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
