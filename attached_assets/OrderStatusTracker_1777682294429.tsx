import { useState, useEffect, useRef } from "react";
import { Clock, CheckCircle, ChefHat, Package, Bike, MapPin, X, Star, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReviewModal } from "./ReviewModal";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getReviewByOrderId } from "@/lib/firebase-service";
import type { Order, Store, Review } from "@/types";

interface OrderStatusTrackerProps {
  order: Order;
  storeId?: string;
}

interface StatusStep {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

export const OrderStatusTracker = ({ order, storeId }: OrderStatusTrackerProps) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [store, setStore] = useState<Store | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [orderReview, setOrderReview] = useState<Review | null>(null);
  const [showThankYouMessage, setShowThankYouMessage] = useState(false);
  const thankYouTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Function to get status text based on current step and order status
  const getStatusText = (stepKey: string, order: Order): string => {
    if (order.status === 'cancelled') return 'Cancelado';
    
    // Check if this is the final step and it's completed
    if ((stepKey === 'delivered' && order.status === 'delivered') ||
        (stepKey === 'picked_up' && order.status === 'picked_up')) {
      return stepKey === 'delivered' ? 'Entregue' : 'Retirado';
    }
    
    // Check if this step matches current status (meaning it's in progress)
    if (stepKey === order.status) {
      return 'Em andamento';
    }
    
    // For completed steps
    const statusOrder = ['pending', 'confirmed', 'preparing', 'ready', 'waiting_pickup', 'out_for_delivery', 'delivered', 'picked_up'];
    const currentIndex = statusOrder.indexOf(order.status);
    const stepIndex = statusOrder.indexOf(stepKey);
    
    if (stepIndex < currentIndex) {
      return 'Concluído';
    }
    
    return 'Pendente';
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  // Load store data and apply theme
  useEffect(() => {
    if (storeId && !store) {
      const loadStore = async () => {
        try {
          const storeDoc = await getDoc(doc(db, 'stores', storeId));
          if (storeDoc.exists()) {
            const storeData = { id: storeDoc.id, ...storeDoc.data() } as Store;
            setStore(storeData);
            applyThemeColors(storeData);
          }
        } catch (error) {
          console.error('Error loading store for theme:', error);
        }
      };
      loadStore();
    }
  }, [storeId, store]);

  // Load order review - always try to load from Firebase (isReviewed flag may not be updated)
  useEffect(() => {
    const loadReview = async () => {
      try {
        const review = await getReviewByOrderId(order.id);
        if (review) {
            // Convert null values to undefined for type compatibility
            // Handle Firestore Timestamp conversion properly
            let createdAtDate: Date;
            if (review.createdAt instanceof Date) {
              createdAtDate = review.createdAt;
            } else if (review.createdAt && typeof (review.createdAt as any).toDate === 'function') {
              // Firestore Timestamp
              createdAtDate = (review.createdAt as any).toDate();
            } else if (review.createdAt) {
              // Try to parse as regular date
              createdAtDate = new Date(review.createdAt);
            } else {
              createdAtDate = new Date();
            }
            
            const normalizedReview: Review = {
              id: review.id,
              orderId: review.orderId,
              storeId: review.storeId,
              customerName: review.customerName,
              rating: review.rating,
              comment: review.comment || undefined,
              deliveryRating: review.deliveryRating || undefined,
              deliveryComment: review.deliveryComment || undefined,
              createdAt: createdAtDate,
            };
            setOrderReview(normalizedReview);
            
            // Check if this is a newly created review (less than 10 seconds old)
            const reviewAge = Date.now() - createdAtDate.getTime();
            if (!isNaN(reviewAge) && reviewAge < 10000) { // 10 seconds to account for potential delays
              setShowThankYouMessage(true);
              
              // Clear any existing timer
              if (thankYouTimerRef.current) {
                clearTimeout(thankYouTimerRef.current);
              }
              
              // Hide thank you message after 5 seconds
              thankYouTimerRef.current = setTimeout(() => {
                setShowThankYouMessage(false);
                thankYouTimerRef.current = null;
              }, 5000);
            }
        }
      } catch (error) {
        console.error('Error loading order review:', error);
      }
    };
    loadReview();
  }, [order.id]);

  // Function to trigger thank you message immediately (called from ReviewModal)
  const handleReviewSubmitted = () => {
    setShowThankYouMessage(true);
    
    // Clear any existing timer
    if (thankYouTimerRef.current) {
      clearTimeout(thankYouTimerRef.current);
    }
    
    // Hide thank you message after 5 seconds
    thankYouTimerRef.current = setTimeout(() => {
      setShowThankYouMessage(false);
      thankYouTimerRef.current = null;
    }, 5000);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (thankYouTimerRef.current) {
        clearTimeout(thankYouTimerRef.current);
      }
    };
  }, []);

  const getStatusSteps = (deliveryType: 'delivery' | 'pickup'): StatusStep[] => {
    const baseSteps: StatusStep[] = [
      {
        key: 'pending',
        label: 'Pedido Realizado',
        description: 'Seu pedido foi enviado, aguardando confirmação da loja.',
        icon: Clock,
        color: 'text-gray-500',
        bgColor: 'bg-gray-100'
      },
      {
        key: 'confirmed',
        label: 'Pedido Confirmado',
        description: 'A loja confirmou seu pedido. Estamos preparando com carinho. 🍴',
        icon: CheckCircle,
        color: 'text-blue-500',
        bgColor: 'bg-blue-100'
      },
      {
        key: 'preparing',
        label: 'Em Produção',
        description: 'Seu pedido está em produção. 👨‍🍳',
        icon: ChefHat,
        color: 'text-primary',
        bgColor: 'bg-primary/10'
      },
      {
        key: 'ready',
        label: 'Pedido Pronto',
        description: deliveryType === 'delivery' 
          ? 'Seu pedido está pronto, aguardando o motoboy para retirada. 🛵'
          : 'Seu pedido está pronto e será disponibilizado em instantes. ✨',
        icon: Package,
        color: 'text-purple-500',
        bgColor: 'bg-purple-100'
      }
    ];

    if (deliveryType === 'delivery') {
      baseSteps.push(
        {
          key: 'waiting_pickup',
          label: 'Aguardando Motoboy',
          description: 'Aguardando o motoboy para retirada do seu pedido.',
          icon: Clock,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-100'
        },
        {
          key: 'out_for_delivery',
          label: 'A Caminho',
          description: 'O motoboy já retirou seu pedido e está a caminho. 🚴💨',
          icon: Bike,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100'
        },
        {
          key: 'delivered',
          label: 'Entregue',
          description: 'Pedido entregue com sucesso! Bom apetite. 😋',
          icon: CheckCircle,
          color: 'text-green-500',
          bgColor: 'bg-green-100'
        }
      );
    } else {
      baseSteps.push(
        {
          key: 'waiting_pickup',
          label: 'Aguardando Retirada',
          description: 'Seu pedido está pronto! Venha retirar no estabelecimento. 🏪',
          icon: MapPin,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-100'
        },
        {
          key: 'picked_up',
          label: 'Pedido Retirado',
          description: 'Pedido retirado no estabelecimento. Bom apetite! 😍',
          icon: CheckCircle,
          color: 'text-green-500',
          bgColor: 'bg-green-100'
        }
      );
    }

    return baseSteps;
  };

  const steps = getStatusSteps(order.deliveryType);
  const currentStepIndex = steps.findIndex(step => step.key === order.status);
  const isCancelled = order.status === 'cancelled';

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (isCancelled) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center">
          <div className="mb-4">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <X className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-red-600 mb-2">Pedido Cancelado</h3>
          <p className="text-gray-600">
            Seu pedido foi cancelado. Entre em contato conosco se tiver dúvidas.
          </p>
          <Badge variant="destructive" className="mt-4">
            Cancelado
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold mb-2">
            Acompanhe seu Pedido
          </h3>
          <p className="text-sm text-gray-500">
            Pedido #{order.sequentialId || order.id.slice(0, 8)}
          </p>
          <p className="text-xs text-gray-400">
            Atualizado às {formatTime(currentTime)}
          </p>
        </div>

        {!isExpanded ? (
          // Compact View - Show only current status
          <div className="space-y-4">
            {steps.map((step, index) => {
              const isActive = index === currentStepIndex;
              if (!isActive) return null;
              
              const IconComponent = step.icon;
              
              return (
                <div key={step.key} className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-4">
                    <div className={`
                      w-12 h-12 rounded-full flex items-center justify-center
                      ${step.bgColor} ${step.color} animate-pulse
                    `}>
                      <IconComponent className="w-6 h-6 animate-bounce" />
                    </div>
                    <div className="flex-1">
                      <h4 className={`font-semibold text-lg ${step.color}`}>
                        {step.label}
                      </h4>
                      <p className="text-gray-700 text-sm">
                        {step.description}
                      </p>
                      <Badge 
                        variant={getStatusText(step.key, order) === 'Entregue' || getStatusText(step.key, order) === 'Retirado' ? 'default' : 'outline'} 
                        className={`mt-2 ${
                          getStatusText(step.key, order) === 'Entregue' || getStatusText(step.key, order) === 'Retirado'
                            ? 'bg-green-500 text-white border-green-500'
                            : step.color.replace('text-', 'border-')
                        }`}
                      >
                        {getStatusText(step.key, order)}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
            
            <button
              onClick={() => setIsExpanded(true)}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              <span>Ver todo o processo</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        ) : (
          // Expanded View - Show full timeline
          <div className="space-y-4">
            <button
              onClick={() => setIsExpanded(false)}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors mb-4"
            >
              <span>Ocultar processo</span>
              <ChevronUp className="w-4 h-4" />
            </button>
            
            {steps.map((step, index) => {
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex;
              const isPending = index > currentStepIndex;
              const IconComponent = step.icon;

              return (
                <div key={step.key} className="flex items-start space-x-3">
                  {/* Timeline connector */}
                  <div className="flex flex-col items-center">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                      ${isActive ? step.bgColor + ' ' + step.color + ' animate-pulse' : ''}
                      ${isCompleted ? 'bg-green-100 text-green-500' : ''}
                      ${isPending ? 'bg-gray-100 text-gray-400' : ''}
                    `}>
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <IconComponent className={`w-5 h-5 ${isActive ? 'animate-bounce' : ''}`} />
                      )}
                    </div>
                    
                    {/* Connector line */}
                    {index < steps.length - 1 && (
                      <div className={`
                        w-0.5 h-8 mt-2 transition-all duration-300
                        ${isCompleted ? 'bg-green-300' : 'bg-gray-200'}
                      `} />
                    )}
                  </div>

                  {/* Step content */}
                  <div className="flex-1 pb-8">
                    <h4 className={`
                      font-medium transition-all duration-300
                      ${isActive ? step.color + ' font-semibold' : ''}
                      ${isCompleted ? 'text-green-600' : ''}
                      ${isPending ? 'text-gray-400' : ''}
                    `}>
                      {step.label}
                    </h4>
                    <p className={`
                      text-sm mt-1 transition-all duration-300
                      ${isActive ? 'text-gray-700' : ''}
                      ${isCompleted ? 'text-gray-600' : ''}
                      ${isPending ? 'text-gray-400' : ''}
                    `}>
                      {step.description}
                    </p>
                    
                    {isActive && (
                      <div className="mt-2">
                        <Badge 
                          variant={getStatusText(step.key, order) === 'Entregue' || getStatusText(step.key, order) === 'Retirado' ? 'default' : 'outline'} 
                          className={`${
                            getStatusText(step.key, order) === 'Entregue' || getStatusText(step.key, order) === 'Retirado'
                              ? 'bg-green-500 text-white border-green-500'
                              : step.color.replace('text-', 'border-')
                          }`}
                        >
                          {getStatusText(step.key, order)}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Review Button */}
        {(order.status === 'delivered' || order.status === 'picked_up') && !order.isReviewed && !orderReview && storeId && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Como foi sua experiência?</h4>
                  <p className="text-sm text-gray-600">
                    Sua avaliação nos ajuda a melhorar nossos serviços!
                  </p>
                </div>
                <Button
                  onClick={() => setShowReviewModal(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  data-testid="button-leave-review"
                >
                  <Star className="w-4 h-4 mr-2" />
                  Avaliar Pedido
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Thank You Message (shows for 5 seconds after review) */}
        {(order.status === 'delivered' || order.status === 'picked_up') && showThankYouMessage && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <h4 className="font-medium text-green-900">Obrigado pela sua avaliação!</h4>
                  <p className="text-sm text-green-700">
                    Sua opinião é muito importante para nós.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Review Display Widget */}
        {(order.status === 'delivered' || order.status === 'picked_up') && orderReview && (
          <div className="mt-4">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="space-y-3">
                {/* Rating Display */}
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Sua Avaliação</h5>
                  <div className="flex items-center gap-2 mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-5 h-5 ${
                          star <= orderReview.rating
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                    <span className="text-sm font-medium text-gray-700 ml-2" data-testid="text-review-rating">
                      {orderReview.rating}/5 estrelas
                    </span>
                  </div>
                </div>

                {/* Comment Display */}
                {orderReview.comment && (
                  <div>
                    <h6 className="font-medium text-gray-700 mb-1">Comentário:</h6>
                    <p className="text-sm text-gray-600 bg-white p-3 rounded border italic" data-testid="text-review-comment">
                      "{orderReview.comment}"
                    </p>
                  </div>
                )}

                {/* Delivery Rating Display (if delivery order) */}
                {order.deliveryType === 'delivery' && orderReview.deliveryRating && (
                  <div>
                    <h6 className="font-medium text-gray-700 mb-1">Avaliação da Entrega:</h6>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= (orderReview.deliveryRating || 0)
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                      <span className="text-sm text-gray-600 ml-1" data-testid="text-review-delivery-rating">
                        {orderReview.deliveryRating}/5 estrelas
                      </span>
                    </div>
                  </div>
                )}

                {/* Delivery Comment Display */}
                {orderReview.deliveryComment && (
                  <div>
                    <h6 className="font-medium text-gray-700 mb-1">Comentário sobre a Entrega:</h6>
                    <p className="text-sm text-gray-600 bg-white p-3 rounded border italic">
                      "{orderReview.deliveryComment}"
                    </p>
                  </div>
                )}

                {/* Review Date */}
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-500" data-testid="text-review-date">
                    Avaliado em {orderReview.createdAt.toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Review Modal */}
        {showReviewModal && storeId && (
          <ReviewModal
            isOpen={showReviewModal}
            onClose={() => setShowReviewModal(false)}
            order={order}
            storeId={storeId}
            onReviewSubmitted={handleReviewSubmitted}
          />
        )}
      </CardContent>
    </Card>
  );
};