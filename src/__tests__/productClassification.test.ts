import { describe, expect, it } from 'vitest';
import {
  getModuleProductStratum,
  getPackageProductStratum,
  getWorkflowProductStratum,
  isActiveCoreWorkflow,
  isDeferredPackage,
  isOptionalMaturityModule,
} from '@/lib/productClassification';

describe('productClassification', () => {
  it('marks live_kitchen as active core', () => {
    expect(getWorkflowProductStratum('live_kitchen')).toBe('active_core');
    expect(isActiveCoreWorkflow('live_kitchen')).toBe(true);
    expect(getPackageProductStratum('pkg_live_kitchen')).toBe('active_core');
  });

  it('keeps shop and factory as maintenance', () => {
    expect(getWorkflowProductStratum('shop')).toBe('maintenance');
    expect(getWorkflowProductStratum('factory')).toBe('maintenance');
    expect(getPackageProductStratum('pkg_factory_flow')).toBe('maintenance');
    expect(getPackageProductStratum('pkg_shop')).toBe('maintenance');
  });

  it('defers NGO/freelancer/mini shop packages', () => {
    expect(isDeferredPackage('pkg_ngo')).toBe(true);
    expect(isDeferredPackage('pkg_freelancer')).toBe(true);
    expect(isDeferredPackage('pkg_mini_shop')).toBe(true);
    expect(isDeferredPackage('pkg_live_kitchen')).toBe(false);
  });

  it('classifies optional maturity modules', () => {
    expect(isOptionalMaturityModule('stock')).toBe(true);
    expect(isOptionalMaturityModule('payments')).toBe(true);
    expect(getModuleProductStratum('crm')).toBe('active_core');
    expect(getModuleProductStratum('builder')).toBe('connected_high_end');
  });
});
