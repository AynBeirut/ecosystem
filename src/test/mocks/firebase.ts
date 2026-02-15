import { vi } from 'vitest'

export const setupFirebaseMock = (initialData?: any) => {
  const mockData = {
    products: [],
    orders: [],
    purchases: [],
    rawMaterials: [],
    finishedGoodsInventory: [],
    productionBatches: [],
    ...initialData
  }

  // Mock Firestore operations
  const mockGetDoc = vi.fn((docRef: any) => {
    const collectionName = docRef.path.split('/')[0]
    const docId = docRef.path.split('/')[1]
    const data = mockData[collectionName]?.find((item: any) => item.id === docId)
    
    return Promise.resolve({
      exists: () => !!data,
      data: () => data,
      id: docId
    })
  })

  const mockGetDocs = vi.fn((queryRef: any) => {
    const collectionName = queryRef.path || 'unknown'
    const data = mockData[collectionName] || []
    
    return Promise.resolve({
      docs: data.map((item: any) => ({
        id: item.id,
        data: () => item,
        exists: () => true
      })),
      empty: data.length === 0
    })
  })

  const mockAddDoc = vi.fn((collectionRef: any, data: any) => {
    const newId = `mock-id-${Date.now()}`
    return Promise.resolve({ id: newId })
  })

  const mockUpdateDoc = vi.fn(() => Promise.resolve())
  const mockSetDoc = vi.fn(() => Promise.resolve())
  const mockDeleteDoc = vi.fn(() => Promise.resolve())

  return {
    mockGetDoc,
    mockGetDocs,
    mockAddDoc,
    mockUpdateDoc,
    mockSetDoc,
    mockDeleteDoc,
    mockData
  }
}

export const mockFirebaseUser = (userData?: any) => {
  return {
    uid: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    ...userData
  }
}
