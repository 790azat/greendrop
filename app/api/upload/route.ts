import { put } from '@vercel/blob';
import { q } from '@/lib/db';
import { newId } from '@/lib/auth';
import { err, handler, ok, requireRole } from '@/lib/http';

export const POST = handler(async (req: Request) => {
  const s = await requireRole('client', 'worker', 'admin');
  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return err('Файл не найден');
  if (!file.type.startsWith('image/')) return err('Можно загружать только фото');
  if (file.size > 4 * 1024 * 1024) return err('Фото слишком большое (макс. 4 МБ)');
  const ext = file.type.includes('png') ? 'png' : file.type.includes('webp') ? 'webp' : 'jpg';
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`photos/${s.role}/${newId()}.${ext}`, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: file.type,
    });
    return ok({ url: blob.url });
  }
  // Fallback: keep the photo in the database
  const id = newId('p_');
  const buf = Buffer.from(await file.arrayBuffer());
  await q(`INSERT INTO photos (id, mime, data) VALUES ($1,$2,$3)`, [id, file.type, buf.toString('base64')]);
  return ok({ url: `/api/photo/${id}` });
});
