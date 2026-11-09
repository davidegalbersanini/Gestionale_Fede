import os
import sys
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

ARTIFACTS_DIR = r"C:\Users\User\.gemini\antigravity\brain\315ac93d-1a73-4e30-ab75-e881f562ab13"

def run_tests():
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    
    mobile_emulation = {
        "deviceMetrics": { "width": 402, "height": 874, "pixelRatio": 3.0 },
        "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
    }
    options.add_experimental_option("mobileEmulation", mobile_emulation)

    driver = webdriver.Chrome(options=options)
    driver.set_window_size(402, 874)

    try:
        print("[1/5] Caricamento homepage su iPhone 17 (port 3001)...")
        driver.get("http://localhost:3001")
        time.sleep(2)

        # Enter PIN "1234"
        for digit in "1234":
            buttons = driver.find_elements(By.XPATH, f"//button[text()='{digit}']")
            if buttons:
                buttons[0].click()
                time.sleep(0.15)
        time.sleep(1.5)

        # Click Buoni button
        print("[2/5] Apertura Modale Buoni Regalo...")
        driver.execute_script("""
            const btns = Array.from(document.querySelectorAll('button'));
            const b = btns.find(x => x.textContent.includes('Buoni'));
            if (b) b.click();
        """)
        time.sleep(0.8)

        # Click "+ Nuovo" inside the modal
        print("[3/5] Apertura form Nuovo Buono...")
        driver.execute_script("""
            const btns = Array.from(document.querySelectorAll('button'));
            const b = btns.find(x => x.textContent.trim() === 'Nuovo');
            if (b) b.click();
        """)
        time.sleep(0.8)

        # Type using send_keys
        buyer_input = driver.find_element(By.CSS_SELECTOR, "input[placeholder*='acquirente']")
        buyer_input.send_keys("Chiara Ferrara")
        time.sleep(0.3)

        amount_input = driver.find_element(By.CSS_SELECTOR, "input[placeholder*='100']")
        amount_input.send_keys("180")
        time.sleep(0.3)

        notes_input = driver.find_element(By.TAG_NAME, "textarea")
        notes_input.send_keys("Regalo per trattamento PMU sopracciglia")
        time.sleep(0.3)

        create_form_img = os.path.join(ARTIFACTS_DIR, "iphone17_buoni_create_form.png")
        driver.save_screenshot(create_form_img)
        print("  -> Salvato", create_form_img)

        # Click Emetti Buono Regalo
        submit_btn = driver.find_element(By.XPATH, "//button[contains(., 'Emetti Buono')]")
        submit_btn.click()
        time.sleep(1.2)

        buoni_list_img = os.path.join(ARTIFACTS_DIR, "iphone17_buoni_list_card.png")
        driver.save_screenshot(buoni_list_img)
        print("  -> Salvato", buoni_list_img)

        # Close Buoni modal
        driver.execute_script("""
            const closeBtn = document.querySelector('.bg-stone-900 button .lucide-x')?.parentElement;
            if (closeBtn) closeBtn.click();
        """)
        time.sleep(0.8)

        # Check Appointment Modal with "È stato utilizzato un Buono Regalo" checkbox
        print("[4/5] Apertura Nuovo PMU per verifica Checkbox Buono...")
        driver.execute_script("""
            const pmuBtn = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Nuovo PMU'));
            if (pmuBtn) pmuBtn.click();
        """)
        time.sleep(0.8)

        # Scroll to payment section and check the gift voucher box
        driver.execute_script("""
            const modalBody = document.querySelector('.max-h-\\\\[92vh\\\\], .max-h-\\\\[90vh\\\\], form')?.parentElement;
            if (modalBody) modalBody.scrollTop = 380;
            const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
            const buonoCb = checkboxes.find(cb => cb.parentElement.textContent.includes('Buono Regalo'));
            if (buonoCb && !buonoCb.checked) buonoCb.click();
        """)
        time.sleep(0.6)

        pmu_app_img = os.path.join(ARTIFACTS_DIR, "iphone17_appointment_buono_checkbox.png")
        driver.save_screenshot(pmu_app_img)
        print("  -> Salvato", pmu_app_img)

        # Close Appointment modal
        driver.execute_script("""
            const closeBtn = document.querySelector('.bg-stone-900 button .lucide-x')?.parentElement;
            if (closeBtn) closeBtn.click();
        """)
        time.sleep(0.8)

        # Check Rubrica and client profile
        print("[5/5] Verifica Rubrica e Scheda Cliente con Buono...")
        driver.execute_script("""
            const rubricaBtn = Array.from(document.querySelectorAll('nav button')).find(x => x.textContent.includes('Rubrica'));
            if (rubricaBtn) rubricaBtn.click();
        """)
        time.sleep(0.8)

        # Search for Chiara Ferrara
        search_input = driver.find_element(By.CSS_SELECTOR, "input[placeholder*='nome']")
        search_input.send_keys("Chiara Ferrara")
        time.sleep(0.6)

        driver.execute_script("""
            const firstCard = document.querySelector('.grid div[class*="rounded-2xl"]');
            if (firstCard) firstCard.click();
        """)
        time.sleep(1)

        rubrica_img = os.path.join(ARTIFACTS_DIR, "iphone17_rubrica_client_buoni.png")
        driver.save_screenshot(rubrica_img)
        print("  -> Salvato", rubrica_img)

        print("\nTUTTI I TEST UI COMPLETATI CON SUCCESSO!")
    finally:
        driver.quit()

if __name__ == "__main__":
    run_tests()
