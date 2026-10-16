import { Alert } from 'react-native';
import type { ServiceTaskCompletionOutcome } from '../types';
import { COMPLETION_OUTCOMES, completionOutcomeLabel } from '../lib/serviceTaskLogic';

export function promptServiceTaskCompletion(
  onPick: (outcome: ServiceTaskCompletionOutcome) => void,
): void {
  Alert.alert(
    'Mark occurrence',
    'How did this month end?',
    [
      ...COMPLETION_OUTCOMES.map((outcome) => ({
        text: completionOutcomeLabel(outcome),
        onPress: () => onPick(outcome),
      })),
      { text: 'Cancel', style: 'cancel' },
    ],
  );
}
