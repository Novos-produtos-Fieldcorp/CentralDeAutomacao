import { Router } from "express";
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to get company ID from request
function getCompanyId(req: any): number {
  const companyId = parseInt(req.headers['company-id'] || req.query.company_id || '1');
  if (isNaN(companyId)) {
    throw new Error('Valid company_id is required');
  }
  return companyId;
}

// Get all motoristas for a company
router.get('/', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { page = 1, limit = 50 } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    
    const { data, error, count } = await supabase
      .from('motorista')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .order('id', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) {
      console.error('Error fetching motoristas:', error);
      return res.status(500).json({ 
        error: 'Erro ao buscar motoristas',
        details: error.message 
      });
    }

    res.json({
      data: data || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error in motoristas route:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Get motorista by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = getCompanyId(req);
    
    const { data, error } = await supabase
      .from('motorista')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .single();

    if (error) {
      console.error('Error fetching motorista:', error);
      return res.status(404).json({ 
        error: 'Motorista não encontrado',
        details: error.message 
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Error in motorista by ID route:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Create new motorista
router.post('/', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const motoristaData = {
      ...req.body,
      company_id: companyId
    };
    
    const { data, error } = await supabase
      .from('motorista')
      .insert([motoristaData])
      .select()
      .single();

    if (error) {
      console.error('Error creating motorista:', error);
      return res.status(400).json({ 
        error: 'Erro ao criar motorista',
        details: error.message 
      });
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Error in create motorista route:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Update motorista
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = getCompanyId(req);
    const updateData = req.body;
    
    const { data, error } = await supabase
      .from('motorista')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) {
      console.error('Error updating motorista:', error);
      return res.status(400).json({ 
        error: 'Erro ao atualizar motorista',
        details: error.message 
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Error in update motorista route:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Delete motorista
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = getCompanyId(req);
    
    const { error } = await supabase
      .from('motorista')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);

    if (error) {
      console.error('Error deleting motorista:', error);
      return res.status(400).json({ 
        error: 'Erro ao deletar motorista',
        details: error.message 
      });
    }

    res.json({ success: true, message: 'Motorista deletado com sucesso' });
  } catch (error) {
    console.error('Error in delete motorista route:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export { router as motoristaRoutes };
