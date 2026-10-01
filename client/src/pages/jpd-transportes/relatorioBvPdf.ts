import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fmtBRL, fmtDataBR, capitalizeNome, upperPlaca } from './format';

// Relatório em PDF do Boletim de Viagem: mesmas colunas da tabela da tela
// (sem "Ações"), uma linha por BV recebido.
export function gerarRelatorioBvPdf(fretes: Record<string, any>[], valorTotalFrete: number, filtrosTxt: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const margem = 30;
  const larguraPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();

  doc.setFontSize(15);
  doc.text('JPD Transportes — Boletim de Viagem', margem, 34);
  doc.setFontSize(9);
  doc.setTextColor(100);
  const agora = new Date().toLocaleString('pt-BR');
  doc.text(`Gerado em ${agora}  |  ${fretes.length} BV(s)  |  Valor total do frete: ${fmtBRL(valorTotalFrete)}`, margem, 50);
  if (filtrosTxt) doc.text(`Filtros: ${filtrosTxt}`, margem, 62);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: filtrosTxt ? 72 : 60,
    margin: { left: margem, right: margem },
    head: [[
      'BV', 'Data do BV', 'Data carga', 'Data descarga', 'Origem', 'Destinatário',
      'Motorista', 'Placa', 'Valor frete', 'Faturado', 'Situação',
    ]],
    body: fretes.map((f) => [
      f.numero_do_bv || '—',
      fmtDataBR(f.data_do_bv) || '—',
      fmtDataBR(f.data_da_carga) || '—',
      fmtDataBR(f.data_da_descarga) || '—',
      f.origem || '—',
      f.destinatario || '—',
      capitalizeNome(f.motorista) || '—',
      upperPlaca(f.placa_do_carro) || '—',
      fmtBRL(f.valor_do_frete),
      fmtBRL(f.valor_faturado),
      f.situacao_do_bv || '—',
    ]),
    styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    columnStyles: { 8: { halign: 'right' }, 9: { halign: 'right' } },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Página ${doc.getNumberOfPages()}`, larguraPagina - margem, alturaPagina - 14, { align: 'right' });
      doc.setTextColor(0);
    },
  });

  doc.save(`boletim-de-viagem-${new Date().toISOString().slice(0, 10)}.pdf`);
}
