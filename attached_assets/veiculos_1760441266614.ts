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

// Get all veiculos for a company
router.get('/', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { page = 1, limit = 50 } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    
    const { data, error, count } = await supabase
      .from('veiculo')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .order('id', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) {
      console.error('Error fetching veiculos:', error);
      return res.status(500).json({ 
        error: 'Erro ao buscar veículos',
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
    console.error('Error in veiculos route:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Get veiculo by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = getCompanyId(req);
    
    const { data, error } = await supabase
      .from('veiculo')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .single();

    if (error) {
      console.error('Error fetching veiculo:', error);
      return res.status(404).json({ 
        error: 'Veículo não encontrado',
        details: error.message 
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Error in veiculo by ID route:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Create new veiculo
router.post('/', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const veiculoData = {
      ...req.body,
      company_id: companyId
    };
    
    const { data, error } = await supabase
      .from('veiculo')
      .insert([veiculoData])
      .select()
      .single();

    if (error) {
      console.error('Error creating veiculo:', error);
      return res.status(400).json({ 
        error: 'Erro ao criar veículo',
        details: error.message 
      });
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Error in create veiculo route:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Update veiculo
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = getCompanyId(req);
    const updateData = req.body;
    
    const { data, error } = await supabase
      .from('veiculo')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) {
      console.error('Error updating veiculo:', error);
      return res.status(400).json({ 
        error: 'Erro ao atualizar veículo',
        details: error.message 
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Error in update veiculo route:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Delete veiculo
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = getCompanyId(req);
    
    const { error } = await supabase
      .from('veiculo')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);

    if (error) {
      console.error('Error deleting veiculo:', error);
      return res.status(400).json({ 
        error: 'Erro ao deletar veículo',
        details: error.message 
      });
    }

    res.json({ success: true, message: 'Veículo deletado com sucesso' });
  } catch (error) {
    console.error('Error in delete veiculo route:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export { router as veiculoRoutes };
