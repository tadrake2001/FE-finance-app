import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Cart } from '@/services/api/types';
import { cartApi } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface CartContextType {
  cart: Cart | null;
  isLoading: boolean;
  addToCart: (productId: string, quantity: number, editionName?: string | null) => Promise<void>;
  updateCartItem: (productId: string, quantity: number, editionName?: string | null) => Promise<void>;
  removeCartItem: (productId: string, editionName?: string | null) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const refreshCart = async () => {
    try {
      const cartData = await cartApi.getCart();
      setCart(cartData);
    } catch (error) {
      console.error('Failed to fetch cart:', error);
      toast({
        title: 'Error',
        description: 'Failed to load cart',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addToCart = async (productId: string, quantity: number, editionName?: string | null) => {
    try {
      const updatedCart = await cartApi.addItem({ productId, quantity, editionName });
      setCart(updatedCart);
      toast({
        title: 'Success',
        description: 'Item added to cart',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add item to cart',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateCartItem = async (productId: string, quantity: number, editionName?: string | null) => {
    try {
      const updatedCart = await cartApi.updateItem({ productId, quantity, editionName });
      setCart(updatedCart);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update cart item',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const removeCartItem = async (productId: string, editionName?: string | null) => {
    try {
      const updatedCart = await cartApi.removeItem({ productId, editionName });
      setCart(updatedCart);
      toast({
        title: 'Success',
        description: 'Item removed from cart',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove item from cart',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const clearCart = async () => {
    try {
      await cartApi.clearCart();
      setCart({ ...cart!, items: [], totalPrice: 0 });
      toast({
        title: 'Success',
        description: 'Cart cleared',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to clear cart',
        variant: 'destructive',
      });
      throw error;
    }
  };

  useEffect(() => {
    refreshCart();
  }, []);

  const value: CartContextType = {
    cart,
    isLoading,
    addToCart,
    updateCartItem,
    removeCartItem,
    clearCart,
    refreshCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}