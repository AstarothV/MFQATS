'use client';

// Page guide: the first time an account opens a page, the page is dimmed and each part is lit up in turn with a short
// note on what it does. The Guide button in the top bar turns it on or off; turning it on shows every tour again.
// Remembered in this browser only (localStorage), per account.

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Compass } from 'lucide-react';

// A target is found on the page by:
//   'text:Label'  the first visible element whose whole text is Label
//   'card:Label'  the card (.card-dark or .bg-card) holding that element; 'card:#id' or 'card:.class' also work
//   'group:Label' the box around that card and its neighbours;  'up:Label' the element's parent
//   'ph:Text'     the input with that placeholder
//   anything else is a CSS selector.
// ponytail: labels are matched as written on screen; if a label changes, its step is skipped (never breaks the page).
type Step = [target: string, title: string, text: string];

const NAV: Step = ['aside[aria-label="Main navigation"]', 'Other pages', 'Every page you can use is listed here. Each one has its own short guide the first time you open it.'];
const BELL: Step = ['[aria-label="Notifications"]', 'Notifications', 'You are told here whenever an order changes. Customers also get these by email.'];
const TOGGLE: Step = ['[data-guide-toggle]', 'Page guide', 'Turn the guide off here, or turn it back on to see every page tour again.'];

const customerOverview: Step[] = [
  ['.page-title', 'Your orders at a glance', 'This page shows your latest order and where it is in the workshop.'],
  ['text:No orders yet', 'No orders yet', 'Open Shop Products in the menu to place your first order.'],
  ['card:Process Progress', 'Where your order is', 'Each stage lights up as the workshop finishes it. Your furniture is inspected for defects before it is delivered.'],
  ['group:Order Value', 'Order details', 'The total, queue position, due date and quantity of the order shown above.'],
  ['up:Your orders', 'All your orders', 'Every order you placed, five per page. Click one to show it above.'],
  ['card:Recent Activity', 'Recent activity', 'What was done on the order, newest first.'],
  NAV, BELL, TOGGLE,
];
const orderManagement = (admin: boolean): Step[] => [
  ['.page-title', 'Order management', 'Every order and where it is in the inspection process.'],
  ...(admin ? [
    ['text:New walk-in order', 'Store orders', 'For a customer at the store: pick the walk-in customer, add the products, choose pick-up or delivery and payment.'] as Step,
    ['text:Delivery & payment settings', 'Delivery and payment settings', 'Set the delivery rates, the down payment percent and your GCash and bank details.'] as Step,
  ] : []),
  ['ph:Search orders', 'Find an order', 'Search by order number, furniture or customer.'],
  ['card:Active orders', 'Open an order', 'Click an order to see its customer, pieces, payment and progress. Walk-in and Online show where it was placed.'],
  ['card:Order details', 'Order details', admin
    ? 'Mark the down payment received first; only then can the order be approved. Then assign staff and move the stage.'
    : 'The customer, pieces, due date and progress of the order.'],
  ['text:Update Process Stage', 'Move the stage', 'Moves the order one stage on. A stage can be finished only when its checklist and scans are done.'],
];
const intro = (title: string, text: string): Step[] => [['.page-title', title, text], NAV];

const TOURS: Record<string, Step[]> = {
  // customer
  '/customer-dashboard': customerOverview,
  '/customer-dashboard/overview': customerOverview,
  '/customer-dashboard/shop': [
    ['.page-title', 'Shop our furniture', 'Browse the furniture the workshop makes. In stock pieces are ready now; made to order pieces are built after you order.'],
    ['ph:Search products', 'Find a product', 'Type a name, such as table or chair, or pick a category.'],
    ['text:Add to Cart', 'Add to Cart', 'Adds the product. Click the photo first to see more photos, the size and a 3D model. Chairs come singly or as a set of 4 or 6.'],
    ['text:Cart', 'Check out', 'Open your cart, choose pick-up or delivery and how you will pay, then place the order.'],
  ],
  '/customer-dashboard/order-view': [
    ['.page-title', 'Follow your orders', 'Everything about one order: its stages, photos, 3D model and payment.'],
    ['ph:Search orders...', 'Pick an order', 'Search or choose which of your orders to look at.'],
    ['text:Photo Gallery', 'Inspection photos', 'The photos the workshop took of your furniture at each stage.'],
    ['text:3D Preview', '3D model', 'A 3D model built from the inspection photos. Turn it to see every side.'],
    ['text:Estimated Completion', 'Estimated completion', 'Worked out from how long each stage usually takes. It updates as work goes on.'],
    ['card:Inspection Process', 'Stage timeline', 'When each stage started and finished. The times are recorded by the system.'],
    ['card:Payment', 'Payment', 'Your down payment and balance. Paid online? Send the reference number here so the shop can confirm it.'],
    ['text:Cancel order', 'Cancel order', 'Only while the order is still Pending. Give a reason; the shop approves or keeps the order.'],
  ],
  '/customer-dashboard/inquiry': [
    ['.page-title', 'Ask the shop', 'Questions about an order or a product. Replies appear here and in your notifications.'],
    ['text:New Inquiry', 'New inquiry', 'Write a subject and your message, and choose the order it is about.'],
    ['ph:Search inquiries...', 'Your inquiries', 'Find an earlier question and read the reply.'],
  ],
  '/customer-dashboard/profile': [
    ['.page-title', 'Your profile', 'Your details, delivery addresses and sign-in settings.'],
    ['card:Personal details', 'Your details', 'Your name and mobile number. The shop uses the number to reach you about deliveries.'],
    ['card:Delivery addresses', 'Delivery addresses', 'Pin each address on the map: search for the place, press Use my location, or tap the map. You need one before ordering for delivery.'],
    ['card:Two-step sign-in', 'Two-step sign-in', 'Optional. Asks for a 6-digit code when you sign in, so no one else can use your account.'],
  ],

  // staff
  '/staff-dashboard': [
    ['.page-title', 'Your workshop view', 'The order you are working on, its stage and its checklist.'],
    ['card:Time in this stage', 'Time in this stage', 'How long the piece has been in its current stage. The time is recorded by itself.'],
    ['text:Before starting', 'Before starting', 'These tick themselves when the admin approves the order and assigns it to you.'],
    ['text:Start Production', 'Start Production', 'Starts the stage timer. Pause it during breaks so the times stay right.'],
    ['text:Open in Quality Scan', 'Inspect the piece', 'Opens Quality Scan to take the photos and check the piece for defects.'],
    ['card:Your orders', 'Your orders', 'Every order assigned to you.'],
    NAV, BELL, TOGGLE,
  ],
  '/staff-dashboard/assigned-tasks': intro('Orders assigned to you', 'Every order the admin assigned to you. Open one to work on it.'),
  '/staff-dashboard/orders': orderManagement(false),
  '/staff-dashboard/inventory': intro('Materials on hand', 'Stock counts of wood, hardware and finishing materials. Items running low are marked.'),
  '/staff/quality-scan': [
    ['.page-title', 'Quality Scan', 'Inspect one order at a time, step by step.'],
    ['card:#qs-order', 'Choose the order', 'Pick the order to inspect. With no order chosen, you can practise on any piece of furniture.'],
    ['[aria-label="Pieces of this order"]', 'Choose the piece', 'A set of chairs is checked chair by chair; each piece has its own photos and scan.'],
    ['nav[aria-label="Inspection steps"]', 'Five steps', 'Upload photos, build the 3D model, detect defects, read the results, then re-check after rework. Go left to right.'],
    ['section.card-dark:not([hidden])', 'The current step', 'Upload: take one straight-on photo of the front, left, back, right, top and bottom. Cabinets and shelves also need their inside parts.'],
    ['text:Detection History', 'Detection History', 'Past scans of this order, with their results.'],
  ],
  '/staff/chat': intro('Messages', 'Talk to the admin about an order. Messages are not emailed.'),

  // admin
  '/admin-dashboard': [
    ['.page-title', 'Your dashboard', 'The workshop at a glance.'],
    ['card:Total Revenue', 'The numbers', 'Revenue, orders in the workshop and staff working now.'],
    ['card:Defect Rate', 'Defect rate', 'Inspections that failed out of all judged inspections. A high rate means pieces need more care before inspection.'],
    ['card:Revenue Trend', 'Revenue trend', 'Money from orders each month, not counting cancelled ones.'],
    ['card:Recent Orders', 'Recent orders', 'The newest orders and their status. Open Order Management to act on them.'],
    ['card:Live Alerts', 'Alerts', 'Failed scans, low stock and other things that need you.'],
    NAV, BELL, TOGGLE,
  ],
  '/real-time-production-dashboard': intro('Inspection progress', 'How long each order has spent in its stage. Orders running late are marked so you can follow up.'),
  '/orders': orderManagement(true),
  '/catalog': [
    ['.page-title', 'Product catalog', 'The furniture shown in the shop, with its price in pesos, size, photos and lead time.'],
    ['text:Add Product', 'Add a product', 'Choose made to order or in stock; in-stock products also need the pieces on hand.'],
    ['text:Archived', 'Archived products', 'Archive hides a product from the shop. Restore it here; only an archived product can be deleted for good.'],
  ],
  '/admin/inventory': [
    ['.page-title', 'Inventory', 'Materials and their stock counts.'],
    ['text:Add Item', 'Add a material', 'Set its stock count and the low-stock level that triggers an alert.'],
    ['text:Archived', 'Archived items', 'Archived materials keep their stock count and can be restored here.'],
  ],
  '/admin/team': intro('Your team', 'Your staff and the orders each one is working on.'),
  '/admin/defect-analytics': [
    ['.page-title', 'Defect analytics', 'Which defects come up most and how serious they are.'],
    ['card:Total Defects', 'Defect counts', 'All defects found, how many are resolved, and the serious ones.'],
    ['card:Defect Frequency by Type', 'Most common defects', 'Shows where pieces most often go wrong, so the workshop knows what to watch.'],
  ],
  '/admin/rework': [
    ['.page-title', 'Rework queue', 'A failing scan creates a rework task here with the recommended fix.'],
    ['card:Scan reviews', 'False-alarm reviews', 'Staff can ask you to review a scan they think is wrong. Approving it lets the piece pass.'],
  ],
  '/admin/reports': [
    ['.page-title', 'Reports', 'Summaries of inspections, defects, inventory and rework.'],
    ['text:Export CSV', 'Export', 'Downloads the report as a CSV file that opens in Excel or Google Sheets.'],
  ],
  '/admin/users': intro('User management', 'Accounts and their roles. Walk-in customers are on the Customer tab.'),
  '/admin/audit-logs': intro('Audit logs', 'Every sign-in and order change, with who did it and when.'),
  '/admin/chat': intro('Messages', 'Talk to your staff about an order.'),
};

const norm = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();
function visible(el: Element) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth && !el.closest('[hidden],[aria-hidden="true"]');
}
function byText(label: string) {
  const els = document.querySelectorAll('h1,h2,h3,h4,button,a,label,p,span,[role="tab"]');
  for (const el of Array.from(els)) if (norm(el.textContent) === label && visible(el)) return el;
  return null;
}
function find(target: string): Element | null {
  if (target.startsWith('text:')) return byText(target.slice(5));
  if (target.startsWith('ph:')) {
    const el = document.querySelector(`[placeholder="${CSS.escape(target.slice(3))}"]`);
    return el && visible(el) ? el : null;
  }
  if (target.startsWith('up:')) {
    const el = byText(target.slice(3))?.parentElement ?? null;
    return el && visible(el) ? el : null;
  }
  if (target.startsWith('card:') || target.startsWith('group:')) {
    const t = target.slice(target.indexOf(':') + 1);
    const inner = /^[#.[]/.test(t) ? document.querySelector(t) : byText(t);
    let card: Element | null = inner?.closest('.card-dark, .bg-card') ?? null;
    if (card && target.startsWith('group:')) card = card.parentElement;
    return card && visible(card) ? card : null;
  }
  const el = document.querySelector(target);
  return el && visible(el) ? el : null;
}

const key = (uid: string, what: string) => `guide.${what}.${uid}`;
function read(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function write(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* storage blocked: the guide just isn't remembered */ } }

export default function PageTour({ userId }: { userId: string }) {
  const pathname = usePathname() || '';
  const [on, setOn] = useState(true);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipPos, setTipPos] = useState<{ top: number; left: number; below: boolean; arrow: number } | null>(null);

  useEffect(() => { setOn(read(key(userId, 'on')) !== 'false'); }, [userId]);

  const seen = useCallback((): string[] => { try { return JSON.parse(read(key(userId, 'seen')) || '[]'); } catch { return []; } }, [userId]);
  const markSeen = useCallback(() => write(key(userId, 'seen'), JSON.stringify(Array.from(new Set([...seen(), pathname])))), [userId, pathname, seen]);

  // start: wait for the page's data to load, then keep only the steps whose part is on screen
  const start = useCallback(() => {
    const all = TOURS[pathname];
    if (!all) return () => {};
    let tries = 0, last = -1;
    const timer = window.setInterval(() => {
      const found = all.filter(([t]) => find(t));
      tries += 1;
      // start once the page has settled: the same parts found twice in a row (after at least 1.5 s), or after 6 s
      const settled = tries >= 3 && found.length === last;
      last = found.length;
      if (settled || tries >= 12) {
        window.clearInterval(timer);
        if (found.length) { setSteps(found); setI(0); }
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [pathname]);

  useEffect(() => {
    setSteps(null);
    if (!on || seen().includes(pathname)) return;
    return start();
  }, [pathname, on, start, seen]);

  const end = useCallback(() => { markSeen(); setSteps(null); }, [markSeen]);

  function toggle() {
    const next = !on;
    setOn(next);
    write(key(userId, 'on'), String(next));
    if (next) write(key(userId, 'seen'), '[]'); // turning it on shows every page tour again (and this one now)
    else setSteps(null);
  }

  const step = steps?.[i];
  // follow the lit-up part while the page scrolls or resizes
  useEffect(() => {
    if (!step) { setBox(null); return; }
    const el = find(step[0]);
    if (!el) { setI((n) => (steps && n < steps.length - 1 ? n + 1 : n)); if (steps && i >= steps.length - 1) end(); return; }
    el.scrollIntoView({ block: 'center', behavior: 'auto' });
    let raf = 0;
    const measure = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setBox(el.getBoundingClientRect())); };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure); };
  }, [step, steps, i, end]);

  useLayoutEffect(() => {
    if (!box || !tipRef.current) { setTipPos(null); return; }
    const tw = tipRef.current.offsetWidth, th = tipRef.current.offsetHeight, vw = window.innerWidth, vh = window.innerHeight, gap = 14;
    const left = Math.min(Math.max(12, box.left), vw - tw - 12);
    const below = box.bottom + gap + th < vh - 12 || box.top - gap - th < 12;
    const top = Math.min(Math.max(12, below ? box.bottom + gap : box.top - gap - th), vh - th - 12);
    const arrow = Math.min(Math.max(16, box.left + Math.min(box.width / 2, 48) - left), tw - 28);
    setTipPos({ top, left, below, arrow });
  }, [box, i]);

  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') end(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, end]);

  const last = steps ? i === steps.length - 1 : false;
  const pad = 6;

  return (
    <>
      <button
        type="button"
        data-guide-toggle
        onClick={toggle}
        aria-pressed={on}
        className={`flex h-10 min-w-10 items-center justify-center gap-2 rounded-xl px-2.5 text-xs font-semibold transition-colors duration-200 sm:h-9 sm:px-3 ${
          on ? 'bg-primary/10 text-primary dark:text-accent' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
        title={on ? 'Page guide is on: each page shows a short tour. Click to turn it off.' : 'Page guide is off. Click to turn it on and see the page tours again.'}
        aria-label={on ? 'Page guide on' : 'Page guide off'}
      >
        <Compass size={16} />
        <span className="hidden sm:inline">Guide {on ? 'on' : 'off'}</span>
      </button>

      {step && box && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[200]" role="presentation">
          {/* everything but the lit-up part is dimmed (four panels around it), and the part gets a ring */}
          {(() => {
            const l = box.left - pad, t = box.top - pad, r = box.right + pad, b = box.bottom + pad;
            return [
              { left: 0, top: 0, right: 0, height: Math.max(0, t) },
              { left: 0, top: b, right: 0, bottom: 0 },
              { left: 0, top: t, width: Math.max(0, l), height: b - t },
              { left: r, top: t, right: 0, height: b - t },
            ].map((s, n) => <div key={n} aria-hidden="true" style={{ position: 'fixed', background: 'rgba(14, 8, 26, 0.6)', ...s }} />);
          })()}
          <div
            aria-hidden="true"
            className="pointer-events-none fixed rounded-xl ring-4 ring-primary"
            style={{ left: box.left - pad, top: box.top - pad, width: box.width + pad * 2, height: box.height + pad * 2 }}
          />
          <div
            ref={tipRef}
            role="dialog"
            aria-modal="true"
            aria-label={step[1]}
            className="fixed w-[min(340px,calc(100vw-24px))] rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xl"
            style={{ top: tipPos?.top ?? -9999, left: tipPos?.left ?? 0, visibility: tipPos ? 'visible' : 'hidden' }}
          >
            <span
              aria-hidden="true"
              className={`absolute h-3.5 w-3.5 rotate-45 border-border bg-card ${tipPos?.below ? '-top-[7px] border-l border-t' : '-bottom-[7px] border-b border-r'}`}
              style={{ left: tipPos?.arrow ?? 16 }}
            />
            <p className="text-xs text-muted-foreground">Step {i + 1} of {steps!.length}</p>
            <p className="mt-0.5 font-semibold text-primary dark:text-accent">{step[1]}</p>
            <p className="mt-1 text-sm text-foreground">{step[2]}</p>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={end} className="mr-auto text-xs font-medium text-muted-foreground hover:text-foreground">Skip tour</button>
              {i > 0 && <button type="button" onClick={() => setI(i - 1)} className="btn-secondary px-3 py-1.5 text-xs">Back</button>}
              <button type="button" autoFocus onClick={() => (last ? end() : setI(i + 1))} className="btn-primary px-3 py-1.5 text-xs">{last ? 'Done' : 'Next'}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
