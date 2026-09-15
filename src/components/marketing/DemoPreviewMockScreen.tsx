import React from 'react';
import type { DemoPreviewScreenType } from '@/data/marketing/demoPreviewCatalog';

type Props = {
  type: DemoPreviewScreenType;
  label: string;
};

const MockShell: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="demo-mock-shell" aria-hidden="true">
    <aside className="demo-mock-sidebar">
      <div className="demo-mock-logo">Grabio</div>
      <nav className="demo-mock-nav">
        {['Dashboard', 'Orders', 'Inventory', 'Finance'].map((item) => (
          <div key={item} className={`demo-mock-nav-item${item === title ? ' is-active' : ''}`}>{item}</div>
        ))}
      </nav>
    </aside>
    <div className="demo-mock-main">
      <header className="demo-mock-topbar">
        <span className="demo-mock-topbar-title">{title}</span>
        <span className="demo-mock-pill">Demo store</span>
      </header>
      <div className="demo-mock-content">{children}</div>
    </div>
  </div>
);

const StatRow: React.FC<{ items: { label: string; value: string; tone?: string }[] }> = ({ items }) => (
  <div className="demo-mock-stats">
    {items.map((item) => (
      <div key={item.label} className="demo-mock-stat">
        <p className="demo-mock-stat-label">{item.label}</p>
        <p className={`demo-mock-stat-value${item.tone ? ` demo-mock-stat-value--${item.tone}` : ''}`}>{item.value}</p>
      </div>
    ))}
  </div>
);

const Table: React.FC<{ headers: string[]; rows: string[][] }> = ({ headers, rows }) => (
  <div className="demo-mock-table-wrap">
    <table className="demo-mock-table">
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={idx}>
            {row.map((cell, cellIdx) => (
              <td key={cellIdx}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

function renderScreen(type: DemoPreviewScreenType, label: string): React.ReactNode {
  switch (type) {
    case 'dashboard':
      return (
        <MockShell title="Dashboard">
          <StatRow
            items={[
              { label: 'Today sales', value: '$4,280', tone: 'teal' },
              { label: 'Open orders', value: '18' },
              { label: 'Low stock SKUs', value: '6', tone: 'amber' },
              { label: 'Cash on hand', value: '$12,400' },
            ]}
          />
          <Table
            headers={['Channel', 'Orders', 'Revenue', 'Status']}
            rows={[
              ['POS counter', '42', '$2,910', 'Synced'],
              ['Online store', '11', '$1,120', 'Picking'],
              ['Wholesale', '3', '$250', 'Invoiced'],
            ]}
          />
        </MockShell>
      );
    case 'pos':
      return (
        <div className="demo-mock-pos" aria-hidden="true">
          <div className="demo-mock-pos-cart">
            <p className="demo-mock-pos-title">Current sale</p>
            <ul className="demo-mock-pos-lines">
              <li><span>Latte ×2</span><span>$8.00</span></li>
              <li><span>Chicken wrap</span><span>$6.50</span></li>
              <li><span>Mineral water</span><span>$1.00</span></li>
            </ul>
            <div className="demo-mock-pos-total">
              <span>Total</span>
              <strong>$15.50</strong>
            </div>
            <div className="demo-mock-pos-actions">
              <span className="demo-mock-btn demo-mock-btn--ghost">Hold</span>
              <span className="demo-mock-btn demo-mock-btn--primary">Pay</span>
            </div>
          </div>
          <div className="demo-mock-pos-grid">
            {['Espresso', 'Cappuccino', 'Sandwich', 'Salad', 'Juice', 'Dessert'].map((item) => (
              <div key={item} className="demo-mock-pos-tile">{item}</div>
            ))}
          </div>
        </div>
      );
    case 'inventory':
      return (
        <MockShell title="Inventory">
          <Table
            headers={['SKU', 'Product', 'On hand', 'Reserved', 'Status']}
            rows={[
              ['SKU-104', 'Arabica beans 1kg', '24', '3', 'OK'],
              ['SKU-221', 'Paper cups 12oz', '180', '12', 'OK'],
              ['SKU-088', 'Olive oil 5L', '6', '2', 'Low'],
              ['SKU-302', 'Face tissue 2-ply', '0', '0', 'Reorder'],
            ]}
          />
        </MockShell>
      );
    case 'orders':
      return (
        <MockShell title="Orders">
          <Table
            headers={['Order', 'Customer', 'Total', 'Channel', 'Status']}
            rows={[
              ['#1042', 'Walk-in', '$48.20', 'POS', 'Paid'],
              ['#1041', 'Jinan Trading', '$320.00', 'Wholesale', 'Invoiced'],
              ['#1040', 'Online — Hamra', '$62.50', 'Web', 'Packing'],
              ['#1039', 'Talal Co.', '$910.00', 'B2B', 'Partial paid'],
            ]}
          />
        </MockShell>
      );
    case 'invoicing':
      return (
        <MockShell title="Invoicing">
          <Table
            headers={['Document', 'Client', 'Amount', 'Due', 'Status']}
            rows={[
              ['INV-2026-0142', 'Metro Supplies', '$1,240', 'Sep 15', 'Sent'],
              ['INV-2026-0141', 'Cedar Retail', '$480', 'Sep 12', 'Paid'],
              ['BILL-8841', 'Fresh Foods Co.', '$220', 'Sep 18', 'Approved'],
              ['EST-0091', 'New lead — Verdun', '$3,100', '—', 'Draft'],
            ]}
          />
        </MockShell>
      );
    case 'kitchen':
      return (
        <MockShell title="Kitchen">
          <div className="demo-mock-kitchen">
            {[
              { table: 'T4', item: 'Grilled chicken', status: 'Cooking' },
              { table: 'T7', item: 'Pasta arrabiata', status: 'New' },
              { table: 'T2', item: 'Burger + fries', status: 'Ready' },
              { table: 'Delivery', item: 'Family platter', status: 'New' },
            ].map((ticket) => (
              <article key={ticket.table} className={`demo-mock-ticket demo-mock-ticket--${ticket.status.toLowerCase()}`}>
                <p className="demo-mock-ticket-table">{ticket.table}</p>
                <p className="demo-mock-ticket-item">{ticket.item}</p>
                <p className="demo-mock-ticket-status">{ticket.status}</p>
              </article>
            ))}
          </div>
        </MockShell>
      );
    case 'recipes':
      return (
        <MockShell title="Recipes">
          <Table
            headers={['Recipe', 'Yield', 'Food cost', 'Menu price', 'Margin']}
            rows={[
              ['Chicken shawarma plate', '1 serving', '$2.40', '$9.50', '75%'],
              ['Margherita pizza', '1 pizza', '$3.10', '$11.00', '72%'],
              ['House salad', '1 bowl', '$1.20', '$6.00', '80%'],
              ['Cold brew concentrate', '12 cups', '$4.80', '$24.00', '80%'],
            ]}
          />
        </MockShell>
      );
    case 'production':
      return (
        <MockShell title="Production">
          <Table
            headers={['Batch', 'BOM', 'Qty', 'Started', 'Status']}
            rows={[
              ['PR-118', 'Olive soap 100g', '500 units', '09:10', 'Running'],
              ['PR-117', 'Gift box set', '120 units', 'Yesterday', 'QC'],
              ['PR-116', 'Spice blend 250g', '80 units', 'Sep 8', 'Completed'],
            ]}
          />
        </MockShell>
      );
    case 'storefront':
      return (
        <MockShell title="Storefront">
          <div className="demo-mock-storefront">
            <div className="demo-mock-store-hero">
              <p className="demo-mock-store-name">Demo Brand Store</p>
              <p className="demo-mock-store-tagline">New arrivals · Free delivery in Beirut</p>
            </div>
            <div className="demo-mock-store-grid">
              {['Ceramic mug', 'Linen tote', 'Scented candle', 'Gift card'].map((product) => (
                <div key={product} className="demo-mock-store-card">
                  <div className="demo-mock-store-image" />
                  <p>{product}</p>
                  <strong>$24.00</strong>
                </div>
              ))}
            </div>
          </div>
        </MockShell>
      );
    case 'fulfillment':
      return (
        <MockShell title="Fulfillment">
          <Table
            headers={['Order', 'Items', 'Zone', 'Driver', 'Status']}
            rows={[
              ['#1040', '3 SKUs', 'Hamra', 'Karim', 'Out for delivery'],
              ['#1038', '1 SKU', 'Dbayeh', '—', 'Awaiting pick'],
              ['#1035', '5 SKUs', 'Ashrafieh', 'Maya', 'Delivered'],
            ]}
          />
        </MockShell>
      );
    case 'crm':
      return (
        <MockShell title="CRM">
          <div className="demo-mock-crm">
            {[
              { stage: 'Lead', count: 12, value: '$18k' },
              { stage: 'Qualified', count: 7, value: '$42k' },
              { stage: 'Proposal', count: 4, value: '$31k' },
              { stage: 'Won', count: 2, value: '$24k' },
            ].map((col) => (
              <div key={col.stage} className="demo-mock-crm-col">
                <p className="demo-mock-crm-stage">{col.stage}</p>
                <p className="demo-mock-crm-meta">{col.count} deals · {col.value}</p>
                <div className="demo-mock-crm-card">Acme Retail — follow-up visit</div>
                <div className="demo-mock-crm-card">Verdun Café — sample sent</div>
              </div>
            ))}
          </div>
        </MockShell>
      );
    case 'analytics':
      return (
        <MockShell title="Analytics">
          <StatRow
            items={[
              { label: 'Revenue (30d)', value: '$86,420', tone: 'teal' },
              { label: 'Gross margin', value: '38.2%' },
              { label: 'Inventory turns', value: '4.1×' },
              { label: 'Repeat customers', value: '62%' },
            ]}
          />
          <div className="demo-mock-chart" aria-hidden="true">
            <div className="demo-mock-chart-bars">
              {[42, 58, 51, 73, 68, 81, 77].map((h, i) => (
                <div key={i} className="demo-mock-chart-bar" style={{ height: `${h}%` }} />
              ))}
            </div>
            <p className="demo-mock-chart-caption">Weekly sales trend (demo data)</p>
          </div>
        </MockShell>
      );
    case 'finance':
      return (
        <MockShell title="Finance">
          <StatRow
            items={[
              { label: 'Bank balance', value: '$24,800' },
              { label: 'Receivables', value: '$6,120', tone: 'teal' },
              { label: 'Payables', value: '$3,440', tone: 'amber' },
              { label: 'Net this month', value: '$11,200' },
            ]}
          />
          <Table
            headers={['Account', 'Debit', 'Credit', 'Balance']}
            rows={[
              ['Cash — USD', '$4,200', '—', '$24,800'],
              ['Sales revenue', '—', '$18,400', '—'],
              ['COGS', '$6,100', '—', '—'],
              ['Accounts payable', '—', '$1,200', '$3,440'],
            ]}
          />
        </MockShell>
      );
    default:
      return (
        <MockShell title={label}>
          <p className="demo-mock-fallback">Preview screen</p>
        </MockShell>
      );
  }
}

const DemoPreviewMockScreen: React.FC<Props> = ({ type, label }) => (
  <div className="demo-mock-screen">{renderScreen(type, label)}</div>
);

export default DemoPreviewMockScreen;
