import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("http://localhost:5173/")
        await page.wait_for_selector("text=Code-Mix NLP")

        # Click code-mix mode
        await page.click("text=Code-Mix NLP")
        await page.wait_for_timeout(500)

        # Click Batch CSV Analysis tab
        await page.click("text=Batch CSV Analysis")
        await page.wait_for_timeout(500)

        await page.screenshot(path="verification/batch_analysis.png")

        await browser.close()

asyncio.run(main())
