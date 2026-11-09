'use client';

import React, { useState, useRef, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { SkeletonRegion, TableSkeleton } from '@/components/ui/LoadingSkeleton';
import {
  Camera, Upload, Play, Pause, RotateCcw, Save, CheckCircle2, AlertTriangle, X, Loader2, Target, Activity, ArrowRight,
  Maximize2, Minimize2, Flashlight, FlashlightOff, ChevronLeft, ChevronRight, Check, Images, Info, Send, Plus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { moveOrderStage, PROCESS_STAGES, statusLabel } from '@/lib/orders';
import { loadOrderMedia, removeOrderPhoto, saveOrderModel, saveOrderPhoto } from '@/lib/orderMedia';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/ui/StatusBadge';
import OrderChat from '@/components/OrderChat';
import { shrink } from './serverApi';
import Model3DPanel from './Model3DPanel';
import ModelDefectsView from './ModelDefectsView';
import { PhotoSlots, PhotoThumbs, useCloseUpsFor, usePartSet, usePhotoSet, VIEWS } from './PhotoSet';
import { insideCaption, PART_KINDS, partOfCaption, suggestedParts } from './insideParts';
import FurnitureOrderPicker from '@/components/ui/FurnitureOrderPicker';
import { dataUserId } from '@/lib/viewer';
import { captionFor, furnitureLabel, pieceCaption, piecesOf } from '@/lib/pieces';
import DefectsBySide, { drawDetections, formatLabel, severityBadge, type Detection, type SideTile } from './DefectsBySide';

// The Detection History table's columns: not the photo or the detections, which made the list several MB.
const HISTORY_COLUMNS = 'id, order_id, stage_name, scan_mode, overall_result, confidence_avg, defect_count, notes, created_at, orders(order_ref, product_name)';

interface DetectionLog {
  id: string;
  order_id: string | null;
  stage_name: string;
  scan_mode: string;
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

// The scan of one side's photo. Kept with the file it came from: a replaced photo makes its scan stale.
interface SideScan {
  file: File;
  image: string;
  detections: Detection[];
  result: 'pass' | 'fail';
}

// one-line stage names for the phone-sized step bar (the full names show from tablet size up)
const SHORT_STAGE: Record<string, string> = { upload: 'Upload', reconstruction_3d: '3D model', detect_defects: 'Detect', results: 'Results', recommendation: 'Re-check' };

// What is saved for the selected order, so Results and Recommendation can show it after a reload.
interface Saved {
  scan: 'pass' | 'fail' | 'pending' | null; // the order's latest saved scan ('pass' too when an admin approved a false alarm)
  id?: string | null;
  failed?: boolean; // what the scan itself found
  review?: 'requested' | 'approved' | 'rejected' | null; // admin review of a failed scan (migration 015)
  reviewNote?: string | null;
}

// Same-origin path that next.config.mjs forwards to the Python server, so it also works on phones via an https link.
const YOLO_API_URL = process.env.NEXT_PUBLIC_YOLO_API_URL || '/staff/yolo';
const LIVE_SCAN_INTERVAL_MS = 1000;

// The page follows the five official stages; step i shows the tools for PROCESS_STAGES[i].
const STEP_OF: Record<string, number> = Object.fromEntries(PROCESS_STAGES.map((s, i) => [s.key, i]));
const NEXT_STAGE: Record<string, string> = { upload: 'reconstruction_3d', reconstruction_3d: 'detect_defects', detect_defects: 'results', results: 'recommendation' };

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
    if (!body && (res.status === 404 || res.status >= 500)) throw new BackendOfflineError(); // proxy couldn't reach the Python server
    throw new Error(body?.detail || `Detection failed (HTTP ${res.status})`);
  }
  return res.json();
}

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
  const closeUps = usePhotoSet(); // Detect Defects: a nearer photo of each side's surface, for the scan only
  const parts = usePartSet(); // Upload: the inside parts of a cabinet, shelf unit or dresser (scanned, not used for 3D)
  const partCloseUps = useCloseUpsFor(parts.labels); // Detect Defects: a nearer photo of each inside part, for the scan
  const [partScans, setPartScans] = useState<Record<string, SideScan>>({}); // by part name
  const [scannedPart, setScannedPart] = useState<string | null>(null);
  // orders with several pieces (a set of chairs...): the piece being inspected, and each piece's latest saved result
  const [piece, setPiece] = useState('');
  const [pieceResults, setPieceResults] = useState<Record<string, 'pass' | 'fail'>>({});

  const [step, setStep] = useState(0);
  // where the defect scan's picture comes from: the live camera, one of the side photos, or a new file
  const [source, setSource] = useState<'live' | 'photos' | 'file'>('photos');
  const mode = source === 'live' ? 'live' : 'upload';
  const [scannedSlot, setScannedSlot] = useState<number | null>(null);
  const [sideScans, setSideScans] = useState<(SideScan | null)[]>(VIEWS.map(() => null));
  const [scanAllAt, setScanAllAt] = useState<number | null>(null); // which photo Scan all sides is on
  const [model3dUrl, setModel3dUrl] = useState<string | null>(null); // the 3D model built in step 2
  const [scanning, setScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<'pass' | 'fail' | 'pending' | null>(null);
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
  const [savedInfo, setSavedInfo] = useState<Saved>({ scan: null });
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
      const ordersQuery = (withStaff: boolean) => supabase.from('orders')
        .select(withStaff ? '*' : 'id, order_ref, product_name, product_category, extended_status, status, queue_position')
        .order('created_at', { ascending: false }).limit(50);
      const [ordersRes, { data: logsData }] = await Promise.all([
        ordersQuery(true),
        supabase.from('detection_logs').select(HISTORY_COLUMNS).order('created_at', { ascending: false }).limit(20),
      ]);
      // without the staff assignment migration there is no assigned_to column yet
      const ordersData = ordersRes.error ? (await ordersQuery(false)).data : ordersRes.data;
      if (ordersData) setOrders(ordersData);
      if (logsData) setHistory(logsData as unknown as DetectionLog[]);
      setHistoryLoading(false);
    };
    fetchData();
  }, [user, supabase]);

  // Assigned Tasks links here with ?order=<id>: open that order once the list is in
  const openedFromLink = useRef(false);
  useEffect(() => {
    if (openedFromLink.current || !orders.length) return;
    openedFromLink.current = true;
    const id = new URLSearchParams(window.location.search).get('order');
    if (id && orders.some((o) => o.id === id)) chooseOrder(id);
  }, [orders]);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  const orderPieces = piecesOf(selectedOrder);
  const orderStep: number | null = selectedOrder ? (STEP_OF[selectedOrder.extended_status] ?? null) : null;

  async function loadSaved(orderId: string, forPiece = piece) {
    if (!orderId) { setSavedInfo({ scan: null }); setPieceResults({}); return; }
    if (forPiece) {
      const { data: all } = await supabase.from('detection_logs').select('piece, overall_result, review_status').eq('order_id', orderId).order('created_at', { ascending: false });
      const results: Record<string, 'pass' | 'fail'> = {};
      for (const r of (all ?? []) as any[]) if (r.piece && !results[r.piece]) results[r.piece] = r.overall_result === 'pass' || r.review_status === 'approved' ? 'pass' : 'fail';
      setPieceResults(results);
    } else setPieceResults({});
    const latest = (cols: string) => {
      const q = supabase.from('detection_logs').select(cols).eq('order_id', orderId);
      return (forPiece ? q.eq('piece', forPiece) : q).order('created_at', { ascending: false }).limit(1).maybeSingle();
    };
    const first = await latest('id, overall_result, review_status, review_note');
    let { data } = first;
    if (first.error) ({ data } = await latest('id, overall_result')); // before migration 015 there is no review yet
    const scan = data as any;
    const review = (scan?.review_status ?? null) as Saved['review'];
    setSavedInfo({
      scan: review === 'approved' ? 'pass' : ((scan?.overall_result as Saved['scan']) ?? null),
      id: scan?.id ?? null, failed: scan?.overall_result === 'fail', review, reviewNote: scan?.review_note ?? null,
    });
  }

  // A step forward when the work itself shows the stage has moved on, so the customer's OrderView keeps up.
  const advancingTo = useRef('');
  function advance(from: string, to: string) {
    if (!selectedOrder || selectedOrder.extended_status !== from || advancingTo.current === to) return;
    const order = selectedOrder;
    advancingTo.current = to;
    moveOrderStage(supabase, order, to)
      .then(() => setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, extended_status: to } : o))))
      .catch(() => {}) // the stage button is still there
      .finally(() => { advancingTo.current = ''; });
  }

  const notShared = (err: any) => showToast('error', `Not shared with the customer: ${err?.message ?? 'please try again'}`);

  // Every photo goes to the customer's Photo Gallery as soon as it is added, and leaves it when it is removed.
  const sharedPhotos = useRef(new Map<string, File>()); // by caption, for the chosen order
  useEffect(() => {
    if (!selectedOrderId || !user) return;
    let added = false;
    for (const [set, kind] of [[photoSet, 'photo'], [closeUps, 'close-up']] as const) {
      VIEWS.forEach((view, i) => {
        const caption = pieceCaption(piece, `${view} ${kind}`);
        const file = set.photos[i];
        if (file === (sharedPhotos.current.get(caption) ?? null)) return;
        if (file) {
          sharedPhotos.current.set(caption, file);
          added = true;
          shrink(file)
            .then((image) => saveOrderPhoto(supabase, { orderId: selectedOrderId, inspectorId: user.id, caption, tags: [...(piece ? [piece] : []), view, kind === 'photo' ? 'Upload' : 'Close-up'], image }))
            .catch(notShared);
        } else {
          sharedPhotos.current.delete(caption);
          removeOrderPhoto(supabase, selectedOrderId, caption).catch(notShared);
        }
      });
    }
    for (const [set, closeUp] of [[parts, false], [partCloseUps, true]] as const) {
      set.labels.forEach((part, i) => {
        const caption = pieceCaption(piece, insideCaption(part, closeUp));
        const file = set.photos[i];
        if (file === (sharedPhotos.current.get(caption) ?? null)) return;
        if (file) {
          sharedPhotos.current.set(caption, file);
          added = true;
          shrink(file)
            .then((image) => saveOrderPhoto(supabase, { orderId: selectedOrderId, inspectorId: user.id, caption, tags: [...(piece ? [piece] : []), part, 'Inside', ...(closeUp ? ['Close-up'] : [])], image }))
            .catch(notShared);
        } else {
          sharedPhotos.current.delete(caption);
          removeOrderPhoto(supabase, selectedOrderId, caption).catch(notShared);
        }
      });
    }
    // a part taken off the list: its photos leave the customer's gallery too
    for (const caption of [...sharedPhotos.current.keys()]) {
      const part = partOfCaption(captionFor(piece, caption) ?? '')?.part;
      if (part !== undefined && !parts.labels.includes(part)) {
        sharedPhotos.current.delete(caption);
        removeOrderPhoto(supabase, selectedOrderId, caption).catch(notShared);
      }
    }
    if (added) advance('confirmed', 'upload');
  }, [selectedOrderId, piece, photoSet.photos, closeUps.photos, parts.labels, parts.photos, partCloseUps.photos]);

  // After a reload (or coming back to an order) its saved photos and 3D model are put back, so the work carries on.
  // Only empty slots are filled: photos taken before choosing the order stay.
  const [savedModel, setSavedModel] = useState<string | null>(null);
  useEffect(() => {
    setSavedModel(null);
    if (!selectedOrderId) return;
    let stale = false;
    loadOrderMedia(supabase, selectedOrderId).then(({ photos, model }) => {
      if (stale) return;
      for (const { caption, file } of photos) {
        const own = captionFor(piece, caption); // another piece's photo: not this one's
        if (own === null) continue;
        const inside = partOfCaption(own);
        if (inside) {
          sharedPhotos.current.set(caption, file); // already saved: not uploaded again
          if (inside.closeUp) { parts.put(inside.part, null); partCloseUps.put(inside.part, file); }
          else parts.put(inside.part, file);
          continue;
        }
        const [view, kind] = own.split(' ');
        const slot = VIEWS.indexOf(view as (typeof VIEWS)[number]);
        const set = kind === 'photo' ? photoSet : kind === 'close-up' ? closeUps : null;
        if (slot < 0 || !set || set.photos[slot]) continue;
        sharedPhotos.current.set(caption, file); // already saved: not uploaded again
        set.setSlot(slot, file);
      }
      if (model) setSavedModel(URL.createObjectURL(model));
    }).catch(() => {}); // nothing saved, or offline: start with empty slots
    return () => { stale = true; };
  }, [selectedOrderId, piece]);

  // The finished model goes to the customer's 3D Preview.
  function modelBuilt(url: string | null) {
    setModel3dUrl(url);
    if (!url || !selectedOrderId || url === savedModel) return; // the saved model is already there
    fetch(url).then((r) => r.blob())
      .then((blob) => saveOrderModel(supabase, selectedOrderId, blob))
      .then(() => advance('reconstruction_3d', 'detect_defects'))
      .catch(notShared);
  }

  // A failed scan the staff think is a false alarm goes to an admin; while it waits, check every 10 s for the decision.
  const [requesting, setRequesting] = useState(false);
  async function requestReview() {
    if (!savedInfo.id) return;
    setRequesting(true);
    const { error } = await supabase.from('detection_logs').update({ review_status: 'requested' }).eq('id', savedInfo.id);
    setRequesting(false);
    if (error) {
      showToast('error', /review_status/.test(error.message) ? 'Admin review needs the latest database update (migration 015).' : error.message);
      return;
    }
    showToast('success', 'Sent to the admin for review. You will be notified of the decision.');
    loadSaved(selectedOrderId);
  }
  useEffect(() => {
    if (savedInfo.review !== 'requested' || !selectedOrderId) return;
    const t = setInterval(() => loadSaved(selectedOrderId), 10000);
    return () => clearInterval(t);
  }, [savedInfo.review, selectedOrderId, piece]);

  // Choosing an order opens the step it is at, and loads what was already saved for it.
  // photos and scans on screen belong to one order (one piece of it): cleared before showing another
  function clearWork() {
    sharedPhotos.current.clear();
    VIEWS.forEach((_, i) => { photoSet.setSlot(i, null); closeUps.setSlot(i, null); });
    clearScan();
    setSideScans(VIEWS.map(() => null));
    parts.clear();
    partCloseUps.clear();
    setPartScans({});
  }

  function chooseOrder(id: string) {
    const order = orders.find((o) => o.id === id);
    const firstPiece = piecesOf(order)[0] ?? '';
    if ((selectedOrderId && id !== selectedOrderId) || firstPiece !== piece) clearWork(); // another order: its own work
    setSelectedOrderId(id);
    setPiece(firstPiece);
    window.history.replaceState(null, '', id ? `?order=${id}` : window.location.pathname); // a reload opens it again
    parts.suggest(order ? suggestedParts(order.product_name, order.product_category) : []);
    const at = order ? STEP_OF[order.extended_status] : undefined;
    if (at !== undefined) goTo(at);
    loadSaved(id, firstPiece);
  }

  // another piece of the same order (Chair 2 of 4): its own photos and scan
  function choosePiece(p: string) {
    if (p === piece) return;
    clearWork();
    setPiece(p);
    parts.suggest(selectedOrder ? suggestedParts(selectedOrder.product_name, selectedOrder.product_category) : []);
    loadSaved(selectedOrderId, p);
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

  // side: the side photo this picture is, so its scan also fills that side in Results
  async function analyzeImage(imageData: string, side?: { slot: number; file: File; part?: string }) {
    setAnalyzing(true);
    setDetections([]);
    setResult(null);
    setSaved(false);
    try {
      const res = await detectDefects(imageData);
      setBackendOffline(false);
      setDetections(res.detections);
      setResult(res.overall_result);
      if (side) {
        const scan: SideScan = { file: side.file, image: imageData, detections: res.detections, result: res.overall_result };
        const { part } = side;
        if (part) setPartScans((prev) => ({ ...prev, [part]: scan }));
        else setSideScans((prev) => prev.map((s, i) => (i === side.slot ? scan : s)));
      }
    } catch (err) {
      handleDetectError(err);
    } finally {
      setAnalyzing(false);
    }
  }

  // Scan one side's photo.
  async function scanPhoto(slot: number) {
    const file = scanSet.photos[slot];
    if (!file) return;
    try {
      const imageData = await shrink(file);
      setScannedSlot(slot);
      setScannedPart(null);
      setCapturedImage(null);
      setUploadedImage(imageData);
      analyzeImage(imageData, { slot, file });
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'That photo could not be opened.');
    }
  }

  // Scan one inside part's photo.
  async function scanPart(slot: number) {
    const file = partScanSet.photos[slot];
    if (!file) return;
    try {
      const imageData = await shrink(file);
      setScannedSlot(null);
      setScannedPart(parts.labels[slot]);
      setCapturedImage(null);
      setUploadedImage(imageData);
      analyzeImage(imageData, { slot, file, part: parts.labels[slot] });
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'That photo could not be opened.');
    }
  }

  // Scan every photo, one after another: the sides, then the inside parts; each fills its tile in Results.
  async function scanAllSides() {
    const jobs = [
      ...scanSet.photos.flatMap((file, slot) => (file ? [{ file, slot, part: '' }] : [])),
      ...partScanSet.photos.flatMap((file, slot) => (file ? [{ file, slot, part: parts.labels[slot] }] : [])),
    ];
    if (!jobs.length) return;
    setSaved(false);
    try {
      for (let n = 0; n < jobs.length; n++) {
        setScanAllAt(n);
        const { file, slot, part } = jobs[n];
        const image = await shrink(file);
        const res = await detectDefects(image);
        setBackendOffline(false);
        const scan: SideScan = { file, image, detections: res.detections, result: res.overall_result };
        if (part) setPartScans((prev) => ({ ...prev, [part]: scan }));
        else setSideScans((prev) => prev.map((s, i) => (i === slot ? scan : s)));
      }
      showToast('success', `Scanned ${jobs.length} photo${jobs.length === 1 ? '' : 's'}. See them in Results.`);
    } catch (err) {
      handleDetectError(err);
    } finally {
      setScanAllAt(null);
    }
  }

  function clearScan() {
    setCapturedImage(null);
    setUploadedImage(null);
    setScannedSlot(null);
    setScannedPart(null);
    setDetections([]);
    setResult(null);
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

  // Redo after a fix: clear every side's scan so the piece is scanned again from the start
  function redoScan() {
    clearScan();
    setSideScans(VIEWS.map(() => null));
    setPartScans({});
    showToast('success', 'Scans cleared. Scan the fixed piece again.');
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
      if (to === 'upload') { clearScan(); setSideScans(VIEWS.map(() => null)); setPartScans({}); VIEWS.forEach((_, i) => closeUps.setSlot(i, null)); partCloseUps.clear(); } // sent back for rework: the next inspection starts fresh
    } catch (err: any) {
      showToast('error', err?.message || 'Could not move the order');
    } finally {
      setMoving(false);
    }
  }

  // Finish: a passed piece is released for delivery; from Results it goes through Recommendation first (one step at a time).
  async function finish() {
    if (!selectedOrder) return;
    const order = selectedOrder;
    setMoving(true);
    try {
      if (order.extended_status === 'results') await moveOrderStage(supabase, order, 'recommendation');
      await moveOrderStage(supabase, { ...order, extended_status: 'recommendation' }, 'delivered');
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, extended_status: 'delivered' } : o)));
      showToast('success', `${order.order_ref} is finished and released for delivery.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Could not finish the order');
    } finally {
      setMoving(false);
    }
  }

  async function saveDetection() {
    if (!user) return;
    setSaving(true);
    try {
      const insideParts = partSides.flatMap((s, i) => (s ? [parts.labels[i]] : []));
      const scanRow = {
        order_id: selectedOrderId || null,
        inspector_id: user.id,
        scan_mode: extra && !sides.some(Boolean) && source === 'live' ? 'live_camera' : 'image_upload',
        image_url: (inspected.find((s) => s.result === 'fail') ?? inspected[0])?.image ?? '',
        detections: allDetections,
        overall_result: inspectionResult || 'pending',
        confidence_avg: inspectionConfidence,
        defect_count: allDetections.length,
        notes,
      };
      const extras = { ...(insideParts.length ? { inside_parts: insideParts } : {}), ...(piece ? { piece } : {}) };
      let { error } = await supabase.from('detection_logs').insert({ ...scanRow, ...extras });
      if (error && /inside_parts|piece/.test(error.message)) ({ error } = await supabase.from('detection_logs').insert(scanRow)); // before migrations 023 / 026
      if (error) throw error;

      // Save real defects to the defects table. Low-severity findings (live knots, resin...) are natural wood
      // features: they stay in the scan record above but don't count as defects in analytics.
      const realDefects = allDetections.filter((d) => d.severity !== 'low');
      if (realDefects.length > 0 && selectedOrderId) {
        const defectInserts = realDefects.map((d) => ({
          order_id: selectedOrderId,
          defect_type: d.class_name,
          description: `${formatLabel(d.class_name)}${piece ? ` on ${piece}` : ''}${[...VIEWS, ...parts.labels].includes(d.side) ? `${piece ? ',' : ' on the'} ${d.side.toLowerCase()}` : ''} detected with ${d.confidence_score}% confidence`,
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
        .select(HISTORY_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(20);
      if (logsData) setHistory(logsData as unknown as DetectionLog[]);
      loadSaved(selectedOrderId);

      setSaved(true);
      // follow-ups (admin notification, rework task) are created by the database trigger after_quality_scan
      showToast('success',
        !selectedOrderId ? 'Saved (not linked to an order)'
        : inspectionResult === 'fail' ? 'Saved. A rework task was created and the admin was notified.'
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
  // the photo each side is scanned from: its close-up, else its Upload photo
  const scanSet = {
    ...closeUps,
    photos: closeUps.photos.map((f, i) => f ?? photoSet.photos[i]),
    previews: closeUps.previews.map((p, i) => p ?? photoSet.previews[i]),
  };
  // each inside part is scanned from its close-up, else its Upload photo
  const partScanSet = {
    ...parts,
    photos: parts.photos.map((f, i) => partCloseUps.photos[i] ?? f),
    previews: parts.previews.map((p, i) => partCloseUps.previews[i] ?? p),
  };
  const partPhotoCount = parts.photos.filter(Boolean).length; // taken in Upload
  const partCount = partScanSet.photos.filter(Boolean).length; // ready to scan
  const scanCount = scanSet.photos.filter(Boolean).length + partCount; // every photo to scan: sides and inside parts
  const sides = sideScans.map((s, i) => (s && s.file === scanSet.photos[i] ? s : null));
  const partSides = parts.labels.map((part, i) => { const s = partScans[part]; return s && s.file === partScanSet.photos[i] ? s : null; });
  const extra = source !== 'photos' && (result === 'pass' || result === 'fail')
    ? { label: source === 'live' ? 'Camera' : 'New photo', image: capturedImage || uploadedImage || '', detections, result } : null;
  const inspected = [
    ...sides.flatMap((s, i) => (s ? [{ label: VIEWS[i] as string, image: s.image, detections: s.detections, result: s.result }] : [])),
    ...partSides.flatMap((s, i) => (s ? [{ label: parts.labels[i], image: s.image, detections: s.detections, result: s.result }] : [])),
    ...(extra ? [extra] : []),
  ];
  const allDetections = inspected.flatMap((s) => s.detections.map((d) => ({ ...d, side: s.label })));
  const inspectionResult: 'pass' | 'fail' | null = inspected.length ? (inspected.some((s) => s.result === 'fail') ? 'fail' : 'pass') : null;
  const inspectionConfidence = allDetections.length
    ? Math.round((allDetections.reduce((sum, d) => sum + d.confidence_score, 0) / allDetections.length) * 10) / 10 : 0;
  const failing = allDetections.filter((d) => d.severity !== 'low');
  const sideTiles: SideTile[] = [
    ...VIEWS.map((v, i) => ({ label: v as string, image: sides[i]?.image ?? scanSet.previews[i], detections: sides[i]?.detections ?? null })),
    ...parts.labels.map((part, i) => ({ label: part, image: partSides[i]?.image ?? partScanSet.previews[i], detections: partSides[i]?.detections ?? null })),
    ...(extra ? [{ label: extra.label, image: extra.image, detections: extra.detections }] : []),
  ];
  // defect pins for the 3D model: each defect's photo position, on the side it was found
  const pins = sides.flatMap((s, slot) => (s ? s.detections.map((d) => ({
    slot, u: d.bounding_box.x + d.bounding_box.width / 2, v: d.bounding_box.y + d.bounding_box.height / 2,
    w: d.bounding_box.width, h: d.bounding_box.height,
    label: formatLabel(d.class_name), severity: d.severity,
  })) : []));
  const scannedSides = sides.filter(Boolean).length + partSides.filter(Boolean).length;
  const allScanned = scanCount > 0 && scannedSides === scanCount;
  const stepNotes = [
    `${photoCount} of ${VIEWS.length} photos${parts.labels.length ? ` + ${partPhotoCount} of ${parts.labels.length} inside` : ''}`,
    '3D model of the piece',
    analyzing || scanAllAt !== null ? 'Scanning…' : failing.length ? `${failing.length} defect${failing.length === 1 ? '' : 's'} found` : allScanned ? 'No failing defects' : scannedSides ? `${scannedSides} of ${scanCount} photos scanned` : 'Scan every photo',
    saved ? 'Saved' : inspectionResult ? 'Not saved yet' : savedInfo.scan ? `Last saved: ${savedInfo.scan}` : 'Pass or fail',
    savedInfo.review === 'requested' ? 'Waiting for admin' : savedInfo.review === 'approved' ? 'Approved' : 'Admin approval',
  ];
  // the verdict shown in Results and Recommendation: this visit's scan, else the order's last saved one
  const verdict = inspectionResult ?? savedInfo.scan;
  // Detect Defects in the step bar: a cross as soon as a defect fails the piece, a check once every side is clear.
  // A saved scan only counts until the order goes back for rework.
  const savedScan = orderStep !== null && orderStep >= 2 ? savedInfo.scan : null;
  const busyScanning = analyzing || scanAllAt !== null;
  const scanMark = failing.length || (!inspected.length && savedScan === 'fail') ? 'fail'
    : !busyScanning && (allScanned || (!inspected.length && savedScan === 'pass')) ? 'pass' : null;

  const scanAllButton = (
    <button onClick={scanAllSides} disabled={scanAllAt !== null || analyzing} className="btn-secondary flex w-full items-center justify-center gap-2 text-sm disabled:opacity-60">
      {scanAllAt !== null
        ? <><Loader2 size={14} className="animate-spin" /> Scanning photo {scanAllAt + 1} of {scanCount}…</>
        : <><Images size={14} /> {parts.labels.length ? 'Scan all photos' : 'Scan all sides'}</>}
    </button>
  );

  // A footer button that moves the order on, shown on the step the order is actually at.
  function finishStage(i: number) {
    if (!selectedOrder || orderStep !== i) return null;
    const key = PROCESS_STAGES[i].key;
    const to = NEXT_STAGE[key];
    if (!to) return null;
    if (key === 'detect_defects' && orderPieces.length && Object.keys(pieceResults).length < orderPieces.length) {
      return <p className="text-xs text-muted-foreground">Save a scan for every piece in Results to finish Detect Defects ({Object.keys(pieceResults).length} of {orderPieces.length} saved).</p>;
    }
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
  for (const d of [...allDetections].sort((a, b) => (a.severity === 'low' ? 1 : 0) - (b.severity === 'low' ? 1 : 0))) {
    if (seen.has(d.class_name)) continue;
    seen.add(d.class_name);
    const name = formatLabel(d.class_name);
    advice.push({ title: name.charAt(0).toUpperCase() + name.slice(1), tone: severityBadge(d.severity), badge: d.severity.charAt(0).toUpperCase() + d.severity.slice(1), text: d.recommendation });
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
          <p className="page-subtitle">Inspect one order at a time, step by step.</p>
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
          <FurnitureOrderPicker label="Order" selectId="qs-order" empty="No order (practice scan)" orders={orders} value={selectedOrderId} onChange={chooseOrder}
            me={user ? dataUserId(user) : undefined}
            orderLabel={(o) => `${o.order_ref} — ${furnitureLabel(o as any)} (${statusLabel(o.extended_status)})${o.assigned_to && o.assigned_to === user?.id ? ' · assigned to you' : ''}`} />
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

        {/* a set of chairs (or several items): each piece is inspected on its own */}
        {orderPieces.length > 0 && (
          <div className="card-dark space-y-3 p-3 sm:p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-semibold text-foreground">Inspecting <span className="text-primary dark:text-accent">{piece}</span></p>
              <p className="text-xs text-muted-foreground">
                {orderPieces.filter((p) => pieceResults[p] === 'pass').length} of {orderPieces.length} passed · each piece has its own photos and scan
              </p>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Pieces of this order">
              {orderPieces.map((p) => {
                const r = pieceResults[p];
                return (
                  <button key={p} type="button" onClick={() => choosePiece(p)} aria-pressed={piece === p}
                    aria-label={`${p}: ${r === 'pass' ? 'passed' : r === 'fail' ? 'failed' : 'not scanned yet'}`}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors ${piece === p ? 'border-primary bg-primary/10 font-semibold text-foreground' : 'border-border text-foreground/80 hover:bg-muted'}`}>
                    {r === 'pass' ? <Check size={14} className="text-success" aria-hidden="true" />
                      : r === 'fail' ? <X size={14} className="text-danger" aria-hidden="true" />
                      : <span className="h-2 w-2 rounded-full bg-muted-foreground/40" aria-hidden="true" />}
                    {p.replace(/ of \d+$/, '')}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
        <nav aria-label="Inspection steps" className="card-dark grid grid-cols-5 gap-0.5 p-2 sm:gap-1.5 sm:p-3">
          {PROCESS_STAGES.map((s, i) => {
            const done = orderStep !== null && i < orderStep;
            const here = orderStep === i;
            const current = step === i;
            const mark = i === 2 ? scanMark : null;
            return (
              <button
                key={s.key}
                onClick={() => goTo(i)}
                aria-current={current ? 'step' : undefined}
                className={`relative flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 text-center transition-colors sm:px-2 2xl:flex-row 2xl:gap-2.5 2xl:px-3 2xl:text-left ${current ? 'bg-primary/10 shadow-[inset_0_1px_0_var(--glass-edge)]' : 'hover:bg-muted'}`}
              >
                {here && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-warning px-1.5 text-[9px] font-bold text-white 2xl:left-auto 2xl:right-2 2xl:translate-x-0 sm:text-[10px]">Order is here</span>
                )}
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${mark === 'fail' ? 'bg-danger text-white' : mark === 'pass' ? 'bg-emerald-500/20 text-success' : current ? 'bg-primary text-primary-foreground' : done ? 'bg-emerald-500/20 text-success' : 'bg-muted text-muted-foreground'}`}>
                  {mark === 'fail' ? <X size={16} strokeWidth={3} /> : mark === 'pass' ? <Check size={16} strokeWidth={3} /> : done && !current ? <Check size={15} /> : i + 1}
                  {mark && <span className="sr-only">{mark === 'fail' ? 'Failed: ' : 'Passed: '}</span>}
                </span>
                <span className="w-full min-w-0">
                  <span className={`block truncate text-[11px] font-semibold leading-tight sm:whitespace-normal sm:text-sm ${current ? 'text-foreground' : 'text-foreground/80'}`}>
                    <span className="sm:hidden">{SHORT_STAGE[s.key]}</span><span className="hidden sm:inline">{s.label}</span>
                  </span>
                  <span className={`hidden truncate text-xs sm:block ${mark === 'fail' ? 'font-semibold text-danger' : 'text-muted-foreground'}`}>{stepNotes[i]}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* ---- 1 · Upload ---- */}
        <section hidden={step !== 0} className="tab-in card-dark space-y-4 p-5">
          {stepHead(0, 'Take the inspection photos once. They are used for the 3D model and can be scanned for defects. The customer sees them in OrderView as soon as you add them.')}
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${((photoCount + partPhotoCount) / (VIEWS.length + parts.labels.length)) * 100}%` }} />
          </div>
          <PhotoSlots set={photoSet} />
          {/* cabinets, shelf units and dressers: the six views cannot show the inside, the shelves or the drawers */}
          <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">Inside parts{parts.labels.length ? ` · ${partPhotoCount} of ${parts.labels.length}` : ''}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {parts.labels.length
                  ? 'This piece has an inside. Open the doors and pull out the drawers, then take one photo of each part. Use the phone\'s flashlight for dark corners. These are scanned for defects too; the 3D model uses only the six sides.'
                  : 'Doors, shelves or drawers on this piece? Add each one here so its inside is checked too.'}
              </p>
            </div>
            {parts.labels.length > 0 && <PhotoSlots set={parts} name="inside photo" grid="sm:grid-cols-3 xl:grid-cols-6" onRemoveSlot={(i) => { partCloseUps.drop(parts.labels[i]); parts.remove(i); }} />}
            <div className="flex flex-wrap gap-2">
              {PART_KINDS.map((kind) => (
                <button key={kind} type="button" onClick={() => parts.add(kind)} className="btn-secondary flex items-center gap-1.5 text-xs">
                  <Plus size={14} aria-hidden="true" /> {kind}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Whole piece in view', 'Same distance and height for every side.'],
              ['Plain background', 'A wall or open floor, with nothing touching the furniture.'],
              ['Good light', 'Even light without strong shadows, so defects show clearly.'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl border border-border bg-muted/40 p-3 text-sm">
                <p className="font-semibold text-foreground">{t}</p>
                <p className="text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- 2 · 3D Reconstruction ---- */}
        <section hidden={step !== 1} className="tab-in space-y-4">
          <div className="card-dark space-y-4 p-5">
            {stepHead(1, 'Build a 3D model of the whole piece from the Upload photos, with its size from the order. The customer sees the finished model in OrderView.')}
            {orderPieces.length > 0 && piece !== orderPieces[0] ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">The 3D model is made once for this order, from {orderPieces[0]}: the pieces of a set are the same model.</p>
                <button onClick={() => choosePiece(orderPieces[0])} className="btn-secondary text-sm">Go to {orderPieces[0]}</button>
              </div>
            ) : (
              <Model3DPanel key={selectedOrderId} apiUrl={YOLO_API_URL} orderId={selectedOrderId} set={photoSet} onChangePhotos={() => goTo(0)} onBuild={() => advance('upload', 'reconstruction_3d')} onModel={modelBuilt} saved={savedModel} />
            )}
          </div>
        </section>

        {/* ---- 3 · Detect Defects ---- */}
        <section hidden={step !== 2} className="tab-in space-y-4">
          <div className="card-dark space-y-4 p-5">
            {stepHead(2, 'Scan every side of the piece for defects with YOLOv12. Each defect found comes with a recommended fix.')}
          </div>

          <div className="card-dark space-y-3 p-5">
            <div>
              <h3 className="text-base font-semibold text-foreground">Close-up of each side</h3>
              <p className="text-sm text-muted-foreground mt-1">Go nearer than the Upload photos, with that side&apos;s whole surface filling the frame, so small defects show and land in the right place on the 3D model. A side without a close-up is scanned from its Upload photo.</p>
            </div>
            <PhotoSlots set={closeUps} name="close-up" />
          </div>

          {parts.labels.length > 0 && (
            <div className="card-dark space-y-3 p-5">
              <div>
                <h3 className="text-base font-semibold text-foreground">Close-up of each inside part</h3>
                <p className="text-sm text-muted-foreground mt-1">Go close to each inside surface (the shelf top and front edge, the drawer box, the cabinet walls), with the flashlight on, so small defects show. A part without a close-up is scanned from its Upload photo.</p>
              </div>
              <PhotoSlots set={partCloseUps} name="inside close-up" grid="sm:grid-cols-3 xl:grid-cols-6" />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
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
                        scanCount ? (
                          <p className="text-muted-foreground text-sm">Pick a side&apos;s photo to scan it.</p>
                        ) : (
                          <>
                            <p className="text-muted-foreground text-sm">No photos yet. Add close-ups above, or take the photos in step 1.</p>
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
                  {([['photos', 'Side photos', Images], ['live', 'Live camera', Camera], ['file', 'New photo', Upload]] as const).map(([k, label, Icon]) => (
                    <button key={k} onClick={() => switchSource(k)} aria-pressed={source === k} className={`${segButton(source === k)} flex-col justify-center gap-1 px-1 text-xs`}>
                      <Icon size={16} /> {label}
                    </button>
                  ))}
                </div>
                {source === 'photos' && (
                  scanCount ? (
                    <>
                      <PhotoThumbs set={scanSet} selected={scannedSlot} onPick={scanPhoto} />
                      {partCount > 0 && <PhotoThumbs set={partScanSet} selected={scannedPart === null ? null : parts.labels.indexOf(scannedPart)} onPick={scanPart} />}
                      {scanAllButton}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">No photos yet.</p>
                  )
                )}
                <p className="text-xs text-muted-foreground">Pick a photo to scan one side, or scan all of them. Results shows every side; save it there.</p>
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


          {/* the defects on the 3D model; mounted only on this step, so the 3D view does not run in the background */}
          <div className="card-dark space-y-3 p-5">
            <div>
              <h3 className="text-base font-semibold text-foreground">Defects on the 3D model</h3>
              <p className="text-sm text-muted-foreground mt-1">What the scans found, shown on the 3D model from step 2, in edit mode or as pins.</p>
            </div>
            {!model3dUrl ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">No 3D model yet. Build it in step 2, then the defects appear on it here.</p>
                <button onClick={() => goTo(1)} className="btn-secondary flex items-center gap-2 text-sm"><ChevronLeft size={15} /> Go to 3D Reconstruction</button>
              </div>
            ) : orderPieces.length > 0 && piece !== orderPieces[0] ? (
              <p className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">The 3D model is of {orderPieces[0]}, so its defects show there. This piece&apos;s defects are in Results.</p>
            ) : step === 2 ? (
              <ModelDefectsView modelUrl={model3dUrl} pins={pins} />
            ) : null}
          </div>

          {scanMark && (
            <div role="status" className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${scanMark === 'fail' ? 'border-red-500/30 bg-red-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}>
              {scanMark === 'fail' ? <X size={18} className="mt-0.5 shrink-0 text-danger" /> : <Check size={18} className="mt-0.5 shrink-0 text-success" />}
              <p className="text-foreground">
                <span className="font-semibold">{scanMark === 'fail' ? 'Defects found.' : 'Every side is clear.'}</span>{' '}
                {scanMark === 'fail' && inspected.length
                  ? `${failing.length} defect${failing.length === 1 ? '' : 's'} fail${failing.length === 1 ? 's' : ''} this piece${allScanned ? '' : `, with ${scannedSides} of ${scanCount} photos scanned so far`}.`
                  : scanMark === 'fail' ? 'The saved scan failed this piece.' : 'No failing defects.'}
                {' '}{allScanned || !inspected.length ? 'Ready for Results.' : 'Scan the rest, then go to Results.'}
              </p>
            </div>
          )}

          {/* recommended fixes for what was found; Redo clears the scans so the piece can be scanned again after a fix */}
          {advice.length > 0 && (
            <div className="card-dark space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Recommended fixes</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">For each defect found. Fix the piece, then redo the scan; or go on to Results and the admin re-checks it.</p>
                </div>
                <button onClick={redoScan} disabled={analyzing || scanAllAt !== null} className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50">
                  <RotateCcw size={15} /> Redo scan
                </button>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
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
            </div>
          )}
        </section>

        {/* ---- 4 · Results ---- */}
        <section hidden={step !== 3} className="tab-in card-dark space-y-4 p-5">
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
                {!inspectionResult ? 'This is the order\'s last saved scan.'
                  : inspectionResult === 'pass' ? 'No defects that fail the piece.'
                  : `${failing.length} defect${failing.length === 1 ? '' : 's'} that fail the piece. It needs rework before delivery.`}
              </span>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Defects found</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">{inspectionResult ? allDetections.length : '—'}</p>
                  <p className="text-xs text-muted-foreground">{inspectionResult ? `${failing.length} failing, ${allDetections.length - failing.length} natural wood · ${inspected.length} picture${inspected.length === 1 ? '' : 's'}` : 'Scan in Detect Defects'}</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Photos scanned</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">{scannedSides} of {scanCount}</p>
                  <p className="text-xs text-muted-foreground">{scanCount === 0 ? 'No photos yet' : scannedSides < scanCount ? 'Scan all of them to check every photo' : 'Every photo checked'}</p>
                </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Defects by side{parts.labels.length ? ' and inside part' : ''}</p>
                <p className="text-xs text-muted-foreground">Each photo with what YOLOv12 found on it. Tap one to see it larger.</p>
              </div>
              {scanCount > 0 && <div className="w-full sm:w-auto">{scanAllButton}</div>}
            </div>
            <DefectsBySide tiles={sideTiles} />
          </div>

          {inspectionResult && (
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
                  {!selectedOrderId ? 'Choose an order at the top to link this scan to it.' : inspectionResult === 'fail' ? 'Saving creates a rework task and notifies the admin.' : 'Saving notifies the admin.'}
                </span>
              </div>
            </>
          )}
          {selectedOrderId && savedInfo.failed && (
            <div className="flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-border bg-muted/30 p-3">
              {!savedInfo.review ? (
                <>
                  <p className="mr-auto text-xs text-muted-foreground">Is the piece actually clean and this is a false alarm? An admin can review the scan.</p>
                  <button onClick={requestReview} disabled={requesting} className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50">
                    {requesting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send to admin for review
                  </button>
                </>
              ) : (
                <p role="status" className={`mr-auto flex items-start gap-2 text-sm ${savedInfo.review === 'approved' ? 'text-success' : savedInfo.review === 'rejected' ? 'text-danger' : 'text-warning'}`}>
                  {savedInfo.review === 'requested' ? <Loader2 size={15} className="mt-0.5 shrink-0 animate-spin" /> : savedInfo.review === 'approved' ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
                  <span>
                    {savedInfo.review === 'requested' ? 'Waiting for the admin to review the scan. Finish opens only if they approve it as a false alarm.'
                      : savedInfo.review === 'approved' ? 'The admin approved the scan as a false alarm. You can finish the order in Re-check / Finishing.'
                      : 'The admin confirmed the defects. Send the piece back for rework.'}
                    {savedInfo.reviewNote && <span className="block text-xs text-muted-foreground">Admin note: {savedInfo.reviewNote}</span>}
                  </span>
                </p>
              )}
            </div>
          )}
          {selectedOrder && orderStep === 2 && (saved || savedInfo.scan) && (
            <button onClick={() => moveOrder('results')} disabled={moving} className="btn-secondary flex items-center gap-2 text-sm">
              {moving ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />} Move {selectedOrder.order_ref} to Results
            </button>
          )}
        </section>

        {/* ---- 5 · Re-check / Finishing ---- */}
        <section hidden={step !== 4} className="tab-in card-dark space-y-4 p-5">
          {stepHead(4, 'The admin re-checks the results. Finish when the scan passed or the admin approved it; otherwise redo the piece: it goes back to Upload to be fixed and inspected again.')}

          {/* the admin's decision on a failed scan */}
          {selectedOrder && savedInfo.failed && (
            <div role="status" className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${
              savedInfo.review === 'approved' ? 'border-emerald-500/30 bg-emerald-500/10'
                : savedInfo.review === 'rejected' ? 'border-red-500/30 bg-red-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
              {savedInfo.review === 'requested' ? <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-warning" />
                : savedInfo.review === 'approved' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
                : <AlertTriangle size={18} className={`mt-0.5 shrink-0 ${savedInfo.review === 'rejected' ? 'text-danger' : 'text-warning'}`} />}
              <p className="text-foreground">
                <span className="font-semibold">
                  {savedInfo.review === 'requested' ? 'Waiting for the admin to re-check.'
                    : savedInfo.review === 'approved' ? 'Approved by the admin: a false alarm.'
                    : savedInfo.review === 'rejected' ? 'The admin confirmed the defects.'
                    : 'The scan failed.'}
                </span>{' '}
                {savedInfo.review === 'requested' ? 'Finish opens if they approve it.'
                  : savedInfo.review === 'approved' ? 'You can finish the piece.'
                  : savedInfo.review === 'rejected' ? 'Redo the piece: fix it, then inspect it again.'
                  : 'Redo the piece, or ask the admin to re-check it in Results if you think it is a false alarm.'}
                {savedInfo.reviewNote && <span className="mt-1 block text-xs text-muted-foreground">Admin note: {savedInfo.reviewNote}</span>}
              </p>
            </div>
          )}

          {selectedOrder?.extended_status === 'delivered' ? (
            <div role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
              <p className="text-foreground"><span className="font-semibold">{selectedOrder.order_ref} is finished.</span> It passed inspection and is released for delivery. The customer has been told.</p>
            </div>
          ) : selectedOrder && (orderStep === 3 || orderStep === 4) ? (
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={finish} disabled={moving || savedInfo.scan !== 'pass'} className={`${savedInfo.scan === 'pass' ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2 disabled:opacity-50`}>
                {moving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Finish and release for delivery
              </button>
              {orderStep === 4 && (
                <button onClick={() => moveOrder('upload')} disabled={moving} className={`${savedInfo.scan === 'pass' ? 'btn-secondary' : 'btn-primary'} flex items-center gap-2`}>
                  <RotateCcw size={15} /> Redo: send back to be fixed
                </button>
              )}
              {savedInfo.scan !== 'pass' && !savedInfo.failed && (
                <p className="w-full text-xs text-muted-foreground">Save a passing scan in Results first.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {selectedOrder
                ? `${selectedOrder.order_ref} is at ${statusLabel(selectedOrder.extended_status)}. Finish and redo open when it reaches Results.`
                : 'Choose an order at the top to finish it or send it back.'}
            </p>
          )}

          {selectedOrderId && (
            <div className="border-t border-border pt-4">
              <OrderChat orderId={selectedOrderId} compact hint="The customer and the admin see this too. Concerns about the piece come in here." />
            </div>
          )}
          <p className="flex items-start gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
            <Info size={14} className="mt-0.5 shrink-0" />
            Finish only opens when the order&apos;s latest saved scan passed or the admin approved it. Redo sends the order back to Upload, so it is inspected again after the fix.
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
