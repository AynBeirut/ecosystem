// ===================================
// AYN BEIRUT POS - EXPORT UTILITIES
// Shared export functions for PDF, Excel, and CSV
// ===================================

// Unit conversion constants
const UNIT_CONVERSIONS = {
    'kg': { display: 'kg', factor: 1, converts: [{ to: 'g', factor: 1000 }] },
    'g': { display: 'g', factor: 0.001, converts: [{ to: 'kg', factor: 0.001 }] },
    'litre': { display: 'L', factor: 1, converts: [{ to: 'ml', factor: 1000 }] },
    'ml': { display: 'mL', factor: 0.001, converts: [{ to: 'litre', factor: 0.001 }] },
    'meter': { display: 'm', factor: 1, converts: [{ to: 'cm', factor: 100 }] },
    'cm': { display: 'cm', factor: 0.01, converts: [{ to: 'meter', factor: 0.01 }] },
    'pieces': { display: 'pcs', factor: 1, converts: [] }
};

// ===================================
// HELPER FUNCTIONS
// ===================================

/**
 * Format currency values
 */
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) return '$0.00';
    return '$' + parseFloat(value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format date from timestamp
 */
function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Format datetime from timestamp
 */
function formatDateTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Format number with decimals
 */
function formatNumber(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) return '0';
    return parseFloat(value).toFixed(decimals);
}

/**
 * Get unit display text
 */
function getUnitDisplay(unit) {
    return UNIT_CONVERSIONS[unit]?.display || unit || 'pcs';
}

/**
 * Convert unit value for display
 */
function getUnitConversion(value, unit) {
    if (!unit || unit === 'pieces' || !value) return '';
    
    const conversions = UNIT_CONVERSIONS[unit]?.converts || [];
    if (conversions.length === 0) return '';
    
    const converted = value * conversions[0].factor;
    return `${formatNumber(converted, 2)} ${getUnitDisplay(conversions[0].to)}`;
}

// ===================================
// PDF EXPORT
// ===================================

/**
 * Export data to PDF with company branding
 * @param {Array} data - Array of objects to export
 * @param {Array} columns - Array of column definitions [{header: 'Name', dataKey: 'name'}]
 * @param {String} title - Report title
 * @param {String} filename - Output filename (without .pdf extension)
 * @param {Object} options - Additional options {subtitle, footer, orientation}
 */
async function exportToPDF(data, columns, title, filename, options = {}) {
    try {
        // Check if jsPDF is available
        if (!window.jspdf && !window.jsPDF) {
            throw new Error('jsPDF library not loaded');
        }

        const { jsPDF } = window.jspdf || window;
        const orientation = options.orientation || 'portrait';
        const doc = new jsPDF(orientation);
        
        // Get company info from database
        let companyName = 'AYN BEIRUT POS';
        try {
            const companyInfo = await runQuery('SELECT * FROM company_info WHERE id = 1');
            if (companyInfo && companyInfo.length > 0 && companyInfo[0].companyName) {
                companyName = companyInfo[0].companyName;
            }
        } catch (error) {
            console.warn('Could not load company info, using default:', error);
        }
        
        // Company Header
        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.text(companyName, 14, 15);
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(new Date().toLocaleString(), 14, 21);
        
        // Report Title
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text(title, 14, 32);
        
        // Subtitle if provided
        if (options.subtitle) {
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(options.subtitle, 14, 38);
        }
        
        // Table
        const startY = options.subtitle ? 45 : 40;
        
        doc.autoTable({
            columns: columns,
            body: data,
            startY: startY,
            theme: 'grid',
            headStyles: {
                fillColor: [28, 117, 188], // Ayn Blue
                textColor: 255,
                fontStyle: 'bold',
                fontSize: 10
            },
            alternateRowStyles: {
                fillColor: [245, 247, 250]
            },
            margin: { top: 10, right: 14, bottom: 20, left: 14 },
            didDrawPage: function(data) {
                // Footer
                const pageCount = doc.internal.getNumberOfPages();
                const pageSize = doc.internal.pageSize;
                const pageHeight = pageSize.height || pageSize.getHeight();
                
                doc.setFontSize(8);
                doc.setFont(undefined, 'normal');
                doc.text(
                    `Page ${data.pageNumber} of ${pageCount}`,
                    data.settings.margin.left,
                    pageHeight - 10
                );
                
                // Add "Powered by Ayn Beirut POS" in footer center
                doc.text(
                    'Powered by Ayn Beirut POS',
                    pageSize.width / 2,
                    pageHeight - 10,
                    { align: 'center' }
                );
                
                if (options.footer) {
                    doc.text(
                        options.footer,
                        pageSize.width - data.settings.margin.right,
                        pageHeight - 10,
                        { align: 'right' }
                    );
                }
            }
        });
        
        // Download
        doc.save(`${filename}.pdf`);
        
        console.log(`✅ PDF exported: ${filename}.pdf`);
        return true;
        
    } catch (error) {
        console.error('❌ PDF export failed:', error);
        alert('Failed to export PDF: ' + error.message);
        return false;
    }
}

// ===================================
// EXCEL EXPORT
// ===================================

/**
 * Export data to Excel with formatting
 * @param {Array} data - Array of objects to export
 * @param {Array} columns - Array of column definitions [{header: 'Name', key: 'name', width: 20}]
 * @param {String} filename - Output filename (without .xlsx extension)
 * @param {String} sheetName - Sheet name (default: 'Sheet1')
 */
async function exportToExcel(data, columns, filename, sheetName = 'Sheet1') {
    try {
        if (!window.XLSX) {
            throw new Error('XLSX library not loaded');
        }
        
        // Prepare data with headers
        const headers = columns.map(col => col.header);
        const rows = data.map(row => 
            columns.map(col => {
                const value = row[col.key];
                
                // Format based on type
                if (col.type === 'currency' && value !== null && value !== undefined) {
                    return parseFloat(value);
                } else if (col.type === 'number' && value !== null && value !== undefined) {
                    return parseFloat(value);
                } else if (col.type === 'date' && value) {
                    return formatDate(value);
                } else if (col.type === 'datetime' && value) {
                    return formatDateTime(value);
                }
                
                return value !== null && value !== undefined ? value : '';
            })
        );
        
        // Combine headers and rows
        const wsData = [headers, ...rows];
        
        // Create worksheet
        const ws = window.XLSX.utils.aoa_to_sheet(wsData);
        
        // Set column widths
        ws['!cols'] = columns.map(col => ({ wch: col.width || 15 }));
        
        // Apply number formatting for currency columns
        const range = window.XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = {c: C, r: R};
                const cell_ref = window.XLSX.utils.encode_cell(cell_address);
                
                if (ws[cell_ref] && columns[C].type === 'currency') {
                    ws[cell_ref].z = '$#,##0.00';
                } else if (ws[cell_ref] && columns[C].type === 'number') {
                    ws[cell_ref].z = '#,##0.00';
                }
            }
        }
        
        // Create workbook
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
        
        // Get company info for metadata
        let companyName = 'Ayn Beirut POS';
        try {
            const companyInfo = await runQuery('SELECT * FROM company_info WHERE id = 1');
            if (companyInfo && companyInfo.length > 0 && companyInfo[0].companyName) {
                companyName = companyInfo[0].companyName;
            }
        } catch (error) {
            console.warn('Could not load company info for Excel metadata:', error);
        }
        
        // Add metadata
        wb.Props = {
            Title: filename,
            Subject: 'POS Export',
            Author: companyName,
            CreatedDate: new Date()
        };
        
        // Download
        window.XLSX.writeFile(wb, `${filename}.xlsx`);
        
        console.log(`✅ Excel exported: ${filename}.xlsx`);
        return true;
        
    } catch (error) {
        console.error('❌ Excel export failed:', error);
        alert('Failed to export Excel: ' + error.message);
        return false;
    }
}

// ===================================
// CSV EXPORT
// ===================================

/**
 * Export data to CSV with proper escaping
 * @param {Array} data - Array of objects to export
 * @param {Array} columns - Array of column definitions [{header: 'Name', key: 'name'}]
 * @param {String} filename - Output filename (without .csv extension)
 */
async function exportToCSV(data, columns, filename) {
    try {
        // Create CSV header
        const headers = columns.map(col => escapeCSV(col.header));
        let csv = headers.join(',') + '\n';
        
        // Add data rows
        data.forEach(row => {
            const values = columns.map(col => {
                let value = row[col.key];
                
                // Format based on type
                if (col.type === 'currency' && value !== null && value !== undefined) {
                    value = formatCurrency(value);
                } else if (col.type === 'number' && value !== null && value !== undefined) {
                    value = formatNumber(value, col.decimals || 2);
                } else if (col.type === 'date' && value) {
                    value = formatDate(value);
                } else if (col.type === 'datetime' && value) {
                    value = formatDateTime(value);
                }
                
                return escapeCSV(value);
            });
            
            csv += values.join(',') + '\n';
        });
        
        // Add UTF-8 BOM for Excel compatibility
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
        
        // Download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log(`✅ CSV exported: ${filename}.csv`);
        return true;
        
    } catch (error) {
        console.error('❌ CSV export failed:', error);
        alert('Failed to export CSV: ' + error.message);
        return false;
    }
}

/**
 * Escape CSV value
 */
function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    
    // Convert to string
    let str = String(value);
    
    // Escape quotes and wrap in quotes if needed
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        str = '"' + str.replace(/"/g, '""') + '"';
    }
    
    return str;
}

// ===================================
// EXPORT TO WINDOW
// ===================================

if (typeof window !== 'undefined') {
    window.exportToPDF = exportToPDF;
    window.exportToExcel = exportToExcel;
    window.exportToCSV = exportToCSV;
    window.formatCurrency = formatCurrency;
    window.formatDate = formatDate;
    window.formatDateTime = formatDateTime;
    window.formatNumber = formatNumber;
    window.getUnitDisplay = getUnitDisplay;
    window.getUnitConversion = getUnitConversion;
    window.UNIT_CONVERSIONS = UNIT_CONVERSIONS;
}

console.log('📦 Export utilities loaded');
