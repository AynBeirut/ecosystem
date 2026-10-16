import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/** Render full-page HTML (same as order / finance document templates) to a jsPDF instance. */
export async function renderHtmlToJsPdf(html: string): Promise<jsPDF> {
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '820px';
  document.body.appendChild(container);

  const target =
    (container.querySelector('.invoice-container') as HTMLElement | null) || container;

  const canvas = await html2canvas(target, {
    scale: 2,
    useCORS: true,
    logging: false,
  });
  document.body.removeChild(container);

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  return pdf;
}

export async function downloadHtmlAsPdf(html: string, fileName: string): Promise<void> {
  const pdf = await renderHtmlToJsPdf(html);
  pdf.save(fileName);
}

export async function htmlToPdfFile(html: string, fileName: string): Promise<File> {
  const pdf = await renderHtmlToJsPdf(html);
  const blob = pdf.output('blob');
  return new File([blob], fileName, { type: 'application/pdf' });
}
