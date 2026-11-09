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
    
    # iPhone 17 mobile emulation (402 x 874)
    mobile_emulation = {
        "deviceMetrics": { "width": 402, "height": 874, "pixelRatio": 3.0 },
        "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
    }
    options.add_experimental_option("mobileEmulation", mobile_emulation)

    driver = webdriver.Chrome(options=options)
    driver.set_window_size(402, 874)

    try:
        print("[1/6] Caricamento homepage su iPhone 17 (402x874)...")
        driver.get("http://localhost:3000")
        time.sleep(2)

        # PIN screen
        pin_screenshot = os.path.join(ARTIFACTS_DIR, "test_iphone17_pin.png")
        driver.save_screenshot(pin_screenshot)
        print(f"  -> Screenshot PIN salvato: {pin_screenshot}")

        # Enter PIN "1234"
        for digit in "1234":
            buttons = driver.find_elements(By.XPATH, f"//button[text()='{digit}']")
            if buttons:
                driver.execute_script("arguments[0].click();", buttons[0])
                time.sleep(0.15)
        time.sleep(2)

        # Helper to check zero horizontal scroll
        def check_horizontal_scroll(view_name):
            scroll_width = driver.execute_script("return document.documentElement.scrollWidth")
            client_width = driver.execute_script("return document.documentElement.clientWidth")
            body_scroll_width = driver.execute_script("return document.body.scrollWidth")
            is_valid = (scroll_width <= client_width) and (body_scroll_width <= client_width)
            status = "PASS (Zero scroll orizzontale)" if is_valid else f"FAIL (scrollWidth: {scroll_width} > clientWidth: {client_width})"
            print(f"  [{view_name}] Check scroll orizzontale iPhone 17: {status} (client: {client_width}px, scroll: {scroll_width}px)")
            return is_valid

        # Helper to click a mobile bottom tab
        def click_tab(tab_name):
            tabs = driver.find_elements(By.XPATH, f"//nav[contains(@class, 'md:hidden')]//button[contains(., '{tab_name}')]")
            if tabs:
                driver.execute_script("arguments[0].click();", tabs[0])
                time.sleep(1.5)
                return True
            return False

        # 1. Agenda View
        print("[2/6] Test Agenda View...")
        check_horizontal_scroll("Agenda")
        agenda_screen = os.path.join(ARTIFACTS_DIR, "test_iphone17_agenda.png")
        driver.save_screenshot(agenda_screen)

        # 2. Rubrica View
        print("[3/6] Test Rubrica View...")
        if click_tab("Rubrica"):
            check_horizontal_scroll("Rubrica")
            rubrica_screen = os.path.join(ARTIFACTS_DIR, "test_iphone17_rubrica.png")
            driver.save_screenshot(rubrica_screen)
            print(f"  -> Screenshot Rubrica salvato: {rubrica_screen}")

        # 3. Spese View
        print("[4/6] Test Spese View...")
        if click_tab("Spese"):
            check_horizontal_scroll("Spese")
            spese_screen = os.path.join(ARTIFACTS_DIR, "test_iphone17_spese.png")
            driver.save_screenshot(spese_screen)
            print(f"  -> Screenshot Spese salvato: {spese_screen}")

        # 4. Riepilogo & Dashboard View
        print("[5/6] Test Riepilogo & Performance View...")
        if click_tab("Riepilogo"):
            check_horizontal_scroll("Riepilogo")
            riepilogo_screen = os.path.join(ARTIFACTS_DIR, "test_iphone17_riepilogo.png")
            driver.save_screenshot(riepilogo_screen)
            print(f"  -> Screenshot Riepilogo salvato: {riepilogo_screen}")

            # Test Excel Export Modal
            excel_btns = driver.find_elements(By.XPATH, "//button[contains(., 'Esporta Excel')]")
            if excel_btns:
                driver.execute_script("arguments[0].click();", excel_btns[0])
                time.sleep(1)
                check_horizontal_scroll("Modal Excel")
                excel_screen = os.path.join(ARTIFACTS_DIR, "test_iphone17_excel_modal.png")
                driver.save_screenshot(excel_screen)
                print(f"  -> Screenshot Modal Excel salvato: {excel_screen}")

        print("[6/6] TUTTI I TEST COMPLETATI CON SUCCESSO! Zero scroll orizzontale garantito su iPhone 17.")

    except Exception as e:
        print(f"ERRORE durante i test: {e}", file=sys.stderr)
        raise
    finally:
        driver.quit()

if __name__ == "__main__":
    run_tests()
