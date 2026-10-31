async (page) => {
  const state = await page.evaluate(async () => {
    await __solsticeTest.begin({course:'riviera',car:'mistral',weather:0,daylight:1,difficulty:1});
    return __solsticeTest.state();
  });
  await page.waitForTimeout(120);
  await page.screenshot({path:'output/playwright/countdown-grid-visible.png'});
  await page.evaluate(() => {
    return __solsticeTest.advance(12,'auto',1);
  });
  await page.screenshot({path:'output/playwright/village-visible.png'});
  await page.locator('[data-action="pause"]').click();
  await page.locator('[data-action="settings"]').click();
  await page.locator('#scale').selectOption('1.25');
  await page.locator('#fps').selectOption('30');
  await page.locator('[data-pref="reducedMotion"]').check();
  await page.waitForTimeout(100);
  const scaled = await page.evaluate(() => __solsticeTest.graphics());
  const button = page.locator('[data-action="fullscreen"]');
  let fullscreen = 'unavailable';
  if (await button.isEnabled()) {
    await button.click();
    fullscreen = await page.evaluate(() => !!document.fullscreenElement);
    if (fullscreen) await button.click();
  }
  await page.locator('#scale').selectOption('1');
  await page.locator('#fps').selectOption('60');
  await page.getByRole('button',{name:'Close settings'}).click();
  await page.locator('[data-action="resume"]').click();
  const other = await page.context().newPage();
  await other.goto('about:blank'); await other.bringToFront(); await other.waitForTimeout(200);
  const background = await page.evaluate(() => ({hidden:document.hidden,status:__solsticeTest.state().status}));
  await other.close(); await page.bringToFront();
  await page.evaluate(async () => {
    await __solsticeTest.begin({course:'coastal',car:'tern',weather:0,daylight:0});
    await __solsticeTest.advance(18,'auto',2);
  });
  await page.screenshot({path:'output/playwright/viaduct-visible.png'});
  const audio = await page.evaluate(() => __solsticeTest.audio());
  console.log(JSON.stringify({initialCars:state.cars.length,scaled,fullscreen,background,audio}));
}
