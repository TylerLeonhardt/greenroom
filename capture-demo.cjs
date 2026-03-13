const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const outputDir = '/tmp/greenroom-videos';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    recordVideo: {
      dir: outputDir,
      size: { width: 1280, height: 900 }
    }
  });

  const page = await context.newPage();

  console.log('Capturing batch wizard demo screenshots...');

  try {
    const htmlPath = path.resolve(__dirname, 'batch-wizard-demo.html');
    await page.goto(`file://${htmlPath}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Step 1: Shared Details
    console.log('Capturing Step 1...');
    await page.screenshot({ 
      path: `${outputDir}/approach-c-step1-shared-details.png`,
      fullPage: false
    });
    await page.waitForTimeout(1500);

    // Click Next to go to Step 2
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1500);

    // Step 2: Date Selection
    console.log('Capturing Step 2...');
    await page.screenshot({ 
      path: `${outputDir}/approach-c-step2-date-selection.png`,
      fullPage: false
    });
    await page.waitForTimeout(1500);

    // Edit a location to show customization
    const locationInputs = await page.locator('input[placeholder="Location"]');
    if (await locationInputs.count() > 2) {
      await locationInputs.nth(2).click();
      await locationInputs.nth(2).fill('Updated: Studio C - Room 3');
      await page.waitForTimeout(1000);
      
      await page.screenshot({ 
        path: `${outputDir}/approach-c-step2-edited.png`,
        fullPage: false
      });
    }
    await page.waitForTimeout(1000);

    // Click Next to go to Step 3
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1500);

    // Step 3: Review
    console.log('Capturing Step 3...');
    await page.screenshot({ 
      path: `${outputDir}/approach-c-step3-review.png`,
      fullPage: true
    });
    await page.waitForTimeout(1500);

    // Scroll down a bit to show more events
    await page.evaluate(() => window.scrollBy(0, 200));
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: `${outputDir}/approach-c-step3-review-scrolled.png`,
      fullPage: false
    });

    // Click "Create Events"
    await page.click('button:has-text("Create Events")');
    await page.waitForTimeout(2000);

    // Step 4: Success
    console.log('Capturing Step 4...');
    await page.screenshot({ 
      path: `${outputDir}/approach-c-step4-success.png`,
      fullPage: false
    });

    console.log('\nScreenshots captured successfully!');

  } catch (error) {
    console.error('Error during capture:', error);
    await page.screenshot({ path: `${outputDir}/error-screenshot.png` });
  }

  // Wait for video to finish
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();

  // Wait for video processing
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Rename video
  const files = fs.readdirSync(outputDir);
  const videoFile = files.find(f => f.endsWith('.webm'));
  if (videoFile) {
    const oldPath = path.join(outputDir, videoFile);
    const newPath = path.join(outputDir, 'approach-c-wizard.webm');
    fs.renameSync(oldPath, newPath);
    console.log('\n✅ Video saved as:', newPath);
  }

  console.log('\n✅ Screenshots saved:');
  const screenshots = files.filter(f => f.endsWith('.png')).concat(
    fs.readdirSync(outputDir).filter(f => f.endsWith('.png') && !files.includes(f))
  );
  [...new Set(screenshots)].forEach(f => {
    console.log(`   ${path.join(outputDir, f)}`);
  });

})();
