/**
 * LocalDB - Unified offline-first database abstraction
 * Uses IndexedDB for web/PWA, can be extended for Electron
 */

const DB_NAME = "BeirutFinanceFlow";
const DB_VERSION = 1;

export interface LocalDBSchema {
  companies: any[];
  clients: any[];
  products: any[];
  invoices: any[];
  receipts: any[];
  estimates: any[];
  purchaseOrders: any[];
  paymentOrders: any[];
  expenses: any[];
  reportsCache: any[];
  userSettings: any;
  createdCounts: any;
}

type StoreName = keyof LocalDBSchema;

class LocalDatabase {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores
        const stores: StoreName[] = [
          'companies', 'clients', 'products', 'invoices',
          'receipts', 'estimates', 'purchaseOrders', 'paymentOrders',
          'expenses', 'reportsCache', 'userSettings', 'createdCounts'
        ];

        stores.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
          }
        });
      };
    });

    return this.initPromise;
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) throw new Error("Database not initialized");
    return this.db;
  }

  async get<K extends StoreName>(storeName: K): Promise<LocalDBSchema[K]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async set<K extends StoreName>(storeName: K, data: any): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      
      // Clear existing data
      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => {
        // Add new data
        if (Array.isArray(data)) {
          data.forEach(item => store.add(item));
        } else {
          store.add(data);
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
      
      clearRequest.onerror = () => reject(clearRequest.error);
    });
  }

  async update<K extends StoreName>(storeName: K, id: string, data: Partial<any>): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        const existing = request.result;
        if (existing) {
          const updated = { ...existing, ...data };
          store.put(updated);
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async remove<K extends StoreName>(storeName: K, id: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async exportAll(): Promise<Record<string, any>> {
    const db = await this.ensureDB();
    const stores: StoreName[] = Array.from(db.objectStoreNames) as StoreName[];
    const exported: Record<string, any> = {};

    for (const storeName of stores) {
      exported[storeName] = await this.get(storeName);
    }

    return exported;
  }

  async importAll(data: Record<string, any>): Promise<void> {
    for (const [storeName, storeData] of Object.entries(data)) {
      if (this.db?.objectStoreNames.contains(storeName)) {
        await this.set(storeName as StoreName, storeData);
      }
    }
  }

  async clear(): Promise<void> {
    const db = await this.ensureDB();
    const stores: StoreName[] = Array.from(db.objectStoreNames) as StoreName[];

    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  // Fallback to localStorage for simple key-value pairs
  static getFromLocalStorage(key: string): any {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error("Error reading from localStorage:", error);
      return null;
    }
  }

  static setToLocalStorage(key: string, value: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Error writing to localStorage:", error);
    }
  }
}

// Singleton instance
export const LocalDB = new LocalDatabase();
