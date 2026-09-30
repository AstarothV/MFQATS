import { redirect } from 'next/navigation';

// Inquiries now live in the Messages page next to the order chat.
export default function AdminInquiryRedirect() {
  redirect('/admin/chat?tab=inquiries');
}
