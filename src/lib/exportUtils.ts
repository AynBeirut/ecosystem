// Utility functions for exporting data to CSV and PDF

export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle values that might contain commas
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPDF = (title: string, data: any[], columns: string[]) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export PDF');
    return;
  }

  const tableHeaders = columns.map(col => `<th style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa;">${col}</th>`).join('');
  const tableRows = data.map(row => {
    const cells = columns.map(col => {
      const value = row[col.toLowerCase().replace(/ /g, '')] || row[col] || '';
      return `<td style="padding: 8px; border: 1px solid #ddd;">${value}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { text-align: center; color: #333; margin-bottom: 20px; }
        .meta { text-align: center; color: #666; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        @media print {
          body { padding: 10px; }
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="meta">Generated on ${new Date().toLocaleString()}</div>
      <table>
        <thead>
          <tr>${tableHeaders}</tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </body>
    </html>
  `);

  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 250);
};
