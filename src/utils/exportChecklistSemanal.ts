import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const formatChecklistSemanalPDF = (checklist: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Add title
  doc.setFontSize(18);
  doc.text(`Checklist Semanal`, pageWidth / 2, 15, { align: 'center' });
  
  // Add basic info
  doc.setFontSize(12);
  doc.text(`Data: ${formatDate(checklist.data)}`, 14, 25);
  doc.text(`Hora: ${checklist.hora}`, 14, 32);
  doc.text(`Motorista: ${checklist.motorista?.nome || 'Não informado'}`, 14, 39);
  doc.text(`Veículo: ${checklist.veiculo?.placa?.toUpperCase() || 'Não informado'} - ${checklist.veiculo?.marca || ''} ${checklist.veiculo?.tipo || ''}`, 14, 46);
  doc.text(`Quilometragem: ${checklist.quilometragem?.toLocaleString('pt-BR') || 'Não informada'} km`, 14, 53);
  
  let yPos = 65;
  
  // Add fluids section
  if (checklist.fluidos) {
    yPos = addFluidsSection(doc, checklist.fluidos, yPos);
  }
  
  // Add lights section
  if (checklist.farol) {
    yPos = addLightsSection(doc, checklist.farol, yPos);
  }
  
  // Add components section - only specific components for weekly checklist
  if (checklist.componentes) {
    yPos = addComponentsSection(doc, checklist.componentes, yPos);
  }
  
  // Add accessories section - only specific accessories for weekly checklist
  if (checklist.acessorios) {
    yPos = addAccessoriesSection(doc, checklist.acessorios, yPos);
  }
  
  // Add observations if they exist
  if (checklist.observacoes) {
    yPos = addObservationsSection(doc, checklist.observacoes, pageWidth, yPos);
  }
  
  // Save the PDF
  doc.save(`checklist_semanal_${checklist.checklist_id}.pdf`);
};

// Format date to DD/MM/YYYY
const formatDate = (date: string): string => {
  if (!date) return 'Não informada';
  
  const parts = date.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return date;
};

// Function to get the status text from the status_id
const getStatusText = (statusId: number, key: string, section: string): string => {
  if (statusId === 1) {
    // Status OK
    if (section === 'Fluidos') return 'No nível';
    if (section === 'Iluminação') {
      if (key === 'lanterna_traseira') return 'Sim';
      return 'Funcionando';
    }
    if (key.includes('pneu')) return 'Bom';
    if (key.includes('limpeza')) return 'Boa';
    if (key.includes('freio')) return 'Bom';
    if (key.includes('pedal')) return 'Bom';
    if (key.includes('documento') || key.includes('carrinho')) return 'Sim';
    return 'Bom';
  }
  
  if (statusId === 2) {
    // Status Not OK
    if (section === 'Fluidos') return 'Abaixo do nível';
    if (section === 'Iluminação') {
      if (key === 'lanterna_traseira') return 'Não';
      return 'Queimado';
    }
    if (key.includes('pneu')) return 'Ruim';
    if (key.includes('limpeza')) return 'Ruim';
    if (key.includes('freio')) return 'Ruim';
    if (key.includes('pedal')) return 'Ruim';
    if (key.includes('documento') || key.includes('carrinho')) return 'Não';
    return 'Ruim';
  }
  
  if (statusId === 3) return 'N/A';
  
  return 'Não informado';
};

const addFluidsSection = (doc: jsPDF, fluidos: any, yPos: number): number => {
  // Check if we need a new page
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }
  
  doc.setFontSize(14);
  doc.text('Níveis de Fluidos', 14, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  
  // Skip id fields
  const fluidKeys = Object.keys(fluidos).filter(key => 
    key !== 'id_fluido_veiculo' && key !== 'checklist_id'
  );
  
  // If no valid fluid keys, show a message
  if (fluidKeys.length === 0) {
    doc.text('Nenhuma informação de fluidos disponível', 20, yPos);
    return yPos + 10;
  }
  
  fluidKeys.forEach(key => {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const value = fluidos[key];
    
    // Get status text based on the value and item type
    let statusText;
    if (typeof value === 'number') {
      statusText = getStatusText(value, key, 'Fluidos');
    } else if (value === null || value === undefined) {
      statusText = 'Não informado';
    } else {
      statusText = String(value);
    }
    
    doc.text(`${label}: ${statusText}`, 20, yPos);
    yPos += 6;
  });
  
  return yPos + 5;
};

const addLightsSection = (doc: jsPDF, farol: any, yPos: number): number => {
  // Check if we need a new page
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }
  
  doc.setFontSize(14);
  doc.text('Sistema de Iluminação', 14, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  
  // Skip id fields
  const lightKeys = Object.keys(farol).filter(key => 
    key !== 'id_farol_veiculo' && key !== 'checklist_id'
  );
  
  // If no valid light keys, show a message
  if (lightKeys.length === 0) {
    doc.text('Nenhuma informação de iluminação disponível', 20, yPos);
    return yPos + 10;
  }
  
  lightKeys.forEach(key => {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const value = farol[key];
    
    // Special handling for text fields
    if (key === 'luz_indicador_painel') {
      doc.text(`${label}: ${value || 'Não informado'}`, 20, yPos);
    } else {
      // Get status text based on the value and item type
      let statusText;
      if (typeof value === 'number') {
        statusText = getStatusText(value, key, 'Iluminação');
      } else if (value === null || value === undefined) {
        statusText = 'Não informado';
      } else {
        statusText = String(value);
      }
      
      doc.text(`${label}: ${statusText}`, 20, yPos);
    }
    
    yPos += 6;
  });
  
  return yPos + 5;
};

const addComponentsSection = (doc: jsPDF, componentes: any, yPos: number): number => {
  // Check if we need a new page
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }
  
  doc.setFontSize(14);
  doc.text('Componentes Gerais', 14, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  
  // For weekly checklist, only show specific components
  const weeklyComponents = ['pedal', 'limpeza_interna', 'sistema_freio', 'freio_estacionamento'];
  
  // Skip id fields
  const componentKeys = Object.keys(componentes).filter(key => 
    key !== 'id_componentes_gerais' && key !== 'checklist_id' &&
    weeklyComponents.includes(key)
  );
  
  // If no valid component keys, show a message
  if (componentKeys.length === 0) {
    doc.text('Nenhuma informação de componentes disponível', 20, yPos);
    return yPos + 10;
  }
  
  componentKeys.forEach(key => {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const value = componentes[key];
    
    // Get status text based on the value and item type
    let statusText;
    if (typeof value === 'number') {
      statusText = getStatusText(value, key, 'Componentes');
    } else if (value === null || value === undefined) {
      statusText = 'Não informado';
    } else {
      statusText = String(value);
    }
    
    doc.text(`${label}: ${statusText}`, 20, yPos);
    yPos += 6;
  });
  
  return yPos + 5;
};

const addAccessoriesSection = (doc: jsPDF, acessorios: any, yPos: number): number => {
  // Check if we need a new page
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }
  
  doc.setFontSize(14);
  doc.text('Acessórios', 14, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  
  // For weekly checklist, only show specific accessories
  const weeklyAccessories = ['pneu', 'documento_veicular', 'carrinho_carga'];
  
  // Skip id fields and pneu_ruim (handled separately)
  const accessoryKeys = Object.keys(acessorios).filter(key => 
    key !== 'id_acessorio' && key !== 'checklist_id' && key !== 'pneu_ruim' &&
    weeklyAccessories.includes(key)
  );
  
  // If no valid accessory keys, show a message
  if (accessoryKeys.length === 0) {
    doc.text('Nenhuma informação de acessórios disponível', 20, yPos);
    return yPos + 10;
  }
  
  accessoryKeys.forEach(key => {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const value = acessorios[key];
    
    // Get status text based on the value and item type
    let statusText;
    if (typeof value === 'number') {
      statusText = getStatusText(value, key, 'Acessórios');
    } else if (value === null || value === undefined) {
      statusText = 'Não informado';
    } else {
      statusText = String(value);
    }
    
    doc.text(`${label}: ${statusText}`, 20, yPos);
    yPos += 6;
  });
  
  // Add pneu_ruim if it exists
  if (acessorios.pneu_ruim) {
    doc.text(`Pneu com Problema: ${acessorios.pneu_ruim}`, 20, yPos);
    yPos += 6;
  }
  
  return yPos + 5;
};

const addObservationsSection = (doc: jsPDF, observacoes: string, pageWidth: number, yPos: number): number => {
  // Check if we need a new page
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }
  
  doc.setFontSize(14);
  doc.text('Observações', 14, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  const splitText = doc.splitTextToSize(observacoes, pageWidth - 40);
  doc.text(splitText, 20, yPos);
  
  return yPos + splitText.length * 6;
};