'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Heart, ShoppingCart, Star, CheckCircle2, X, Loader2, Package, Minus, Plus, ArrowRight, MapPin, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/ui/StatusBadge';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Product {
  id: string;
  product_ref: string;
  name: string;
  category: string;
  price: number;
  original_price: number;
  rating: number;
  review_count: number;
  availability: string;
  images: string[];
  description: string;
  specifications: Record<string, string>;
  material_type: string;
  height_cm: number;
  width_cm: number;
  length_cm: number;
  estimated_production_days: number;
  ar_model_support: boolean;
  tags: string[];
}

interface CartItem {
  product: Product;
  quantity: number;
  customization: string;
}

type CheckoutStep = 'browse' | 'cart' | 'checkout' | 'confirm';

const categories = ['All', 'Tables', 'Chairs', 'Beds', 'Storage', 'Office Furniture', 'Cabinets'];

export default function CustomerShopContent() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<CheckoutStep>('browse');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({
    address: '', city: '', phone: profile?.phone || '', notes: ''
  });
  const [placedOrderRef, setPlacedOrderRef] = useState('');

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .neq('availability', 'discontinued')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setProducts(data.map((p: any) => ({
          ...p,
          images: Array.isArray(p.images) ? p.images : [],
          tags: Array.isArray(p.tags) ? p.tags : [],
          specifications: typeof p.specifications === 'object' ? p.specifications : {},
        })));
      }
      setLoading(false);
    };
    fetchProducts();
  }, [supabase]);

  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function toggleFavorite(id: string) {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  }

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1, customization: '' }];
    });
    showToast('success', `${product.name} added to cart`);
  }

  function removeFromCart(productId: string) {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  }

  function updateQuantity(productId: string, qty: number) {
    if (qty <= 0) { removeFromCart(productId); return; }
    setCart(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: qty } : i));
  }

  function updateCustomization(productId: string, notes: string) {
    setCart(prev => prev.map(i => i.product.id === productId ? { ...i, customization: notes } : i));
  }

  async function placeOrder() {
    if (!user || cart.length === 0) return;
    if (!deliveryForm.address || !deliveryForm.city) {
      showToast('error', 'Please fill in delivery address and city');
      return;
    }
    setOrderLoading(true);
    try {
      const orderRef = `ORD-${Date.now().toString().slice(-6)}`;
      const firstItem = cart[0];

      const { data: orderData, error } = await supabase.from('orders').insert({
        order_ref: orderRef,
        customer_id: user.id,
        customer_name: profile?.full_name || user.email,
        product_name: cart.length === 1 ? firstItem.product.name : `${firstItem.product.name} + ${cart.length - 1} more`,
        product_category: firstItem.product.category,
        product_id: firstItem.product.id,
        amount: cartTotal,
        status: 'pending',
        extended_status: 'pending',
        current_stage: 'cutting',
        completion_pct: 0,
        delivery_address: deliveryForm.address,
        delivery_city: deliveryForm.city,
        delivery_phone: deliveryForm.phone,
        quantity: cartCount,
        customization_notes: cart.map(i => i.customization).filter(Boolean).join('; '),
        notes: deliveryForm.notes,
        due_date: new Date(Date.now() + (firstItem.product.estimated_production_days || 14) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      }).select().single();

      if (error) throw error;

      // Clear cart items
      await supabase.from('cart_items').delete().eq('customer_id', user.id).eq('status', 'active');

      // Send notification
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Order Placed Successfully',
        message: `Your order ${orderRef} has been placed. We will confirm it shortly.`,
        notification_type: 'success',
        entity_type: 'orders',
        entity_id: orderData?.id,
      });

      setPlacedOrderRef(orderRef);
      setCart([]);
      setStep('confirm');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to place order');
    } finally {
      setOrderLoading(false);
    }
  }

  const getAvailabilityVariant = (a: string) =>
    a === 'available' ? 'ok' : a === 'limited' ? 'warning' : a === 'out_of_stock' ? 'danger' : 'neutral';

  const getAvailabilityLabel = (a: string) =>
    a === 'available' ? 'In Stock' : a === 'limited' ? 'Limited' : a === 'out_of_stock' ? 'Out of Stock' : 'Unavailable';

  if (step === 'confirm') {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
          <CheckCircle2 size={40} className="text-success" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Order Placed!</h2>
          <p className="text-muted-foreground">Your order reference is</p>
          <p className="text-3xl font-bold text-primary mt-2">{placedOrderRef}</p>
        </div>
        <div className="card-dark rounded-3xl border border-border p-6 max-w-md w-full text-sm space-y-2">
          <p className="text-muted-foreground">You can track your order progress in your dashboard. Our team will confirm your order shortly.</p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => router.push('/customer-dashboard')} className="btn-primary flex items-center gap-2">
            <Package size={16} /> Track My Order
          </button>
          <button type="button" onClick={() => setStep('browse')} className="btn-secondary">Continue Shopping</button>
        </div>
      </div>
    );
  }

  if (step === 'checkout') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setStep('cart')} className="btn-ghost p-2">←</button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Checkout</h1>
            <p className="text-sm text-muted-foreground">Enter your delivery details</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="card-dark rounded-3xl border border-border p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <MapPin size={18} className="text-primary" /> Delivery Information
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm text-muted-foreground md:col-span-2">
                  Street Address *
                  <input value={deliveryForm.address} onChange={e => setDeliveryForm(f => ({ ...f, address: e.target.value }))} className="input-dark w-full mt-1" placeholder="123 Main Street" />
                </label>
                <label className="space-y-1 text-sm text-muted-foreground">
                  City *
                  <input value={deliveryForm.city} onChange={e => setDeliveryForm(f => ({ ...f, city: e.target.value }))} className="input-dark w-full mt-1" placeholder="Manila" />
                </label>
                <label className="space-y-1 text-sm text-muted-foreground">
                  Phone Number
                  <input value={deliveryForm.phone} onChange={e => setDeliveryForm(f => ({ ...f, phone: e.target.value }))} className="input-dark w-full mt-1" placeholder="+63 912 345 6789" />
                </label>
                <label className="space-y-1 text-sm text-muted-foreground md:col-span-2">
                  Special Instructions
                  <textarea value={deliveryForm.notes} onChange={e => setDeliveryForm(f => ({ ...f, notes: e.target.value }))} className="input-dark w-full mt-1 min-h-[80px] resize-none" placeholder="Any special delivery instructions..." />
                </label>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="card-dark rounded-3xl border border-border p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Order Summary</h2>
              <div className="space-y-3 mb-4">
                {cart.map(item => (
                  <div key={item.product.id} className="flex justify-between gap-3 text-sm">
                    <span className="text-muted-foreground truncate">{item.product.name} × {item.quantity}</span>
                    <span className="font-semibold text-foreground whitespace-nowrap">${(item.product.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-3 flex justify-between text-base font-bold text-foreground">
                <span>Total</span>
                <span>${cartTotal.toLocaleString()}</span>
              </div>
              <button
                type="button"
                onClick={placeOrder}
                disabled={orderLoading}
                className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
              >
                {orderLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Place Order
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'cart') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setStep('browse')} className="btn-ghost p-2">←</button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Your Cart</h1>
              <p className="text-sm text-muted-foreground">{cartCount} item{cartCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {cart.length > 0 && (
            <button type="button" onClick={() => setStep('checkout')} className="btn-primary flex items-center gap-2">
              Checkout <ArrowRight size={16} />
            </button>
          )}
        </div>
        {cart.length === 0 ? (
          <div className="card-dark rounded-3xl border border-border p-16 text-center">
            <ShoppingCart size={32} className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">Your cart is empty</p>
            <button type="button" onClick={() => setStep('browse')} className="btn-primary mt-4">Browse Products</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {cart.map(item => (
                <div key={item.product.id} className="card-dark rounded-3xl border border-border p-5">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-muted shrink-0">
                      {item.product.images?.[0] ? (
                        <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full"><Package size={20} className="text-muted-foreground" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-foreground">{item.product.name}</h3>
                          <p className="text-xs text-muted-foreground">{item.product.category} · {item.product.material_type}</p>
                        </div>
                        <button type="button" onClick={() => removeFromCart(item.product.id)} className="text-muted-foreground hover:text-danger transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
                            <Minus size={12} />
                          </button>
                          <span className="text-sm font-semibold text-foreground w-6 text-center">{item.quantity}</span>
                          <button type="button" onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
                            <Plus size={12} />
                          </button>
                        </div>
                        <span className="font-bold text-foreground">${(item.product.price * item.quantity).toLocaleString()}</span>
                      </div>
                      <input
                        value={item.customization}
                        onChange={e => updateCustomization(item.product.id, e.target.value)}
                        className="input-dark w-full mt-2 text-xs"
                        placeholder="Customization notes (optional)"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="card-dark rounded-3xl border border-border p-6 h-fit">
              <h2 className="text-lg font-semibold text-foreground mb-4">Summary</h2>
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal ({cartCount} items)</span>
                  <span>${cartTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery</span>
                  <span className="text-success">Free</span>
                </div>
              </div>
              <div className="border-t border-border pt-3 flex justify-between font-bold text-foreground">
                <span>Total</span>
                <span>${cartTotal.toLocaleString()}</span>
              </div>
              <button type="button" onClick={() => setStep('checkout')} className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
                Proceed to Checkout <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white ${toast.type === 'success' ? 'bg-success' : 'bg-danger'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : <X size={15} />}
          {toast.message}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Shop Our Collection</h1>
          <p className="text-sm text-muted-foreground mt-2">Handcrafted furniture made with premium woods and expert craftsmanship.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full max-w-sm">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="search" placeholder="Search products" value={search} onChange={e => setSearch(e.target.value)} className="input-dark w-full pl-11" />
          </div>
          <button type="button" className="btn-primary flex items-center gap-2 relative" onClick={() => setStep('cart')}>
            <ShoppingCart size={18} />
            Cart
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-danger text-white text-xs font-bold flex items-center justify-center">{cartCount}</span>
            )}
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {categories.map(cat => (
          <button key={cat} onClick={() => setSelectedCategory(cat)} className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${selectedCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-accent" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="card-dark rounded-3xl border border-border p-16 text-center">
          <Package size={32} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProducts.map(product => {
            const inCart = cart.some(i => i.product.id === product.id);
            const cartItem = cart.find(i => i.product.id === product.id);
            return (
              <div key={product.id} className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200">
                <div className="relative">
                  {product.images?.[0] ? (
                    <img src={product.images[0]} alt={`${product.name} - handcrafted ${product.material_type} furniture`} className="w-full h-48 object-cover" />
                  ) : (
                    <div className="w-full h-48 bg-muted flex items-center justify-center">
                      <Package size={32} className="text-muted-foreground" />
                    </div>
                  )}
                  <button onClick={() => toggleFavorite(product.id)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm hover:bg-white transition-colors">
                    <Heart size={16} className={favorites.includes(product.id) ? 'text-danger fill-danger' : 'text-muted-foreground'} />
                  </button>
                  {product.original_price > product.price && (
                    <div className="absolute top-3 left-3 bg-danger text-white text-xs font-bold px-2 py-1 rounded">SALE</div>
                  )}
                  {product.ar_model_support && (
                    <div className="absolute bottom-3 left-3 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full">AR Preview</div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h3 className="font-semibold text-foreground text-lg">{product.name}</h3>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{product.category}</p>
                    </div>
                    <StatusBadge variant={getAvailabilityVariant(product.availability)} label={getAvailabilityLabel(product.availability)} />
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{product.description}</p>
                  {(product.height_cm > 0 || product.width_cm > 0) && (
                    <p className="text-xs text-muted-foreground mb-2">{product.length_cm}L × {product.width_cm}W × {product.height_cm}H cm</p>
                  )}
                  <div className="flex items-center gap-1 mb-3">
                    <Star size={14} className="text-warning fill-warning" />
                    <span className="text-sm font-semibold text-foreground">{product.rating}</span>
                    <span className="text-xs text-muted-foreground">({product.review_count} reviews)</span>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-foreground">${product.price.toLocaleString()}</span>
                      {product.original_price > product.price && (
                        <span className="text-sm text-muted-foreground line-through">${product.original_price.toLocaleString()}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{product.estimated_production_days}d lead time</span>
                  </div>
                  <div className="space-y-2">
                    {inCart ? (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => updateQuantity(product.id, (cartItem?.quantity || 1) - 1)} className="w-9 h-9 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors">
                          <Minus size={14} />
                        </button>
                        <span className="flex-1 text-center font-semibold text-foreground">{cartItem?.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(product.id, (cartItem?.quantity || 1) + 1)} className="w-9 h-9 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors">
                          <Plus size={14} />
                        </button>
                        <button type="button" onClick={() => setStep('cart')} className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-1">
                          <ShoppingCart size={14} /> View Cart
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={product.availability === 'out_of_stock'}
                        onClick={() => addToCart(product)}
                        className={`w-full rounded-xl py-2.5 font-semibold transition-colors flex items-center justify-center gap-2 ${product.availability !== 'out_of_stock' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
                      >
                        <ShoppingCart size={16} />
                        {product.availability === 'out_of_stock' ? 'Out of Stock' : 'Add to Cart'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}