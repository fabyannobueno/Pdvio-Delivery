import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { getStoreBySlug, getReviewStats } from "../../lib/firebase-service";
import { db } from "@/lib/firebase";
import { ShoppingCart } from "../public/ShoppingCart";
import { WeightCalculator } from "../public/WeightCalculator";
import { ProductDetailModal } from "../public/ProductDetailModal";
import { CheckoutModal } from "../public/CheckoutModal";
import { MobileNavbar } from "../public/MobileNavbar";
import { DesktopSidebar } from "../public/DesktopSidebar";
import { MyOrdersModal } from "../public/MyOrdersModal";
import { StoreInfoModal } from "../public/StoreInfoModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ShoppingCart as CartIcon, Star, Clock, ChevronLeft, ChevronRight, DollarSign, Truck } from "lucide-react";
import type { Store, Product, CartItem, ProductAddon } from "@/types";

export const PublicStorePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showWeightCalculator, setShowWeightCalculator] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showOrders, setShowOrders] = useState(false);
  const [showStoreInfo, setShowStoreInfo] = useState(false);
  const [loadingColor, setLoadingColor] = useState<string>("#f97316"); // default orange
  const [now, setNow] = useState<number>(Date.now());
  const [reviewStats, setReviewStats] = useState({ averageRating: 0, totalReviews: 0 });

  // Function to capitalize first letter and preserve accents
  const formatCategoryName = (category: string): string => {
    if (!category) return category;
    return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  };

  // Function to format review text with correct plural
  const formatReviewText = (count: number): string => {
    if (count === 0) return "Nenhuma avaliação";
    if (count === 1) return "1 avaliação";
    return `${count} avaliações`;
  };

  // Horizontal scroll functionality for desktop
  const scrollContainerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const scrollLeft = (category: string) => {
    const container = scrollContainerRefs.current[category];
    if (container) {
      container.scrollBy({ left: -320, behavior: 'smooth' });
    }
  };

  const scrollRight = (category: string) => {
    const container = scrollContainerRefs.current[category];
    if (container) {
      container.scrollBy({ left: 320, behavior: 'smooth' });
    }
  };

  // Function to set dynamic favicon
  const setFavicon = (faviconUrl: string | undefined) => {
    if (faviconUrl) {
      let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = faviconUrl;
    }
  };

  // Function to set page title and description
  const setPageMeta = (store: Store) => {
    // Set page title
    document.title = `${store.name} | DeliveryX`;
    
    // Set meta description
    let metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.name = 'description';
      document.head.appendChild(metaDescription);
    }
    metaDescription.content = store.description || `Cardápio digital da ${store.name}. Faça seu pedido online!`;
  };

  // Function to apply theme colors
  const applyThemeColors = (store: Store) => {
    const root = document.documentElement;
    if (store.primaryColor) {
      root.style.setProperty('--store-primary', store.primaryColor);
      root.style.setProperty('--primary', `hsl(${hexToHsl(store.primaryColor)})`);
    }
    if (store.secondaryColor) {
      root.style.setProperty('--store-secondary', store.secondaryColor);
      root.style.setProperty('--secondary', `hsl(${hexToHsl(store.secondaryColor)})`);
    }
    if (store.accentColor) {
      root.style.setProperty('--store-accent', store.accentColor);
      root.style.setProperty('--accent', `hsl(${hexToHsl(store.accentColor)})`);
    }
  };

  // Helper function to convert hex to hsl
  const hexToHsl = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  useEffect(() => {
    let isCancelled = false;
    let unsubscribeProducts: (() => void) | null = null;
    let unsubscribeStore: (() => void) | null = null;
    
    const loadStoreData = async () => {
      if (!slug) return;

      try {
        console.log("🔍 Tentando carregar loja com slug:", slug);
        
        // Use a timeout to avoid Firebase conflicts
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (isCancelled) return;
        
        // Get store data by slug
        const storeData = await getStoreBySlug(slug);
        console.log("📄 Loja encontrada?", !!storeData);
        
        if (isCancelled) return;
        console.log("🏪 Dados da loja carregados:", storeData?.name || "Nenhuma loja encontrada");
        console.log("⏰ Horários de funcionamento:", storeData?.operatingHours);
        console.log("📋 Dados completos da loja:", storeData);
        
        // Update loading color with store's primary color as soon as we have it
        if (storeData?.primaryColor && !isCancelled) {
          setLoadingColor(storeData.primaryColor);
        }
        
        // Get products and store data with real-time listeners
        if (storeData) {

          // Set up real-time listener for store data
          unsubscribeStore = onSnapshot(doc(db, "stores", storeData.id),
            (storeDoc) => {
              if (isCancelled) return;
              
              if (storeDoc.exists()) {
                const updatedStoreData = { id: storeDoc.id, ...storeDoc.data() } as Store;
                console.log("🏪 Loja atualizada em tempo real:", updatedStoreData.name);
                setStore(updatedStoreData);
                
                // Apply theme colors, favicon, and page meta when store updates
                applyThemeColors(updatedStoreData);
                setFavicon(updatedStoreData.faviconUrl);
                setPageMeta(updatedStoreData);
              }
            },
            (error) => {
              console.error("❌ Erro no listener da loja:", error);
            }
          );

          const productsQuery = query(
            collection(db, "products"),
            where("storeId", "==", storeData.id),
            where("isActive", "==", true)
          );
          
          // Set up real-time listener for products
          unsubscribeProducts = onSnapshot(productsQuery, 
            (snapshot) => {
              if (isCancelled) return;
              
              const productsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as Product[];
              
              console.log("📦 Produtos atualizados em tempo real:", productsData.length);
              
              // Sort by createdAt on client side
              productsData.sort((a, b) => {
                const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as any)?.seconds * 1000 || 0;
                const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as any)?.seconds * 1000 || 0;
                return bTime - aTime;
              });

              setProducts(productsData);
            },
            (error) => {
              console.error("❌ Erro no listener de produtos:", error);
            }
          );

          if (!isCancelled) {
            setStore(storeData);
            
            // Apply theme colors, favicon, and page meta
            applyThemeColors(storeData);
            setFavicon(storeData.faviconUrl);
            setPageMeta(storeData);
            
            // Load review stats
            try {
              const stats = await getReviewStats(storeData.id);
              if (!isCancelled) {
                setReviewStats(stats);
                console.log("⭐ Estatísticas de avaliações carregadas:", stats);
              }
            } catch (error) {
              console.error("❌ Erro ao carregar estatísticas de avaliações:", error);
            }
          }
        }
      } catch (error) {
        console.error("❌ Erro ao carregar dados da loja:", error);
        console.error("🔥 Detalhes do erro:", error instanceof Error ? error.message : String(error));
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadStoreData();
    
    // Cleanup function to prevent memory leaks
    return () => {
      isCancelled = true;
      if (unsubscribeProducts) {
        unsubscribeProducts();
      }
      if (unsubscribeStore) {
        unsubscribeStore();
      }
    };
  }, [slug]);

  // Timer for real-time updates of promotions and store status
  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, 30000); // Update every 30 seconds

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    // Load cart from localStorage
    const savedCart = localStorage.getItem(`cart_${store?.id}`);
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, [store?.id]);

  useEffect(() => {
    // Save cart to localStorage
    if (store?.id) {
      localStorage.setItem(`cart_${store.id}`, JSON.stringify(cart));
    }
  }, [cart, store?.id]);

  useEffect(() => {
    let filtered = products;

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
  }, [products, selectedCategory, searchQuery]);

  const categories = Array.from(new Set(products.map(p => p.category))).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  // Helper function to normalize dates from different formats
  const normalizeDate = (date: any): Date => {
    if (date instanceof Date) {
      return date;
    } else if (typeof date === 'string') {
      return new Date(date);
    } else if (date && typeof date === 'object' && date.seconds) {
      // Firebase Timestamp
      return new Date(date.seconds * 1000);
    }
    return new Date(); // fallback
  };

  // Check if product promotion is currently active
  const isPromotionActive = (product: Product) => {
    if (!product.isOnPromotion || !product.promotionStartDate || !product.promotionEndDate) {
      return false;
    }

    const currentTime = new Date(now);
    const startDate = normalizeDate(product.promotionStartDate);
    const endDate = normalizeDate(product.promotionEndDate);

    return currentTime >= startDate && currentTime <= endDate;
  };

  const getCurrentPrice = (product: Product) => {
    return isPromotionActive(product) && product.promotionPrice 
      ? product.promotionPrice 
      : product.price;
  };

  const getDiscountPercentage = (product: Product) => {
    return isPromotionActive(product) && product.promotionPrice 
      ? Math.round(((product.price - product.promotionPrice) / product.price) * 100)
      : 0;
  };

  const addToCart = (product: Product, quantity: number = 1, weight?: number, selectedAddons: ProductAddon[] = []) => {
    const currentPrice = getCurrentPrice(product);
    const addonsTotal = selectedAddons.reduce((total, addon) => total + addon.price, 0);
    const basePrice = weight ? currentPrice * weight : currentPrice * quantity;
    const totalPrice = (basePrice + (addonsTotal * quantity));

    const existingItem = cart.find(item => 
      item.productId === product.id && 
      JSON.stringify(item.selectedAddons) === JSON.stringify(selectedAddons)
    );

    if (existingItem) {
      setCart(cart.map(item =>
        item.productId === product.id && 
        JSON.stringify(item.selectedAddons) === JSON.stringify(selectedAddons)
          ? {
              ...item,
              quantity: item.quantity + quantity,
              weight: weight ? (item.weight || 0) + weight : item.weight,
              totalPrice: item.totalPrice + totalPrice
            }
          : item
      ));
    } else {
      const newItem: CartItem = {
        productId: product.id,
        name: product.name,
        price: currentPrice,
        unit: product.unit,
        quantity,
        weight,
        imageUrl: product.imageUrl,
        selectedAddons,
        totalPrice
      };
      setCart([...cart, newItem]);
    }
  };

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setShowProductModal(true);
  };

  const handleProductModalAddToCart = (quantity: number, selectedAddons: ProductAddon[], weight?: number) => {
    if (selectedProduct) {
      addToCart(selectedProduct, quantity, weight, selectedAddons);
    }
  };

  const handleCheckout = () => {
    setShowCart(false);
    setShowCheckout(true);
  };

  const getCartItemCount = () => {
    return cart.length; // Number of unique products, not total quantity
  };

  // Navigation handlers
  const handleShowOrders = () => {
    setShowOrders(true);
  };

  const handleShowStoreInfo = () => {
    setShowStoreInfo(true);
  };

  const isStoreOpen = () => {
    if (!store || !store.operatingHours || store.operatingHours.length === 0) {
      console.log("🏪 Loja sem dados ou sem horários de funcionamento");
      return false;
    }
    
    const currentTime = new Date(now);
    const dayNames = {
      'sunday': 'domingo',
      'monday': 'segunda',
      'tuesday': 'terça',
      'wednesday': 'quarta',
      'thursday': 'quinta',
      'friday': 'sexta',
      'saturday': 'sábado'
    };
    
    const englishDayName = currentTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const portugueseDayName = dayNames[englishDayName as keyof typeof dayNames];
    
    console.log("🕐 Dia atual:", portugueseDayName);
    console.log("🕐 Horários disponíveis:", store.operatingHours);
    
    const todayHours = store.operatingHours.find(h => 
      h.day.toLowerCase().includes(portugueseDayName) || 
      portugueseDayName.includes(h.day.toLowerCase())
    );
    
    if (!todayHours) {
      console.log("❌ Não encontrado horário para hoje:", portugueseDayName);
      return false;
    }
    
    console.log("📅 Horário de hoje:", todayHours);
    
    if (!todayHours.isOpen) {
      console.log("🚫 Loja fechada hoje");
      return false;
    }
    
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    
    const [openHour, openMinute] = todayHours.openTime.split(':').map(Number);
    const [closeHour, closeMinute] = todayHours.closeTime.split(':').map(Number);
    const openTimeInMinutes = openHour * 60 + openMinute;
    const closeTimeInMinutes = closeHour * 60 + closeMinute;
    
    console.log("🕐 Horário atual (minutos):", currentTimeInMinutes);
    console.log("🕐 Abertura (minutos):", openTimeInMinutes);
    console.log("🕐 Fechamento (minutos):", closeTimeInMinutes);
    
    const isOpen = currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes <= closeTimeInMinutes;
    console.log("✅ Loja aberta?", isOpen);
    
    return isOpen;
  };

  // Function to organize products by category and sort alphabetically
  const getProductsByCategory = () => {
    const categories: { [key: string]: Product[] } = {};
    
    filteredProducts.forEach(product => {
      const category = product.category || 'Sem categoria';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(product);
    });
    
    // Sort products alphabetically (A-Z) within each category
    Object.keys(categories).forEach(category => {
      categories[category].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    });
    
    return categories;
  };


  if (loading) {
    return (
      <>
        {/* Mobile Navbar Skeleton */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b md:hidden">
          <div className="flex items-center justify-between p-4">
            <Skeleton className="w-8 h-8 rounded" />
            <Skeleton className="w-32 h-6" />
            <Skeleton className="w-8 h-8 rounded" />
          </div>
        </div>

        {/* Desktop Sidebar Skeleton */}
        <div className="fixed left-0 top-0 bottom-0 w-64 bg-background border-r hidden md:block">
          <div className="p-6">
            <Skeleton className="w-full h-8 mb-6" />
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="w-full h-10" />
              ))}
            </div>
          </div>
        </div>

        <div className="min-h-screen bg-background pt-16 md:pt-0 md:ml-64">
          {/* Store Header Skeleton */}
          <div className="relative h-64 md:h-80 overflow-hidden">
            <Skeleton className="w-full h-full" />
            <div className="absolute bottom-6 left-6 right-6">
              <div className="flex items-center space-x-4">
                <Skeleton className="w-16 h-16 rounded-xl" />
                <div>
                  <Skeleton className="w-48 h-8 mb-2" />
                  <Skeleton className="w-32 h-6" />
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-8">
            {/* Search and Filters Skeleton */}
            <div className="space-y-4">
              <Skeleton className="w-full h-12" />
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="w-20 h-8 rounded-full" />
                ))}
              </div>
            </div>

            {/* Products Grid Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Card key={i}>
                  <CardContent className="p-0">
                    <Skeleton className="w-full h-48 rounded-t-lg" />
                    <div className="p-4 space-y-2">
                      <Skeleton className="w-full h-6" />
                      <Skeleton className="w-full h-4" />
                      <Skeleton className="w-24 h-6" />
                      <Skeleton className="w-full h-10 rounded-md" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Loja não encontrada</h1>
          <p className="text-muted-foreground">A loja que você está procurando não existe ou foi removida.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Navbar */}
      {store && (
        <MobileNavbar
          store={store}
          cartItemCount={getCartItemCount()}
          onShowCart={() => setShowCart(true)}
          onShowOrders={handleShowOrders}
          onShowStoreInfo={handleShowStoreInfo}
        />
      )}

      {/* Desktop Sidebar */}
      {store && (
        <DesktopSidebar
          store={store}
          cartItemCount={getCartItemCount()}
          onShowCart={() => setShowCart(true)}
          onShowOrders={handleShowOrders}
          onShowStoreInfo={handleShowStoreInfo}
        />
      )}

      <div className="min-h-screen bg-background pt-16 md:pt-0 md:ml-64">
        {/* Store Header */}
        <div className="relative h-64 md:h-80 overflow-hidden">
          {store.coverUrl ? (
            <img 
              src={store.coverUrl} 
              alt={`Capa de ${store.name}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/10 to-secondary/10" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          <div className="absolute bottom-6 left-6 right-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-white rounded-xl shadow-lg p-2 flex items-center justify-center overflow-hidden">
                {store.logoUrl ? (
                  <img 
                    src={store.logoUrl} 
                    alt={`Logo de ${store.name}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full h-full rounded-lg flex items-center justify-center bg-primary/10">
                    <span className="font-bold text-xl text-primary">
                      {store.name.charAt(0)}
                    </span>
                  </div>
                )}
              </div>
              <div className="text-white">
                <h1 className="text-2xl font-bold mb-1" data-testid="text-store-name">
                  {store.name}
                </h1>
                <div className="flex flex-col space-y-1 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4 text-sm">
                  <Badge 
                    className={`inline-flex items-center space-x-1 px-2 py-1 w-fit ${
                      isStoreOpen() 
                        ? "bg-green-500 hover:bg-green-600 text-white" 
                        : "bg-red-500 hover:bg-red-600 text-white"
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    <span className="text-xs font-medium">
                      {isStoreOpen() ? "Aberto agora" : "Fechado"}
                    </span>
                  </Badge>
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4" />
                    <span>
                      {reviewStats.averageRating > 0 
                        ? `${reviewStats.averageRating.toFixed(1)} (${formatReviewText(reviewStats.totalReviews)})`
                        : formatReviewText(reviewStats.totalReviews)
                      }
                    </span>
                  </div>
                  
                  {/* Minimum Order */}
                  {store.minimumOrder && store.minimumOrder > 0 && (
                    <div className="flex items-center space-x-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-sm">
                        Pedido mín: R$ {store.minimumOrder.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  )}
                  
                  {/* Delivery Fee */}
                  {store.deliveryFee !== undefined && (
                    <div className="flex items-center space-x-1">
                      <Truck className="w-4 h-4" />
                      <span className="text-sm">
                        Entrega: {store.deliveryFee === 0 ? 'Grátis' : `R$ ${store.deliveryFee.toFixed(2).replace('.', ',')}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Navigation */}
        <div className="sticky top-16 md:top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-border">
          <div className="w-full px-4 md:px-8 py-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar produtos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 focus-visible:ring-[--accent]"
                  data-testid="input-search"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowCart(true)}
                className="relative md:hidden"
                data-testid="button-cart"
              >
                <CartIcon className="w-5 h-5" />
                {getCartItemCount() > 0 && (
                  <Badge className="absolute -top-2 -right-2 w-5 h-5 rounded-full p-0 flex items-center justify-center bg-primary text-primary-foreground text-xs">
                    {getCartItemCount()}
                  </Badge>
                )}
              </Button>
            </div>
            
            {/* Category filters */}
            <div className="flex items-center space-x-2 mt-4 overflow-x-auto pb-2">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("all")}
                className="whitespace-nowrap"
                data-testid="button-category-all"
              >
                Todos
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="whitespace-nowrap"
                  data-testid={`button-category-${category}`}
                >
                  {formatCategoryName(category)}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Store Closed Notice */}
        {!isStoreOpen() && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mx-4 mt-4 rounded">
            <div className="flex">
              <Clock className="w-5 h-5 text-yellow-400 mr-3 mt-0.5" />
              <div>
                <p className="text-yellow-800 font-medium">Loja fechada no momento</p>
                <p className="text-yellow-700 text-sm">
                  Você pode navegar pelo cardápio, mas não é possível fazer pedidos fora do horário de funcionamento.
                </p>
              </div>
            </div>
          </div>
        )}


        {/* Product Catalog by Category */}
        <div className="w-full px-4 md:px-8 py-8">
          {filteredProducts.length > 0 ? (
            <div className="space-y-12">
              {Object.entries(getProductsByCategory()).map(([category, products]) => (
                <div key={category}>
                  <h2 className="text-2xl font-bold text-foreground mb-6 border-b border-border pb-2">
                    {formatCategoryName(category)}
                  </h2>
                  
                  {/* Desktop: Horizontal scroll with navigation buttons */}
                  <div className="hidden md:block relative">
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm"
                      onClick={() => scrollLeft(category)}
                      data-testid={`button-scroll-left-${category}`}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <div 
                      ref={(el) => scrollContainerRefs.current[category] = el}
                      className="flex gap-6 overflow-x-auto scrollbar-hide px-8"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      {products.map((product) => (
                        <Card 
                          key={product.id} 
                          className="flex-none w-80 overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                          onClick={() => handleProductClick(product)}
                          data-testid={`card-product-${product.id}`}
                        >
                          <div className="relative">
                            {product.imageUrl ? (
                              <img 
                                src={product.imageUrl} 
                                alt={product.name}
                                className="w-full h-48 object-cover"
                              />
                            ) : (
                              <div className="w-full h-48 bg-muted flex items-center justify-center">
                                <span className="text-muted-foreground text-lg font-medium">
                                  {product.name.charAt(0)}
                                </span>
                              </div>
                            )}
                            
                            {/* Promotion badge */}
                            {isPromotionActive(product) && (
                              <Badge className="absolute top-2 right-2 bg-red-500 text-white">
                                -{getDiscountPercentage(product)}%
                              </Badge>
                            )}
                          </div>
                          <CardContent className="p-4">
                            <h3 className="font-semibold text-foreground mb-2" data-testid={`text-product-name-${product.id}`}>
                              {product.name}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                              {product.description}
                            </p>
                            <div className="flex items-center justify-between">
                              <div>
                                {isPromotionActive(product) && product.promotionPrice ? (
                                  <div className="flex flex-col">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-sm text-muted-foreground line-through">
                                        R$ {product.price.toFixed(2).replace('.', ',')}
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <span className="text-xl font-bold text-red-600">
                                        R$ {product.promotionPrice.toFixed(2).replace('.', ',')}
                                      </span>
                                      <span className="text-sm text-muted-foreground">
                                        /{product.unit}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-1">
                                    <span className="text-xl font-bold text-foreground">
                                      R$ {product.price.toFixed(2).replace('.', ',')}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                      /{product.unit}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleProductClick(product);
                                }}
                                data-testid={`button-details-${product.id}`}
                              >
                                Ver Detalhes
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm"
                      onClick={() => scrollRight(category)}
                      data-testid={`button-scroll-right-${category}`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Mobile: Vertical list */}
                  <div className="md:hidden space-y-4 mt-4 mb-6">
                    {products.map((product) => (
                      <Card 
                        key={product.id} 
                        className="p-3 rounded-lg shadow-sm hover:shadow-lg transition-all cursor-pointer"
                        onClick={() => handleProductClick(product)}
                        data-testid={`card-product-${product.id}`}
                      >
                        <div className="flex gap-3">
                          <div className="relative w-24 h-24 rounded-md overflow-hidden shrink-0 bg-muted">
                            {product.imageUrl ? (
                              <img 
                                src={product.imageUrl} 
                                alt={product.name}
                                loading="lazy"
                                className="absolute inset-0 w-full h-full object-cover object-center"
                                data-testid={`img-product-${product.id}`}
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-muted-foreground text-lg font-medium">
                                  {product.name.charAt(0)}
                                </span>
                              </div>
                            )}
                            
                            {/* Promotion badge */}
                            {isPromotionActive(product) && (
                              <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-xs">
                                -{getDiscountPercentage(product)}%
                              </Badge>
                            )}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-base font-semibold mb-1 line-clamp-1" data-testid={`text-product-name-${product.id}`}>
                              {product.name}
                            </h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {product.description}
                            </p>
                            <div className="mt-2 flex items-center justify-between">
                              <div>
                                {isPromotionActive(product) && product.promotionPrice ? (
                                  <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground line-through">
                                      R$ {product.price.toFixed(2).replace('.', ',')}
                                    </span>
                                    <div className="flex items-center space-x-1">
                                      <span className="text-lg font-bold text-red-600">
                                        R$ {product.promotionPrice.toFixed(2).replace('.', ',')}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        /{product.unit}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-1">
                                    <span className="text-lg font-bold text-foreground">
                                      R$ {product.price.toFixed(2).replace('.', ',')}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      /{product.unit}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleProductClick(product);
                                }}
                                data-testid={`button-view-${product.id}`}
                              >
                                Ver
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchQuery ? "Nenhum produto encontrado" : "Nenhum produto disponível"}
              </h3>
              <p className="text-muted-foreground">
                {searchQuery 
                  ? "Tente buscar por outro termo ou categoria."
                  : "Esta loja ainda não tem produtos cadastrados."
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Shopping Cart */}
      <ShoppingCart
        isOpen={showCart}
        onClose={() => setShowCart(false)}
        cart={cart}
        setCart={setCart}
        store={store}
        onCheckout={handleCheckout}
      />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        cart={cart}
        setCart={setCart}
        store={store}
      />

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          isOpen={showProductModal}
          onClose={() => {
            setShowProductModal(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
          onAddToCart={handleProductModalAddToCart}
          isStoreOpen={isStoreOpen()}
        />
      )}

      {/* My Orders Modal */}
      <MyOrdersModal
        isOpen={showOrders}
        onClose={() => setShowOrders(false)}
        store={store!}
      />

      {/* Store Info Modal */}
      <StoreInfoModal
        isOpen={showStoreInfo}
        onClose={() => setShowStoreInfo(false)}
        store={store!}
        reviewStats={reviewStats}
      />
    </>
  );
};
