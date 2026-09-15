import { describe, expect, it } from 'vitest';
import { storeIdHintFromUserProfile } from '@/lib/tenantBinding';

describe('storeIdHintFromUserProfile', () => {
  it('ignores activeStoreId when subAccountId is bound', () => {
    expect(
      storeIdHintFromUserProfile({
        subAccountId: 'sub-little-hands',
        storeId: '8WgfKtgaE8aAXdqFhIfweEo5WFq2',
        activeStoreId: 'DfIhBAEZ5NR7yNX0HboZvv58Nf82',
      }),
    ).toBe('8WgfKtgaE8aAXdqFhIfweEo5WFq2');
  });

  it('uses activeStoreId only when no subAccountId', () => {
    expect(
      storeIdHintFromUserProfile({
        activeStoreId: 'store-a',
      }),
    ).toBe('store-a');
  });

  it('prefers storeId then primaryStoreId before activeStoreId', () => {
    expect(
      storeIdHintFromUserProfile({
        storeId: 'store-b',
        primaryStoreId: 'store-c',
        activeStoreId: 'store-d',
      }),
    ).toBe('store-b');
  });
});
