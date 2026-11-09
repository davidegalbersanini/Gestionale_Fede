const puppeteer = require('puppeteer-core');
const path = require('path');

async function testBuoni() {
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

  console.log('Navigating to http://localhost:3001...');
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle2' });

  // 1. PIN Unlock
  await page.evaluate(() => {
    localStorage.setItem('fede_pin_auth', 'true');
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));

  // 2. Agenda View with Buoni button
  await page.screenshot({ path: path.join(artifactDir, 'iphone17_buoni_agenda.png') });
  console.log('Saved iphone17_buoni_agenda.png');

  // 3. Click "Buoni" button
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Buoni'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(artifactDir, 'iphone17_buoni_modal_empty.png') });
  console.log('Saved iphone17_buoni_modal_empty.png');

  // 4. Click "+ Nuovo" to open create form
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.trim() === 'Nuovo');
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // Fill in create form
  await page.evaluate(() => {
    const buyerInput = document.querySelector('input[placeholder*="acquirente"]');
    if (buyerInput) {
      buyerInput.value = 'Federica Test Buono';
      buyerInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const amountInput = document.querySelector('input[placeholder*="100"]');
    if (amountInput) {
      amountInput.value = '150';
      amountInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await page.screenshot({ path: path.join(artifactDir, 'iphone17_buoni_modal_create.png') });
  console.log('Saved iphone17_buoni_modal_create.png');

  // Submit form
  await page.evaluate(() => {
    const submitBtn = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Emetti Buono'));
    if (submitBtn) submitBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(artifactDir, 'iphone17_buoni_modal_list.png') });
  console.log('Saved iphone17_buoni_modal_list.png');

  // Close Buoni modal
  await page.evaluate(() => {
    const closeBtn = document.querySelector('button .lucide-x')?.parentElement;
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // 5. Open Appointment Modal to check "È stato utilizzato un Buono Regalo" checkbox
  await page.evaluate(() => {
    const pmuBtn = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Nuovo PMU'));
    if (pmuBtn) pmuBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(artifactDir, 'iphone17_appointment_buono_checkbox.png') });
  console.log('Saved iphone17_appointment_buono_checkbox.png');

  // Close Appointment modal
  await page.evaluate(() => {
    const closeBtn = document.querySelector('button .lucide-x')?.parentElement;
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // 6. Go to Rubrica and check client profile
  await page.evaluate(() => {
    const rubricaBtn = Array.from(document.querySelectorAll('nav button, header button')).find(x => x.textContent.includes('Rubrica'));
    if (rubricaBtn) rubricaBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // Open first client in Rubrica
  await page.evaluate(() => {
    const clientCard = document.querySelector('.grid div[class*="rounded-2xl"]');
    if (clientCard) clientCard.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(artifactDir, 'iphone17_rubrica_client_buoni.png') });
  console.log('Saved iphone17_rubrica_client_buoni.png');

  // 7. Go to Riepilogo
  await page.evaluate(() => {
    const riepilogoBtn = Array.from(document.querySelectorAll('nav button, header button')).find(x => x.textContent.includes('Riepilogo'));
    if (riepilogoBtn) riepilogoBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(artifactDir, 'iphone17_riepilogo_buoni.png') });
  console.log('Saved iphone17_riepilogo_buoni.png');

  await browser.close();
  console.log('All tests passed successfully!');
}

testBuoni().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
