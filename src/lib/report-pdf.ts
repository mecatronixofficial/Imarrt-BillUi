export type ReportPdfOptions = {
  title: string;
  customer: string;
  period: string;
  company?: string;
  headers: readonly string[];
  rows: readonly (readonly (string | number)[])[];
  summary: readonly (readonly [string, string])[];
};

let fontRequest: Promise<string> | undefined;

function reportFont() {
  fontRequest ??= fetch('/fonts/NotoSans-Regular.ttf')
    .then(async (response) => {
      if (!response.ok) throw new Error('Could not load the report font. Please try again.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 8192) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      }
      return btoa(binary);
    })
    .catch((error: unknown) => {
      fontRequest = undefined;
      throw error;
    });
  return fontRequest;
}

export async function createReportPdf(options: ReportPdfOptions): Promise<Blob> {
  const [{ jsPDF }, { autoTable }, font] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    reportFont(),
  ]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', putOnlyUsedFonts: true, compress: true });
  doc.addFileToVFS('ReportSans.ttf', font);
  doc.addFont('ReportSans.ttf', 'ReportSans', 'normal');
  doc.setFont('ReportSans', 'normal');
  doc.setProperties({ title: options.title, subject: `${options.customer} | ${options.period}`, author: 'iMart Billing' });

  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 12;
  doc.setFontSize(10);
  const headingLines = doc.splitTextToSize(
    [options.company, `Customer: ${options.customer}`, `Period: ${options.period}`].filter(Boolean).join('\n'),
    width - margin * 2,
  ) as string[];
  const tableTop = 24 + headingLines.length * 5;
  const headedPages = new Set<number>();
  const drawHeading = () => {
    const page = doc.getCurrentPageInfo().pageNumber;
    if (headedPages.has(page)) return;
    headedPages.add(page);
    doc.setFont('ReportSans', 'normal');
    doc.setTextColor(15, 26, 58);
    doc.setFontSize(16);
    doc.text(options.title, margin, 15);
    doc.setFontSize(10);
    doc.text(headingLines, margin, 23, { lineHeightFactor: 1.4 });
  };

  let lastY = tableTop;
  autoTable(doc, {
    head: [[...options.headers]],
    body: options.rows.map((row) => [...row]),
    startY: tableTop,
    margin: { top: tableTop, bottom: 14, left: margin, right: margin },
    styles: { font: 'ReportSans', fontStyle: 'normal', fontSize: 7, cellPadding: 2, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: 'normal' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 7 }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' } },
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    willDrawPage: drawHeading,
    didDrawPage: ({ cursor }) => { lastY = cursor?.y ?? lastY; },
  });

  autoTable(doc, {
    head: [['Summary', 'Amount']],
    body: options.summary.map(([label, amount]) => [label, amount]),
    startY: lastY + 8,
    margin: { top: tableTop, bottom: 14, left: margin, right: margin },
    tableWidth: 125,
    styles: { font: 'ReportSans', fontStyle: 'normal', fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: 'normal' },
    columnStyles: { 1: { halign: 'right' } },
    rowPageBreak: 'avoid',
    willDrawPage: drawHeading,
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('ReportSans', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${options.rows.length} transactions`, margin, height - 6);
    doc.text(`Page ${page} of ${pages}`, width - margin, height - 6, { align: 'right' });
  }
  return doc.output('blob');
}

export async function downloadReportPdf(name: string, options: ReportPdfOptions) {
  const blob = await createReportPdf(options);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${name}.pdf`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
