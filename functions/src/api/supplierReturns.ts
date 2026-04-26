import * as admin from 'firebase-admin';
import { Request, Response } from 'express';

const db = admin.firestore();

type SupplierReturnStatus =
	| 'draft'
	| 'submitted'
	| 'approved'
	| 'shipped'
	| 'received_by_supplier'
	| 'credited'
	| 'replaced'
	| 'rejected'
	| 'disputed';

interface AuthUser {
	uid: string;
	email?: string;
	name?: string;
}

interface ReturnItemInput {
	rawMaterialId?: string;
	materialName?: string;
	sku?: string;
	quantity?: number;
	unitCost?: number;
	unitPrice?: number;
	totalCost?: number;
	reason?: string;
	lotNumber?: string;
	condition?: string;
}

interface ReturnItem {
	rawMaterialId: string;
	materialName: string;
	sku: string;
	quantity: number;
	unitCost: number;
	totalCost: number;
	reason?: string;
	lotNumber?: string;
	condition?: string;
}

interface SupplierReturnDoc {
	storeId: string;
	supplierId?: string;
	supplierName?: string;
	purchaseOrderId?: string;
	purchaseOrderNumber?: string;
	purchaseId?: string;
	returnItems?: ReturnItem[];
	items?: ReturnItem[];
	status?: SupplierReturnStatus;
	totalClaimAmount?: number;
	totalAmount?: number;
	creditIssued?: number;
	returnReason?: string;
	claimType?: string;
	requestDate?: string;
}

function getBearerToken(req: Request): string | null {
	const authHeader = req.headers.authorization || '';
	if (!authHeader.startsWith('Bearer ')) return null;
	return authHeader.slice('Bearer '.length).trim() || null;
}

async function requireAuth(req: Request, res: Response): Promise<AuthUser | null> {
	const token = getBearerToken(req);
	if (!token) {
		res.status(401).json({ error: 'Unauthorized: missing bearer token' });
		return null;
	}

	try {
		const decoded = await admin.auth().verifyIdToken(token);
		return {
			uid: decoded.uid,
			email: decoded.email,
			name: decoded.name,
		};
	} catch (error) {
		console.error('Supplier returns auth error:', error);
		res.status(401).json({ error: 'Unauthorized: invalid token' });
		return null;
	}
}

async function canAccessStore(user: AuthUser, storeId: string): Promise<boolean> {
	if (!storeId) return false;
	if (user.uid === storeId) return true;

	const [storeSnap, userSnap, sellerSnap] = await Promise.all([
		db.collection('storeProfiles').doc(storeId).get(),
		db.collection('users').doc(user.uid).get(),
		db.collection('sellers').doc(user.uid).get(),
	]);

	if (storeSnap.exists) {
		const storeData = storeSnap.data() as Record<string, unknown>;
		const ownerId = typeof storeData.ownerId === 'string' ? storeData.ownerId : '';
		const userId = typeof storeData.userId === 'string' ? storeData.userId : '';
		const adminId = typeof storeData.adminId === 'string' ? storeData.adminId : '';
		if (ownerId === user.uid || userId === user.uid || adminId === user.uid) {
			return true;
		}
	}

	if (userSnap.exists) {
		const userData = userSnap.data() as Record<string, unknown>;
		if (typeof userData.storeId === 'string' && userData.storeId === storeId) {
			return true;
		}
	}

	if (sellerSnap.exists) {
		const sellerData = sellerSnap.data() as Record<string, unknown>;
		if (typeof sellerData.storeId === 'string' && sellerData.storeId === storeId) {
			return true;
		}
	}

	return false;
}

function normalizeItems(inputItems: ReturnItemInput[]): ReturnItem[] {
	return inputItems
		.map((item) => {
			const quantity = Number(item.quantity || 0);
			const unitCostRaw = item.unitCost ?? item.unitPrice ?? 0;
			const unitCost = Number(unitCostRaw || 0);
			const totalCost = Number(item.totalCost || quantity * unitCost);

			const normalized: ReturnItem = {
				rawMaterialId: String(item.rawMaterialId || '').trim(),
				materialName: String(item.materialName || '').trim(),
				sku: String(item.sku || '').trim(),
				quantity,
				unitCost,
				totalCost,
			};

			if (item.reason) normalized.reason = String(item.reason);
			if (item.lotNumber) normalized.lotNumber = String(item.lotNumber);
			if (item.condition) normalized.condition = String(item.condition);
			return normalized;
		})
		.filter((item) => item.rawMaterialId && item.quantity > 0 && item.unitCost >= 0 && Number.isFinite(item.totalCost));
}

function statusTimestampField(status: SupplierReturnStatus): string | null {
	const mapping: Partial<Record<SupplierReturnStatus, string>> = {
		submitted: 'submittedDate',
		approved: 'approvedDate',
		shipped: 'shippedDate',
		received_by_supplier: 'receivedBySupplierDate',
		credited: 'creditedDate',
		replaced: 'replacedDate',
		rejected: 'rejectedDate',
	};
	return mapping[status] || null;
}

async function generateSraNumber(storeId: string): Promise<string> {
	const snapshot = await db.collection('supplierReturns').where('storeId', '==', storeId).get();
	const next = snapshot.size + 1;
	return `RET-${String(next).padStart(3, '0')}`;
}

export async function createSupplierReturn(req: Request, res: Response): Promise<void> {
	const user = await requireAuth(req, res);
	if (!user) return;

	try {
		const body = req.body as {
			storeId?: string;
			supplierId?: string;
			supplierName?: string;
			purchaseOrderId?: string;
			purchaseOrderNumber?: string;
			returnItems?: ReturnItemInput[];
			items?: ReturnItemInput[];
			returnReason?: string;
			claimType?: string;
			notes?: string;
		};

		const storeId = String(body.storeId || '').trim();
		if (!storeId) {
			res.status(400).json({ error: 'Missing required field: storeId' });
			return;
		}

		if (!(await canAccessStore(user, storeId))) {
			res.status(403).json({ error: 'Forbidden: user has no access to this store' });
			return;
		}

		const sourceItems = Array.isArray(body.returnItems)
			? body.returnItems
			: Array.isArray(body.items)
				? body.items
				: [];
		const normalizedItems = normalizeItems(sourceItems);

		if (normalizedItems.length === 0) {
			res.status(400).json({ error: 'At least one valid return item is required' });
			return;
		}

		const totalClaimAmount = normalizedItems.reduce((sum, item) => sum + Number(item.totalCost || 0), 0);
		const requestDate = new Date().toISOString();
		const sraNumber = await generateSraNumber(storeId);

		const payload: Record<string, unknown> = {
			sraNumber,
			storeId,
			supplierId: body.supplierId || '',
			supplierName: body.supplierName || '',
			purchaseOrderId: body.purchaseOrderId || '',
			purchaseOrderNumber: body.purchaseOrderNumber || '',
			returnItems: normalizedItems,
			totalClaimAmount,
			returnReason: body.returnReason || 'defective_on_arrival',
			claimType: body.claimType || 'defective',
			status: 'draft',
			requestDate,
			createdAt: requestDate,
			updatedAt: requestDate,
			createdBy: user.uid,
		};

		if (body.notes) payload.notes = body.notes;

		const createdRef = await db.collection('supplierReturns').add(payload);
		res.status(201).json({
			success: true,
			id: createdRef.id,
			sraNumber,
			totalClaimAmount,
		});
	} catch (error) {
		console.error('createSupplierReturn error:', error);
		res.status(500).json({ error: 'Failed to create supplier return' });
	}
}

export async function updateSupplierReturnStatus(req: Request, res: Response): Promise<void> {
	const user = await requireAuth(req, res);
	if (!user) return;

	try {
		const body = req.body as {
			returnId?: string;
			status?: SupplierReturnStatus;
			notes?: string;
			supplierNotes?: string;
		};

		const returnId = String(body.returnId || '').trim();
		const status = body.status;
		if (!returnId || !status) {
			res.status(400).json({ error: 'Missing required fields: returnId, status' });
			return;
		}

		const allowedStatuses: SupplierReturnStatus[] = [
			'draft',
			'submitted',
			'approved',
			'shipped',
			'received_by_supplier',
			'credited',
			'replaced',
			'rejected',
			'disputed',
		];

		if (!allowedStatuses.includes(status)) {
			res.status(400).json({ error: 'Invalid status value' });
			return;
		}

		const returnRef = db.collection('supplierReturns').doc(returnId);
		const returnSnap = await returnRef.get();
		if (!returnSnap.exists) {
			res.status(404).json({ error: 'Supplier return not found' });
			return;
		}

		const returnData = returnSnap.data() as SupplierReturnDoc;
		if (!(await canAccessStore(user, returnData.storeId))) {
			res.status(403).json({ error: 'Forbidden: user has no access to this store' });
			return;
		}

		const now = new Date().toISOString();
		const updateData: Record<string, unknown> = {
			status,
			updatedAt: now,
			updatedBy: user.uid,
		};

		const tsField = statusTimestampField(status);
		if (tsField) updateData[tsField] = now;
		if (body.notes) updateData.notes = body.notes;
		if (body.supplierNotes) updateData.supplierNotes = body.supplierNotes;

		await returnRef.update(updateData);
		res.json({ success: true, returnId, status });
	} catch (error) {
		console.error('updateSupplierReturnStatus error:', error);
		res.status(500).json({ error: 'Failed to update supplier return status' });
	}
}

export async function shipSupplierReturn(req: Request, res: Response): Promise<void> {
	const user = await requireAuth(req, res);
	if (!user) return;

	try {
		const body = req.body as {
			returnId?: string;
			trackingNumber?: string;
			shippingCost?: number;
			notes?: string;
		};

		const returnId = String(body.returnId || '').trim();
		if (!returnId) {
			res.status(400).json({ error: 'Missing required field: returnId' });
			return;
		}

		const returnRef = db.collection('supplierReturns').doc(returnId);
		const returnSnap = await returnRef.get();
		if (!returnSnap.exists) {
			res.status(404).json({ error: 'Supplier return not found' });
			return;
		}

		const returnData = returnSnap.data() as SupplierReturnDoc;
		if (!(await canAccessStore(user, returnData.storeId))) {
			res.status(403).json({ error: 'Forbidden: user has no access to this store' });
			return;
		}

		const items = (returnData.returnItems || returnData.items || []) as ReturnItem[];
		if (!Array.isArray(items) || items.length === 0) {
			res.status(400).json({ error: 'Supplier return has no return items to ship' });
			return;
		}

		for (const item of items) {
			if (!item.rawMaterialId || !item.quantity || item.quantity <= 0) continue;
			const materialRef = db.collection('rawMaterials').doc(item.rawMaterialId);
			const materialSnap = await materialRef.get();
			if (!materialSnap.exists) continue;

			const materialData = materialSnap.data() as Record<string, unknown>;
			const currentStock = Number(materialData.currentStock || 0);
			const nextStock = Math.max(0, currentStock - Number(item.quantity || 0));
			await materialRef.update({
				currentStock: nextStock,
				updatedAt: new Date().toISOString(),
			});
		}

		const now = new Date().toISOString();
		const updateData: Record<string, unknown> = {
			status: 'shipped',
			shippedDate: now,
			updatedAt: now,
			updatedBy: user.uid,
		};

		if (body.trackingNumber) updateData.trackingNumber = body.trackingNumber;
		if (Number.isFinite(Number(body.shippingCost))) updateData.shippingCost = Number(body.shippingCost);
		if (body.notes) updateData.notes = body.notes;

		await returnRef.update(updateData);

		res.json({ success: true, returnId, status: 'shipped' });
	} catch (error) {
		console.error('shipSupplierReturn error:', error);
		res.status(500).json({ error: 'Failed to ship supplier return' });
	}
}

export async function creditSupplierReturn(req: Request, res: Response): Promise<void> {
	const user = await requireAuth(req, res);
	if (!user) return;

	try {
		const body = req.body as {
			returnId?: string;
			creditAmount?: number;
			creditNoteNumber?: string;
			applyToPurchase?: boolean;
			notes?: string;
		};

		const returnId = String(body.returnId || '').trim();
		if (!returnId) {
			res.status(400).json({ error: 'Missing required field: returnId' });
			return;
		}

		const returnRef = db.collection('supplierReturns').doc(returnId);
		const returnSnap = await returnRef.get();
		if (!returnSnap.exists) {
			res.status(404).json({ error: 'Supplier return not found' });
			return;
		}

		const returnData = returnSnap.data() as SupplierReturnDoc;
		if (!(await canAccessStore(user, returnData.storeId))) {
			res.status(403).json({ error: 'Forbidden: user has no access to this store' });
			return;
		}

		const derivedAmount = Number(returnData.totalClaimAmount || returnData.totalAmount || 0);
		const creditAmount = Number.isFinite(Number(body.creditAmount)) ? Number(body.creditAmount) : derivedAmount;
		if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
			res.status(400).json({ error: 'Invalid credit amount' });
			return;
		}

		const now = new Date().toISOString();
		const creditPayload: Record<string, unknown> = {
			sraId: returnId,
			supplierId: returnData.supplierId || '',
			creditAmount,
			creditNoteNumber: body.creditNoteNumber || `CR-${Date.now()}`,
			issuedDate: now,
			status: 'issued',
			storeId: returnData.storeId,
			createdAt: now,
			createdBy: user.uid,
		};

		if (body.notes) creditPayload.notes = body.notes;
		const creditRef = await db.collection('supplierCredits').add(creditPayload);

		const updateData: Record<string, unknown> = {
			status: 'credited',
			creditIssued: creditAmount,
			creditedDate: now,
			resolutionType: 'credit',
			resolutionDate: now,
			updatedAt: now,
			updatedBy: user.uid,
		};

		await returnRef.update(updateData);

		const shouldApplyToPurchase = body.applyToPurchase !== false;
		const purchaseId = String(returnData.purchaseOrderId || returnData.purchaseId || '').trim();
		if (shouldApplyToPurchase && purchaseId) {
			const purchaseRef = db.collection('purchases').doc(purchaseId);
			const purchaseSnap = await purchaseRef.get();

			if (purchaseSnap.exists) {
				const purchaseData = purchaseSnap.data() as Record<string, unknown>;
				const totalAmount = Number(purchaseData.totalAmount ?? purchaseData.total ?? 0);

				let amountPaid = Number(purchaseData.amountPaid || 0);
				const paymentHistory = Array.isArray(purchaseData.paymentHistory)
					? (purchaseData.paymentHistory as Array<Record<string, unknown>>)
					: [];

				if (paymentHistory.length > 0) {
					amountPaid = paymentHistory.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
				}

				const nextAmountPaid = Math.max(0, amountPaid - creditAmount);
				let paymentStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid';
				if (nextAmountPaid >= totalAmount && totalAmount > 0) {
					paymentStatus = 'paid';
				} else if (nextAmountPaid > 0) {
					paymentStatus = 'partial';
				}

				await purchaseRef.update({
					amountPaid: nextAmountPaid,
					paymentStatus,
					status: 'returned',
					updatedAt: now,
				});
			}
		}

		res.json({
			success: true,
			returnId,
			creditId: creditRef.id,
			creditAmount,
			status: 'credited',
		});
	} catch (error) {
		console.error('creditSupplierReturn error:', error);
		res.status(500).json({ error: 'Failed to credit supplier return' });
	}
}

export async function getSupplierReturnAnalytics(req: Request, res: Response): Promise<void> {
	const user = await requireAuth(req, res);
	if (!user) return;

	try {
		const storeId = String(req.query.storeId || '').trim();
		const from = String(req.query.from || '').trim();
		const to = String(req.query.to || '').trim();

		if (!storeId) {
			res.status(400).json({ error: 'Missing required query param: storeId' });
			return;
		}

		if (!(await canAccessStore(user, storeId))) {
			res.status(403).json({ error: 'Forbidden: user has no access to this store' });
			return;
		}

		const snapshot = await db.collection('supplierReturns').where('storeId', '==', storeId).get();

		const statusCounts: Record<string, number> = {};
		const reasonCounts: Record<string, number> = {};
		let totalReturns = 0;
		let totalClaimAmount = 0;
		let totalCreditedAmount = 0;

		snapshot.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
			const data = doc.data() as SupplierReturnDoc;
			const requestDate = String(data.requestDate || '');

			if (from && requestDate && requestDate < from) return;
			if (to && requestDate && requestDate > to) return;

			totalReturns += 1;
			const claim = Number(data.totalClaimAmount ?? data.totalAmount ?? 0);
			totalClaimAmount += Number.isFinite(claim) ? claim : 0;

			const credited = Number(data.creditIssued || 0);
			totalCreditedAmount += Number.isFinite(credited) ? credited : 0;

			const status = String(data.status || 'draft');
			statusCounts[status] = (statusCounts[status] || 0) + 1;

			const reason = String(data.returnReason || data.claimType || 'unknown');
			reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
		});

		const pendingStatuses = ['draft', 'submitted', 'approved', 'shipped', 'received_by_supplier', 'disputed'];
		const pendingCount = pendingStatuses.reduce((sum, status) => sum + Number(statusCounts[status] || 0), 0);

		const topReasons = Object.entries(reasonCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([reason, count]) => ({ reason, count }));

		res.json({
			success: true,
			analytics: {
				totalReturns,
				totalClaimAmount: Math.round((totalClaimAmount + Number.EPSILON) * 100) / 100,
				totalCreditedAmount: Math.round((totalCreditedAmount + Number.EPSILON) * 100) / 100,
				pendingCount,
				statusCounts,
				topReasons,
				filters: {
					storeId,
					from: from || null,
					to: to || null,
				},
			},
		});
	} catch (error) {
		console.error('getSupplierReturnAnalytics error:', error);
		res.status(500).json({ error: 'Failed to fetch supplier return analytics' });
	}
}
