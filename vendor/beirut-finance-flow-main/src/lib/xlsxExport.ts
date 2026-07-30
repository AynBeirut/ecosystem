import * as XLSX from 'xlsx';

export function downloadXlsxFromAoA(filename: string, sheetName: string, rows: (string | number)[][]) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const out = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, out);
}

export function downloadXlsxFromCsv(filename: string, sheetName: string, csv: string) {
  const rows = csv
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split(',').map((cell) => cell.replace(/^"|"$/g, '')));
  downloadXlsxFromAoA(filename, sheetName, rows);
}
