'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { X, ZoomIn, ChevronLeft, ChevronRight, Shield, User, Calendar, Tag, ImageOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Photo {
  id: string;
  image_url: string;
  caption: string;
  tags: string[];
  stage_name: string;
  created_at: string;
  uploaded_by?: string;
  uploader_name?: string;
  production_stage?: string;
  notes?: string;
}

interface PhotoGalleryProps {
  orderId?: string;
}

const FILTER_TABS = [
  { key: 'All', label: 'All' },
  { key: 'In Production', label: 'In Production' },
  { key: 'Finished', label: 'Finished' },
  { key: 'Delivered', label: 'Delivered' },
];

const STAGE_FILTER_MAP: Record<string, string[]> = {
  'In Production': ['cutting', 'assembly', 'sanding', 'staining', 'finishing', 'material_preparation', 'designing', 'in_production'],
  'Finished': ['quality_inspection', 'quality_check', 'ready_for_delivery', 'finished'],
  'Delivered': ['delivered', 'shipped', 'pickup'],
};

function PhotoSkeleton() {
  return (
    <div className="aspect-[4/3] rounded-xl border border-border bg-muted animate-pulse overflow-hidden">
      <div className="w-full h-full bg-gradient-to-br from-muted to-muted/60" />
    </div>
  );
}

export default function PhotoGallery({ orderId }: PhotoGalleryProps) {
  const supabase = createClient();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('inspection_images')
      .select('*')
      .order('created_at', { ascending: false });
    if (orderId) query = query.eq('order_id', orderId);
    const { data } = await query;
    if (data) {
      setPhotos(data.map((p: any) => ({
        id: p.id,
        image_url: p.image_url || '',
        caption: p.caption || '',
        tags: Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? (() => { try { return JSON.parse(p.tags); } catch { return []; } })() : []),
        stage_name: p.stage_name || '',
        created_at: p.created_at,
        uploaded_by: p.uploaded_by || '',
        uploader_name: p.uploader_name || p.uploaded_by_name || 'Staff',
        production_stage: p.production_stage || p.stage_name || '',
        notes: p.notes || p.caption || '',
      })));
    }
    setLoading(false);
  }, [orderId, supabase]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const getFilteredPhotos = () => {
    if (activeFilter === 'All') return photos;
    const stageKeys = STAGE_FILTER_MAP[activeFilter] || [];
    return photos.filter(p => {
      const stage = (p.production_stage || p.stage_name || '').toLowerCase();
      return stageKeys.some(k => stage.includes(k)) ||
        p.tags.some(t => stageKeys.some(k => t.toLowerCase().includes(k)));
    });
  };

  const filtered = getFilteredPhotos();
  const lightboxPhoto = lightboxIdx !== null ? filtered[lightboxIdx] : null;

  const handleImgError = (id: string) => setImgErrors(prev => ({ ...prev, [id]: true }));

  const formatDate = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return '—'; }
  };

  const formatStage = (stage: string) =>
    stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1.5">
              <div className="h-4 w-32 rounded-lg bg-muted animate-pulse" />
              <div className="h-3 w-20 rounded-lg bg-muted animate-pulse" />
            </div>
            <div className="h-7 w-28 rounded-lg bg-muted animate-pulse" />
          </div>
          <div className="flex gap-2">
            {FILTER_TABS.map(t => (
              <div key={t.key} className="h-7 w-20 rounded-full bg-muted animate-pulse" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <PhotoSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header + Filters */}
      <div className="rounded-2xl border border-border bg-card p-5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">Order Photo Gallery</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {photos.length} photo{photos.length !== 1 ? 's' : ''} · Production documentation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground">
              <Shield size={12} /> MVCA Certified
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all duration-150 ${
                activeFilter === tab.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'border border-border bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              {tab.label}
              {tab.key !== 'All' && (
                <span className="ml-1.5 opacity-60">
                  ({tab.key === 'All' ? photos.length : getFilteredPhotos().length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {photos.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted">
            <ImageOff size={28} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">No photos yet</p>
          <p className="mt-1.5 text-xs text-muted-foreground max-w-xs mx-auto">
            Photos will appear here as your order progresses through production stages
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted">
            <Tag size={20} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No photos in this stage</p>
          <p className="mt-1 text-xs text-muted-foreground">Try selecting a different filter</p>
          <button
            onClick={() => setActiveFilter('All')}
            className="mt-3 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors"
          >
            Show All Photos
          </button>
        </div>
      ) : (
        /* Photo Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map((photo, idx) => (
            <div
              key={photo.id}
              className="group relative aspect-[4/3] cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20"
              onClick={() => setLightboxIdx(idx)}
            >
              {imgErrors[photo.id] ? (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <div className="text-center">
                    <ImageOff size={24} className="mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Image unavailable</p>
                  </div>
                </div>
              ) : (
                <img
                  src={photo.image_url}
                  alt={photo.caption || `${formatStage(photo.stage_name)} production photo`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                  onError={() => handleImgError(photo.id)}
                />
              )}

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 flex items-center justify-center">
                <ZoomIn size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg" />
              </div>

              {/* Bottom Metadata */}
              <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent translate-y-0">
                {photo.stage_name && (
                  <span className="inline-block rounded-full bg-primary/80 px-1.5 py-0.5 text-[10px] font-semibold text-white mb-1">
                    {formatStage(photo.stage_name)}
                  </span>
                )}
                <p className="text-[10px] text-white/70 flex items-center gap-1">
                  <Calendar size={9} />
                  {formatDate(photo.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setLightboxIdx(null)}
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Image */}
            <div className="relative aspect-video bg-black">
              {imgErrors[lightboxPhoto.id] ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <ImageOff size={40} className="mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Image unavailable</p>
                  </div>
                </div>
              ) : (
                <img
                  src={lightboxPhoto.image_url}
                  alt={lightboxPhoto.caption || 'Production photo'}
                  className="w-full h-full object-contain"
                  onError={() => handleImgError(lightboxPhoto.id)}
                />
              )}

              {/* Navigation */}
              {filtered.length > 1 && (
                <>
                  <button
                    onClick={() => setLightboxIdx(i => i !== null ? (i - 1 + filtered.length) % filtered.length : 0)}
                    className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow hover:bg-black/80 transition-colors"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => setLightboxIdx(i => i !== null ? (i + 1) % filtered.length : 0)}
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow hover:bg-black/80 transition-colors"
                    aria-label="Next photo"
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              )}

              {/* Close */}
              <button
                onClick={() => setLightboxIdx(null)}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                aria-label="Close"
              >
                <X size={15} />
              </button>

              {/* Counter */}
              {filtered.length > 1 && lightboxIdx !== null && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                  {lightboxIdx + 1} / {filtered.length}
                </div>
              )}
            </div>

            {/* Metadata Panel */}
            <div className="p-4 space-y-3">
              {/* Tags */}
              {lightboxPhoto.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {lightboxPhoto.tags.map(tag => (
                    <span key={tag} className="rounded-full bg-primary/15 border border-primary/30 px-2 py-0.5 text-xs font-medium text-primary">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Caption / Notes */}
              {(lightboxPhoto.caption || lightboxPhoto.notes) && (
                <p className="text-sm font-medium text-foreground">
                  {lightboxPhoto.caption || lightboxPhoto.notes}
                </p>
              )}

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-border">
                {lightboxPhoto.stage_name && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Tag size={11} />
                    <span className="capitalize">{formatStage(lightboxPhoto.stage_name)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar size={11} />
                  <span>{formatDate(lightboxPhoto.created_at)}</span>
                </div>
                {lightboxPhoto.uploader_name && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User size={11} />
                    <span>{lightboxPhoto.uploader_name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}