/**
 * Cart + Wishlist context — every mutation hits the Turso-backed API,
 * then the local state is refreshed from the server response. Nothing is
 * persisted in localStorage; the server is the source of truth.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';

const ShopContext = createContext(null);

export function ShopProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();

  const [cart, setCart] = useState({ items: [], subtotal: 0, shipping: 0, total: 0, itemCount: 0, hasDigital: false, hasPhysical: false, has_issues: false });
  const [cartLoading, setCartLoading] = useState(false);
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [wishList, setWishList] = useState([]);
  const [adding, setAdding] = useState(null);      // product id currently being added
  const [cartBump, setCartBump] = useState(0);      // triggers cart badge animation

  const loadCart = useCallback(async () => {
    if (!user) { setCart((c) => ({ ...c, items: [], itemCount: 0, subtotal: 0, shipping: 0, total: 0 })); return; }
    setCartLoading(true);
    try {
      const data = await api.get('/api/cart');
      setCart(data.cart);
    } catch (err) {
      // keep previous cart on transient errors; surface message
      if (err.status !== 0) toast.error(err.message);
    } finally {
      setCartLoading(false);
    }
  }, [user, toast]);

  const loadWishlist = useCallback(async () => {
    if (!user) { setWishlistIds(new Set()); setWishList([]); return; }
    try {
      const data = await api.get('/api/wishlist');
      setWishList(data.wishlist);
      setWishlistIds(new Set(data.wishlist.map((w) => w.id)));
    } catch { /* wishlist is non-critical */ }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      loadCart();
      loadWishlist();
    }
  }, [authLoading, loadCart, loadWishlist]);

  const addToCart = useCallback(async (productId, quantity = 1) => {
    if (!user) return { ok: false, needsAuth: true };
    setAdding(productId);
    try {
      const data = await api.post('/api/cart/items', { product_id: productId, quantity });
      setCart(data.cart);
      setCartBump((n) => n + 1);
      toast.success('Added to cart');
      return { ok: true };
    } catch (err) {
      toast.error(err.message);
      return { ok: false, error: err };
    } finally {
      setAdding(null);
    }
  }, [user, toast]);

  const setQuantity = useCallback(async (productId, quantity) => {
    try {
      const data = await api.patch(`/api/cart/items/${productId}`, { quantity });
      setCart(data.cart);
      return { ok: true };
    } catch (err) {
      toast.error(err.message);
      // re-sync in case stock changed
      loadCart();
      return { ok: false, error: err };
    }
  }, [toast, loadCart]);

  const removeFromCart = useCallback(async (productId) => {
    try {
      const data = await api.del(`/api/cart/items/${productId}`);
      setCart(data.cart);
      toast.success('Product removed from cart');
      return { ok: true };
    } catch (err) {
      toast.error(err.message);
      return { ok: false };
    }
  }, [toast]);

  const clearCart = useCallback(async () => {
    try {
      const data = await api.del('/api/cart');
      setCart(data.cart);
      toast.success('Cart cleared');
    } catch (err) {
      toast.error(err.message);
    }
  }, [toast]);

  const toggleWishlist = useCallback(async (productId) => {
    if (!user) return { ok: false, needsAuth: true };
    try {
      const data = await api.post(`/api/wishlist/${productId}`);
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (data.wishlisted) next.add(productId); else next.delete(productId);
        return next;
      });
      toast.success(data.message);
      // keep full list in sync
      loadWishlist();
      return { ok: true, wishlisted: data.wishlisted };
    } catch (err) {
      toast.error(err.message);
      return { ok: false, error: err };
    }
  }, [user, toast, loadWishlist]);

  const removeWishlist = useCallback(async (productId) => {
    try {
      await api.del(`/api/wishlist/${productId}`);
      setWishlistIds((prev) => { const n = new Set(prev); n.delete(productId); return n; });
      loadWishlist();
      toast.success('Removed from wishlist');
    } catch (err) { toast.error(err.message); }
  }, [toast, loadWishlist]);

  const value = useMemo(() => ({
    cart, cartLoading, addToCart, setQuantity, removeFromCart, clearCart,
    reloadCart: loadCart, adding, cartBump,
    wishlistIds, wishlist: wishList, toggleWishlist, removeWishlist, reloadWishlist: loadWishlist,
    cartCount: cart.itemCount || 0,
    wishCount: wishList.length,
  }), [cart, cartLoading, addToCart, setQuantity, removeFromCart, clearCart, loadCart, adding,
    cartBump, wishlistIds, wishList, toggleWishlist, removeWishlist, loadWishlist]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used inside <ShopProvider>');
  return ctx;
}
