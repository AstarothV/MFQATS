// Checks which furniture gets inside-part photos in the Quality Scan (src/app/(staff)/staff/quality-scan/insideParts.ts),
// using the catalog's own names: npm run check:inside-parts
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const file = path.join(__dirname, '../src/app/(staff)/staff/quality-scan/insideParts.ts');
const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const m = { exports: {} };
new Function('module', 'exports', 'require', js)(m, m.exports, require);
const { suggestedParts, nextPartLabel, insideCaption, partOfCaption } = m.exports;

const CABINET = 'Interior, Shelf 1, Door back';
const SHELVES = 'Shelf 1, Shelf 2';
const NONE = '';
const cases = [
  [['Oak Sliding-Door Cabinet', 'Cabinets'], CABINET],
  [['Mid-Century Cabinet', 'Cabinets'], CABINET],
  [['Oak Sideboard', 'Cabinets'], CABINET],
  [['Cube Shelving Unit', 'Storage'], SHELVES],
  [['Glass-Door Bookcase', 'Storage'], SHELVES],
  [['Walnut Bookshelf Unit', 'furniture'], SHELVES],
  [['Oak Chest of Drawers', 'furniture'], 'Drawer 1, Drawer 2'],
  [['Oak Dining Table', 'furniture'], NONE],
  [['Ash Dining Chair', 'Chairs'], NONE],
  [['Oak Queen Bed Frame', 'Beds'], NONE],
  [['Walnut and Steel Desk', 'Office Furniture'], NONE],
  [[null, undefined], NONE],
];
let bad = 0;
for (const [text, want] of cases) {
  const got = suggestedParts(...text).join(', ');
  if (got !== want) bad++;
  console.log(`${got === want ? 'ok ' : 'BAD'} ${text[0]}: ${got || '(no inside parts)'}`);
}
const labels = [
  [nextPartLabel('Shelf', ['Shelf 1', 'Shelf 2']), 'Shelf 3'],
  [nextPartLabel('Drawer', []), 'Drawer 1'],
  [nextPartLabel('Drawer', ['Drawer 2']), 'Drawer 1'],
  [nextPartLabel('Interior', []), 'Interior'],
  [nextPartLabel('Door back', ['Door back']), 'Door back 2'],
  [JSON.stringify(partOfCaption(insideCaption('Drawer 1'))), '{"part":"Drawer 1","closeUp":false}'],
  [JSON.stringify(partOfCaption(insideCaption('Door back', true))), '{"part":"Door back","closeUp":true}'],
  [insideCaption('Shelf 2', true), 'Inside: Shelf 2 close-up'],
  [partOfCaption('Front close-up'), null],
];
labels.forEach(([got, want]) => { if (got !== want) { bad++; console.log(`BAD label: ${got} (wanted ${want})`); } });
console.log(bad ? `${bad} FAILED` : `all ${cases.length + labels.length} checks passed`);
process.exit(bad ? 1 : 0);
