let activeStoreId: string | null = null;

export function setFinanceStoreId(storeId: string | null): void {
  activeStoreId = storeId;
}

export function getFinanceStoreId(): string | null {
  return activeStoreId;
}
