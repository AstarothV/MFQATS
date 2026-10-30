'use client';
import React, { useState, useEffect } from 'react';
import {
  Maximize2, Minimize2, Info, ChevronRight, Package, Ruler,
  Layers, Palette, Weight, Wrench, Heart, Clock, Hash, CheckCircle2
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { mediaLinks } from '@/lib/orderMedia';
import { statusLabel } from '@/lib/orders';
import { Skeleton, SkeletonRegion } from '@/components/ui/LoadingSkeleton';


type ViewMode = 'photo' | '3d';

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
  const [showSpecs, setShowSpecs] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [modelUrl, setModelUrl] = useState<string | null>(null);

  // The 3D model the workshop built for this order
  useEffect(() => {
    const path = order?.model_3d_path;
    setModelUrl(null);
    if (!path) return;
    import('@google/model-viewer'); // registers <model-viewer>; browser-only
    mediaLinks(supabase, [path]).then((links) => {
      if (links[path]) { setModelUrl(links[path]); setViewMode('3d'); }
    });
  }, [order?.model_3d_path, supabase]);

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
    { icon: CheckCircle2, label: 'Order Status', value: statusLabel(order?.extended_status || order?.status || 'pending'), highlight: true },
  ];

  const viewModes = [
    { key: 'photo' as ViewMode, label: 'Static Photo', desc: 'High-res product photo', emoji: '📷' },
    { key: '3d' as ViewMode, label: '3D Preview', desc: modelUrl ? 'Built from your inspection photos' : 'Not built yet', emoji: '🎲' },
  ];

  const activeViewportClass = viewMode === 'photo' ? 'bg-white' : 'bg-[#0b0b0f]';

  if (loading) {
    return (
      <SkeletonRegion label="Loading 3D view">
        <Skeleton className="min-h-[320px] w-full rounded-2xl" />
      </SkeletonRegion>
    );
  }

  const viewportContent = (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border ${activeViewportClass} transition-colors ${isFullscreen ? 'h-full' : 'min-h-[320px]'}`}
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
            className={`w-full object-contain ${isFullscreen ? 'absolute inset-0 h-full' : 'h-[320px]'}`}
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
        modelUrl ? (
          <model-viewer
            src={modelUrl}
            alt={`3D model of your ${productName}, built from its inspection photos. Drag to turn it.`}
            camera-controls
            auto-rotate
            shadow-intensity="1"
            environment-image="neutral"
            exposure="1.3"
            style={{ width: '100%', height: isFullscreen ? '100%' : 360, background: '#0b0b0f' }}
          />
        ) : (
          <div className={`flex flex-col items-center justify-center gap-2 px-6 py-10 text-center ${isFullscreen ? 'h-full' : 'min-h-[320px]'}`}>
            <div className="text-5xl">🪑</div>
            <p className="text-sm font-semibold text-white">The 3D model is not ready yet</p>
            <p className="max-w-xs text-xs text-white/70">It appears here once the workshop builds it from the inspection photos of your {productName}.</p>
          </div>
        )
      )}

    </div>
  );

  return (
    <>
      {/* Fullscreen Overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4">
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="min-h-0 flex-1">
              {viewportContent}
            </div>
            {/* Compact controls in fullscreen */}
            <div className="flex items-center justify-center gap-3 pb-2">
              {viewModes.map(mode => (
                <button
                  key={mode.key}
                  onClick={() => setViewMode(mode.key)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${viewMode === mode.key ? 'border-primary bg-primary/20 text-white' : 'border-white/20 bg-white/10 text-white/70 hover:bg-white/20'}`}
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
                      onClick={() => setViewMode(mode.key)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition duration-150 active:scale-95 ${isActive ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted text-foreground hover:bg-muted/80'}`}
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
                className="flex w-full items-center justify-between rounded-xl border border-border bg-muted px-3 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted/80"
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

            </div>
          </div>
        </div>
      </div>
    </>
  );
}