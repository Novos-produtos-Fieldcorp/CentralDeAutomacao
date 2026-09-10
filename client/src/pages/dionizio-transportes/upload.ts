import { supabase } from '../../lib/supabase';

// Faz upload de um arquivo para o bucket público dionizio-uploads e retorna a
// URL pública. Mesmo padrão de uploadJpd.ts.
// `prefix` identifica o tipo (ex.: 'abastecimento', 'canhoto', 'ocorrencia', 'descarga').
export async function uploadToDionizioBucket(file: File, prefix: string): Promise<string> {
  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const fileName = `${prefix}-${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from('dionizio-uploads').upload(fileName, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) {
    console.error('Erro ao fazer upload para dionizio-uploads:', {
      bucket: 'dionizio-uploads',
      fileName,
      fileType: file.type,
      fileSize: file.size,
      error,
    });
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('dionizio-uploads').getPublicUrl(fileName);
  return publicUrl;
}
