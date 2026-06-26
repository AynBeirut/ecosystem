import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Printer } from 'lucide-react';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { Supplier, PurchaseOrder } from '@/types/inventory';
import { exportToCSV } from '@/lib/exportUtils';

const AdminSupplierStatements: React.FC = () => {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const fetchSuppliers = async () => {
      if (!user?.storeId) return;
      const db = getFirestore();
      const suppliersRef = collection(db, 'suppliers');
      const q = query(suppliersRef, where('storeId', '==', user.storeId));
      const snapshot = await getDocs(q);
      const suppliersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Supplier));
      setSuppliers(suppliersList);
    };
    fetchSuppliers();
  }, [user?.storeId]);

  useEffect(() => {
    const fetchPurchaseOrders = async () => {
      if (!user?.storeId || !selectedSupplierId) return;
      const db = getFirestore();
      const ordersRef = collection(db, 'purchaseOrders');
      const q = query(
        ordersRef,
        where('storeId', '==', user.storeId),
        where('supplierId', '==', selectedSupplierId)
      );
      const snapshot = await getDocs(q);
      const ordersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PurchaseOrder));
      setPurchaseOrders(ordersList.sort((a, b) => 
        new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
      ));
    };
    fetchPurchaseOrders();
  }, [user?.storeId, selectedSupplierId]);

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
  
  const filteredOrders = purchaseOrders.filter(po => 
    po.orderDate >= dateRange.startDate && po.orderDate <= dateRange.endDate
  );

  const totalOrders = filteredOrders.length;
  const totalAmount = filteredOrders.reduce((sum, po) => sum + po.totalCost, 0);
  const pendingOrders = filteredOrders.filter(po => po.status === 'pending').length;
  const receivedOrders = filteredOrders.filter(po => po.status === 'received').length;

  const handleExportStatement = () => {
    if (!selectedSupplier) return;
    
    const exportData = filteredOrders.map(po => ({
      Date: new Date(po.orderDate).toLocaleDateString(),
      PONumber: po.poNumber || po.id,
      Status: po.status,
      Items: po.items?.length || 0,
      TotalCost: po.totalCost.toFixed(2),
      ReceivedDate: po.receivedDate ? new Date(po.receivedDate).toLocaleDateString() : 'Pending',
      Notes: po.notes || '',
    }));

    exportToCSV(exportData, `supplier_statement_${selectedSupplier.name.replace(/\s+/g, '_')}`);
  };

  const handlePrintStatement = () => {
    if (!selectedSupplier) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const ordersHtml = filteredOrders.map(po => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date(po.orderDate).toLocaleDateString()}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${po.poNumber || po.id}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${po.status}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${po.totalCost.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${po.receivedDate ? new Date(po.receivedDate).toLocaleDateString() : 'Pending'}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Supplier Statement - ${selectedSupplier.name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          .header { margin-bottom: 30px; }
          .header h1 { margin: 0; color: #333; }
          .supplier-info { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 30px 0; }
          .summary-item { padding: 15px; background: #fff; border: 1px solid #ddd; border-radius: 5px; text-align: center; }
          .summary-item .label { font-size: 12px; color: #666; }
          .summary-item .value { font-size: 24px; font-weight: bold; color: #2563eb; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #f8f9fa; padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6; }
          @media print {
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>SUPPLIER ACCOUNT STATEMENT</h1>
          <p>Period: ${new Date(dateRange.startDate).toLocaleDateString()} to ${new Date(dateRange.endDate).toLocaleDateString()}</p>
          <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="supplier-info">
          <h2 style="margin: 0 0 10px 0;">${selectedSupplier.name}</h2>
          <p style="margin: 5px 0;"><strong>Contact:</strong> ${selectedSupplier.contactPerson || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${selectedSupplier.email || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Phone:</strong> ${selectedSupplier.phone || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Address:</strong> ${selectedSupplier.address || 'N/A'}</p>
        </div>

        <div class="summary">
          <div class="summary-item">
            <div class="label">Total Orders</div>
            <div class="value">${totalOrders}</div>
          </div>
          <div class="summary-item">
            <div class="label">Total Amount</div>
            <div class="value">$${totalAmount.toFixed(2)}</div>
          </div>
          <div class="summary-item">
            <div class="label">Pending Orders</div>
            <div class="value">${pendingOrders}</div>
          </div>
          <div class="summary-item">
            <div class="label">Received Orders</div>
            <div class="value">${receivedOrders}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>PO Number</th>
              <th>Status</th>
              <th style="text-align: right;">Amount</th>
              <th>Received Date</th>
            </tr>
          </thead>
          <tbody>
            ${ordersHtml}
          </tbody>
          <tfoot>
            <tr style="font-weight: bold; background: #f8f9fa;">
              <td colspan="3" style="padding: 12px;">TOTAL</td>
              <td style="padding: 12px; text-align: right;">$${totalAmount.toFixed(2)}</td>
              <td style="padding: 12px;"></td>
            </tr>
          </tfoot>
        </table>

        <div style="margin-top: 50px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center; color: #666; font-size: 12px;">
          <p>This is a computer-generated statement and does not require a signature.</p>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  return (
    <AdminPageShell
      title="Supplier Account Statements"
      description="View and export statements for your suppliers."
      eyebrow="Inventory"
      backTo="/admin/suppliers"
      backLabel="Suppliers"
    >

        <AdminPanel className="mb-6">
          <CardHeader>
            <CardTitle>Statement Settings</CardTitle>
            <CardDescription>Select supplier and date range</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="supplier">Supplier *</Label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(supplier => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </AdminPanel>

        {selectedSupplier && (
          <>
            <AdminPanel className="mb-6">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{selectedSupplier.name}</CardTitle>
                    <CardDescription>
                      {selectedSupplier.email} | {selectedSupplier.phone}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportStatement}>
                      <Download className="mr-2 h-4 w-4" />
                      Export CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={handlePrintStatement}>
                      <Printer className="mr-2 h-4 w-4" />
                      Print
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50 rounded text-center">
                    <div className="text-2xl font-bold text-blue-600">{totalOrders}</div>
                    <div className="text-sm text-gray-600">Total Orders</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded text-center">
                    <div className="text-2xl font-bold text-green-600">${totalAmount.toFixed(2)}</div>
                    <div className="text-sm text-gray-600">Total Amount</div>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded text-center">
                    <div className="text-2xl font-bold text-yellow-600">{pendingOrders}</div>
                    <div className="text-sm text-gray-600">Pending Orders</div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded text-center">
                    <div className="text-2xl font-bold text-purple-600">{receivedOrders}</div>
                    <div className="text-sm text-gray-600">Received Orders</div>
                  </div>
                </div>
              </CardContent>
            </AdminPanel>

            <AdminPanel>
              <CardHeader>
                <CardTitle>Purchase Orders</CardTitle>
                <CardDescription>
                  All purchase orders for this supplier in selected period
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500">No purchase orders found for this period</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredOrders.map((po) => (
                      <div key={po.id} className="flex items-center justify-between p-4 bg-gray-50 rounded">
                        <div className="flex-1">
                          <div className="font-medium">PO #{po.poNumber || po.id.slice(0, 8)}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(po.orderDate).toLocaleDateString()}
                            {po.receivedDate && ` • Received: ${new Date(po.receivedDate).toLocaleDateString()}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="font-bold text-green-600">${po.totalCost.toFixed(2)}</div>
                            <div className="text-sm text-gray-500">{po.items?.length || 0} items</div>
                          </div>
                          <Badge
                            className={
                              po.status === 'received'
                                ? 'bg-green-100 text-green-800'
                                : po.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }
                          >
                            {po.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </AdminPanel>
          </>
        )}
    </AdminPageShell>
  );
};

export default AdminSupplierStatements;
