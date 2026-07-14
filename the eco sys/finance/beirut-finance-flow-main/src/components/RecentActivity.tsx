
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreditCard, CheckCircle, FileText, Clock, AlertCircle } from "lucide-react";

// Mock data for recent activity
const activities = [
  {
    id: "act-001",
    type: "invoice-paid",
    title: "Invoice Paid",
    description: "Invoice INV-001 was paid by Beirut Digital District",
    timestamp: "2h ago"
  },
  {
    id: "act-002",
    type: "receipt-added",
    title: "Receipt Added",
    description: "New receipt from Spinneys Lebanon - Office Supplies",
    timestamp: "5h ago"
  },
  {
    id: "act-003",
    type: "invoice-sent",
    title: "Invoice Sent",
    description: "Invoice INV-003 was sent to Touch Lebanon",
    timestamp: "Yesterday"
  },
  {
    id: "act-004",
    type: "invoice-overdue",
    title: "Invoice Overdue",
    description: "Invoice INV-003 is now overdue",
    timestamp: "2 days ago"
  }
];

const RecentActivity = () => {
  return (
    <ScrollArea className="h-[300px] pr-4">
      <div className="space-y-5">
        {activities.map((activity) => (
          <div key={activity.id} className="flex">
            <div className="mr-4 mt-0.5">
              <ActivityIcon type={activity.type} />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{activity.title}</p>
                <span className="text-xs text-gray-500 dark:text-gray-400">{activity.timestamp}</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {activity.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

const ActivityIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "invoice-paid":
      return (
        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center">
          <CheckCircle className="h-4 w-4" />
        </div>
      );
    case "receipt-added":
      return (
        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <CreditCard className="h-4 w-4" />
        </div>
      );
    case "invoice-sent":
      return (
        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <FileText className="h-4 w-4" />
        </div>
      );
    case "invoice-overdue":
      return (
        <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center">
          <AlertCircle className="h-4 w-4" />
        </div>
      );
    default:
      return (
        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 flex items-center justify-center">
          <Clock className="h-4 w-4" />
        </div>
      );
  }
};

export default RecentActivity;
