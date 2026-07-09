import type { BusinessWorkflow } from '@/lib/moduleManifest';
import { MODULE_CATALOG } from '@/lib/pricingDisplay';

export type SuggestionAnswer = {
  sellsPhysicalGoods?: boolean;
  hasProductionKitchen?: boolean;
  runsManufacturing?: boolean;
  isNgoOrFreelancer?: boolean;
  needsFieldSales?: boolean;
  needsMultiUser?: boolean;
};

export type ModuleSuggestion = {
  moduleId: string;
  reason: string;
  rank: number;
};

export function rankModuleSuggestions(answers: SuggestionAnswer): ModuleSuggestion[] {
  const suggestions: ModuleSuggestion[] = [];

  if (answers.isNgoOrFreelancer) {
    suggestions.push({
      moduleId: 'invoice_manager',
      reason: 'Portfolio PDF and client billing without inventory overhead.',
      rank: 1,
    });
    suggestions.push({
      moduleId: 'projects',
      reason: 'Track client engagements and deliverables (PSA).',
      rank: 2,
    });
    return suggestions.sort((a, b) => a.rank - b.rank);
  }

  if (answers.sellsPhysicalGoods !== false) {
    suggestions.push({
      moduleId: 'stock',
      reason: 'You sell physical goods — inventory tracking prevents overselling.',
      rank: 1,
    });
  }

  if (answers.hasProductionKitchen) {
    suggestions.push({
      moduleId: 'restaurant',
      reason: 'Live recipe deduction on each sale — ideal for kitchens and cafés.',
      rank: 2,
    });
    suggestions.push({
      moduleId: 'pos',
      reason: 'POS pairs with kitchen workflow for in-store sales.',
      rank: 3,
    });
  }

  if (answers.runsManufacturing) {
    suggestions.push({
      moduleId: 'factory',
      reason: 'BOM and production batches for manufacturing workflows.',
      rank: 2,
    });
  }

  if (answers.needsFieldSales) {
    suggestions.push({
      moduleId: 'crm',
      reason: 'Pipeline and field rep tools for outbound sales teams.',
      rank: 4,
    });
  }

  if (answers.needsMultiUser) {
    suggestions.push({
      moduleId: 'team',
      reason: 'Sub-accounts and role-based access for your staff.',
      rank: 5,
    });
  }

  return suggestions.sort((a, b) => a.rank - b.rank);
}

export function suggestionQuestionsForWorkflow(workflow: BusinessWorkflow): Array<{
  id: keyof SuggestionAnswer;
  label: string;
}> {
  if (workflow === 'ngo' || workflow === 'freelancer') {
    return [
      { id: 'needsFieldSales', label: 'Do you visit clients in the field?' },
    ];
  }
  return [
    { id: 'sellsPhysicalGoods', label: 'Do you sell physical products?' },
    { id: 'hasProductionKitchen', label: 'Do you prepare food or composed items on sale?' },
    { id: 'runsManufacturing', label: 'Do you run factory or batch production?' },
    { id: 'needsFieldSales', label: 'Do you have a field sales team?' },
    { id: 'needsMultiUser', label: 'Will more than one person use the admin?' },
  ];
}

export function getModuleLabel(moduleId: string): string {
  return MODULE_CATALOG.find((m) => m.id === moduleId)?.name ?? moduleId;
}
