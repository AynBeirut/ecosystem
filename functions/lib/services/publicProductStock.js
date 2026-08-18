"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.computePublicProductStock = computePublicProductStock;
const admin = __importStar(require("firebase-admin"));
const composedProductStock_1 = require("../lib/composedProductStock");
function getDb() {
    return admin.firestore();
}
const MAX_PRODUCT_IDS = 100;
async function computePublicProductStock(storeId, productIds) {
    const uniqueIds = [...new Set(productIds.map((id) => String(id).trim()).filter(Boolean))];
    if (uniqueIds.length === 0)
        return [];
    if (uniqueIds.length > MAX_PRODUCT_IDS) {
        throw new Error(`Too many productIds (max ${MAX_PRODUCT_IDS})`);
    }
    const storeSnap = await getDb().collection('storeProfiles').doc(storeId).get();
    if (!storeSnap.exists) {
        throw new Error('Store not found');
    }
    const [recipesSnap, rawMaterialsSnap] = await Promise.all([
        getDb().collection('recipes').where('storeId', '==', storeId).get(),
        getDb().collection('rawMaterials').where('storeId', '==', storeId).get(),
    ]);
    const recipesList = recipesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    }));
    const rawMaterialsList = rawMaterialsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    }));
    const recipesById = new Map(recipesList.filter((r) => r.id).map((r) => [r.id, r]));
    const productRecipeByProductId = new Map();
    const productsSnap = await getDb().collection('products').where('storeId', '==', storeId).get();
    productsSnap.docs.forEach((doc) => {
        const recipeId = String(doc.data().recipeId || '').trim();
        if (recipeId)
            productRecipeByProductId.set(doc.id, recipeId);
    });
    const stockContext = { recipesById, productRecipeByProductId };
    const results = [];
    for (const productId of uniqueIds) {
        const productSnap = await getDb().collection('products').doc(productId).get();
        if (!productSnap.exists)
            continue;
        const product = productSnap.data();
        if (product.storeId !== storeId)
            continue;
        if (product.productType === 'composed' && product.recipeId) {
            const recipe = recipesList.find((r) => r.id === product.recipeId);
            const availableStock = (0, composedProductStock_1.calculateAvailableStock)(recipe, rawMaterialsList, stockContext);
            results.push({
                productId,
                availableStock,
                inStock: availableStock > 0,
            });
            continue;
        }
        const availableStock = Number(product.stock ?? 0);
        results.push({
            productId,
            availableStock,
            inStock: product.inStock ?? availableStock > 0,
        });
    }
    return results;
}
