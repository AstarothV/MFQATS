// Checks that each piece of an order keeps its own photos (src/lib/pieces.ts): npm run check:pieces
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const src = fs.readFileSync(path.join(__dirname, '../src/lib/pieces.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const m = { exports: {} };
new Function('module', 'exports', 'require', js)(m, m.exports, require);
const { pieceCaption, captionFor, plainCaption, piecesOf, furnitureLabel } = m.exports;

const checks = [
  [pieceCaption('Chair 2 of 4', 'Front photo'), 'Chair 2 of 4 · Front photo'],
  [pieceCaption('', 'Front photo'), 'Front photo'],
  [captionFor('Chair 2 of 4', 'Chair 2 of 4 · Front photo'), 'Front photo'],
  [captionFor('Chair 2 of 4', 'Chair 2 of 4 · Inside: Shelf 1 close-up'), 'Inside: Shelf 1 close-up'],
  [captionFor('Chair 1 of 4', 'Chair 2 of 4 · Front photo'), null], // another chair's photo
  [captionFor('Chair 1 of 4', 'Chair 10 of 12 · Front photo'), null],
  [captionFor('', 'Front photo'), 'Front photo'],
  [captionFor('', 'Chair 2 of 4 · Front photo'), null], // a one-piece order ignores piece photos
  [plainCaption('Chair 3 of 6 · Top close-up'), 'Top close-up'],
  [plainCaption('Front photo'), 'Front photo'],
  [JSON.stringify(piecesOf({ pieces: ['Chair 1 of 4'] })), '["Chair 1 of 4"]'],
  [JSON.stringify(piecesOf(null)), '[]'],
  [furnitureLabel({ product_name: 'Ash Dining Chair', pieces: ['Chair 1 of 4', 'Chair 2 of 4', 'Chair 3 of 4', 'Chair 4 of 4'] }), 'Ash Dining Chair × 4'],
  [furnitureLabel({ product_name: 'Ash Dining Chair + 1 more', pieces: ['a', 'b'] }), 'Ash Dining Chair + 1 more'],
  [furnitureLabel({ product_name: 'Oak Dining Table', pieces: [] }), 'Oak Dining Table'],
  [furnitureLabel({ product_name: 'Oak Dining Table' }), 'Oak Dining Table'],
];
let bad = 0;
checks.forEach(([got, want], i) => {
  if (got !== want) { bad++; console.log(`BAD ${i}: ${got} (wanted ${want})`); }
});
console.log(bad ? `${bad} FAILED` : `all ${checks.length} checks passed`);
process.exit(bad ? 1 : 0);
