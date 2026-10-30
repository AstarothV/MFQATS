import type { SupabaseClient } from '@supabase/supabase-js';

// An order's inspection photos and 3D model, kept in the private "order-media" bucket under <order id>/ so the customer
// can see them in OrderView (see supabase/migrations/20261030000011_order_media.sql).
const BUCKET = 'order-media';

const photoPath = (orderId: string, caption: string) => `${orderId}/${caption.toLowerCase().replace(/\W+/g, '-')}.jpg`;

/** Saves a photo (a data URL) under its caption, replacing the one before it. */
export async function saveOrderPhoto(
  supabase: SupabaseClient,
  photo: { orderId: string; inspectorId: string; caption: string; tags: string[]; image: string },
) {
  const { orderId, inspectorId, caption, tags, image } = photo;
  const path = photoPath(orderId, caption);
  const blob = await (await fetch(image)).blob();
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw error;
  await supabase.from('inspection_images').delete().eq('order_id', orderId).eq('caption', caption);
  const { error: rowError } = await supabase.from('inspection_images').insert({ order_id: orderId, inspector_id: inspectorId, image_url: path, caption, tags });
  if (rowError) throw rowError;
}

export async function removeOrderPhoto(supabase: SupabaseClient, orderId: string, caption: string) {
  await supabase.from('inspection_images').delete().eq('order_id', orderId).eq('caption', caption);
  await supabase.storage.from(BUCKET).remove([photoPath(orderId, caption)]);
}

/** Saves the order's 3D model. The name changes each time, so an open OrderView sees that there is a new one. */
export async function saveOrderModel(supabase: SupabaseClient, orderId: string, model: Blob) {
  const path = `${orderId}/model-${Date.now()}.glb`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, model, { contentType: 'model/gltf-binary' });
  if (error) throw error;
  const { data: old } = await supabase.from('orders').select('model_3d_path').eq('id', orderId).single();
  const { error: orderError } = await supabase.from('orders').update({ model_3d_path: path }).eq('id', orderId);
  if (orderError) throw orderError;
  if (old?.model_3d_path) await supabase.storage.from(BUCKET).remove([old.model_3d_path]);
}

/** Links that work for an hour, by bucket path. */
export async function mediaLinks(supabase: SupabaseClient, paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  return Object.fromEntries((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])));
}
