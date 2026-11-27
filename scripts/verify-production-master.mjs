import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import path from 'node:path';

const [origin, puppeteerPath, output] = process.argv.slice(2);
if (!origin || !puppeteerPath || !output) throw new Error('Usage: verify-production-master.mjs ORIGIN PUPPETEER_MODULE OUTPUT_DIRECTORY');
const { default: puppeteer } = await import(pathToFileURL(puppeteerPath).href);
const env = await readFile('.env', 'utf8');
const api = new URL(env.match(/^NEXT_PUBLIC_API_URL\s*=\s*["']?([^\r\n"']+)/m)?.[1]?.trim() || 'http://localhost:4000/api/v1', origin);
const prefix = api.pathname.replace(/\/$/, '');
const id = (n) => `40000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const user = { id: id(1), name: 'QA Owner', email: 'qa@example.invalid', role: 'OWNER', sessionId: 'fixture', mfaEnabled: true, mfaVerified: true };
const business = { id: id(2), name: 'Test company', isActive: true, workspaceBranchId: id(4), preferences: {} };
const branch = { id: id(3), businessId: business.id, name: 'Main', code: 'MAIN', isActive: true };
const party = { id: id(5), name: 'Test customer', phone: '9999999998' };
const supplier = { id: id(6), name: 'Test supplier', phone: '9999999997' };
const image = (n) => ({ id: id(10 + n), fileName: `${n}.png`, mimeType: 'image/png', size: 100, displayName: `Artwork ${n}`, stageType: 'MASTER', createdAt: `2026-11-26T10:00:0${n}Z`, color: n === 1 ? 'White' : 'Navy' });
let order = {
  id: id(7), orderNumber: 'PO-QA', party, supplier, styleName: 'QA Polo', fabricName: 'Cotton', fabricGsm: '180 GSM',
  orderedQty: 53, saleRate: '100', supplierRate: '60', status: 'DRAFT', orderDate: '2026-11-26', dueDate: '2026-12-03',
  createdAt: '2026-11-26T10:00:00Z', transport: 'Test transport', destination: 'Chennai', invoiceDetails: 'Invoice after approval',
  sizeColorBreakdown: { White: { S: 10, M: 20, '4XL': 7 }, Navy: { S: 5, L: 8, '4XL': 3 } }, sizeBreakdown: { S: 15, M: 20, L: 8, '4XL': 10 },
  instructions: { product: [{ item: 'Collar', detail: 'Rib collar' }], accessories: [{ item: 'Tag', detail: 'Blue tag' }], packing: [{ item: 'Fold', detail: 'Single fold' }], printEmbroidery: [{ method: 'Embroidery', placement: 'Left chest', detail: 'White logo' }] },
  notes: 'Initial notes', stages: [], costs: [], images: [image(2), image(1)],
  summary: { revenue: 5300, processCost: 0, materialCost: 0, totalMakingCost: 0, costPerPiece: 0, profit: 5300, marginPercent: 100, packedQty: 0, progressPercent: 0 },
};
const errors = [], mutations = [], checks = [];
let newOrderImageAttempts = 0;
let png;
function fixture(endpoint) {
  if (endpoint === '/auth/me') return user;
  if (endpoint === '/businesses') return [business];
  if (endpoint === `/businesses/${business.id}`) return business;
  if (endpoint === `/businesses/${business.id}/preferences`) return {};
  if (endpoint.endsWith('/members')) return [user];
  if (endpoint === '/branches') return [branch];
  if (endpoint === '/workspace-branches') return [{ id: id(4), name: 'Test workspace', businesses: [business], isActive: true }];
  if (endpoint === '/parties') return [party];
  if (endpoint === '/suppliers') return [supplier];
  if (['/invoices', '/items', '/documents', '/expenses'].includes(endpoint)) return [];
  if (endpoint === '/production-orders/capabilities') return { masterVersion: 2 };
  if (endpoint === '/production-orders') return [order];
  if (endpoint === `/production-orders/${order.id}`) return order;
  throw new Error(`Missing fixture: ${endpoint}`);
}
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-gpu', '--no-sandbox'], timeout: 60000, protocolTimeout: 60000 });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await page.evaluateOnNewDocument((businessId, branchId, workspaceId) => {
    localStorage.setItem('activeBusinessId', businessId);
    localStorage.setItem(`activeBranchId:${businessId}`, branchId);
    localStorage.setItem('activeWorkspaceBranchId', workspaceId);
    window.exportedText = [];
    window.downloadAttempts = 0;
    window.nativeSharingSupported = true;
    window.imageUploadNames = [];
    const append = FormData.prototype.append;
    FormData.prototype.append = function (key, value, ...rest) { if (key === 'image' && value instanceof File) window.imageUploadNames.push(value.name); return append.call(this, key, value, ...rest); };
    const anchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.hasAttribute('download')) {
        window.downloadAttempts++;
        const name = this.download;
        window.downloadedFile = fetch(this.href).then(async (response) => {
          const blob = await response.blob();
          const data = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(blob); });
          return { name, type: blob.type, data };
        });
        return;
      }
      return anchorClick.call(this);
    };
    document.addEventListener('click', (event) => {
      const anchor = event.target.closest?.('a');
      if (anchor?.hasAttribute('download')) { window.downloadAttempts++; event.preventDefault(); }
      if (anchor?.hasAttribute('data-share-whatsapp')) { window.whatsappOpened = anchor.href; event.preventDefault(); }
    }, true);
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (value, ...args) { window.exportedText.push(value); return original.call(this, value, ...args); };
    // Keep the test in-browser; no operating system share dialog or external message is opened.
    Object.defineProperty(navigator, 'canShare', { value: (data) => window.nativeSharingSupported && data.files.length === 1 && data.files[0].type === 'application/pdf' });
    Object.defineProperty(navigator, 'share', { value: async (data) => {
      if (window.shareFailure === 'cancel') throw new DOMException('Cancelled', 'AbortError');
      if (window.shareFailure === 'fail') throw new DOMException('Sharing unavailable', 'NotAllowedError');
      window.lastShareKeys = Object.keys(data);
      window.sharePayload = data.files;
      window.sharedFiles = data.files.map((file) => ({ name: file.name, size: file.size, type: file.type }));
    } });
  }, business.id, branch.id, id(4));
  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    const url = new URL(request.url());
    try {
      if (url.origin === api.origin && url.pathname.startsWith(prefix)) {
        const headers = { 'access-control-allow-origin': new URL(origin).origin, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type,x-business-id,x-branch-id' };
        if (request.method() === 'OPTIONS') return await request.respond({ status: 204, headers });
        const endpoint = url.pathname.slice(prefix.length);
        if (endpoint.includes('/images/') && request.method() === 'GET') return await request.respond({ status: 200, headers, contentType: 'image/png', body: png });
        let value;
        if (request.method() === 'PATCH' && endpoint.endsWith('/master')) {
          const payload = JSON.parse(request.postData()); mutations.push({ method: 'PATCH', endpoint, payload });
          order = { ...order, ...payload }; value = order;
        } else if (request.method() === 'POST' && endpoint.endsWith('/images')) {
          if (order.id === id(8) && ++newOrderImageAttempts === 2) {
            mutations.push({ method: 'POST', endpoint, failed: true });
            return await request.respond({ status: 500, headers, contentType: 'application/json', body: JSON.stringify({ message: 'Simulated image upload failure' }) });
          }
          const nextNumber = order.images.length + 1;
          const name = await page.evaluate(() => window.imageUploadNames.at(-1));
          const nextImage = order.id === id(8) ? { ...image(nextNumber), fileName: name, displayName: name } : image(nextNumber);
          mutations.push({ method: 'POST', endpoint, fileName: name }); order = { ...order, images: [nextImage, ...order.images] }; value = order;
        } else if (request.method() === 'POST' && endpoint === '/production-orders') {
          const payload = JSON.parse(request.postData()); mutations.push({ method: 'POST', endpoint, payload });
          order = { ...order, ...payload, id: id(8), images: [] }; value = order;
        } else {
          assert.equal(request.method(), 'GET'); value = fixture(endpoint);
        }
        return await request.respond({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(value) });
      }
      if (url.origin === new URL(origin).origin || ['data:', 'blob:', 'about:'].includes(url.protocol)) return await request.continue();
      await request.abort();
    } catch (cause) { errors.push(String(cause)); await request.respond({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: String(cause) }) }); }
  });
  page.on('pageerror', (cause) => errors.push(cause.message));
  // Generate a real local PNG to exercise authenticated image loading and canvas drawing.
  await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 60000 });
  png = Buffer.from(await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#125ad0'; ctx.fillRect(0, 0, 100, 100); return canvas.toDataURL().split(',')[1]; }), 'base64');
  await writeFile(path.join(output, 'upload.png'), png);
  const click = async (label) => {
    await page.waitForFunction((text) => [...document.querySelectorAll('button')].some((button) => button.textContent.trim() === text), {}, label);
    await page.evaluate((text) => [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === text).click(), label);
  };
  const waitShare = async () => {
    await page.waitForSelector('[role="dialog"] [data-image-preparation="ready"]', { timeout: 60000 });
    await page.waitForFunction(() => !window.nativeSharingSupported || Boolean(document.querySelector('[data-share-whatsapp-files]')), { timeout: 60000 });
    await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] img')].every((img) => img.complete && img.naturalWidth > 0));
  };
  await page.goto(`${origin}/production/${order.id}`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('[aria-label="Color-wise total"]');
  const totals = await page.$eval('[aria-label="Color-wise total"]', (node) => node.textContent);
  assert.match(totals, /White.*37 pcs.*Navy.*16 pcs.*Total: 53 pcs/);
  assert.match(await page.$eval('[aria-label="Size-wise total"]', (node) => node.textContent), /4XL.*10 pcs/);
  const galleryNames = await page.$$eval('img', (nodes) => nodes.map((node) => node.alt).filter((alt) => alt.startsWith('Artwork')));
  assert.deepEqual(galleryNames, ['Artwork 1', 'Artwork 2']); checks.push('saved totals and oldest-first gallery');
  const upload = await page.$('input[type="file"]'); await upload.uploadFile(path.resolve(output, 'upload.png'));
  await page.waitForFunction(() => document.body.innerText.includes('Image 3'));
  await page.waitForSelector('img[alt="Artwork 3"]');
  const galleryAfter = await page.$$eval('img', (nodes) => nodes.map((node) => node.alt).filter((alt) => alt.startsWith('Artwork')));
  assert.deepEqual(galleryAfter, ['Artwork 1', 'Artwork 2', 'Artwork 3']); checks.push('new upload stays third');
  await click('Edit order');
  await page.waitForSelector('[role="dialog"] [aria-label="Color-wise total"]');
  assert.equal(await page.$$eval('[aria-label="Order master images"] [data-master-image-number]', (images) => images.length), 3, 'saved images appear in the master beside notes');
  const customSize = await page.$eval('[role="dialog"]', (dialog) => [...dialog.querySelectorAll('label')].some((label) => label.textContent === '4XL'));
  assert.ok(customSize, 'existing custom sizes are retained when editing');
  await page.evaluate(() => {
    const textarea = document.querySelector('[role="dialog"] textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, 'Updated confirmation notes');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await click('Save changes'); await waitShare();
  assert.equal(mutations.find((entry) => entry.method === 'PATCH').payload.orderedQty, 53);
  assert.equal(mutations.find((entry) => entry.method === 'PATCH').payload.sizeBreakdown['4XL'], 10);
  const exported = await page.evaluate(() => window.exportedText.join('\n'));
  for (const value of ['Color-wise total:', 'Size-wise total:', 'Rib collar', 'Blue tag', 'Single fold', 'White logo', 'Updated confirmation notes', 'Image 1: Artwork 1', 'Image 2: Artwork 2', 'Image 3: Artwork 3']) assert.ok(exported.includes(value), `Export missing ${value}`);
  assert.ok(!exported.includes('Supplier estimate') && !exported.includes('Estimated spread'));
  assert.equal(await page.$$eval('[role="dialog"] a[href*="wa.me"]', (links) => links.length), 0, 'no WhatsApp text-message links');
  assert.ok(!(await page.$eval('[role="dialog"]', (dialog) => dialog.textContent)).includes('Send message only'));
  assert.equal(await page.$$eval('[role="dialog"] [download]', (links) => links.length), 0);
  const detailText = await page.$eval('[aria-label="Complete order details"]', (panel) => panel.textContent);
  for (const value of ['Rib collar', 'Blue tag', 'Single fold', 'White logo', 'Updated confirmation notes']) assert.ok(detailText.includes(value));
  assert.equal(await page.$$eval('[role="dialog"] [role="tab"]', (tabs) => tabs.length), 0);
  await page.click('[data-share-whatsapp-files]');
  const shared = await page.evaluate(() => window.sharedFiles);
  assert.equal(shared.length, 1, 'only the confirmation PDF is shared');
  assert.equal(shared.filter((file) => file.type === 'image/png').length, 0);
  assert.equal(shared.filter((file) => file.type === 'application/pdf').length, 1);
  assert.deepEqual(await page.evaluate(() => window.lastShareKeys), ['files'], 'no text, title, caption or URL is added');
  assert.ok(shared.every((file) => file.size > 0));
  assert.equal(await page.evaluate(() => window.downloadAttempts), 0, 'image sharing must never download a file');
  const documents = await page.evaluate(() => Promise.all(window.sharePayload.map((file) => new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve({ name: file.name, data: reader.result.split(',')[1] }); reader.readAsDataURL(file); }))));
  for (const file of documents) await writeFile(path.join(output, file.name), Buffer.from(file.data, 'base64'));
  assert.equal(await page.$$eval('[aria-label="Order artwork"] img', (images) => images.length), 3);
  checks.push('one compact details panel with all artwork and no second details page');
  checks.push('WhatsApp shares one PDF with embedded images and no message or image attachments');
  await page.evaluate(() => { window.shareFailure = 'cancel'; });
  await page.click('[data-share-whatsapp-files]');
  await page.waitForFunction(() => !document.querySelector('[data-share-whatsapp-files]').disabled);
  assert.equal(await page.$$eval('[role="dialog"] [role="alert"]', (alerts) => alerts.length), 0);
  await page.evaluate(() => { window.shareFailure = 'fail'; });
  await page.click('[data-share-whatsapp-files]');
  await page.waitForSelector('[role="dialog"] [role="alert"]');
  assert.equal(await page.evaluate(() => window.downloadAttempts), 0, 'failed or cancelled sharing must not download or fall back to messaging');
  assert.equal(await page.$$eval('[role="dialog"] a', (links) => links.length), 0);
  await page.evaluate(() => { window.shareFailure = ''; });
  await page.click('[data-share-whatsapp-files]');
  checks.push('cancelled and failed PDF sharing never sends a message or starts a download');
  await page.$eval('[role="dialog"]', (dialog) => { dialog.scrollTop = 0; });
  await page.screenshot({ path: path.join(output, 'desktop-share.png'), fullPage: false });
  await page.click('[aria-label="Close dialog"]');
  await page.setViewport({ width: 390, height: 844 });
  await click('Share for confirmation'); await waitShare();
  const dimensions = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  assert.ok(dimensions.content <= dimensions.width + 2, 'mobile overflow');
  await page.screenshot({ path: path.join(output, 'mobile-share.png'), fullPage: false });
  await page.$eval('[aria-label="Sharing options"]', (panel) => panel.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: path.join(output, 'mobile-share-options.png'), fullPage: false });
  checks.push('mobile share layout');
  await page.evaluate(() => { window.nativeSharingSupported = false; });
  await page.click('[aria-label="Close dialog"]');
  await click('Share for confirmation'); await waitShare();
  assert.equal(await page.$$eval('[role="dialog"] button', (buttons) => buttons.filter((button) => button.textContent === 'Share images').length), 0);
  assert.equal(await page.$eval('[data-share-whatsapp-files]', (button) => button.disabled), true);
  assert.equal(await page.$$eval('[role="dialog"] a', (links) => links.length), 0);
  assert.equal(await page.evaluate(() => window.downloadAttempts), 0, 'unsupported native sharing must not trigger a download fallback');
  checks.push('unsupported PDF sharing shows manual attachment guidance with no message fallback');
  await click('Download PDF');
  await page.waitForFunction(() => window.downloadAttempts === 1, { timeout: 60000 });
  const pdf = await page.evaluate(() => window.downloadedFile);
  assert.equal(pdf.name, 'PO-QA-confirmation.pdf');
  assert.equal(pdf.type, 'application/pdf');
  const pdfBytes = Buffer.from(pdf.data, 'base64');
  assert.equal(pdfBytes.subarray(0, 5).toString(), '%PDF-');
  const pageCount = [...pdfBytes.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length;
  assert.ok(pageCount >= 4, 'PDF contains full order details and all three artwork images');
  await writeFile(path.join(output, pdf.name), pdfBytes);
  await page.$eval('[data-share-whatsapp-files]', (button) => button.click());
  assert.equal(await page.evaluate(() => window.downloadAttempts), 1, 'WhatsApp must not repeat the PDF download');
  checks.push('separate PDF button downloads one valid PDF with order details and artwork');
  await page.click('[aria-label="Close dialog"]');
  await page.setViewport({ width: 1440, height: 1000 });
  await click('New order');
  await page.waitForSelector('[role="dialog"] input[placeholder="Men\'s polo T-shirt"]');
  await page.type('[role="dialog"] input[placeholder="Men\'s polo T-shirt"]', 'New style');
  await page.evaluate(() => {
    const inputs = document.querySelectorAll('[role="dialog"] input');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (const input of inputs) {
      if (input.type === 'number' && input.min === '0') { set.call(input, input.step === '0.01' ? '50' : '1'); input.dispatchEvent(new Event('input', { bubbles: true })); }
    }
    const color = document.querySelector('[aria-label="Color 1"]'); set.call(color, 'Red'); color.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await writeFile(path.join(output, 'first.png'), png);
  await writeFile(path.join(output, 'second.png'), png);
  const masterInput = await page.$('[aria-label="Add order master images"]');
  await masterInput.uploadFile(path.resolve(output, 'first.png'));
  await masterInput.uploadFile(path.resolve(output, 'second.png'));
  const selectedNames = await page.$$eval('[aria-label="Order master images"] [data-master-image-number]', (images) => images.map((image) => ({ number: image.dataset.masterImageNumber, name: image.querySelector('p').textContent })));
  assert.deepEqual(selectedNames, [{ number: '1', name: 'first.png' }, { number: '2', name: 'second.png' }]);
  const layout = await page.$eval('[data-master-notes-images]', (row) => { const notes = row.querySelector('textarea').getBoundingClientRect(); const images = row.querySelector('[aria-label="Order master images"]').getBoundingClientRect(); return { notesRight: notes.right, imagesLeft: images.left }; });
  assert.ok(layout.notesRight <= layout.imagesLeft, 'images are beside Additional notes on desktop');
  await page.$eval('[data-master-notes-images]', (row) => row.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: path.join(output, 'master-images-desktop.png'), fullPage: false });
  await page.setViewport({ width: 390, height: 844 });
  const mobileForm = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  assert.ok(mobileForm.content <= mobileForm.width + 2, 'master form has no mobile overflow');
  await page.$eval('[data-master-notes-images]', (row) => row.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: path.join(output, 'master-images-mobile.png'), fullPage: false });
  checks.push('notes and numbered image previews are adjacent on desktop and fit mobile');
  await click('Save draft order');
  await page.waitForFunction(() => document.body.innerText.includes('Save again to retry the remaining images'));
  assert.equal(order.images.length, 1, 'first image is saved before the second upload fails');
  await click('Save draft order'); await waitShare();
  assert.equal(mutations.filter((entry) => entry.method === 'POST' && entry.endpoint === '/production-orders').length, 1, 'retry must not create another order');
  assert.deepEqual(await page.evaluate(() => window.imageUploadNames.slice(-3)), ['first.png', 'second.png', 'second.png'], 'retry skips the successfully uploaded first image');
  assert.deepEqual([...order.images].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((image) => image.fileName), ['first.png', 'second.png']);
  assert.deepEqual(await page.$$eval('[aria-label="Order artwork"] img', (images) => images.map((image) => image.alt)), ['Image 1: first.png', 'Image 2: second.png']);
  checks.push('master uploads images sequentially and resumes a failed upload without duplicates');
  assert.ok(mutations.some((entry) => entry.method === 'POST' && entry.endpoint === '/production-orders'));
  checks.push('new draft save automatically opens confirmation sharing');
  assert.equal(await page.evaluate(() => window.downloadAttempts), 1, 'saving an order must not download a PDF');
  await page.evaluate(() => { window.nativeSharingSupported = true; });
  await page.click('[aria-label="Close dialog"]');
  await click('Share for confirmation'); await waitShare();
  await page.click('[data-share-whatsapp-files]');
  const newBundle = await page.evaluate(() => window.sharedFiles);
  assert.equal(newBundle.length, 1, 'new order shares only its confirmation PDF');
  assert.equal(newBundle.filter((file) => file.type === 'image/png').length, 0);
  assert.equal(newBundle.filter((file) => file.type === 'application/pdf').length, 1);
  assert.deepEqual(await page.evaluate(() => window.lastShareKeys), ['files']);
  const updatedText = await page.evaluate(() => window.exportedText.join('\n'));
  assert.ok(updatedText.includes('Image 1: first.png') && updatedText.includes('Image 2: second.png'));
  assert.equal(await page.evaluate(() => window.downloadAttempts), 1, 'sharing the new images and PDF must not download files');
  checks.push('new master images are embedded inside the single WhatsApp PDF');
  assert.equal(errors.length, 0, errors.join('\n'));
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, mutations, errors, databaseAccess: false, externalMessagesSent: false }, null, 2));
  await unlink(path.join(output, 'failure.json')).catch((cause) => { if (cause.code !== 'ENOENT') throw cause; });
  console.log(JSON.stringify({ passed: checks.length, databaseAccess: false, externalMessagesSent: false }));
} catch (cause) {
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({ checks, errors, mutations, message: String(cause) }, null, 2));
  throw cause;
} finally { await browser.close(); }
