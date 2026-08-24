import type { BlogPost } from './blog-posts';

const PUBLISHED = '2026-08-21T12:00:00Z';

/** Inventory + accounting pillar cluster — drafted in-session, published to /blog. */
export const SEO_CLUSTER_POSTS: BlogPost[] = [
  {
    slug: 'multi-location-inventory-lebanon',
    title: 'Multi-Location Inventory Tracking for Lebanese Retailers',
    description:
      'How Lebanese retailers track stock across branches with inventory management software — transfers, costing, and one ledger instead of spreadsheet chaos.',
    category: 'Inventory',
    tags: ['inventory management software Lebanon', 'multi-location stock', 'retail inventory'],
    publishedAt: PUBLISHED,
    updatedAt: PUBLISHED,
    readingTime: 8,
    author: 'Grabio Team',
    relatedLinks: [
      { label: 'Grabio inventory software', href: '/solutions/inventory' },
      { label: 'POS that syncs stock', href: '/solutions/pos' },
      { label: 'Accounting & GL', href: '/solutions/accounting' },
    ],
    sections: [
      {
        type: 'p',
        content:
          'Multi-location inventory tracking is the difference between knowing what you can sell today and guessing from last week’s spreadsheet. For Lebanese retailers with more than one branch, warehouse, or consignment shelf, inventory management software Lebanon operators actually use must show stock by location — not one blended number.',
      },
      { type: 'h2', content: 'Why one spreadsheet breaks at two locations' },
      {
        type: 'p',
        content:
          'A single workbook cannot tell you which branch is overstocked and which is empty. Staff copy counts into WhatsApp, then someone overwrites the file. Sales happen on POS while the sheet is still open. Transfers never match receipts. Weighted-average cost drifts because each location buys at a different price and nobody posts the move.',
      },
      { type: 'h2', content: 'What multi-location inventory must record' },
      {
        type: 'ul',
        content: [
          'On-hand quantity per SKU per location (shop, warehouse, production floor).',
          'Transfers as stock-out from A and stock-in to B — not a free-text note.',
          'Purchases received against a location, not a company-wide dump.',
          'Sales and returns that deduct the location that actually sold.',
          'The same costing method on every location so valuation stays consistent.',
        ],
      },
      { type: 'h2', content: 'How Grabio inventory handles branches' },
      {
        type: 'p',
        content:
          'Grabio inventory keeps one product catalog and a stock ledger per location. Marketplace orders, Windows POS, and the admin Android app post to the same ledger. Low-stock alerts can fire per location so Hamra does not reorder what Dora already holds. Purchase orders and supplier returns stay tied to the receiving site.',
      },
      { type: 'h2', content: 'Operational rules that keep counts honest' },
      {
        type: 'ol',
        content: [
          'Never sell from a location that did not receive the goods.',
          'Post transfers the same day — delayed moves create fake shortages.',
          'Count one location at a time; do not mix two shops in one adjustment.',
          'Lock costing method (weighted average in Grabio) and do not mix with last-purchase guesswork.',
        ],
      },
      { type: 'h2', content: 'Link inventory to POS and the general ledger' },
      {
        type: 'p',
        content:
          'Stock that does not sync with POS is a second set of books. Stock that does not hit the GL is an operations report, not accounting. Grabio’s inventory module is built to stay aligned with POS sales and with accounting (COGS and inventory accounts) so retailers are not reconciling three tools at month-end. Start on the inventory solution page, then connect POS and accounting when you are ready.',
      },
    ],
  },
  {
    slug: 'weighted-average-costing-smb',
    title: 'Weighted Average Costing Explained for SMB Wholesalers',
    description:
      'Weighted average inventory costing for SMB wholesalers: how the method works, when it beats FIFO guesswork, and how Grabio applies it on every receipt.',
    category: 'Inventory',
    tags: ['weighted average inventory costing', 'inventory valuation', 'wholesale'],
    publishedAt: PUBLISHED,
    updatedAt: PUBLISHED,
    readingTime: 7,
    author: 'Grabio Team',
    relatedLinks: [
      { label: 'Grabio inventory software', href: '/solutions/inventory' },
      { label: 'Accounting & GL', href: '/solutions/accounting' },
    ],
    sections: [
      {
        type: 'p',
        content:
          'Weighted average inventory costing is the practical default for SMB wholesalers who buy the same SKU at different prices through the month. Instead of pretending every unit came from the last invoice, the system blends remaining stock with each new receipt so COGS and inventory value move together.',
      },
      { type: 'h2', content: 'How weighted average costing works' },
      {
        type: 'p',
        content:
          'On each purchase receipt: new cost = (old qty × old avg cost + received qty × receipt cost) ÷ total qty. Sales then relieve inventory at that running average — not at a handwritten “today’s price.” Returns and adjustments should reverse at the current average so you do not create a phantom gain.',
      },
      { type: 'h2', content: 'Why wholesalers prefer it over mental FIFO' },
      {
        type: 'ul',
        content: [
          'Mixed lots in one bin — you cannot pick “oldest carton” reliably.',
          'FX and supplier price changes in Lebanon make last-invoice cost noisy.',
          'One average per SKU is easier to audit than a stack of lot layers you never counted.',
        ],
      },
      { type: 'h2', content: 'What Grabio records' },
      {
        type: 'p',
        content:
          'Grabio inventory uses weighted-average costing on stock movements that affect value. Receipts, production into finished goods, and sales all hit the same method so the stock report and the GL inventory account can be compared. Do not overlay a second spreadsheet “true cost” — that is how valuation diverges.',
      },
      { type: 'h2', content: 'Mistakes that break the average' },
      {
        type: 'ol',
        content: [
          'Receiving without a unit cost (or with a placeholder of zero).',
          'Manual quantity edits that skip the cost engine.',
          'Mixing locations then averaging as if they were one warehouse.',
          'Posting supplier credits as cash without reversing the related receipt value.',
        ],
      },
      { type: 'h2', content: 'Tie it to the ledger' },
      {
        type: 'p',
        content:
          'Costing only matters if inventory and COGS land on the chart of accounts. Grabio accounting is designed to sit next to inventory so valuation is not a monthly reconstruction. Read the inventory module first, then map accounts in Grabio accounting.',
      },
    ],
  },
  {
    slug: 'purchase-order-workflow',
    title: 'Purchase Order Workflow: From PO to Stock Receipt',
    description:
      'A purchase order workflow software path for SMBs: raise PO, approve, receive against it, and land stock and payables without WhatsApp chaos.',
    category: 'Inventory',
    tags: ['purchase order workflow software', 'PO receiving', 'suppliers'],
    publishedAt: PUBLISHED,
    updatedAt: PUBLISHED,
    readingTime: 8,
    author: 'Grabio Team',
    relatedLinks: [
      { label: 'Grabio inventory software', href: '/solutions/inventory' },
      { label: 'Accounting & payables', href: '/solutions/accounting' },
    ],
    sections: [
      {
        type: 'p',
        content:
          'Purchase order workflow software exists so buying is not a chat thread. The job is simple: request, approve, send, receive, and match the supplier bill — with stock and accounts payable updating from the same document chain.',
      },
      { type: 'h2', content: 'The five stages of a clean PO' },
      {
        type: 'ol',
        content: [
          'Draft — SKU, qty, expected cost, supplier, destination location.',
          'Approve — owner or buyer sign-off; no receiving before this if you need control.',
          'Send — supplier gets a PO number they can quote on delivery.',
          'Receive — partial or full against the PO lines, not a new mystery invoice.',
          'Close — remaining qty cancelled or back-ordered; bill matched in AP.',
        ],
      },
      { type: 'h2', content: 'Receiving is the control point' },
      {
        type: 'p',
        content:
          'If goods hit the shelf without a receipt, your on-hand is a lie. If you receive without a PO, you cannot see over-delivery or price drift. Grabio inventory ties receipts to purchase orders and suppliers so the warehouse and finance see the same quantities.',
      },
      { type: 'h2', content: 'Partial receipts and returns' },
      {
        type: 'ul',
        content: [
          'Receive what arrived; leave the rest open on the PO.',
          'Supplier returns should reverse received qty and value — not a negative sale.',
          'Never “fix” a bad receipt by editing opening stock later.',
        ],
      },
      { type: 'h2', content: 'Where accounting joins' },
      {
        type: 'p',
        content:
          'A received PO is an inventory increase and, when billed, an AP liability. Grabio accounting (AP aging, supplier statements) is the other half of the workflow. Do not pay from WhatsApp screenshots while stock lives in another app.',
      },
      { type: 'h2', content: 'Minimum policy for SMBs' },
      {
        type: 'p',
        content:
          'No stock in without a receipt. No payment without a matched bill. No new SKU on a PO without it existing in the catalog. Grabio’s purchase and inventory tools are built around that loop — start at inventory, then close the books in accounting.',
      },
    ],
  },
  {
    slug: 'low-stock-alerts-setup',
    title: 'Low Stock Alerts Setup Guide for Grabio Stores',
    description:
      'Set up a low stock alert system in Grabio: reorder points per location, who gets notified, and how alerts become purchase orders instead of panic buys.',
    category: 'Inventory',
    tags: ['low stock alert system', 'reorder point', 'Grabio inventory'],
    publishedAt: PUBLISHED,
    updatedAt: PUBLISHED,
    readingTime: 7,
    author: 'Grabio Team',
    relatedLinks: [
      { label: 'Grabio inventory software', href: '/solutions/inventory' },
      { label: 'Create a Grabio account', href: '/signup' },
      { label: 'Mobile admin app', href: '/solutions/mobile-apps' },
    ],
    sections: [
      {
        type: 'p',
        content:
          'A low stock alert system is useful only if the threshold is real and the alert reaches the person who can buy. In Grabio, alerts sit on the same stock ledger as POS and marketplace sales — not a nightly export.',
      },
      { type: 'h2', content: 'Set the reorder point, not a vibe' },
      {
        type: 'p',
        content:
          'Pick a quantity that covers lead time plus a small buffer. Per location, not company-wide, if branches cannot share stock overnight. Fast movers need a higher floor; dead SKUs should not alert at all.',
      },
      { type: 'h2', content: 'What Grabio can notify' },
      {
        type: 'ul',
        content: [
          'Web admin dashboards when stock crosses the threshold.',
          'Push on the Grabio Admin Android app so buyers are not glued to a desktop.',
          'The same SKU across POS, marketplace, and manual adjustments — one ledger.',
        ],
      },
      { type: 'h2', content: 'Turn alerts into POs' },
      {
        type: 'ol',
        content: [
          'Review the alert list once per day — not every ping in isolation.',
          'Group by supplier so you raise one PO, not ten.',
          'Receive against that PO so the alert clears from real stock, not a checkbox.',
        ],
      },
      { type: 'h2', content: 'Decision-stage next step' },
      {
        type: 'p',
        content:
          'If you are still counting in Excel, alerts will always be late. Open Grabio inventory, set reorder points on your top SKUs, and install the admin app for push. Sign up when you are ready to run live stock — then connect POS so alerts follow real sales.',
      },
    ],
  },
  {
    slug: 'pos-inventory-sync',
    title: 'POS and Inventory Sync Best Practices',
    description:
      'POS inventory sync that does not lie: one ledger for Windows POS and back-office stock, offline rules, and what to check when numbers drift.',
    category: 'Inventory',
    tags: ['pos inventory sync', 'Windows POS', 'stock ledger'],
    publishedAt: PUBLISHED,
    updatedAt: PUBLISHED,
    readingTime: 7,
    author: 'Grabio Team',
    relatedLinks: [
      { label: 'Grabio POS', href: '/solutions/pos' },
      { label: 'Grabio inventory', href: '/solutions/inventory' },
      { label: 'Restaurant recipe deduction', href: '/solutions/restaurant' },
    ],
    sections: [
      {
        type: 'p',
        content:
          'POS inventory sync means a sale on the till is a stock movement — not a later spreadsheet update. Best practice is one product ID, one location, one ledger. Grabio Windows POS and inventory are built on that rule, including barcode and dual-currency tickets that still post qty.',
      },
      { type: 'h2', content: 'Rules that keep POS and stock aligned' },
      {
        type: 'ul',
        content: [
          'Sell only SKUs that exist in inventory with a location.',
          'Returns reverse the same SKU and location as the original sale.',
          'Do not run a “POS-only” product list that is missing from the warehouse catalog.',
          'Offline POS must queue movements and post them in order when the line returns.',
        ],
      },
      { type: 'h2', content: 'Where restaurants differ' },
      {
        type: 'p',
        content:
          'A finished plate may deduct recipe ingredients, not a finished-goods SKU. Grabio restaurant production does live recipe deduction on sale — still a sync problem, just at component level. Manufacturers have the same idea with BOM and production runs.',
      },
      { type: 'h2', content: 'When counts drift' },
      {
        type: 'ol',
        content: [
          'Check unposted offline tickets first.',
          'Look for adjustments posted to the wrong location.',
          'Confirm the POS user is not on a stale catalog cache.',
          'Recount the SKU — do not “fix” with a random +qty on another item.',
        ],
      },
      { type: 'h2', content: 'POS + inventory + books' },
      {
        type: 'p',
        content:
          'Cash in the drawer is not COGS. After POS sync is trusted, map sales and inventory into Grabio accounting. Start with POS and inventory solution pages; add GL when daily close is stable.',
      },
    ],
  },
  {
    slug: 'lebanese-pcg-small-business',
    title: 'Lebanese PCG Chart of Accounts for Small Business',
    description:
      'Lebanese PCG chart of accounts for small business: what the plan is, how SMBs use it in Grabio, and why a real COA beats a four-line cash book.',
    category: 'Accounting',
    tags: ['Lebanese PCG chart of accounts', 'PCG', 'chart of accounts'],
    publishedAt: PUBLISHED,
    updatedAt: PUBLISHED,
    readingTime: 8,
    author: 'Grabio Team',
    relatedLinks: [
      { label: 'Grabio accounting', href: '/solutions/accounting' },
      { label: 'Inventory costing', href: '/solutions/inventory' },
    ],
    sections: [
      {
        type: 'p',
        content:
          'The Lebanese PCG chart of accounts is the national-style numbering many accountants expect: classes for assets, liabilities, equity, income, and expenses. Small businesses do not need every leaf account on day one — they need a structure that an accountant can extend without renaming everything later.',
      },
      { type: 'h2', content: 'What PCG gives you that “Cash / Bank / Sales” does not' },
      {
        type: 'ul',
        content: [
          'Stable account codes for trial balance and tax files.',
          'A place for inventory, suppliers (AP), customers (AR), and VAT accounts.',
          'A shared language with an external accountant or auditor.',
        ],
      },
      { type: 'h2', content: 'How Grabio seeds Lebanese PCG' },
      {
        type: 'p',
        content:
          'Grabio accounting can load a Lebanese PCG-style chart so operational postings (sales, purchases, stock, bank) land on recognizable codes instead of ad-hoc labels. You still map your bank and cash accounts; you do not invent a private numbering scheme that nobody else can read.',
      },
      { type: 'h2', content: 'Minimum accounts for a trading SMB' },
      {
        type: 'ol',
        content: [
          'Cash and banks (one per real account).',
          'Inventory and COGS.',
          'Trade payables and receivables.',
          'Sales, discounts, and VAT control accounts as required by your filing.',
          'Operating expenses split only as far as you actually review them.',
        ],
      },
      { type: 'h2', content: 'Do not over-split on day one' },
      {
        type: 'p',
        content:
          'Five hundred unused accounts hide the trial balance. Start with PCG classes you post to weekly. Add detail when a report actually needs it. Grabio’s GL, journals, and aging reports assume a real COA — see the accounting solution page for the module list (vouchers, AP/AR, bank rec, trial balance).',
      },
    ],
  },
  {
    slug: 'general-ledger-vs-bookkeeping',
    title: 'General Ledger vs Simple Bookkeeping: When to Upgrade',
    description:
      'When general ledger software for small business beats a cash book: journals, trial balance, inventory, and AP/AR that simple bookkeeping cannot hold.',
    category: 'Accounting',
    tags: ['general ledger software small business', 'bookkeeping vs GL', 'journals'],
    publishedAt: PUBLISHED,
    updatedAt: PUBLISHED,
    readingTime: 7,
    author: 'Grabio Team',
    relatedLinks: [
      { label: 'Grabio accounting & GL', href: '/solutions/accounting' },
      { label: 'Inventory valuation', href: '/solutions/inventory' },
    ],
    sections: [
      {
        type: 'p',
        content:
          'Simple bookkeeping tracks money in and money out. General ledger software for small business tracks every debit and credit so inventory, payables, VAT, and equity stay in balance. Upgrade when the cash book can no longer explain the balance sheet.',
      },
      { type: 'h2', content: 'Signs you have outgrown the cash book' },
      {
        type: 'ul',
        content: [
          'You hold stock but have no inventory account.',
          'Suppliers are paid from memory; there is no AP aging.',
          'The accountant rebuilds books from bank statements every quarter.',
          'VAT or PCG codes cannot be produced without a side spreadsheet.',
        ],
      },
      { type: 'h2', content: 'What a GL actually is' },
      {
        type: 'p',
        content:
          'A general ledger is the book of record: chart of accounts, journal vouchers, and a trial balance that must equal. Invoices, receipts, and stock movements should post into it — not live beside it. Grabio accounting is built as GL plus operational modules (AP/AR aging, bank reconciliation, Lebanese PCG), not as a separate “finance app” that never sees inventory.',
      },
      { type: 'h2', content: 'Upgrade path that does not explode' },
      {
        type: 'ol',
        content: [
          'Load a COA (PCG-style if that is how you file).',
          'Post opening balances once — do not drip historical chaos for years.',
          'Connect inventory costing and sales so COGS is not a year-end surprise.',
          'Reconcile bank weekly before you trust the P&L.',
        ],
      },
      { type: 'h2', content: 'Grabio’s place in that path' },
      {
        type: 'p',
        content:
          'If operations already run on Grabio inventory or POS, the GL should be the same platform. See Grabio accounting for journals, trial balance, and aging — then keep stock in Grabio inventory so the two do not diverge.',
      },
    ],
  },
  {
    slug: 'ap-aging-report-walkthrough',
    title: 'AP Aging Report Walkthrough for Finance Teams',
    description:
      'How to read an accounts payable aging report, what each bucket means, and how Grabio AP aging helps you decide who to pay this week.',
    category: 'Accounting',
    tags: ['accounts payable aging report', 'AP aging', 'payables'],
    publishedAt: PUBLISHED,
    updatedAt: PUBLISHED,
    readingTime: 7,
    author: 'Grabio Team',
    relatedLinks: [
      { label: 'Grabio accounting', href: '/solutions/accounting' },
      { label: 'Purchase orders', href: '/solutions/inventory' },
      { label: 'Contact Grabio', href: '/contact' },
    ],
    sections: [
      {
        type: 'p',
        content:
          'An accounts payable aging report lists what you owe suppliers by how overdue the bill is — typically current, 1–30, 31–60, 61–90, and 90+ days. Finance uses it to protect cash and supplier relationships, not to decorate a dashboard.',
      },
      { type: 'h2', content: 'How to read the buckets' },
      {
        type: 'ul',
        content: [
          'Current — not yet due; still schedule, do not ignore.',
          '1–30 — operational delay or disputed GRN; resolve this week.',
          '31–60 — relationship risk; call before they hold shipments.',
          '61+ — either a process break (unmatched bills) or a cash crisis.',
        ],
      },
      { type: 'h2', content: 'What must feed the report' },
      {
        type: 'p',
        content:
          'Aging is only true if bills are posted, payments are allocated to those bills, and credits reduce the right supplier. WhatsApp transfers that never hit AP will make you look current while the supplier is chasing you.',
      },
      { type: 'h2', content: 'Grabio AP aging' },
      {
        type: 'p',
        content:
          'Grabio accounting includes AP aging next to supplier statements and the GL. Pair it with inventory purchase receipts so you are not paying for goods you never received. Walk the report in the same meeting as the bank rec — cash and AP lie to each other if done apart.',
      },
      { type: 'h2', content: 'Decision CTA' },
      {
        type: 'p',
        content:
          'If you cannot produce an AP aging from your current tools, you are prioritizing in the dark. Use Grabio accounting for aging and statements, or request a walkthrough via the contact page. Bring one supplier statement and last month’s payments — that is enough to see the gap.',
      },
    ],
  },
  {
    slug: 'bank-reconciliation-checklist',
    title: 'Bank Reconciliation Checklist for Lebanese SMBs',
    description:
      'A bank reconciliation software checklist for Lebanese SMBs: match statement to ledger, catch FX and Whish/card gaps, and close the week without a mystery difference.',
    category: 'Accounting',
    tags: ['bank reconciliation software', 'bank rec', 'Lebanon SMB'],
    publishedAt: PUBLISHED,
    updatedAt: PUBLISHED,
    readingTime: 8,
    author: 'Grabio Team',
    relatedLinks: [
      { label: 'Grabio accounting', href: '/solutions/accounting' },
      { label: 'Payments on Grabio', href: '/solutions/platform' },
    ],
    sections: [
      {
        type: 'p',
        content:
          'Bank reconciliation software is the weekly proof that the GL cash/bank accounts match the real statement. For Lebanese SMBs, the hard parts are dual currency, delayed card/Whish settlements, and payments posted to the wrong account.',
      },
      { type: 'h2', content: 'Checklist — every statement period' },
      {
        type: 'ol',
        content: [
          'Import or enter the statement closing balance and currency.',
          'Tick cleared ledger lines that appear on the statement.',
          'List outstanding cheques / unpresented deposits — do not delete them.',
          'Post bank charges and FX differences as journals, not as silent edits.',
          'Investigate any remaining difference before you close the period.',
        ],
      },
      { type: 'h2', content: 'Lebanon-specific traps' },
      {
        type: 'ul',
        content: [
          'USD vs LBP accounts mixed in one “bank” bucket.',
          'POS cash marked as banked when it is still in the drawer.',
          'Supplier paid from personal account with no owner-draw / due-to-owner entry.',
        ],
      },
      { type: 'h2', content: 'What Grabio bank rec is for' },
      {
        type: 'p',
        content:
          'Grabio accounting includes bank reconciliation against the same GL used for invoices and inventory postings. The goal is a documented match — not a forced zero. If inventory and sales never post to the ledger, rec will always look “fine” and still be wrong.',
      },
      { type: 'h2', content: 'Cadence' },
      {
        type: 'p',
        content:
          'Weekly is enough for most SMBs; daily if cash is tight. Close the rec before you trust AP aging or VAT prep. Start on the accounting solution page and keep one bank account per real IBAN.',
      },
    ],
  },
  {
    slug: 'vat-filing-prep-lebanon',
    title: 'VAT Filing Prep for Lebanese Small Businesses',
    description:
      'VAT filing prep for Lebanese small businesses: what to gather before the accountant files, how sales and purchase accounts should look, and where Grabio GL helps.',
    category: 'Accounting',
    tags: ['VAT filing Lebanon small business', 'VAT prep', 'Lebanese tax'],
    publishedAt: PUBLISHED,
    updatedAt: PUBLISHED,
    readingTime: 7,
    author: 'Grabio Team',
    relatedLinks: [
      { label: 'Grabio accounting', href: '/solutions/accounting' },
      { label: 'Invoicing on Grabio', href: '/features' },
    ],
    sections: [
      {
        type: 'p',
        content:
          'VAT filing prep for Lebanese small businesses is a document and ledger problem, not a last-night Excel panic. This page does not replace your accountant or the Ministry of Finance rules. It lists what your books must already show so filing is a review, not a reconstruction.',
      },
      { type: 'h2', content: 'What to have ready' },
      {
        type: 'ul',
        content: [
          'Sales invoices and credit notes for the period.',
          'Purchase invoices you will recover (if eligible) — matched to receipts.',
          'VAT control accounts that equal the tax on those documents.',
          'Bank rec done so “missing” sales are not just unposted cash.',
        ],
      },
      { type: 'h2', content: 'Where books usually fail' },
      {
        type: 'p',
        content:
          'Cash sales never invoiced. Supplier bills in a drawer. Mixed personal and business spend. Inventory bought but never received, so input VAT has no goods behind it. A GL with PCG-style VAT accounts makes the gap visible; a cash book hides it.',
      },
      { type: 'h2', content: 'How Grabio supports prep — not filing' },
      {
        type: 'p',
        content:
          'Grabio accounting gives you invoices, journals, trial balance, and AP/AR so an accountant can extract the period. Grabio does not file VAT for you. Keep the chart of accounts stable (including Lebanese PCG if that is how you report) and stop posting VAT into random expense lines.',
      },
      { type: 'h2', content: 'Before you send the pack' },
      {
        type: 'ol',
        content: [
          'Freeze the period — no silent backdated edits.',
          'Export or print trial balance and VAT account activity.',
          'Attach exception list (voids, owner drawings, FX).',
          'Let the accountant map to the official form — do not invent boxes.',
        ],
      },
    ],
  },
  {
    slug: 'restaurant-recipe-costing-lebanon',
    title: 'Recipe Costing and Kitchen Inventory for Lebanese Restaurants',
    description:
      'How cafes and restaurants in Lebanon track recipe costs, deduct ingredients at sale, and keep kitchen inventory aligned with POS — without a separate manufacturing step.',
    category: 'Restaurant',
    tags: ['restaurant inventory software', 'recipe costing POS', 'cloud kitchen software', 'Lebanon restaurant'],
    publishedAt: PUBLISHED,
    updatedAt: PUBLISHED,
    readingTime: 7,
    author: 'Grabio Team',
    relatedLinks: [
      { label: 'Grabio restaurant module', href: '/solutions/restaurant' },
      { label: 'POS with stock sync', href: '/solutions/pos' },
      { label: 'Inventory management', href: '/solutions/inventory' },
    ],
    sections: [
      {
        type: 'p',
        content:
          'Restaurant inventory software only works when recipe costing POS logic matches what the kitchen actually uses. In Lebanon, ingredient prices move weekly — flour, oil, proteins — so a static Excel recipe sheet is wrong before the month ends.',
      },
      { type: 'h2', content: 'Recipe costing vs gut feel' },
      {
        type: 'p',
        content:
          'Recipe costing ties each menu item to ingredient quantities and current purchase costs. When costs rise, you see margin shrink on the plate — not only at month-end. Grabio Restaurant Production deducts ingredients at checkout so consumption matches sales, not a separate batch step.',
      },
      { type: 'h2', content: 'Kitchen inventory without double entry' },
      {
        type: 'ul',
        content: [
          'Recipes linked to raw materials in one catalog.',
          'Sales on POS or marketplace reduce ingredient stock automatically.',
          'Purchases received against suppliers update the same ledger.',
          'Low-stock alerts before service, not after a 86’d dish.',
        ],
      },
      { type: 'h2', content: 'Cloud kitchen and delivery' },
      {
        type: 'p',
        content:
          'Cloud kitchen software needs the same stock truth for dine-in, delivery, and aggregator orders. One platform for orders, delivery workflow, and kitchen deduction avoids three spreadsheets. Grabio connects marketplace orders and delivery modules to restaurant stock.',
      },
      { type: 'h2', content: 'When to use restaurant vs manufacturing module' },
      {
        type: 'p',
        content:
          'Use Grabio Restaurant when you sell finished dishes and deduct recipes at sale. Use Factory & Production when you run explicit production batches and finished goods — bakeries with daily batch runs often need both patterns; start with the module that matches how you actually produce.',
      },
    ],
  },
  {
    slug: 'restaurant-pos-inventory-lebanon',
    title: 'Restaurant POS with Inventory Tracking in Lebanon',
    description:
      'Why Lebanese restaurants need POS tied to kitchen inventory — dual currency checkout, recipe deduction, and one stock ledger for dine-in, delivery, and marketplace orders.',
    category: 'Restaurant',
    tags: [
      'restaurant POS Lebanon',
      'multi-currency restaurant POS Lebanon',
      'restaurant inventory software',
      'kitchen inventory automation',
    ],
    publishedAt: PUBLISHED,
    updatedAt: PUBLISHED,
    readingTime: 8,
    author: 'Grabio Team',
    relatedLinks: [
      { label: 'Restaurant & hospitality software', href: '/solutions/restaurant' },
      { label: 'Windows POS module', href: '/solutions/pos' },
      { label: 'Recipe costing guide', href: '/blog/restaurant-recipe-costing-lebanon' },
    ],
    sections: [
      {
        type: 'p',
        content:
          'A restaurant POS in Lebanon must do more than print tickets. Operators settle in USD and LBP, run delivery and dine-in on different channels, and still need one kitchen inventory number — not three apps that disagree at closing.',
      },
      { type: 'h2', content: 'What “POS with inventory tracking” means' },
      {
        type: 'ul',
        content: [
          'Every sale reduces stock for recipes and sellable items automatically.',
          'Dual currency totals post to the same ledger the accountant uses.',
          'Marketplace and delivery orders hit the same kitchen deduction rules as counter POS.',
          'Purchases and supplier receipts update the ingredients the kitchen actually consumes.',
        ],
      },
      { type: 'h2', content: 'Dual-currency restaurant billing' },
      {
        type: 'p',
        content:
          'Multi-currency restaurant POS Lebanon teams rely on is not a manual rate in a notebook. Grabio Windows POS handles dual currency at checkout while syncing inventory and accounting — so margin and stock stay aligned when the exchange rate moves.',
      },
      { type: 'h2', content: 'Kitchen inventory automation without a factory step' },
      {
        type: 'p',
        content:
          'Grabio Restaurant Production deducts recipe ingredients when you sell — kitchen inventory automation for cafes and cloud kitchens that plate food to order, not batch manufacturing. Pair it with the restaurant solution page and inventory module for supplier POs and low-stock alerts.',
      },
      { type: 'h2', content: 'When a restaurant-only POS is enough' },
      {
        type: 'p',
        content:
          'If you only need front-of-house tickets and never touch GL or multi-location stock, a niche F&B POS may suffice. Choose a modular restaurant platform when you also run accounting, wholesale ingredients, manufacturing, or multiple brands in one company.',
      },
    ],
  },
  {
    slug: 'modular-restaurant-platform-vs-restaurant-only-pos',
    title: 'Modular Restaurant Platform vs Restaurant-Only POS',
    description:
      'How to choose between a hospitality-only POS and a modular platform like Grabio when you need recipes, inventory, accounting, and delivery in one account.',
    category: 'Restaurant',
    tags: ['restaurant solution Lebanon', 'Foodics alternative', 'hospitality software MENA', 'Grabio restaurant'],
    publishedAt: PUBLISHED,
    updatedAt: PUBLISHED,
    readingTime: 7,
    author: 'Grabio Team',
    relatedLinks: [
      { label: 'Grabio restaurant vertical', href: '/solutions/restaurant' },
      { label: 'Platform overview', href: '/solutions/platform' },
      { label: 'Accounting module', href: '/solutions/accounting' },
    ],
    sections: [
      {
        type: 'p',
        content:
          'Search engines and AI assistants often bucket Grabio as an “all-in-one business platform” rather than a restaurant-only app. That is accurate — and it is also why operators who need accounting plus kitchen ops choose Grabio over a siloed hospitality POS.',
      },
      { type: 'h2', content: 'Restaurant-only POS tools' },
      {
        type: 'p',
        content:
          'Products like Foodics optimize for food and beverage workflows — menus, shifts, and F&B reporting. They fit when hospitality is the only domain and back-office needs stay inside that product.',
      },
      { type: 'h2', content: 'Modular platforms with a restaurant vertical' },
      {
        type: 'p',
        content:
          'Grabio publishes a dedicated restaurant solution page with hospitality keywords: recipe deduction at checkout, kitchen inventory, dual-currency POS, cloud kitchen delivery, and general ledger in one ecosystem. Retail, manufacturing, and CRM modules stay available without middleware.',
      },
      { type: 'h2', content: 'Reservation tools are a different category' },
      {
        type: 'p',
        content:
          'TheFork Manager and similar products focus on guest discovery and reservations — not ingredient costing or GL posting. Do not expect a reservation platform to replace kitchen inventory or accounting.',
      },
      { type: 'h2', content: 'Decision checklist' },
      {
        type: 'ul',
        content: [
          'Need GL, AP/AR, and bank rec with the restaurant? → modular platform.',
          'Only counter tickets and basic F&B reports? → restaurant-only POS may suffice.',
          'Cloud kitchen + marketplace + delivery + stock? → Grabio restaurant + POS + inventory.',
          'Batch production and finished goods? → add manufacturing module, not a second ERP.',
        ],
      },
    ],
  },
  {
    slug: 'manufacturing-bom-tracking-lebanon',
    title: 'BOM and Production Tracking for Light Manufacturing in Lebanon',
    description:
      'Bill of materials, production runs, raw-to-finished flow, and factory inventory for SMB manufacturers and food producers in Lebanon using Grabio.',
    category: 'Manufacturing',
    tags: ['manufacturing software SMB', 'BOM production tracking', 'factory inventory software', 'Lebanon manufacturing'],
    publishedAt: PUBLISHED,
    updatedAt: PUBLISHED,
    readingTime: 8,
    author: 'Grabio Team',
    relatedLinks: [
      { label: 'Grabio manufacturing', href: '/solutions/manufacturing' },
      { label: 'Raw materials & stock', href: '/solutions/inventory' },
      { label: 'Accounting & costing', href: '/solutions/accounting' },
    ],
    sections: [
      {
        type: 'p',
        content:
          'Manufacturing software SMB teams actually adopt starts with a clear bill of materials (BOM) — not a 200-line ERP rollout. Light factories and food producers in Lebanon need raw materials in, production runs recorded, finished goods out, and costs visible without a separate consultant project.',
      },
      { type: 'h2', content: 'What a BOM must capture' },
      {
        type: 'ul',
        content: [
          'Finished SKU and version (recipe or assembly).',
          'Component quantities per unit — with scrap/yield if relevant.',
          'Unit of measure consistency (kg, L, pcs) across purchases and production.',
          'Link to suppliers and weighted-average or standard cost.',
        ],
      },
      { type: 'h2', content: 'Production runs vs live deduction' },
      {
        type: 'p',
        content:
          'BOM production tracking means posting a run: consume components, receive finished quantity, capture labor or overhead if you track it. That is different from restaurant recipe deduction at checkout. Grabio Factory & Production is built for explicit runs, batch IDs, and finished-goods inventory.',
      },
      { type: 'h2', content: 'Factory inventory tied to accounting' },
      {
        type: 'p',
        content:
          'Factory inventory software fails when production never hits the general ledger. Transfers from raw to WIP to finished goods should flow into valuation reports your accountant can use. Grabio manufacturing sits on the same platform as inventory and GL — not a standalone MRP spreadsheet.',
      },
      { type: 'h2', content: 'Practical rollout order' },
      {
        type: 'ol',
        content: [
          'Master raw materials and suppliers in inventory.',
          'Define BOMs for top SKUs only — not every variant on day one.',
          'Post production daily or per shift; reconcile counts weekly.',
          'Add costing review monthly with finance — adjust BOM yields from reality.',
        ],
      },
    ],
  },
];
