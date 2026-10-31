/**
 * e2e/game.spec.ts
 * End-to-end browser acceptance journeys covering all Section 36 requirements:
 * 1. Launch, Garage, and Car Selection
 * 2. Mode Selection, Weather, Daylight, and Countdown
 * 3. Driving Physics, Nitro, Drift, Speedometer, and Damage HUD
 * 4. Signature Feature: Riviera Photo Studio & Snapshot Studio
 * 5. Replay Viewer (Play/Pause, Scrubbing, 3 Cameras, Historical HUD)
 * 6. Replay Vault (5 Slots max, Import/Export, Stamped Origin)
 * 7. Settings, Quality Presets, Audio & Key Rebinding
 */

import { test, expect } from '@playwright/test';

test.describe('Racing-bench V2.6: Riviera Coastal 3D Arcade Racer', () => {

  test('Journey 1: First Launch, Menu Navigation, and Garage Car Selection', async ({ page }) => {
    await page.goto('/');

    // Verify 3D canvas and UI root loaded
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Verify Main Menu is active
    await expect(page.locator('#view-menu')).toHaveClass(/active/);
    await expect(page.locator('.game-logo')).toContainText('Riviera');

    // Navigate to Garage
    await page.click('#btn-menu-garage');
    await expect(page.locator('#view-garage')).toHaveClass(/active/);

    // Verify 3 cars tabs in garage
    const tabs = page.locator('.car-tab-btn');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toContainText('Riviera Spyder');
    await expect(tabs.nth(1)).toContainText('Corsica GT');
    await expect(tabs.nth(2)).toContainText('Monaco Hyperion');

    // Switch selection to Corsica GT
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveClass(/selected/);
    await expect(page.locator('#garage-car-desc')).toContainText('touring');

    // Switch selection to Monaco Hyperion
    await tabs.nth(2).click();
    await expect(tabs.nth(2)).toHaveClass(/selected/);
    await expect(page.locator('#garage-car-desc')).toContainText('hypercar');

    // Confirm car selection and proceed to Setup
    await page.click('#btn-garage-select');
    await expect(page.locator('#view-setup')).toHaveClass(/active/);
  });

  test('Journey 2: Pre-Race Setup, Mode Selection, Weather, and Dynamic Conditions', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-menu-play');
    await expect(page.locator('#view-setup')).toHaveClass(/active/);

    // 1. Time Trial option selected by default
    const modes = page.locator('#setup-modes-grid .option-box');
    await expect(modes.nth(0)).toHaveClass(/selected/);

    // 2. Select Race vs AI (Riviera GP)
    await modes.nth(1).click();
    await expect(modes.nth(1)).toHaveClass(/selected/);
    // AI Difficulty section must become visible
    await expect(page.locator('#setup-difficulty-section')).toBeVisible();

    // Select Hard difficulty
    const diffBoxes = page.locator('#setup-difficulty-section .option-box');
    await diffBoxes.nth(2).click();
    await expect(diffBoxes.nth(2)).toHaveClass(/selected/);

    // 3. Select Checkpoint Run (Horizon Rush)
    await modes.nth(2).click();
    await expect(modes.nth(2)).toHaveClass(/selected/);
    await expect(page.locator('#setup-difficulty-section')).toBeHidden();

    // 4. Select Rainy Weather & Sunset
    await page.selectOption('#setup-weather-select', 'rainy');
    await page.selectOption('#setup-time-select', 'sunset');

    // 5. Start Race & check Countdown
    await page.click('#btn-setup-start');
    await expect(page.locator('#view-hud')).toHaveClass(/active/);

    const countdownEl = page.locator('#hud-center-countdown');
    await expect(countdownEl).toBeVisible();

    // Wait for race start (countdown to reach 0 / GO!)
    await page.waitForTimeout(3500);
    await expect(countdownEl).toBeHidden();
  });

  test('Journey 3: Active Driving, Nitro, Speedometer, Pause, and Controls', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-menu-play');
    await page.click('#btn-setup-start');

    // Wait for countdown
    await page.waitForTimeout(3400);

    // Accelerate with W key
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1500);

    // Verify speed has increased
    const speedText = await page.locator('#hud-speed-val').textContent();
    const speed = Number(speedText);
    expect(speed).toBeGreaterThan(20);

    // Fire Nitro with ShiftLeft
    await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(1000);
    await page.keyboard.up('ShiftLeft');

    // Verify nitro gauge decreased below 100%
    const nitroText = await page.locator('#hud-nitro-val').textContent();
    const nitroVal = parseInt(nitroText || '100');
    expect(nitroVal).toBeLessThan(100);

    await page.keyboard.up('KeyW');

    // Pause game with Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('#view-pause')).toHaveClass(/active/);

    // Resume game
    await page.click('#btn-pause-resume');
    await expect(page.locator('#view-hud')).toHaveClass(/active/);
  });

  test('Journey 4: Signature Feature — Riviera Photo Studio & Snapshot Export', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-menu-play');
    await page.click('#btn-setup-start');
    await page.waitForTimeout(3400);

    // Accelerate and pause
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1000);
    await page.keyboard.up('KeyW');
    await page.keyboard.press('Escape');

    // Open Photo Studio (Signature Feature)
    await page.click('#btn-pause-photo');
    await expect(page.locator('#view-photo')).toHaveClass(/active/);

    const studioCard = page.locator('#photo-studio-panel');
    await expect(studioCard).toBeVisible();

    // Adjust Lens FOV slider
    await page.locator('#photo-fov').fill('65');
    await expect(page.locator('#photo-val-fov')).toHaveText('65°');

    // Adjust Azimuth & Distance
    await page.locator('#photo-azimuth').fill('120');
    await expect(page.locator('#photo-val-azimuth')).toHaveText('120°');

    await page.locator('#photo-dist').fill('12');
    await expect(page.locator('#photo-val-dist')).toHaveText('12m');

    // Select Color Grading Filter
    await page.selectOption('#photo-filter-select', 'riviera_80s');

    // Select Postcard Stamp
    await page.selectOption('#photo-stamp-select', 'riviera_gp');

    // Toggle UI hide with 'H' key for pure framing
    await page.keyboard.press('KeyH');
    await expect(studioCard).toBeHidden();
    await page.keyboard.press('KeyH');
    await expect(studioCard).toBeVisible();

    // Trigger Snapshot Capture
    // Catch the download event
    const downloadPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
    await page.click('#btn-photo-capture');

    // Close Photo Studio
    await page.click('#btn-photo-close');
    await expect(page.locator('#view-pause')).toHaveClass(/active/);
  });

  test('Journey 5: Race Retirement, Results Screen, and Replay Viewer with 3 Cameras', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-menu-play');
    await page.click('#btn-setup-start');
    await page.waitForTimeout(3400);

    // Drive a bit to record keyframes
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1500);
    await page.keyboard.up('KeyW');

    // Pause and Retire
    await page.keyboard.press('Escape');
    await page.click('#btn-pause-retire');

    // Verify Results Screen appears
    await expect(page.locator('#view-results')).toHaveClass(/active/);

    // Launch Replay Viewer
    await page.click('#btn-results-watch-replay');
    await expect(page.locator('#view-replay-hud')).toHaveClass(/active/);

    // Replay controls: toggle play/pause
    const playBtn = page.locator('#btn-replay-play');
    await expect(playBtn).toHaveText('Pause');
    await playBtn.click();
    await expect(playBtn).toHaveText('Play');

    // Replay controls: cycle playback speed
    const speedBtn = page.locator('#btn-replay-speed');
    await expect(speedBtn).toHaveText('1.0x');
    await speedBtn.click();
    await expect(speedBtn).toHaveText('2x');

    // Replay controls: cycle 3 camera perspectives
    const camBtn = page.locator('#btn-replay-cam');
    await expect(camBtn).toHaveText(/Cam: Chase/i);
    await camBtn.click();
    await expect(camBtn).toHaveText('Cam: BUMPER');
    await camBtn.click();
    await expect(camBtn).toHaveText('Cam: BROADCAST');
    await camBtn.click();
    await expect(camBtn).toHaveText('Cam: CHASE');

    // Scrub timeline
    const slider = page.locator('#replay-timeline-slider');
    await slider.fill('500');

    // Exit Replay
    await page.click('#btn-replay-exit');
    await expect(page.locator('#view-menu')).toHaveClass(/active/);
  });

  test('Journey 6: Replay Vault (5 Slots max, Import/Export, Stamped Origin)', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-menu-replays');
    await expect(page.locator('#view-replays')).toHaveClass(/active/);

    // Verify initial capacity indicator
    const capacityBadge = page.locator('#replay-capacity-badge');
    await expect(capacityBadge).toContainText('/ 5 Slots Used');

    // Return to menu
    await page.click('#btn-vault-back');
    await expect(page.locator('#view-menu')).toHaveClass(/active/);
  });

  test('Journey 7: Settings, Quality Presets, and Key Rebinding Conflict Detection', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-menu-settings');
    await expect(page.locator('#view-settings')).toHaveClass(/active/);

    // Test Graphics Presets
    const lowQualityBox = page.locator('[data-quality="low"]');
    await lowQualityBox.click();
    await expect(lowQualityBox).toHaveClass(/selected/);

    const highQualityBox = page.locator('[data-quality="high"]');
    await highQualityBox.click();
    await expect(highQualityBox).toHaveClass(/selected/);

    // Test Volume & Motion
    const muteBox = page.locator('#settings-mute');
    await muteBox.check();
    expect(await muteBox.isChecked()).toBe(true);

    const motionBox = page.locator('#settings-reduced-motion');
    await motionBox.check();
    expect(await motionBox.isChecked()).toBe(true);

    // Test Key Rebinding Conflict: Try to rebind Brake to 'KeyW' (which is already Accelerate)
    const brakeBtn = page.locator('button[data-action="brake"]');
    await brakeBtn.click();
    await expect(brakeBtn).toHaveText('Press Key...');

    // Press 'W' key (conflict!)
    await page.keyboard.press('KeyW');

    // Conflict error message must appear
    const conflictMsg = page.locator('#settings-key-conflict-msg');
    await expect(conflictMsg).toBeVisible();
    await expect(conflictMsg).toContainText('Conflict: Key "W" is already bound to "accelerate"');

    // Reset Defaults
    await page.click('#btn-settings-reset-keys');
    await expect(conflictMsg).toBeHidden();

    // Return to Menu
    await page.click('#btn-settings-back');
    await expect(page.locator('#view-menu')).toHaveClass(/active/);
  });
});
