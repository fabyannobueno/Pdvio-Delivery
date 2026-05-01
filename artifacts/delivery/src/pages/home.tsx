export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-violet-50 via-white to-purple-50 px-4">
      <div className="text-center space-y-6 max-w-md">
        <img
          src="/logo.png"
          alt="PDVIO"
          className="h-12 mx-auto object-contain"
        />

        <div className="space-y-2">
          <p className="text-gray-600 text-lg">
            Acesse o cardápio de uma loja pelo link compartilhado.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 shadow-sm inline-block">
          <p className="text-sm text-gray-400 mb-1">Exemplo de link</p>
          <code className="text-violet-600 font-semibold text-base">/nome-da-loja</code>
        </div>
      </div>

      <p className="absolute bottom-6 text-xs text-gray-300">
        © {new Date().getFullYear()} PDVIO. Todos os direitos reservados.
      </p>
    </div>
  );
}
