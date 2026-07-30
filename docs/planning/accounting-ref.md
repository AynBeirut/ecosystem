# Accounting reference

Confirmed **3-digit Chart of Accounts** for COA / voucher-type build handoff.

## Handoff summary

- Use this table as the canonical default COA for new stores (align with `defaultChartOfAccounts` when implementing).
- **616 Repairs & Maintenance:** source list had `516` — treat as typo; use **616**.
- Next work: map voucher types and auto-posting rules to these account numbers.

---

## Chart of Accounts

| Account # | Account Name | Type | Normal Balance | Category |
|---|---|---|---|---|
| 101 | Petty Cash | Asset | Debit | Current Assets |
| 102 | POS Cash Drawer | Asset | Debit | Current Assets |
| 103 | Delivery Wallet | Asset | Debit | Current Assets |
| 105 | Bank Account - LBP | Asset | Debit | Current Assets |
| 106 | Bank Account - USD | Asset | Debit | Current Assets |
| 108 | Card Payment / Gateway Clearing | Asset | Debit | Current Assets |
| 110 | Accounts Receivable | Asset | Debit | Current Assets |
| 112 | Allowance for Bad Debts | Asset | Credit | Current Assets |
| 120 | Raw Materials Inventory | Asset | Debit | Current Assets |
| 121 | Finished Goods Inventory | Asset | Debit | Current Assets |
| 122 | Trading Goods Inventory | Asset | Debit | Current Assets |
| 123 | WIP Inventory | Asset | Debit | Current Assets |
| 125 | Consumables & Packaging Inventory | Asset | Debit | Current Assets |
| 130 | Prepaid Rent & Expenses | Asset | Debit | Current Assets |
| 135 | Security Deposits Paid | Asset | Debit | Current Assets |
| 140 | Input VAT / Recoverable Tax (11%) | Asset | Debit | Current Assets |
| 142 | Employee Advances | Asset | Debit | Current Assets |
| 150 | Land & Buildings | Asset | Debit | Non-Current Assets |
| 151 | Accum. Depr. - Buildings | Asset | Credit | Non-Current Assets |
| 155 | Machinery & Kitchen Equipment | Asset | Debit | Non-Current Assets |
| 156 | Accum. Depr. - Machinery & Equipment | Asset | Credit | Non-Current Assets |
| 201 | Accounts Payable | Liability | Credit | Current Liabilities |
| 202 | Accrued Expenses Payable | Liability | Credit | Current Liabilities |
| 210 | Salaries Payable | Liability | Credit | Current Liabilities |
| 212 | NSSF / Social Security Payable | Liability | Credit | Current Liabilities |
| 213 | Payroll Tax Payable (R10) | Liability | Credit | Current Liabilities |
| 220 | Output VAT / Collected Tax (11%) | Liability | Credit | Current Liabilities |
| 222 | VAT Settlement Account | Liability | Credit | Current Liabilities |
| 250 | End-of-Service Indemnity Provision | Liability | Credit | Non-Current Liabilities |
| 252 | Long-Term Loans | Liability | Credit | Non-Current Liabilities |
| 301 | Paid-In Capital | Equity | Credit | Equity |
| 302 | Owner / Partner Drawings | Equity | Debit | Equity |
| 303 | Opening Balance Equity | Equity | Credit | Equity |
| 304 | Retained Earnings | Equity | Credit | Equity |
| 305 | Current Year Net Profit / Loss | Equity | Credit | Equity |
| 401 | Retail / POS Sales | Revenue | Credit | Operating Revenue |
| 402 | B2B / Wholesale Sales | Revenue | Credit | Operating Revenue |
| 403 | Food & Beverage Sales | Revenue | Credit | Operating Revenue |
| 405 | Delivery Fee Revenue | Revenue | Credit | Operating Revenue |
| 410 | Sales Discounts & Returns | Revenue | Debit | Operating Revenue |
| 450 | Foreign Exchange Realized Gains | Revenue | Credit | Other Income |
| 455 | Miscellaneous Income | Revenue | Credit | Other Income |
| 501 | COGS - Raw Materials | Expense | Debit | Direct Costs / COGS |
| 502 | COGS - Trading Merchandise | Expense | Debit | Direct Costs / COGS |
| 503 | Direct Labor | Expense | Debit | Direct Costs / COGS |
| 505 | Packaging & Consumables Expense | Expense | Debit | Direct Costs / COGS |
| 506 | Freight-In & Customs Duties | Expense | Debit | Direct Costs / COGS |
| 601 | Salaries & Wages | Expense | Debit | Operating Expenses |
| 602 | Employer NSSF Contribution | Expense | Debit | Operating Expenses |
| 604 | End-of-Service Expense | Expense | Debit | Operating Expenses |
| 610 | Office & Shop Rent | Expense | Debit | Operating Expenses |
| 612 | Electricity & Water | Expense | Debit | Operating Expenses |
| 613 | Generator & Diesel Expense | Expense | Debit | Operating Expenses |
| 615 | Office Supplies & Expenses | Expense | Debit | Operating Expenses |
| 616 | Repairs & Maintenance *(source had 516 — typo)* | Expense | Debit | Operating Expenses |
| 620 | Internet & Telecom | Expense | Debit | Operating Expenses |
| 622 | Software & SaaS Subscriptions | Expense | Debit | Operating Expenses |
| 630 | Legal & Accounting Fees | Expense | Debit | Operating Expenses |
| 650 | Advertising & Marketing | Expense | Debit | Operating Expenses |
| 653 | Delivery & Courier Expenses | Expense | Debit | Operating Expenses |
| 655 | Vehicle Fuel & Maintenance | Expense | Debit | Operating Expenses |
| 701 | Bank & Payment Gateway Fees | Expense | Debit | Financial Expenses |
| 704 | Foreign Exchange Realized Losses | Expense | Debit | Financial Expenses |
| 710 | Depreciation Expense | Expense | Debit | Non-Cash Expenses |
| 713 | Bad Debt Expense | Expense | Debit | Non-Cash Expenses |
| 799 | Miscellaneous Expense | Expense | Debit | Operating Expenses |
