'use client';

// Page guide: the page is dimmed and each part is lit up in turn with a short note on what it does.
// It starts by itself only for accounts made after the guide was added (GUIDE_FROM); older accounts have it off.
// The Guide button in the top bar turns it on or off; turning it on shows every page tour again.
// Remembered in this browser only (localStorage), per account.

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Compass } from 'lucide-react';

/** Accounts made from this moment get the guide on; older accounts start with it off. */
const GUIDE_FROM = Date.parse('2026-11-24T12:00:00Z'); // November 24, 2026, 8:00 PM Philippine time

// A target says how to find a part of the page:  [box>]finder, with '||' between fallbacks.
//   finders:  text:Label (whole text), starts:Label (text begins with), ph:Placeholder, or a CSS selector
//   boxes:    card> the card around it, group> the box around that card and its neighbours, up> its parent
// Labels are matched as written on screen, inside the page first. A step whose part is not on screen is skipped,
// so a renamed label only drops that step. ponytail: text matching, swap for data-tour attributes if labels churn.
type Step = [target: string, title: string, text: string];

const TOP: Step[] = [
  ['[data-tour="role"]', 'Your role', 'Shows which kind of account you are signed in with.'],
  ['[aria-label="Notifications"]', 'Notifications', 'You are told here whenever an order changes. Customers also get these by email.'],
  ['[data-guide-toggle]', 'Page guide', 'Turn the guide off here, or on again to see every page tour again.'],
  ['[data-tour="theme"]', 'Light or dark', 'Switches the screens between light and dark.'],
  ['[data-tour="account"]', 'Your account', 'Open this for your profile settings and to sign out.'],
];
const NAV: Step = ['aside[aria-label="Main navigation"]||[data-tour="menu"]', 'Other pages', 'Every page you can use is in this menu. Each one has its own short guide the first time you open it.'];

const profile = (customer: boolean): Step[] => [
  ['.page-title', 'Your profile', 'Your photo, details, sign-in email and sign-in settings.'],
  ['card>text:Change photo', 'Profile photo', 'Change photo picks a picture and lets you crop it.'],
  ['card>text:Personal details', 'Your details', `Your name, an optional nickname shown at the top, and your mobile number${customer ? ', which the shop uses to reach you about deliveries' : ''}. Press Save changes when done.`],
  ...(customer ? [['card>text:Delivery addresses', 'Delivery addresses', 'Add an address and pin it on the map: search for the place, press Use my location, or tap the map. You need one before ordering for delivery. The pencil edits an address and the bin deletes it.'] as Step] : []),
  ['card>text:Email', 'Sign-in email', 'To change it, type the new email and press Change email. You confirm it from a link sent to the new address.'],
  ['card>text:Two-step sign-in', 'Two-step sign-in', 'Optional. Asks for a 6-digit code from an authenticator app or sent by email when you sign in, so no one else can use your account.'],
];
const messages = (to: string): Step[] => [
  ['.page-title', 'Messages', `Talk to ${to} about an order. Messages are not emailed.`],
  ['up>text:Order Chat', 'Chats and inquiries', 'Order Chat is about one order. Inquiries are customer questions.'],
  ['up>starts:ORD-', 'Conversations', 'Pick an order to open its conversation.'],
  ['ph:Type a message... (Enter to send)', 'Write a message', 'Type and press Enter to send. The paper clip attaches a photo or file.'],
];
const orderManagement = (admin: boolean): Step[] => [
  ['.page-title', 'Order management', admin ? 'Every order and where it is in the inspection process.' : 'The orders in the workshop and where each one is.'],
  ...(admin ? [
    ['text:New walk-in order', 'Store orders', 'For a customer at the store: pick or add the walk-in customer, add the products, choose pick-up or delivery and payment.'] as Step,
    ['card>text:Delivery & payment settings', 'Delivery and payment settings', 'The store address, delivery rates, down payment percent and your GCash and bank details. Press Save settings after changing them.'] as Step,
  ] : []),
  ['up>starts:In production', 'Order status', 'New orders wait for approval, In production are in the workshop, Closed are delivered or cancelled.'],
  ['up>starts:All furniture', 'Kind of furniture', 'Show only tables, chairs, storage and so on.'],
  ['ph:Search orders', 'Find an order', 'Search by order number, furniture or customer.'],
  ['card>text:Active orders', 'Orders', 'Click an order to show its details on the right. Each order shows its stage, staff, due date and value, and whether it was placed online or at the store.'],
  ['card>text:Order details', 'Order details', 'The customer, the date it was ordered, its pieces, value, due date, delivery and progress.'],
  ['card>text:Payment', 'Payment', admin
    ? 'Mark the down payment received when it arrives; only then can the order be approved. Mark Fully paid when the balance is paid. Undo reverses a mistake.'
    : 'Whether the down payment and the balance have been paid.'],
  ['card>text:Assigned staff', 'Assigned staff', admin ? 'Who works on the order. Change picks another staff member; Remove unassigns.' : 'Who works on the order.'],
  ['card>text:Update Process Stage', 'Move the stage', 'Moves the order to the next stage. A stage can be finished only when its checklist and scans are done.'],
  ['card>text:Quick Actions', 'Quick actions', admin ? 'Mark as Delivered when the customer has the furniture, or Cancel Order. Both ask you to confirm first.' : 'Shortcuts for this order. Each asks you to confirm first.'],
];

const customerOverview: Step[] = [
  ['.page-title', 'Your orders at a glance', 'This page shows your orders and where each one is in the workshop.'],
  ['text:No orders yet', 'No orders yet', 'Open Shop Products to place your first order.'],
  ['text:Shop Products', 'Order furniture', 'Opens the shop. Pick a product, add it to your cart and check out.'],
  ['card>text:Process Progress', 'Where your order is', 'Each stage lights up as the workshop finishes it, with how long it took. Your furniture is inspected for defects before it is delivered.'],
  ['up>text:Your orders', 'All your orders', 'Grouped by stage. Click an order to show it above.'],
  ['up>text:Previous', 'More orders', 'Five orders show at a time. Use Previous and Next to see the rest.'],
  ['group>text:Order Value', 'Order details', 'The total in pesos, the queue position, the due date and the quantity of the order shown above.'],
  ['card>text:Delivery Address', 'Delivery', 'Where the order will be delivered, or Pick-up at the shop.'],
  ['card>text:Recent Activity', 'Recent activity', 'What was done on the order, newest first. View full history shows everything.'],
  ['up>text:Send Inquiry', 'Open or ask', 'View Full Order opens the order with its photos and 3D model. Send Inquiry asks the shop a question about it.'],
  NAV, ...TOP,
];

const TOURS: Record<string, Step[]> = {
  // ---------------- customer ----------------
  '/customer-dashboard': customerOverview,
  '/customer-dashboard/overview': customerOverview,
  '/customer-dashboard/order-view': [
    ['.page-title', 'Follow your orders', 'Everything about one order: its stages, photos, 3D model and payment.'],
    ['ph:Search orders...||main :is(.card-dark,.bg-card)', 'Pick an order', 'Choose which of your orders to look at.'],
    ['card>text:Payment', 'Payment', 'Your down payment and balance, and how you chose to pay.'],
    ['ph:GCash or bank reference number', 'Paid online?', 'Type the GCash or bank reference number and press Send reference, so the shop can confirm your payment.'],
    ['up>text:Order Queue', 'Order sections', 'Order Queue shows the stages, Photo Gallery the inspection photos, 3D Preview a 3D model you can turn, and Inquiry your questions about this order.'],
    ['text:Estimated Completion', 'Estimated completion', 'Worked out from how long each stage usually takes. It updates as work goes on.'],
    ['card>text:Inspection Process', 'Stage timeline', 'When each stage started and finished; the times are recorded by the system. Click a stage to see its details.'],
    ['card>text:Other questions', 'Ask about this order', 'Write a message to the shop about this order and press send.'],
    ['text:Cancel order', 'Cancel order', 'Only while the order is still Pending. Give a reason; the shop approves or keeps the order.'],
  ],
  '/customer-dashboard/inquiry': [
    ['.page-title', 'Ask the shop', 'Questions about an order or a product. Replies appear here and in your notifications.'],
    ['text:New Inquiry', 'New inquiry', 'Write a subject and your message, and choose the order it is about.'],
    ['up>text:resolved', 'Filter', 'Show all inquiries, or only open, pending or resolved ones.'],
    ['card>text:Select an inquiry', 'Read and reply', 'Pick an inquiry on the left to read the replies and answer here.'],
  ],
  '/customer-dashboard/shop': [
    ['.page-title', 'Shop our furniture', 'Furniture made by the workshop. In stock pieces are ready now; made to order pieces are built after you order.'],
    ['ph:Search products', 'Find a product', 'Type a name, such as table or chair.'],
    ['up>text:Office Furniture', 'Categories', 'Show only one kind of furniture.'],
    ['card>text:Add to Cart', 'A product', 'Click the photo or name for more photos, the size, the lead time and a 3D model. The arrows page through its photos.'],
    ['text:Add to Cart', 'Add to Cart', 'Adds the product. Chairs can be ordered singly or as a set of 4 or 6.'],
    ['text:Cart', 'Check out', 'Open your cart, choose pick-up or delivery and how you will pay, then place the order.'],
  ],
  '/customer-dashboard/profile': profile(true),

  // ---------------- staff ----------------
  '/staff-dashboard': [
    ['.page-title', 'Your workshop view', 'The order you are working on, its stage and its checklist.'],
    ['up>starts:All furniture', 'Which order', 'Filter by kind of furniture, then pick the order you are working on.'],
    ['card>text:Time in this stage', 'Time in this stage', 'How long the piece has been in its current stage. The time is recorded by itself.'],
    ['card>text:Start Production', 'This order', 'Its stages and the Before starting checklist, which ticks itself when the admin approves the order and assigns it to you.'],
    ['text:Start Production', 'Start Production', 'Starts the stage timer. Pause it during breaks so the times stay right.'],
    ['text:Open in Quality Scan', 'Inspect the piece', 'Opens Quality Scan to take the photos and check the piece for defects.'],
    ['card>text:Your orders', 'Your orders', 'Every order assigned to you, grouped by kind of furniture.'],
    ['card>text:Quick Actions', 'Quick actions', 'Shortcuts to Quality Scan, your tasks, the inventory and messages.'],
    ['card>text:Your recent scans', 'Your recent scans', 'Your latest defect scans and their results.'],
    NAV, ...TOP,
  ],
  '/staff-dashboard/assigned-tasks': [
    ['.page-title', 'Orders assigned to you', 'Every order the admin gave you.'],
    ['card>text:Your orders', 'Your orders', 'Grouped by kind of furniture, with each order\'s stage.'],
    ['text:Open in Quality Scan', 'Inspect', 'Opens the order in Quality Scan.'],
    NAV,
  ],
  '/staff-dashboard/orders': orderManagement(false),
  '/staff/quality-scan': [
    ['.page-title', 'Quality Scan', 'Inspect one order at a time, step by step.'],
    ['card>css:#qs-order||card>starts:All furniture', 'Choose the order', 'Pick the order to inspect. With No order (practice scan), you can practise on any piece of furniture.'],
    ['text:Detection History', 'Detection History', 'Past scans of this order, with their results.'],
    ['card>text:Furniture not in the catalog', 'Furniture not in the catalog', 'With no order chosen, name the piece and save its photos, 3D model and scan under My custom furniture.'],
    ['[aria-label="Pieces of this order"]', 'Choose the piece', 'A set of chairs is checked chair by chair; each piece has its own photos and scan.'],
    ['nav[aria-label="Inspection steps"]', 'Five steps', 'Upload photos, build the 3D model, detect defects, read the results, then re-check after rework. Go left to right.'],
    ['section.card-dark:not([hidden])', 'The current step', 'Upload: take one straight-on photo of the front, left, back, right, top and bottom.'],
    ['up>text:Camera', 'Take a photo', 'Camera opens the device camera; Photos picks saved pictures.'],
    ['up>text:Interior', 'Inside parts', 'Cabinets and shelves? Add the interior, shelves, drawers or door backs so the inside is checked too.'],
    ['starts:Next:', 'Next step', 'Goes on to the next step once this one is done.'],
  ],
  '/staff-dashboard/inventory': [
    ['.page-title', 'Workshop inventory', 'The materials on hand. Items running low are marked.'],
    ['ph:Search materials', 'Find a material', 'Type a name, such as oak or sandpaper.'],
    ['up>text:Finishing', 'Categories', 'Show only wood, hardware, tools or finishing materials.'],
    ['card>css:main h3', 'A material', 'Its stock count, unit and supplier.'],
    NAV,
  ],
  '/staff/chat': messages('the admin'),
  '/staff/profile': profile(false),

  // ---------------- admin ----------------
  '/admin-dashboard': [
    ['.page-title', 'Your dashboard', 'The workshop at a glance.'],
    ['text:Export Reports', 'Export reports', 'Opens Reports, where each report downloads as a CSV file.'],
    ['text:Inspection Monitor', 'Inspection monitor', 'Opens Inspection Progress: stage times and delays of the orders in production.'],
    ['card>text:Total Revenue', 'Revenue', 'Money from orders, not counting cancelled ones. It is hidden until you press the eye.'],
    ['card>text:Orders in Progress', 'Orders in progress', 'Orders being made in the workshop right now.'],
    ['card>text:Active Staff', 'Active staff', 'Staff working on an order now.'],
    ['card>text:Defect Rate', 'Defect rate', 'Inspections that failed out of all judged inspections. A high rate means pieces need more care before inspection.'],
    ['up>text:View Inventory →', 'Low stock', 'Materials below their minimum level. View Inventory opens the list to restock.'],
    ['card>text:Revenue Trend', 'Revenue trend', 'Revenue per month from orders placed.'],
    ['card>text:Product Mix', 'Product mix', 'How many orders are for each kind of furniture.'],
    ['card>text:Recent Orders', 'Recent orders', 'The newest orders and their status. View all opens Order Management.'],
    ['card>text:Live Alerts', 'Alerts', 'Failed scans, review requests and new messages. Click one to open it.'],
    NAV, ...TOP,
  ],
  '/real-time-production-dashboard': [
    ['.page-title', 'Inspection progress', 'How the orders in production are moving through the stages.'],
    ['text:Refresh', 'Refresh', 'Loads the latest stage times.'],
    ['group>text:Total WIP', 'Key numbers', 'Orders in progress, the average time per order, the inspection pass rate and the stages holding orders up.'],
    ['card>text:Orders in progress', 'Orders in progress', 'Each order with its stage and staff. Filter by kind of furniture; click one for its details.'],
    ['card>text:Alerts', 'Alerts', 'Orders that are running late or stuck at a stage.'],
    ['card>text:Process Timeline (PERT + WMA)', 'Process timeline', 'For each stage: the shortest, usual and longest recorded times (O, M, P), the PERT estimate, the recent average (WMA) and whether the workshop is faster or slower than usual.'],
  ],
  '/orders': orderManagement(true),
  '/catalog': [
    ['.page-title', 'Product catalog', 'The furniture shown in the shop.'],
    ['ph:Search products', 'Find a product', 'Type a product name.'],
    ['up>text:Custom Furniture', 'Categories', 'Show one kind of furniture. Custom Furniture lists pieces staff scanned that are not in the shop.'],
    ['text:Add Product', 'Add a product', 'Name, category, price in pesos, size, photos, lead time, and made to order or in stock with the pieces on hand.'],
    ['text:Archived', 'Archived products', 'Archived products are hidden from the shop. Restore them here; only an archived product can be deleted for good.'],
    ['group>text:Total Products', 'Catalog numbers', 'How many products there are, how many are available or low on stock, and how many categories.'],
    ['card>text:View', 'A product', 'View shows it as the customer sees it, Edit changes it, and the box icon archives it.'],
  ],
  '/admin/inventory': [
    ['.page-title', 'Inventory', 'Materials and their stock counts.'],
    ['ph:Search inventory', 'Find a material', 'Type a material name.'],
    ['up>text:Finishing', 'Categories', 'Show only wood, hardware, finishing, tools or other materials.'],
    ['text:Add Item', 'Add a material', 'Set its stock count, unit, supplier and the low-stock level that triggers an alert.'],
    ['text:Archived', 'Archived items', 'Archived materials keep their stock count and can be restored here.'],
    ['card>css:main h3', 'A material', 'Click it to update the stock count or edit it.'],
    ['card>text:Inventory Summary', 'Summary', 'How many items are in stock, low or out of stock.'],
    ['card>text:Quick Actions', 'Quick actions', 'Add an item, show all items, or see the reorder alerts.'],
  ],
  '/admin/team': [
    ['.page-title', 'Your team', 'Your staff and the orders each one is working on.'],
    ['card>text:New Staff Assignment', 'Assign staff', 'Pick a staff member and an order, then press Assign to order. Orders without staff are listed below it.'],
    ['card>text:Who is working on what', 'Who is working on what', 'How many staff there are, who is working now, who is free, and orders without staff.'],
    ['card>text:Team Overview', 'Team overview', 'Each staff member, their department, status and current order.'],
  ],
  '/admin/defect-analytics': [
    ['.page-title', 'Defect analytics', 'Which defects come up most and how serious they are.'],
    ['group>text:Total Defects', 'Defect counts', 'All defects found, how many are resolved, the serious ones, and how sure the detection was on average.'],
    ['card>text:Defect Frequency by Type', 'Most common defects', 'Shows where pieces most often go wrong, so the workshop knows what to watch.'],
    ['card>text:Defects by Severity', 'Severity', 'How many defects are high, medium or low severity.'],
    ['card>text:Recent Defects', 'Recent defects', 'The latest defects with their confidence, status and date.'],
  ],
  '/admin/rework': [
    ['.page-title', 'Rework queue', 'A failing scan creates a rework task here with the recommended fix.'],
    ['group>text:Pending', 'Task counts', 'All tasks, and how many are pending, in progress or resolved.'],
    ['up>text:Rejected', 'Filter', 'Show tasks by their status.'],
    ['card>text:Actions', 'Rework tasks', 'Each task with its order, reason and staff. Start begins a task; the eye shows its details.'],
    ['card>text:Scan reviews', 'False-alarm reviews', 'Staff can ask you to review a scan they think is wrong. Approving it lets the piece pass.'],
  ],
  '/admin/reports': [
    ['.page-title', 'Reports', 'Summaries of inspections, defects, inventory and rework.'],
    ['card>text:Inspection Progress Report', 'A report', 'Each report shows how many records it has.'],
    ['text:Export CSV', 'Export', 'Downloads the report as a CSV file that opens in Excel or Google Sheets.'],
    ['card>text:Order Summary', 'Order summary', 'Total orders, orders in process, delivered orders and the defect rate.'],
  ],
  '/admin/users': [
    ['.page-title', 'User management', 'Every account and its role.'],
    ['text:Add Staff / User', 'Add an account', 'Make an account for a staff member or another admin.'],
    ['group>text:Total Users', 'Account numbers', 'How many admins, staff and customers there are.'],
    ['ph:Search users...', 'Find a user', 'Search by name or email.'],
    ['up>text:Customer', 'Roles', 'Show one role. The Customer tab also keeps the walk-in customers who order at the store.'],
    ['card>text:Actions', 'Accounts', 'The pencil edits a user, the next button deactivates or activates the account, and the bin deletes it. Each asks you to confirm.'],
  ],
  '/admin/audit-logs': [
    ['.page-title', 'Audit logs', 'Every sign-in and order change, with who did it and when.'],
    ['ph:Search by action...', 'Search', 'Find an entry by its action, such as sign-in or stage change.'],
    ['card>text:Timestamp', 'The log', 'When, who, what was done, to which record, and the details of the change.'],
  ],
  '/admin/chat': messages('your staff'),
  '/admin/profile': profile(false),
};

const norm = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();
function visible(el: Element) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth
    && !el.closest('[hidden],[aria-hidden="true"],[data-tour-ui]');
}
const TEXT_TAGS = 'h1,h2,h3,h4,button,a,label,p,span,th,[role="tab"]';
function byText(label: string, starts: boolean) {
  const main = document.querySelector('main');
  for (const scope of [main, document.body]) {
    if (!scope) continue;
    for (const el of Array.from(scope.querySelectorAll(TEXT_TAGS))) {
      const t = norm(el.textContent);
      if ((starts ? t.startsWith(label) : t === label) && visible(el)) return el;
    }
  }
  return null;
}
function findOne(spec: string): Element | null {
  const m = spec.match(/^(card|group|up)>(.*)$/);
  const box = m?.[1], finder = m ? m[2] : spec;
  let el: Element | null;
  if (finder.startsWith('text:')) el = byText(finder.slice(5), false);
  else if (finder.startsWith('starts:')) el = byText(finder.slice(7), true);
  else if (finder.startsWith('ph:')) el = document.querySelector(`[placeholder="${CSS.escape(finder.slice(3))}"]`);
  else {
    try { el = Array.from(document.querySelectorAll(finder.replace(/^css:/, ''))).find(visible) ?? null; } catch { el = null; } // a bad selector only skips its step
  }
  if (el && box === 'up') el = el.parentElement;
  if (el && (box === 'card' || box === 'group')) {
    el = el.closest('.card-dark, .bg-card');
    if (el && box === 'group') el = el.parentElement;
  }
  return el && visible(el) ? el : null;
}
const find = (target: string) => target.split('||').reduce<Element | null>((hit, s) => hit ?? findOne(s), null);

const key = (uid: string, what: string) => `guide.${what}.${uid}`;
function read(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function write(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* storage blocked: the guide just isn't remembered */ } }

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isPhone = () => window.innerWidth < 640;
const TOP_GAP = 88; // the fixed top bar
const PAD = 6;
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

type Box = { left: number; top: number; width: number; height: number };
type Tip = { top: number; left: number; side: 'below' | 'above' | 'right' | 'left' | 'sheet'; arrow: number };

export default function PageTour({ userId, createdAt }: { userId: string; createdAt?: string }) {
  const pathname = usePathname() || '';
  const [on, setOn] = useState(false);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [glide, setGlide] = useState(false); // animate the light between steps, not while the page scrolls
  const [tipShown, setTipShown] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);
  const [faded, setFaded] = useState(false);
  const tipRef = useRef<HTMLDivElement>(null);
  const elRef = useRef<Element | null>(null);

  // on or off: what the account chose, else on only for accounts made after the guide was added
  useEffect(() => {
    const saved = read(key(userId, 'on'));
    const made = createdAt ? Date.parse(createdAt) : NaN;
    setOn(saved !== null ? saved === 'true' : Number.isFinite(made) && made >= GUIDE_FROM);
  }, [userId, createdAt]);

  const seen = useCallback((): string[] => { try { return JSON.parse(read(key(userId, 'seen')) || '[]'); } catch { return []; } }, [userId]);
  const markSeen = useCallback(() => write(key(userId, 'seen'), JSON.stringify(Array.from(new Set([...seen(), pathname])))), [userId, pathname, seen]);

  // start: wait until the page's data has loaded (the same parts found twice in a row), then keep the parts on screen
  useEffect(() => {
    setSteps(null);
    const all = TOURS[pathname];
    if (!on || !all || seen().includes(pathname)) return;
    let tries = 0, last = -1;
    const timer = window.setInterval(() => {
      const found = all.filter(([t]) => find(t));
      tries += 1;
      const settled = tries >= 3 && found.length === last;
      last = found.length;
      if (settled || tries >= 12) {
        window.clearInterval(timer);
        if (found.length) { setI(0); setBox(null); setSteps(found); }
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [pathname, on, seen]);

  const end = useCallback(() => {
    markSeen();
    setFaded(false);
    window.setTimeout(() => { setSteps(null); setBox(null); setTip(null); }, reduceMotion() ? 0 : 180);
  }, [markSeen]);

  function toggle() {
    const next = !on;
    write(key(userId, 'on'), String(next));
    if (next) write(key(userId, 'seen'), '[]'); // turning it on shows every page tour again, starting with this page
    else { setSteps(null); setBox(null); }
    setOn(next);
  }

  const step = steps?.[i];

  // go to a step: scroll its part into view, wait for the scroll to stop, then glide the light to it and show the note
  useEffect(() => {
    if (!step) return;
    let cancelled = false, raf = 0;
    const el = find(step[0]);
    if (!el) { // the part went away (e.g. a list changed): skip it
      if (steps && i < steps.length - 1) setI(i + 1); else end();
      return;
    }
    elRef.current = el;
    setTipShown(false);
    const reserve = isPhone() ? (tipRef.current?.offsetHeight ?? 200) + 16 : 16;
    const r = el.getBoundingClientRect();
    const fixed = !!el.closest('header, aside');
    const room = window.innerHeight - reserve - TOP_GAP;
    if (!fixed && (r.top < TOP_GAP || r.bottom > window.innerHeight - reserve)) {
      const offset = r.height < room ? TOP_GAP + (room - r.height) / 2 : TOP_GAP;
      window.scrollTo({ top: window.scrollY + r.top - offset, behavior: reduceMotion() ? 'auto' : 'smooth' });
    }
    // wait until the part stops moving (scroll finished), at most ~0.9 s
    let lastTop = NaN, still = 0, frames = 0;
    const settle = () => {
      if (cancelled) return;
      const now = el.getBoundingClientRect();
      still = Math.abs(now.top - lastTop) < 0.5 ? still + 1 : 0;
      lastTop = now.top;
      frames += 1;
      if (still >= 3 || frames > 55) {
        setGlide(true);
        setBox({ left: now.left, top: now.top, width: now.width, height: now.height });
        window.setTimeout(() => { if (!cancelled) { setGlide(false); setTipShown(true); } }, reduceMotion() ? 0 : 320);
        setFaded(true);
      } else raf = requestAnimationFrame(settle);
    };
    raf = requestAnimationFrame(settle);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [step, steps, i, end]);

  // follow the part while the page is scrolled or resized (no glide, so it sticks to the part)
  useEffect(() => {
    if (!step || !tipShown) return; // while moving to a step, the glide handles the position
    let raf = 0;
    const follow = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = elRef.current;
        if (!el || !el.isConnected) return;
        const r = el.getBoundingClientRect();
        setBox({ left: r.left, top: r.top, width: r.width, height: r.height });
      });
    };
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', follow, true); window.removeEventListener('resize', follow); };
  }, [step, tipShown]);

  // place the note: under or over the part, else beside it, else (or on a phone) as a panel at the bottom
  useLayoutEffect(() => {
    if (!box || !tipRef.current) return;
    const tw = tipRef.current.offsetWidth, th = tipRef.current.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight, gap = 14, m = 12;
    if (isPhone()) { setTip({ top: vh - th - m, left: m, side: 'sheet', arrow: 0 }); return; }
    const b = { left: box.left - PAD, top: box.top - PAD, right: box.left + box.width + PAD, bottom: box.top + box.height + PAD };
    const clampX = (x: number) => Math.min(Math.max(m, x), vw - tw - m);
    const clampY = (y: number) => Math.min(Math.max(TOP_GAP - 20, y), vh - th - m);
    const arrowX = (left: number) => Math.min(Math.max(18, b.left + Math.min((b.right - b.left) / 2, 56) - left), tw - 30);
    if (b.bottom + gap + th <= vh - m) { const left = clampX(b.left); setTip({ top: b.bottom + gap, left, side: 'below', arrow: arrowX(left) }); return; }
    if (b.top - gap - th >= m) { const left = clampX(b.left); setTip({ top: b.top - gap - th, left, side: 'above', arrow: arrowX(left) }); return; }
    const midY = clampY((Math.max(b.top, 0) + Math.min(b.bottom, vh)) / 2 - th / 2);
    if (b.right + gap + tw <= vw - m) { setTip({ top: midY, left: b.right + gap, side: 'right', arrow: 24 }); return; }
    if (b.left - gap - tw >= m) { setTip({ top: midY, left: b.left - gap - tw, side: 'left', arrow: 24 }); return; }
    setTip({ top: vh - th - m, left: vw - tw - m, side: 'sheet', arrow: 0 });
  }, [box, i, tipShown]);

  // keyboard: Esc ends, arrows move
  useEffect(() => {
    if (!step || !steps) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') end();
      else if (e.key === 'ArrowRight' && tipShown) { if (i === steps.length - 1) end(); else setI(i + 1); }
      else if (e.key === 'ArrowLeft' && tipShown && i > 0) setI(i - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, steps, i, tipShown, end]);

  // keep the focus on the note's main button so keyboard users can go on
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (tipShown) nextRef.current?.focus({ preventScroll: true }); }, [tipShown]);

  // end the tour when the page changes
  useEffect(() => () => { setSteps(null); setBox(null); }, [pathname]);

  const last = steps ? i === steps.length - 1 : false;
  const motion = reduceMotion() ? 'none' : glide ? `all 320ms ${EASE}` : 'none';
  const hole = box && { l: box.left - PAD, t: box.top - PAD, r: box.left + box.width + PAD, b: box.top + box.height + PAD };

  return (
    <>
      <button
        type="button"
        data-guide-toggle
        onClick={toggle}
        aria-pressed={on}
        className={`flex h-10 min-w-10 items-center justify-center gap-2 rounded-xl px-2.5 text-xs font-semibold transition-colors duration-200 sm:h-9 sm:px-3 ${
          on ? 'bg-primary/10 text-primary dark:text-accent' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
        title={on ? 'Page guide is on: each page shows a short tour. Click to turn it off.' : 'Page guide is off. Click to turn it on and see the page tours.'}
        aria-label={on ? 'Page guide on' : 'Page guide off'}
      >
        <Compass size={16} />
        <span className="hidden sm:inline">Guide {on ? 'on' : 'off'}</span>
      </button>

      {step && typeof document !== 'undefined' && createPortal(
        <div
          data-tour-ui
          className="fixed inset-0 z-[200]"
          style={{ opacity: faded ? 1 : 0, transition: reduceMotion() ? 'none' : 'opacity 200ms ease-out' }}
        >
          {/* four dim panels around the lit-up part (a full dim screen before the first part is found) */}
          {hole ? [
            { left: 0, top: 0, width: '100%', height: Math.max(0, hole.t) },
            { left: 0, top: hole.b, width: '100%', bottom: 0 },
            { left: 0, top: hole.t, width: Math.max(0, hole.l), height: hole.b - hole.t },
            { left: hole.r, top: hole.t, right: 0, height: hole.b - hole.t },
          ].map((s, n) => (
            <div key={n} aria-hidden="true" style={{ position: 'fixed', background: 'rgba(14, 8, 26, 0.6)', transition: motion, ...s }} />
          )) : <div aria-hidden="true" style={{ position: 'fixed', inset: 0, background: 'rgba(14, 8, 26, 0.6)' }} />}
          {hole && (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed rounded-xl ring-4 ring-primary"
              style={{ left: hole.l, top: hole.t, width: hole.r - hole.l, height: hole.b - hole.t, transition: motion }}
            />
          )}

          <div
            ref={tipRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="page-tour-title"
            aria-describedby="page-tour-text"
            className="fixed w-[min(340px,calc(100vw-24px))] rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xl max-sm:w-[calc(100vw-24px)]"
            style={{
              top: tip?.top ?? -9999,
              left: tip?.left ?? 0,
              paddingBottom: tip?.side === 'sheet' ? 'calc(1rem + env(safe-area-inset-bottom, 0px))' : undefined,
              opacity: tipShown && tip ? 1 : 0,
              transform: tipShown && tip ? 'none' : tip?.side === 'above' ? 'translateY(-6px)' : 'translateY(6px)',
              transition: reduceMotion() ? 'none' : 'opacity 160ms ease-out, transform 160ms ease-out',
              pointerEvents: tipShown ? 'auto' : 'none',
            }}
          >
            {tip && tip.side !== 'sheet' && (
              <span
                aria-hidden="true"
                className={`absolute h-3.5 w-3.5 rotate-45 bg-card ${
                  tip.side === 'below' ? '-top-[7px] border-l border-t border-border'
                    : tip.side === 'above' ? '-bottom-[7px] border-b border-r border-border'
                      : tip.side === 'right' ? '-left-[7px] border-b border-l border-border' : '-right-[7px] border-r border-t border-border'}`}
                style={tip.side === 'below' || tip.side === 'above' ? { left: tip.arrow } : { top: tip.arrow }}
              />
            )}
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Step {i + 1} of {steps!.length}</p>
              <div className="ml-auto flex gap-1" aria-hidden="true">
                {steps!.map((_, n) => (
                  <span key={n} className={`h-1.5 rounded-full transition-all duration-300 ${n === i ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`} />
                ))}
              </div>
            </div>
            <p id="page-tour-title" className="mt-1 font-semibold text-primary dark:text-accent">{step[1]}</p>
            <p id="page-tour-text" className="mt-1 text-sm leading-relaxed text-foreground">{step[2]}</p>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={end} className="mr-auto rounded-lg px-1 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">Skip tour</button>
              {i > 0 && <button type="button" onClick={() => setI(i - 1)} className="btn-secondary px-3 py-1.5 text-xs">Back</button>}
              <button ref={nextRef} type="button" onClick={() => (last ? end() : setI(i + 1))} className="btn-primary px-3 py-1.5 text-xs">{last ? 'Done' : 'Next'}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
