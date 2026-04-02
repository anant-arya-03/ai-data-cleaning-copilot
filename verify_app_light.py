import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("http://localhost:5173/")
        await page.wait_for_selector("text=Code-Mix NLP")

        # Take a screenshot
        await page.screenshot(path="verification/normal_mode_light.png")

        # Click code-mix mode
        await page.click("text=Code-Mix NLP")
        await page.wait_for_timeout(500)
        await page.screenshot(path="verification/codemix_mode_light.png")

        await browser.close()

asyncio.run(main())
