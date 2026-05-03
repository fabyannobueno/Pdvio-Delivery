import { useState, useEffect } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import { getCompanyBySlug, verifyCustomerEmail, applyThemeColor } from "@/lib/supabase-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import type { Company } from "@/types";

export const VerifyEmailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearch();
  const [, navigate] = useLocation();

  const customerId = new URLSearchParams(search).get("id") || "";

  const [company, setCompany] = useState<Company | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!slug || !customerId) { setStatus("error"); return; }
    getCompanyBySlug(slug).then(async co => {
      if (co) {
        setCompany(co);
        applyThemeColor(co.delivery_primary_color || "#6d28d9");
        document.title = `Verificar e-mail — ${co.name}`;
      }
      const ok = await verifyCustomerEmail(customerId);
      setStatus(ok ? "success" : "error");
    });
  }, [slug, customerId]);

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
              <span className="font-semibold">{company.name}</span>
            </div>
          )}
          <CardTitle className="text-xl">Verificação de e-mail</CardTitle>
        </CardHeader>
        <CardContent>
          {status === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Verificando...</p>
            </div>
          )}
          {status === "success" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <p className="font-medium text-lg">E-mail confirmado!</p>
              <p className="text-sm text-muted-foreground">Sua conta está ativa. Agora você pode entrar.</p>
              <Button className="mt-2 w-full" onClick={() => navigate(`/${slug}`)}>Ir ao cardápio</Button>
            </div>
          )}
          {status === "error" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <XCircle className="w-10 h-10 text-destructive" />
              <p className="font-medium">Link inválido ou expirado.</p>
              <Button variant="outline" onClick={() => navigate(`/${slug}`)}>Voltar ao cardápio</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
