'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { statusLabel } from '@/lib/orders';

interface Msg {
  id: string;
  sender_id: string;
  sender_name?: string;
  sender_role?: string;
  stage?: string;
  content: string;
  created_at: string;
}

const ROLE: Record<string, { label: string; cls: string }> = {
  admin: { label: 'Admin', cls: 'bg-primary/15 text-primary dark:text-accent' },
  staff: { label: 'Workshop', cls: 'bg-info/15 text-info' },
  customer: { label: 'Customer', cls: 'bg-muted text-muted-foreground' },
};

// One order's conversation between the customer, the workshop staff and the admin: comments on the inspection,
// concerns about the piece, review notes on the defects. Each message shows who wrote it and at which stage.
// The database decides who may read and write (migration 20261106000017).
// With `stage`, only that inspection stage's thread is shown and new messages are filed under it; with `otherThan`,
// everything except those stages (the "other questions" thread).
export default function OrderChat({ orderId, title = 'Conversation about this order', hint, compact = false, stage, otherThan, onCount }: {
  orderId: string; title?: string; hint?: string; compact?: boolean;
  stage?: string; otherThan?: readonly string[]; onCount?: (n: number) => void;
}) {
  const { user } = useAuth();
  const supabase = useRef(createClient()).current;
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  // stable values for the loader, so a new array or callback from the parent does not reload the thread in a loop
  const otherKey = otherThan?.join(',') ?? '';
  const countRef = useRef(onCount);
  countRef.current = onCount;

  const load = useCallback(async () => {
    let q = supabase.from('messages').select('*').eq('order_id', orderId);
    if (stage) q = q.eq('stage', stage);
    const { data, error: e } = await q.order('created_at');
    if (e) { setError('Could not load the messages.'); setMsgs([]); return; }
    const skip = otherKey ? otherKey.split(',') : [];
    const list = ((data ?? []) as Msg[]).filter((m) => !skip.includes(m.stage ?? ''));
    setMsgs(list);
    countRef.current?.(list.length);
    if (user) await supabase.from('messages').update({ is_read: true, status: 'read' }).eq('order_id', orderId).neq('sender_id', user.id).eq('is_read', false);
  }, [orderId, supabase, user, stage, otherKey]);

  useEffect(() => {
    setMsgs(null);
    void load();
    const ch = supabase.channel(`order_chat_${orderId}_${stage ?? 'all'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `order_id=eq.${orderId}` }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orderId, load, supabase, stage]);

  // keep the newest message in view, inside the box only (never scroll the page)
  useEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }, [msgs]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || !user) return;
    setSending(true); setError('');
    const { error: e2 } = await supabase.from('messages').insert({ order_id: orderId, sender_id: user.id, content, status: 'sent', is_read: false, ...(stage ? { stage } : {}) });
    setSending(false);
    if (e2) { setError('Could not send. Please try again.'); return; }
    setText('');
    await load();
  }

  const when = (iso: string) => new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <section className="space-y-3">
      <div>
        <h3 className="flex items-start gap-2 text-base font-semibold leading-snug text-foreground"><MessageSquare size={16} className="mt-1 shrink-0 text-primary dark:text-accent" /> <span className="min-w-0">{title}</span></h3>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>

      <div ref={boxRef} className={`space-y-2.5 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-muted/30 p-3 ${compact ? 'max-h-56' : 'max-h-80'}`} aria-live="polite">
        {msgs === null ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading…</p>
        ) : msgs.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No messages yet. Start the conversation below.</p>
        ) : msgs.map((m) => {
          const mine = m.sender_id === user?.id;
          const role = ROLE[m.sender_role ?? ''];
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-foreground'}`}>
                <div className={`mb-0.5 flex flex-wrap items-center gap-1.5 text-[11px] ${mine ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  <span className="font-semibold">{mine ? 'You' : m.sender_name || 'MVCA WoodWorks'}</span>
                  {!mine && role && <span className={`rounded-full px-1.5 py-px font-semibold ${role.cls}`}>{role.label}</span>}
                  {m.stage && !stage && <span>· {statusLabel(m.stage)}</span>}
                </div>
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <p className={`mt-1 text-[10px] ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{when(m.created_at)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <form onSubmit={send} className="flex items-end gap-2">
        <label className="sr-only" htmlFor={`chat-${orderId}`}>Message</label>
        <textarea id={`chat-${orderId}`} value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={1000}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
          placeholder="Write a message…" className="input-dark min-h-[44px] flex-1 resize-none" />
        <button type="submit" disabled={sending || !text.trim()} aria-label="Send message" className="btn-primary flex h-11 w-11 shrink-0 items-center justify-center p-0">
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </section>
  );
}
