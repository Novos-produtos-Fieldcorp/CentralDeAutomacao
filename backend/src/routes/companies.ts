import { Router } from "express";
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching companies:', error);
      return res.status(500).json({ 
        error: 'Erro ao buscar empresas',
        details: error.message 
      });
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error in companies route:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Get company by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching company:', error);
      return res.status(404).json({ 
        error: 'Empresa não encontrada',
        details: error.message 
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Error in company by ID route:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Create new company
router.post('/', async (req, res) => {
  try {
    const companyData = req.body;
    
    const { data, error } = await supabase
      .from('companies')
      .insert([companyData])
      .select()
      .single();

    if (error) {
      console.error('Error creating company:', error);
      return res.status(400).json({ 
        error: 'Erro ao criar empresa',
        details: error.message 
      });
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Error in create company route:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Update company
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const { data, error } = await supabase
      .from('companies')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating company:', error);
      return res.status(400).json({ 
        error: 'Erro ao atualizar empresa',
        details: error.message 
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Error in update company route:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Delete company
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting company:', error);
      return res.status(400).json({ 
        error: 'Erro ao deletar empresa',
        details: error.message 
      });
    }

    res.json({ success: true, message: 'Empresa deletada com sucesso' });
  } catch (error) {
    console.error('Error in delete company route:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export { router as companyRoutes };
