import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Truck, Package, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createReview, updateOrder } from "@/lib/firebase-service";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Order, Store } from "@/types";
import type { Review } from "@shared/schema";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  storeId: string;
  onReviewSubmitted?: () => void;
}

export const ReviewModal = ({ isOpen, onClose, order, storeId, onReviewSubmitted }: ReviewModalProps) => {
  const [rating, setRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [comment, setComment] = useState("");
  const [deliveryComment, setDeliveryComment] = useState("");
  const [hoveredStar, setHoveredStar] = useState(0);
  const [hoveredDeliveryStar, setHoveredDeliveryStar] = useState(0);
  const [store, setStore] = useState<Store | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Load store data and apply theme when modal opens
  useEffect(() => {
    if (isOpen && storeId && !store) {
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
  }, [isOpen, storeId, store]);

  const submitReviewMutation = useMutation({
    mutationFn: async (reviewData: Omit<Review, "id" | "createdAt">) => {
      // First, check current order state in Firebase
      const orderDoc = await getDoc(doc(db, 'orders', order.id));
      if (!orderDoc.exists()) {
        throw new Error('Pedido não encontrado no Firebase');
      }
      
      const orderData = orderDoc.data();
      console.log('Order data from Firebase:', orderData);
      console.log('Order storeId in Firebase:', orderData.storeId);
      console.log('Order isReviewed in Firebase:', orderData.isReviewed);
      
      // If already reviewed, show success (review was probably created before)
      if (orderData.isReviewed === true) {
        console.log('Pedido já avaliado, mostrando sucesso');
        return orderData.reviewId || 'already-reviewed';
      }
      
      if (orderData.storeId !== reviewData.storeId) {
        throw new Error(`StoreId não confere: pedido=${orderData.storeId}, review=${reviewData.storeId}`);
      }
      
      // Create the review
      const reviewId = await createReview(reviewData);
      console.log('Review created with ID:', reviewId);
      
      // Try to update the order to mark as reviewed (may fail due to permissions)
      try {
        await updateOrder(order.id, {
          isReviewed: true,
          reviewId: reviewId
        });
        console.log('Order updated successfully');
      } catch (updateError) {
        // Log but don't fail - the review was already created successfully
        console.warn('Failed to update order isReviewed flag, but review was created:', updateError);
      }
      
      return reviewId;
    },
    onSuccess: () => {
      toast({
        title: "Avaliação enviada!",
        description: "Obrigado pelo seu feedback. Isso nos ajuda a melhorar nossos serviços.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      
      // Trigger thank you message immediately
      if (onReviewSubmitted) {
        onReviewSubmitted();
      }
      
      onClose();
      resetForm();
      
      // Reload page to show the review
      setTimeout(() => {
        window.location.reload();
      }, 500);
    },
    onError: (error) => {
      console.error('Erro ao enviar avaliação:', error);
      toast({
        title: "Erro ao enviar avaliação",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const resetForm = () => {
    setRating(0);
    setDeliveryRating(0);
    setComment("");
    setDeliveryComment("");
    setHoveredStar(0);
    setHoveredDeliveryStar(0);
    setIsSubmitting(false);
  };

  const handleSubmit = () => {
    // Prevenir múltiplas submissões
    if (isSubmitting || submitReviewMutation.isPending) {
      return;
    }

    if (rating === 0) {
      toast({
        title: "Avaliação obrigatória",
        description: "Por favor, dê uma nota para sua experiência geral.",
        variant: "destructive",
      });
      return;
    }

    if (order.deliveryType === 'delivery' && deliveryRating === 0) {
      toast({
        title: "Avaliação de entrega obrigatória",
        description: "Por favor, avalie também a qualidade da entrega.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    // Build review data based on order type
    // For pickup orders: DON'T include deliveryRating/deliveryComment fields at all
    // Firebase rules require deliveryRating to NOT EXIST or be 1-5
    const baseReviewData = {
      orderId: order.id,
      storeId,
      customerName: order.customerName,
      customerEmail: null,
      customerPhone: order.customerPhone || null,
      orderTotal: order.total.toString(),
      deliveryType: order.deliveryType,
      rating,
      comment: comment.trim() || null,
    };

    // Only add delivery fields for delivery orders
    const reviewData = order.deliveryType === 'delivery' 
      ? {
          ...baseReviewData,
          deliveryRating,
          deliveryComment: deliveryComment.trim() || null,
        }
      : baseReviewData;

    // Remove null/undefined values - Firebase rules may reject them
    const cleanedData = Object.fromEntries(
      Object.entries(reviewData).filter(([_, value]) => value !== null && value !== undefined)
    );

    console.log('Review data to submit:', JSON.stringify(cleanedData, null, 2));
    console.log('Order ID:', order.id);
    console.log('Store ID:', storeId);
    console.log('Order isReviewed:', order.isReviewed);
    console.log('Delivery type:', order.deliveryType);

    submitReviewMutation.mutate(cleanedData as Omit<Review, "id" | "createdAt">);
  };

  const renderStars = (
    currentRating: number,
    hoveredRating: number,
    onClick: (rating: number) => void,
    onHover: (rating: number) => void,
    onLeave: () => void,
    testId: string
  ) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-8 h-8 cursor-pointer transition-colors ${
              star <= (hoveredRating || currentRating)
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300 hover:text-yellow-300'
            }`}
            onClick={() => onClick(star)}
            onMouseEnter={() => onHover(star)}
            onMouseLeave={onLeave}
            data-testid={`${testId}-star-${star}`}
          />
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto [&_textarea:focus-visible]:ring-[--store-accent]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Avalie seu pedido
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Info */}
          <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
            <p className="text-sm text-muted-foreground mb-1">Pedido #{order.sequentialId}</p>
            <p className="font-medium">{order.customerName}</p>
            <p className="text-sm text-muted-foreground">
              R$ {order.total.toFixed(2).replace('.', ',')} • {order.deliveryType === 'delivery' ? 'Entrega' : 'Retirada'}
            </p>
          </div>

          {/* Overall Rating */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <Label className="text-base font-medium">Como foi sua experiência geral?</Label>
              <span className="text-red-500">*</span>
            </div>
            {renderStars(
              rating,
              hoveredStar,
              setRating,
              setHoveredStar,
              () => setHoveredStar(0),
              'overall-rating'
            )}
            {rating > 0 && (
              <p className="text-sm text-muted-foreground">
                {rating === 1 && "Muito ruim"}
                {rating === 2 && "Ruim"}
                {rating === 3 && "Regular"}
                {rating === 4 && "Bom"}
                {rating === 5 && "Excelente"}
              </p>
            )}
          </div>

          {/* Overall Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment">Conte-nos mais sobre sua experiência (opcional)</Label>
            <Textarea
              id="comment"
              placeholder="O que você achou dos produtos, atendimento, qualidade...?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[80px]"
              data-testid="input-comment"
            />
          </div>

          {/* Delivery Rating (only for delivery orders) */}
          {order.deliveryType === 'delivery' && (
            <>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-primary" />
                  <Label className="text-base font-medium">Como foi a entrega?</Label>
                  <span className="text-red-500">*</span>
                </div>
                {renderStars(
                  deliveryRating,
                  hoveredDeliveryStar,
                  setDeliveryRating,
                  setHoveredDeliveryStar,
                  () => setHoveredDeliveryStar(0),
                  'delivery-rating'
                )}
                {deliveryRating > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {deliveryRating === 1 && "Muito demorada/problemas"}
                    {deliveryRating === 2 && "Demorada"}
                    {deliveryRating === 3 && "No prazo"}
                    {deliveryRating === 4 && "Rápida"}
                    {deliveryRating === 5 && "Muito rápida"}
                  </p>
                )}
              </div>

              {/* Delivery Comment */}
              <div className="space-y-2">
                <Label htmlFor="deliveryComment">Comentário sobre a entrega (opcional)</Label>
                <Textarea
                  id="deliveryComment"
                  placeholder="Como foi o tempo de entrega, cuidado com os produtos, atendimento do entregador...?"
                  value={deliveryComment}
                  onChange={(e) => setDeliveryComment(e.target.value)}
                  className="min-h-[60px]"
                  data-testid="input-delivery-comment"
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1" data-testid="button-cancel">
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting || submitReviewMutation.isPending}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              data-testid="button-submit"
            >
              {(isSubmitting || submitReviewMutation.isPending) ? "Enviando..." : "Enviar Avaliação"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};