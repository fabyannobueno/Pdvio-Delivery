import { useState, useEffect } from "react";
import InputMask from "@/components/ui/input-mask";
import { createOrder, validateCoupon, applyCoupon } from "@/lib/firebase-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { X, MessageCircle, Truck, Home, CreditCard, Smartphone, DollarSign, Receipt, Tag, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sendWhatsAppNotification, generateNewOrderMessage } from "@/lib/whatsapp-service";
import type { Store, CartItem, Order, PaymentMethods } from "@/types";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  setCart: (cart: CartItem[]) => void;
  store: Store;
}

export const CheckoutModal = ({ isOpen, onClose, cart, setCart, store }: CheckoutModalProps) => {
  const { toast } = useToast();

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

  // Apply accent color for input focus
  useEffect(() => {
    if (store.accentColor) {
      const root = document.documentElement;
      root.style.setProperty('--checkout-accent-ring', `hsl(${hexToHsl(store.accentColor)})`);
    }
  }, [store.accentColor]);
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    address: '',
    cep: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
  });
  const [orderNotes, setOrderNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('pix');
  const [needsChange, setNeedsChange] = useState(false);
  const [changeAmount, setChangeAmount] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    discount: number;
  } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Load saved customer data on component mount
  useEffect(() => {
    const savedData = localStorage.getItem(`customerData_${store.id}`);
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setCustomerData(parsedData);
      } catch (error) {
        console.error('Error loading saved customer data:', error);
      }
    }
  }, [store.id]);

  // Save customer data to localStorage when it changes
  useEffect(() => {
    // Only save if at least name or phone is filled
    if (customerData.name.trim() || customerData.phone.trim()) {
      localStorage.setItem(`customerData_${store.id}`, JSON.stringify(customerData));
    }
  }, [customerData, store.id]);

  const subtotal = cart.reduce((total, item) => total + item.totalPrice, 0);
  const deliveryFee = deliveryType === 'delivery' ? store.deliveryFee : 0;
  const freeDelivery = subtotal >= store.freeDeliveryThreshold;
  const finalDeliveryFee = freeDelivery ? 0 : deliveryFee;
  const discount = appliedCoupon?.discount || 0;
  const total = subtotal + finalDeliveryFee - discount;

  // Get available payment methods
  const getAvailablePaymentMethods = () => {
    const methods: any[] = [];

    if (store.paymentMethods) {
      if (store.paymentMethods.pix) {
        methods.push({ 
          id: 'pix', 
          name: 'PIX', 
          icon: Smartphone, 
          description: 'Pagamento instantâneo' 
        });
      }
      
      if (store.paymentMethods.creditCard) {
        methods.push({ 
          id: 'credit', 
          name: 'Cartão de Crédito', 
          icon: CreditCard, 
          description: 'Cartão de crédito' 
        });
      }
      
      if (store.paymentMethods.debitCard) {
        methods.push({ 
          id: 'debit', 
          name: 'Cartão de Débito', 
          icon: CreditCard, 
          description: 'Cartão de débito' 
        });
      }
      
      if (store.paymentMethods.cash) {
        methods.push({ 
          id: 'cash', 
          name: 'Dinheiro', 
          icon: DollarSign, 
          description: 'Pagamento em espécie' 
        });
      }
      
      if (store.paymentMethods.voucher) {
        methods.push({ 
          id: 'voucher', 
          name: 'Ticket Alimentação', 
          icon: Receipt, 
          description: 'VR, VA, Sodexo, etc.' 
        });
      }
    }

    return methods;
  };

  const availablePaymentMethods = getAvailablePaymentMethods();

  // Format currency for change amount
  const formatCurrency = (value: string) => {
    const number = value.replace(/\D/g, '');
    const formattedNumber = (parseFloat(number) / 100).toFixed(2);
    return formattedNumber.replace('.', ',');
  };

  // Handle change amount input
  const handleChangeAmountChange = (value: string) => {
    const formattedValue = formatCurrency(value);
    setChangeAmount(formattedValue);
  };

  // Reset change fields when payment method changes
  useEffect(() => {
    if (selectedPaymentMethod !== 'cash') {
      setNeedsChange(false);
      setChangeAmount('');
    }
  }, [selectedPaymentMethod]);

  // Function to search for address using CEP
  const searchCep = async (cep: string) => {
    if (cep.replace(/\D/g, '').length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep.replace(/\D/g, '')}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
          setCustomerData(prev => ({
            ...prev,
            street: data.logradouro || '',
            neighborhood: data.bairro || '',
            city: data.localidade || '',
            state: data.uf || '',
          }));
        } else {
          toast({
            title: "CEP não encontrado",
            description: "Verifique o CEP informado e tente novamente.",
            variant: "destructive"
          });
        }
      } catch (error) {
        toast({
          title: "Erro ao buscar CEP",
          description: "Tente novamente em alguns instantes.",
          variant: "destructive"
        });
      }
    }
  };

  // Function to format CEP
  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{5})(\d{3})/, '$1-$2');
  };

  // Function to handle CEP change
  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    setCustomerData(prev => ({ ...prev, cep: formatted }));
    
    // Search when CEP is complete
    if (formatted.replace(/\D/g, '').length === 8) {
      searchCep(formatted);
    }
  };

  // Coupon functions
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Digite um código de cupom');
      return;
    }

    setCouponLoading(true);
    setCouponError(null);

    try {
      const validation = await validateCoupon(
        store.id,
        couponCode.trim().toUpperCase(),
        customerData.phone.replace(/\D/g, ''),
        subtotal + finalDeliveryFee
      );

      if (validation.valid && validation.coupon && validation.discount !== undefined) {
        setAppliedCoupon({
          code: validation.coupon.code,
          type: validation.coupon.type,
          value: validation.coupon.value,
          discount: validation.discount
        });
        toast({
          title: "Cupom aplicado!",
          description: `Desconto de R$ ${validation.discount.toFixed(2).replace('.', ',')} aplicado.`
        });
      } else {
        setCouponError(validation.error || 'Erro ao validar cupom');
      }
    } catch (error) {
      setCouponError('Erro ao aplicar cupom. Tente novamente.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError(null);
  };

  // Validation functions
  const canCheckout = () => {
    const hasName = customerData.name.trim().length >= 2;
    const hasPhone = customerData.phone.replace(/\D/g, '').length >= 10;
    const hasDeliveryAddress = deliveryType === 'pickup' || 
      (customerData.street && customerData.number && customerData.neighborhood);
    
    // Validate change amount for cash payments
    const isChangeValid = selectedPaymentMethod !== 'cash' || 
      !needsChange || 
      (changeAmount && parseFloat(changeAmount.replace(',', '.')) > total);
    
    return hasName && hasPhone && hasDeliveryAddress && isChangeValid;
  };

  // Format WhatsApp message
  const formatWhatsAppMessage = (order: any, paymentMethod?: string) => {
    let message = `🛒 *Novo Pedido - ${store.name}*\n\n`;
    message += `👤 *Cliente:* ${order.customerName}\n`;
    message += `📱 *Telefone:* ${order.customerPhone}\n`;
    message += `🏷️ *Pedido:* #${order.sequentialId || order.id.padStart(6, '0')}\n\n`;
    
    message += `📦 *Itens:*\n`;
    order.items.forEach((item: any) => {
      message += `• ${item.quantity}x ${item.name}`;
      if (item.selectedAddons && item.selectedAddons.length > 0) {
        message += `\n  + ${item.selectedAddons.map((addon: any) => addon.name).join(', ')}`;
      }
      if (item.weight) {
        message += ` (${item.weight}kg)`;
      }
      message += ` - R$ ${item.totalPrice.toFixed(2).replace('.', ',')}\n`;
    });
    
    message += `\n💰 *Resumo:*\n`;
    message += `Subtotal: R$ ${order.subtotal.toFixed(2).replace('.', ',')}\n`;
    if (order.deliveryFee > 0) {
      message += `Taxa de entrega: R$ ${order.deliveryFee.toFixed(2).replace('.', ',')}\n`;
    }
    message += `*Total: R$ ${order.total.toFixed(2).replace('.', ',')}*\n\n`;
    
    if (order.deliveryType === 'delivery') {
      message += `🚚 *Entrega no endereço:*\n${order.address}\n\n`;
    } else {
      message += `🏪 *Retirada na loja*\n\n`;
    }
    
    if (order.notes && order.notes.trim()) {
      message += `📝 *Observações:*\n${order.notes}\n\n`;
    }
    
    // Add payment method information if specified
    if (paymentMethod && paymentMethod !== 'whatsapp') {
      const paymentNames: {[key: string]: string} = {
        'credit': 'Cartão de Crédito',
        'debit': 'Cartão de Débito', 
        'cash': 'Dinheiro',
        'voucher': 'Ticket Alimentação',
        'PIX': 'PIX'
      };
      message += `💳 *Forma de Pagamento:* ${paymentNames[paymentMethod] || paymentMethod}\n\n`;
    }
    
    // Add tracking link
    const trackingUrl = `${window.location.origin}/pedido/${order.sequentialId || order.id}`;
    message += `📱 *Acompanhe seu pedido:*\n${trackingUrl}\n\n`;
    
    message += `Por favor, confirme o pedido! 😊`;
    
    return message;
  };

  const handleCheckout = async () => {
    if (!canCheckout()) return;

    setLoading(true);
    try {
      // Validate required data
      if (!store.id) {
        throw new Error("ID da loja não encontrado");
      }
      
      if (!customerData.name || !customerData.phone) {
        throw new Error("Dados do cliente incompletos");
      }
      
      if (!cart || cart.length === 0) {
        throw new Error("Carrinho vazio");
      }

      const orderData: any = {
        storeId: store.id,
        customerName: customerData.name || '',
        customerPhone: customerData.phone || '',
        items: cart || [],
        subtotal: subtotal || 0,
        deliveryFee: finalDeliveryFee || 0,
        total: total || 0,
        deliveryType: deliveryType || 'pickup',
        status: 'pending' as const,
        paymentMethod: selectedPaymentMethod || 'whatsapp',
        needsChange: selectedPaymentMethod === 'cash' ? needsChange : false,
        changeAmount: selectedPaymentMethod === 'cash' && needsChange && changeAmount ? parseFloat(changeAmount.replace(',', '.')) : undefined,
      };

      // Add coupon information if applied
      if (appliedCoupon) {
        orderData.coupon = appliedCoupon;
      }

      // Only add address if it's delivery
      if (deliveryType === 'delivery') {
        const addressParts = [
          customerData.street || '',
          customerData.number || '',
          customerData.neighborhood || '',
          customerData.city || '',
          customerData.state || '',
          customerData.cep ? `CEP: ${customerData.cep}` : ''
        ].filter(Boolean);
        
        orderData.address = addressParts.join(', ');
      }

      // Only add notes if not empty
      if (orderNotes && orderNotes.trim()) {
        orderData.notes = orderNotes.trim();
      }

      const sequentialId = await createOrder(orderData);
      const order = { ...orderData, id: sequentialId, sequentialId, createdAt: new Date() };

      // Apply coupon if used
      if (appliedCoupon) {
        try {
          // Find the coupon in Firebase to get its ID
          const coupon = await validateCoupon(
            store.id,
            appliedCoupon.code,
            customerData.phone.replace(/\D/g, ''),
            subtotal + finalDeliveryFee
          );
          if (coupon.valid && coupon.coupon) {
            await applyCoupon(coupon.coupon.id, customerData.phone.replace(/\D/g, ''), sequentialId);
          }
        } catch (couponError) {
          // Don't fail the order if coupon application fails
        }
      }

      // Process payment based on selected method
      if (selectedPaymentMethod === 'pix') {
        await handlePixPayment(order);
      } else {
        // Para outros métodos (cartão, dinheiro, ticket), notificar cliente via API
        await handleOtherPaymentMethods(order, selectedPaymentMethod);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro",
        description: `Erro ao processar pedido: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppCheckout = async (order: any) => {
    try {
      // Send notification to customer using WhatsApp API
      const customerMessage = generateNewOrderMessage(order, store);
      const customerPhone = order.customerPhone.replace(/\D/g, '');
      
      await sendWhatsAppNotification(customerPhone, customerMessage);
      
      // Clear cart and close modal
      setCart([]);
      onClose();
      
      // Redirect to order tracking page
      window.location.href = `/order/${order.sequentialId}`;
      
      toast({
        title: "Pedido enviado!",
        description: "Seu pedido foi confirmado e você receberá uma mensagem no WhatsApp.",
      });
    } catch (error) {
      console.error("Erro ao enviar notificação:", error);
      toast({
        title: "Pedido realizado",
        description: "Seu pedido foi processado, mas houve um problema ao enviar a notificação.",
        variant: "destructive",
      });
    }
  };

  const handlePixPayment = async (order: any) => {
    // Simplified PIX payment - just notify customer
    await handleOtherPaymentMethods(order, 'PIX');
  };


  // Função simplificada para outros métodos de pagamento
  const handleOtherPaymentMethods = async (order: any, paymentMethod: string) => {
    try {
      // Send notification to customer using WhatsApp API
      const customerMessage = generateNewOrderMessage(order, store);
      const customerPhone = order.customerPhone.replace(/\D/g, '');
      
      await sendWhatsAppNotification(customerPhone, customerMessage);
      
      // Clear cart and close modal
      setCart([]);
      onClose();
      
      // Redirect to order tracking page
      window.location.href = `/order/${order.sequentialId}`;
      
      const paymentNames: {[key: string]: string} = {
        'credit': 'Cartão de Crédito',
        'debit': 'Cartão de Débito', 
        'cash': 'Dinheiro',
        'voucher': 'Ticket Alimentação',
        'PIX': 'PIX'
      };
      
      toast({
        title: "Pedido confirmado!",
        description: `Pedido realizado com ${paymentNames[paymentMethod]}. Você receberá uma mensagem no WhatsApp.`,
      });
    } catch (error) {
      console.error("Erro ao enviar notificação:", error);
      toast({
        title: "Pedido realizado",
        description: "Seu pedido foi processado, mas houve um problema ao enviar a notificação.",
        variant: "destructive",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto [&_input:focus-visible]:ring-[--checkout-accent-ring] [&_textarea:focus-visible]:ring-[--checkout-accent-ring]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Finalizar Pedido</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-6 w-6"
              data-testid="btn-close-checkout"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Delivery Type */}
          <div className="space-y-3">
            <Label>Tipo de Entrega</Label>
            <RadioGroup
              value={deliveryType}
              onValueChange={(value) => setDeliveryType(value as 'delivery' | 'pickup')}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem
                  value="delivery"
                  id="delivery"
                  className="peer sr-only"
                  data-testid="radio-delivery"
                />
                <Label
                  htmlFor="delivery"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Truck className="mb-3 h-6 w-6" />
                  Entrega
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="pickup"
                  id="pickup"
                  className="peer sr-only"
                  data-testid="radio-pickup"
                />
                <Label
                  htmlFor="pickup"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Home className="mb-3 h-6 w-6" />
                  Retirada
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Customer Data */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Dados do Cliente</h3>
              {(customerData.name.trim() || customerData.phone.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomerData({
                      name: '',
                      phone: '',
                      address: '',
                      cep: '',
                      street: '',
                      number: '',
                      neighborhood: '',
                      city: '',
                      state: '',
                    });
                    localStorage.removeItem(`customerData_${store.id}`);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Limpar dados salvos
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  placeholder="Seu nome"
                  value={customerData.name}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-customer-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp *</Label>
                <InputMask
                  mask="(99) 99999-9999"
                  placeholder="(00) 00000-0000"
                  value={customerData.phone}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                  data-testid="input-customer-phone"
                />
              </div>
            </div>

            {deliveryType === 'delivery' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    placeholder="00000-000"
                    value={customerData.cep}
                    onChange={handleCepChange}
                    maxLength={9}
                    data-testid="input-customer-cep"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="street">Rua *</Label>
                    <Input
                      id="street"
                      placeholder="Nome da rua"
                      value={customerData.street}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, street: e.target.value }))}
                      data-testid="input-customer-street"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="number">Número *</Label>
                    <Input
                      id="number"
                      placeholder="123"
                      value={customerData.number}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, number: e.target.value }))}
                      data-testid="input-customer-number"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="neighborhood">Bairro *</Label>
                    <Input
                      id="neighborhood"
                      placeholder="Nome do bairro"
                      value={customerData.neighborhood}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, neighborhood: e.target.value }))}
                      data-testid="input-customer-neighborhood"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      placeholder="Nome da cidade"
                      value={customerData.city}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, city: e.target.value }))}
                      data-testid="input-customer-city"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Order Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Alguma observação sobre o pedido?"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              data-testid="input-order-notes"
            />
          </div>

          {/* Payment Methods */}
          <div className="space-y-3">
            <Label>Forma de Pagamento</Label>
            <RadioGroup
              value={selectedPaymentMethod}
              onValueChange={setSelectedPaymentMethod}
              className="space-y-2"
            >
              {availablePaymentMethods.map((method) => (
                <div key={method.id} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={method.id}
                    id={method.id}
                    data-testid={`radio-payment-${method.id}`}
                  />
                  <Label
                    htmlFor={method.id}
                    className="flex items-center space-x-3 cursor-pointer flex-1"
                  >
                    <method.icon className="h-4 w-4" />
                    <div>
                      <div className="font-medium">{method.name}</div>
                      <div className="text-sm text-muted-foreground">{method.description}</div>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Change Information for Cash Payment */}
          {selectedPaymentMethod === 'cash' && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
              <h4 className="font-medium">Informações sobre Troco</h4>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="needs-change"
                    checked={needsChange}
                    onChange={(e) => setNeedsChange(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                    data-testid="checkbox-needs-change"
                  />
                  <Label htmlFor="needs-change" className="text-sm">
                    Preciso de troco
                  </Label>
                </div>
                
                {needsChange && (
                  <div className="space-y-2">
                    <Label htmlFor="change-amount">Troco para quanto?</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        R$
                      </span>
                      <Input
                        id="change-amount"
                        type="text"
                        placeholder="0,00"
                        value={changeAmount}
                        onChange={(e) => handleChangeAmountChange(e.target.value)}
                        className="pl-8"
                        data-testid="input-change-amount"
                      />
                    </div>
                    {changeAmount && parseFloat(changeAmount.replace(',', '.')) <= total && (
                      <p className="text-sm text-red-500">
                        O valor do troco deve ser maior que o total do pedido (R$ {total.toFixed(2).replace('.', ',')})
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Coupon Section */}
          <div className="space-y-3">
            <Label>Cupom de Desconto</Label>
            {!appliedCoupon ? (
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Digite o código do cupom"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && handleApplyCoupon()}
                    data-testid="input-coupon-code"
                  />
                  {couponError && (
                    <p className="text-sm text-red-500 mt-1">{couponError}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleApplyCoupon}
                  disabled={!couponCode.trim() || couponLoading}
                  data-testid="btn-apply-coupon"
                >
                  {couponLoading ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Tag className="h-4 w-4 mr-2" />
                      Aplicar
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <div>
                    <span className="font-medium text-green-800 dark:text-green-200">
                      Cupom {appliedCoupon.code} aplicado
                    </span>
                    <p className="text-sm text-green-600 dark:text-green-300">
                      {appliedCoupon.type === 'percentage' 
                        ? `${appliedCoupon.value}% de desconto`
                        : `R$ ${appliedCoupon.value.toFixed(2).replace('.', ',')} de desconto`
                      }
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveCoupon}
                  className="text-green-600 hover:text-green-700"
                  data-testid="btn-remove-coupon"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="space-y-4">
            <Separator />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Resumo do Pedido</h3>
              
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
              </div>
              
              {deliveryType === 'delivery' && (
                <div className="flex justify-between">
                  <span>Taxa de entrega:</span>
                  <span className={freeDelivery ? 'line-through text-muted-foreground' : ''}>
                    R$ {deliveryFee.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              )}
              
              {freeDelivery && deliveryType === 'delivery' && (
                <div className="flex justify-between text-green-600">
                  <span>Frete grátis!</span>
                  <span>R$ 0,00</span>
                </div>
              )}
              
              {appliedCoupon && (
                <div className="flex justify-between text-green-600">
                  <span>Desconto ({appliedCoupon.code}):</span>
                  <span>- R$ {appliedCoupon.discount.toFixed(2).replace('.', ',')}</span>
                </div>
              )}
              
              <Separator />
              
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>R$ {total.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>
          </div>

          {/* Checkout Button */}
          <Button
            onClick={handleCheckout}
            disabled={!canCheckout() || loading}
            className="w-full"
            size="lg"
            data-testid="btn-finalize-order"
          >
            {loading ? 'Processando...' : 'Finalizar Pedido'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};