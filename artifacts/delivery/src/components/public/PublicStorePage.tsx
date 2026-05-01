import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { getCompanyBySlug, getProductsByCompanyId, getEffectivePrice, isPromotionActive, isStoreOpen, applyThemeColor } from "@/lib/supabase-service";
import { supabase } from "@/lib/supabase";
import { ShoppingCart } from "./ShoppingCart";
import { WeightCalculator } from "./WeightCalculator";
import { ProductDetailModal } from "./ProductDetailModal";
import { CheckoutModal } from "./CheckoutModal";
import { MobileNavbar } from "./MobileNavbar";
import { DesktopSidebar } from "./DesktopSidebar";
import { MyOrdersModal } from "./MyOrdersModal";
import { StoreInfoModal } from "./StoreInfoModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Search, ShoppingCart as CartIcon, Tag, Clock, Truck, ChevronLeft, ChevronRight } from "lucide-react";
import type { Company, Product, CartItem, ProductAddon } from "@/types";

export const PublicStorePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showWeightCalc, setShowWeightCalc] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [showStoreInfo, setShowStoreInfo] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const scrollRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      setLoading(true);
      const co = await getCompanyBySlug(slug);
      if (!co) { setNotFound(true); setLoading(false); return; }
      setCompany(co);
      applyThemeColor(co.delivery_primary_color || "#6d28d9");
      document.title = `${co.name} | PDVIO Delivery`;
      if (co.delivery_logo_url) {
        let favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
        if (!favicon) {
          favicon = document.createElement("link");
          favicon.rel = "icon";
          document.head.appendChild(favicon);
        }
        favicon.type = co.delivery_logo_url.startsWith("data:") ? co.delivery_logo_url.split(";")[0].replace("data:", "") : "image/png";
        favicon.href = co.delivery_logo_url;
      }
      const prods = await getProductsByCompanyId(co.id);
      setProducts(prods);
      setLoading(false);
    };
    load();
    return () => {
      document.title = "PDVIO Delivery";
      const favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (favicon) {
        favicon.type = "image/png";
        favicon.href = "/favicon.png";
      }
    };
  }, [slug]);

  useEffect(() => {
    if (!company) return;
    const saved = localStorage.getItem(`cart_${company.id}`);
    if (saved) { try { setCart(JSON.parse(saved)); } catch {} }
  }, [company?.id]);

  useEffect(() => {
    if (company?.id) localStorage.setItem(`cart_${company.id}`, JSON.stringify(cart));
  }, [cart, company?.id]);

  // Realtime: re-fetch company when admin updates it (hours, theme, etc.)
  useEffect(() => {
    if (!company?.id) return;
    const channel = supabase
      .channel(`company_realtime_${company.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "companies", filter: `id=eq.${company.id}` }, (payload) => {
        const updated = payload.new as typeof company;
        setCompany(updated);
        applyThemeColor(updated.delivery_primary_color || "#6d28d9");
        if (updated.delivery_logo_url) {
          const favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
          if (favicon) favicon.href = updated.delivery_logo_url;
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [company?.id]);

  // Tick every 60s to re-evaluate store open status based on current time
  useEffect(() => {
    const interval = setInterval(() => setCompany(prev => prev ? { ...prev } : prev), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let filtered = products;
    if (selectedCategory !== "all") filtered = filtered.filter(p => p.category === selectedCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q));
    }
    setFilteredProducts(filtered);
  }, [products, selectedCategory, searchQuery]);

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
  const storeOpen = company ? isStoreOpen(company) : true;
  const cartItemCount = cart.reduce((t, i) => t + i.quantity, 0);

  const groupedByCategory = filteredProducts.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.category || "Outros";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    if (product.stock_unit === "kg" || product.stock_unit === "g") {
      setShowWeightCalc(true);
    } else {
      setShowProductModal(true);
    }
  };

  const addToCart = (product: Product, quantity: number, addons: ProductAddon[], weight?: number) => {
    const price = getEffectivePrice(product);
    const addonsTotal = addons.reduce((t, a) => t + a.price, 0);
    const totalPrice = weight
      ? (price * weight + addonsTotal) * quantity
      : (price + addonsTotal) * quantity;

    const item: CartItem = {
      productId: product.id,
      name: product.name,
      price,
      quantity,
      selectedAddons: addons.map(a => ({ id: a.id, name: a.name, price: a.price })),
      totalPrice,
      imageUrl: product.image_url,
      unit: product.stock_unit,
      weight,
    };

    setCart(prev => {
      const key = item.productId + JSON.stringify(item.selectedAddons);
      const existing = prev.findIndex(i => i.productId === item.productId && JSON.stringify(i.selectedAddons) === JSON.stringify(item.selectedAddons));
      if (existing >= 0 && !weight) {
        return prev.map((i, idx) => idx === existing
          ? { ...i, quantity: i.quantity + quantity, totalPrice: i.totalPrice + totalPrice }
          : i
        );
      }
      return [...prev, item];
    });
  };

  const scroll = (cat: string, dir: number) => {
    scrollRefs.current[cat]?.scrollBy({ left: dir * 300, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-16 md:pt-0 md:ml-64 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="w-full h-48 rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-52 rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">Loja não encontrada</h1>
          <p className="text-muted-foreground">O cardápio que você procura não existe ou está desativado.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <MobileNavbar company={company} cartItemCount={cartItemCount} onShowCart={() => setShowCart(true)} onShowOrders={() => setShowOrders(true)} onShowStoreInfo={() => setShowStoreInfo(true)} />
      <DesktopSidebar company={company} cartItemCount={cartItemCount} onShowCart={() => setShowCart(true)} onShowOrders={() => setShowOrders(true)} onShowStoreInfo={() => setShowStoreInfo(true)} />

      <div className="min-h-screen bg-gray-50 pt-16 md:pt-0 md:ml-64">
        {/* Cover */}
        {company.delivery_cover_url && (
          <div className="relative w-full h-48 md:h-64 overflow-hidden">
            <img src={company.delivery_cover_url} alt="Capa" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute bottom-4 left-6 flex items-center space-x-4">
              {company.delivery_logo_url && (
                <img src={company.delivery_logo_url} alt={company.name} className="w-16 h-16 rounded-full border-4 border-white object-cover shadow-lg" />
              )}
              <div>
                <h1 className="text-2xl font-bold text-white drop-shadow">{company.name}</h1>
                {company.delivery_description && (
                  <p className="text-white/80 text-sm line-clamp-1">{company.delivery_description}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* Header when no cover */}
          {!company.delivery_cover_url && (
            <div className="flex items-center space-x-4 mb-6">
              {company.delivery_logo_url ? (
                <img src={company.delivery_logo_url} alt={company.name} className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">{company.name.charAt(0)}</span>
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold">{company.name}</h1>
                {company.delivery_description && <p className="text-muted-foreground">{company.delivery_description}</p>}
              </div>
            </div>
          )}

          {/* Info chips */}
          <div className="flex flex-wrap gap-2 mb-6">
            {!storeOpen && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> Fechado
              </Badge>
            )}
            {storeOpen && (
              <Badge className="bg-green-500 text-white flex items-center gap-1">
                <Clock className="w-3 h-3" /> Aberto
              </Badge>
            )}
            {company.delivery_time && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Truck className="w-3 h-3" /> {company.delivery_time}
              </Badge>
            )}
            {company.delivery_fee === 0 ? (
              <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-600">
                <Tag className="w-3 h-3" /> Entrega grátis
              </Badge>
            ) : company.delivery_fee > 0 ? (
              <Badge variant="outline" className="flex items-center gap-1">
                <Tag className="w-3 h-3" /> Taxa: R$ {company.delivery_fee.toFixed(2).replace(".", ",")}
              </Badge>
            ) : null}
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar produtos..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>

          {/* Category filter */}
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
              <Button size="sm" variant={selectedCategory === "all" ? "default" : "outline"} onClick={() => setSelectedCategory("all")} className="whitespace-nowrap">
                Todos
              </Button>
              {categories.map(cat => (
                <Button key={cat} size="sm" variant={selectedCategory === cat ? "default" : "outline"} onClick={() => setSelectedCategory(cat)} className="whitespace-nowrap">
                  {cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()}
                </Button>
              ))}
            </div>
          )}

          {/* Products by category */}
          {Object.keys(groupedByCategory).length > 0 ? (
            <div className="space-y-8">
              {Object.entries(groupedByCategory).map(([cat, prods]) => (
                <div key={cat}>
                  <h2 className="text-xl font-bold mb-4">{cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()}</h2>

                  {/* Mobile: vertical grid, Desktop: horizontal scroll */}
                  <div className="relative">
                    <button className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center bg-white rounded-full shadow-md" onClick={() => scroll(cat, -1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div
                      ref={el => { scrollRefs.current[cat] = el; }}
                      className="flex gap-4 md:overflow-x-auto md:scroll-smooth md:pb-2 md:scrollbar-hide grid grid-cols-2 md:flex"
                    >
                      {prods.map(product => {
                        const price = getEffectivePrice(product);
                        const inPromo = isPromotionActive(product);
                        return (
                          <Card
                            key={product.id}
                            className="cursor-pointer hover:shadow-md transition-shadow flex-shrink-0 md:w-56 w-full"
                            onClick={() => handleProductClick(product)}
                          >
                            <div className="relative">
                              {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="w-full h-36 md:w-56 md:h-40 object-cover rounded-t-lg" />
                              ) : (
                                <div className="w-full h-36 md:w-56 md:h-40 bg-muted rounded-t-lg flex items-center justify-center">
                                  <span className="text-3xl font-bold text-muted-foreground">{product.name.charAt(0)}</span>
                                </div>
                              )}
                              {inPromo && (
                                <Badge className="absolute top-2 right-2 bg-red-500 text-white text-xs">PROMO</Badge>
                              )}
                            </div>
                            <CardContent className="p-3">
                              <h3 className="font-semibold text-sm line-clamp-2 mb-1">{product.name}</h3>
                              {product.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{product.description}</p>
                              )}
                              <div className="flex items-center gap-1">
                                {inPromo && (
                                  <span className="text-xs text-muted-foreground line-through">
                                    R$ {product.sale_price.toFixed(2).replace(".", ",")}
                                  </span>
                                )}
                                <span className={`font-bold text-sm ${inPromo ? "text-red-600" : ""}`}>
                                  R$ {price.toFixed(2).replace(".", ",")}
                                </span>
                                <span className="text-xs text-muted-foreground">/{product.stock_unit}</span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                    <button className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center bg-white rounded-full shadow-md" onClick={() => scroll(cat, 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <CartIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum produto encontrado</h3>
              <p className="text-muted-foreground">Tente uma busca diferente ou selecione outra categoria.</p>
            </div>
          )}
        </div>

        {/* Floating cart button */}
        {cartItemCount > 0 && (
          <div className="fixed bottom-6 right-6 z-50 md:hidden">
            <Button className="h-14 px-6 rounded-full shadow-xl text-base" onClick={() => setShowCart(true)}>
              <CartIcon className="w-5 h-5 mr-2" />
              Ver carrinho ({cartItemCount})
            </Button>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedProduct && (
        <>
          <ProductDetailModal
            isOpen={showProductModal}
            onClose={() => { setShowProductModal(false); setSelectedProduct(null); }}
            product={selectedProduct}
            onAddToCart={(qty, addons, w) => addToCart(selectedProduct, qty, addons, w)}
            isStoreOpen={storeOpen}
            primaryColor={company?.delivery_primary_color || "#6d28d9"}
          />
          <WeightCalculator
            isOpen={showWeightCalc}
            onClose={() => { setShowWeightCalc(false); setSelectedProduct(null); }}
            product={selectedProduct}
            onAddToCart={w => addToCart(selectedProduct, 1, [], w)}
          />
        </>
      )}
      <ShoppingCart isOpen={showCart} onClose={() => setShowCart(false)} cart={cart} setCart={setCart} company={company} onCheckout={() => { setShowCart(false); setShowCheckout(true); }} />
      <CheckoutModal isOpen={showCheckout} onClose={() => setShowCheckout(false)} cart={cart} setCart={setCart} company={company} />
      <MyOrdersModal isOpen={showOrders} onClose={() => setShowOrders(false)} company={company} />
      <StoreInfoModal isOpen={showStoreInfo} onClose={() => setShowStoreInfo(false)} company={company} />
    </>
  );
};
