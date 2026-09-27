'use client';

import React, { useState, useRef, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { Camera, Upload, Play, Pause, RotateCcw, Save, CheckCircle2, AlertTriangle, X, Loader2, Shield, Target, Activity, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { moveOrderStage } from '@/lib/orders';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/ui/StatusBadge';

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

const STAGE_OPTIONS = ['cutting', 'assembly', 'sanding', 'staining', 'finishing', 'quality_check'];
// Same-origin path that next.config.mjs forwards to the Python server, so it also works on phones via an https link.
const YOLO_API_URL = process.env.NEXT_PUBLIC_YOLO_API_URL || '/staff/yolo';
const LIVE_SCAN_INTERVAL_MS = 1000;

const formatLabel = (s: string) => s.replace(/_/g, ' ');

// Thrown when the FastAPI server can't be reached (network failure, or the Next.js proxy can't connect to it).
class BackendOfflineError extends Error {}

async function detectDefects(imageData: string): Promise<DetectResponse> {
  let res: Response;
  try {
    res = await fetch(`${YOLO_API_URL}/api/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData }),
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

export default function QualityScanPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const inFlightRef = useRef(false);

  const [mode, setMode] = useState<'live' | 'upload'>('live');
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
  const [selectedStage, setSelectedStage] = useState('sanding');
  const [notes, setNotes] = useState('');
  const [history, setHistory] = useState<DetectionLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [showHistory, setShowHistory] = useState(false);
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

  async function startCamera() {
    // Browsers only expose the camera on https:// pages or localhost; on http://<laptop-ip> it is simply missing.
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      showToast('error', 'Camera needs a secure (https://) link. On phones, open the site through the https tunnel link.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
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

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setScanning(false);
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
        const res = await detectDefects(frame);
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

  // Redraw the visible canvas: still image + boxes, or transparent boxes over the live video.
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const still = capturedImage || uploadedImage;
    if (still) {
      const img = new Image();
      img.onload = () => drawDetections(canvas, detections, img.naturalWidth, img.naturalHeight, img);
      img.src = still;
    } else {
      const video = videoRef.current;
      drawDetections(canvas, detections, video?.videoWidth || 0, video?.videoHeight || 0);
    }
  }, [detections, capturedImage, uploadedImage, mode]);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-uploading the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const imageData = ev.target?.result as string;
      setUploadedImage(imageData);
      setCapturedImage(null);
      setDetections([]);
      setResult(null);
      analyzeImage(imageData);
    };
    reader.readAsDataURL(file);
  }

  async function rescan() {
    setCapturedImage(null);
    setUploadedImage(null);
    setDetections([]);
    setResult(null);
    setConfidenceAvg(0);
    setNotes('');
    setSaved(false);
    if (mode === 'live') {
      if (!cameraActive) await startCamera();
      startScan();
    }
  }

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  const [releasing, setReleasing] = useState(false);

  // one click after a passing Quality Check scan; the database quality gate still verifies the scan
  async function releaseOrder() {
    if (!selectedOrder) return;
    setReleasing(true);
    try {
      await moveOrderStage(supabase, selectedOrder, 'ready_for_delivery');
      setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? { ...o, extended_status: 'ready_for_delivery' } : o)));
      showToast('success', `${selectedOrder.order_ref} moved to Ready for Delivery`);
    } catch (err: any) {
      showToast('error', err?.message || 'Could not move the order');
    } finally {
      setReleasing(false);
    }
  }

  async function saveDetection() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('detection_logs').insert({
        order_id: selectedOrderId || null,
        stage_name: selectedStage,
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
          stage_name: selectedStage,
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

      setSaved(true);
      // follow-ups (admin notification, rework task) are created by the database trigger after_quality_scan
      showToast('success',
        !selectedOrderId ? 'Detection saved (not linked to an order)'
        : result === 'fail' ? 'Saved. A rework task was created and the admin was notified.'
        : selectedStage === 'quality_check' ? 'Saved. Quality gate passed and the admin was notified.'
        : 'Detection saved successfully');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save detection');
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

  const severityColor: Record<string, string> = {
    low: 'text-info',
    medium: 'text-warning',
    high: 'text-danger',
    critical: 'text-danger',
  };

  const severityBg: Record<string, string> = {
    low: 'bg-info/10 border-info/30',
    medium: 'bg-warning/10 border-warning/30',
    high: 'bg-danger/10 border-danger/30',
    critical: 'bg-danger/20 border-danger/50',
  };

  return (
    <AppLayout role="staff" currentPath="/staff/quality-scan">
      <div className="space-y-6">
        {/* Toast */}
        {toast && (
          <div
            className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold"
            style={{ background: toast.type === 'success' ? '#22C55E' : '#EF4444', color: '#fff' }}
          >
            {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-[0.3em] mb-2">AI Quality Inspection</p>
            <h1 className="text-3xl font-bold text-foreground">YOLO Defect Detection</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Real-time furniture defect detection using AI computer vision. Point camera at workpiece to detect cracks, scratches, dents, and other defects.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="btn-secondary flex items-center gap-2"
            >
              <Activity size={16} /> {showHistory ? 'Hide History' : 'Detection History'}
            </button>
          </div>
        </div>

        {/* Backend offline alert */}
        {backendOffline && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4">
            <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-foreground">AI detection server is offline</p>
              <p className="text-muted-foreground mt-1">
                Couldn&apos;t reach the Python YOLO server on the computer running this site. Start it from the project root, then try again:
              </p>
              <code className="block mt-2 rounded-lg bg-black/40 px-3 py-2 text-xs text-foreground">
                uvicorn src.api.yolo_server:app --reload --port 8000
              </code>
            </div>
            <button onClick={() => setBackendOffline(false)} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Scan Mode</label>
            <div className="flex gap-2 p-1 rounded-xl bg-muted">
              <button
                onClick={() => { setMode('live'); rescan(); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'live' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Camera size={14} /> Live Camera
              </button>
              <button
                onClick={() => { setMode('upload'); stopCamera(); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'upload' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Upload size={14} /> Upload Image
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Production Stage</label>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="input-dark w-full"
            >
              {STAGE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Order (Optional)</label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="input-dark w-full"
            >
              <option value="">Select order...</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>{o.order_ref} — {o.product_name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Camera / Upload Panel */}
          <div className="xl:col-span-2 space-y-4">
            <div className="card-dark rounded-3xl border border-border overflow-hidden">
              {/* Camera View */}
              <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
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
                      style={{ display: cameraActive && !capturedImage ? 'block' : 'none' }}
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {!cameraActive && !capturedImage && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                        <div className="w-20 h-20 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                          <Camera size={32} className="text-accent" />
                        </div>
                        <p className="text-muted-foreground text-sm">Camera not started</p>
                        <button onClick={startCamera} className="btn-primary flex items-center gap-2">
                          <Play size={16} /> Start Camera
                        </button>
                      </div>
                    )}

                    {/* Scanning overlay */}
                    {scanning && cameraActive && !capturedImage && (
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-4 border-2 border-accent/60 rounded-xl" />
                        <div className="absolute top-4 left-4 right-4 h-0.5 bg-accent/60 animate-pulse" />
                        <div className="absolute top-4 left-4 bg-black/60 text-accent text-xs font-bold px-2 py-1 rounded">
                          SCANNING...
                        </div>
                      </div>
                    )}

                    {analyzing && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 size={32} className="text-accent animate-spin" />
                          <p className="text-white text-sm font-semibold">Analyzing with AI...</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {uploadedImage ? (
                      <div className="relative w-full h-full">
                        {analyzing && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3">
                              <Loader2 size={32} className="text-accent animate-spin" />
                              <p className="text-white text-sm font-semibold">Analyzing with AI...</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                        <div className="w-20 h-20 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                          <Upload size={32} className="text-accent" />
                        </div>
                        <p className="text-muted-foreground text-sm">Upload an image to analyze</p>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="btn-primary flex items-center gap-2"
                        >
                          <Upload size={16} /> Choose Image
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Result badge */}
                {result && (
                  <div className={`absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold ${result === 'pass' ? 'bg-success text-white' : 'bg-danger text-white'}`}>
                    {result === 'pass' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                    {result === 'pass' ? 'PASS' : 'FAIL'}
                  </div>
                )}
              </div>

              {/* Camera Controls */}
              <div className="p-4 flex flex-wrap gap-2">
                {mode === 'live' ? (
                  <>
                    {!cameraActive ? (
                      <button onClick={startCamera} className="btn-primary flex items-center gap-2">
                        <Play size={15} /> Start Camera
                      </button>
                    ) : (
                      <>
                        {!capturedImage ? (
                          <>
                            {!scanning ? (
                              <button onClick={startScan} className="btn-primary flex items-center gap-2">
                                <Target size={15} /> Start Scan
                              </button>
                            ) : (
                              <button onClick={pauseScan} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-warning/20 text-warning border border-warning/30 text-sm font-semibold hover:bg-warning/30 transition-all">
                                <Pause size={15} /> Pause Scan
                              </button>
                            )}
                            <button onClick={captureImage} className="btn-secondary flex items-center gap-2">
                              <Camera size={15} /> Capture & Analyze
                            </button>
                          </>
                        ) : (
                          <button onClick={rescan} className="btn-secondary flex items-center gap-2">
                            <RotateCcw size={15} /> Clear &amp; Retry
                          </button>
                        )}
                        <button onClick={stopCamera} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-muted-foreground border border-border text-sm font-semibold hover:text-foreground transition-all">
                          <X size={15} /> Stop Camera
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <button onClick={() => fileInputRef.current?.click()} className="btn-secondary flex items-center gap-2">
                      <Upload size={15} /> Upload Image
                    </button>
                    {uploadedImage && (
                      <button onClick={rescan} className="btn-secondary flex items-center gap-2">
                        <RotateCcw size={15} /> Clear & Retry
                      </button>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                  </>
                )}

                {result && !saved && (
                  <button
                    onClick={saveDetection}
                    disabled={saving}
                    className="btn-primary flex items-center gap-2 ml-auto"
                  >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {saving ? 'Saving...' : 'Save Detection'}
                  </button>
                )}
                {saved && (
                  <div className="ml-auto flex items-center gap-2 text-success text-sm font-semibold">
                    <CheckCircle2 size={15} /> Saved
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {result && (
              <div className="card-dark rounded-3xl border border-border p-4">
                <label className="block text-sm font-medium text-foreground mb-2">Inspection Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input-dark w-full resize-none text-sm"
                  rows={3}
                  placeholder="Add notes about this inspection..."
                />
              </div>
            )}
          </div>

          {/* Detection Results Panel */}
          <div className="space-y-4">
            {/* Summary */}
            <div className="card-dark rounded-3xl border border-border p-5">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Shield size={16} className="text-accent" /> Detection Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {result ? (
                    <StatusBadge variant={result === 'pass' ? 'ok' : 'danger'} label={result === 'pass' ? 'PASS' : 'FAIL'} />
                  ) : (
                    <StatusBadge variant="neutral" label="Pending" />
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Defects Found</span>
                  <span className={`font-bold ${detections.length > 0 ? 'text-danger' : 'text-success'}`}>
                    {detections.length}
                  </span>
                </div>
                {result && detections.length > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Avg Confidence</span>
                    <span className="font-bold text-foreground">{confidenceAvg}%</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Stage</span>
                  <span className="font-semibold text-foreground capitalize">{selectedStage.replace('_', ' ')}</span>
                </div>
              </div>
            </div>

            {/* Detections List */}
            <div className="card-dark rounded-3xl border border-border p-5">
              <h3 className="text-base font-semibold text-foreground mb-4">Detected Defects</h3>
              {analyzing ? (
                <div className="flex items-center justify-center py-8 gap-3">
                  <Loader2 size={20} className="animate-spin text-accent" />
                  <span className="text-sm text-muted-foreground">Analyzing...</span>
                </div>
              ) : detections.length === 0 ? (
                <div className="text-center py-8">
                  {result === 'pass' ? (
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 size={32} className="text-success" />
                      <p className="text-sm font-semibold text-success">No defects detected</p>
                      <p className="text-xs text-muted-foreground">Surface quality approved</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Start scan to detect defects</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {detections.map((det) => (
                    <div key={det.id} className={`rounded-xl border p-3 ${severityBg[det.severity]}`}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold text-foreground capitalize">
                          {formatLabel(det.class_name)}
                        </span>
                        <span className={`text-xs font-bold ${severityColor[det.severity]}`}>
                          {det.confidence_score}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge
                          variant={det.severity === 'critical' || det.severity === 'high' ? 'danger' : det.severity === 'medium' ? 'warning' : 'info'}
                          label={det.severity.charAt(0).toUpperCase() + det.severity.slice(1)}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{det.recommendation}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            {result === 'fail' && (
              <div className="card-dark rounded-3xl border border-border p-5">
                <h3 className="text-base font-semibold text-foreground mb-3">Actions Required</h3>
                <div className="space-y-2">
                  <button
                    onClick={saveDetection}
                    disabled={saving || saved}
                    className="w-full btn-primary flex items-center justify-center gap-2 text-sm"
                  >
                    <AlertTriangle size={14} /> Mark Defect & Save
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {selectedOrderId ? 'Saving creates a rework task for this order and notifies the admin.' : 'Select an order above to create a rework task.'}
                  </p>
                </div>
              </div>
            )}
            {result === 'pass' && (
              <div className="card-dark rounded-3xl border border-border p-5">
                <h3 className="text-base font-semibold text-foreground mb-3">QA Actions</h3>
                <button
                  onClick={saveDetection}
                  disabled={saving || saved}
                  className="w-full btn-primary flex items-center justify-center gap-2 text-sm"
                >
                  <CheckCircle2 size={14} /> Approve QA & Save
                </button>
                {saved && selectedStage === 'quality_check' && selectedOrder?.extended_status === 'quality_inspection' && (
                  <button
                    onClick={releaseOrder}
                    disabled={releasing}
                    className="mt-2 w-full btn-secondary flex items-center justify-center gap-2 text-sm"
                  >
                    {releasing ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />} Move {selectedOrder.order_ref} to Ready for Delivery
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Detection History */}
        {showHistory && (
          <div className="card-dark rounded-3xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Detection History</h3>
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-accent" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No detection history yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Order</th>
                      <th className="px-4 py-3">Stage</th>
                      <th className="px-4 py-3">Mode</th>
                      <th className="px-4 py-3">Defects</th>
                      <th className="px-4 py-3">Confidence</th>
                      <th className="px-4 py-3">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {history.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {new Date(log.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-foreground font-medium">
                          {log.orders?.order_ref || '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground capitalize">
                          {log.stage_name?.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground capitalize">
                          {log.scan_mode?.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${log.defect_count > 0 ? 'text-danger' : 'text-success'}`}>
                            {log.defect_count}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {log.confidence_avg > 0 ? `${log.confidence_avg}%` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            variant={log.overall_result === 'pass' ? 'ok' : log.overall_result === 'fail' ? 'danger' : 'neutral'}
                            label={log.overall_result?.toUpperCase()}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
