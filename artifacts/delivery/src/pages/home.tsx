import { ShoppingBag } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto">
          <ShoppingBag className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">PDVIO Delivery</h1>
        <p className="text-muted-foreground text-lg">
          Acesse o cardápio de uma loja pelo link compartilhado.
        </p>
        <p className="text-sm text-muted-foreground">
          Exemplo: <code className="bg-muted px-2 py-1 rounded">/nome-da-loja</code>
        </p>
      </div>
    </div>
  );
}
