import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { cart as cartApi } from '../lib/api';
import type { Cart } from '../types/api';
import { useAuth } from './AuthContext';

type CartState = {
  cart: Cart | undefined;
  loading: boolean;
  units: number;
  add: (productId: string, quantity?: number) => Promise<void>;
  setQuantity: (itemId: string, quantity: number) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
  clear: () => Promise<void>;
  apply: (next: Cart) => void;
  reload: () => Promise<void>;
};

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState<Cart | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(undefined);
      return;
    }
    setLoading(true);
    try {
      setCart(await cartApi.get());
    } catch {
      setCart(undefined);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<CartState>(
    () => ({
      cart,
      loading,
      units: cart?.totals.units ?? 0,
      add: async (productId, quantity = 1) => {
        setCart(await cartApi.add(productId, quantity));
      },
      setQuantity: async (itemId, quantity) => {
        setCart(await cartApi.setQuantity(itemId, quantity));
      },
      remove: async (itemId) => {
        setCart(await cartApi.remove(itemId));
      },
      clear: async () => {
        setCart(await cartApi.clear());
      },
      apply: (next) => setCart(next),
      reload,
    }),
    [cart, loading, reload],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart debe usarse dentro de CartProvider');
  return context;
}
