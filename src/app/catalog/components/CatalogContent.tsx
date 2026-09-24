'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit2, Trash2, X, CheckCircle2, AlertTriangle, Loader2, ChevronLeft, ChevronRight, Package, Eye, Save } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Product {
  id: string;
  product_ref: string;
  name: string;
  description: string;
  category: string;
  price: number;
  original_price: number;
  height_cm: number;
  width_cm: number;
  length_cm: number;
  material_type: string;
  images: string[];
  model_3d_url: string;
  availability: 'available' | 'limited' | 'out_of_stock' | 'discontinued';
  estimated_production_days: number;
  specifications: Record<string, string>;
  ar_model_support: boolean;
  tags: string[];
  rating: number;
  review_count: number;
  is_active: boolean;
}

interface ProductForm {
  name: string;
  description: string;
  category: string;
  price: string;
  original_price: string;
  height_cm: string;
  width_cm: string;
  length_cm: string;
  material_type: string;
  images: string;
  model_3d_url: string;
  availability: 'available' | 'limited' | 'out_of_stock' | 'discontinued';
  estimated_production_days: string;
  specifications: string;
  ar_model_support: boolean;
  tags: string;
}

const CATEGORIES = ['All', 'Tables', 'Chairs', 'Beds', 'Storage', 'Office Furniture', 'Cabinets', 'Custom Furniture'];
const PAGE_SIZE = 8;

const emptyForm: ProductForm = {
  name: '', description: '', category: 'Tables', price: '', original_price: '',
  height_cm: '', width_cm: '', length_cm: '', material_type: '',
  images: '', model_3d_url: '', availability: 'available',
  estimated_production_days: '14', specifications: '', ar_model_support: false, tags: ''
};

export default function CatalogContent() {
  const { user } = useAuth();
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [modal, setModal] = useState<'add' | 'edit' | 'delete' | 'view' | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmName, setConfirmName] = useState('');

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('products').select('*', { count: 'exact' });
    if (search) query = query.ilike('name', `%${search}%`);
    if (activeCategory !== 'All') query = query.eq('category', activeCategory);
    query = query.order('created_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const { data, count, error } = await query;
    if (!error && data) {
      setProducts(data.map((p: any) => ({
        ...p,
        images: Array.isArray(p.images) ? p.images : [],
        tags: Array.isArray(p.tags) ? p.tags : [],
        specifications: typeof p.specifications === 'object' ? p.specifications : {},
      })));
      setTotal(count || 0);
    }
    setLoading(false);
  }, [supabase, search, activeCategory, page]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  function openAdd() {
    setForm(emptyForm);
    setModal('add');
  }

  function openEdit(p: Product) {
    setSelectedProduct(p);
    setForm({
      name: p.name, description: p.description, category: p.category,
      price: String(p.price), original_price: String(p.original_price || ''),
      height_cm: String(p.height_cm || ''), width_cm: String(p.width_cm || ''),
      length_cm: String(p.length_cm || ''), material_type: p.material_type || '',
      images: (p.images || []).join('\n'), model_3d_url: p.model_3d_url || '',
      availability: p.availability, estimated_production_days: String(p.estimated_production_days || 14),
      specifications: Object.entries(p.specifications || {}).map(([k, v]) => `${k}: ${v}`).join('\n'),
      ar_model_support: p.ar_model_support, tags: (p.tags || []).join(', ')
    });
    setModal('edit');
  }

  function openView(p: Product) {
    setSelectedProduct(p);
    setModal('view');
  }

  function openDelete(p: Product) {
    setSelectedProduct(p);
    setConfirmName('');
    setModal('delete');
  }

  function parseForm() {
    const specsObj: Record<string, string> = {};
    if (form.specifications) {
      form.specifications.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const k = line.slice(0, colonIndex);
          const rest = line.slice(colonIndex + 1);
          specsObj[k.trim()] = rest.trim();
        }
      });
    }
    return {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      price: parseFloat(form.price) || 0,
      original_price: parseFloat(form.original_price) || parseFloat(form.price) || 0,
      height_cm: parseFloat(form.height_cm) || 0,
      width_cm: parseFloat(form.width_cm) || 0,
      length_cm: parseFloat(form.length_cm) || 0,
      material_type: form.material_type.trim(),
      images: form.images.split('\n').map(s => s.trim()).filter(Boolean),
      model_3d_url: form.model_3d_url.trim(),
      availability: form.availability,
      estimated_production_days: parseInt(form.estimated_production_days) || 14,
      specifications: specsObj,
      ar_model_support: form.ar_model_support,
      tags: form.tags.split(',').map(s => s.trim()).filter(Boolean),
      is_active: true,
      created_by: user?.id,
    };
  }

  async function handleAdd() {
    if (!form.name || !form.price || !form.category) {
      showToast('error', 'Name, category, and price are required');
      return;
    }
    setFormLoading(true);
    try {
      const productRef = `PRD-${Date.now().toString().slice(-6)}`;
      const { error } = await supabase.from('products').insert({ ...parseForm(), product_ref: productRef });
      if (error) throw error;
      showToast('success', `Product "${form.name}" added successfully`);
      setModal(null);
      fetchProducts();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to add product');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleEdit() {
    if (!selectedProduct || !form.name || !form.price) {
      showToast('error', 'Name and price are required');
      return;
    }
    setFormLoading(true);
    try {
      const { error } = await supabase.from('products').update(parseForm()).eq('id', selectedProduct.id);
      if (error) throw error;
      showToast('success', 'Product updated successfully');
      setModal(null);
      fetchProducts();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update product');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    if (!selectedProduct || confirmName !== selectedProduct.name) return;
    setFormLoading(true);
    try {
      const { error } = await supabase.from('products').update({ is_active: false }).eq('id', selectedProduct.id);
      if (error) throw error;
      showToast('success', 'Product removed from catalog');
      setModal(null);
      fetchProducts();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete product');
    } finally {
      setFormLoading(false);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const availabilityVariant = (a: string) =>
    a === 'available' ? 'ok' : a === 'limited' ? 'warning' : a === 'out_of_stock' ? 'danger' : 'neutral';

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white ${toast.type === 'success' ? 'bg-success' : 'bg-danger'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-[0.24em] mb-2">Product Catalog</p>
          <h1 className="text-3xl font-bold text-foreground">Furniture Collections</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Manage product listings, pricing, dimensions, and 3D model assets.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-full max-w-sm">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="input-dark w-full pl-11"
              type="search"
              placeholder="Search products"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
          <button type="button" className="btn-primary flex items-center gap-2" onClick={openAdd}>
            <Plus size={18} /> Add Product
          </button>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => { setActiveCategory(cat); setPage(0); }}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${activeCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Products', value: total, color: 'text-foreground' },
          { label: 'Available', value: products.filter(p => p.availability === 'available').length, color: 'text-success' },
          { label: 'Limited Stock', value: products.filter(p => p.availability === 'limited').length, color: 'text-warning' },
          { label: 'AR Supported', value: products.filter(p => p.ar_model_support).length, color: 'text-primary' },
        ].map((stat) => (
          <div key={stat.label} className="card-dark p-4 rounded-3xl border border-border">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-accent" />
        </div>
      ) : products.length === 0 ? (
        <div className="card-dark rounded-3xl border border-border p-16 text-center">
          <Package size={32} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No products found. Add your first product.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
          {products.map((product) => (
            <div key={product.id} className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200">
              <div className="relative h-44 bg-muted overflow-hidden">
                {product.images?.[0] ? (
                  <img src={product.images[0]} alt={`${product.name} - ${product.material_type} furniture product`} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Package size={32} className="text-muted-foreground" />
                  </div>
                )}
                {product.ar_model_support && (
                  <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full">AR</span>
                )}
                <StatusBadge
                  variant={availabilityVariant(product.availability)}
                  label={product.availability.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                />
              </div>
              <div className="p-4">
                <div className="mb-2">
                  <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{product.category} · {product.material_type}</p>
                </div>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{product.description}</p>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-lg font-bold text-foreground">${product.price.toLocaleString()}</span>
                    {product.original_price > product.price && (
                      <span className="text-xs text-muted-foreground line-through ml-2">${product.original_price.toLocaleString()}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{product.estimated_production_days}d lead</span>
                </div>
                {(product.height_cm > 0 || product.width_cm > 0 || product.length_cm > 0) && (
                  <p className="text-xs text-muted-foreground mb-3">
                    {product.length_cm}L × {product.width_cm}W × {product.height_cm}H cm
                  </p>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => openView(product)} className="flex-1 btn-secondary text-xs py-2 flex items-center justify-center gap-1">
                    <Eye size={13} /> View
                  </button>
                  <button type="button" onClick={() => openEdit(product)} className="flex-1 btn-primary text-xs py-2 flex items-center justify-center gap-1">
                    <Edit2 size={13} /> Edit
                  </button>
                  <button type="button" onClick={() => openDelete(product)} className="p-2 rounded-xl border border-border text-danger hover:bg-danger/10 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn-secondary px-3 py-2 disabled:opacity-50">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="btn-secondary px-3 py-2 disabled:opacity-50">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-foreground">{modal === 'add' ? 'Add New Product' : 'Edit Product'}</h2>
              <button type="button" onClick={() => setModal(null)} className="btn-ghost p-2"><X size={18} /></button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm text-muted-foreground md:col-span-2">
                Product Name *
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-dark w-full mt-1" placeholder="Oak Dining Table" />
              </label>
              <label className="space-y-1 text-sm text-muted-foreground">
                Category *
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input-dark w-full mt-1">
                  {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm text-muted-foreground">
                Material Type
                <input value={form.material_type} onChange={e => setForm(f => ({ ...f, material_type: e.target.value }))} className="input-dark w-full mt-1" placeholder="Solid Oak" />
              </label>
              <label className="space-y-1 text-sm text-muted-foreground">
                Price (USD) *
                <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="input-dark w-full mt-1" placeholder="1240" />
              </label>
              <label className="space-y-1 text-sm text-muted-foreground">
                Original Price (USD)
                <input type="number" value={form.original_price} onChange={e => setForm(f => ({ ...f, original_price: e.target.value }))} className="input-dark w-full mt-1" placeholder="1399" />
              </label>
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground mb-2">Dimensions (cm)</p>
                <div className="grid grid-cols-3 gap-3">
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Height
                    <input type="number" value={form.height_cm} onChange={e => setForm(f => ({ ...f, height_cm: e.target.value }))} className="input-dark w-full mt-1" placeholder="75" />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Width
                    <input type="number" value={form.width_cm} onChange={e => setForm(f => ({ ...f, width_cm: e.target.value }))} className="input-dark w-full mt-1" placeholder="90" />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Length
                    <input type="number" value={form.length_cm} onChange={e => setForm(f => ({ ...f, length_cm: e.target.value }))} className="input-dark w-full mt-1" placeholder="180" />
                  </label>
                </div>
              </div>
              <label className="space-y-1 text-sm text-muted-foreground">
                Availability
                <select value={form.availability} onChange={e => setForm(f => ({ ...f, availability: e.target.value as any }))} className="input-dark w-full mt-1">
                  <option value="available">Available</option>
                  <option value="limited">Limited Stock</option>
                  <option value="out_of_stock">Out of Stock</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </label>
              <label className="space-y-1 text-sm text-muted-foreground">
                Est. Production Days
                <input type="number" value={form.estimated_production_days} onChange={e => setForm(f => ({ ...f, estimated_production_days: e.target.value }))} className="input-dark w-full mt-1" placeholder="14" />
              </label>
              <label className="space-y-1 text-sm text-muted-foreground md:col-span-2">
                Description
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-dark w-full mt-1 min-h-[80px] resize-none" placeholder="Product description..." />
              </label>
              <label className="space-y-1 text-sm text-muted-foreground md:col-span-2">
                Image URLs (one per line)
                <textarea value={form.images} onChange={e => setForm(f => ({ ...f, images: e.target.value }))} className="input-dark w-full mt-1 min-h-[60px] resize-none" placeholder="https://example.com/image.jpg" />
              </label>
              <label className="space-y-1 text-sm text-muted-foreground md:col-span-2">
                3D Model URL
                <input value={form.model_3d_url} onChange={e => setForm(f => ({ ...f, model_3d_url: e.target.value }))} className="input-dark w-full mt-1" placeholder="https://example.com/model.glb" />
              </label>
              <label className="space-y-1 text-sm text-muted-foreground md:col-span-2">
                Specifications (key: value, one per line)
                <textarea value={form.specifications} onChange={e => setForm(f => ({ ...f, specifications: e.target.value }))} className="input-dark w-full mt-1 min-h-[80px] resize-none" placeholder="Seats: 6-8 persons&#10;Finish: Natural Satin&#10;Warranty: 2 years" />
              </label>
              <label className="space-y-1 text-sm text-muted-foreground">
                Tags (comma separated)
                <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} className="input-dark w-full mt-1" placeholder="Custom, Premium, Dining" />
              </label>
              <label className="flex items-center gap-3 text-sm text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={form.ar_model_support} onChange={e => setForm(f => ({ ...f, ar_model_support: e.target.checked }))} className="w-4 h-4 rounded" />
                AR Model Support
              </label>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
              <button type="button" onClick={modal === 'add' ? handleAdd : handleEdit} disabled={formLoading} className="btn-primary flex items-center gap-2">
                {formLoading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {modal === 'add' ? 'Add Product' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {modal === 'view' && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-foreground">{selectedProduct.name}</h2>
              <button type="button" onClick={() => setModal(null)} className="btn-ghost p-2"><X size={18} /></button>
            </div>
            {selectedProduct.images?.[0] && (
              <img src={selectedProduct.images[0]} alt={`${selectedProduct.name} product image`} className="w-full h-48 object-cover rounded-2xl mb-4" />
            )}
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground">Category</p><p className="font-semibold text-foreground">{selectedProduct.category}</p></div>
                <div><p className="text-muted-foreground">Material</p><p className="font-semibold text-foreground">{selectedProduct.material_type}</p></div>
                <div><p className="text-muted-foreground">Price</p><p className="font-semibold text-foreground">${selectedProduct.price.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground">Lead Time</p><p className="font-semibold text-foreground">{selectedProduct.estimated_production_days} days</p></div>
                <div><p className="text-muted-foreground">Dimensions</p><p className="font-semibold text-foreground">{selectedProduct.length_cm}L × {selectedProduct.width_cm}W × {selectedProduct.height_cm}H cm</p></div>
                <div><p className="text-muted-foreground">AR Support</p><p className="font-semibold text-foreground">{selectedProduct.ar_model_support ? 'Yes' : 'No'}</p></div>
              </div>
              <div><p className="text-muted-foreground mb-1">Description</p><p className="text-foreground">{selectedProduct.description}</p></div>
              {Object.keys(selectedProduct.specifications || {}).length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2">Specifications</p>
                  <div className="rounded-xl border border-border bg-muted p-3 space-y-1">
                    {Object.entries(selectedProduct.specifications).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-semibold text-foreground">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => { setModal(null); openEdit(selectedProduct); }} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <Edit2 size={14} /> Edit Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {modal === 'delete' && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center">
                <Trash2 size={18} className="text-danger" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Remove Product</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Type <strong className="text-foreground">{selectedProduct.name}</strong> to confirm removal.
            </p>
            <input
              value={confirmName}
              onChange={e => setConfirmName(e.target.value)}
              className="input-dark w-full mb-4"
              placeholder={selectedProduct.name}
            />
            <div className="flex gap-3">
              <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={confirmName !== selectedProduct.name || formLoading}
                className="flex-1 rounded-2xl bg-danger py-3 text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {formLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}