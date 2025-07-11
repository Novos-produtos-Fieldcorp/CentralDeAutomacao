import React, { useState, useRef, useCallback } from 'react';
import { X, FileText, AlertCircle, Upload, Check, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import Pagination from './Pagination';
import { usePagination } from '../hooks/usePagination';

interface ImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: any[]) => Promise<void>;
  fileType: 'motoristas' | 'clientes' | 'veiculos';
}

interface ImportData {
  row: number;
  [key: string]: any;
}

interface ValidationError {
  row: number;
  column: string;
  message: string;
}

const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({ isOpen, onClose, onImport, fileType }) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ImportData[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [stats, setStats] = useState({
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    columnTypes: {} as Record<string, string>,
    missingValues: {} as Record<string, number>
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const resetState = () => {
    setFile(null);
    setPreviewData([]);
    setErrors([]);
    setImportStep('upload');
    setSelectedRows(new Set());
    setSelectAll(false);
    setStats({
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      columnTypes: {},
      missingValues: {}
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Function to convert Excel date number to ISO date string
  const excelDateToISOString = (excelDate: number | string): string | null => {
    if (!excelDate) return null;
    
    // If it's already a string and looks like a date, return it
    if (typeof excelDate === 'string') {
      // Check if it's already in ISO format
      if (/^\d{4}-\d{2}-\d{2}/.test(excelDate)) {
        return excelDate;
      }
      
      // Try to parse as DD/MM/YYYY
      const parts = excelDate.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
        const year = parseInt(parts[2], 10);
        
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          const date = new Date(year, month, day);
          return date.toISOString().split('T')[0];
        }
      }
      
      return null;
    }
    
    // Convert Excel date number to JS date
    // Excel dates are number of days since 1900-01-01, except Excel thinks 1900 was a leap year
    // So we need to adjust for that
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

  const validateData = useCallback((data: any[]): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    // Define required fields based on file type
    let requiredFields: string[] = [];
    
    switch (fileType) {
      case 'motoristas':
        requiredFields = ['Nome', 'CPF'];
        break;
      case 'clientes':
        requiredFields = ['Nome', 'CNPJ'];
        break;
      case 'veiculos':
        requiredFields = ['Placa', 'Tipologia'];
        break;
    }
    
    // Define field validations
    const validations: Record<string, (value: any) => boolean> = {
      CPF: (value) => value && /^\d{11}$/.test(String(value).replace(/\D/g, '')),
      CNPJ: (value) => value && /^\d{14}$/.test(String(value).replace(/\D/g, '')),
      Email: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)),
      Placa: (value) => value && String(value).replace(/[^A-Za-z0-9]/g, '').length <= 7
    };
    
    // Validate each row
    data.forEach((row, index) => {
      const rowNum = index + 2; // +2 because Excel starts at 1 and we have a header row
      
      // Check required fields for all types
      requiredFields.forEach(field => {
        if (!row[field]) {
          errors.push({
            row: rowNum,
            column: field,
            message: `Campo obrigatório não preenchido: ${field}`
          });
        }
      });
      
      // Check if agregado has vehicle information
      if (fileType === 'motoristas' && 
          row['Função'] === 'Agregado') {
          // Verificar campos obrigatórios para veículos de agregados
          ['Placa', 'Tipologia'].forEach(field => {
            if (!row[field]) {
              errors.push({
                row: rowNum,
                column: field,
                message: `Agregado deve ter ${field} informado`
              });
            }
          });
      }
      
      // Apply specific validations
      Object.entries(validations).forEach(([field, validator]) => {
        if (field in row && !validator(row[field])) {
          errors.push({
            row: rowNum,
            column: field,
            message: `Valor inválido para ${field}: ${row[field]}`
          });
        }
      });
      
      // Additional type validations
      if (fileType === 'veiculos' && row['Ano'] && !/^\d{4}$/.test(String(row['Ano']).trim())) {
        errors.push({
          row: rowNum,
          column: 'Ano',
          message: `Ano deve ter 4 dígitos: ${row['Ano']}`
        });
      }

      // Validate date fields
      if (fileType === 'motoristas' && row['Data Nascimento']) {
        const dateValue = row['Data Nascimento'];
        // If it's a number (Excel date), try to convert it
        if (typeof dateValue === 'number') {
          const isoDate = excelDateToISOString(dateValue);
          if (!isoDate) {
            errors.push({
              row: rowNum,
              column: 'Data Nascimento',
              message: `Data de nascimento inválida: ${dateValue}`
            });
          }
        }
      }
    });
    
    return errors;
  }, [fileType]);

  const analyzeData = useCallback((data: any[]) => {
    const columnTypes: Record<string, string> = {};
    const missingValues: Record<string, number> = {};
    
    // Get all unique columns
    const allColumns = new Set<string>();
    data.forEach(row => {
      Object.keys(row).forEach(key => allColumns.add(key));
    });
    
    // Initialize missing values counter
    allColumns.forEach(col => {
      missingValues[col] = 0;
    });
    
    // Analyze each column
    allColumns.forEach(column => {
      let isNumber = true;
      let isDate = true;
      let isBoolean = true;
      
      data.forEach(row => {
        const value = row[column];
        
        // Count missing values
        if (value === undefined || value === null || value === '') {
          missingValues[column]++;
        }
        
        // Check types
        if (value !== undefined && value !== null && value !== '') {
          // Check if number
          if (isNumber && isNaN(Number(value))) {
            isNumber = false;
          }
          
          // Check if date
          if (isDate && isNaN(Date.parse(String(value)))) {
            isDate = false;
          }
          
          // Check if boolean
          if (isBoolean && !['true', 'false', true, false, 0, 1].includes(value)) {
            isBoolean = false;
          }
        }
      });
      
      // Determine column type
      if (isBoolean) {
        columnTypes[column] = 'boolean';
      } else if (isNumber) {
        columnTypes[column] = 'number';
      } else if (isDate) {
        columnTypes[column] = 'date';
      } else {
        columnTypes[column] = 'text';
      }
    });
    
    return {
      totalRows: data.length,
      validRows: data.length - (errors.length > 0 ? new Set(errors.map(e => e.row)).size : 0),
      invalidRows: errors.length > 0 ? new Set(errors.map(e => e.row)).size : 0,
      columnTypes,
      missingValues
    };
  }, [errors]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setImportStep('upload');
      setPreviewData([]);
      setSelectedRows(new Set());
      setSelectAll(false);
      setErrors([]);
    }
  };

  const processFile = async () => {
    if (!file) {
      toast.error('Selecione um arquivo para importar');
      return;
    }

    setIsProcessing(true);
    
    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Get first sheet
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          if (jsonData.length === 0) {
            toast.error('Arquivo vazio ou sem dados válidos');
            setIsProcessing(false);
            return;
          }

          // Process date fields for motoristas
          if (fileType === 'motoristas') {
            jsonData.forEach(row => {
              if (row['Data Nascimento'] && typeof row['Data Nascimento'] === 'number') {
                const isoDate = excelDateToISOString(row['Data Nascimento']);
                if (isoDate) {
                  row['Data Nascimento'] = isoDate;
                }
              }
            });
          }

          // Add row numbers and create preview data
          const previewRows = jsonData.map((row, index) => ({
            row: index + 2, // +2 because Excel starts at 1 and we have a header row
            ...row
          }));
          
          setPreviewData(previewRows);
          
          // Validate data
          const validationErrors = validateData(jsonData);
          setErrors(validationErrors);
          
          // Analyze data
          const dataStats = analyzeData(jsonData);
          setStats(dataStats);
          
          setImportStep('preview');
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

  const handleRowSelection = (rowIndex: number) => {
    const newSelectedRows = new Set(selectedRows);
    if (selectedRows.has(rowIndex)) {
      newSelectedRows.delete(rowIndex);
    } else {
      newSelectedRows.add(rowIndex);
    }
    setSelectedRows(newSelectedRows);
    
    // Update selectAll state based on whether all rows are selected
    setSelectAll(newSelectedRows.size === previewData.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      // Deselect all
      setSelectedRows(new Set());
    } else {
      // Select all
      const allRows = new Set(previewData.map((_, index) => index));
      setSelectedRows(allRows);
    }
    setSelectAll(!selectAll);
  };

  const handleImport = async () => {
    if (previewData.length === 0) {
      toast.error('Não há dados para importar');
      return;
    }

    if (errors.length > 0) {
      toast.error('Corrija os erros antes de importar');
      return;
    }

    if (selectedRows.size === 0) {
      toast.error('Selecione pelo menos uma linha para importar');
      return;
    }

    setImportStep('importing');
    setIsProcessing(true);

    try {
      // Filter only selected rows
      const selectedData = previewData
        .filter((_, index) => selectedRows.has(index))
        .map(({ row, ...rest }) => {
          return rest;
        });
      
      // Call the onImport function passed from parent
      await onImport(selectedData);
      
      setImportStep('complete');
      toast.success(`${selectedData.length} registros importados com sucesso`);
    } catch (error) {
      console.error('Error importing data:', error);
      toast.error('Erro ao importar dados');
      setImportStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const getColumnHeaders = () => {
    if (previewData.length === 0) return [];
    
    // Get all unique keys from the data
    const allKeys = new Set<string>();
    previewData.forEach(row => {
      Object.keys(row).forEach(key => {
        if (key !== 'row') allKeys.add(key);
      });
    });
    
    return Array.from(allKeys);
  };

  const hasErrorInRow = (rowIndex: number) => {
    return errors.some(error => error.row === previewData[rowIndex].row);
  };

  const getErrorsForRow = (rowIndex: number) => {
    return errors.filter(error => error.row === previewData[rowIndex].row);
  };

  const getErrorsForCell = (rowIndex: number, column: string) => {
    return errors.filter(error => 
      error.row === previewData[rowIndex].row && 
      error.column === column
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {importStep === 'upload' && 'Importar Dados'}
            {importStep === 'preview' && 'Pré-visualização dos Dados'}
            {importStep === 'importing' && 'Importando Dados...'}
            {importStep === 'complete' && 'Importação Concluída'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {importStep === 'upload' && (
            <div className="space-y-6">
              {/* File Upload */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="text-blue-500 dark:text-blue-400" size={20} />
                  <h3 className="text-base font-medium text-gray-900 dark:text-white">
                    Selecione um arquivo Excel (.xlsx)
                  </h3>
                </div>
                
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg">
                  <div className="space-y-1 text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="flex text-sm text-gray-600 dark:text-gray-400">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-white dark:bg-gray-700 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                      >
                        <span>Selecionar arquivo</span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          className="sr-only"
                          accept=".xlsx, .xls"
                          onChange={handleFileChange}
                          ref={fileInputRef}
                          disabled={isProcessing}
                        />
                      </label>
                      <p className="pl-1">ou arraste e solte</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Excel (.xlsx, .xls)
                    </p>
                    {file && (
                      <p className="text-sm text-green-600 dark:text-green-400">
                        {file.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Import Button */}
              <div className="flex justify-end">
                <button
                  onClick={processFile}
                  disabled={!file || isProcessing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5" />
                      Analisar Dados
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {importStep === 'preview' && (
            <div className="space-y-6">
              {/* Data Analysis Summary */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="text-blue-500 dark:text-blue-400" size={20} />
                  <h3 className="text-base font-medium text-gray-900 dark:text-white">
                    Análise do Arquivo
                  </h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Total de Registros</div>
                    <div className="text-xl font-semibold text-gray-900 dark:text-white">{stats.totalRows}</div>
                  </div>
                  <div className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Registros Válidos</div>
                    <div className="text-xl font-semibold text-green-600 dark:text-green-400">{stats.validRows}</div>
                  </div>
                  <div className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Registros com Erros</div>
                    <div className="text-xl font-semibold text-red-600 dark:text-red-400">{stats.invalidRows}</div>
                  </div>
                </div>
                
                {errors.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800/30">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="text-red-600 dark:text-red-400" size={16} />
                      <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
                        Erros Encontrados
                      </h4>
                    </div>
                    <ul className="text-sm text-red-600 dark:text-red-400 space-y-1 ml-6 list-disc">
                      {errors.slice(0, 5).map((error, index) => (
                        <li key={index}>
                          Linha {error.row}: {error.message}
                        </li>
                      ))}
                      {errors.length > 5 && (
                        <li>
                          <span className="font-medium">
                            E mais {errors.length - 5} erros...
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              {/* Data Preview Table */}
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
                          {getColumnHeaders().map(column => (
                            <th 
                              key={column} 
                              className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400"
                            >
                              <div className="flex items-center gap-1">
                                {column}
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  ({stats.columnTypes[column] || 'texto'})
                                </span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                        {paginatedData.map((row, index) => {
                          const rowIndex = previewData.indexOf(row);
                          const hasError = hasErrorInRow(rowIndex);
                          return (
                            <tr 
                              key={rowIndex} 
                              className={`hover:bg-gray-50 dark:hover:bg-gray-600 ${
                                hasError ? 'bg-red-50 dark:bg-red-900/10' : 
                                selectedRows.has(rowIndex) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                              }`}
                            >
                              <td className="px-3 py-2 whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={selectedRows.has(rowIndex)}
                                  onChange={() => handleRowSelection(rowIndex)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  disabled={hasError}
                                />
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                                {row.row}
                              </td>
                              {getColumnHeaders().map(column => {
                                const cellErrors = getErrorsForCell(rowIndex, column);
                                const hasCellError = cellErrors.length > 0;
                                return (
                                  <td 
                                    key={`${rowIndex}-${column}`} 
                                    className={`px-3 py-2 whitespace-nowrap text-sm ${
                                      hasCellError 
                                        ? 'text-red-600 dark:text-red-400' 
                                        : 'text-gray-900 dark:text-gray-200'
                                    }`}
                                    title={hasCellError ? cellErrors[0].message : undefined}
                                  >
                                    <div className="flex items-center gap-1">
                                      {row[column] !== undefined ? String(row[column]) : ''}
                                      {hasCellError && (
                                        <AlertCircle className="w-4 h-4 text-red-500" />
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
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
                    onClick={resetState}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={isProcessing || selectedRows.size === 0 || errors.length > 0}
                    className="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Importar Selecionados
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {importStep === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Importando Dados
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Por favor, aguarde enquanto processamos sua importação...
              </p>
            </div>
          )}

          {importStep === 'complete' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full mb-4">
                <Check className="w-12 h-12 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Importação Concluída com Sucesso
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {selectedRows.size} registros foram importados com sucesso.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={resetState}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Importar Mais Dados
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                >
                  Finalizar Importação
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportPreviewModal;