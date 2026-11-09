// Checks how orders are grouped by furniture (src/lib/furniture.ts), with real order names: npm run check:furniture
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const src = fs.readFileSync(path.join(__dirname, '../src/lib/furniture.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const m = { exports: {} };
new Function('module', 'exports', 'require', js)(m, m.exports, require);
const { furnitureOf, byFurniture } = m.exports;

const cases = [
  [{ product_name: 'Oak Dining Table', product_category: 'furniture' }, 'Tables'],
  [{ product_name: 'Cherry Coffee Table', product_category: 'furniture' }, 'Tables'],
  [{ product_name: 'Pine Side Chair', product_category: 'furniture' }, 'Chairs'],
  [{ product_name: 'Walnut Bookshelf Unit', product_category: 'furniture' }, 'Storage'],
  [{ product_name: 'Cherry Bed Frame', product_category: 'furniture' }, 'Beds'],
  [{ product_name: 'Maple Study Desk', product_category: 'furniture' }, 'Office Furniture'],
  [{ product_name: 'Oak Bedside Table', product_category: null }, 'Tables'],
  [{ product_name: 'Glass-Door Bookcase', product_category: 'Storage' }, 'Storage'],
  [{ product_name: 'Oak Sliding-Door Cabinet', product_category: 'Cabinets' }, 'Cabinets'],
  [{ product_name: 'Something odd', product_category: 'furniture' }, 'Other'],
  [null, 'Other'],
];
let bad = 0;
for (const [o, want] of cases) {
  const got = furnitureOf(o);
  if (got !== want) bad++;
  console.log(`${got === want ? 'ok ' : 'BAD'} ${o?.product_name ?? '(none)'}: ${got}`);
}
const groups = byFurniture([{ product_name: 'Pine Side Chair' }, { product_name: 'Oak Dining Table' }, { product_name: 'Odd' }, { product_name: 'Cherry Coffee Table' }])
  .map(([k, l]) => `${k}:${l.map((o) => o.product_name).join('+')}`).join(' | ');
const wantGroups = 'Tables:Oak Dining Table+Cherry Coffee Table | Chairs:Pine Side Chair | Other:Odd';
if (groups !== wantGroups) { bad++; console.log(`BAD groups: ${groups}`); }
console.log(bad ? `${bad} FAILED` : `all ${cases.length + 1} checks passed`);
process.exit(bad ? 1 : 0);
