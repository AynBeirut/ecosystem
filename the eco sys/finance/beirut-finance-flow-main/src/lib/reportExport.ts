// Report Export Utilities - PDF, CSV, Excel

export interface ReportData {
  title: string;
  subtitle?: string;
  dateRange?: { start: string; end: string };
  columns: { key: string; label: string; type?: 'text' | 'number' | 'currency' | 'date' }[];
  data: Record<string, any>[];
  summary?: Record<string, any>;
  currency?: string;
}

// Format value based on column type
function formatValue(value: any, type?: string, currency: string = 'USD'): string {
  if (value === null || value === undefined) return '';
  
  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
    case 'number':
      return new Intl.NumberFormat('en-US').format(value);
    case 'date':
      return new Date(value).toLocaleDateString();
    default:
      return String(value);
  }
}

// Export to CSV
export function exportToCSV(report: ReportData): boolean {
  try {
    const headers = report.columns.map(col => col.label).join(',');
    const rows = report.data.map(row => 
      report.columns.map(col => {
        const value = row[col.key];
        const formatted = formatValue(value, col.type, report.currency);
        // Escape commas and quotes
        if (formatted.includes(',') || formatted.includes('"')) {
          return `"${formatted.replace(/"/g, '""')}"`;
        }
        return formatted;
      }).join(',')
    );
    
    const csv = [headers, ...rows].join('\n');
    
    // Add summary if present
    let fullCsv = csv;
    if (report.summary) {
      fullCsv += '\n\nSummary\n';
      Object.entries(report.summary).forEach(([key, value]) => {
        fullCsv += `${key},${formatValue(value, 'currency', report.currency)}\n`;
      });
    }
    
    const blob = new Blob([fullCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('CSV export failed:', error);
    return false;
  }
}

// Export to Excel (using HTML table approach for compatibility)
export function exportToExcel(report: ReportData): boolean {
  try {
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #4472C4; color: white; font-weight: bold; }
          .number, .currency { text-align: right; }
          .summary-row { font-weight: bold; background-color: #f3f3f3; }
          h1 { color: #1a365d; }
          h2 { color: #4a5568; font-size: 14px; }
        </style>
      </head>
      <body>
        <h1>${report.title}</h1>
        ${report.subtitle ? `<h2>${report.subtitle}</h2>` : ''}
        ${report.dateRange ? `<p>Period: ${report.dateRange.start} to ${report.dateRange.end}</p>` : ''}
        <table>
          <thead>
            <tr>
              ${report.columns.map(col => `<th>${col.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${report.data.map(row => `
              <tr>
                ${report.columns.map(col => `
                  <td class="${col.type || 'text'}">${formatValue(row[col.key], col.type, report.currency)}</td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
    `;
    
    if (report.summary) {
      html += `
        <h2>Summary</h2>
        <table>
          ${Object.entries(report.summary).map(([key, value]) => `
            <tr class="summary-row">
              <td>${key}</td>
              <td class="currency">${formatValue(value, 'currency', report.currency)}</td>
            </tr>
          `).join('')}
        </table>
      `;
    }
    
    html += '</body></html>';
    
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Excel export failed:', error);
    return false;
  }
}

// Export to PDF
export function exportToPDF(report: ReportData): boolean {
  try {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      console.error('Popup blocked');
      return false;
    }
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${report.title}</title>
        <style>
          * { box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 40px;
            max-width: 1000px;
            margin: 0 auto;
          }
          h1 { color: #1a365d; margin-bottom: 5px; }
          h2 { color: #4a5568; font-size: 14px; font-weight: normal; margin-top: 0; }
          .date-range { color: #718096; font-size: 12px; margin-bottom: 20px; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; }
          th { 
            background-color: #4472C4; 
            color: white; 
            font-weight: 600;
            padding: 12px 8px;
            text-align: left;
            font-size: 12px;
          }
          td { 
            border-bottom: 1px solid #e2e8f0;
            padding: 10px 8px;
            font-size: 12px;
          }
          tr:nth-child(even) { background-color: #f7fafc; }
          .number, .currency { text-align: right; }
          .summary { 
            margin-top: 30px;
            padding: 20px;
            background-color: #f7fafc;
            border-radius: 8px;
          }
          .summary h3 { margin-top: 0; color: #1a365d; }
          .summary-row { 
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e2e8f0;
          }
          .summary-row:last-child { border-bottom: none; font-weight: bold; }
          .footer {
            margin-top: 40px;
            text-align: center;
            color: #a0aec0;
            font-size: 10px;
          }
          @media print {
            body { padding: 20px; }
            @page { margin: 1cm; }
          }
        </style>
      </head>
      <body>
        <h1>${report.title}</h1>
        ${report.subtitle ? `<h2>${report.subtitle}</h2>` : ''}
        ${report.dateRange ? `<p class="date-range">Period: ${report.dateRange.start} to ${report.dateRange.end}</p>` : ''}
        
        <table>
          <thead>
            <tr>
              ${report.columns.map(col => `<th>${col.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${report.data.map(row => `
              <tr>
                ${report.columns.map(col => `
                  <td class="${col.type || 'text'}">${formatValue(row[col.key], col.type, report.currency)}</td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
    `;
    
    if (report.summary) {
      html += `
        <div class="summary">
          <h3>Summary</h3>
          ${Object.entries(report.summary).map(([key, value]) => `
            <div class="summary-row">
              <span>${key}</span>
              <span>${formatValue(value, 'currency', report.currency)}</span>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    html += `
        <div class="footer">
          Generated on ${new Date().toLocaleString()}
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.print();
    };
    
    return true;
  } catch (error) {
    console.error('PDF export failed:', error);
    return false;
  }
}
