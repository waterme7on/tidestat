export async function selectLanguage(page,value){await page.locator('[data-product-language]').click();await page.locator('.language-options:popover-open [data-language="'+value+'"]').click();}
