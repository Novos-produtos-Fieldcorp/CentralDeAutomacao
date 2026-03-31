import { jsPDF } from 'jspdf';
import autoTable, { Table } from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface RelatorioRow {
  motoristaNome: string;
  /** Client/account name used for grouping in Por Cliente report */
  clienteNome: string;
  /** Whether this row should be included in the Por Cliente (faturamento) report.
   *  Operations without a meaningful client relationship (Superterminais, Mitsubishi)
   *  are excluded from client-grouped reports per business specification. */
  includeInClientReport: boolean;
  operacaoTipo: string;
  detalhe: string;
  dataViagem: string;
  valorFrete: number;
  comissaoMotorista: number;
  placaVeiculo: string;
}

export interface PeriodoFechamento {
  label: string;
  dataInicio: string | null;
  dataFim: string | null;
}

type SheetRow = (string | number)[];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

// jsPDF's built-in fonts use WinAnsi (Windows-1252) encoding.
// Accented Portuguese characters are fine. Replace specific Unicode symbols
// that fall outside WinAnsi and would render as garbage.
const sanitizePdf = (str: string): string =>
  str
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/[^\u0000-\u00FF]/g, '?');

const formatDateBR = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const buildHeader = (doc: jsPDF, title: string, companyName: string, periodo: PeriodoFechamento) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(sanitizePdf(companyName), pageWidth / 2, 16, { align: 'center' });

  doc.setFontSize(13);
  doc.text(sanitizePdf(title), pageWidth / 2, 24, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  const periodoText = periodo.dataInicio && periodo.dataFim
    ? `Período: ${formatDateBR(periodo.dataInicio)} até ${formatDateBR(periodo.dataFim)}`
    : `Período: ${periodo.label}`;
  doc.text(periodoText, pageWidth / 2, 31, { align: 'center' });
  doc.text(
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    pageWidth / 2,
    36,
    { align: 'center' }
  );
  doc.setTextColor(0);
  return 44;
};

const buildSheetHeader = (title: string, companyName: string, periodo: PeriodoFechamento): SheetRow[] => [
  [companyName],
  [title],
  [periodo.dataInicio && periodo.dataFim
    ? `Período: ${formatDateBR(periodo.dataInicio)} até ${formatDateBR(periodo.dataFim)}`
    : `Período: ${periodo.label}`],
  [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
  [],
];

export const exportRelatorioMotorista = (
  rows: RelatorioRow[],
  periodo: PeriodoFechamento,
  companyName: string,
  format: 'pdf' | 'excel'
) => {
  const grouped: Record<string, RelatorioRow[]> = {};
  rows.forEach((r) => {
    const key = r.motoristaNome;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });

  const motoristas = Object.keys(grouped).sort();

  if (format === 'pdf') {
    const doc = new jsPDF({ orientation: 'landscape' });
    let startY = buildHeader(doc, 'Relatório de Fechamento — Por Motorista', companyName, periodo);
    let lastTable: Table | null = null;

    motoristas.forEach((motorista, idx) => {
      const viagens = grouped[motorista];
      const totalViagens = viagens.length;
      const totalFrete = viagens.reduce((s, v) => s + v.valorFrete, 0);
      const totalComissao = viagens.reduce((s, v) => s + v.comissaoMotorista, 0);

      if (idx > 0 && startY > 160) {
        doc.addPage();
        startY = 16;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`Motorista: ${sanitizePdf(motorista)}`, 14, startY);
      startY += 4;

      const tableBody: (string | number)[][] = viagens.map((v) => [
        formatDateBR(v.dataViagem),
        sanitizePdf(v.operacaoTipo),
        sanitizePdf(v.detalhe || '-'),
        formatCurrency(v.valorFrete),
        formatCurrency(v.comissaoMotorista),
      ]);

      tableBody.push([
        `TOTAL (${totalViagens} viagens)`,
        '',
        '',
        formatCurrency(totalFrete),
        formatCurrency(totalComissao),
      ]);

      autoTable(doc, {
        head: [['Data', 'Operação', 'Rota/Detalhes', 'Valor Frete', 'Comissão']],
        body: tableBody,
        startY,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [55, 65, 81], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        didParseCell: (data) => {
          if (data.row.index === tableBody.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [229, 231, 235];
          }
        },
        columnStyles: {
          3: { halign: 'right' },
          4: { halign: 'right' },
        },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          lastTable = data.table;
        },
      });

      startY = (lastTable?.finalY ?? startY) + 8;
    });

    const fileName = `relatorio_fechamento_motorista_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  } else {
    const wb = XLSX.utils.book_new();

    motoristas.forEach((motorista, idx) => {
      const viagens = grouped[motorista];
      const totalViagens = viagens.length;
      const totalFrete = viagens.reduce((s, v) => s + v.valorFrete, 0);
      const totalComissao = viagens.reduce((s, v) => s + v.comissaoMotorista, 0);

      const sheetData: SheetRow[] = [
        ...buildSheetHeader('Relatório de Fechamento — Por Motorista', companyName, periodo),
        [`Motorista: ${motorista}`],
        ['Data', 'Operação', 'Rota/Detalhes', 'Valor Frete (R$)', 'Comissão (R$)'],
        ...viagens.map((v): SheetRow => [
          formatDateBR(v.dataViagem),
          v.operacaoTipo,
          v.detalhe || '-',
          v.valorFrete,
          v.comissaoMotorista,
        ]),
        [`TOTAL (${totalViagens} viagens)`, '', '', totalFrete, totalComissao],
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 18 }, { wch: 18 }];

      const safeSheetName = motorista.substring(0, 31).replace(/[:\\/?*[\]]/g, '');
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName || `Motorista_${idx + 1}`);
    });

    const fileName = `relatorio_fechamento_motorista_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }
};

export const exportRelatorioCliente = (
  rows: RelatorioRow[],
  periodo: PeriodoFechamento,
  companyName: string,
  format: 'pdf' | 'excel'
) => {
  const grouped: Record<string, RelatorioRow[]> = {};
  rows
    .filter((r) => r.includeInClientReport)
    .forEach((r) => {
      const key = r.clienteNome;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    });

  const clientes = Object.keys(grouped).sort();

  if (clientes.length === 0) {
    throw new Error('Nenhum dado disponível para o relatório por cliente no período selecionado.');
  }

  if (format === 'pdf') {
    const doc = new jsPDF({ orientation: 'landscape' });
    let startY = buildHeader(doc, 'Relatório de Fechamento — Por Cliente', companyName, periodo);
    let lastTable: Table | null = null;

    clientes.forEach((cliente, idx) => {
      const viagens = grouped[cliente];
      const totalViagens = viagens.length;
      const totalFrete = viagens.reduce((s, v) => s + v.valorFrete, 0);

      if (idx > 0 && startY > 160) {
        doc.addPage();
        startY = 16;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`Cliente: ${sanitizePdf(cliente)}`, 14, startY);
      startY += 4;

      const tableBody: (string | number)[][] = viagens.map((v) => [
        formatDateBR(v.dataViagem),
        sanitizePdf(v.operacaoTipo),
        sanitizePdf(v.motoristaNome),
        formatCurrency(v.valorFrete),
      ]);

      tableBody.push([
        `TOTAL (${totalViagens} viagens)`,
        '',
        '',
        formatCurrency(totalFrete),
      ]);

      autoTable(doc, {
        head: [['Data', 'Operação', 'Motorista', 'Valor Frete']],
        body: tableBody,
        startY,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [55, 65, 81], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        didParseCell: (data) => {
          if (data.row.index === tableBody.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [229, 231, 235];
          }
        },
        columnStyles: {
          3: { halign: 'right' },
        },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          lastTable = data.table;
        },
      });

      startY = (lastTable?.finalY ?? startY) + 8;
    });

    const fileName = `relatorio_fechamento_cliente_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  } else {
    const wb = XLSX.utils.book_new();

    clientes.forEach((cliente, idx) => {
      const viagens = grouped[cliente];
      const totalViagens = viagens.length;
      const totalFrete = viagens.reduce((s, v) => s + v.valorFrete, 0);

      const sheetData: SheetRow[] = [
        ...buildSheetHeader('Relatório de Fechamento — Por Cliente', companyName, periodo),
        [`Cliente: ${cliente}`],
        ['Data', 'Operação', 'Motorista', 'Valor Frete (R$)'],
        ...viagens.map((v): SheetRow => [
          formatDateBR(v.dataViagem),
          v.operacaoTipo,
          v.motoristaNome,
          v.valorFrete,
        ]),
        [`TOTAL (${totalViagens} viagens)`, '', '', totalFrete],
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 24 }, { wch: 18 }];

      const safeSheetName = cliente.substring(0, 31).replace(/[:\\/?*[\]]/g, '');
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName || `Cliente_${idx + 1}`);
    });

    const fileName = `relatorio_fechamento_cliente_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }
};

const getDateKey = (dateStr: string): string => {
  if (!dateStr) return 'Sem data';
  try {
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
};

const getMonthKey = (dateStr: string): string => {
  if (!dateStr) return 'Sem data';
  try {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  } catch {
    return dateStr;
  }
};

const formatMonthBR = (monthKey: string): string => {
  if (monthKey === 'Sem data') return monthKey;
  try {
    const [year, month] = monthKey.split('-');
    return `${month}/${year}`;
  } catch {
    return monthKey;
  }
};

export const exportRelatorioPlacaDiario = (
  rows: RelatorioRow[],
  periodo: PeriodoFechamento,
  companyName: string,
  format: 'pdf' | 'excel'
) => {
  const byPlaca: Record<string, RelatorioRow[]> = {};
  rows.forEach((r) => {
    const key = r.placaVeiculo || 'Sem placa';
    if (!byPlaca[key]) byPlaca[key] = [];
    byPlaca[key].push(r);
  });

  const placas = Object.keys(byPlaca).sort();

  if (format === 'pdf') {
    const doc = new jsPDF({ orientation: 'landscape' });
    let startY = buildHeader(doc, 'Relatório Diário por Placa', companyName, periodo);
    let lastTable: Table | null = null;

    placas.forEach((placa, idx) => {
      const placaRows = byPlaca[placa];

      const byDate: Record<string, RelatorioRow[]> = {};
      placaRows.forEach((r) => {
        const dk = getDateKey(r.dataViagem);
        if (!byDate[dk]) byDate[dk] = [];
        byDate[dk].push(r);
      });

      const dates = Object.keys(byDate).sort();

      const totalViagens = placaRows.length;
      const totalFrete = placaRows.reduce((s, r) => s + r.valorFrete, 0);
      const totalComissao = placaRows.reduce((s, r) => s + r.comissaoMotorista, 0);
      const totalLucro = totalFrete - totalComissao;

      if (idx > 0 && startY > 160) {
        doc.addPage();
        startY = 16;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`Placa: ${sanitizePdf(placa)}`, 14, startY);
      startY += 4;

      const tableBody: (string | number)[][] = dates.map((dk) => {
        const dayRows = byDate[dk];
        const nViagens = dayRows.length;
        const faturamento = dayRows.reduce((s, r) => s + r.valorFrete, 0);
        const comissao = dayRows.reduce((s, r) => s + r.comissaoMotorista, 0);
        const lucro = faturamento - comissao;
        return [
          formatDateBR(dk),
          sanitizePdf(placa),
          nViagens,
          formatCurrency(faturamento),
          formatCurrency(comissao),
          formatCurrency(lucro),
        ];
      });

      tableBody.push([
        `TOTAL (${totalViagens} viagens)`,
        '',
        '',
        formatCurrency(totalFrete),
        formatCurrency(totalComissao),
        formatCurrency(totalLucro),
      ]);

      autoTable(doc, {
        head: [['Data', 'Placa', 'Nº Viagens', 'Faturamento', 'Comissão', 'Lucro']],
        body: tableBody,
        startY,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [55, 65, 81], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        didParseCell: (data) => {
          if (data.row.index === tableBody.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [229, 231, 235];
          }
        },
        columnStyles: {
          2: { halign: 'center' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
        },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          lastTable = data.table;
        },
      });

      startY = (lastTable?.finalY ?? startY) + 8;
    });

    const fileName = `relatorio_placa_diario_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  } else {
    const wb = XLSX.utils.book_new();

    placas.forEach((placa, idx) => {
      const placaRows = byPlaca[placa];

      const byDate: Record<string, RelatorioRow[]> = {};
      placaRows.forEach((r) => {
        const dk = getDateKey(r.dataViagem);
        if (!byDate[dk]) byDate[dk] = [];
        byDate[dk].push(r);
      });

      const dates = Object.keys(byDate).sort();

      const totalViagens = placaRows.length;
      const totalFrete = placaRows.reduce((s, r) => s + r.valorFrete, 0);
      const totalComissao = placaRows.reduce((s, r) => s + r.comissaoMotorista, 0);
      const totalLucro = totalFrete - totalComissao;

      const sheetData: SheetRow[] = [
        ...buildSheetHeader('Relatório Diário por Placa', companyName, periodo),
        [`Placa: ${placa}`],
        ['Data', 'Placa', 'Nº Viagens', 'Faturamento (R$)', 'Comissão (R$)', 'Lucro (R$)'],
        ...dates.map((dk): SheetRow => {
          const dayRows = byDate[dk];
          const nViagens = dayRows.length;
          const faturamento = dayRows.reduce((s, r) => s + r.valorFrete, 0);
          const comissao = dayRows.reduce((s, r) => s + r.comissaoMotorista, 0);
          const lucro = faturamento - comissao;
          return [formatDateBR(dk), placa, nViagens, faturamento, comissao, lucro];
        }),
        [`TOTAL (${totalViagens} viagens)`, '', '', totalFrete, totalComissao, totalLucro],
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];

      const safeSheetName = placa.substring(0, 31).replace(/[:\\/?*[\]]/g, '');
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName || `Placa_${idx + 1}`);
    });

    const fileName = `relatorio_placa_diario_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }
};

export const exportRelatorioPlacaMensal = (
  rows: RelatorioRow[],
  periodo: PeriodoFechamento,
  companyName: string,
  format: 'pdf' | 'excel'
) => {
  const byPlaca: Record<string, RelatorioRow[]> = {};
  rows.forEach((r) => {
    const key = r.placaVeiculo || 'Sem placa';
    if (!byPlaca[key]) byPlaca[key] = [];
    byPlaca[key].push(r);
  });

  const placas = Object.keys(byPlaca).sort();

  if (format === 'pdf') {
    const doc = new jsPDF({ orientation: 'landscape' });
    let startY = buildHeader(doc, 'Relatório Mensal por Placa', companyName, periodo);
    let lastTable: Table | null = null;

    placas.forEach((placa, idx) => {
      const placaRows = byPlaca[placa];

      const byMonth: Record<string, RelatorioRow[]> = {};
      placaRows.forEach((r) => {
        const mk = getMonthKey(r.dataViagem);
        if (!byMonth[mk]) byMonth[mk] = [];
        byMonth[mk].push(r);
      });

      const months = Object.keys(byMonth).sort();

      const totalViagens = placaRows.length;
      const totalFrete = placaRows.reduce((s, r) => s + r.valorFrete, 0);
      const totalComissao = placaRows.reduce((s, r) => s + r.comissaoMotorista, 0);
      const totalLucro = totalFrete - totalComissao;

      if (idx > 0 && startY > 160) {
        doc.addPage();
        startY = 16;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`Placa: ${sanitizePdf(placa)}`, 14, startY);
      startY += 4;

      const tableBody: (string | number)[][] = months.map((mk) => {
        const monthRows = byMonth[mk];
        const nViagens = monthRows.length;
        const faturamento = monthRows.reduce((s, r) => s + r.valorFrete, 0);
        const comissao = monthRows.reduce((s, r) => s + r.comissaoMotorista, 0);
        const lucro = faturamento - comissao;
        return [
          formatMonthBR(mk),
          sanitizePdf(placa),
          nViagens,
          formatCurrency(faturamento),
          formatCurrency(comissao),
          formatCurrency(lucro),
        ];
      });

      tableBody.push([
        `TOTAL (${totalViagens} viagens)`,
        '',
        '',
        formatCurrency(totalFrete),
        formatCurrency(totalComissao),
        formatCurrency(totalLucro),
      ]);

      autoTable(doc, {
        head: [['Mês', 'Placa', 'Nº Viagens', 'Faturamento', 'Comissão', 'Lucro']],
        body: tableBody,
        startY,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [55, 65, 81], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        didParseCell: (data) => {
          if (data.row.index === tableBody.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [229, 231, 235];
          }
        },
        columnStyles: {
          2: { halign: 'center' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
        },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          lastTable = data.table;
        },
      });

      startY = (lastTable?.finalY ?? startY) + 8;
    });

    const fileName = `relatorio_placa_mensal_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  } else {
    const wb = XLSX.utils.book_new();

    placas.forEach((placa, idx) => {
      const placaRows = byPlaca[placa];

      const byMonth: Record<string, RelatorioRow[]> = {};
      placaRows.forEach((r) => {
        const mk = getMonthKey(r.dataViagem);
        if (!byMonth[mk]) byMonth[mk] = [];
        byMonth[mk].push(r);
      });

      const months = Object.keys(byMonth).sort();

      const totalViagens = placaRows.length;
      const totalFrete = placaRows.reduce((s, r) => s + r.valorFrete, 0);
      const totalComissao = placaRows.reduce((s, r) => s + r.comissaoMotorista, 0);
      const totalLucro = totalFrete - totalComissao;

      const sheetData: SheetRow[] = [
        ...buildSheetHeader('Relatório Mensal por Placa', companyName, periodo),
        [`Placa: ${placa}`],
        ['Mês', 'Placa', 'Nº Viagens', 'Faturamento (R$)', 'Comissão (R$)', 'Lucro (R$)'],
        ...months.map((mk): SheetRow => {
          const monthRows = byMonth[mk];
          const nViagens = monthRows.length;
          const faturamento = monthRows.reduce((s, r) => s + r.valorFrete, 0);
          const comissao = monthRows.reduce((s, r) => s + r.comissaoMotorista, 0);
          const lucro = faturamento - comissao;
          return [formatMonthBR(mk), placa, nViagens, faturamento, comissao, lucro];
        }),
        [`TOTAL (${totalViagens} viagens)`, '', '', totalFrete, totalComissao, totalLucro],
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];

      const safeSheetName = placa.substring(0, 31).replace(/[:\\/?*[\]]/g, '');
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName || `Placa_${idx + 1}`);
    });

    const fileName = `relatorio_placa_mensal_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }
};
