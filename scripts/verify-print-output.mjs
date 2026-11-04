import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const [compiledBackend, puppeteerModule, outputDirectory] = process.argv.slice(2);
if (!compiledBackend || !puppeteerModule || !outputDirectory) throw new Error('Usage: verify-print-output.mjs COMPILED_BACKEND PUPPETEER_MODULE OUTPUT_DIRECTORY');
const { PdfService, buildPrintHtml, buildThermalHtml } = await import(pathToFileURL(path.join(compiledBackend, 'src/pdf/pdf.service.js')).href);
const { resolvePreferences } = await import(pathToFileURL(path.join(compiledBackend, 'src/businesses/business-preferences.js')).href);
const { default: puppeteer } = await import(pathToFileURL(puppeteerModule).href);
await mkdir(outputDirectory, { recursive: true });
const service = new PdfService({ get(name) { return name === 'PUPPETEER_EXECUTABLE_PATH' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined; } });
const base = {
  invoiceNumber: 'TEST-INV-0001', status: 'PARTIALLY_PAID', issueDate: '2026-10-31',
  subTotal: 200, taxTotal: 36, discount: 0, grandTotal: 236, amountPaid: 40,
  creditTotal: 20, balanceDue: 176,
  business: { name: 'Synthetic QA Company', gstRegistered: true, stateCode: '29', gstin: '29AAAAA0000A1Z5', address: 'Test address' },
  party: { name: 'Synthetic Test Customer', gstin: '27BBBBB1111B1Z5' },
  items: [{ description: 'Test item', quantity: 2, unit: 'pcs', unitPrice: 100, taxRate: 18, lineTotal: 236, hsnSac: '5208' }],
  notes: 'Synthetic test data. This is not a business transaction.',
};
const results = [];
try {
  for (const entry of [
    { name: 'a4-portrait', mode: 'regular', preferences: { printRegular: { orientation: 'portrait' } }, width: 595.28, height: 841.89, pages: 1 },
    { name: 'a4-landscape', mode: 'regular', preferences: { printRegular: { orientation: 'landscape', template: 'classic' } }, width: 841.89, height: 595.28, minPages: 1 },
    { name: 'thermal-58mm', mode: 'thermal', preferences: { printThermal: { pageSize: '2in' } }, width: 58 * 72 / 25.4, pages: 1 },
    { name: 'thermal-80mm-two-copies', mode: 'thermal', preferences: { printThermal: { pageSize: '3in', numberOfCopies: 2 } }, width: 80 * 72 / 25.4, pages: 2 },
    { name: 'thermal-custom', mode: 'thermal', preferences: { printThermal: { pageSize: 'custom', customWidthChars: 42 } }, width: 42 * 1.65 * 72 / 25.4, pages: 1 },
  ]) {
    const invoice = { ...base, business: { ...base.business, preferences: entry.preferences } };
    const buffer = await service.generateInvoicePdf(invoice, entry.mode);
    const filename = path.join(outputDirectory, `${entry.name}.pdf`);
    await writeFile(filename, buffer);
    const source = buffer.toString('latin1');
    assert.ok(source.startsWith('%PDF-'), 'Output must be an actual PDF');
    const box = source.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
    assert.ok(box, 'PDF media box must be present');
    const width = Number(box[1]), height = Number(box[2]);
    assert.ok(Math.abs(width - entry.width) < 1, `${entry.name}: unexpected paper width ${width}`);
    if (entry.height) assert.ok(Math.abs(height - entry.height) < 1, `${entry.name}: unexpected height`);
    const pages = (source.match(/\/Type\s*\/Page\b/g) || []).length;
    if (entry.pages) assert.equal(pages, entry.pages, `${entry.name}: wrong number of copies/pages`);
    assert.ok(pages >= 1);
    results.push({ name: entry.name, widthPoints: width, heightPoints: height, pages, bytes: buffer.length, passed: true });
  }
} finally { await service.onModuleDestroy(); }
const browser = await puppeteer.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const model = { invoiceLike: true, sale: true, nameKey: 'saleInvoice', number: base.invoiceNumber, status: base.status, issueDate: base.issueDate, logistics: [], business: base.business, party: base.party, partyLabel: 'billedTo', lines: base.items, subTotal: 200, taxTotal: 36, discount: 0, grandTotal: 236, paid: 40, creditAmount: 20, balanceDue: 176, paymentMode: 'cash', notes: base.notes };
  for (const [name, thermal] of [['regular-preview', false], ['thermal-preview', true]]) {
    const preferences = resolvePreferences(thermal ? { printThermal: { pageSize: '3in' } } : {});
    const page = await browser.newPage();
    await page.setViewport({ width: thermal ? 340 : 1000, height: 1000 });
    await page.setContent(thermal ? buildThermalHtml(model, preferences) : await buildPrintHtml(model, preferences), { waitUntil: 'load' });
    await page.screenshot({ path: path.join(outputDirectory, `${name}.png`), fullPage: true });
    await page.close();
  }
} finally { await browser.close(); }
await writeFile(path.join(outputDirectory, 'print-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify({ passed: results.length, results }, null, 2));
