export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <img
          src="/logo.png"
          alt="PDVIO"
          className="h-16 mx-auto object-contain"
        />
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
