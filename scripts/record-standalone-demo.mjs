import { chromium } from '@playwright/test';

async function recordStandaloneDemo() {
  console.log('🎬 Starting standalone demo recording...');
  
  const outputDir = '/tmp/greenroom-videos';
  
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: outputDir,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();

  try {
    console.log('📍 Loading demo page...');
    await page.goto('file:///tmp/greenroom-videos/demo.html');
    await page.waitForTimeout(1500);

    console.log('📸 Step 1: Events page with draft badge...');
    await page.screenshot({ path: '/tmp/greenroom-videos/approach-b-01-events-with-badge.png', fullPage: true });
    await page.waitForTimeout(1000);

    console.log('📋 Step 2: Click on Drafts button...');
    await page.click('button:has-text("6 Drafts")');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/tmp/greenroom-videos/approach-b-02-draft-queue.png', fullPage: true });

    console.log('✅ Step 3: Select first draft...');
    await page.locator('button').first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: '/tmp/greenroom-videos/approach-b-03-select-one.png', fullPage: true });

    console.log('✅ Step 4: Select more drafts...');
    const buttons = await page.locator('button').all();
    if (buttons.length > 4) {
      await buttons[2].click();
      await page.waitForTimeout(500);
      await buttons[4].click();
      await page.waitForTimeout(800);
    }
    await page.screenshot({ path: '/tmp/greenroom-videos/approach-b-04-multiple-selected.png', fullPage: true });

    console.log('📝 Step 5: Click Select All...');
    await page.click('button:has-text("Select All")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/greenroom-videos/approach-b-05-all-selected.png', fullPage: true });

    console.log('📤 Step 6: Click Publish All...');
    await page.click('button:has-text("Publish All")');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/tmp/greenroom-videos/approach-b-06-publish-modal.png', fullPage: true });

    console.log('📜 Step 7: Scroll modal...');
    await page.locator('.max-h-96').first().evaluate(el => {
      el.scrollTo({ top: 200, behavior: 'smooth' });
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/greenroom-videos/approach-b-07-modal-scrolled.png', fullPage: true });

    console.log('✅ Step 8: Confirm publish...');
    await page.click('button:has-text("Publish 6 Events")');
    
    // Wait for alert and capture
    page.on('dialog', async dialog => {
      console.log(`📢 Alert: ${dialog.message()}`);
      await page.waitForTimeout(1000);
      await dialog.accept();
    });
    
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/greenroom-videos/approach-b-08-success.png', fullPage: true });

    console.log('✅ Demo recording complete!');
    
  } catch (error) {
    console.error('❌ Error during recording:', error);
    await page.screenshot({ path: '/tmp/greenroom-videos/approach-b-error.png', fullPage: true });
  } finally {
    await context.close();
    
    // Get the video path
    const video = await page.video();
    if (video) {
      const videoPath = await video.path();
      console.log(`🎥 Video saved to: ${videoPath}`);
      
      // Copy to desired location
      const fs = await import('fs');
      const finalPath = '/tmp/greenroom-videos/approach-b-cart.webm';
      await fs.promises.copyFile(videoPath, finalPath).catch(() => {});
      console.log(`📁 Final video: ${finalPath}`);
    }
    
    await browser.close();
    
    console.log('\n✅ All done! Check /tmp/greenroom-videos/ for:');
    console.log('   - approach-b-cart.webm (video recording)');
    console.log('   - approach-b-*.png (screenshots)');
  }
}

recordStandaloneDemo().catch(console.error);
