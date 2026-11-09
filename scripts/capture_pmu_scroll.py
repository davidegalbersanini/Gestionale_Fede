import time, os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

options = Options()
options.add_argument('--headless=new')
options.add_argument('--no-sandbox')
mobile_emulation = {
    'deviceMetrics': { 'width': 402, 'height': 874, 'pixelRatio': 3.0 },
    'userAgent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
}
options.add_experimental_option('mobileEmulation', mobile_emulation)

driver = webdriver.Chrome(options=options)
driver.set_window_size(402, 874)

driver.get('http://localhost:3001')
time.sleep(1.5)
for digit in '1234':
    b = driver.find_elements('xpath', f'//button[text()="{digit}"]')
    if b: b[0].click()
time.sleep(1)

# Open PMU
driver.execute_script('''
  const pmuBtn = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Nuovo PMU'));
  if (pmuBtn) pmuBtn.click();
''')
time.sleep(0.8)

# Scroll modal container to payment section and check the gift voucher box
driver.execute_script('''
  const scrollable = document.querySelector('div.fixed.inset-0 > div');
  if (scrollable) scrollable.scrollTop = 580;
  const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
  const cb = checkboxes.find(c => c.parentElement.textContent.includes('Buono Regalo'));
  if (cb && !cb.checked) cb.click();
''')
time.sleep(0.6)

artifact = r'C:\Users\User\.gemini\antigravity\brain\315ac93d-1a73-4e30-ab75-e881f562ab13\iphone17_appointment_buono_checkbox.png'
driver.save_screenshot(artifact)
driver.quit()
print('Saved scrolled appointment screenshot!')
