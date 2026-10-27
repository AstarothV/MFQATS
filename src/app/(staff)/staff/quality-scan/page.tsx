'use client';

import React, { useState, useRef, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { SkeletonRegion, TableSkeleton } from '@/components/ui/LoadingSkeleton';
import {
  Camera, Upload, Play, Pause, RotateCcw, Save, CheckCircle2, AlertTriangle, X, Loader2, Target, Activity, ArrowRight,
  Maximize2, Minimize2, Flashlight, FlashlightOff, ChevronLeft, ChevronRight, Check, Images, Info,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { moveOrderStage, PROCESS_STAGES, statusLabel } from '@/lib/orders';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/ui/StatusBadge';
import MeasurePanel from './MeasurePanel';
import SurfacePanel, { type SurfaceResponse } from './SurfacePanel';
import ReconstructPanel, { shrink } from './ReconstructPanel';
import Model3DPanel from './Model3DPanel';
import { PhotoSlots, PhotoThumbs, usePhotoSet, VIEWS } from './PhotoSet';

interface Detection {
  id: string;
  class_name: string;
  confidence_score: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
  bounding_box: { x: number; y: number; width: number; height: number };
}

interface DetectionLog {
  id: string;
  order_id: string | null;
  stage_name: string;
  scan_mode: string;
  image_url: string;
  detections: Detection[];
  overall_result: 'pass' | 'fail' | 'pending';
  confidence_avg: number;
  defect_count: number;
  notes: string;
  created_at: string;
  orders?: { order_ref: string; product_name: string } | null;
}

interface DetectResponse {
  detections: Detection[];
  overall_result: 'pass' | 'fail';
  confidence_avg: number;
  defect_count: number;
}

// What is saved for the selected order, so Results and Recommendation can show it after a reload.
interface Saved {
  scan: 'pass' | 'fail' | 'pending' | null; // the order's latest saved scan
  size: 'within_tolerance' | 'out_of_tolerance' | 'pending' | null; // its latest saved measurement
}

// Same-origin path that next.config.mjs forwards to the Python server, so it also works on phones via an https link.
const YOLO_API_URL = process.env.NEXT_PUBLIC_YOLO_API_URL || '/staff/yolo';
const LIVE_SCAN_INTERVAL_MS = 1000;

// The page follows the five official stages; step i shows the tools for PROCESS_STAGES[i].
const STEP_OF: Record<string, number> = Object.fromEntries(PROCESS_STAGES.map((s, i) => [s.key, i]));
const NEXT_STAGE: Record<string, string> = { upload: 'reconstruction_3d', reconstruction_3d: 'detect_defects', detect_defects: 'results', results: 'recommendation' };

const formatLabel = (s: string) => s.replace(/_/g, ' ');

// Thrown when the FastAPI server can't be reached (network failure, or the Next.js proxy can't connect to it).
class BackendOfflineError extends Error {}

// tiled: also check the photo in full-detail tiles for small defects (slower, so live frames skip it)
async function detectDefects(imageData: string, tiled = true): Promise<DetectResponse> {
  let res: Response;
  try {
    res = await fetch(`${YOLO_API_URL}/api/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData, tiled }),
    });
  } catch {
    throw new BackendOfflineError();
  }
  const isJson = res.headers.get('content-type')?.includes('application/json');
  if (res.redirected || (res.ok && !isJson)) {
    throw new Error('Your session has expired. Please log in again.'); // middleware redirected to the login page
  }
  if (!res.ok) {
    const body = isJson ? await res.json().catch(() => null) : null;
    if (!body && res.status >= 500) throw new BackendOfflineError(); // proxy couldn't reach the Python server
    throw new Error(body?.detail || `Detection failed (HTTP ${res.status})`);
  }
  return res.json();
}

// Canvas is sized to the source's pixel dimensions and scaled by CSS object-contain,
// so normalized boxes line up with the image/video regardless of aspect ratio.
function drawDetections(canvas: HTMLCanvasElement, dets: Detection[], w: number, h: number, image?: CanvasImageSource) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx || !w || !h) return;
  if (image) ctx.drawImage(image, 0, 0, w, h);
  const lw = Math.max(2, w / 320);
  const fs = Math.max(14, Math.round(w / 45));
  ctx.lineWidth = lw;
  ctx.font = `600 ${fs}px sans-serif`;
  ctx.textBaseline = 'top';
  for (const d of dets) {
    const bx = d.bounding_box.x * w;
    const by = d.bounding_box.y * h;
    ctx.strokeStyle = '#EF4444';
    ctx.strokeRect(bx, by, d.bounding_box.width * w, d.bounding_box.height * h);
    const label = `${formatLabel(d.class_name)} (${d.confidence_score}%)`;
    const tagH = fs * 1.4;
    const tagY = by - tagH < 0 ? by : by - tagH;
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(bx - lw / 2, tagY, ctx.measureText(label).width + fs * 0.6, tagH);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, bx - lw / 2 + fs * 0.3, tagY + fs * 0.2);
  }
}

const severityBadge = (s: Detection['severity']) => (s === 'critical' || s === 'high' ? 'danger' : s === 'medium' ? 'warning' : 'info');
const segButton = (on: boolean) =>
  `flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${on ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`;

export default function QualityScanPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const inFlightRef = useRef(false);
  const photoSet = usePhotoSet();

  const [step, setStep] = useState(0);
  const [reconTab, setReconTab] = useState<'model' | 'surface' | 'file'>('model');
  const [detectTab, setDetectTab] = useState<'scan' | 'size'>('scan');
  // where the defect scan's picture comes from: the live camera, one of the Upload photos, or a new file
  const [source, setSource] = useState<'live' | 'photos' | 'file'>('photos');
  const mode = source === 'live' ? 'live' : 'upload';
  const [scannedSlot, setScannedSlot] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<'pass' | 'fail' | 'pending' | null>(null);
  const [confidenceAvg, setConfidenceAvg] = useState(0);
  const [backendOffline, setBackendOffline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [notes, setNotes] = useState('');
  const [history, setHistory] = useState<DetectionLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [surface, setSurface] = useState<SurfaceResponse | null>(null);
  const [savedInfo, setSavedInfo] = useState<Saved>({ scan: null, size: null });
  const [moving, setMoving] = useState(false);
  // Camera view follows the picture's own shape (a phone held upright gives a tall picture), and can fill the screen.
  const [viewAspect, setViewAspect] = useState(16 / 9);
  const [expanded, setExpanded] = useState(false);
  // Flashlight: only offered when the camera in use reports one (phone rear cameras; not laptops).
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      const [{ data: ordersData }, { data: logsData }] = await Promise.all([
        supabase.from('orders').select('id, order_ref, product_name, extended_status, status, queue_position').order('created_at', { ascending: false }).limit(20),
        supabase.from('detection_logs').select('*, orders(order_ref, product_name)').order('created_at', { ascending: false }).limit(20),
      ]);
      if (ordersData) setOrders(ordersData);
      if (logsData) setHistory(logsData as DetectionLog[]);
      setHistoryLoading(false);
    };
    fetchData();
  }, [user, supabase]);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  const orderStep: number | null = selectedOrder ? (STEP_OF[selectedOrder.extended_status] ?? null) : null;

  async function loadSaved(orderId: string) {
    if (!orderId) { setSavedInfo({ scan: null, size: null }); return; }
    const [{ data: scan }, { data: size }] = await Promise.all([
      supabase.from('detection_logs').select('overall_result').eq('order_id', orderId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('measurements').select('measurement_status').eq('order_id', orderId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    setSavedInfo({ scan: (scan?.overall_result as Saved['scan']) ?? null, size: (size?.measurement_status as Saved['size']) ?? null });
  }

  // Choosing an order opens the step it is at, and loads what was already saved for it.
  function chooseOrder(id: string) {
    setSelectedOrderId(id);
    const order = orders.find((o) => o.id === id);
    const at = order ? STEP_OF[order.extended_status] : undefined;
    if (at !== undefined) goTo(at);
    loadSaved(id);
  }

  function goTo(i: number) {
    const next = Math.max(0, Math.min(PROCESS_STAGES.length - 1, i));
    if (next !== 2 && cameraActive) stopCamera(); // the camera is only used in Detect Defects
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function startCamera() {
    // Browsers only expose the camera on https:// pages or localhost; on http://<laptop-ip> it is simply missing.
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      showToast('error', 'Camera needs a secure (https://) link. On phones, open the site through the https tunnel link.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // `torch` is not in the TypeScript DOM types yet, hence the cast
      const caps = stream.getVideoTracks()[0]?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
      setTorchAvailable(!!caps?.torch);
      setTorchOn(false);
      setCameraActive(true);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      showToast('error',
        name === 'NotAllowedError' ? 'Camera permission was blocked. Allow the camera in your browser settings for this site, then try again.'
        : name === 'NotFoundError' ? 'No camera was found on this device.'
        : name === 'NotReadableError' ? 'The camera is being used by another app. Close it and try again.'
        : 'Could not start the camera.');
    }
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn(!torchOn);
    } catch {
      showToast('error', 'Could not switch the flashlight on this device.');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setScanning(false);
    setExpanded(false);
    setTorchAvailable(false);
    setTorchOn(false);
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
  }

  function handleDetectError(err: unknown) {
    if (err instanceof BackendOfflineError) setBackendOffline(true);
    else showToast('error', err instanceof Error ? err.message : 'Detection failed');
  }

  function grabFrame(): string | null {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  }

  function startScan() {
    setScanning(true);
    setDetections([]);
    setResult(null);
    const id = setInterval(async () => {
      if (inFlightRef.current) return; // skip ticks while the previous frame is still being analyzed
      const frame = grabFrame();
      if (!frame) return;
      inFlightRef.current = true;
      try {
        const res = await detectDefects(frame, false);
        setBackendOffline(false);
        // ignore responses that land after the scan was paused/captured
        if (scanIntervalRef.current === id) setDetections(res.detections);
      } catch (err) {
        handleDetectError(err);
        if (scanIntervalRef.current === id) pauseScan();
      } finally {
        inFlightRef.current = false;
      }
    }, LIVE_SCAN_INTERVAL_MS);
    scanIntervalRef.current = id;
  }

  function pauseScan() {
    setScanning(false);
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    scanIntervalRef.current = null;
  }

  function captureImage() {
    const imageData = grabFrame();
    if (!imageData) return;
    setCapturedImage(imageData);
    pauseScan();
    analyzeImage(imageData);
  }

  async function analyzeImage(imageData: string) {
    setAnalyzing(true);
    setDetections([]);
    setResult(null);
    setSaved(false);
    try {
      const res = await detectDefects(imageData);
      setBackendOffline(false);
      setDetections(res.detections);
      setConfidenceAvg(res.confidence_avg);
      setResult(res.overall_result);
    } catch (err) {
      handleDetectError(err);
    } finally {
      setAnalyzing(false);
    }
  }

  // Scan one of the photos taken in the Upload step.
  async function scanPhoto(slot: number) {
    const file = photoSet.photos[slot];
    if (!file) return;
    try {
      const imageData = await shrink(file);
      setScannedSlot(slot);
      setCapturedImage(null);
      setUploadedImage(imageData);
      analyzeImage(imageData);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'That photo could not be opened.');
    }
  }

  function clearScan() {
    setCapturedImage(null);
    setUploadedImage(null);
    setScannedSlot(null);
    setDetections([]);
    setResult(null);
    setConfidenceAvg(0);
    setNotes('');
    setSaved(false);
  }

  function switchSource(next: 'live' | 'photos' | 'file') {
    if (next === source) return;
    pauseScan();
    if (next !== 'live') stopCamera();
    clearScan();
    setSource(next);
    if (next === 'live') startCamera();
  }

  // Redraw the visible canvas: still image + boxes, or transparent boxes over the live video.
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const still = capturedImage || uploadedImage;
    if (still) {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) setViewAspect(img.naturalWidth / img.naturalHeight);
        drawDetections(canvas, detections, img.naturalWidth, img.naturalHeight, img);
      };
      img.src = still;
    } else {
      const video = videoRef.current;
      if (video?.videoWidth && video.videoHeight) setViewAspect(video.videoWidth / video.videoHeight);
      drawDetections(canvas, detections, video?.videoWidth || 0, video?.videoHeight || 0);
    }
  }, [detections, capturedImage, uploadedImage, mode]);

  // Full-screen view: stop the page behind it from scrolling, and let Escape close it.
  // ponytail: CSS full-screen (works on iPhone, where the Fullscreen API is not available for page elements);
  // the browser's own address bar stays visible.
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [expanded]);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-uploading the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const imageData = ev.target?.result as string;
      setUploadedImage(imageData);
      setCapturedImage(null);
      setScannedSlot(null);
      setDetections([]);
      setResult(null);
      analyzeImage(imageData);
    };
    reader.readAsDataURL(file);
  }

  async function rescan() {
    clearScan();
    if (mode === 'live') {
      if (!cameraActive) await startCamera();
      startScan();
    }
  }

  // Move the order along the official process; the database checks each move (scan saved, scan passed).
  async function moveOrder(to: string) {
    if (!selectedOrder) return;
    setMoving(true);
    try {
      await moveOrderStage(supabase, selectedOrder, to);
      setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? { ...o, extended_status: to } : o)));
      showToast('success', `${selectedOrder.order_ref} moved to ${statusLabel(to)}`);
      if (STEP_OF[to] !== undefined) goTo(STEP_OF[to]);
      if (to === 'upload') clearScan(); // sent back for rework: the next inspection starts fresh
    } catch (err: any) {
      showToast('error', err?.message || 'Could not move the order');
    } finally {
      setMoving(false);
    }
  }

  async function saveDetection() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('detection_logs').insert({
        order_id: selectedOrderId || null,
        inspector_id: user.id,
        scan_mode: mode === 'live' ? 'live_camera' : 'image_upload',
        image_url: capturedImage || uploadedImage || '',
        detections: detections,
        overall_result: result || 'pending',
        confidence_avg: confidenceAvg,
        defect_count: detections.length,
        notes,
      });

      if (error) throw error;

      // Save real defects to the defects table. Low-severity findings (live knots, resin...) are natural wood
      // features: they stay in the scan record above but don't count as defects in analytics.
      const realDefects = detections.filter((d) => d.severity !== 'low');
      if (realDefects.length > 0 && selectedOrderId) {
        const defectInserts = realDefects.map((d) => ({
          order_id: selectedOrderId,
          defect_type: d.class_name,
          description: `${formatLabel(d.class_name)} detected with ${d.confidence_score}% confidence`,
          severity: d.severity,
          confidence_score: d.confidence_score,
          bounding_box: d.bounding_box,
          recommendation: d.recommendation,
          reported_by: user.id,
        }));
        await supabase.from('defects').insert(defectInserts);
      }

      // Refresh history
      const { data: logsData } = await supabase
        .from('detection_logs')
        .select('*, orders(order_ref, product_name)')
        .order('created_at', { ascending: false })
        .limit(20);
      if (logsData) setHistory(logsData as DetectionLog[]);
      loadSaved(selectedOrderId);

      setSaved(true);
      // follow-ups (admin notification, rework task) are created by the database trigger after_quality_scan
      showToast('success',
        !selectedOrderId ? 'Saved (not linked to an order)'
        : result === 'fail' ? 'Saved. A rework task was created and the admin was notified.'
        : 'Saved. The admin was notified.');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save the results');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    return () => {
      stopCamera();
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, []);

  // ---- what each step shows in the step bar ----
  const photoCount = photoSet.photos.filter(Boolean).length;
  const failing = detections.filter((d) => d.severity !== 'low');
  const stepNotes = [
    `${photoCount} of ${VIEWS.length} photos`,
    surface ? (surface.status === 'flat' ? 'Surface is flat' : surface.status === 'dent' ? 'Dent found' : 'Warping found') : '3D model and surface',
    analyzing ? 'Scanning…' : result ? (failing.length ? `${failing.length} defect${failing.length === 1 ? '' : 's'} found` : 'No failing defects') : 'Scan and size check',
    saved ? 'Saved' : result ? 'Not saved yet' : savedInfo.scan ? `Last saved: ${savedInfo.scan}` : 'Pass or fail',
    'Next action',
  ];
  // the verdict shown in Results and Recommendation: this visit's scan, else the order's last saved one
  const verdict = result ?? savedInfo.scan;

  // A footer button that moves the order on, shown on the step the order is actually at.
  function finishStage(i: number) {
    if (!selectedOrder || orderStep !== i) return null;
    const key = PROCESS_STAGES[i].key;
    const to = NEXT_STAGE[key];
    if (!to) return null;
    if (key === 'detect_defects' && !saved && savedInfo.scan === null) {
      return <p className="text-xs text-muted-foreground">Save a scan in Results to finish Detect Defects.</p>;
    }
    return (
      <button onClick={() => moveOrder(to)} disabled={moving} className="btn-secondary flex items-center gap-2 text-sm">
        {moving ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
        Move {selectedOrder.order_ref} to {statusLabel(to)}
      </button>
    );
  }

  const stepHead = (i: number, intro: string) => (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{i + 1} · {PROCESS_STAGES[i].label}</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{intro}</p>
      </div>
      {finishStage(i)}
    </div>
  );

  // repair advice gathered from everything found
  const advice: { title: string; tone: 'danger' | 'warning' | 'info'; badge: string; text: string }[] = [];
  const seen = new Set<string>();
  for (const d of [...detections].sort((a, b) => (a.severity === 'low' ? 1 : 0) - (b.severity === 'low' ? 1 : 0))) {
    if (seen.has(d.class_name)) continue;
    seen.add(d.class_name);
    const name = formatLabel(d.class_name);
    advice.push({ title: name.charAt(0).toUpperCase() + name.slice(1), tone: severityBadge(d.severity), badge: d.severity.charAt(0).toUpperCase() + d.severity.slice(1), text: d.recommendation });
  }
  if (savedInfo.size === 'out_of_tolerance') {
    advice.push({ title: 'A size is outside the tolerance', tone: 'danger', badge: 'Size error', text: 'Check the parts against the cut list and correct them, then measure again.' });
  }
  if (surface && surface.status !== 'flat') {
    advice.push({
      title: surface.status === 'dent' ? 'Dent in the surface' : 'Warped surface', tone: 'danger', badge: `${surface.max_deviation_mm} mm`,
      text: surface.status === 'dent'
        ? 'Raise or fill the dent, sand it smooth and refinish, then scan the surface again.'
        : 'Check whether the board can be flattened (clamping, moisture control); replace it if not.',
    });
  }

  return (
    <AppLayout role="staff" currentPath="/staff/quality-scan">
      <div className="space-y-5">
        {/* Toast */}
        {toast && (
          <div
            className="fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold"
            style={{ background: toast.type === 'success' ? '#22C55E' : '#EF4444', color: '#fff' }}
          >
            {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div>
          <p className="page-eyebrow">Quality Inspection</p>
          <h1 className="page-title">Quality Scan</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">Inspect one order at a time, step by step.</p>
        </div>

        {/* Backend offline alert */}
        {backendOffline && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4">
            <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-foreground">Detection server is offline</p>
              <p className="text-muted-foreground mt-1">
                Couldn&apos;t reach the Python server on the computer running this site. Start it from the project folder, then try again:
              </p>
              <code className="block mt-2 rounded-lg bg-black/40 px-3 py-2 text-xs text-foreground">
                uvicorn src.api.yolo_server:app --reload --port 8000 --env-file .env
              </code>
            </div>
            <button onClick={() => setBackendOffline(false)} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Order bar */}
        <div className="card-dark flex flex-wrap items-center gap-3 p-3 sm:p-4">
          <label htmlFor="qs-order" className="text-sm text-muted-foreground">Order</label>
          <select id="qs-order" value={selectedOrderId} onChange={(e) => chooseOrder(e.target.value)} className="input-dark min-w-0 flex-1 basis-60 sm:max-w-md">
            <option value="">No order (practice scan)</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>{o.order_ref} — {o.product_name} ({statusLabel(o.extended_status)})</option>
            ))}
          </select>
          {selectedOrder && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              Order is at <StatusBadge variant={orderStep === null ? 'neutral' : 'warning'} label={statusLabel(selectedOrder.extended_status)} />
            </span>
          )}
          <span className="flex-1" />
          <button onClick={() => setShowHistory(!showHistory)} className="btn-secondary flex items-center gap-2 text-sm">
            <Activity size={15} /> {showHistory ? 'Hide History' : 'Detection History'}
          </button>
        </div>

        {/* Detection History */}
        {showHistory && (
          <div className="card-dark p-5">
            <h3 className="text-base font-semibold text-foreground mb-4">Detection History</h3>
            {historyLoading ? (
              <SkeletonRegion label="Loading detection history">
                <TableSkeleton rows={5} cols={6} />
              </SkeletonRegion>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No detection history yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Order</th>
                      <th className="px-4 py-3">Mode</th>
                      <th className="px-4 py-3">Defects</th>
                      <th className="px-4 py-3">Confidence</th>
                      <th className="px-4 py-3">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {history.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(log.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-foreground font-medium whitespace-nowrap">{log.orders?.order_ref || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground capitalize">{log.scan_mode?.replace('_', ' ')}</td>
                        <td className="px-4 py-3"><span className={`font-bold ${log.defect_count > 0 ? 'text-danger' : 'text-success'}`}>{log.defect_count}</span></td>
                        <td className="px-4 py-3 text-muted-foreground">{log.confidence_avg > 0 ? `${log.confidence_avg}%` : '—'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge variant={log.overall_result === 'pass' ? 'ok' : log.overall_result === 'fail' ? 'danger' : 'neutral'} label={log.overall_result?.toUpperCase()} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Step bar */}
        <nav aria-label="Inspection steps" className="card-dark grid grid-cols-5 gap-1.5 p-2 sm:p-3">
          {PROCESS_STAGES.map((s, i) => {
            const done = orderStep !== null && i < orderStep;
            const here = orderStep === i;
            const current = step === i;
            return (
              <button
                key={s.key}
                onClick={() => goTo(i)}
                aria-current={current ? 'step' : undefined}
                className={`relative flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-center transition-colors sm:flex-row sm:gap-2.5 sm:px-3 sm:text-left ${current ? 'bg-primary/10 shadow-[inset_0_1px_0_var(--glass-edge)]' : 'hover:bg-muted'}`}
              >
                {here && (
                  <span className="absolute -top-2 right-1 rounded-full bg-warning px-1.5 text-[10px] font-bold text-white sm:right-2">Order is here</span>
                )}
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${current ? 'bg-primary text-primary-foreground' : done ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
                  {done && !current ? <Check size={15} /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[11px] font-semibold leading-tight sm:text-sm ${current ? 'text-foreground' : 'text-foreground/80'}`}>{s.label}</span>
                  <span className="hidden truncate text-xs text-muted-foreground sm:block">{stepNotes[i]}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* ---- 1 · Upload ---- */}
        <section hidden={step !== 0} className="card-dark space-y-4 p-5">
          {stepHead(0, 'Take the inspection photos once. They are used for the 3D model and can be scanned for defects.')}
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(photoCount / VIEWS.length) * 100}%` }} />
          </div>
          <PhotoSlots set={photoSet} />
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Whole piece in view', 'Same distance and height for every side.'],
              ['Plain background', 'A wall or open floor, with nothing touching the furniture.'],
              ['Take the marker off', 'The marker is only for measuring and surface scans.'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl border border-border bg-muted/40 p-3 text-sm">
                <p className="font-semibold text-foreground">{t}</p>
                <p className="text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- 2 · 3D Reconstruction ---- */}
        <section hidden={step !== 1} className="space-y-4">
          <div className="card-dark space-y-4 p-5">
            {stepHead(1, 'Build a 3D view of the whole piece, or scan one surface with the printed marker to check for dents and warping.')}
            <div role="tablist" className="inline-flex flex-wrap gap-1 rounded-xl bg-muted p-1">
              {([['model', '3D Model'], ['surface', 'Surface scan with marker'], ['file', 'From a scan file']] as const).map(([k, label]) => (
                <button key={k} role="tab" aria-selected={reconTab === k} onClick={() => setReconTab(k)} className={segButton(reconTab === k)}>{label}</button>
              ))}
            </div>
            <div hidden={reconTab !== 'model'}>
              <Model3DPanel apiUrl={YOLO_API_URL} orderId={selectedOrderId} set={photoSet} onChangePhotos={() => goTo(0)} />
            </div>
          </div>
          <div hidden={reconTab !== 'surface'}><ReconstructPanel apiUrl={YOLO_API_URL} onResult={setSurface} /></div>
          <div hidden={reconTab !== 'file'}><SurfacePanel apiUrl={YOLO_API_URL} onResult={setSurface} /></div>
        </section>

        {/* ---- 3 · Detect Defects ---- */}
        <section hidden={step !== 2} className="space-y-4">
          <div className="card-dark space-y-4 p-5">
            {stepHead(2, 'Scan the surfaces for defects, and check the size against the order.')}
            <div role="tablist" className="inline-flex flex-wrap gap-1 rounded-xl bg-muted p-1">
              <button role="tab" aria-selected={detectTab === 'scan'} onClick={() => setDetectTab('scan')} className={segButton(detectTab === 'scan')}>Scan for defects</button>
              <button role="tab" aria-selected={detectTab === 'size'} onClick={() => setDetectTab('size')} className={segButton(detectTab === 'size')}>Size check</button>
            </div>
          </div>

          {/* a class, not the hidden attribute: `grid` would override [hidden] */}
          <div className={`${detectTab === 'scan' ? 'grid' : 'hidden'} grid-cols-1 gap-4 xl:grid-cols-3`}>
            {/* Camera / photo view */}
            <div className="xl:col-span-2">
              <div className={expanded ? 'fixed inset-0 z-50 flex flex-col bg-black' : 'card-dark overflow-hidden'}>
                <div
                  className={`relative bg-black ${expanded ? 'flex-1 min-h-0' : 'w-full'}`}
                  style={expanded ? undefined : { aspectRatio: viewAspect, maxHeight: '70vh' }}
                >
                  {/* Detection canvas: draws the analyzed still + boxes, or boxes only over the live video */}
                  <canvas
                    ref={overlayRef}
                    role="img"
                    aria-label={`Defect detection overlay: ${detections.length} defect(s) found`}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  />
                  {mode === 'live' ? (
                    <>
                      <video
                        ref={videoRef}
                        className="w-full h-full object-contain"
                        playsInline
                        muted
                        onLoadedMetadata={(e) => { const v = e.currentTarget; if (v.videoWidth && v.videoHeight) setViewAspect(v.videoWidth / v.videoHeight); }}
                        onResize={(e) => { const v = e.currentTarget; if (v.videoWidth && v.videoHeight) setViewAspect(v.videoWidth / v.videoHeight); }}
                        style={{ display: cameraActive && !capturedImage ? 'block' : 'none' }}
                      />
                      <canvas ref={canvasRef} className="hidden" />
                      {!cameraActive && !capturedImage && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                          <div className="w-20 h-20 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                            <Camera size={32} className="text-accent" />
                          </div>
                          <p className="text-muted-foreground text-sm">Camera not started</p>
                          <button onClick={startCamera} className="btn-primary flex items-center gap-2"><Play size={16} /> Start Camera</button>
                        </div>
                      )}
                      {scanning && cameraActive && !capturedImage && (
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute inset-4 border-2 border-accent/60 rounded-xl" />
                          <div className="absolute top-4 left-4 right-4 h-0.5 bg-accent/60 animate-pulse" />
                          <div className="absolute top-4 left-4 bg-black/60 text-accent text-xs font-bold px-2 py-1 rounded">SCANNING...</div>
                        </div>
                      )}
                    </>
                  ) : !uploadedImage ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                      <div className="w-20 h-20 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                        {source === 'photos' ? <Images size={32} className="text-accent" /> : <Upload size={32} className="text-accent" />}
                      </div>
                      {source === 'photos' ? (
                        photoCount ? (
                          <p className="text-muted-foreground text-sm">Pick one of the Upload photos to scan it.</p>
                        ) : (
                          <>
                            <p className="text-muted-foreground text-sm">No photos yet. Take them in step 1, or upload a new one.</p>
                            <button onClick={() => goTo(0)} className="btn-primary flex items-center gap-2"><ChevronLeft size={16} /> Go to Upload</button>
                          </>
                        )
                      ) : (
                        <>
                          <p className="text-muted-foreground text-sm">Upload a photo to analyze</p>
                          <button onClick={() => fileInputRef.current?.click()} className="btn-primary flex items-center gap-2"><Upload size={16} /> Choose Image</button>
                        </>
                      )}
                    </div>
                  ) : null}

                  {analyzing && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 size={32} className="text-accent animate-spin" />
                        <p className="text-white text-sm font-semibold">Analyzing image...</p>
                      </div>
                    </div>
                  )}

                  {/* Flashlight toggle (only on cameras that have one) */}
                  {torchAvailable && cameraActive && !capturedImage && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`absolute bottom-3 right-16 flex h-10 w-10 items-center justify-center rounded-full transition-colors ${torchOn ? 'bg-warning text-black' : 'bg-black/60 text-white hover:bg-black/80'}`}
                      aria-label={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
                      aria-pressed={torchOn}
                      title={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
                    >
                      {torchOn ? <Flashlight size={18} /> : <FlashlightOff size={18} />}
                    </button>
                  )}

                  {/* Full-screen toggle */}
                  {(cameraActive || capturedImage || uploadedImage) && (
                    <button
                      type="button"
                      onClick={() => setExpanded((v) => !v)}
                      className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                      aria-label={expanded ? 'Exit full screen' : 'Full screen'}
                      title={expanded ? 'Exit full screen' : 'Full screen'}
                    >
                      {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                  )}

                  {/* Result badge */}
                  {result && (
                    <div className={`absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold ${result === 'pass' ? 'bg-success text-white' : 'bg-danger text-white'}`}>
                      {result === 'pass' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                      {result === 'pass' ? 'PASS' : 'FAIL'}
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div
                  className={`p-4 flex flex-wrap gap-2 ${expanded ? 'shrink-0 justify-center bg-card' : ''}`}
                  style={expanded ? { paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' } : undefined}
                >
                  {mode === 'live' ? (
                    !cameraActive ? (
                      <button onClick={startCamera} className="btn-primary flex items-center gap-2"><Play size={15} /> Start Camera</button>
                    ) : (
                      <>
                        {!capturedImage ? (
                          <>
                            {!scanning ? (
                              <button onClick={startScan} className="btn-primary flex items-center gap-2"><Target size={15} /> Start Scan</button>
                            ) : (
                              <button onClick={pauseScan} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-warning/20 text-warning border border-warning/30 text-sm font-semibold hover:bg-warning/30 transition">
                                <Pause size={15} /> Pause Scan
                              </button>
                            )}
                            <button onClick={captureImage} className="btn-secondary flex items-center gap-2"><Camera size={15} /> Capture & Analyze</button>
                          </>
                        ) : (
                          <button onClick={rescan} className="btn-secondary flex items-center gap-2"><RotateCcw size={15} /> Clear &amp; Retry</button>
                        )}
                        <button onClick={stopCamera} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-muted-foreground border border-border text-sm font-semibold hover:text-foreground transition">
                          <X size={15} /> Stop Camera
                        </button>
                      </>
                    )
                  ) : (
                    <>
                      {source === 'file' && (
                        <button onClick={() => fileInputRef.current?.click()} className="btn-secondary flex items-center gap-2"><Upload size={15} /> Upload Image</button>
                      )}
                      {uploadedImage && (
                        <button onClick={rescan} className="btn-secondary flex items-center gap-2"><RotateCcw size={15} /> Clear</button>
                      )}
                    </>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                  {result && (
                    <button onClick={() => goTo(3)} className="btn-primary ml-auto flex items-center gap-2">
                      Review results <ChevronRight size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Source and findings */}
            <div className="space-y-4">
              <div className="card-dark space-y-3 p-4">
                <p className="text-sm font-semibold text-foreground">Picture to scan</p>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                  {([['photos', 'Upload photos', Images], ['live', 'Live camera', Camera], ['file', 'New photo', Upload]] as const).map(([k, label, Icon]) => (
                    <button key={k} onClick={() => switchSource(k)} aria-pressed={source === k} className={`${segButton(source === k)} flex-col justify-center gap-1 px-1 text-xs`}>
                      <Icon size={16} /> {label}
                    </button>
                  ))}
                </div>
                {source === 'photos' && (
                  photoCount ? (
                    <PhotoThumbs set={photoSet} selected={scannedSlot} onPick={scanPhoto} />
                  ) : (
                    <p className="text-xs text-muted-foreground">No Upload photos yet.</p>
                  )
                )}
                <p className="text-xs text-muted-foreground">Scan one picture at a time, then save it in Results. Repeat for other sides if needed.</p>
              </div>

              <div className="card-dark p-4">
                <p className="mb-3 text-sm font-semibold text-foreground">Found on this picture</p>
                {analyzing ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Analyzing…</div>
                ) : detections.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">{result === 'pass' ? 'No defects found.' : 'Nothing scanned yet.'}</p>
                ) : (
                  <ul className="space-y-2">
                    {detections.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="capitalize text-foreground">{formatLabel(d.class_name)}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{d.confidence_score}%</span>
                          <StatusBadge variant={severityBadge(d.severity)} label={d.severity.charAt(0).toUpperCase() + d.severity.slice(1)} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div hidden={detectTab !== 'size'}>
            <MeasurePanel apiUrl={YOLO_API_URL} orderId={selectedOrderId} showToast={showToast} />
          </div>
        </section>

        {/* ---- 4 · Results ---- */}
        <section hidden={step !== 3} className="card-dark space-y-4 p-5">
          {stepHead(3, 'Everything found for this order, in one place. Saving the scan finishes Detect Defects.')}
          {!verdict ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">No defect scan yet for this order.</p>
              <button onClick={() => goTo(2)} className="btn-primary flex items-center gap-2"><ChevronLeft size={15} /> Go to Detect Defects</button>
            </div>
          ) : (
            <div className={`flex flex-wrap items-center gap-4 rounded-2xl border p-4 ${verdict === 'pass' ? 'border-success/30 bg-success/10' : verdict === 'fail' ? 'border-danger/30 bg-danger/10' : 'border-border bg-muted/40'}`}>
              <span className={`text-3xl font-bold tracking-tight ${verdict === 'pass' ? 'text-success' : verdict === 'fail' ? 'text-danger' : 'text-muted-foreground'}`}>
                {verdict === 'pending' ? 'PENDING' : verdict.toUpperCase()}
              </span>
              <span className="text-sm text-foreground">
                {!result ? 'This is the order\'s last saved scan.'
                  : result === 'pass' ? 'No defects that fail the piece.'
                  : `${failing.length} defect${failing.length === 1 ? '' : 's'} that fail the piece. It needs rework before delivery.`}
              </span>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Defects found</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">{result ? detections.length : '—'}</p>
                  <p className="text-xs text-muted-foreground">{result ? `${failing.length} failing, ${detections.length - failing.length} natural wood` : 'Scan in Detect Defects'}</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Size check</p>
                  <p className={`text-xl font-bold ${savedInfo.size === 'out_of_tolerance' ? 'text-danger' : savedInfo.size === 'within_tolerance' ? 'text-success' : 'text-foreground'}`}>
                    {savedInfo.size === 'within_tolerance' ? 'Within' : savedInfo.size === 'out_of_tolerance' ? 'Size error' : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">{savedInfo.size ? 'latest saved measurement' : 'Not measured yet'}</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Surface (3D)</p>
                  <p className={`text-xl font-bold ${surface && surface.status !== 'flat' ? 'text-danger' : surface ? 'text-success' : 'text-foreground'}`}>
                    {surface ? (surface.status === 'flat' ? 'Flat' : surface.status === 'dent' ? 'Dent' : 'Warp') : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">{surface ? `deepest ${surface.max_deviation_mm} mm, tolerance ${surface.tolerance_mm} mm` : 'Not checked in this visit'}</p>
                </div>
          </div>

          {result && detections.length > 0 && (
            <ul className="space-y-2">
              {detections.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-muted/40 px-3 py-2 text-sm">
                  <span className="font-semibold capitalize text-foreground">{formatLabel(d.class_name)}</span>
                  <StatusBadge variant={severityBadge(d.severity)} label={d.severity.charAt(0).toUpperCase() + d.severity.slice(1)} />
                  <span className="text-xs text-muted-foreground">{d.confidence_score}%{d.severity === 'low' ? ' · natural wood, does not fail the piece' : ''}</span>
                </li>
              ))}
            </ul>
          )}

          {result && (
            <>
              <label className="block text-sm font-medium text-foreground" htmlFor="qs-notes">Inspection notes</label>
              <textarea id="qs-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="input-dark w-full resize-none text-sm" rows={3} placeholder="Add notes about this inspection..." />
              <div className="flex flex-wrap items-center gap-3">
                {!saved ? (
                  <button onClick={saveDetection} disabled={saving} className="btn-primary flex items-center gap-2">
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {saving ? 'Saving...' : 'Save results'}
                  </button>
                ) : (
                  <span className="flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 size={15} /> Saved</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {!selectedOrderId ? 'Choose an order at the top to link this scan to it.' : result === 'fail' ? 'Saving creates a rework task and notifies the admin.' : 'Saving notifies the admin.'}
                </span>
              </div>
            </>
          )}
          {selectedOrder && orderStep === 2 && (saved || savedInfo.scan) && (
            <button onClick={() => moveOrder('results')} disabled={moving} className="btn-secondary flex items-center gap-2 text-sm">
              {moving ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />} Move {selectedOrder.order_ref} to Results
            </button>
          )}
        </section>

        {/* ---- 5 · Recommendation ---- */}
        <section hidden={step !== 4} className="card-dark space-y-4 p-5">
          {stepHead(4, 'What to do next, based on the results.')}
          {advice.length === 0 ? (
            <p className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              {verdict === 'pass' ? 'No repairs needed.' : 'Scan the piece in Detect Defects to get repair advice.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {advice.map((a) => (
                <li key={a.title} className="rounded-2xl border border-border bg-muted/40 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{a.title}</span>
                    <StatusBadge variant={a.tone} label={a.badge} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.text}</p>
                </li>
              ))}
            </ul>
          )}

          {selectedOrder && orderStep === 4 ? (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => moveOrder('upload')} disabled={moving} className="btn-primary flex items-center gap-2">
                <RotateCcw size={15} /> Send back for rework
              </button>
              <button onClick={() => moveOrder('delivered')} disabled={moving || savedInfo.scan !== 'pass'} className="btn-secondary flex items-center gap-2">
                <CheckCircle2 size={15} /> Release for delivery
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {selectedOrder
                ? `${selectedOrder.order_ref} is at ${statusLabel(selectedOrder.extended_status)}. Release and rework open when it reaches Recommendation.`
                : 'Choose an order at the top to release it or send it back.'}
            </p>
          )}
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info size={14} className="mt-0.5 shrink-0" />
            Release only opens when the order&apos;s latest saved scan passed. Rework sends the order back to Upload, so it is inspected again after the fix.
          </p>
        </section>

        {/* Back / Next */}
        <div className="flex justify-between gap-3">
          <button onClick={() => goTo(step - 1)} disabled={step === 0} className="btn-secondary flex items-center gap-2 disabled:opacity-40">
            <ChevronLeft size={16} /> Back
          </button>
          {step < PROCESS_STAGES.length - 1 && (
            <button onClick={() => goTo(step + 1)} className="btn-primary flex items-center gap-2">
              Next: {PROCESS_STAGES[step + 1].label} <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
