
import { formatCurrency } from "@/lib/utils";

interface InvoiceTemplateProps {
  invoice: any;
  company: any;
}

// Helper function to convert number to words
const numberToWords = (num: number): string => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
                'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
                'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Million', 'Billion'];

  if (num === 0) return 'Zero';

  const convertLessThanThousand = (n: number): string => {
    if (n === 0) return '';
    
    if (n < 20) {
      return ones[n] + ' ';
    }
    
    if (n < 100) {
      return tens[Math.floor(n / 10)] + ' ' + convertLessThanThousand(n % 10);
    }
    
    return ones[Math.floor(n / 100)] + ' Hundred ' + convertLessThanThousand(n % 100);
  };

  let words = '';
  let scaleIndex = 0;
  
  while (num > 0) {
    const n = num % 1000;
    if (n !== 0) {
      const str = convertLessThanThousand(n);
      words = str + scales[scaleIndex] + ' ' + words;
    }
    scaleIndex++;
    num = Math.floor(num / 1000);
  }

  return words.trim();
};

// Convert amount to words with currency
export const amountToWords = (amount: number, currency: string): string => {
  const wholePart = Math.floor(amount);
  const decimalPart = Math.round((amount - wholePart) * 100);
  
  let result = numberToWords(wholePart);
  
  let currencyName = '';
  switch(currency) {
    case 'USD':
      currencyName = 'Dollars';
      break;
    case 'EUR':
      currencyName = 'Euros';
      break;
    case 'GBP':
      currencyName = 'Pounds';
      break;
    case 'JPY':
      currencyName = 'Yen';
      break;
    default:
      currencyName = currency;
  }
  
  if (decimalPart > 0) {
    result += ' and ' + numberToWords(decimalPart) + ' Cents';
  }
  
  return result + ' ' + currencyName + ' Only';
};

export const BasicTemplate: React.FC<InvoiceTemplateProps> = ({ invoice, company }) => {
  const totalAmount = invoice.total || invoice.amount;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md text-gray-800">
      <div className="border-b pb-4 mb-4">
        <h1 className="text-2xl font-bold">INVOICE</h1>
        <p className="text-gray-500">#{invoice.id}</p>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="font-semibold">From:</p>
          <p>{company?.name || "Your Company"}</p>
          <p>{company?.address || ""}</p>
          {company?.email && <p>{company.email}</p>}
          {company?.website && <p>{company.website}</p>}
        </div>
        
        <div>
          <p className="font-semibold">To:</p>
          <p>{invoice.customer || (invoice.client?.name || "")}</p>
          {invoice.client?.address && <p>{invoice.client.address}</p>}
          {invoice.client?.email && <p>{invoice.client.email}</p>}
        </div>
      </div>
      
      <div className="mb-6">
        <p><strong>Date:</strong> {invoice.date}</p>
        <p><strong>Status:</strong> {invoice.status}</p>
      </div>
      
      <table className="w-full mb-6">
        <thead className="border-b">
          <tr>
            <th className="text-left py-2">Description</th>
            <th className="text-right py-2">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items ? (
            invoice.items.map((item: any) => (
              <tr key={item.id} className="border-b">
                <td className="py-2">
                  {item.description}
                  <div className="text-gray-500 text-sm">{item.quantity} x {formatCurrency(item.unitPrice, invoice.currency)}</div>
                </td>
                <td className="text-right py-2">{formatCurrency(item.subtotal, invoice.currency)}</td>
              </tr>
            ))
          ) : (
            <tr className="border-b">
              <td className="py-2">Services</td>
              <td className="text-right py-2">{formatCurrency(invoice.amount, invoice.currency)}</td>
            </tr>
          )}
        </tbody>
      </table>
      
      <div className="flex justify-end">
        <div className="w-1/3">
          <div className="flex justify-between mb-2">
            <span>Subtotal:</span>
            <span>{formatCurrency(invoice.amount, invoice.currency)}</span>
          </div>
          
          {invoice.tax && (
            <div className="flex justify-between mb-2">
              <span>Tax ({invoice.tax}%):</span>
              <span>{formatCurrency(invoice.amount * (invoice.tax / 100), invoice.currency)}</span>
            </div>
          )}
          
          {invoice.discount && (
            <div className="flex justify-between mb-2">
              <span>Discount:</span>
              <span>-{formatCurrency(invoice.discount, invoice.currency)}</span>
            </div>
          )}
          
          <div className="flex justify-between font-bold border-t pt-2">
            <span>Total:</span>
            <span>{formatCurrency(totalAmount, invoice.currency)}</span>
          </div>
          
          <div className="mt-4 text-sm text-gray-600 italic">
            {amountToWords(totalAmount, invoice.currency)}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ModernTemplate: React.FC<InvoiceTemplateProps> = ({ invoice, company }) => {
  // Modern, clean template with better typography and visual hierarchy
  const accentColor = company?.primaryColor || "#4F46E5";
  const totalAmount = invoice.total || invoice.amount;
  
  return (
    <div className="bg-white p-8 rounded-lg shadow-lg text-gray-800 max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-10">
        <div>
          {company?.logo ? (
            <img src={company.logo} alt="Company Logo" className="h-16 mb-4" />
          ) : (
            <h2 className="text-2xl font-bold" style={{ color: accentColor }}>{company?.name || "Your Company"}</h2>
          )}
          <div className="text-gray-600 mt-1">
            {company?.address && <p>{company.address}</p>}
            <div className="flex space-x-4 mt-1">
              {company?.email && <p>{company.email}</p>}
              {company?.website && <p>{company.website}</p>}
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <h1 className="text-3xl font-bold mb-1" style={{ color: accentColor }}>INVOICE</h1>
          <p className="text-xl text-gray-700">#{invoice.id}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-8 mb-10">
        <div className="p-4 rounded-md" style={{ backgroundColor: `${accentColor}10` }}>
          <h3 className="font-medium mb-3 text-gray-700">Bill To</h3>
          <p className="font-semibold text-gray-900">{invoice.customer || (invoice.client?.name || "")}</p>
          {invoice.client?.address && <p className="text-gray-600 mt-1">{invoice.client.address}</p>}
          {invoice.client?.email && <p className="text-gray-600 mt-1">{invoice.client.email}</p>}
          {invoice.client?.taxId && <p className="text-gray-600 mt-1">Tax ID: {invoice.client.taxId}</p>}
        </div>
        
        <div className="p-4 rounded-md bg-gray-50">
          <div className="flex justify-between mb-2">
            <span className="text-gray-600">Invoice Date:</span>
            <span className="font-medium">{invoice.date}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-gray-600">Status:</span>
            <span className="font-medium capitalize">{invoice.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Payment Terms:</span>
            <span className="font-medium">Due on Receipt</span>
          </div>
        </div>
      </div>
      
      <div className="mb-10 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="pb-3 text-left font-semibold text-gray-600">Item</th>
              <th className="pb-3 text-right font-semibold text-gray-600">Qty</th>
              <th className="pb-3 text-right font-semibold text-gray-600">Price</th>
              <th className="pb-3 text-right font-semibold text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoice.items ? (
              invoice.items.map((item: any) => (
                <tr key={item.id}>
                  <td className="py-4">
                    <div className="font-medium text-gray-900">{item.description}</div>
                  </td>
                  <td className="py-4 text-right text-gray-700">{item.quantity}</td>
                  <td className="py-4 text-right text-gray-700">{formatCurrency(item.unitPrice, invoice.currency)}</td>
                  <td className="py-4 text-right font-medium text-gray-900">{formatCurrency(item.subtotal, invoice.currency)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-4">
                  <div className="font-medium text-gray-900">Services</div>
                </td>
                <td className="py-4 text-right text-gray-700">1</td>
                <td className="py-4 text-right text-gray-700">{formatCurrency(invoice.amount, invoice.currency)}</td>
                <td className="py-4 text-right font-medium text-gray-900">{formatCurrency(invoice.amount, invoice.currency)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <div className="flex justify-end">
        <div className="w-64">
          <div className="flex justify-between mb-2 text-gray-700">
            <span>Subtotal:</span>
            <span>{formatCurrency(invoice.amount, invoice.currency)}</span>
          </div>
          
          {invoice.tax && (
            <div className="flex justify-between mb-2 text-gray-700">
              <span>Tax ({invoice.tax}%):</span>
              <span>{formatCurrency(invoice.amount * (invoice.tax / 100), invoice.currency)}</span>
            </div>
          )}
          
          {invoice.discount && (
            <div className="flex justify-between mb-2 text-gray-700">
              <span>Discount:</span>
              <span>-{formatCurrency(invoice.discount, invoice.currency)}</span>
            </div>
          )}
          
          <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2 mt-2">
            <span>Total:</span>
            <span style={{ color: accentColor }}>{formatCurrency(totalAmount, invoice.currency)}</span>
          </div>
          
          <div className="mt-4 text-sm text-gray-600 italic">
            {amountToWords(totalAmount, invoice.currency)}
          </div>
        </div>
      </div>
      
      {company?.signature && (
        <div className="mt-10 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-600 mb-1">Thank you for your business</p>
              {company.taxId && <p className="text-gray-500 text-sm">Company Tax ID: {company.taxId}</p>}
              {company.commercialRegistryNumber && <p className="text-gray-500 text-sm">Commercial Registry: {company.commercialRegistryNumber}</p>}
            </div>
            <div className="text-right">
              <img src={company.signature} alt="Signature" className="h-10 ml-auto mb-1" />
              <p className="text-gray-600">Authorized Signature</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ProfessionalTemplate: React.FC<InvoiceTemplateProps> = ({ invoice, company }) => {
  // Professional template with subtle branding and clean layout
  const accentColor = company?.primaryColor || "#4F46E5";
  const secondaryColor = company?.secondaryColor || "#C7D2FE";
  const totalAmount = invoice.total || invoice.amount;
  
  return (
    <div className="bg-white p-8 rounded-lg shadow-lg text-gray-800 max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-12 pb-6 border-b" style={{ borderColor: secondaryColor }}>
        <div>
          {company?.logo ? (
            <img src={company.logo} alt="Company Logo" className="h-16 mb-2" />
          ) : (
            <h2 className="text-3xl font-bold" style={{ color: accentColor }}>{company?.name || "Your Company"}</h2>
          )}
          <div className="text-gray-600 mt-2">
            {company?.address && <p>{company.address}</p>}
            <div className="flex space-x-4 mt-1">
              {company?.email && <p>{company.email}</p>}
              {company?.website && <p>{company.website}</p>}
            </div>
          </div>
        </div>
        
        <div>
          <div className="text-right mb-4">
            <span className="text-5xl font-light" style={{ color: accentColor }}>INVOICE</span>
          </div>
          <div className="p-4 rounded-md" style={{ backgroundColor: `${accentColor}10` }}>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Invoice Number:</p>
                <p className="font-semibold">{invoice.id}</p>
              </div>
              <div>
                <p className="text-gray-600">Date:</p>
                <p className="font-semibold">{invoice.date}</p>
              </div>
              <div>
                <p className="text-gray-600">Status:</p>
                <p className="font-semibold capitalize">{invoice.status}</p>
              </div>
              <div>
                <p className="text-gray-600">Due:</p>
                <p className="font-semibold">Upon Receipt</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-8 mb-12">
        <div>
          <h3 className="font-medium mb-4 pb-1 text-lg border-b" style={{ borderColor: secondaryColor, color: accentColor }}>
            Bill To:
          </h3>
          <div className="text-gray-800">
            <p className="font-semibold text-lg">{invoice.customer || (invoice.client?.name || "")}</p>
            {invoice.client?.address && <p className="mt-1">{invoice.client.address}</p>}
            {invoice.client?.email && <p className="mt-1">{invoice.client.email}</p>}
            {invoice.client?.phone && <p className="mt-1">{invoice.client.phone}</p>}
            {invoice.client?.taxId && <p className="mt-1">Tax ID: {invoice.client.taxId}</p>}
          </div>
        </div>
        
        <div>
          <h3 className="font-medium mb-4 pb-1 text-lg border-b" style={{ borderColor: secondaryColor, color: accentColor }}>
            Payment Details:
          </h3>
          <div className="text-gray-800">
            <p><span className="text-gray-600">Method:</span> Bank Transfer</p>
            <p className="mt-1"><span className="text-gray-600">Currency:</span> {invoice.currency}</p>
          </div>
        </div>
      </div>
      
      <div className="mb-12 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="py-3 px-4 text-left font-semibold" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>Description</th>
              <th className="py-3 px-4 text-right font-semibold" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>Quantity</th>
              <th className="py-3 px-4 text-right font-semibold" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>Unit Price</th>
              <th className="py-3 px-4 text-right font-semibold" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items ? (
              invoice.items.map((item: any, index: number) => (
                <tr key={item.id} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                  <td className="py-4 px-4">{item.description}</td>
                  <td className="py-4 px-4 text-right">{item.quantity}</td>
                  <td className="py-4 px-4 text-right">{formatCurrency(item.unitPrice, invoice.currency)}</td>
                  <td className="py-4 px-4 text-right">{formatCurrency(item.subtotal, invoice.currency)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-4 px-4">Services</td>
                <td className="py-4 px-4 text-right">1</td>
                <td className="py-4 px-4 text-right">{formatCurrency(invoice.amount, invoice.currency)}</td>
                <td className="py-4 px-4 text-right">{formatCurrency(invoice.amount, invoice.currency)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <div className="flex justify-between mb-12">
        <div className="w-1/2">
          <h3 className="font-medium mb-2 pb-1 text-lg" style={{ color: accentColor }}>
            Notes:
          </h3>
          <p className="text-gray-600 text-sm">
            Thank you for your business. Payment is due within 30 days.
          </p>
        </div>
        
        <div className="w-1/3">
          <div className="bg-gray-50 p-4 rounded-md">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Subtotal:</span>
              <span>{formatCurrency(invoice.amount, invoice.currency)}</span>
            </div>
            
            {invoice.tax && (
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Tax ({invoice.tax}%):</span>
                <span>{formatCurrency(invoice.amount * (invoice.tax / 100), invoice.currency)}</span>
              </div>
            )}
            
            {invoice.discount && (
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Discount:</span>
                <span>-{formatCurrency(invoice.discount, invoice.currency)}</span>
              </div>
            )}
            
            <div className="flex justify-between font-bold border-t border-gray-200 pt-2 mt-2 text-lg">
              <span>Total:</span>
              <span style={{ color: accentColor }}>{formatCurrency(totalAmount, invoice.currency)}</span>
            </div>
            
            <div className="mt-4 text-sm text-gray-600 italic">
              {amountToWords(totalAmount, invoice.currency)}
            </div>
          </div>
        </div>
      </div>
      
      {company?.signature && (
        <div className="flex justify-between border-t pt-6" style={{ borderColor: secondaryColor }}>
          <div>
            {company.taxId && <p className="text-gray-500 text-sm">Company Tax ID: {company.taxId}</p>}
            {company.commercialRegistryNumber && <p className="text-gray-500 text-sm">Commercial Registry: {company.commercialRegistryNumber}</p>}
          </div>
          <div className="text-right">
            <img src={company.signature} alt="Signature" className="h-12 ml-auto mb-1" />
            <p className="text-gray-600">Authorized Signature</p>
          </div>
        </div>
      )}
    </div>
  );
};
