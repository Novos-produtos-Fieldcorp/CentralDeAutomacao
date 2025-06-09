import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Motorista, Veiculo, Cliente } from '../types/database';
import { formatCPF, formatPhone, formatDate } from './format';
import { formatChecklistPDF } from './exportChecklist';
import * as XLSX from 'xlsx';

export const downloadExcelTemplate = (type: 'motoristas' | 'clientes' | 'veiculos', fileName: string) => {
  let headers: string[] = [];
  
  switch (type) {
    case 'motoristas':
      headers = [
        'Nome', 'CPF', 'Email', 'Telefone', 'Data Nascimento', 'Gênero', 'Função',
        'Logradouro', 'Numero', 'Complemento', 'CEP', 'Bairro', 'Cidade', 'Estado',
        'Placa', 'Marca', 'Modelo', 'Tipologia', 'Ano', 'Combustível', 'Peso',
        'Cubagem', 'Cor', 'Possui Rastreador', 'Marca Rastreador'
      ];
      break;
    case 'clientes':
      headers = ['Nome', 'CNPJ', 'Email', 'Telefone'];
      break;
    case 'veiculos':
      headers = [
        'Placa', 'Marca', 'Modelo', 'Tipologia', 'Ano', 'Combustível',
        'Peso', 'Cubagem', 'Cor', 'Possui Rastreador', 'Marca Rastreador'
      ];
      break;
  }

  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const exportToExcel = (data: any[], fileName: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const exportToPDF = (data: any[], columns: string[], title: string, fileName: string) => {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  
  // Add date
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);
  
  // Create table
  autoTable(doc, {
    head: [columns],
    body: data.map(item => columns.map(col => item[col] || '')),
    startY: 35,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    alternateRowStyles: { fillColor: [240, 245, 255] }
  });
  
  // Save PDF
  doc.save(`${fileName}.pdf`);
};

export const formatMotoristaData = (motorista: Motorista) => {
  return {
    'Nome': motorista.nome,
    'CPF': formatCPF(motorista.cpf),
    'Email': motorista.email || 'N/A',
    'Telefone': motorista.telefone ? formatPhone(motorista.telefone.toString()) : 'N/A',
    'Data Nascimento': motorista.dt_nascimento ? formatDate(motorista.dt_nascimento) : 'N/A',
    'Gênero': motorista.genero || 'N/A',
    'Função': motorista.funcao,
    'Status': motorista.st_cadastro,
    'Cidade': motorista.cidade || 'N/A',
    'Estado': motorista.estado || 'N/A',
    'Data Cadastro': formatDate(motorista.data_cadastro)
  };
};

export const formatVeiculoData = (veiculo: Veiculo) => {
  return {
    'Placa': veiculo.placa.toUpperCase(),
    'Marca/Modelo': `${veiculo.marca || ''} ${veiculo.tipo || ''}`.trim() || 'N/A',
    'Ano': veiculo.ano || 'N/A',
    'Tipo de Veículo': veiculo.tipologia || 'N/A',
    'Status': veiculo.status_veiculo ? 'Ativo' : 'Inativo',
    'Capacidade de Carga': veiculo.peso ? `${veiculo.peso} kg` : 'N/A',
    'Cubagem': veiculo.cubagem ? `${veiculo.cubagem} m³` : 'N/A',
    'Rastreador': veiculo.possui_rastreador ? 'Sim' : 'Não',
    'Marca Rastreador': veiculo.marca_rastreador || 'N/A',
    'Chassi': veiculo.chassi || 'N/A',
    'RENAVAM': veiculo.renavam || 'N/A',
    'Motorista': veiculo.motorista?.nome || 'N/A',
    'CPF Motorista': veiculo.motorista?.cpf ? formatCPF(veiculo.motorista.cpf) : 'N/A',
    'CNH': veiculo.motorista?.documento_motorista?.[0]?.nr_registro_cnh || 'N/A',
    'Categoria CNH': veiculo.motorista?.documento_motorista?.[0]?.categoria_cnh || 'N/A',
    'Validade CNH': veiculo.motorista?.documento_motorista?.[0]?.validade_cnh ? formatDate(veiculo.motorista.documento_motorista[0].validade_cnh) : 'N/A',
    'Telefone': veiculo.motorista?.telefone ? formatPhone(veiculo.motorista.telefone.toString()) : 'N/A',
    'Email': veiculo.motorista?.email || 'N/A'
  };
};

export const formatClienteData = (cliente: Cliente) => ({
  'Nome': cliente.nome,
  'CNPJ': cliente.cnpj,
  'Email': cliente.email || 'N/A',
  'Telefone': cliente.telefone || 'N/A',
});

export const exportChecklistToPDF = (checklist: any) => {
  formatChecklistPDF(checklist);
};