'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Send, Search, Plus, Loader2, X, AlertCircle, CheckCircle2, Package, Filter } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/ui/StatusBadge';

interface Inquiry {
  id: string;
  inquiry_ref: string;
  subject: string;
  status: 'open' | 'pending' | 'resolved';
  priority: string;
  order_id: string | null;
  customer_id: string;
  created_at: string;
  updated_at: string;
  order?: { order_ref: string; product_name: string } | null;
  customer?: { full_name: string; email: string } | null;
  last_message?: string;
  message_count?: number;
}

interface InquiryMessage {
  id: string;
  inquiry_id: string;
  sender_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  sender?: { full_name: string; role: string };
}

interface InquirySystemProps {
  userRole: 'customer' | 'admin' | 'staff';
}

const STATUS_COLORS = {
  open: 'info' as const,
  pending: 'warning' as const,
  resolved: 'ok' as const,
};

const STATUS_LABELS = { open: 'Open', pending: 'Pending', resolved: 'Resolved' };

export default function InquirySystem({ userRole }: InquirySystemProps) {
  const { user, profile } = useAuth();
  const supabase = createClient();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'pending' | 'resolved'>('all');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newContent, setNewContent] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  const fetchInquiries = useCallback(async () => {
    if (!user) return;
    let query = supabase
      .from('inquiries')
      .select('*, order:order_id(order_ref, product_name), customer:customer_id(full_name, email)')
      .order('updated_at', { ascending: false });

    if (userRole === 'customer') {
      query = query.eq('customer_id', user.id);
    }

    const { data } = await query;
    if (data) setInquiries(data);
    setLoading(false);
  }, [user, supabase, userRole]);

  useEffect(() => {
    fetchInquiries();
    if (!user) return;

    // Fetch orders for new inquiry form
    const fetchOrders = async () => {
      let q = supabase.from('orders').select('id, order_ref, product_name');
      if (userRole === 'customer') q = q.eq('customer_id', user.id);
      const { data } = await q.order('created_at', { ascending: false }).limit(20);
      if (data) setOrders(data);
    };
    fetchOrders();

    // Real-time for inquiries
    const channel = supabase
      .channel('inquiries_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inquiries' }, () => {
        fetchInquiries();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, userRole]);

  const fetchMessages = useCallback(async (inquiryId: string) => {
    setMessagesLoading(true);
    const { data } = await supabase
      .from('inquiry_messages')
      .select('*, sender:sender_id(full_name, role)')
      .eq('inquiry_id', inquiryId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as InquiryMessage[]);
    setMessagesLoading(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [supabase]);

  useEffect(() => {
    if (!selectedInquiry) return;
    fetchMessages(selectedInquiry.id);

    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = supabase
      .channel(`inquiry_msgs_${selectedInquiry.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'inquiry_messages',
        filter: `inquiry_id=eq.${selectedInquiry.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as InquiryMessage]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })
      .subscribe();

    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [selectedInquiry?.id]);

  async function sendMessage() {
    if (!newMessage.trim() || !selectedInquiry || !user) return;
    setSending(true);
    try {
      const { error } = await supabase.from('inquiry_messages').insert({
        inquiry_id: selectedInquiry.id,
        sender_id: user.id,
        content: newMessage.trim(),
        is_internal: false,
      });
      if (error) throw error;

      // Update inquiry status if staff/admin replying
      if (userRole !== 'customer' && selectedInquiry.status === 'open') {
        await supabase.from('inquiries').update({ status: 'pending' }).eq('id', selectedInquiry.id);
      }

      setNewMessage('');
      fetchInquiries();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  async function createInquiry() {
    if (!newSubject.trim() || !newContent.trim() || !user) return;
    setCreating(true);
    try {
      const { data: inquiry, error } = await supabase.from('inquiries').insert({
        customer_id: user.id,
        order_id: selectedOrderId || null,
        subject: newSubject.trim(),
        status: 'open',
        priority: 'normal',
        inquiry_ref: '',
      }).select().single();

      if (error) throw error;

      // Add first message
      await supabase.from('inquiry_messages').insert({
        inquiry_id: inquiry.id,
        sender_id: user.id,
        content: newContent.trim(),
        is_internal: false,
      });

      showToast('success', 'Inquiry created successfully');
      setShowNewForm(false);
      setNewSubject('');
      setNewContent('');
      setSelectedOrderId('');
      fetchInquiries();
      setSelectedInquiry(inquiry);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to create inquiry');
    } finally {
      setCreating(false);
    }
  }

  async function updateInquiryStatus(inquiryId: string, status: 'open' | 'pending' | 'resolved') {
    const { error } = await supabase.from('inquiries').update({
      status,
      resolved_at: status === 'resolved' ? new Date().toISOString() : null,
      resolved_by: status === 'resolved' ? user?.id : null,
    }).eq('id', inquiryId);
    if (!error) {
      fetchInquiries();
      if (selectedInquiry?.id === inquiryId) {
        setSelectedInquiry(prev => prev ? { ...prev, status } : prev);
      }
      showToast('success', `Inquiry marked as ${status}`);
    }
  }

  const filteredInquiries = inquiries.filter(inq => {
    const matchSearch = inq.subject?.toLowerCase().includes(search.toLowerCase()) ||
      inq.inquiry_ref?.toLowerCase().includes(search.toLowerCase()) ||
      inq.order?.order_ref?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || inq.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const unreadCount = inquiries.filter(i => i.status === 'open').length;

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white ${toast.type === 'success' ? 'bg-success' : 'bg-danger'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Inquiries
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-danger text-white text-xs font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {filteredInquiries.length} inquir{filteredInquiries.length !== 1 ? 'ies' : 'y'}
          </p>
        </div>
        {userRole === 'customer' && (
          <button
            type="button"
            onClick={() => setShowNewForm(true)}
            className="btn-primary flex items-center gap-2 text-sm self-start sm:self-auto"
          >
            <Plus size={15} /> New Inquiry
          </button>
        )}
      </div>

      {/* New Inquiry Form */}
      {showNewForm && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">New Inquiry</h3>
            <button type="button" onClick={() => setShowNewForm(false)} className="text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Subject</label>
              <input
                type="text"
                value={newSubject}
                onChange={e => setNewSubject(e.target.value)}
                placeholder="What is your inquiry about?"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {orders.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Related Order (optional)</label>
                <select
                  value={selectedOrderId}
                  onChange={e => setSelectedOrderId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">No specific order</option>
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>#{o.order_ref} — {o.product_name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Message</label>
              <textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="Describe your inquiry in detail..."
                rows={4}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createInquiry}
                disabled={creating || !newSubject.trim() || !newContent.trim()}
                className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search inquiries..."
            className="w-full rounded-xl border border-border bg-card pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'open', 'pending', 'resolved'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStatus(s)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all capitalize ${filterStatus === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-purple-600 dark:text-purple-300" />
        </div>
      ) : (
        <div className="flex flex-col gap-4 xl:flex-row">
          {/* Inquiries List */}
          <div className="xl:w-[40%] space-y-2">
            {filteredInquiries.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card py-12 text-center">
                <MessageSquare size={28} className="mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">No inquiries found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {userRole === 'customer' ? 'Create a new inquiry to get started' : 'No inquiries match your filter'}
                </p>
              </div>
            ) : (
              filteredInquiries.map(inq => (
                <button
                  key={inq.id}
                  type="button"
                  onClick={() => setSelectedInquiry(inq)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all duration-150 ${
                    selectedInquiry?.id === inq.id
                      ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20' :'border-border bg-card hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-foreground line-clamp-1">{inq.subject}</p>
                    <StatusBadge variant={STATUS_COLORS[inq.status]} label={STATUS_LABELS[inq.status]} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>#{inq.inquiry_ref}</span>
                    {inq.order && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1"><Package size={10} /> {inq.order.order_ref}</span>
                      </>
                    )}
                    {userRole !== 'customer' && inq.customer && (
                      <>
                        <span>·</span>
                        <span>{inq.customer.full_name}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {new Date(inq.updated_at).toLocaleDateString()}
                  </p>
                </button>
              ))
            )}
          </div>

          {/* Thread View */}
          <div className="xl:flex-1">
            {!selectedInquiry ? (
              <div className="rounded-2xl border border-border bg-card py-16 text-center h-full flex flex-col items-center justify-center">
                <MessageSquare size={28} className="mb-3 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Select an inquiry</p>
                <p className="text-xs text-muted-foreground mt-1">Choose an inquiry from the list to view the conversation</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col" style={{ minHeight: '500px' }}>
                {/* Thread Header */}
                <div className="p-4 border-b border-border">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{selectedInquiry.subject}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>#{selectedInquiry.inquiry_ref}</span>
                        {selectedInquiry.order && (
                          <span className="flex items-center gap-1"><Package size={10} /> {selectedInquiry.order.order_ref}</span>
                        )}
                        {userRole !== 'customer' && selectedInquiry.customer && (
                          <span>· {selectedInquiry.customer.full_name}</span>
                        )}
                        <span>· {new Date(selectedInquiry.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge variant={STATUS_COLORS[selectedInquiry.status]} label={STATUS_LABELS[selectedInquiry.status]} />
                      {userRole !== 'customer' && (
                        <div className="flex gap-1">
                          {selectedInquiry.status !== 'resolved' && (
                            <button
                              type="button"
                              onClick={() => updateInquiryStatus(selectedInquiry.id, 'resolved')}
                              className="rounded-lg border border-success/30 bg-success/5 px-2 py-1 text-xs font-semibold text-success hover:bg-success/10 transition-all"
                            >
                              Resolve
                            </button>
                          )}
                          {selectedInquiry.status === 'resolved' && (
                            <button
                              type="button"
                              onClick={() => updateInquiryStatus(selectedInquiry.id, 'open')}
                              className="rounded-lg border border-border bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted/80 transition-all"
                            >
                              Reopen
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: '400px' }}>
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={18} className="animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No messages yet</p>
                  ) : (
                    messages.map(msg => {
                      const isOwn = msg.sender_id === user?.id;
                      const senderName = msg.sender?.full_name || 'Unknown';
                      const senderRole = msg.sender?.role || '';
                      return (
                        <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            isOwn
                              ? 'bg-primary text-primary-foreground rounded-br-sm'
                              : 'bg-muted text-foreground rounded-bl-sm'
                          }`}>
                            {!isOwn && (
                              <p className="text-xs font-semibold mb-1 opacity-70">
                                {senderName} {senderRole && senderRole !== 'customer' ? `(${senderRole})` : ''}
                              </p>
                            )}
                            <p className="text-sm">{msg.content}</p>
                            <p className={`text-2xs mt-1 ${isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground/60'}`}>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                {selectedInquiry.status !== 'resolved' && (
                  <div className="p-4 border-t border-border">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                        placeholder="Type your message..."
                        className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <button
                        type="button"
                        onClick={sendMessage}
                        disabled={sending || !newMessage.trim()}
                        className="btn-primary flex items-center gap-2 px-4 disabled:opacity-50"
                      >
                        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      </button>
                    </div>
                  </div>
                )}
                {selectedInquiry.status === 'resolved' && (
                  <div className="p-4 border-t border-border text-center">
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <CheckCircle2 size={12} className="text-success" /> This inquiry has been resolved
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
