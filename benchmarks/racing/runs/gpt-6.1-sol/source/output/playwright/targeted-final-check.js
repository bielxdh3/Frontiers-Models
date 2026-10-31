async (page) => {
  await page.waitForFunction(() => !!window.__solsticeTest);
  await page.evaluate(async () => { await __solsticeTest.begin({course:'riviera',weather:0,daylight:1}); await __solsticeTest.advance(8,'auto'); });
  await page.locator('[data-action="pause"]').click();
  await page.locator('[data-action="settings"]').click();
  await page.locator('#scale').selectOption('1.25');
  await page.locator('#fps').selectOption('30');
  await page.waitForTimeout(120);
  const scaled = await page.evaluate(() => __solsticeTest.graphics());
  const fs = page.locator('[data-action="fullscreen"]');
  let fullscreen = 'unavailable';
  if (await fs.isEnabled()) { await fs.click(); fullscreen = await page.evaluate(() => !!document.fullscreenElement); if (fullscreen) await fs.click(); }
  await page.locator('#scale').selectOption('1'); await page.locator('#fps').selectOption('60');
  await page.getByRole('button',{name:'Close settings'}).click(); await page.locator('[data-action="resume"]').click();
  const other = await page.context().newPage(); await other.goto('about:blank'); await other.bringToFront(); await other.waitForTimeout(200);
  const background = await page.evaluate(() => ({hidden:document.hidden,status:__solsticeTest.state().status}));
  await other.close(); await page.bringToFront();
  const grid = await page.evaluate(async () => { await __solsticeTest.begin({course:'riviera',car:'mistral',weather:0,daylight:1}); return __solsticeTest.advance(0); });
  await page.screenshot({path:'output/playwright/countdown-grid-visible.png'});
  const audio = await page.evaluate(async () => { await __solsticeTest.begin({course:'horizon'}); await __solsticeTest.advance(26,'idle'); return __solsticeTest.audio(); });
  await page.evaluate(() => __solsticeTest.purge());
  return {scale125:scaled.size,fullscreen,background,gridCars:grid.cars.length,gridStatus:grid.status,terminalAudio:audio,isolatedStoragePurged:true};
}
