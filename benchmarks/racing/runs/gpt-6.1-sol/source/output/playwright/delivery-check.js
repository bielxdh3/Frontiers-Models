async (page) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:4173');
  await page.locator('[data-action="course"][data-value="riviera"]').click();
  await page.locator('[data-action="start"]').click();
  await page.locator('#mode-hud').waitFor();
  await page.waitForTimeout(160);
  await page.screenshot({path:'output/playwright/production-countdown-grid.png'});
  const grid = await page.locator('.live-standings > div').count();
  const absent = await page.evaluate(() => typeof window.__solsticeTest === 'undefined');
  await page.goto('http://127.0.0.1:4173');
  await page.getByRole('button',{name:'Let’s drive',exact:true}).waitFor();
  await page.waitForTimeout(100);
  await page.screenshot({path:'output/playwright/delivery-menu.png'});
  return {url:page.url(),gridCars:grid,productionHarnessAbsent:absent,errors,menuReady:true};
}
