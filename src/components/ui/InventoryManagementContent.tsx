'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Package, Truck, AlertTriangle, CheckCircle2, Plus, Edit2, Trash2, Loader2, X } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { createClient } from '@/lib/supabase/client';

interface InventoryItem {
  id: string;
  item_ref: string;
  name: string;
  category: string;
  supplier: string;
  stock_level: number;
  min_stock: number;
  unit: string;
  location: string;
  cost_per_unit: number;
  is_active: boolean;
  last_updated: string;
}

interface ItemForm {
  item_ref: string;
  name: string;
  category: string;
  supplier: string;
  stock_level: number;
  min_stock: number;
  unit: string;
  location: string;
  cost_per_unit: number;
}

const CATEGORIES = ['All', 'Wood', 'Hardware', 'Finishing', 'Tools', 'Other'];

export default function InventoryManagementContent() {
  const supabase = createClient();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [modal, setModal] = useState<'add' | 'edit' | 'delete' | 'stock' | null>(null);
  const [selectedItemData, setSelectedItemData] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<ItemForm>({ item_ref: '', name: '', category: 'Wood', supplier: '', stock_level: 0, min_stock: 0, unit: 'units', location: '', cost_per_unit: 0 });
  const [stockAdjust, setStockAdjust] = useState(0);
  const [formLoading, setFormLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  const fetchItems = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('inventory').select('*').eq('is_active', true);
    if (search) query = query.ilike('name', `%${search}%`);
    if (selectedCategory !== 'All') query = query.eq('category', selectedCategory);
    query = query.order('name');
    const { data, error } = await query;
    if (!error && data) setItems(data as InventoryItem[]);
    setLoading(false);
  }, [supabase, search, selectedCategory]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function openEdit(item: InventoryItem) {
    setSelectedItemData(item);
    setForm({ item_ref: item.item_ref, name: item.name, category: item.category, supplier: item.supplier, stock_level: item.stock_level, min_stock: item.min_stock, unit: item.unit, location: item.location, cost_per_unit: item.cost_per_unit });
    setModal('edit');
  }

  function openStock(item: InventoryItem) {
    setSelectedItemData(item);
    setStockAdjust(0);
    setModal('stock');
  }

  async function handleAdd() {
    if (!form.name || !form.item_ref) return;
    setFormLoading(true);
    try {
      const { error } = await supabase.from('inventory').insert({ ...form, is_active: true, last_updated: new Date().toISOString() });
      if (error) throw error;
      showToast('success', 'Item added successfully');
      setModal(null);
      fetchItems();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to add item');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleEdit() {
    if (!selectedItemData) return;
    setFormLoading(true);
    try {
      const { error } = await supabase.from('inventory').update({ ...form, last_updated: new Date().toISOString() }).eq('id', selectedItemData.id);
      if (error) throw error;
      showToast('success', 'Item updated successfully');
      setModal(null);
      fetchItems();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update item');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    if (!selectedItemData) return;
    setFormLoading(true);
    try {
      const { error } = await supabase.from('inventory').update({ is_active: false }).eq('id', selectedItemData.id);
      if (error) throw error;
      showToast('success', 'Item removed from inventory');
      setModal(null);
      fetchItems();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete item');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleStockUpdate() {
    if (!selectedItemData) return;
    setFormLoading(true);
    try {
      const newStock = Math.max(0, selectedItemData.stock_level + stockAdjust);
      const { error } = await supabase.from('inventory').update({ stock_level: newStock, last_updated: new Date().toISOString() }).eq('id', selectedItemData.id);
      if (error) throw error;
      showToast('success', `Stock updated to ${newStock} ${selectedItemData.unit}`);
      setModal(null);
      fetchItems();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update stock');
    } finally {
      setFormLoading(false);
    }
  }

  const getStatusVariant = (item: InventoryItem) => {
    if (item.stock_level === 0) return 'danger';
    if (item.stock_level < item.min_stock) return 'warning';
    return 'ok';
  };

  const getStatusLabel = (item: InventoryItem) => {
    if (item.stock_level === 0) return 'Out of Stock';
    if (item.stock_level < item.min_stock) return 'Low Stock';
    return 'In Stock';
  };

  const activeItem = items.find((i) => i.id === selectedItem);
  const lowStockCount = items.filter((i) => i.stock_level < i.min_stock && i.stock_level > 0).length;
  const outOfStockCount = items.filter((i) => i.stock_level === 0).length;

  const ItemFormFields = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Item Ref *</label>
          <input type="text" value={form.item_ref} onChange={(e) => setForm((f) => ({ ...f, item_ref: e.target.value }))} className="input-dark w-full text-sm" placeholder="MAT-1001" />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Category</label>
          <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="input-dark w-full text-sm">
            {['Wood', 'Hardware', 'Finishing', 'Tools', 'Other'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">Name *</label>
        <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input-dark w-full text-sm" placeholder="Oak Wood Planks" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Supplier</label>
          <input type="text" value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} className="input-dark w-full text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Location</label>
          <input type="text" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className="input-dark w-full text-sm" placeholder="Warehouse A-12" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Stock Level</label>
          <input type="number" value={form.stock_level} onChange={(e) => setForm((f) => ({ ...f, stock_level: Number(e.target.value) }))} className="input-dark w-full text-sm" min={0} />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Min Stock</label>
          <input type="number" value={form.min_stock} onChange={(e) => setForm((f) => ({ ...f, min_stock: Number(e.target.value) }))} className="input-dark w-full text-sm" min={0} />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Unit</label>
          <input type="text" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} className="input-dark w-full text-sm" placeholder="boards" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">Cost per Unit ($)</label>
        <input type="number" value={form.cost_per_unit} onChange={(e) => setForm((f) => ({ ...f, cost_per_unit: Number(e.target.value) }))} className="input-dark w-full text-sm" min={0} step={0.01} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold"
          style={{ background: toast.type === 'success' ? '#22C55E' : '#EF4444', color: '#fff' }}>
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          {toast.message}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-sm text-muted-foreground mt-2">Track raw materials, monitor stock levels, and manage supplier relationships.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="search" placeholder="Search inventory" value={search} onChange={(e) => setSearch(e.target.value)} className="input-dark w-full pl-10" />
          </div>
          <button onClick={() => { setForm({ item_ref: '', name: '', category: 'Wood', supplier: '', stock_level: 0, min_stock: 0, unit: 'units', location: '', cost_per_unit: 0 }); setModal('add'); }} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Item
          </button>
        </div>
      </div>

      {/* Alerts */}
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {outOfStockCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm font-semibold">
              <AlertTriangle size={14} /> {outOfStockCount} item{outOfStockCount > 1 ? 's' : ''} out of stock
            </div>
          )}
          {lowStockCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-warning/10 border border-warning/30 text-warning text-sm font-semibold">
              <AlertTriangle size={14} /> {lowStockCount} item{lowStockCount > 1 ? 's' : ''} low on stock
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button key={cat} onClick={() => setSelectedCategory(cat)} className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${selectedCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-accent" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 card-dark rounded-3xl border border-border">
              <Package size={32} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No inventory items found</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} onClick={() => setSelectedItem(item.id === selectedItem ? null : item.id)}
                className={`rounded-3xl border p-5 cursor-pointer transition-all ${selectedItem === item.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/50'}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Package size={20} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">{item.supplier} • {item.category} • {item.item_ref}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-bold text-foreground">{item.stock_level}</span>
                      <span className="text-sm text-muted-foreground">{item.unit}</span>
                    </div>
                    <StatusBadge variant={getStatusVariant(item)} label={getStatusLabel(item)} />
                  </div>
                </div>

                {selectedItem === item.id && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                      <div><p className="text-muted-foreground">Location</p><p className="font-semibold text-foreground">{item.location}</p></div>
                      <div><p className="text-muted-foreground">Min Stock</p><p className="font-semibold text-foreground">{item.min_stock} {item.unit}</p></div>
                      <div><p className="text-muted-foreground">Cost/Unit</p><p className="font-semibold text-foreground">${item.cost_per_unit}</p></div>
                      <div><p className="text-muted-foreground">Last Updated</p><p className="font-semibold text-foreground">{new Date(item.last_updated).toLocaleDateString()}</p></div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); openStock(item); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 text-accent text-xs font-semibold hover:bg-primary/30 transition-all">
                        <Truck size={12} /> Update Stock
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); openEdit(item); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold hover:text-foreground transition-all">
                        <Edit2 size={12} /> Edit
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedItemData(item); setModal('delete'); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger/10 text-danger text-xs font-semibold hover:bg-danger/20 transition-all">
                        <Trash2 size={12} /> Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-border bg-card p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Inventory Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Total Items</span><span className="font-semibold text-foreground">{items.length}</span></div>
              <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">In Stock</span><span className="font-semibold text-success">{items.filter((i) => i.stock_level >= i.min_stock).length}</span></div>
              <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Low Stock</span><span className="font-semibold text-warning">{lowStockCount}</span></div>
              <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Out of Stock</span><span className="font-semibold text-danger">{outOfStockCount}</span></div>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button onClick={() => { setForm({ item_ref: '', name: '', category: 'Wood', supplier: '', stock_level: 0, min_stock: 0, unit: 'units', location: '', cost_per_unit: 0 }); setModal('add'); }} className="w-full flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground hover:bg-muted transition-all">
                <Plus size={16} /> Add New Item
              </button>
              <button onClick={() => setSelectedCategory('All')} className="w-full flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground hover:bg-muted transition-all">
                <Package size={16} /> View All Items
              </button>
              {lowStockCount > 0 && (
                <button onClick={() => {}} className="w-full flex items-center justify-center gap-2 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning hover:bg-warning/20 transition-all">
                  <AlertTriangle size={16} /> {lowStockCount} Reorder Alerts
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {modal === 'add' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setModal(null)}>
          <div className="card-dark rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">Add Inventory Item</h3>
              <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <ItemFormFields />
            <div className="flex gap-3 mt-5">
              <button onClick={handleAdd} disabled={formLoading || !form.name || !form.item_ref} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {formLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {formLoading ? 'Adding...' : 'Add Item'}
              </button>
              <button onClick={() => setModal(null)} className="btn-secondary px-4">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {modal === 'edit' && selectedItemData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setModal(null)}>
          <div className="card-dark rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">Edit Item</h3>
              <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <ItemFormFields />
            <div className="flex gap-3 mt-5">
              <button onClick={handleEdit} disabled={formLoading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {formLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {formLoading ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => setModal(null)} className="btn-secondary px-4">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Update Modal */}
      {modal === 'stock' && selectedItemData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setModal(null)}>
          <div className="card-dark rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">Update Stock</h3>
              <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{selectedItemData.name} — Current: <strong className="text-foreground">{selectedItemData.stock_level} {selectedItemData.unit}</strong></p>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Adjustment (+ to add, - to remove)</label>
              <input type="number" value={stockAdjust} onChange={(e) => setStockAdjust(Number(e.target.value))} className="input-dark w-full" placeholder="e.g. +50 or -10" />
              <p className="text-xs text-muted-foreground mt-1">New total: {Math.max(0, selectedItemData.stock_level + stockAdjust)} {selectedItemData.unit}</p>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleStockUpdate} disabled={formLoading || stockAdjust === 0} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {formLoading ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
                {formLoading ? 'Updating...' : 'Update Stock'}
              </button>
              <button onClick={() => setModal(null)} className="btn-secondary px-4">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {modal === 'delete' && selectedItemData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setModal(null)}>
          <div className="card-dark rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground mb-3">Remove Item</h3>
            <p className="text-sm text-muted-foreground mb-5">Remove <strong className="text-foreground">{selectedItemData.name}</strong> from inventory? This will mark it as inactive.</p>
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={formLoading} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30 transition-all">
                {formLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Remove
              </button>
              <button onClick={() => setModal(null)} className="btn-secondary px-4">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}