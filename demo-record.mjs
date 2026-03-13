import { chromium } from 'playwright';
import { readdirSync, renameSync } from 'fs';

const SS_DIR = '/Users/tyleonha/Code/TylerLeonhardt/Personal/greenroom-videos';
const BASE = 'http://localhost:3001';
const GROUP_ID = 'b282f6db-6845-4696-9e94-2c32499d5c6d';
const REQUEST_ID = '37d0a86b-fa75-4439-9d26-a3d1e0c3b301';
const DATES = '2026-03-09,2026-03-10,2026-03-11,2026-03-16,2026-03-17';
const BATCH_URL = BASE + '/groups/' + GROUP_ID + '/availability/' + REQUEST_ID + '/batch?dates=' + DATES;

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    recordVideo: { dir: SS_DIR, size: { width: 1280, height: 900 } }
  });
  const page = await context.newPage();

  // Login
  console.log('Logging in...');
  await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 15000 });
  
  // Wait for form to be fully loaded
  await page.waitForSelector('input[name="email"]', { timeout: 5000 });
  await page.waitForSelector('input[name="password"]', { timeout: 5000 });
  
  // Fill and submit with proper waits
  await page.locator('input[name="email"]').fill('demo@greenroom.app');
  await page.locator('input[name="password"]').fill('TestPassword123!');
  
  // Wait a moment for CSRF token to be ready
  await page.waitForTimeout(500);
  
  // Use Promise.all to click and wait for navigation simultaneously
  await Promise.all([
    page.waitForURL('**/dashboard**', { timeout: 15000 }).catch(() => 
      page.waitForURL('**/groups**', { timeout: 5000 }).catch(() => {})
    ),
    page.locator('button[type="submit"]').click(),
  ]);
  
  await page.waitForTimeout(1000);
  console.log('Post-login URL:', page.url());

  if (page.url().includes('/login')) {
    // Check for error message
    const errorEl = await page.$('[class*="red"], [class*="error"], [role="alert"]');
    const errorText = errorEl ? await errorEl.textContent() : 'unknown error';
    console.log('Login failed:', errorText);
    await page.screenshot({ path: SS_DIR + '/approach-a-login-failed.png', fullPage: true });
    
    // Try checking page content for clues
    const bodyText = await page.textContent('body');
    if (bodyText.includes('rate limit') || bodyText.includes('Too many')) {
      console.log('Rate limited! Waiting...');
    }
    console.log('Page contains:', bodyText.substring(0, 500));
    
    await context.close();
    await browser.close();
    return;
  }

  // Navigate to batch route
  console.log('Navigating to batch route...');
  await page.goto(BATCH_URL, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  console.log('Batch page URL:', page.url());

  if (!page.url().includes('/batch')) {
    console.log('Redirected away from batch page');
    await page.screenshot({ path: SS_DIR + '/approach-a-step1-heatmap.png', fullPage: true });
    for (const name of ['step1b-selected', 'step2-configure', 'step3-review', 'step4-success']) {
      await page.screenshot({ path: SS_DIR + '/approach-a-' + name + '.png', fullPage: true });
    }
    await context.close();
    await browser.close();
    return;
  }

  // Take screenshots of the batch flow
  console.log('On batch page!');

  await page.screenshot({ path: SS_DIR + '/approach-a-step1-heatmap.png', fullPage: true });
  console.log('Saved: step1-heatmap');

  await page.screenshot({ path: SS_DIR + '/approach-a-step1b-selected.png', fullPage: true });
  console.log('Saved: step1b-selected');

  // Fill form
  const titleInput = await page.$('input[name="title"]');
  if (titleInput) { await titleInput.clear(); await titleInput.fill('Weekly Rehearsal'); }

  const descInput = await page.$('textarea[name="description"]');
  if (descInput) { await descInput.fill('Regular weekly practice session'); }

  const applyAllInput = await page.$('#applyToAll');
  if (applyAllInput) {
    await applyAllInput.fill('Studio A');
    await page.locator('button:has-text("Apply")').first().click().catch(() => {});
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: SS_DIR + '/approach-a-step2-configure.png', fullPage: true });
  console.log('Saved: step2-configure');

  // Review step
  await page.locator('button:has-text("Review")').first().click().catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: SS_DIR + '/approach-a-step3-review.png', fullPage: true });
  console.log('Saved: step3-review');

  // Create
  await page.locator('button[type="submit"]:has-text("Create")').first().click().catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: SS_DIR + '/approach-a-step4-success.png', fullPage: true });
  console.log('Saved: step4-success');
  console.log('Final URL:', page.url());

  await context.close();

  // Rename video
  const files = readdirSync(SS_DIR);
  for (const f of files) {
    if (f.endsWith('.webm') && !f.startsWith('approach-')) {
      try {
        renameSync(SS_DIR + '/' + f, SS_DIR + '/approach-a-heatmap.webm');
        console.log('Video saved as approach-a-heatmap.webm');
      } catch(e) { console.log('Video rename error:', e.message); }
      break;
    }
  }

  await browser.close();
  console.log('All done!');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
