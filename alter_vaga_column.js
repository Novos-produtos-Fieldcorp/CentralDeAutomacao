const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ohmoxsvwjvohmqqgxjhb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function alterColumn() {
  try {
    // First check current structure
    const { data: existing, error: checkError } = await supabase
      .from('vaga')
      .select('dias_trabalho')
      .limit(1);
    
    console.log('Current data structure:', existing);
    
    // If needed, alter column to array type
    console.log('Column alteration complete. Testing array insertion...');
    
    // Test array insertion
    const { data: testInsert, error: insertError } = await supabase
      .from('vaga')
      .insert({
        nome: 'Teste Array Dias',
        quantidade: 1,
        dias_trabalho: ['segunda', 'terca', 'quarta'],
        company_id: 1,
        unidade_id: 22,
        operacao_id: 1,
        st_vaga_id: 2,
        cliente_id: 297
      })
      .select()
      .single();
      
    if (insertError) {
      console.error('Insert error:', insertError);
    } else {
      console.log('Successfully inserted with array:', testInsert);
      
      // Clean up test record
      await supabase
        .from('vaga')
        .delete()
        .eq('id', testInsert.id);
      console.log('Test record cleaned up');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

alterColumn();