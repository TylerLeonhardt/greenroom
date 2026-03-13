const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  // Ensure output directory exists
  const outputDir = '/tmp/greenroom-videos';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: false, // Show browser for demo
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: outputDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();

  console.log('Starting batch wizard demo...');

  try {
    // For demo purposes, we'll directly navigate to the batch wizard
    // In a real scenario, this would require authentication
    
    // First, let's try to go to the homepage to see the structure
    await page.goto('http://localhost:5177');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${outputDir}/step-0-homepage.png` });

    // Try to navigate directly to a demo group's batch wizard
    // We'll use a common test group ID if it exists
    const testGroupId = 'demo-group-id';
    await page.goto(`http://localhost:5177/groups/${testGroupId}/events`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${outputDir}/step-1-events-page-attempt.png` });

    // If authentication is required, let's try to see if there's a way to bypass
    // Or we'll just navigate to the wizard directly
    await page.goto(`http://localhost:5177/groups/${testGroupId}/events/batch`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${outputDir}/step-2-batch-wizard-direct.png` });

      // Step 1: Fill in shared details (they're already pre-filled)
      await page.waitForTimeout(1500);
      console.log('Step 1: Shared Details');

      // Click Next to go to Step 2
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${outputDir}/step-4-wizard-step2.png` });

      // Step 2: Dates selection
      console.log('Step 2: Date Selection');
      await page.waitForTimeout(1500);

      // Edit a location to show customization
      const locationInputs = await page.locator('input[placeholder="Location"]');
      if (await locationInputs.count() > 2) {
        await locationInputs.nth(2).fill('Updated Studio C');
        await page.waitForTimeout(1000);
      }

      await page.screenshot({ path: `${outputDir}/step-5-wizard-step2-edited.png` });

      // Click Next to go to Step 3
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${outputDir}/step-6-wizard-step3-review.png` });

      // Step 3: Review
      console.log('Step 3: Review');
      await page.waitForTimeout(2000);

      // Scroll down to see more events
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${outputDir}/step-7-wizard-step3-scrolled.png` });

      // Click "Create Events" button
      await page.click('button:has-text("Create Events")');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${outputDir}/step-8-wizard-creating.png` });

      // Wait for success screen
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${outputDir}/step-9-wizard-success.png` });

      console.log('Demo complete!');
    } else {
      console.log('Batch Create button not found');
      await page.screenshot({ path: `${outputDir}/error-no-batch-button.png` });
    }

  } catch (error) {
    console.error('Error during demo:', error);
    await page.screenshot({ path: `${outputDir}/error-screenshot.png` });
  }

  // Wait a bit before closing to ensure video is saved
  await page.waitForTimeout(2000);

  // Close browser and save video
  await context.close();
  await browser.close();

  console.log('Videos and screenshots saved to:', outputDir);

  // Wait for video to finish processing
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Find the video file
  const files = fs.readdirSync(outputDir);
  const videoFile = files.find(f => f.endsWith('.webm'));
  if (videoFile) {
    const oldPath = path.join(outputDir, videoFile);
    const newPath = path.join(outputDir, 'approach-c-wizard.webm');
    fs.renameSync(oldPath, newPath);
    console.log('Video saved as:', newPath);
  }

  console.log('\nScreenshots saved:');
  files.filter(f => f.endsWith('.png')).forEach(f => {
    console.log(`  - ${path.join(outputDir, f)}`);
  });
})();
