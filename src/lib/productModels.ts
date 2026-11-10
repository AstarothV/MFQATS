import type { SupabaseClient } from '@supabase/supabase-js';
import { mediaLinks } from '@/lib/orderMedia';

// The shop's 3D model of a product is one the workshop built in Quality Scan, copied from the private "order-media"
// bucket to the public "product-models" bucket so any shopper can see it (migration 20261111000033_product_models.sql).
const BUCKET = 'product-models';

export interface WorkshopModel { orderId: string; orderRef: string; path: string; status: string; updatedAt: string }

/** The 3D models built for orders of this product (alone or in a cart with other furniture), newest first. */
export async function workshopModels(supabase: SupabaseClient, productId: string): Promise<WorkshopModel[]> {
  const cols = 'id, order_ref, model_3d_path, extended_status, updated_at';
  const [single, inCart] = await Promise.all([
    supabase.from('orders').select(cols).eq('product_id', productId).not('model_3d_path', 'is', null),
    supabase.from('orders').select(cols).contains('items', [{ product_id: productId }]).not('model_3d_path', 'is', null),
  ]);
  const rows = new Map<string, WorkshopModel>();
  for (const o of [...(single.data ?? []), ...(inCart.data ?? [])]) {
    rows.set(o.id, { orderId: o.id, orderRef: o.order_ref, path: o.model_3d_path, status: o.extended_status, updatedAt: o.updated_at });
  }
  return [...rows.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Copies a workshop model into the shop and returns its public address (to save as the product's model_3d_url). */
export async function publishWorkshopModel(supabase: SupabaseClient, productId: string, orderModelPath: string): Promise<string> {
  const link = (await mediaLinks(supabase, [orderModelPath]))[orderModelPath];
  if (!link) throw new Error('Could not open the workshop model. Try again.');
  const res = await fetch(link);
  if (!res.ok) throw new Error('Could not download the workshop model. Try again.');
  const path = `${productId}/model-${Date.now()}.glb`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, await res.blob(), { contentType: 'model/gltf-binary' });
  if (error) {
    if (/bucket not found/i.test(error.message)) throw new Error('Run the latest database update (migration 033) first.');
    throw error;
  }
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** After the product is saved: removes this product's copied models that it no longer uses. */
export async function removeUnusedProductModels(supabase: SupabaseClient, productId: string, keepUrl: string) {
  const { data } = await supabase.storage.from(BUCKET).list(productId);
  const unused = (data ?? []).map((f) => `${productId}/${f.name}`).filter((p) => !keepUrl.endsWith(p));
  if (unused.length) await supabase.storage.from(BUCKET).remove(unused);
}
