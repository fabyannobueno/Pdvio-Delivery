import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { doc, onSnapshot, query, where, getDocs, collection, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OrderStatusTracker } from "./OrderStatusTracker";
import { MobileNavbar } from "./MobileNavbar";
import { DesktopSidebar } from "./DesktopSidebar";
import { MyOrdersModal } from "./MyOrdersModal";
import { StoreInfoModal } from "./StoreInfoModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ArrowLeft } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import type { Order, Store } from "@/types";

interface OrderTrackingPageProps {
  orderId?: string;
}

export const OrderTrackingPage = ({ orderId: initialOrderId }: OrderTrackingPageProps) => {
  const [, setLocation] = useLocation();
  const [orderId, setOrderId] = useState(initialOrderId || '');
  const [order, setOrder] = useState<Order | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingColor, setLoadingColor] = useState<string>('#3b82f6'); // default blue
  const [showCart, setShowCart] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [showStoreInfo, setShowStoreInfo] = useState(false);

  // Format weight display with Brazilian formatting (always 3 decimal places)
  const formatWeight = (weightValue: number, unit: string) => {
    const formattedNumber = weightValue.toFixed(3).replace('.', ',');
    return `${formattedNumber}${unit}`;
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

  // Function to load store data and apply theme colors immediately
  const loadStoreForOrder = async (storeId: string) => {
    if (store) return; // Avoid loading if already loaded
    
    console.log('🎨 Loading store for color:', storeId);
    try {
      const storeDoc = await getDoc(doc(db, 'stores', storeId));
      if (storeDoc.exists()) {
        const storeData = { id: storeDoc.id, ...storeDoc.data() } as Store;
        console.log('🎨 Store data loaded:', storeData.name, 'Primary color:', storeData.primaryColor);
        setStore(storeData);
        applyThemeColors(storeData);
        setFavicon(storeData.faviconUrl);
        setPageMeta(storeData);
        
        // Update loading color with store's primary color
        if (storeData.primaryColor) {
          console.log('🎨 Setting loading color to:', storeData.primaryColor);
          setLoadingColor(storeData.primaryColor);
          
          // Also apply directly to DOM to ensure immediate update
          const loadingSpinner = document.querySelector('.order-tracking-spinner');
          if (loadingSpinner) {
            (loadingSpinner as HTMLElement).style.borderBottomColor = storeData.primaryColor;
          }
        }
      } else {
        console.log('🎨 Store not found:', storeId);
      }
    } catch (error) {
      console.error('Error loading store:', error);
    }
  };

  // Load store data when order is found (fallback for cases where immediate loading failed)
  useEffect(() => {
    if (order && order.storeId && !store) {
      loadStoreForOrder(order.storeId);
    }
  }, [order, store]);

  useEffect(() => {
    if (initialOrderId) {
      searchOrder(initialOrderId);
    }
  }, [initialOrderId]);

  const searchOrder = async (searchId: string) => {
    if (!searchId.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      // First try to find order by document ID
      const orderDocRef = doc(db, 'orders', searchId);
      
      const unsubscribe = onSnapshot(orderDocRef, async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const orderData = { id: docSnapshot.id, ...docSnapshot.data() } as Order;
          // Convert Firestore timestamp to Date
          if (orderData.createdAt && typeof orderData.createdAt === 'object' && 'seconds' in orderData.createdAt) {
            orderData.createdAt = new Date((orderData.createdAt as any).seconds * 1000);
          }
          
          // Load store FIRST to get the color, then set the order
          if (orderData.storeId) {
            await loadStoreForOrder(orderData.storeId);
          }
          
          setOrder(orderData);
          setLoading(false);
        } else {
          // If not found by document ID, try to find by sequentialId
          searchBySequentialId(searchId);
        }
      }, (error) => {
        console.error('Error fetching order by document ID:', error);
        // If error, try to search by sequentialId
        searchBySequentialId(searchId);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error searching order:', error);
      searchBySequentialId(searchId);
    }
  };

  const searchBySequentialId = async (sequentialId: string) => {
    try {
      const ordersQuery = query(
        collection(db, 'orders'),
        where('sequentialId', '==', sequentialId)
      );
      
      const querySnapshot = await getDocs(ordersQuery);
      
      if (!querySnapshot.empty) {
        const docSnapshot = querySnapshot.docs[0];
        const orderData = { id: docSnapshot.id, ...docSnapshot.data() } as Order;
        
        // Convert Firestore timestamp to Date
        if (orderData.createdAt && typeof orderData.createdAt === 'object' && 'seconds' in orderData.createdAt) {
          orderData.createdAt = new Date((orderData.createdAt as any).seconds * 1000);
        }
        
        // Load store FIRST to get the color, then set the order
        if (orderData.storeId) {
          await loadStoreForOrder(orderData.storeId);
        }
        
        setOrder(orderData);
        setLoading(false);
        
        // Set up real-time listener for this specific document
        const orderDocRef = doc(db, 'orders', docSnapshot.id);
        
        onSnapshot(orderDocRef, (doc) => {
          if (doc.exists()) {
            const updatedOrderData = { id: doc.id, ...doc.data() } as Order;
            if (updatedOrderData.createdAt && typeof updatedOrderData.createdAt === 'object' && 'seconds' in updatedOrderData.createdAt) {
              updatedOrderData.createdAt = new Date((updatedOrderData.createdAt as any).seconds * 1000);
            }
            setOrder(updatedOrderData);
          }
        });
      } else {
        setError('Pedido não encontrado. Verifique o número do pedido.');
        setOrder(null);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error searching order by sequentialId:', error);
      setError('Erro ao buscar pedido. Tente novamente.');
      setLoading(false);
    }
  };

  const handleSearch = () => {
    searchOrder(orderId);
  };


  // Handler functions for navbar/sidebar
  const handleShowCart = () => {
    if (store) {
      setLocation(`/loja/${store.slug}`);
    }
  };

  const handleShowOrders = () => {
    setShowOrders(true);
  };

  const handleShowStoreInfo = () => {
    setShowStoreInfo(true);
  };

  return (
    <>
      {/* Mobile Navbar */}
      {store && (
        <MobileNavbar
          store={store}
          cartItemCount={0}
          onShowCart={handleShowCart}
          onShowOrders={handleShowOrders}
          onShowStoreInfo={handleShowStoreInfo}
        />
      )}

      {/* Desktop Sidebar */}
      {store && (
        <DesktopSidebar
          store={store}
          cartItemCount={0}
          onShowCart={handleShowCart}
          onShowOrders={handleShowOrders}
          onShowStoreInfo={handleShowStoreInfo}
        />
      )}

      <div className="min-h-screen bg-gray-50 pt-16 md:pt-0 md:ml-64 py-8 px-4">
        <div className="max-w-2xl mx-auto pt-8 md:pt-12">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-center mb-8">
              Acompanhar Pedido
            </h1>
          </div>


        {/* Loading state */}
        {loading && (
          <div className="space-y-8">
            {/* Search Input Skeleton */}
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <Skeleton className="w-48 h-6" />
                  <div className="flex space-x-2">
                    <Skeleton className="flex-1 h-12" />
                    <Skeleton className="w-24 h-12" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Status Tracker Skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="w-48 h-7" />
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Order header */}
                <div className="flex items-center justify-between">
                  <Skeleton className="w-32 h-6" />
                  <Skeleton className="w-20 h-6 rounded-full" />
                </div>
                
                {/* Progress steps */}
                <div className="flex justify-between relative">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex flex-col items-center space-y-2">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <Skeleton className="w-20 h-4" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Order Details Skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="w-48 h-7" />
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Delivery type */}
                <div>
                  <Skeleton className="w-32 h-5 mb-2" />
                  <div className="bg-gray-50 p-3 rounded">
                    <Skeleton className="w-20 h-5" />
                  </div>
                </div>
                
                {/* Customer info */}
                <div>
                  <Skeleton className="w-48 h-5 mb-2" />
                  <div className="bg-gray-50 p-3 rounded space-y-2">
                    <Skeleton className="w-full h-4" />
                    <Skeleton className="w-3/4 h-4" />
                    <Skeleton className="w-full h-4" />
                  </div>
                </div>
                
                {/* Order items */}
                <div>
                  <Skeleton className="w-32 h-5 mb-2" />
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex justify-between border-b pb-2">
                        <Skeleton className="w-48 h-4" />
                        <Skeleton className="w-20 h-4" />
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 border-t">
                      <Skeleton className="w-16 h-6" />
                      <Skeleton className="w-24 h-6" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-red-500 text-lg mb-2">❌</p>
                <p className="text-red-500">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Status */}
        {order && (
          <div className="animate-fadeIn">
            <OrderStatusTracker order={order} storeId={order.storeId} />
            
            {/* Additional order info */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Detalhes do Pedido</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Tipo de Pedido</h4>
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="font-medium">{order.deliveryType === 'delivery' ? 'Entrega' : 'Retirada'}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Informações do Cliente</h4>
                    <div className="bg-gray-50 p-3 rounded space-y-2">
                      <p><span className="font-medium">Nome:</span> {order.customerName}</p>
                      <p><span className="font-medium">Telefone:</span> {order.customerPhone}</p>
                      {order.deliveryType === 'delivery' && order.address && (
                        <p><span className="font-medium">Endereço de Entrega:</span> {order.address}</p>
                      )}
                    </div>
                  </div>

                  {order.deliveryType === 'pickup' && store?.address && (
                    <div>
                      <h4 className="font-medium mb-2">Endereço da Loja</h4>
                      <div className="bg-gray-50 p-3 rounded space-y-3">
                        <p className="text-gray-700">{store.address}</p>
                        <div className="flex gap-2">
                          <a
                            href={`https://maps.google.com/?q=${encodeURIComponent(store.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium text-center hover:bg-blue-700 transition-colors"
                          >
                            Abrir no Google Maps
                          </a>
                          <a
                            href={`https://waze.com/ul?q=${encodeURIComponent(store.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-medium text-center hover:bg-cyan-700 transition-colors"
                          >
                            Abrir no Waze
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-medium mb-2">Método de Pagamento</h4>
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="font-medium">
                        {(() => {
                          switch (order.paymentMethod) {
                            case 'pix':
                              return 'PIX';
                            case 'credit':
                              return 'Cartão de Crédito';
                            case 'debit':
                              return 'Cartão de Débito';
                            case 'cash':
                              return 'Dinheiro';
                            case 'voucher':
                              return 'Vale Refeição/Alimentação';
                            default:
                              return order.paymentMethod;
                          }
                        })()}
                      </p>
                      {order.needsChange && order.changeAmount && (
                        <p className="text-sm text-gray-600 mt-1">
                          Troco para: R$ {order.changeAmount.toFixed(2).replace('.', ',')}
                        </p>
                      )}
                    </div>
                  </div>

                  {order.coupon && (
                    <div>
                      <h4 className="font-medium mb-2">Cupom de Desconto</h4>
                      <div className="bg-green-50 p-3 rounded border border-green-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-green-800">Código: {order.coupon.code}</p>
                            <p className="text-sm text-green-600">
                              {order.coupon.type === 'percentage' 
                                ? `${order.coupon.value}% de desconto` 
                                : `R$ ${order.coupon.value.toFixed(2).replace('.', ',')} de desconto`
                              }
                            </p>
                          </div>
                          <p className="font-semibold text-green-800">
                            -R$ {order.coupon.discount.toFixed(2).replace('.', ',')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-medium mb-2">Itens do Pedido</h4>
                    {order.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-start py-2 border-b last:border-b-0">
                        <div className="flex-1">
                          <p className="font-medium">
                            {item.weight && (item.unit === 'kg' || item.unit === 'g') 
                              ? `${formatWeight(item.weight, item.unit)} ${item.name}` 
                              : `${item.quantity}x ${item.name}`
                            }
                          </p>
                          {item.selectedAddons && item.selectedAddons.length > 0 && (
                            <p className="text-sm text-gray-600">
                              + {item.selectedAddons.map(addon => addon.name).join(', ')}
                            </p>
                          )}
                        </div>
                        <p className="font-medium ml-4">
                          R$ {item.totalPrice.toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  {order.notes && (
                    <div>
                      <h4 className="font-medium mb-2">Observações</h4>
                      <p className="text-gray-600 bg-gray-50 p-3 rounded">
                        {order.notes}
                      </p>
                    </div>
                  )}
                  
                  <div className="pt-4 border-t space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Subtotal</span>
                      <span>R$ {order.subtotal.toFixed(2).replace('.', ',')}</span>
                    </div>
                    
                    {order.deliveryType === 'delivery' && order.deliveryFee > 0 && (
                      <div className="flex justify-between items-center">
                        <span>Taxa de entrega</span>
                        <span>R$ {order.deliveryFee.toFixed(2).replace('.', ',')}</span>
                      </div>
                    )}
                    
                    {order.coupon && (
                      <div className="flex justify-between items-center text-green-600">
                        <span>Desconto ({order.coupon.code})</span>
                        <span>-R$ {order.coupon.discount.toFixed(2).replace('.', ',')}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center text-lg font-semibold pt-2 border-t">
                      <span>Total</span>
                      <span>R$ {order.total.toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <footer className="mt-12 py-8 bg-gray-50 border-t">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="space-y-4">
            {store && (
              <div>
                {store.faviconUrl && (
                  <button
                    onClick={() => setLocation(`/loja/${store.slug}`)}
                    className="block mx-auto mb-3 hover:scale-105 transition-transform"
                  >
                    <img 
                      src={store.faviconUrl} 
                      alt={`${store.name} logo`}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  </button>
                )}
                <h3 className="font-semibold text-gray-900">{store.name}</h3>
                <p className="text-sm text-gray-600">{store.address}</p>
              </div>
            )}
            
            <div className="flex flex-col md:flex-row justify-center items-center md:space-x-6 space-y-1 md:space-y-0 text-sm text-gray-500">
              <span>© {new Date().getFullYear()} {store?.name} - Todos os direitos reservados</span>
              <span className="hidden md:inline">•</span>
              <span>Pedidos online seguros</span>
            </div>
            
            <p className="text-xs text-gray-400">
              Powered by <a href="https://www.deliveryx.shop/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 transition-colors">DeliveryX</a>
            </p>
          </div>
        </div>
      </footer>
        
        {/* WhatsApp Float Button */}
        {store?.whatsapp && order && (
          <a
            href={`https://wa.me/${store.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá, meu nome é ${order.customerName}, preciso de suporte para o pedido #${order.sequentialId || order.id.slice(-8)}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white hover:scale-110 transition-all duration-300 z-50"
            style={{ 
              backgroundColor: store.accentColor || '#25D366',
              boxShadow: `0 4px 20px ${store.accentColor ? store.accentColor + '40' : '#25D36640'}`
            }}
            aria-label="Entrar em contato via WhatsApp"
          >
            <SiWhatsapp className="w-6 h-6" />
          </a>
        )}

      {/* My Orders Modal */}
      {store && (
        <MyOrdersModal
          isOpen={showOrders}
          onClose={() => setShowOrders(false)}
          store={store}
        />
      )}

      {/* Store Info Modal */}
      {store && (
        <StoreInfoModal
          isOpen={showStoreInfo}
          onClose={() => setShowStoreInfo(false)}
          store={store}
          reviewStats={{ averageRating: 0, totalReviews: 0 }}
        />
      )}
      </div>
    </>
  );
};