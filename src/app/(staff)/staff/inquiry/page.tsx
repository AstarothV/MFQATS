import { redirect } from 'next/navigation';

// Inquiries now live in the Messages page next to the order chat.
export default function StaffInquiryRedirect() {
  redirect('/staff/chat?tab=inquiries');
}
