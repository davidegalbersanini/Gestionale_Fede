const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function capture() {
  const artifactDir = path.resolve('C:/Users/User/.gemini/antigravity/brain/315ac93d-1a73-4e30-ab75-e881f562ab13');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  await page.setViewport({
    width: 402,
    height: 874,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });

  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  );

  await page.goto('https://gestionale-fede.vercel.app/', { waitUntil: 'networkidle2' });

  // 1. PIN
  await page.screenshot({ path: path.join(artifactDir, 'iphone17_pin.png') });

  // Unlock
  await page.evaluate(() => {
    localStorage.setItem('fede_auth_session', 'authorized');
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));

  // 2. Agenda
  await page.screenshot({ path: path.join(artifactDir, 'iphone17_agenda.png') });

  // 3. Rubrica tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('nav button, div button'));
    const b = btns.find(x => x.textContent.includes('Rubrica'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(artifactDir, 'iphone17_rubrica.png') });

  // 4. Riepilogo / Target Range Rover
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('nav button, div button'));
    const b = btns.find(x => x.textContent.includes('Riepilogo'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(artifactDir, 'iphone17_riepilogo.png') });

  await browser.close();
  console.log('Finished capturing all views!');
}

capture().catch(console.error);
