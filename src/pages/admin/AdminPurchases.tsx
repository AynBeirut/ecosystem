import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus, Edit3, ShoppingCart, Minus, CheckCircle, XCircle, Download, Share2, Printer, Mail, MessageCircle, MoreVertical, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Purchase, PurchaseItem, Supplier, RawMaterial } from '@/types/inventory';
import { StoreProfile } from '@/types/storeProfile';
import { logAction } from '@/lib/auditLog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';

const AdminPurchases: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);
  const [isAddingPurchase, setIsAddingPurchase] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [receivingPurchase, setReceivingPurchase] = useState<Purchase | null>(null);
  const [payingPurchase, setPayingPurchase] = useState<Purchase | null>(null);
  const [viewingPaymentVoucher, setViewingPaymentVoucher] = useState<{ purchase: Purchase; payment: any } | null>(null);
  const [paymentData, setPaymentData] = useState({
    amountPaid: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash',
    paymentNotes: '',
  });
  const [newPurchase, setNewPurchase] = useState({
    supplierId: '',
    supplierName: '',
    supplierContact: '',
    supplierEmail: '',
    expectedDeliveryDate: '',
    notes: '',
    items: [] as PurchaseItem[],
    taxType: 'none' as 'none' | 'VAT' | 'TTC',
    taxRate: 0,
  });

  const [isCreatingNewSupplier, setIsCreatingNewSupplier] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.storeId) return;
      const db = getFirestore();

      // Fetch store profile
      const profileRef = doc(db, 'storeProfiles', user.storeId);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        setStoreProfile(profileSnap.data() as StoreProfile);
      }

      // Fetch purchases
      const purchasesRef = collection(db, 'purchases');
      const purchasesQuery = query(purchasesRef, where('storeId', '==', user.storeId));
      const purchasesSnapshot = await getDocs(purchasesQuery);
      const purchasesList: Purchase[] = purchasesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Purchase));
      
      // Fix amountPaid from paymentHistory if missing
      const fixedPurchases = purchasesList.map(purchase => {
        if (purchase.paymentHistory && purchase.paymentHistory.length > 0) {
          const calculatedPaid = purchase.paymentHistory.reduce((sum, payment) => sum + (payment.amount || 0), 0);
          if (purchase.amountPaid !== calculatedPaid) {
            // Sync amountPaid with paymentHistory total
            return { ...purchase, amountPaid: calculatedPaid };
          }
        }
        return purchase;
      });
      
      setPurchases(fixedPurchases.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()));

      // Fetch suppliers
      const suppliersRef = collection(db, 'suppliers');
      const suppliersQuery = query(suppliersRef, where('storeId', '==', user.storeId));
      const suppliersSnapshot = await getDocs(suppliersQuery);
      const suppliersList: Supplier[] = suppliersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Supplier));
      setSuppliers(suppliersList);

      // Fetch raw materials
      const materialsRef = collection(db, 'rawMaterials');
      const materialsQuery = query(materialsRef, where('storeId', '==', user.storeId));
      const materialsSnapshot = await getDocs(materialsQuery);
      const materialsList: RawMaterial[] = materialsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RawMaterial));
      setRawMaterials(materialsList);
    };
    fetchData();
  }, [user?.storeId]);

  const generatePONumber = async (): Promise<string> => {
    if (!user?.storeId) {
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const seq = (purchases.length + 1).toString().padStart(4, '0');
      return `PO-${year}${month}-${seq}`;
    }
    
    const db = getFirestore();
    const profileRef = doc(db, 'storeProfiles', user.storeId);
    
    // Fetch the latest store profile to ensure we have current data
    const profileSnap = await getDoc(profileRef);
    const currentProfile = profileSnap.exists() ? (profileSnap.data() as StoreProfile) : null;
    
    const prefix = currentProfile?.invoiceNumberPrefix || 'PO';
    const lastNumber = currentProfile?.lastInvoiceNumber || 0;
    const newNumber = lastNumber + 1;
    const poNumber = `${prefix}-${String(newNumber).padStart(3, '0')}`;
    
    // Update last invoice number in store profile
    await updateDoc(profileRef, { lastInvoiceNumber: newNumber });
    
    // Update local state to keep UI in sync
    if (currentProfile) {
      setStoreProfile({ ...currentProfile, lastInvoiceNumber: newNumber });
    }
    
    return poNumber;
  };

  // Format currency with LBP conversion

  const formatCurrency = (amount: number, showDual: boolean = true): string => {
    const usd = `$${amount.toFixed(2)}`;
    
    if (showDual && storeProfile?.customExchangeRate && storeProfile.customExchangeRate > 0) {
      const lbp = (amount * storeProfile.customExchangeRate).toFixed(0);
      return `${usd} (${Number(lbp).toLocaleString()} LBP)`;
    }
    
    return usd;
  };

  const calculateTotal = (items: PurchaseItem[], taxType: string = 'none', taxRate: number = 0): number => {
    const subtotal = items.reduce((sum, item) => {
      const qty = typeof item.quantity === 'number' ? item.quantity : (parseFloat(item.quantity as any) || 0);
      const price = typeof item.unitPrice === 'number' ? item.unitPrice : (parseFloat(item.unitPrice as any) || 0);
      return sum + (qty * price);
    }, 0);
    
    if (taxType === 'none') return subtotal;
    const taxAmount = subtotal * (taxRate / 100);
    return subtotal + taxAmount;
  };

  const handleCreateInlineSupplier = async () => {
    if (!newPurchase.supplierName || !newPurchase.supplierContact || !user?.storeId) {
      toast({ title: "Error", description: "Supplier name and contact are required", variant: "destructive" });
      return;
    }

    try {
      const db = getFirestore();
      const supplierData = {
        storeId: user.storeId,
        name: newPurchase.supplierName,
        contactPerson: newPurchase.supplierContact,
        email: newPurchase.supplierEmail || '',
        phone: '',
        address: '',
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'suppliers'), supplierData);
      const newSupplier = { id: docRef.id, ...supplierData };
      setSuppliers([...suppliers, newSupplier]);
      setNewPurchase({ ...newPurchase, supplierId: docRef.id });
      setIsCreatingNewSupplier(false);
      toast({ title: "Success", description: "Supplier created successfully" });
    } catch (error) {
      console.error('Error creating supplier:', error);
      toast({ title: "Error", description: "Failed to create supplier", variant: "destructive" });
    }
  };

  const generatePOHTML = (purchase: Purchase) => {
    const template = storeProfile?.invoiceTemplate || 'modern';
    const storeName = storeProfile?.name || 'Your Store';
    const storeLogo = storeProfile?.logo || '';
    const storeSlogan = storeProfile?.slogan || '';
    const storeWebsite = storeProfile?.website || '';
    const storePhone = storeProfile?.phone || '';
    const storeEmail = storeProfile?.email || '';
    const storeTaxNumber = storeProfile?.taxNumber || '';
    const poNum = purchase.invoiceNumber || purchase.poNumber || purchase.purchaseOrderNumber || purchase.id.slice(0, 8).toUpperCase();
    
    const supplier = suppliers.find(s => s.id === purchase.supplierId);
    const itemsHtml = purchase.items?.map(item => {
      const material = rawMaterials.find(m => m.id === item.rawMaterialId);
      const lineTotal = item.quantity * item.unitPrice;
      return `
        <tr>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb;">${material?.name || 'Material'}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unitPrice, true)}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(lineTotal, true)}</td>
        </tr>
      `;
    }).join('');

    // Modern Template
    if (template === 'modern') {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Purchase Order ${poNum}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              padding: 40px; 
              background: #f0f9ff;
              color: #1e293b;
            }
            .invoice-container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header { 
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              padding-bottom: 30px;
              border-bottom: 3px solid #0ea5e9;
              margin-bottom: 30px;
            }
            .logo-section {
              display: flex;
              align-items: center;
              gap: 20px;
            }
            .logo {
              width: 150px;
              height: 150px;
              object-fit: contain;
              border-radius: 8px;
            }
            .store-info h1 {
              color: #0ea5e9;
              font-size: 28px;
              margin-bottom: 5px;
            }
            .store-info p {
              color: #64748b;
              font-size: 14px;
              margin: 2px 0;
            }
            .invoice-info {
              text-align: right;
            }
            .invoice-info h2 {
              color: #0ea5e9;
              font-size: 32px;
              margin-bottom: 10px;
            }
            .invoice-info .invoice-number {
              font-size: 20px;
              font-weight: bold;
              color: #1e293b;
              margin-bottom: 5px;
            }
            .details-section {
              display: flex;
              justify-content: space-between;
              margin: 30px 0;
              gap: 40px;
            }
            .section-title {
              font-size: 14px;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
              margin-bottom: 10px;
              letter-spacing: 0.5px;
            }
            .detail-text {
              font-size: 15px;
              line-height: 1.6;
              color: #334155;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 30px 0;
            }
            th { 
              background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
              color: white;
              padding: 14px 8px;
              text-align: left;
              font-weight: 600;
              font-size: 14px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            td {
              font-size: 15px;
              color: #334155;
            }
            .totals { 
              margin-top: 30px;
              text-align: right;
            }
            .grand-total {
              font-size: 20px;
              font-weight: bold;
              color: #0ea5e9;
              margin-top: 15px;
              padding-top: 15px;
              border-top: 3px solid #0ea5e9;
            }
            .footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 2px solid #e5e7eb;
              text-align: center;
              color: #64748b;
              font-size: 13px;
            }
            @media print {
              body { padding: 20px; background: white; }
              .invoice-container { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="header">
              <div class="logo-section">
                ${storeLogo ? `<img src="${storeLogo}" alt="${storeName}" class="logo">` : ''}
                <div class="store-info">
                  <h1>${storeName}</h1>
                  ${storeSlogan ? `<p style="font-style: italic; color: #0ea5e9;">"${storeSlogan}"</p>` : ''}
                  ${storeWebsite ? `<p>🌐 ${storeWebsite}</p>` : ''}
                  ${storePhone ? `<p>📞 ${storePhone}</p>` : ''}
                  ${storeEmail ? `<p>📧 ${storeEmail}</p>` : ''}
                  ${storeTaxNumber ? `<p>Tax #: ${storeTaxNumber}</p>` : ''}
                </div>
              </div>
              <div class="invoice-info">
                <h2>PURCHASE ORDER</h2>
                <div class="invoice-number">${poNum}</div>
                <p style="color: #64748b;">${new Date(purchase.orderDate || '').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
            
            <div class="details-section">
              <div>
                <div class="section-title">Supplier</div>
                <div class="detail-text">
                  <strong style="font-size: 17px; color: #0ea5e9;">${supplier?.name || 'N/A'}</strong><br/>
                  ${supplier?.contactPerson ? `${supplier.contactPerson}<br/>` : ''}
                  ${supplier?.email ? `${supplier.email}<br/>` : ''}
                  ${supplier?.phone ? `${supplier.phone}<br/>` : ''}
                </div>
              </div>
              ${purchase.expectedDeliveryDate ? `
              <div>
                <div class="section-title">Expected Delivery</div>
                <div class="detail-text">
                  <strong style="font-size: 17px; color: #0ea5e9;">${new Date(purchase.expectedDeliveryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                </div>
              </div>
              ` : ''}
            </div>

            <table>
              <thead>
                <tr>
                  <th>Item Description</th>
                  <th style="text-align: center; width: 100px;">Qty</th>
                  <th style="text-align: right; width: 150px;">Unit Price</th>
                  <th style="text-align: right; width: 150px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="totals">
              <div class="grand-total">TOTAL: ${formatCurrency(purchase.totalCost || purchase.totalAmount || purchase.total || 0, true)}</div>
            </div>

            ${purchase.notes ? `
            <div style="margin-top: 30px; padding: 20px; background: #f0f9ff; border-left: 4px solid #0ea5e9; border-radius: 8px;">
              <strong style="color: #0ea5e9;">Notes:</strong><br/>
              <p style="color: #334155; margin-top: 10px;">${purchase.notes}</p>
            </div>
            ` : ''}

            ${(purchase.paymentStatus && purchase.paymentStatus !== 'unpaid') ? `
            <div style="margin-top: 30px; padding: 20px; background: #d1fae5; border-left: 4px solid #10b981; border-radius: 8px;">
              <strong style="color: #10b981;">💰 Payment Information</strong><br/>
              <div style="margin-top: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                  <p style="color: #666; font-size: 12px; margin: 0;">Status</p>
                  <p style="color: #1a1a1a; font-weight: 600; margin: 5px 0 0;">${purchase.paymentStatus === 'paid' ? '✓ Fully Paid' : '◐ Partially Paid'}</p>
                </div>
                <div>
                  <p style="color: #666; font-size: 12px; margin: 0;">Amount Paid</p>
                  <p style="color: #10b981; font-weight: bold; margin: 5px 0 0;">${formatCurrency(purchase.amountPaid || 0, true)}</p>
                </div>
                ${purchase.paymentStatus !== 'paid' ? `
                <div>
                  <p style="color: #666; font-size: 12px; margin: 0;">Balance Due</p>
                  <p style="color: #ef4444; font-weight: bold; margin: 5px 0 0;">${formatCurrency((purchase.totalAmount || purchase.total || 0) - (purchase.amountPaid || 0), true)}</p>
                </div>
                ` : ''}
              </div>
            </div>
            ` : ''}

            <div class="footer">
              <p>For questions about this purchase order, please contact us at ${storeEmail || storePhone || 'our office'}</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }
    
    // Classic Template
    if (template === 'classic') {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Purchase Order ${poNum}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Georgia', serif;
              padding: 40px; 
              background: #fafafa;
              color: #2c2c2c;
            }
            .invoice-container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 50px;
              border: 2px solid #d4af37;
            }
            .header { 
              text-align: center;
              padding-bottom: 30px;
              border-bottom: 3px double #d4af37;
              margin-bottom: 40px;
            }
            .logo {
              width: 150px;
              height: 150px;
              object-fit: contain;
              margin: 0 auto 20px;
              display: block;
              border: 3px solid #d4af37;
              padding: 10px;
              background: white;
            }
            .header h1 {
              color: #2c2c2c;
              font-size: 32px;
              margin-bottom: 10px;
              font-weight: 400;
              letter-spacing: 2px;
            }
            .header .slogan {
              color: #d4af37;
              font-style: italic;
              font-size: 16px;
              margin-bottom: 15px;
            }
            .header .contact-info {
              font-size: 13px;
              color: #666;
              line-height: 1.6;
            }
            .invoice-title {
              text-align: center;
              margin: 30px 0;
            }
            .invoice-title h2 {
              font-size: 36px;
              color: #d4af37;
              font-weight: 400;
              letter-spacing: 3px;
              margin-bottom: 10px;
            }
            .invoice-title .invoice-number {
              font-size: 18px;
              color: #2c2c2c;
              font-weight: 600;
            }
            .details-section {
              display: flex;
              justify-content: space-between;
              margin: 40px 0;
              gap: 60px;
            }
            .section-title {
              font-size: 12px;
              font-weight: 600;
              color: #d4af37;
              text-transform: uppercase;
              margin-bottom: 15px;
              letter-spacing: 1.5px;
              border-bottom: 1px solid #d4af37;
              padding-bottom: 5px;
            }
            .detail-text {
              font-size: 15px;
              line-height: 1.8;
              color: #2c2c2c;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 40px 0;
            }
            th { 
              background: #2c2c2c;
              color: #d4af37;
              padding: 15px 10px;
              text-align: left;
              font-weight: 600;
              font-size: 13px;
              text-transform: uppercase;
              letter-spacing: 1px;
              border-bottom: 3px solid #d4af37;
            }
            td {
              padding: 15px 10px;
              border-bottom: 1px solid #e0e0e0;
              font-size: 15px;
            }
            .totals { 
              margin-top: 40px;
              text-align: right;
            }
            .grand-total {
              font-size: 22px;
              font-weight: bold;
              color: #d4af37;
              padding: 20px;
              background: #2c2c2c;
              border: 3px double #d4af37;
              margin-top: 20px;
            }
            .footer {
              margin-top: 60px;
              padding-top: 30px;
              border-top: 3px double #d4af37;
              text-align: center;
              color: #666;
              font-size: 13px;
              font-style: italic;
            }
            @media print {
              body { padding: 20px; background: white; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="header">
              ${storeLogo ? `<img src="${storeLogo}" alt="${storeName}" class="logo">` : ''}
              <h1>${storeName}</h1>
              ${storeSlogan ? `<div class="slogan">"${storeSlogan}"</div>` : ''}
              <div class="contact-info">
                ${storeWebsite ? `${storeWebsite}<br/>` : ''}
                ${storePhone ? `${storePhone} • ` : ''}${storeEmail ? `${storeEmail}` : ''}<br/>
                ${storeTaxNumber ? `Tax Registration: ${storeTaxNumber}` : ''}
              </div>
            </div>
            
            <div class="invoice-title">
              <h2>PURCHASE ORDER</h2>
              <div class="invoice-number">${poNum}</div>
              <p style="color: #999; font-size: 14px; margin-top: 10px;">${new Date(purchase.orderDate || '').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            
            <div class="details-section">
              <div style="flex: 1;">
                <div class="section-title">Supplier</div>
                <div class="detail-text">
                  <strong style="font-size: 18px;">${supplier?.name || 'N/A'}</strong><br/>
                  ${supplier?.contactPerson || ''}<br/>
                  ${supplier?.email || ''}<br/>
                  ${supplier?.phone || ''}
                </div>
              </div>
              ${purchase.expectedDeliveryDate ? `
              <div style="flex: 1;">
                <div class="section-title">Expected Delivery</div>
                <div class="detail-text">
                  <strong style="font-size: 18px;">${new Date(purchase.expectedDeliveryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                </div>
              </div>
              ` : ''}
            </div>

            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th style="text-align: center; width: 100px;">Quantity</th>
                  <th style="text-align: right; width: 150px;">Unit Price</th>
                  <th style="text-align: right; width: 150px;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="totals">
              <div class="grand-total">AMOUNT: ${formatCurrency(purchase.totalCost || purchase.totalAmount || purchase.total || 0, true)}</div>
            </div>

            ${purchase.notes ? `
            <div style="margin-top: 40px; padding: 20px; border: 1px solid #d4af37; border-radius: 5px;">
              <strong style="color: #d4af37;">Notes:</strong><br/>
              <p style="color: #2c2c2c; margin-top: 10px; line-height: 1.8;">${purchase.notes}</p>
            </div>
            ` : ''}

            ${(purchase.paymentStatus && purchase.paymentStatus !== 'unpaid') ? `
            <div style="margin-top: 30px; padding: 20px; border: 2px solid #10b981; border-radius: 5px; background: #f0fdf4;">
              <strong style="color: #10b981;">💰 Payment Information</strong><br/>
              <div style="margin-top: 15px; color: #2c2c2c; line-height: 2;">
                <p><strong>Status:</strong> ${purchase.paymentStatus === 'paid' ? '✓ Fully Paid' : '◐ Partially Paid'}</p>
                <p><strong>Amount Paid:</strong> <span style="color: #10b981; font-weight: bold;">${formatCurrency(purchase.amountPaid || 0, true)}</span></p>
                ${purchase.paymentStatus !== 'paid' ? `<p><strong>Balance Due:</strong> <span style="color: #ef4444; font-weight: bold;">${formatCurrency((purchase.totalAmount || purchase.total || 0) - (purchase.amountPaid || 0), true)}</span></p>` : ''}
              </div>
            </div>
            ` : ''}

            <div class="footer">
              <p>Thank you for your service.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }
    
    // Vibrant Template - default
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Order ${poNum}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Helvetica Neue', Arial, sans-serif;
            padding: 40px; 
            background: linear-gradient(135deg, #fff5eb 0%, #fef3f2 100%);
            color: #1a1a1a;
          }
          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
          }
          .header-banner {
            background: linear-gradient(135deg, #f97316 0%, #ea580c 50%, #9333ea 100%);
            padding: 40px;
            color: white;
            position: relative;
            overflow: hidden;
          }
          .header-banner::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -10%;
            width: 300px;
            height: 300px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 50%;
          }
          .header-content {
            position: relative;
            z-index: 1;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .logo-section {
            display: flex;
            align-items: center;
            gap: 20px;
          }
          .logo {
            width: 150px;
            height: 150px;
            object-fit: contain;
            background: white;
            padding: 10px;
            border-radius: 15px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
          }
          .store-details h1 {
            font-size: 32px;
            margin-bottom: 8px;
            font-weight: 700;
          }
          .store-details p {
            font-size: 14px;
            opacity: 0.95;
            margin: 3px 0;
          }
          .invoice-badge {
            background: white;
            color: #f97316;
            padding: 20px 30px;
            border-radius: 15px;
            text-align: right;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
          }
          .invoice-badge h2 {
            font-size: 28px;
            margin-bottom: 8px;
            color: #f97316;
          }
          .invoice-badge .number {
            font-size: 20px;
            font-weight: bold;
            color: #1a1a1a;
          }
          .content-area {
            padding: 40px;
          }
          .details-row {
            display: flex;
            gap: 40px;
            margin-bottom: 40px;
          }
          .detail-box {
            flex: 1;
            background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
            padding: 20px;
            border-radius: 12px;
            border-left: 4px solid #f97316;
          }
          .detail-box h3 {
            color: #f97316;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 12px;
            font-weight: 700;
          }
          .detail-box p {
            font-size: 15px;
            line-height: 1.6;
            color: #4a4a4a;
          }
          .detail-box strong {
            font-size: 17px;
            color: #1a1a1a;
            display: block;
            margin-bottom: 5px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 30px 0;
            border-radius: 12px;
            overflow: hidden;
          }
          th { 
            background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
            color: white;
            padding: 16px 12px;
            text-align: left;
            font-weight: 700;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          td {
            padding: 14px 12px;
            border-bottom: 1px solid #fee2e2;
            font-size: 15px;
          }
          tbody tr:hover {
            background: #fff7ed;
          }
          .totals { 
            margin-top: 40px;
            text-align: right;
          }
          .grand-total {
            background: linear-gradient(135deg, #f97316 0%, #9333ea 100%);
            color: white;
            padding: 20px 30px;
            border-radius: 12px;
            font-size: 22px;
            font-weight: bold;
            display: inline-block;
          }
          .footer {
            margin-top: 50px;
            padding: 30px;
            background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
            border-radius: 12px;
            text-align: center;
          }
          .footer p {
            color: #666;
            font-size: 14px;
            line-height: 1.6;
          }
          @media print {
            body { padding: 0; background: white; }
            .invoice-container { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header-banner">
            <div class="header-content">
              <div class="logo-section">
                ${storeLogo ? `<img src="${storeLogo}" alt="${storeName}" class="logo">` : ''}
                <div class="store-details">
                  <h1>${storeName}</h1>
                  ${storeSlogan ? `<p style="font-style: italic; font-size: 16px;">"${storeSlogan}"</p>` : ''}
                  ${storeWebsite ? `<p>🌐 ${storeWebsite}</p>` : ''}
                  ${storePhone ? `<p>📞 ${storePhone}</p>` : ''}
                  ${storeEmail ? `<p>📧 ${storeEmail}</p>` : ''}
                  ${storeTaxNumber ? `<p>🔖 Tax: ${storeTaxNumber}</p>` : ''}
                </div>
              </div>
              <div class="invoice-badge">
                <h2>PURCHASE ORDER</h2>
                <div class="number">${poNum}</div>
                <p style="font-size: 13px; color: #666; margin-top: 8px;">${new Date(purchase.orderDate || '').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
          </div>
          
          <div class="content-area">
            <div class="details-row">
              <div class="detail-box">
                <h3>Supplier</h3>
                <strong>${supplier?.name || 'N/A'}</strong>
                <p>
                  ${supplier?.contactPerson ? `👤 ${supplier.contactPerson}<br/>` : ''}
                  ${supplier?.email ? `📧 ${supplier.email}<br/>` : ''}
                  ${supplier?.phone ? `📱 ${supplier.phone}` : ''}
                </p>
              </div>
              ${purchase.expectedDeliveryDate ? `
              <div class="detail-box" style="background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); border-left-color: #9333ea;">
                <h3 style="color: #9333ea;">Expected Delivery</h3>
                <strong>${new Date(purchase.expectedDeliveryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
              </div>
              ` : ''}
            </div>

            <table>
              <thead>
                <tr>
                  <th>Product Description</th>
                  <th style="text-align: center; width: 100px;">Qty</th>
                  <th style="text-align: right; width: 150px;">Price</th>
                  <th style="text-align: right; width: 150px;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="totals">
              <div class="grand-total">TOTAL AMOUNT: ${formatCurrency(purchase.totalCost || purchase.totalAmount || purchase.total || 0, true)}</div>
            </div>

            ${purchase.notes ? `
            <div style="margin-top: 40px; padding: 25px; background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border-left: 4px solid #f97316; border-radius: 12px;">
              <h3 style="color: #f97316; font-size: 16px; margin-bottom: 10px;">Notes</h3>
              <p style="color: #4a4a4a; line-height: 1.6;">${purchase.notes}</p>
            </div>
            ` : ''}

            ${(purchase.paymentStatus && purchase.paymentStatus !== 'unpaid') ? `
            <div style="margin-top: 30px; padding: 25px; background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-left: 4px solid #10b981; border-radius: 12px;">
              <h3 style="color: #10b981; font-size: 16px; margin-bottom: 15px;">💰 Payment Information</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                  <p style="color: #666; font-size: 12px; margin-bottom: 5px;">Status</p>
                  <p style="color: #1a1a1a; font-weight: 600; font-size: 15px;">${purchase.paymentStatus === 'paid' ? '✓ Fully Paid' : '◐ Partially Paid'}</p>
                </div>
                <div>
                  <p style="color: #666; font-size: 12px; margin-bottom: 5px;">Amount Paid</p>
                  <p style="color: #10b981; font-weight: bold; font-size: 15px;">${formatCurrency(purchase.amountPaid || 0, true)}</p>
                </div>
                ${purchase.paymentStatus !== 'paid' ? `
                <div>
                  <p style="color: #666; font-size: 12px; margin-bottom: 5px;">Balance Due</p>
                  <p style="color: #ef4444; font-weight: bold; font-size: 15px;">${formatCurrency((purchase.totalAmount || purchase.total || 0) - (purchase.amountPaid || 0), true)}</p>
                </div>
                ` : ''}
                ${purchase.paymentDate ? `
                <div>
                  <p style="color: #666; font-size: 12px; margin-bottom: 5px;">Last Payment</p>
                  <p style="color: #1a1a1a; font-weight: 600; font-size: 15px;">${new Date(purchase.paymentDate).toLocaleDateString()}</p>
                </div>
                ` : ''}
              </div>
            </div>
            ` : ''}

            <div class="footer">
              <p>Questions? Contact us at ${storeEmail || storePhone || 'our office'}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handleDownloadPO = async (purchase: Purchase) => {
    try {
      const html = generatePOHTML(purchase);
      const container = document.createElement('div');
      container.innerHTML = html;
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      document.body.appendChild(container);

      const canvas = await html2canvas(container, { scale: 2 });
      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`PO-${purchase.poNumber}.pdf`);
      toast({ title: "Success", description: "Purchase order downloaded as PDF" });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
    }
  };

  const handleSharePO = async (purchase: Purchase) => {
    try {
      // Generate PDF
      const html = generatePOHTML(purchase);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);

      const canvas = await html2canvas(tempDiv, { scale: 2 });
      document.body.removeChild(tempDiv);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      // Get PDF as blob
      const pdfBlob = pdf.output('blob');
      const pdfFile = new File([pdfBlob], `PO-${purchase.poNumber}.pdf`, { type: 'application/pdf' });
      
      if (navigator.share && isMobile) {
        try {
          await navigator.share({
            title: `Purchase Order ${purchase.poNumber}`,
            text: `PO for ${suppliers.find(s => s.id === purchase.supplierId)?.name}`,
            files: [pdfFile]
          });
          toast({ title: "Success", description: "Purchase order PDF shared" });
        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            console.error('Error sharing:', error);
            // Fallback to download
            pdf.save(`PO-${purchase.poNumber}.pdf`);
            toast({ title: "Downloaded", description: "Purchase order PDF downloaded" });
          }
        }
      } else {
        // Desktop fallback - download PDF
        pdf.save(`PO-${purchase.poNumber}.pdf`);
        toast({ title: "Downloaded", description: "Purchase order PDF downloaded" });
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
    }
  };

  const handlePrintPO = (purchase: Purchase) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(generatePOHTML(purchase));
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownloadPDF = async (purchase: Purchase) => {
    try {
      const html = generatePOHTML(purchase);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);
      
      const canvas = await html2canvas(tempDiv.querySelector('.invoice-container') as HTMLElement);
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`PO-${purchase.invoiceNumber || purchase.poNumber}.pdf`);
      
      document.body.removeChild(tempDiv);
      toast({ title: "Success", description: "PDF downloaded successfully" });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
    }
  };

  const handleSendEmail = (purchase: Purchase) => {
    const supplier = suppliers.find(s => s.id === purchase.supplierId);
    const subject = `Purchase Order ${purchase.invoiceNumber || purchase.poNumber}`;
    const body = `Dear ${supplier?.name},\n\nPlease find attached Purchase Order ${purchase.invoiceNumber || purchase.poNumber}.\n\nOrder Details:\nTotal Amount: $${purchase.totalAmount.toFixed(2)}\nExpected Delivery: ${purchase.expectedDeliveryDate ? new Date(purchase.expectedDeliveryDate).toLocaleDateString() : 'Not set'}\n\nItems:\n${purchase.items.map(item => {
      const material = rawMaterials.find(m => m.id === item.rawMaterialId);
      return `- ${material?.name}: ${item.quantity} ${material?.unit} @ $${item.unitPrice}`;
    }).join('\n')}\n\nBest regards,\n${storeProfile?.name || 'Your Store'}`;
    
    const mailtoLink = `mailto:${supplier?.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
  };

  const handleSendWhatsApp = (purchase: Purchase) => {
    const supplier = suppliers.find(s => s.id === purchase.supplierId);
    const message = `*Purchase Order ${purchase.invoiceNumber || purchase.poNumber}*\n\nDear ${supplier?.name},\n\nOrder Details:\n💰 Total Amount: $${purchase.totalAmount.toFixed(2)}\n📅 Expected Delivery: ${purchase.expectedDeliveryDate ? new Date(purchase.expectedDeliveryDate).toLocaleDateString() : 'Not set'}\n\n*Items:*\n${purchase.items.map(item => {
      const material = rawMaterials.find(m => m.id === item.rawMaterialId);
      return `• ${material?.name}: ${item.quantity} ${material?.unit} @ $${item.unitPrice} = $${(item.quantity * item.unitPrice).toFixed(2)}`;
    }).join('\n')}\n\nThank you!\n${storeProfile?.name || 'Your Store'}`;
    
    const whatsappUrl = `https://wa.me/${supplier?.phone?.replace(/\D/g, '') || ''}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const addItem = () => {
    setNewPurchase({
      ...newPurchase,
      items: [
        ...newPurchase.items,
        { rawMaterialId: '', quantity: '' as any, unitPrice: '' as any, receivedQuantity: 0 }
      ]
    });
  };

  const removeItem = (index: number) => {
    setNewPurchase({
      ...newPurchase,
      items: newPurchase.items.filter((_, i) => i !== index)
    });
  };

  const updateItem = (index: number, field: keyof PurchaseItem, value: any) => {
    const updated = [...newPurchase.items];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-fill unit price from material's cost
    if (field === 'rawMaterialId' && value) {
      const material = rawMaterials.find(m => m.id === value);
      if (material) {
        updated[index].unitPrice = material.costPerUnit;
      }
    }
    
    setNewPurchase({ ...newPurchase, items: updated });
  };

  const handleAddPurchase = async () => {
    if (!newPurchase.supplierId || newPurchase.items.length === 0 || !user?.storeId) {
      toast({ title: "Error", description: "Supplier and at least one item required", variant: "destructive" });
      return;
    }

    try {
      const db = getFirestore();
      const invoiceNumber = await generatePONumber();
      
      // Ensure all numeric values are properly converted
      const normalizedItems = newPurchase.items.map(item => {
        const unitPrice = typeof item.unitPrice === 'number' ? item.unitPrice : (parseFloat(item.unitPrice as any) || 0);
        return {
          ...item,
          quantity: typeof item.quantity === 'number' ? item.quantity : (parseFloat(item.quantity as any) || 0),
          unitPrice,
          unitCost: unitPrice, // Ensure unitCost is also set for compatibility
        };
      });
      
      const subtotal = normalizedItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const taxAmount = newPurchase.taxType !== 'none' ? subtotal * (newPurchase.taxRate / 100) : 0;
      const totalAmount = subtotal + taxAmount;

      const purchaseData = {
        poNumber: invoiceNumber,
        invoiceNumber,
        supplierId: newPurchase.supplierId,
        orderDate: new Date().toISOString(),
        expectedDeliveryDate: newPurchase.expectedDeliveryDate,
        status: 'draft' as const,
        items: normalizedItems,
        subtotal,
        taxType: newPurchase.taxType,
        taxRate: newPurchase.taxRate,
        vat: taxAmount,
        totalAmount,
        totalCost: totalAmount,
        notes: newPurchase.notes,
        paymentStatus: 'unpaid' as const,
        amountPaid: 0,
        storeId: user.storeId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'purchases'), purchaseData);
      setPurchases([{ id: docRef.id, ...purchaseData }, ...purchases]);

      // Audit log
      await logAction(
        user.id,
        user.name,
        user.role,
        'create',
        'purchase',
        docRef.id,
        { newValue: purchaseData },
        user.storeId
      );

      setNewPurchase({
        supplierId: '',
        supplierName: '',
        supplierContact: '',
        supplierEmail: '',
        expectedDeliveryDate: '',
        notes: '',
        items: [],
        taxType: 'none',
        taxRate: 0,
      });
      setIsAddingPurchase(false);
      toast({ title: "Success", description: `Purchase order ${invoiceNumber} created!` });
    } catch (error) {
      console.error('Error adding purchase:', error);
      toast({ title: "Error", description: "Failed to create purchase order", variant: "destructive" });
    }
  };

  const handleUpdateStatus = async (purchaseId: string, newStatus: Purchase['status']) => {
    try {
      const db = getFirestore();
      const purchaseRef = doc(db, 'purchases', purchaseId);
      
      await updateDoc(purchaseRef, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });

      setPurchases(purchases.map(p => 
        p.id === purchaseId ? { ...p, status: newStatus, updatedAt: new Date().toISOString() } : p
      ));

      if (user) {
        await logAction(
          user.id,
          user.name,
          user.role,
          'update',
          'purchase',
          purchaseId,
          { oldValue: { status: purchases.find(p => p.id === purchaseId)?.status }, newValue: { status: newStatus } },
          user.storeId
        );
      }

      toast({ title: "Success", description: "Purchase order status updated!" });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const handleReceivePurchase = async () => {
    if (!receivingPurchase || !user?.storeId) return;

    try {
      const db = getFirestore();
      const purchaseRef = doc(db, 'purchases', receivingPurchase.id);

      // Update purchase status and received date
      await updateDoc(purchaseRef, {
        status: 'received',
        receivedDate: new Date().toISOString(),
        items: receivingPurchase.items,
        updatedAt: new Date().toISOString(),
      });

      // Update raw material stock levels and costs
      let updatedCount = 0;
      let createdCount = 0;
      
      for (const item of receivingPurchase.items) {
        const receivedQty = item.receivedQuantity || 0;
        if (receivedQty <= 0) continue;
        
        let material = rawMaterials.find(m => m.id === item.rawMaterialId);
        const itemUnitCost = item.unitCost || item.unitPrice || 0;
        
        // If material doesn't exist, create it
        if (!material) {
          console.log(`Creating new raw material from purchase: ${item.materialName}`);
          
          const newMaterialData = {
            name: item.materialName || 'Unknown Material',
            category: 'Imported from Purchase',
            unit: item.unit || 'units',
            currentStock: receivedQty,
            minimumStock: 0,
            reorderPoint: 0,
            costPerUnit: itemUnitCost,
            supplier: receivingPurchase.supplierName || '',
            supplierId: receivingPurchase.supplierId || '',
            description: `Auto-imported from purchase ${receivingPurchase.invoiceNumber || receivingPurchase.id}`,
            storeId: user.storeId,
            createdBy: user.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          const newMaterialRef = await addDoc(collection(db, 'rawMaterials'), newMaterialData);
          
          // Update the purchase item with the new material ID
          const updatedItems = receivingPurchase.items.map(i => 
            i === item ? { ...i, rawMaterialId: newMaterialRef.id } : i
          );
          await updateDoc(purchaseRef, { items: updatedItems });
          
          createdCount++;
        } else {
          // Update existing material
          const materialRef = doc(db, 'rawMaterials', item.rawMaterialId);
          const newStock = material.currentStock + receivedQty;
          
          // Calculate weighted average cost
          const currentValue = material.currentStock * (material.costPerUnit || 0);
          const newValue = receivedQty * itemUnitCost;
          const totalValue = currentValue + newValue;
          
          // If this is the first stock (material.currentStock was 0), use the item unit cost directly
          // Otherwise use weighted average
          let newCostPerUnit: number;
          if (material.currentStock === 0) {
            newCostPerUnit = itemUnitCost;
          } else {
            newCostPerUnit = newStock > 0 ? totalValue / newStock : itemUnitCost;
          }
          
          console.log(`Updating ${material.name}: Stock ${material.currentStock} + ${receivedQty} = ${newStock}, Cost ${(material.costPerUnit || 0).toFixed(4)} → ${newCostPerUnit.toFixed(4)} (Item Cost: ${itemUnitCost.toFixed(4)})`);
          
          // Update stock and cost
          await updateDoc(materialRef, {
            currentStock: newStock,
            costPerUnit: newCostPerUnit,
            unit: item.unit || material.unit, // Update unit if provided in purchase
            updatedAt: new Date().toISOString(),
          });
          updatedCount++;
        }
      }

      // Refetch raw materials to ensure sync
      const rawMaterialsRef = collection(db, 'rawMaterials');
      const rawMaterialsQuery = query(rawMaterialsRef, where('storeId', '==', user.storeId));
      const rawMaterialsSnapshot = await getDocs(rawMaterialsQuery);
      const rawMaterialsList: RawMaterial[] = rawMaterialsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RawMaterial));
      setRawMaterials(rawMaterialsList);

      // Refetch purchases to update UI
      const purchasesRef = collection(db, 'purchases');
      const purchasesQuery = query(purchasesRef, where('storeId', '==', user.storeId));
      const purchasesSnapshot = await getDocs(purchasesQuery);
      const purchasesList: Purchase[] = purchasesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Purchase));
      setPurchases(purchasesList.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()));

      // Audit log
      await logAction(
        user.id,
        user.name,
        user.role,
        'update',
        'purchase',
        receivingPurchase.id,
        { oldValue: purchases.find(p => p.id === receivingPurchase.id), newValue: receivingPurchase },
        user.storeId
      );

      setReceivingPurchase(null);
      
      const successMessage = createdCount > 0 
        ? `Purchase received! ${updatedCount} material(s) updated, ${createdCount} new material(s) created.`
        : `Purchase received! ${updatedCount} material(s) stock updated.`;
      
      toast({ 
        title: "Success", 
        description: successMessage
      });
    } catch (error) {
      console.error('Error receiving purchase:', error);
      toast({ title: "Error", description: "Failed to receive purchase order", variant: "destructive" });
    }
  };

  const handlePayPurchase = async () => {
    if (!payingPurchase || !user?.storeId) return;

    try {
      const db = getFirestore();
      const purchaseRef = doc(db, 'purchases', payingPurchase.id);

      const currentPaid = payingPurchase.amountPaid || 0;
      const newAmountPaid = currentPaid + paymentData.amountPaid;
      const totalAmount = payingPurchase.totalAmount || payingPurchase.total || 0;

      let paymentStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid';
      if (newAmountPaid >= totalAmount) {
        paymentStatus = 'paid';
      } else if (newAmountPaid > 0) {
        paymentStatus = 'partial';
      }

      // Create payment record
      const paymentRecord = {
        id: `PMT-${Date.now()}`,
        amount: paymentData.amountPaid,
        date: paymentData.paymentDate,
        method: paymentData.paymentMethod,
        notes: paymentData.paymentNotes,
        recordedBy: user.name,
        recordedAt: new Date().toISOString(),
      };

      const existingHistory = payingPurchase.paymentHistory || [];
      const updatedHistory = [...existingHistory, paymentRecord];

      await updateDoc(purchaseRef, {
        paymentStatus,
        amountPaid: newAmountPaid,
        paymentDate: paymentData.paymentDate,
        paymentMethod: paymentData.paymentMethod,
        paymentNotes: paymentData.paymentNotes,
        paymentHistory: updatedHistory,
        updatedAt: new Date().toISOString(),
      });

      // Refetch purchases
      const purchasesRef = collection(db, 'purchases');
      const purchasesQuery = query(purchasesRef, where('storeId', '==', user.storeId));
      const purchasesSnapshot = await getDocs(purchasesQuery);
      const purchasesList: Purchase[] = purchasesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Purchase));
      setPurchases(purchasesList.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()));

      // Audit log
      await logAction(
        user.id,
        user.name,
        user.role,
        'update',
        'purchase_payment',
        payingPurchase.id,
        { 
          oldValue: { amountPaid: currentPaid, paymentStatus: payingPurchase.paymentStatus },
          newValue: { amountPaid: newAmountPaid, paymentStatus, ...paymentData }
        },
        user.storeId
      );

      setPayingPurchase(null);
      setPaymentData({
        amountPaid: 0,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'cash',
        paymentNotes: '',
      });

      toast({ 
        title: "Success", 
        description: `Payment recorded! Status: ${paymentStatus === 'paid' ? 'Fully Paid' : paymentStatus === 'partial' ? 'Partially Paid' : 'Unpaid'}` 
      });

      // Show voucher after successful payment
      const updatedPurchase = purchasesList.find(p => p.id === payingPurchase.id);
      if (updatedPurchase) {
        setViewingPaymentVoucher({ purchase: updatedPurchase, payment: paymentRecord });
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      toast({ title: "Error", description: "Failed to record payment", variant: "destructive" });
    }
  };

  const generatePaymentVoucherHTML = (purchase: Purchase, payment: any) => {
    const supplier = suppliers.find(s => s.id === purchase.supplierId);
    return `
      <div class="voucher-container" style="padding: 40px; font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0; color: #1a1a1a; font-size: 28px;">PAYMENT VOUCHER</h1>
          <p style="margin: 5px 0; color: #666; font-size: 14px;">Voucher #${payment.id}</p>
        </div>

        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
              <p style="margin: 0; color: #666; font-size: 12px;">Date</p>
              <p style="margin: 5px 0 15px; font-weight: 600;">${new Date(payment.date).toLocaleDateString()}</p>
              <p style="margin: 0; color: #666; font-size: 12px;">Purchase Order</p>
              <p style="margin: 5px 0 15px; font-weight: 600;">${purchase.invoiceNumber || purchase.purchaseOrderNumber}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; color: #666; font-size: 12px;">Payment Method</p>
              <p style="margin: 5px 0 15px; font-weight: 600; text-transform: capitalize;">${payment.method}</p>
              <p style="margin: 0; color: #666; font-size: 12px;">Recorded By</p>
              <p style="margin: 5px 0 15px; font-weight: 600;">${payment.recordedBy}</p>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 25px;">
          <h3 style="margin: 0 0 15px; color: #1a1a1a; font-size: 16px;">Supplier Information</h3>
          <p style="margin: 5px 0;"><strong>Name:</strong> ${supplier?.name || purchase.supplierName || 'N/A'}</p>
          ${supplier?.phone ? `<p style="margin: 5px 0;"><strong>Phone:</strong> ${supplier.phone}</p>` : ''}
          ${supplier?.email ? `<p style="margin: 5px 0;"><strong>Email:</strong> ${supplier.email}</p>` : ''}
        </div>

        <div style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <div>
              <p style="margin: 0; color: #666; font-size: 12px;">Purchase Total</p>
              <p style="margin: 5px 0; font-size: 18px; font-weight: 600;">$${(purchase.totalAmount || purchase.total || 0).toFixed(2)}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; color: #666; font-size: 12px;">Previous Payments</p>
              <p style="margin: 5px 0; font-size: 18px; font-weight: 600;">$${((purchase.amountPaid || 0) - payment.amount).toFixed(2)}</p>
            </div>
          </div>
          <div style="border-top: 2px dashed #e5e7eb; padding-top: 15px; text-align: center;">
            <p style="margin: 0; color: #666; font-size: 14px;">PAYMENT AMOUNT</p>
            <p style="margin: 10px 0; font-size: 32px; font-weight: bold; color: #10b981;">$${payment.amount.toFixed(2)}</p>
          </div>
          <div style="border-top: 2px dashed #e5e7eb; padding-top: 15px; margin-top: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 16px; font-weight: 600;">Total Paid:</span>
              <span style="font-size: 18px; font-weight: bold;">$${(purchase.amountPaid || 0).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
              <span style="font-size: 16px; font-weight: 600;">Balance Due:</span>
              <span style="font-size: 18px; font-weight: bold; color: #ef4444;">$${((purchase.totalAmount || purchase.total || 0) - (purchase.amountPaid || 0)).toFixed(2)}</span>
            </div>
          </div>
        </div>

        ${payment.notes ? `
          <div style="margin-bottom: 25px;">
            <h3 style="margin: 0 0 10px; color: #1a1a1a; font-size: 14px;">Notes</h3>
            <p style="margin: 0; color: #666; background: #f9fafb; padding: 15px; border-radius: 6px;">${payment.notes}</p>
          </div>
        ` : ''}

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #999; font-size: 11px; text-align: center;">
            Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>
    `;
  };

  const downloadPaymentVoucher = async (purchase: Purchase, payment: any) => {
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = generatePaymentVoucherHTML(purchase, payment);
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);
      
      const canvas = await html2canvas(tempDiv.querySelector('.voucher-container') as HTMLElement);
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Payment-Voucher-${payment.id}.pdf`);
      
      document.body.removeChild(tempDiv);
      toast({ title: "Success", description: "Payment voucher downloaded" });
    } catch (error) {
      console.error('Error generating voucher:', error);
      toast({ title: "Error", description: "Failed to generate voucher", variant: "destructive" });
    }
  };

  const printPaymentVoucher = (purchase: Purchase, payment: any) => {
    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Payment Voucher</title></head><body>');
      printWindow.document.write(generatePaymentVoucherHTML(purchase, payment));
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  const sharePaymentVoucher = async (purchase: Purchase, payment: any) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Payment Voucher ${payment.id}`,
          text: `Payment of $${payment.amount.toFixed(2)} recorded for PO ${purchase.invoiceNumber || purchase.purchaseOrderNumber}`,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      toast({ title: "Info", description: "Sharing not supported on this browser", variant: "default" });
    }
  };

  const handleDeletePurchase = async (purchaseId: string) => {
    const purchase = purchases.find(p => p.id === purchaseId);
    if (purchase?.status === 'received') {
      toast({ title: "Error", description: "Cannot delete received purchase orders", variant: "destructive" });
      return;
    }

    if (!confirm('Are you sure you want to delete this purchase order?')) return;

    try {
      const db = getFirestore();
      await deleteDoc(doc(db, 'purchases', purchaseId));
      const deletedPurchase = purchases.find(p => p.id === purchaseId);
      setPurchases(purchases.filter(p => p.id !== purchaseId));

      if (deletedPurchase && user) {
        await logAction(
          user.id,
          user.name,
          user.role,
          'delete',
          'purchase',
          purchaseId,
          { oldValue: deletedPurchase },
          user.storeId
        );
      }

      toast({ title: "Success", description: "Purchase order deleted!" });
    } catch (error) {
      console.error('Error deleting purchase:', error);
      toast({ title: "Error", description: "Failed to delete purchase order", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: Purchase['status']) => {
    const variants: Record<string, { variant: any; label: string }> = {
      draft: { variant: 'secondary', label: 'Draft' },
      sent: { variant: 'default', label: 'Sent' },
      confirmed: { variant: 'default', label: 'Confirmed' },
      received: { variant: 'default', label: 'Received' },
      returned: { variant: 'default', label: 'Returned' },
      cancelled: { variant: 'destructive', label: 'Cancelled' },
    };
    return <Badge variant={variants[status]?.variant || 'secondary'}>{variants[status]?.label || status}</Badge>;
  };

  const getPaymentBadge = (purchase: Purchase) => {
    const paymentStatus = purchase.paymentStatus || 'unpaid';
    const variants: Record<string, { variant: any; label: string; color: string }> = {
      paid: { variant: 'default', label: 'Paid', color: 'bg-green-100 text-green-800' },
      partial: { variant: 'secondary', label: 'Partial', color: 'bg-yellow-100 text-yellow-800' },
      unpaid: { variant: 'destructive', label: 'Unpaid', color: 'bg-red-100 text-red-800' },
    };
    
    if (purchase.status !== 'received') {
      return null; // Don't show payment status for non-received orders
    }
    
    return (
      <Badge className={variants[paymentStatus].color}>
        {variants[paymentStatus].label}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {isMobile ? <MobileHeader title="Purchase Orders" /> : null}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {!isMobile && <BackButton to="/admin/inventory" label="Back to Inventory" />}
            <h1 className="text-2xl font-bold">Purchase Orders</h1>
          </div>
          <Dialog open={isAddingPurchase} onOpenChange={setIsAddingPurchase}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Purchase Order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Purchase Order</DialogTitle>
                <DialogDescription>Order raw materials from supplier</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label htmlFor="supplierId">Supplier *</Label>
                      <Button 
                        type="button" 
                        variant="link" 
                        size="sm" 
                        className="text-xs h-auto p-0"
                        onClick={() => setIsCreatingNewSupplier(!isCreatingNewSupplier)}
                      >
                        {isCreatingNewSupplier ? "Select existing" : "+ Add new supplier"}
                      </Button>
                    </div>
                    
                    {!isCreatingNewSupplier ? (
                      <Select
                        value={newPurchase.supplierId}
                        onValueChange={(value) => setNewPurchase({ ...newPurchase, supplierId: value })}
                      >
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
                    ) : (
                      <div className="space-y-3 p-3 border rounded-md bg-gray-50">
                        <Input
                          placeholder="Supplier Name *"
                          value={newPurchase.supplierName || ''}
                          onChange={(e) => setNewPurchase(prev => ({ ...prev, supplierName: e.target.value }))}
                        />
                        <Input
                          placeholder="Contact Person *"
                          value={newPurchase.supplierContact || ''}
                          onChange={(e) => setNewPurchase(prev => ({ ...prev, supplierContact: e.target.value }))}
                        />
                        <Input
                          placeholder="Email (optional)"
                          type="email"
                          value={newPurchase.supplierEmail || ''}
                          onChange={(e) => setNewPurchase(prev => ({ ...prev, supplierEmail: e.target.value }))}
                        />
                        <Button 
                          type="button" 
                          size="sm" 
                          onClick={handleCreateInlineSupplier}
                          className="w-full"
                        >
                          Create Supplier
                        </Button>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="expectedDeliveryDate">Expected Delivery</Label>
                    <Input
                      id="expectedDeliveryDate"
                      type="date"
                      value={newPurchase.expectedDeliveryDate}
                      onChange={(e) => setNewPurchase(prev => ({ ...prev, expectedDeliveryDate: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Items Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Order Items *</Label>
                    <Button type="button" size="sm" onClick={addItem}>
                      <Plus className="h-4 w-4 mr-1" /> Add Item
                    </Button>
                  </div>
                  {newPurchase.items.map((item, index) => {
                    const material = rawMaterials.find(m => m.id === item.rawMaterialId);
                    const qty = typeof item.quantity === 'number' ? item.quantity : (parseFloat(item.quantity as any) || 0);
                    const price = typeof item.unitPrice === 'number' ? item.unitPrice : (parseFloat(item.unitPrice as any) || 0);
                    const lineTotal = qty * price;

                    return (
                      <div key={index} className="grid grid-cols-12 gap-2 mb-2 items-end">
                        <div className="col-span-5">
                          <Label className="text-xs">Raw Material</Label>
                          <Select
                            value={item.rawMaterialId}
                            onValueChange={(value) => updateItem(index, 'rawMaterialId', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select material" />
                            </SelectTrigger>
                            <SelectContent>
                              {rawMaterials.map(mat => (
                                <SelectItem key={mat.id} value={mat.id}>
                                  {mat.name} ({mat.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Quantity</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Enter quantity"
                            value={item.quantity === '' || item.quantity === 0 ? '' : item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', e.target.value === '' ? '' : parseFloat(e.target.value))}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Unit Price</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Enter price"
                            value={item.unitPrice === '' || item.unitPrice === 0 ? '' : item.unitPrice}
                            onChange={(e) => updateItem(index, 'unitPrice', e.target.value === '' ? '' : parseFloat(e.target.value))}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Total</Label>
                          <p className="text-sm font-medium">${lineTotal.toFixed(2)}</p>
                        </div>
                        <div className="col-span-1">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeItem(index)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {newPurchase.items.length > 0 && (
                    <div className="mt-2 p-3 bg-gray-100 rounded space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>${newPurchase.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0).toFixed(2)}</span>
                      </div>
                      {newPurchase.taxType !== 'none' && (
                        <div className="flex justify-between">
                          <span>Tax ({newPurchase.taxRate}%):</span>
                          <span>${(newPurchase.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) * (newPurchase.taxRate / 100)).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold border-t pt-2">
                        <span>Total Amount:</span>
                        <span>${calculateTotal(newPurchase.items, newPurchase.taxType, newPurchase.taxRate).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tax Type</Label>
                    <Select value={newPurchase.taxType} onValueChange={(value: any) => setNewPurchase({ ...newPurchase, taxType: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Tax</SelectItem>
                        <SelectItem value="VAT">VAT</SelectItem>
                        <SelectItem value="TTC">TTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newPurchase.taxType !== 'none' && (
                    <div>
                      <Label>Tax Rate (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={newPurchase.taxRate === 0 ? '' : newPurchase.taxRate}
                        onChange={(e) => setNewPurchase(prev => ({ ...prev, taxRate: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) }))}
                        placeholder="0.0"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={newPurchase.notes}
                    onChange={(e) => setNewPurchase(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes or special instructions..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingPurchase(false)}>Cancel</Button>
                <Button onClick={handleAddPurchase}>Create Purchase Order</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Purchase Orders List */}
        <div className="grid gap-4">
          {purchases.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ShoppingCart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No purchase orders yet. Create your first PO to get started.</p>
              </CardContent>
            </Card>
          ) : (
            purchases.map((purchase) => {
              const supplier = suppliers.find(s => s.id === purchase.supplierId);

              return (
                <Card key={purchase.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {purchase.invoiceNumber || purchase.poNumber || `PO-${purchase.id.slice(0, 8)}`}
                          {getStatusBadge(purchase.status)}
                          {getPaymentBadge(purchase)}
                        </CardTitle>
                        <CardDescription>
                          Supplier: {supplier?.name || 'Unknown'} | Order Date: {new Date(purchase.orderDate).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {purchase.status === 'draft' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Share2 className="h-4 w-4 mr-1" />
                                Send to Supplier
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Send Purchase Order</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleSendEmail(purchase)}>
                                <Mail className="h-4 w-4 mr-2" />
                                Email
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleSendWhatsApp(purchase)}>
                                <MessageCircle className="h-4 w-4 mr-2" />
                                WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDownloadPDF(purchase)}>
                                <Download className="h-4 w-4 mr-2" />
                                Download PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePrintPO(purchase)}>
                                <Printer className="h-4 w-4 mr-2" />
                                Print
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleUpdateStatus(purchase.id, 'sent')}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark as Sent
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {purchase.status === 'sent' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateStatus(purchase.id, 'confirmed')}
                          >
                            Mark Confirmed
                          </Button>
                        )}
                        {purchase.status === 'confirmed' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => setReceivingPurchase({ ...purchase, items: purchase.items.map(i => ({ ...i, receivedQuantity: i.quantity })) })}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Receive Items
                          </Button>
                        )}
                        {purchase.status === 'received' && (
                          <>
                            {(!purchase.paymentStatus || purchase.paymentStatus !== 'paid') && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  const remaining = (purchase.totalAmount || purchase.total || 0) - (purchase.amountPaid || 0);
                                  setPayingPurchase(purchase);
                                  setPaymentData({
                                    amountPaid: remaining,
                                    paymentDate: new Date().toISOString().split('T')[0],
                                    paymentMethod: 'cash',
                                    paymentNotes: '',
                                  });
                                }}
                              >
                                <DollarSign className="h-4 w-4 mr-1" />
                                Record Payment
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadPDF(purchase)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Download PDF
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePrintPO(purchase)}
                            >
                              <Printer className="h-4 w-4 mr-1" />
                              Print
                            </Button>
                          </>
                        )}
                        {purchase.status !== 'received' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateStatus(purchase.id, 'cancelled')}
                            title="Cancel Purchase"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        )}
                        {(purchase.status === 'returned' || purchase.status === 'cancelled') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeletePurchase(purchase.id)}
                            title="Delete returned/cancelled purchase"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-500">Total Amount</p>
                        <p className="font-bold text-lg">${purchase.totalAmount.toFixed(2)}</p>
                      </div>
                      {purchase.status === 'received' && (
                        <div>
                          <p className="text-sm text-gray-500">Amount Paid</p>
                          <p className="font-bold text-lg text-green-600">${(purchase.amountPaid || 0).toFixed(2)}</p>
                        </div>
                      )}
                      {purchase.status === 'received' && purchase.paymentStatus !== 'paid' && (
                        <div>
                          <p className="text-sm text-gray-500">Amount Due</p>
                          <p className="font-bold text-lg text-red-600">
                            ${((purchase.totalAmount || purchase.total || 0) - (purchase.amountPaid || 0)).toFixed(2)}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-gray-500">Items</p>
                        <p className="font-medium">{purchase.items.length} item(s)</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Expected Delivery</p>
                        <p className="font-medium">
                          {purchase.expectedDeliveryDate ? new Date(purchase.expectedDeliveryDate).toLocaleDateString() : 'Not set'}
                        </p>
                      </div>
                      {purchase.receivedDate && (
                        <div>
                          <p className="text-sm text-gray-500">Received Date</p>
                          <p className="font-medium">{new Date(purchase.receivedDate).toLocaleDateString()}</p>
                        </div>
                      )}
                      {purchase.paymentDate && (
                        <div>
                          <p className="text-sm text-gray-500">Payment Date</p>
                          <p className="font-medium">{new Date(purchase.paymentDate).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                    <div className="border-t pt-3">
                      <p className="text-sm font-semibold mb-2">Items:</p>
                      <div className="space-y-1">
                        {purchase.items.map((item, idx) => {
                          const material = rawMaterials.find(m => m.id === item.rawMaterialId);
                          return (
                            <div key={idx} className="text-sm flex justify-between">
                              <span>
                                {material?.name || 'Unknown'}: {item.quantity} {material?.unit} @ ${item.unitPrice}
                                {item.receivedQuantity > 0 && ` (Received: ${item.receivedQuantity})`}
                              </span>
                              <span className="font-medium">${(item.quantity * item.unitPrice).toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {purchase.notes && (
                      <div className="mt-3 p-2 bg-gray-50 rounded text-sm">
                        <span className="font-semibold">Notes:</span> {purchase.notes}
                      </div>
                    )}
                    {purchase.paymentHistory && purchase.paymentHistory.length > 0 && (
                      <div className="mt-3 border-t pt-3">
                        <p className="text-sm font-semibold mb-2">Payment History:</p>
                        <div className="space-y-2">
                          {purchase.paymentHistory.map((payment, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200">
                              <div className="flex-1">
                                <p className="text-sm font-medium">${payment.amount.toFixed(2)} - {payment.method}</p>
                                <p className="text-xs text-gray-600">
                                  {new Date(payment.date).toLocaleDateString()} by {payment.recordedBy}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setViewingPaymentVoucher({ purchase, payment })}
                                  title="View Voucher"
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Receive Purchase Dialog */}
        {receivingPurchase && (
          <Dialog open={!!receivingPurchase} onOpenChange={() => setReceivingPurchase(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Receive Purchase Order: {receivingPurchase.poNumber}</DialogTitle>
                <DialogDescription>Enter received quantities to update stock levels</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                {receivingPurchase.items.map((item, index) => {
                  const material = rawMaterials.find(m => m.id === item.rawMaterialId);
                  
                  return (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center border-b pb-2">
                      <div className="col-span-5">
                        <p className="font-medium">{material?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">Current stock: {material?.currentStock} {material?.unit}</p>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Ordered</Label>
                        <p className="font-medium">{item.quantity}</p>
                      </div>
                      <div className="col-span-3">
                        <Label className="text-xs">Received Qty</Label>
                        <Input
                          type="number"
                          min="0"
                          max={item.quantity}
                          step="0.01"
                          value={item.receivedQuantity}
                          onChange={(e) => {
                            const updated = [...receivingPurchase.items];
                            updated[index].receivedQuantity = parseFloat(e.target.value) || 0;
                            setReceivingPurchase({ ...receivingPurchase, items: updated });
                          }}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">New Stock</Label>
                        <p className="font-bold text-green-600">
                          {((material?.currentStock || 0) + item.receivedQuantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReceivingPurchase(null)}>Cancel</Button>
                <Button onClick={handleReceivePurchase}>Receive & Update Stock</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Payment Dialog */}
        {payingPurchase && (
          <Dialog open={!!payingPurchase} onOpenChange={() => setPayingPurchase(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Record Payment</DialogTitle>
                <DialogDescription>
                  Purchase Order: {payingPurchase.invoiceNumber || payingPurchase.poNumber}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded">
                  <div>
                    <p className="text-sm text-gray-500">Total Amount</p>
                    <p className="font-bold">${(payingPurchase.totalAmount || payingPurchase.total || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Already Paid</p>
                    <p className="font-bold text-green-600">${(payingPurchase.amountPaid || 0).toFixed(2)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">Amount Due</p>
                    <p className="font-bold text-red-600">
                      ${((payingPurchase.totalAmount || payingPurchase.total || 0) - (payingPurchase.amountPaid || 0)).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="paymentAmount">Payment Amount *</Label>
                  <Input
                    id="paymentAmount"
                    type="number"
                    min="0"
                    max={(payingPurchase.totalAmount || payingPurchase.total || 0) - (payingPurchase.amountPaid || 0)}
                    step="0.01"
                    value={paymentData.amountPaid || ''}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, amountPaid: e.target.value === '' ? 0 : parseFloat(e.target.value) }))}
                  />
                </div>

                <div>
                  <Label htmlFor="paymentDate">Payment Date *</Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={paymentData.paymentDate}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, paymentDate: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="paymentMethod">Payment Method *</Label>
                  <Select
                    value={paymentData.paymentMethod}
                    onValueChange={(value) => setPaymentData({ ...paymentData, paymentMethod: value })}
                  >
                    <SelectTrigger id="paymentMethod">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="mobile_payment">Mobile Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="paymentNotes">Notes (optional)</Label>
                  <Textarea
                    id="paymentNotes"
                    placeholder="Transaction reference, check number, etc."
                    value={paymentData.paymentNotes}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, paymentNotes: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPayingPurchase(null)}>Cancel</Button>
                <Button onClick={handlePayPurchase}>Record Payment</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Payment Voucher Dialog */}
        {viewingPaymentVoucher && (
          <Dialog open={!!viewingPaymentVoucher} onOpenChange={() => setViewingPaymentVoucher(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Payment Voucher - {viewingPaymentVoucher.payment.id}</DialogTitle>
                <DialogDescription>Payment receipt and details</DialogDescription>
              </DialogHeader>
              <div dangerouslySetInnerHTML={{ __html: generatePaymentVoucherHTML(viewingPaymentVoucher.purchase, viewingPaymentVoucher.payment) }} />
              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={() => printPaymentVoucher(viewingPaymentVoucher.purchase, viewingPaymentVoucher.payment)}>
                  <Printer className="h-4 w-4 mr-1" />
                  Print
                </Button>
                <Button variant="outline" onClick={() => downloadPaymentVoucher(viewingPaymentVoucher.purchase, viewingPaymentVoucher.payment)}>
                  <Download className="h-4 w-4 mr-1" />
                  Download PDF
                </Button>
                <Button variant="outline" onClick={() => sharePaymentVoucher(viewingPaymentVoucher.purchase, viewingPaymentVoucher.payment)}>
                  <Share2 className="h-4 w-4 mr-1" />
                  Share
                </Button>
                <Button onClick={() => setViewingPaymentVoucher(null)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </div>
  );
};

export default AdminPurchases;
