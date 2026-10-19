// Illustrative sample data for the product scenes. Every company, person and
// number here is invented; the page labels these scenes as illustrative.
// Amounts are computed rather than typed so every total on the page adds up.

export const company = {
  name: 'Aranya Electricals Pvt Ltd',
  short: 'Aranya Electricals',
  prefix: 'AE',
  city: 'Bhubaneswar, Odisha',
  gstin: '21ABCDE1234F1Z5',
};

export const customer = {
  name: 'Mahanadi Cold Storage Pvt Ltd',
  city: 'Cuttack, Odisha',
  contact: 'R. Mishra',
};

const fy = '26-27';
export const docNo = (kind: string, n: number) =>
  `${company.prefix}/${fy}/${kind}/${String(n).padStart(3, '0')}`;

export const docs = {
  lead: docNo('LD', 31),
  quotation: docNo('QT', 88),
  salesOrder: docNo('SO', 142),
  deliveryNote: docNo('DN', 97),
  invoice: docNo('SI', 121),
};

export const lines = [
  { item: 'Copper cable 4 sq mm, 90 m coil', hsn: '8544', qty: 40, unit: 'Nos', rate: 6850 },
  { item: 'MCB distribution board, 8-way', hsn: '8537', qty: 40, unit: 'Nos', rate: 2150 },
  { item: 'Industrial exhaust fan 450 mm', hsn: '8414', qty: 24, unit: 'Nos', rate: 4300 },
].map((l) => ({ ...l, amount: l.qty * l.rate }));

export const subtotal = lines.reduce((s, l) => s + l.amount, 0);
export const cgst = Math.round(subtotal * 0.09);
export const sgst = Math.round(subtotal * 0.09);
export const total = subtotal + cgst + sgst;

/** Indian grouping: 546576 → "5,46,576". */
export function inr(n: number, decimals = 0): string {
  const [int, frac] = Math.abs(n).toFixed(decimals).split('.');
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const grouped = rest ? `${rest},${last3}` : last3;
  return (n < 0 ? '-' : '') + grouped + (frac ? `.${frac}` : '');
}

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below100(n: number): string {
  if (n < 20) return ones[n];
  return tens[Math.floor(n / 10)] + (n % 10 ? `-${ones[n % 10]}` : '');
}
function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ones[h]} Hundred` : '', r ? below100(r) : ''].filter(Boolean).join(' ');
}

/** Amount in words, Indian system (lakh, crore), as printed on a tax invoice. */
export function inWords(n: number): string {
  const crore = Math.floor(n / 1e7);
  const lakh = Math.floor((n % 1e7) / 1e5);
  const thousand = Math.floor((n % 1e5) / 1e3);
  const rest = n % 1e3;
  const parts = [
    crore ? `${below100(crore)} Crore` : '',
    lakh ? `${below100(lakh)} Lakh` : '',
    thousand ? `${below100(thousand)} Thousand` : '',
    rest ? below1000(rest) : '',
  ].filter(Boolean);
  return `Rupees ${parts.join(' ')} Only`;
}

export const stock = {
  item: lines[0].item,
  warehouse: 'Main godown',
  before: 212,
  after: 212 - lines[0].qty,
};
