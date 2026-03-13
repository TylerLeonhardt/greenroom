import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function recordDemo() {
  console.log('🎬 Starting demo recording...');
  
  // Create output directory
  const outputDir = '/tmp/greenroom-videos';
  
  // Launch browser with video recording
  const browser = await chromium.launch({
    headless: false, // Show browser for demo
    slowMo: 500, // Slow down actions for better visibility
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
    console.log('📍 Step 1: Navigate to app...');
    await page.goto('http://localhost:3002');
    await page.waitForTimeout(2000);

    // Check if we're on login page
    const isLoginPage = await page.locator('text=Sign in').isVisible().catch(() => false);
    
    if (isLoginPage) {
      console.log('🔐 Logging in...');
      // Try to find and click "Continue with Google" or regular login
      const googleButton = await page.locator('text=Continue with Google').first().isVisible().catch(() => false);
      
      if (googleButton) {
        // For demo purposes, we'll take a screenshot of login page
        console.log('⚠️  Need to authenticate manually. Taking screenshot of login page...');
        await page.screenshot({ path: '/tmp/greenroom-videos/00-login-page.png', fullPage: true });
      } else {
        // Try email/password login
        await page.fill('input[type="email"]', 'demo@example.com');
        await page.fill('input[type="password"]', 'password');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);
      }
    }

    // Check if we're on the groups page
    const url = page.url();
    console.log(`Current URL: ${url}`);

    // Take a screenshot of the home/groups page
    console.log('📸 Capturing home page...');
    await page.screenshot({ path: '/tmp/greenroom-videos/01-home-page.png', fullPage: true });

    // Try to find a group and navigate to it
    const groupLink = await page.locator('a[href*="/groups/"]').first();
    const hasGroup = await groupLink.isVisible().catch(() => false);

    if (hasGroup) {
      console.log('🎯 Navigating to a group...');
      await groupLink.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/greenroom-videos/02-group-page.png', fullPage: true });

      // Now let's seed some draft data using the browser console
      console.log('📋 Seeding draft events...');
      const groupId = await page.evaluate(() => {
        const pathParts = window.location.pathname.split('/');
        const groupIndex = pathParts.indexOf('groups');
        return groupIndex >= 0 ? pathParts[groupIndex + 1] : null;
      });

      if (groupId) {
        console.log(`Found group ID: ${groupId}`);
        
        // Inject and run the seeder
        await page.evaluate((gId) => {
          const mockDrafts = [
            {
              title: "Monday Scene Work",
              eventType: "rehearsal",
              date: "2025-02-03",
              startTime: "19:00",
              endTime: "21:00",
              location: "Studio A - Downtown",
              description: "Focus on character development and emotional beats",
              timezone: "America/Los_Angeles",
            },
            {
              title: "Wednesday Improv Practice",
              eventType: "rehearsal",
              date: "2025-02-05",
              startTime: "18:30",
              endTime: "20:30",
              location: "Studio B - Westside",
              description: "Long-form practice and game work",
              timezone: "America/Los_Angeles",
            },
            {
              title: "Friday Run-Through",
              eventType: "rehearsal",
              date: "2025-02-07",
              startTime: "19:30",
              endTime: "21:30",
              location: "Main Theater",
              description: "Full run-through of the show with blocking",
              timezone: "America/Los_Angeles",
            },
            {
              title: "Saturday Matinee Show",
              eventType: "show",
              date: "2025-02-08",
              startTime: "14:00",
              endTime: "15:30",
              location: "Main Theater",
              description: "Family-friendly improv comedy show",
              callTime: "13:00",
              timezone: "America/Los_Angeles",
            },
            {
              title: "Saturday Evening Show",
              eventType: "show",
              date: "2025-02-08",
              startTime: "20:00",
              endTime: "21:30",
              location: "Main Theater",
              description: "Late night improv comedy show",
              callTime: "19:00",
              timezone: "America/Los_Angeles",
            },
            {
              title: "Team Building Social",
              eventType: "other",
              date: "2025-02-10",
              startTime: "18:00",
              endTime: "20:00",
              location: "The Green Room Bar",
              description: "Casual hangout and team bonding",
              timezone: "America/Los_Angeles",
            },
          ];

          const existingDrafts = JSON.parse(localStorage.getItem("greenroom_draft_events") || "[]");
          const newDrafts = mockDrafts.map(draft => ({
            ...draft,
            id: crypto.randomUUID(),
            groupId: gId,
            createdAt: new Date().toISOString(),
          }));
          
          const allDrafts = [...existingDrafts, ...newDrafts];
          localStorage.setItem("greenroom_draft_events", JSON.stringify(allDrafts));
          console.log(`✅ Seeded ${newDrafts.length} draft events!`);
        }, groupId);

        // Reload to see the changes
        await page.reload();
        await page.waitForTimeout(2000);

        console.log('📸 Step 2: Capturing group page with draft badge...');
        await page.screenshot({ path: '/tmp/greenroom-videos/03-group-with-badge.png', fullPage: true });

        // Navigate to Events tab
        console.log('🎯 Step 3: Navigate to Events tab...');
        const eventsTab = await page.locator('a:has-text("Events")').first();
        await eventsTab.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: '/tmp/greenroom-videos/04-events-page-with-drafts-link.png', fullPage: true });

        // Click on drafts link
        console.log('📋 Step 4: Click on Drafts link...');
        const draftsLink = await page.locator('a:has-text("Draft")').first();
        await draftsLink.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: '/tmp/greenroom-videos/05-drafts-queue.png', fullPage: true });

        // Select a few drafts
        console.log('✅ Step 5: Select some drafts...');
        const checkboxes = await page.locator('button:has(svg)').filter({ hasText: /^$/ }).all();
        if (checkboxes.length >= 3) {
          await checkboxes[0].click();
          await page.waitForTimeout(500);
          await checkboxes[1].click();
          await page.waitForTimeout(500);
          await checkboxes[2].click();
          await page.waitForTimeout(500);
        }
        await page.screenshot({ path: '/tmp/greenroom-videos/06-drafts-selected.png', fullPage: true });

        // Click on edit for one draft
        console.log('✏️  Step 6: Edit a draft...');
        const editButton = await page.locator('a[href*="edit"]').first();
        await editButton.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: '/tmp/greenroom-videos/07-edit-draft.png', fullPage: true });

        // Change the location
        console.log('📝 Changing location...');
        const locationInput = await page.locator('input[name="location"]');
        await locationInput.fill('Studio C - New Location');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: '/tmp/greenroom-videos/08-edit-draft-changed.png', fullPage: true });

        // Go back to drafts
        console.log('⬅️  Going back to drafts...');
        await page.locator('a:has-text("Back to Drafts")').click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: '/tmp/greenroom-videos/09-back-to-drafts.png', fullPage: true });

        // Click Publish All
        console.log('🚀 Step 7: Click Publish All...');
        const publishAllButton = await page.locator('button:has-text("Publish All")');
        await publishAllButton.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: '/tmp/greenroom-videos/10-publish-modal.png', fullPage: true });

        // Scroll in modal if needed
        await page.locator('.max-h-96').first().evaluate(el => {
          el.scrollTo({ top: el.scrollHeight / 2, behavior: 'smooth' });
        }).catch(() => {});
        await page.waitForTimeout(1000);
        await page.screenshot({ path: '/tmp/greenroom-videos/11-publish-modal-scrolled.png', fullPage: true });

        // Click Publish button in modal
        console.log('✅ Step 8: Confirm publish...');
        const confirmButton = await page.locator('button:has-text("Publish")').last();
        await confirmButton.click();
        await page.waitForTimeout(1000);

        // Capture the alert
        page.on('dialog', async dialog => {
          console.log(`📢 Alert: ${dialog.message()}`);
          await page.screenshot({ path: '/tmp/greenroom-videos/12-success-alert.png', fullPage: true });
          await dialog.accept();
        });

        await page.waitForTimeout(2000);
        await page.screenshot({ path: '/tmp/greenroom-videos/13-final-state.png', fullPage: true });
      }
    } else {
      console.log('⚠️  No groups found. Please create a group first.');
      await page.screenshot({ path: '/tmp/greenroom-videos/no-groups.png', fullPage: true });
    }

    console.log('✅ Demo recording complete!');
    
  } catch (error) {
    console.error('❌ Error during recording:', error);
    await page.screenshot({ path: '/tmp/greenroom-videos/error.png', fullPage: true });
  } finally {
    // Close and save video
    await context.close();
    await browser.close();
    
    console.log('🎥 Video saved! Looking for video file...');
    console.log('📁 Check /tmp/greenroom-videos/ for screenshots and video');
  }
}

recordDemo().catch(console.error);
