'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Send, Loader2, CheckCheck, Clock, Package, ChevronDown, User, Shield, Wrench } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  id: string;
  order_id: string | null;
  sender_id: string;
  receiver_id: string | null;
  content: string;
  attachment_url: string;
  attachment_name: string;
  status: string;
  is_read: boolean;
  created_at: string;
  sender?: { full_name: string; role: string };
}

interface Order {
  id: string;
  order_ref: string;
  product_name: string;
  status: string;
}

interface ChatSystemProps {
  userRole: 'customer' | 'admin' | 'staff';
  preselectedOrderId?: string;
}

export default function ChatSystem({ userRole, preselectedOrderId }: ChatSystemProps) {
  const { user, profile } = useAuth();
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(preselectedOrderId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showOrderPicker, setShowOrderPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  const fetchMessages = useCallback(async () => {
    if (!selectedOrderId || !user) return;

    const { data } = await supabase
      .from('messages')
      .select('*, sender:sender_id(full_name, role)')
      .eq('order_id', selectedOrderId)
      .order('created_at', { ascending: true });

    if (data) setMessages(data as Message[]);

    await supabase
      .from('messages')
      .update({ is_read: true, status: 'read' })
      .eq('order_id', selectedOrderId)
      .neq('sender_id', user.id);
  }, [selectedOrderId, user, supabase]);

  useEffect(() => {
    if (!user) return;
    const fetchOrders = async () => {
      let query = supabase.from('orders').select('id, order_ref, product_name, status');
      if (userRole === 'customer') {
        query = query.eq('customer_id', user.id);
      }
      query = query.order('created_at', { ascending: false }).limit(20);
      const { data } = await query;
      if (data) {
        setOrders(data);
        if (!selectedOrderId && data.length > 0) {
          setSelectedOrderId(data[0].id);
        }
      }
    };
    fetchOrders();
  }, [user, userRole, supabase, selectedOrderId]);

  useEffect(() => {
    if (!selectedOrderId || !user) return;
    let mounted = true;
    setLoading(true);

    void fetchMessages().finally(() => {
      if (mounted) setLoading(false);
    });

    // Real-time subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    channelRef.current = supabase
      .channel(`messages_${selectedOrderId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `order_id=eq.${selectedOrderId}`,
      }, () => {
        void fetchMessages();
      })
      .subscribe();

    const refreshInterval = window.setInterval(() => {
      void fetchMessages();
    }, 4000);

    return () => {
      mounted = false;
      window.clearInterval(refreshInterval);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [selectedOrderId, user, fetchMessages, supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!newMessage.trim() || !user || !selectedOrderId) return;
    setSending(true);
    try {
      await supabase.from('messages').insert({
        order_id: selectedOrderId,
        sender_id: user.id,
        content: newMessage.trim(),
        status: 'sent',
        is_read: false,
      });
      setNewMessage('');
      await fetchMessages();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const selectedOrder = orders.find(o => o.id === selectedOrderId);
  const unreadCount = messages.filter(m => !m.is_read && m.sender_id !== user?.id).length;

  const getRoleIcon = (role: string) => {
    if (role === 'admin') return <Shield size={10} className="text-warning" />;
    if (role === 'staff') return <Wrench size={10} className="text-info" />;
    return <User size={10} className="text-success" />;
  };

  const getRoleLabel = (role: string) => {
    if (role === 'admin') return 'Admin';
    if (role === 'staff') return 'Staff';
    return 'Customer';
  };

  return (
    <div className="flex flex-col h-[600px] rounded-3xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageSquare size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Order Chat</p>
            {selectedOrder && (
              <p className="text-xs text-muted-foreground">{selectedOrder.order_ref} · {selectedOrder.product_name}</p>
            )}
          </div>
        </div>
        {orders.length > 1 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowOrderPicker(!showOrderPicker)}
              className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-all"
            >
              <Package size={13} />
              {selectedOrder?.order_ref || 'Select Order'}
              <ChevronDown size={12} />
            </button>
            {showOrderPicker && (
              <div className="absolute right-0 top-10 z-50 w-64 rounded-2xl border border-border bg-card p-2 shadow-2xl">
                {orders.map(order => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => { setSelectedOrderId(order.id); setShowOrderPicker(false); }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${selectedOrderId === order.id ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}
                  >
                    <p className="font-semibold">{order.order_ref}</p>
                    <p className="text-xs text-muted-foreground truncate">{order.product_name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-accent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare size={32} className="text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">Start a conversation about your order</p>
          </div>
        ) : (
          messages.map(msg => {
            const isOwn = msg.sender_id === user?.id;
            const senderName = (msg.sender as any)?.full_name || 'User';
            const senderRole = (msg.sender as any)?.role || 'customer';
            return (
              <div key={msg.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                  {senderName.charAt(0).toUpperCase()}
                </div>
                <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {!isOwn && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">{senderName}</span>
                      <span className="flex items-center gap-0.5 text-2xs text-muted-foreground">
                        {getRoleIcon(senderRole)} {getRoleLabel(senderRole)}
                      </span>
                    </div>
                  )}
                  <div className={`rounded-2xl px-4 py-2.5 text-sm ${isOwn ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted text-foreground rounded-tl-sm'}`}>
                    {msg.content}
                  </div>
                  <div className={`flex items-center gap-1 text-2xs text-muted-foreground ${isOwn ? 'flex-row-reverse' : ''}`}>
                    <Clock size={9} />
                    <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isOwn && msg.is_read && <CheckCheck size={11} className="text-primary" />}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        {!selectedOrderId ? (
          <p className="text-sm text-muted-foreground text-center">Select an order to start chatting</p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Enter to send)"
              className="input-dark flex-1 resize-none min-h-[40px] max-h-[120px] py-2.5"
              rows={1}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="btn-primary p-2.5 rounded-xl disabled:opacity-50 shrink-0"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
