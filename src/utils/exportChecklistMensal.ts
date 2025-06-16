import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

export const formatChecklistMensalPDF = async (checklist: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Add title
  doc.setFontSize(18);
  doc.text(`Checklist Mensal`, pageWidth / 2, 15, { align: 'center' });
  
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
    yPos = addFluidsSection(doc, checklist.fluidos, yPos, pageWidth);
  }
  
  // Add lights section
  if (checklist.farol) {
    yPos = addLightsSection(doc, checklist.farol, yPos, pageWidth);
  }
  
  // Add components section
  if (checklist.componentes) {
    yPos = addComponentsSection(doc, checklist.componentes, yPos, pageWidth);
  }
  
  // Add accessories section
  if (checklist.acessorios) {
    yPos = addAccessoriesSection(doc, checklist.acessorios, yPos, pageWidth);
  }
  
  // Add observations if they exist
  if (checklist.observacoes) {
    yPos = addObservationsSection(doc, checklist.observacoes, pageWidth, yPos);
  }
  
  // Add photos section if they exist
  if (checklist.fotos) {
    await addPhotosSection(doc, checklist.fotos, yPos, pageWidth, pageHeight);
  }
  
  // Save the PDF
  doc.save(`checklist_mensal_${checklist.checklist_id}.pdf`);
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
    if (key.includes('documento') || key.includes('extintor') || key.includes('carrinho') || 
        key.includes('cadeado') || key.includes('chave') || key.includes('macaco') || 
        key.includes('estepe') || key.includes('triangulo') || key.includes('cartao') || 
        key.includes('manual')) return 'Sim';
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
    if (key.includes('documento') || key.includes('extintor') || key.includes('carrinho') || 
        key.includes('cadeado') || key.includes('chave') || key.includes('macaco') || 
        key.includes('estepe') || key.includes('triangulo') || key.includes('cartao') || 
        key.includes('manual')) return 'Não';
    return 'Ruim';
  }
  
  if (statusId === 3) return 'N/A';
  
  return 'Não informado';
};

const addFluidsSection = (doc: jsPDF, fluidos: any, yPos: number, pageWidth: number): number => {
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

const addLightsSection = (doc: jsPDF, farol: any, yPos: number, pageWidth: number): number => {
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

const addComponentsSection = (doc: jsPDF, componentes: any, yPos: number, pageWidth: number): number => {
  // Check if we need a new page
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }
  
  doc.setFontSize(14);
  doc.text('Componentes Gerais', 14, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  
  // Skip id fields
  const componentKeys = Object.keys(componentes).filter(key => 
    key !== 'id_componentes_gerais' && key !== 'checklist_id'
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
    
    // Check if we need a new page
    if (yPos > 280) {
      doc.addPage();
      yPos = 20;
    }
  });
  
  return yPos + 5;
};

const addAccessoriesSection = (doc: jsPDF, acessorios: any, yPos: number, pageWidth: number): number => {
  // Check if we need a new page
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }
  
  doc.setFontSize(14);
  doc.text('Acessórios', 14, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  
  // Skip id fields and pneu_ruim (handled separately)
  const accessoryKeys = Object.keys(acessorios).filter(key => 
    key !== 'id_acessorio' && key !== 'checklist_id' && key !== 'pneu_ruim'
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

// Function to add observations section to the PDF
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

// Function to load an image from URL and return as base64
const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  if (!url) return null;
  
  try {
    // Create a temporary image element
    const img = document.createElement('img');
    img.crossOrigin = 'Anonymous'; // Enable CORS
    img.src = url;
    
    // Wait for the image to load
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    
    // Create a canvas and draw the image
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    
    ctx.drawImage(img, 0, 0);
    
    // Get base64 data URL
    return canvas.toDataURL('image/jpeg');
  } catch (error) {
    console.error('Error loading image:', error);
    return null;
  }
};

// Function to add photos section to the PDF with actual images
const addPhotosSection = async (doc: jsPDF, fotos: any, yPos: number, pageWidth: number, pageHeight: number): Promise<void> => {
  // Check if we need a new page
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }
  
  doc.setFontSize(14);
  doc.text('Fotos do Veículo', 14, yPos);
  yPos += 10;
  
  // Skip id fields
  const photoKeys = Object.keys(fotos).filter(key => 
    key !== 'id_foto_checklist' && key !== 'checklist_id'
  );
  
  // If no valid photo keys or all photos are empty, show a message
  const hasPhotos = photoKeys.some(key => fotos[key]);
  if (!hasPhotos) {
    doc.setFontSize(10);
    doc.text('Nenhuma foto disponível', 20, yPos);
    return;
  }
  
  // Process each photo
  for (const key of photoKeys) {
    const photoUrl = fotos[key];
    if (!photoUrl) continue;
    
    // Check if we need a new page
    if (yPos > pageHeight - 100) {
      doc.addPage();
      yPos = 20;
    }
    
    // Add photo label
    const label = key.replace(/foto_/g, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    doc.setFontSize(12);
    doc.text(label, 14, yPos);
    yPos += 8;
    
    try {
      // Load image as base64
      const imageData = await loadImageAsBase64(photoUrl);
      
      if (imageData) {
        // Calculate image dimensions to fit within page width
        const imgWidth = pageWidth - 28; // 14px margin on each side
        const imgHeight = 80; // Fixed height for each image
        
        // Add image to PDF
        doc.addImage(imageData, 'JPEG', 14, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 15; // Add space after image
      } else {
        // If image loading failed, show error message
        doc.setFontSize(10);
        doc.text('Erro ao carregar imagem', 20, yPos);
        yPos += 10;
      }
    } catch (error) {
      console.error(`Error adding image ${key}:`, error);
      doc.setFontSize(10);
      doc.text('Erro ao carregar imagem', 20, yPos);
      yPos += 10;
    }
  }
};