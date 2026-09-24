'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RotateCcw, Maximize2, Minimize2, Smartphone, Info, ChevronRight,
  Camera, Loader2, ZoomIn, ZoomOut, RefreshCw, Package, Ruler,
  Layers, Palette, Weight, Wrench, Heart, Clock, Hash, CheckCircle2
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';


type ViewMode = 'photo' | '3d' | 'ar';

interface ProductDetail3DProps {
  order?: any;
}

interface SpecItem {
  icon: React.ElementType;
  label: string;
  value: string;
  highlight?: boolean;
}

export default function ProductDetail3D({ order }: ProductDetail3DProps) {
  const supabase = createClient();
  const [viewMode, setViewMode] = useState<ViewMode>('photo');
  const [rotation, setRotation] = useState({ x: -15, y: 30 });
  const [scale, setScale] = useState(1);
  const [arStep, setArStep] = useState<'intro' | 'camera'>('intro');
  const [showSpecs, setShowSpecs] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Drag state
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; startRot: { x: number; y: number } }>({
    active: false, startX: 0, startY: 0, startRot: { x: 0, y: 0 }
  });
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!order?.product_id) return;
    const fetchProduct = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('id', order.product_id)
        .single();
      if (data) {
        setProduct({
          ...data,
          images: Array.isArray(data.images) ? data.images : [],
          specifications: typeof data.specifications === 'object' ? data.specifications : {},
        });
      }
      setLoading(false);
    };
    fetchProduct();
  }, [order?.product_id, supabase]);

  // Mouse drag handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (viewMode !== '3d') return;
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, startRot: { ...rotation } };
  }, [viewMode, rotation]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setRotation({
      x: Math.max(-60, Math.min(60, dragRef.current.startRot.x + dy * 0.4)),
      y: dragRef.current.startRot.y + dx * 0.5,
    });
  }, []);

  const onMouseUp = useCallback(() => { dragRef.current.active = false; }, []);

  // Touch drag handlers
  const touchStartRef = useRef<{ x: number; y: number; rot: { x: number; y: number } } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (viewMode !== '3d') return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, rot: { ...rotation } };
  }, [viewMode, rotation]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    e.preventDefault();
    const t = e.touches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    setRotation({
      x: Math.max(-60, Math.min(60, touchStartRef.current.rot.x + dy * 0.4)),
      y: touchStartRef.current.rot.y + dx * 0.5,
    });
  }, []);

  const onTouchEnd = useCallback(() => { touchStartRef.current = null; }, []);

  const handleZoomIn = () => setScale(v => Math.min(2, +(v + 0.15).toFixed(2)));
  const handleZoomOut = () => setScale(v => Math.max(0.4, +(v - 0.15).toFixed(2)));
  const handleReset = () => { setRotation({ x: -15, y: 30 }); setScale(1); };

  const productName = product?.name || order?.product_name || 'Your Furniture';
  const productImage = product?.images?.[0] || '';
  const dimensions = product
    ? `${product.length_cm || 0}L × ${product.width_cm || 0}W × ${product.height_cm || 0}H cm`
    : order?.dimensions || 'Dimensions loading...';

  const specs: SpecItem[] = [
    { icon: Ruler, label: 'Dimensions', value: dimensions },
    { icon: Layers, label: 'Material', value: product?.material_type || order?.material || 'Solid Wood' },
    { icon: Package, label: 'Wood Type', value: product?.wood_type || product?.specifications?.wood_type || 'Oak' },
    { icon: Palette, label: 'Finish', value: product?.finish || product?.specifications?.finish || order?.product_category || 'Natural' },
    { icon: Weight, label: 'Weight', value: product?.weight_kg ? `${product.weight_kg} kg` : product?.specifications?.weight || 'N/A' },
    { icon: Wrench, label: 'Assembly', value: product?.assembly_required ? 'Required' : product?.specifications?.assembly || 'Pre-assembled' },
    { icon: Heart, label: 'Care', value: product?.care_instructions || product?.specifications?.care || 'Wipe with dry cloth' },
    { icon: Clock, label: 'Est. Completion', value: order?.due_date || product?.estimated_production_days ? `${product?.estimated_production_days} days` : 'TBD', highlight: true },
    { icon: Hash, label: 'Queue Position', value: order?.queue_position ? `#${order.queue_position}` : '—', highlight: true },
    { icon: CheckCircle2, label: 'Order Status', value: order?.extended_status || order?.status || 'Pending', highlight: true },
  ];

  const viewModes = [
    { key: 'photo' as ViewMode, label: 'Static Photo', desc: 'High-res product photo', emoji: '📷' },
    { key: '3d' as ViewMode, label: '3D Preview', desc: 'Interactive 3D model', emoji: '🎲' },
    { key: 'ar' as ViewMode, label: 'View in My Room', desc: 'AR placement mode', emoji: '🏠' },
  ];

  const activeViewportClass = viewMode === 'photo' ?'bg-slate-100 dark:bg-slate-900' :'bg-gradient-to-br from-violet-200 via-purple-200 to-white dark:from-purple-950 dark:via-violet-900 dark:to-slate-950';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-purple-600 dark:text-purple-300" />
      </div>
    );
  }

  const viewportContent = (
    <div
      ref={viewportRef}
      className={`relative overflow-hidden rounded-2xl border border-border ${activeViewportClass} transition-colors ${isFullscreen ? 'h-full' : 'min-h-[320px]'} ${viewMode === '3d' ? 'cursor-grab active:cursor-grabbing select-none' : ''}`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Fullscreen toggle */}
      <button
        onClick={() => setIsFullscreen(v => !v)}
        className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-lg bg-black/40 text-white hover:bg-black/60 transition-colors"
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>

      {/* Static Photo */}
      {viewMode === 'photo' && (
        !imgError && productImage ? (
          <img
            src={productImage}
            alt={`${productName} product photo`}
            className={`w-full object-cover ${isFullscreen ? 'h-full' : 'max-h-[320px]'}`}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={`flex items-center justify-center ${isFullscreen ? 'h-full' : 'min-h-[320px]'}`}>
            <div className="text-center">
              <div className="text-6xl mb-3">🪑</div>
              <p className="text-sm text-muted-foreground font-medium">{productName}</p>
              <p className="text-xs text-muted-foreground mt-1">{dimensions}</p>
            </div>
          </div>
        )
      )}

      {/* 3D Preview */}
      {viewMode === '3d' && (
        <div className={`flex flex-col items-center justify-center px-6 py-10 ${isFullscreen ? 'h-full' : 'min-h-[320px]'}`}>
          {/* 3D Object */}
          <div
            className="relative mb-5 transition-transform duration-100"
            style={{
              transform: `scale(${scale}) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
              transformStyle: 'preserve-3d',
              perspective: '800px',
            }}
          >
            <div
              className="flex h-32 w-48 items-center justify-center rounded-2xl border border-border bg-muted/80 shadow-xl backdrop-blur-md"
              style={{ transform: 'translateZ(20px)' }}
            >
              <div className="text-center">
                <div className="mb-2 text-5xl">🪑</div>
                <p className="text-xs font-semibold text-foreground">{productName}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{dimensions}</p>
              </div>
            </div>
            {/* Shadow */}
            <div className="absolute -bottom-4 left-1/2 h-4 w-36 -translate-x-1/2 rounded-full bg-black/25 blur-md" />
          </div>

          <p className="text-xs text-muted-foreground mb-4">Drag to rotate · Use buttons to zoom</p>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted text-foreground hover:bg-muted/80 transition-all active:scale-95"
              aria-label="Zoom out"
            >
              <ZoomOut size={15} />
            </button>
            <button
              onClick={handleZoomIn}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted text-foreground hover:bg-muted/80 transition-all active:scale-95"
              aria-label="Zoom in"
            >
              <ZoomIn size={15} />
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-muted px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted/80 transition-all active:scale-95"
            >
              <RefreshCw size={13} /> Reset
            </button>
          </div>

          {/* Zoom indicator */}
          <p className="mt-2 text-xs text-muted-foreground">{Math.round(scale * 100)}% zoom</p>
        </div>
      )}

      {/* AR Intro */}
      {viewMode === 'ar' && arStep === 'intro' && (
        <div className={`flex flex-col items-center justify-center px-6 py-10 text-center ${isFullscreen ? 'h-full' : 'min-h-[320px]'}`}>
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/30 bg-white/25 dark:border-white/20 dark:bg-white/10">
            <Smartphone size={36} className="text-slate-900 dark:text-white" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">View in Your Room</h3>
          <p className="mb-2 max-w-xs text-sm text-slate-700 dark:text-white/80">
            Place your <strong>{productName}</strong> in your space.
          </p>
          <p className="mb-1 text-xs text-slate-600 dark:text-white/60">True-to-scale: {dimensions}</p>

          {/* Order info */}
          <div className="mb-5 w-full max-w-xs rounded-xl border border-white/20 bg-white/10 dark:bg-black/20 p-3 text-left space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600 dark:text-white/60">Order</span>
              <span className="font-semibold text-slate-800 dark:text-white">#{order?.order_ref || '—'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600 dark:text-white/60">Material</span>
              <span className="font-semibold text-slate-800 dark:text-white">{product?.material_type || order?.material || 'Wood'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600 dark:text-white/60">Status</span>
              <span className="font-semibold text-slate-800 dark:text-white capitalize">{order?.extended_status || order?.status || 'Pending'}</span>
            </div>
          </div>

          <div className="mb-5 w-full max-w-xs space-y-2 text-left">
            {['Point camera at a flat floor surface', 'Tap to place the furniture', 'Pinch to resize · Drag to reposition'].map((step, i) => (
              <div key={step} className="flex items-center gap-2.5">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 dark:bg-white/20 dark:text-white">{i + 1}</div>
                <p className="text-xs text-slate-700 dark:text-white/80">{step}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => setArStep('camera')}
            className="flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-bold text-white transition-all active:scale-95 hover:bg-purple-700"
          >
            <Camera size={16} /> Launch AR Preview <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* AR Camera Simulation */}
      {viewMode === 'ar' && arStep === 'camera' && (
        <div className={`relative flex items-center justify-center overflow-hidden ${isFullscreen ? 'h-full' : 'min-h-[320px]'}`}>
          <div className="absolute inset-0 bg-slate-950" />
          {/* Grid floor */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(rgba(124,58,237,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(124,58,237,0.25)_1px,transparent_1px)] bg-[size:40px_40px] opacity-70" />
          {/* Perspective lines */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 opacity-30"
            style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(124,58,237,0.4) 0%, transparent 70%)' }}
          />

          {/* AR Furniture */}
          <div
            className="relative z-10 text-center transition-transform duration-100"
            style={{ transform: `scale(${scale}) rotateX(${rotation.x * 0.3}deg) rotateY(${rotation.y * 0.2}deg)` }}
          >
            <div className="mx-auto flex h-28 w-40 items-center justify-center rounded-2xl border border-violet-300/60 bg-violet-400/25 backdrop-blur-sm dark:border-violet-200/40 dark:bg-violet-300/20 shadow-lg">
              <div className="text-center">
                <div className="text-4xl">🪑</div>
                <p className="mt-1 text-xs text-white/90 font-semibold">{productName}</p>
                <p className="text-[10px] text-white/60">{dimensions}</p>
              </div>
            </div>
            <div className="mx-auto mt-1 h-3 w-32 rounded-full bg-violet-500/40 blur-sm" />
          </div>

          {/* AR Controls */}
          <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-3 px-4">
            <button
              onClick={handleZoomOut}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white backdrop-blur-sm hover:bg-white/25 transition-colors"
              aria-label="Zoom out"
            >
              <ZoomOut size={15} />
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-full bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 transition-colors"
            >
              <RotateCcw size={14} /> Reset
            </button>
            <button
              onClick={handleZoomIn}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white backdrop-blur-sm hover:bg-white/25 transition-colors"
              aria-label="Zoom in"
            >
              <ZoomIn size={15} />
            </button>
          </div>

          <button
            onClick={() => setArStep('intro')}
            className="absolute left-3 top-3 rounded-lg bg-black/50 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/70 transition-colors"
          >
            ← Back
          </button>
          <p className="absolute right-3 top-3 text-xs text-white/60">AR Mode · {dimensions}</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Fullscreen Overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4">
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex-1">
              {viewportContent}
            </div>
            {/* Compact controls in fullscreen */}
            <div className="flex items-center justify-center gap-3 pb-2">
              {viewModes.map(mode => (
                <button
                  key={mode.key}
                  onClick={() => { setViewMode(mode.key); if (mode.key !== 'ar') setArStep('intro'); }}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all ${viewMode === mode.key ? 'border-primary bg-primary/20 text-white' : 'border-white/20 bg-white/10 text-white/70 hover:bg-white/20'}`}
                >
                  <span>{mode.emoji}</span>
                  <span className="font-medium">{mode.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Viewport */}
            <div className="flex-1">
              {viewportContent}
            </div>

            {/* Right Panel */}
            <div className="space-y-4 lg:w-64">
              {/* Product Info */}
              <div>
                <h3 className="mb-1 text-base font-semibold text-foreground">{productName}</h3>
                <p className="text-xs text-muted-foreground">
                  {order?.order_ref ? `${order.order_ref} · ` : ''}{product?.material_type || product?.category || 'Furniture'}
                </p>
                {dimensions && (
                  <p className="text-xs text-muted-foreground mt-1">{dimensions}</p>
                )}
              </div>

              {/* View Mode Selector */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">View Mode</p>
                {viewModes.map(mode => {
                  const isActive = viewMode === mode.key;
                  return (
                    <button
                      key={mode.key}
                      onClick={() => { setViewMode(mode.key); if (mode.key !== 'ar') setArStep('intro'); }}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-all duration-150 active:scale-95 ${isActive ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted text-foreground hover:bg-muted/80'}`}
                    >
                      <span className="text-xl">{mode.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{mode.label}</p>
                        <p className="text-xs text-muted-foreground">{mode.desc}</p>
                      </div>
                      {isActive && <div className="h-2 w-2 rounded-full bg-purple-600 dark:bg-purple-300 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Product Specifications Toggle */}
              <button
                onClick={() => setShowSpecs(!showSpecs)}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-muted px-3 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-muted/80"
              >
                <div className="flex items-center gap-2">
                  <Info size={14} /> Product Specifications
                </div>
                <ChevronRight
                  size={14}
                  className={`transition-transform duration-200 ${showSpecs ? 'rotate-90' : ''}`}
                />
              </button>

              {/* Specifications Panel */}
              {showSpecs && (
                <div className="space-y-1.5 rounded-xl border border-border bg-muted/60 p-3 animate-fade-in">
                  {specs.map(spec => {
                    const Icon = spec.icon;
                    return (
                      <div
                        key={spec.label}
                        className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 ${spec.highlight ? 'bg-primary/10 border border-primary/20' : ''}`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Icon size={11} className={spec.highlight ? 'text-primary shrink-0' : 'text-muted-foreground shrink-0'} />
                          <span className={`text-xs ${spec.highlight ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{spec.label}</span>
                        </div>
                        <span className={`text-xs font-semibold text-right capitalize ${spec.highlight ? 'text-primary' : 'text-foreground'}`}>
                          {spec.value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* View in AR Button */}
              {viewMode !== 'ar' && (
                <button
                  onClick={() => { setViewMode('ar'); setArStep('intro'); }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-bold text-primary-foreground transition-all active:scale-95 hover:opacity-90"
                >
                  <Smartphone size={16} /> View in AR
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}