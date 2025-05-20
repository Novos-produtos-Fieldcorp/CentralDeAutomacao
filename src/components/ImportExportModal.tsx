import React, { useState, useRef, useCallback } from 'react';
import { X, Download, Upload, FileText, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import ImportPreviewModal from './ImportPreviewModal';
import { useCompanyData } from '../hooks/useCompanyData';
import { downloadExcelTemplate } from '../utils/export';
import Pagination from './Pagination';
import { usePagination } from '../hooks/usePagination';
import { supabase } from '../lib/supabase';

const stateNameToAbbreviation: { [key: string]: string } = {
  'acre': 'AC',
  'alagoas': 'AL',
  'amapá': 'AP',
  'amazonas': 'AM',
  'bahia': 'BA',
  'ceará': 'CE',
  'distrito federal': 'DF',
  'espírito santo': 'ES',
  'goiás': 'GO',
  'maranhão': 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  'pará': 'PA',
  'paraíba': 'PB',
  'paraná': 'PR',
  'pernambuco': 'PE',
  'piauí': 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  'rondônia': 'RO',
  'roraima': 'RR',
  'santa catarina': 'SC',
  'são paulo': 'SP',
  'sergipe': 'SE',
  'tocantins': 'TO'
};

const getStateAbbreviation = (stateName: string): string => {
  if (stateName.length === 2) {
    return stateName.toUpperCase();
  }
  
  const normalizedStateName = stateName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const abbreviation = stateNameToAbbreviation[normalizedStateName];
  
  if (!abbreviation) {
    throw new Error(`Estado "${stateName}" não encontrado. Use a sigla do estado (ex: SP, RJ).`);
  }
  
  return abbreviation;
};

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DataType = 'motoristas' | 'clientes' | 'veiculos';

interface ImportData {
  row: number;
  [key: string]: any;
}

interface ImportSummary {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
  data?: ImportData[];
}

const ImportExportModal: React.FC<ImportExportModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [dataType, setDataType] = useState<DataType>('motoristas');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'summary' | 'advanced'>('upload');
  const [previewData, setPreviewData] = useState<ImportData[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const { query, companyId } = useCompanyData();
  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedData,
    handlePageChange,
    handlePageSizeChange
  } = usePagination({
    data: previewData,
    initialPageSize: 10
  });

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setImportSummary(null);
      setImportStep('upload');
      setPreviewData([]);
      setSelectedRows(new Set());
      setSelectAll(false);
    }
  };

  const validateMotoristas = (data: any[]): { valid: boolean; errors: Array<{ row: number; message: string }> } => {
    const errors: Array<{ row: number; message: string }> = [];
    
    data.forEach((row, index) => {
      if (!row.Nome) {
        errors.push({ row: index + 2, message: 'Nome é obrigatório' });
      }
      if (!row.CPF) {
        errors.push({ row: index + 2, message: 'CPF é obrigatório' });
      } else if (!/^\d{11}$/.test(row.CPF.toString())) {
        errors.push({ row: index + 2, message: 'CPF deve conter 11 dígitos numéricos' });
      }
      if (row.Função && !['Motorista', 'Agregado'].includes(row.Função)) {
        errors.push({ row: index + 2, message: 'Função deve ser "Motorista" ou "Agregado"' });
      }
      
      const isAgregado = row.Função === 'Agregado';
      if (isAgregado && !row.Placa) {
        errors.push({ row: index + 2, message: 'Agregado deve ter uma placa de veículo informada' });
      }
      
      if (row.Cidade && !row.Estado) {
        errors.push({ row: index + 2, message: 'Estado é obrigatório quando Cidade é informada' });
      }
      if (row.Logradouro && (!row.Bairro || !row.Cidade || !row.Estado)) {
        errors.push({ row: index + 2, message: 'Bairro, Cidade e Estado são obrigatórios quando Logradouro é informado' });
      }
      if (row.Bairro && (!row.Cidade || !row.Estado)) {
        errors.push({ row: index + 2, message: 'Cidade e Estado são obrigatórios quando Bairro é informado' });
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const validateClientes = (data: any[]): { valid: boolean; errors: Array<{ row: number; message: string }> } => {
    const errors: Array<{ row: number; message: string }> = [];
    
    data.forEach((row, index) => {
      if (!row.Nome) {
        errors.push({ row: index + 2, message: 'Nome é obrigatório' });
      }
      if (!row.CNPJ) {
        errors.push({ row: index + 2, message: 'CNPJ é obrigatório' });
      } else if (!/^\d{14}$/.test(row.CNPJ.toString())) {
        errors.push({ row: index + 2, message: 'CNPJ deve conter 14 dígitos numéricos' });
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const validateVeiculos = (data: any[]): { valid: boolean; errors: Array<{ row: number; message: string }> } => {
    const errors: Array<{ row: number; message: string }> = [];
    
    data.forEach((row, index) => {
      if (!row.Placa) {
        errors.push({ row: index + 2, message: 'Placa é obrigatória' });
      }
      if (row.Placa && row.Placa.length > 7) {
        errors.push({ row: index + 2, message: 'Placa deve ter no máximo 7 caracteres' });
      }
      if (!row.Tipologia) {
        errors.push({ row: index + 2, message: 'Tipologia é obrigatória' });
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const handleRowSelection = (rowIndex: number) => {
    const newSelectedRows = new Set(selectedRows);
    if (selectedRows.has(rowIndex)) {
      newSelectedRows.delete(rowIndex);
    } else {
      newSelectedRows.add(rowIndex);
    }
    setSelectedRows(newSelectedRows);
    
    setSelectAll(newSelectedRows.size === previewData.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRows(new Set());
    } else {
      const allRows = new Set(previewData.map((_, index) => index));
      setSelectedRows(allRows);
    }
    setSelectAll(!selectAll);
  };

  const processImport = async () => {
    if (!file) {
      toast.error('Selecione um arquivo para importar');
      return;
    }

    setIsProcessing(true);
    
    setImportSummary(null);
    setPreviewData([]);

    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          if (jsonData.length === 0) {
            toast.error('Arquivo vazio ou sem dados válidos');
            setIsProcessing(false); 
            return;
          }

          const previewRows = jsonData.map((row, index) => ({
            row: index + 2,
            ...row
          }));
          setPreviewData(previewRows);
          setImportStep('preview');
          setIsProcessing(false);
          return;

        } catch (error) {
          console.error('Error processing file:', error);
          toast.error('Erro ao processar arquivo');
        } finally {
          setIsProcessing(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error reading file:', error);
      toast.error('Erro ao ler arquivo');
      setIsProcessing(false);
    }
  };

  const handleAdvancedImport = () => {
    setImportStep('advanced');
    setShowPreviewModal(true);
  };

  const handleImportFromPreview = async (data: any[]) => {
    try {
      switch (dataType) {
        case 'motoristas':
          await importMotoristas(data);
          break;
        case 'clientes':
          await importClientes(data);
          break;
        case 'veiculos':
          await importVeiculos(data);
          break;
      }
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error importing data:', error);
      toast.error('Erro ao importar dados');
      return Promise.reject(error);
    }
  };

  const excelDateToISOString = (excelDate: number | string): string | null => {
    if (!excelDate) return null;
    
    if (typeof excelDate === 'string') {
      if (/^\d{4}-\d{2}-\d{2}/.test(excelDate)) {
        return excelDate;
      }
      
      const parts = excelDate.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          const date = new Date(year, month, day);
          return date.toISOString().split('T')[0];
        }
      }
      
      return null;
    }
    
    try {
      const jsDate = new Date((excelDate - 25569) * 86400 * 1000);
      if (isNaN(jsDate.getTime())) {
        return null;
      }
      return jsDate.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error converting Excel date:', error);
      return null;
    }
  };

  const importMotoristas = async (data: any[]) => {
    let successCount = 0;
    let failedCount = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < data.length; i++) {
      const driver = data[i];
      try {
        const isAgregado = driver.Função === 'Agregado';
        const funcao = isAgregado ? 'Agregado' : (driver.Função || 'Motorista');
        
        const dataNascimento = driver['Data Nascimento'] ? 
          excelDateToISOString(driver['Data Nascimento']) : null;
        
        const { data: motorista, error: motoristaError } = await supabase
          .from('motorista')
          .insert({
            nome: driver.Nome,
            cpf: String(driver.CPF).replace(/\D/g, ''),
            email: driver.Email || null,
            telefone: driver.Telefone ? String(driver.Telefone).replace(/\D/g, '') : null,
            dt_nascimento: dataNascimento,
            genero: driver.Gênero || null,
            funcao: funcao,
            st_cadastro: 'cadastrado',
            data_cadastro: new Date().toISOString().split('T')[0],
            company_id: companyId
          })
          .select()
          .single();

        if (motoristaError) {
          if (motoristaError.code === '23505') {
            throw new Error('CPF já cadastrado no sistema.');
          }
          throw new Error(`Erro ao cadastrar motorista: ${motoristaError.message}`);
        }

        if (!motorista) {
          throw new Error('Erro ao cadastrar motorista: nenhum dado retornado');
        }

        if (driver.Logradouro && driver.Cidade && driver.Estado) {
          try {
            const stateAbbreviation = getStateAbbreviation(driver.Estado);
            
            const { data: estadoData, error: estadoError } = await supabase
              .from('estado')
              .select('id_estado')
              .eq('sigla_estado', stateAbbreviation)
              .single();

            if (estadoError) {
              throw new Error(`Estado "${driver.Estado}" não encontrado. Use a sigla do estado (ex: SP, RJ).`);
            }
            
            let cidadeId: number;
            const { data: cidade, error: cidadeError } = await supabase
              .from('cidade')
              .select('id_cidade')
              .eq('cidade', driver.Cidade)
              .eq('id_estado', estadoData.id_estado)
              .maybeSingle();

            if (cidadeError && cidadeError.code !== 'PGRST116') {
              throw cidadeError;
            }

            if (cidade) {
              cidadeId = cidade.id_cidade;
            } else {
              const { data: newCidade, error: newCidadeError } = await supabase
                .from('cidade')
                .insert({
                  cidade: driver.Cidade,
                  id_estado: estadoData.id_estado
                })
                .select()
                .single();

              if (newCidadeError) throw newCidadeError;
              if (!newCidade) throw new Error('Erro ao criar cidade');
              cidadeId = newCidade.id_cidade;
            }

            let bairroId: number;
            const { data: bairro, error: bairroError } = await supabase
              .from('bairro')
              .select('id_bairro')
              .eq('bairro', driver.Bairro || 'Centro')
              .eq('id_cidade', cidadeId)
              .maybeSingle();

            if (bairroError && bairroError.code !== 'PGRST116') {
              throw bairroError;
            }
            
            if (bairro) {
              bairroId = bairro.id_bairro;
            } else {
              const { data: newBairro, error: newBairroError } = await supabase
                .from('bairro')
                .insert({
                  bairro: driver.Bairro || 'Centro',
                  id_cidade: cidadeId
                })
                .select()
                .single();

              if (newBairroError) throw newBairroError;
              if (!newBairro) throw new Error('Erro ao criar bairro');
              bairroId = newBairro.id_bairro;
            }

            let logradouroId: number;
            const { data: logradouro, error: logradouroError } = await supabase
              .from('logradouro')
              .select('id_logradouro')
              .eq('logradouro', driver.Logradouro)
              .eq('nr_cep', driver.CEP || null)
              .eq('id_bairro', bairroId)
              .maybeSingle();

            if (logradouroError && logradouroError.code !== 'PGRST116') {
              throw logradouroError;
            }
            
            if (logradouro) {
              logradouroId = logradouro.id_logradouro;
            } else {
              const { data: newLogradouro, error: newLogradouroError } = await supabase
                .from('logradouro')
                .insert({
                  logradouro: driver.Logradouro,
                  nr_cep: driver.CEP || null,
                  id_bairro: bairroId
                })
                .select()
                .single();

              if (newLogradouroError) throw newLogradouroError;
              if (!newLogradouro) throw new Error('Erro ao criar logradouro');
              logradouroId = newLogradouro.id_logradouro;
            }

            const { error: enderecoError } = await supabase
              .from('end_motorista')
              .insert({
                nr_end: driver.Numero || null,
                ds_complemento_end: driver.Complemento || null,
                id_motorista: motorista.motorista_id,
                id_logradouro: logradouroId
              });

            if (enderecoError) throw enderecoError;
          } catch (error) {
            console.error('Erro ao cadastrar endereço:', error);
            errors.push({ 
              row: i + 2, 
              message: `Motorista importado, mas erro ao cadastrar endereço: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
            });
          }
        }

        if (isAgregado && driver.Placa && motorista) {
          const { error: veiculoError } = await supabase
            .from('veiculo')
            .insert({
              placa: String(driver.Placa).toUpperCase(),
              marca: driver.Marca || '',
              tipo: driver.Modelo || driver.Tipo || '',
              ano: driver.Ano || '',
              cor: driver.Cor || '',
              tipologia: driver.Tipologia || '',
              combustivel: driver.Combustível || '',
              peso: driver.Peso || '',
              cubagem: driver.Cubagem || '',
              possui_rastreador: driver['Possui Rastreador'] === 'Sim' || driver['Possui Rastreador'] === true || false,
              marca_rastreador: driver['Marca Rastreador'] || '',
              motorista_id: motorista.motorista_id,
              status_veiculo: true,
              company_id: companyId
            });
          
          if (veiculoError) {
            if (veiculoError.code === '23505') {
              throw new Error('Placa já cadastrada no sistema.');
            }
            throw new Error(`Erro ao cadastrar veículo: ${veiculoError.message}`);
          }
        }

        successCount++;
      } catch (error) {
        failedCount++;
        errors.push({ 
          row: i + 2, 
          message: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }

    setImportSummary({
      total: data.length,
      success: successCount,
      failed: failedCount,
      errors,
      data: []
    });

    return { successCount, failedCount, errors };
  };

  const importClientes = async (data: any[]) => {
    let successCount = 0;
    let failedCount = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < data.length; i++) {
      const customer = data[i];
      try {
        const cliente = {
          nome: customer.Nome,
          cnpj: String(customer.CNPJ).replace(/\D/g, ''),
          email: customer.Email || null,
          telefone: customer.Telefone ? String(customer.Telefone).replace(/\D/g, '') : null,
          st_cliente: true,
          company_id: companyId
        };

        const { error } = await query('cliente').insert(cliente);
        
        if (error) {
          failedCount++;
          errors.push({ row: i + 2, message: error.message });
        } else {
          successCount++;
        }
      } catch (error) {
        failedCount++;
        errors.push({ row: i + 2, message: error instanceof Error ? error.message : 'Erro desconhecido' });
      }
    }

    setImportSummary({
      total: data.length,
      success: successCount,
      failed: failedCount,
      errors,
      data: []
    });

    return { successCount, failedCount, errors };
  };

  const importVeiculos = async (data: any[]) => {
    let successCount = 0;
    let failedCount = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < data.length; i++) {
      const vehicle = data[i];
      try {
        const veiculo = {
          placa: vehicle.Placa.toUpperCase(),
          marca: vehicle.Marca || '',
          tipo: vehicle.Modelo || '',
          ano: vehicle.Ano || '',
          cor: vehicle.Cor || '',
          tipologia: vehicle.Tipologia || '',
          combustivel: vehicle.Combustível || '',
          peso: vehicle.Peso || '',
          cubagem: vehicle.Cubagem || '',
          status_veiculo: true,
          motorista_id: null,
          cliente_id: null,
          company_id: companyId
        };

        const { error } = await query('veiculo').insert(veiculo);
        
        if (error) {
          failedCount++;
          errors.push({ row: i + 2, message: error.message });
        } else {
          successCount++;
        }
      } catch (error) {
        failedCount++;
        errors.push({ row: i + 2, message: error instanceof Error ? error.message : 'Erro desconhecido' });
      }
    }

    setImportSummary({
      total: data.length,
      success: successCount,
      failed: failedCount,
      errors,
      data: []
    });

    return { successCount, failedCount, errors };
  };

  const handleExport = async () => {
    setIsProcessing(true);

    try {
      let data: any[] = [];
      let filename = '';
      const timestamp = new Date().toISOString().slice(0, 10);

      switch (dataType) {
        case 'motoristas':
          const { data: motoristas, error: motoristasError } = await query('motorista')
            .select('nome, cpf, telefone, email, dt_nascimento, genero, funcao');
          
          if (motoristasError) throw motoristasError;
          
          data = motoristas.map(m => ({
            Nome: m.nome,
            CPF: m.cpf,
            Email: m.email || '',
            Telefone: m.telefone || '',
            'Data Nascimento': m.dt_nascimento ? new Date(m.dt_nascimento).toISOString().split('T')[0] : '',
            Gênero: m.genero || '',
            Função: m.funcao,
          }));
          
          filename = `motoristas-export-${timestamp}.xlsx`;
          break;

        case 'clientes':
          const { data: clientes, error: clientesError } = await query('cliente')
            .select('nome, cnpj, email, telefone');
          
          if (clientesError) throw clientesError;
          
          data = clientes.map(c => ({
            Nome: c.nome,
            CNPJ: c.cnpj,
            Email: c.email || '',
            Telefone: c.telefone || ''
          }));
          
          filename = `clientes-export-${timestamp}.xlsx`;
          break;

        case 'veiculos':
          const { data: veiculos, error: veiculosError } = await query('veiculo')
            .select(`
              placa, marca, tipo, ano, cor, tipologia, combustivel, peso, cubagem,
              cliente:cliente_id(nome)
            `);
          
          if (veiculosError) throw veiculosError;
          
          data = veiculos.map(v => ({
            Placa: v.placa,
            Marca: v.marca || '',
            Modelo: v.tipo || '',
            Ano: v.ano || '',
            Cor: v.cor || '',
            Tipologia: v.tipologia || '',
            Combustível: v.combustivel || '',
            Peso: v.peso || '',
            Cubagem: v.cubagem || '',
            Cliente: v.cliente?.nome || ''
          }));
          
          filename = `veiculos-export-${timestamp}.xlsx`;
          break;
      }

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      XLSX.writeFile(wb, filename);
      
      toast.success('Exportação concluída com sucesso');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Erro ao exportar dados');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadErrorLog = () => {
    if (!importSummary || importSummary.errors.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(importSummary.errors);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Errors');
    XLSX.writeFile(wb, `import-errors-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`);
  };

  const getColumnHeaders = () => {
    if (previewData.length === 0) return [];
    
    const allKeys = new Set<string>();
    previewData.forEach(row => {
      Object.keys(row).forEach(key => {
        if (key !== 'row') allKeys.add(key);
      });
    });
    
    return Array.from(allKeys);
  };

  const renderPreviewTable = () => {
    const columns = getColumnHeaders();
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Pré-visualização dos Dados
          </h3>
          <div className="flex items-center gap-2">
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700 dark:text-gray-300">Selecionar Todos</span>
            </label>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ({selectedRows.size} de {previewData.length} selecionados)
            </span>
          </div>
        </div>
        
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Selecionar
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Linha
                  </th>
                  {columns.map(column => (
                    <th 
                      key={column} 
                      className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                {paginatedData.map((row, index) => {
                  const rowIndex = previewData.indexOf(row);
                  return (
                    <tr 
                      key={rowIndex} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-600 ${
                        selectedRows.has(rowIndex) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(rowIndex)}
                          onChange={() => handleRowSelection(rowIndex)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                        {row.row}
                      </td>
                      {columns.map(column => (
                        <td 
                          key={`${rowIndex}-${column}`} 
                          className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200"
                        >
                          {row[column] !== undefined ? String(row[column]) : ''}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {previewData.length > 10 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </div>
        
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={() => {
              setImportStep('upload');
              setFile(null);
              setPreviewData([]);
            }}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
          >
            Voltar
          </button>
          <button
            onClick={processImport}
            disabled={isProcessing || selectedRows.size === 0}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processando...
              </>
            ) : (
              'Importar Selecionados'
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Importar Dados
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
            <div className="px-4 py-2 font-medium text-sm border-b-2 border-blue-500 text-blue-600 dark:text-blue-400">
              <div className="flex items-center gap-2">
                <Download size={18} />
                Importar
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tipo de Dados
            </label>
            <select
              value={dataType}
              onChange={(e) => {
                setDataType(e.target.value as DataType);
                setImportSummary(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="motoristas">Motoristas</option>
              <option value="clientes">Clientes</option>
              <option value="veiculos">Veículos da Empresa</option>
            </select>
          </div>

          <div>
            {importStep === 'upload' && (
                <React.Fragment>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-base font-medium text-gray-900 dark:text-white">
                          Importação com Pré-visualização
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Visualize e valide seus dados antes de importar
                        </p>
                      </div>
                      <button
                        onClick={() => downloadExcelTemplate(dataType, `template-${dataType}`)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm flex items-center gap-1"
                      >
                        <Download size={16} />
                        Baixar Template
                      </button>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                            Recursos disponíveis:
                          </p>
                          <ul className="list-disc ml-5 mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                            <li>Visualizar os dados antes de importar</li>
                            <li>Verificar e corrigir erros</li>
                            <li>Selecionar quais linhas importar</li>
                            <li>Analisar a estrutura do arquivo</li>
                          </ul>
                          
                          <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                            <p className="font-medium">Colunas necessárias:</p>
                            <p className="mt-1">
                              {dataType === 'motoristas' && 'Nome*, CPF*, Email, Telefone, Data Nascimento, Gênero, Função*, Logradouro*, Numero, Complemento, CEP, Bairro*, Cidade*, Estado*, Placa*, Marca, Modelo, Tipologia*, Ano, Combustível, Peso, Cubagem, Cor, Possui Rastreador, Marca Rastreador'}
                              {dataType === 'clientes' && 'Nome*, CNPJ*, Email, Telefone'}
                              {dataType === 'veiculos' && 'Placa*, Marca, Modelo, Tipologia*, Ano, Combustível, Peso, Cubagem, Cor, Possui Rastreador, Marca Rastreador (Apenas veículos da própria empresa)'}
                            </p>
                            <p className="text-xs mt-1">* Campos obrigatórios</p>
                            <p className="text-xs mt-1">Estado deve ser a sigla (ex: SP, RJ)</p>
                            <p className="text-xs mt-1">Para endereço: Logradouro, Cidade e Estado são obrigatórios quando qualquer campo de endereço é informado.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleAdvancedImport}
                      className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                               transition-colors flex items-center justify-center gap-2"
                    >
                      <Upload className="w-5 h-5" />
                      Iniciar Importação
                    </button>
                  </div>
                </React.Fragment>
              )}

              {importStep === 'preview' && renderPreviewTable()}

              {importStep === 'summary' && importSummary && (
                <div className="space-y-6">
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Resumo da Importação
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{importSummary.total}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Sucesso</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{importSummary.success}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Falhas</p>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">{importSummary.failed}</p>
                      </div>
                    </div>
                  </div>

                  {importSummary.errors.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          Erros Encontrados
                        </h3>
                        <button
                          onClick={downloadErrorLog}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm flex items-center gap-1"
                        >
                          <Download size={16} />
                          Baixar Log de Erros
                        </button>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Linha</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Mensagem</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {importSummary.errors.map((error, index) => (
                              <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-600">
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200">{error.row}</td>
                                <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{error.message}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => {
                        setImportStep('upload');
                        setFile(null);
                        setPreviewData([]);
                        setImportSummary(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>
        </div>
      </div>

      <ImportPreviewModal
        isOpen={showPreviewModal}
        onClose={() => {
          setShowPreviewModal(false);
          setImportStep('upload');
        }}
        onImport={handleImportFromPreview}
        fileType={dataType}
      />
    </div>
  );
};

export default ImportExportModal;