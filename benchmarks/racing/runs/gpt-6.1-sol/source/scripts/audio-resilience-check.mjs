import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const context = await browser.newContext({viewport:{width:1280,height:720}});
  await context.addInitScript(() => { const Audio = window.AudioContext || window.webkitAudioContext; if (Audio) Audio.prototype.resume = () => new Promise(() => {}); });
  const page = await context.newPage(); await page.goto('http://127.0.0.1:5173/');
  await page.locator('[data-action="setup"]').first().click(); await page.locator('[data-action="start"]').click();
  await page.waitForTimeout(700);
  const started = await page.locator('#mode-hud').count() === 1;
  const report = {injection:'AudioContext.resume never settles',raceStarted:started,expectedBlocked:process.env.EXPECT_AUDIO_BLOCK === '1'};
  await writeFile(`output/playwright/audio-${report.expectedBlocked?'red':'green'}.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report)); assert.equal(started,!report.expectedBlocked);
} finally {await browser.close();}
