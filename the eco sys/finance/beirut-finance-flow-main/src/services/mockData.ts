
export const TEST_USER = {
  id: "test-user-1",
  email: "test@example.com",
  password: "password123",
  company: {
    name: "Test Company LLC",
    address: "Beirut Digital District",
    phone: "+961 1 234 567",
    logo: "https://placeholder.com/150",
    taxId: "LB123456789",
    commercialRegistry: "BEY-12345"
  },
  credits: 50,
  isPremium: false
};

export const TEST_INVOICES = [
  {
    id: "INV-001",
    customer: "Beirut Digital District",
    amount: 1200,
    currency: "USD",
    date: "2024-04-15",
    status: "paid"
  },
  {
    id: "INV-002",
    customer: "Antwork Coworking Space",
    amount: 2500000,
    currency: "LBP",
    date: "2024-04-18",
    status: "pending"
  },
  {
    id: "INV-003",
    customer: "Touch Lebanon",
    amount: 850,
    currency: "USD",
    date: "2024-04-20",
    status: "overdue"
  }
];

export const TEST_RECEIPTS = [
  {
    id: "REC-001",
    vendor: "Spinneys Lebanon",
    amount: 450000,
    currency: "LBP",
    date: "2024-04-15",
    category: "Office Supplies",
    description: "Monthly office supplies"
  },
  {
    id: "REC-002",
    vendor: "Touch Lebanon",
    amount: 75,
    currency: "USD",
    date: "2024-04-16",
    category: "Utilities",
    description: "Internet subscription"
  }
];

export const CATEGORIES = [
  "Office Supplies",
  "Utilities",
  "Rent",
  "Insurance",
  "Marketing",
  "Travel",
  "Equipment",
  "Software",
  "Salaries",
  "Taxes",
  "Legal",
  "Miscellaneous"
];

export const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "LBP", symbol: "L£", name: "Lebanese Pound" },
  { code: "EUR", symbol: "€", name: "Euro" }
];
