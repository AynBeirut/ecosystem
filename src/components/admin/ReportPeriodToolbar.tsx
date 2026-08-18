import CustomDateRangeToolbar from '@/components/admin/CustomDateRangeToolbar';
import type { DateRangeShortcut } from '@/components/CustomDateRangeToolbar';

type Props = {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  shortcuts?: DateRangeShortcut[];
  showVatQuarters?: boolean;
  quarterYear?: number;
  className?: string;
  compact?: boolean;
};

export default function ReportPeriodToolbar(props: Props) {
  return <CustomDateRangeToolbar {...props} />;
};

export type { DateRangeShortcut };
