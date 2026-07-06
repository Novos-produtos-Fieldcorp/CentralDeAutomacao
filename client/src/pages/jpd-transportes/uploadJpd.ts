import { supabase } from '../../lib/supabase';

// Faz upload de um arquivo para o bucket público jpd-uploads e retorna a URL
// pública. Segue o mesmo padrão de AddComprovanteModal.tsx.
// `prefix` identifica o tipo (ex.: 'bv', 'hodometro', 'comprovante').
export async function uploadToJpdBucket(file: File, prefix: string): Promise<string> {
  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const fileName = `${prefix}-${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from('jpd-uploads').upload(fileName, file);
  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from('jpd-uploads').getPublicUrl(fileName);
  return publicUrl;
}
