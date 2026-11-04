import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const [videoPath, puppeteerPath, outputDirectory] = process.argv.slice(2);
if (!videoPath || !puppeteerPath || !outputDirectory) throw new Error('Usage: inspect-reference.mjs VIDEO PUPPETEER_MODULE OUTPUT_DIRECTORY');
const { default: puppeteer } = await import(pathToFileURL(puppeteerPath).href);
await mkdir(outputDirectory, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(pathToFileURL(videoPath).href);
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
  const duration = await page.evaluate(() => document.querySelector('video').duration);
  console.log(JSON.stringify({ durationSeconds: duration }));
  const frames = [];
  for (let index = 0; index < 24; index++) {
    const seconds = Math.min(duration - 0.1, (index + 0.5) * duration / 24);
    await page.evaluate(async (seconds) => {
      const video = document.querySelector('video');
      video.pause();
      await new Promise((resolve) => { video.addEventListener('seeked', resolve, { once: true }); setTimeout(resolve, 3000); video.currentTime = seconds; });
    }, seconds);
    const element = await page.$('video');
    const frame = `data:image/jpeg;base64,${await element.screenshot({ type: 'jpeg', encoding: 'base64' })}`;
    frames.push({ seconds, frame }); console.log(`Frame ${index + 1}`);
  }
  const sheetPage = await browser.newPage(); await sheetPage.setViewport({ width: 1440, height: 900 });
  for (let sheet = 0; sheet < 4; sheet++) {
    await sheetPage.setContent(`<html><body style="margin:0;background:#eee;font:18px Arial"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${frames.slice(sheet * 6, sheet * 6 + 6).map(({ seconds, frame }) => `<div><div>${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}</div><img style="width:100%" src="${frame}"></div>`).join('')}</div></body></html>`);
    await sheetPage.screenshot({ path: path.join(outputDirectory, `reference-${sheet + 1}.jpg`), fullPage: true });
  }
} finally { await browser.close(); }
