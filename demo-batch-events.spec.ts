import { test, expect } from '@playwright/test';

test.describe('GreenRoom Batch Event Creation Demo', () => {
  test('should demonstrate batch event creation flow', async ({ page, context }) => {
    // Start recording
    await context.tracing.start({ screenshots: true, snapshots: true });
    
    // Navigate to a mock heatmap page
    // Since we don't have a live database, we'll create screenshots of the key states
    
    // Step 1: Visit heatmap with multi-select mode
    console.log('Step 1: Heatmap with multi-select mode');
    await page.setViewportSize({ width: 1280, height: 900 });
    
    // Create a mock HTML page showing the heatmap
    const heatmapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        .selected { border: 2px solid #10b981; background-color: #d1fae5; }
      </style>
    </head>
    <body class="bg-slate-50 p-8">
      <div class="max-w-4xl mx-auto">
        <h2 class="text-2xl font-bold text-slate-900 mb-6">Spring Rehearsal Availability</h2>
        
        <!-- Batch mode controls -->
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-4 mb-4">
          <div class="flex items-center gap-3">
            <button class="bg-emerald-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow-md">
              ✓ Multi-Select Mode
            </button>
            <span class="text-sm font-medium text-slate-900">
              3 dates selected
            </span>
            <button class="text-sm text-slate-500">Clear</button>
          </div>
          <button class="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg">
            Create 3 Events →
          </button>
        </div>

        <!-- Heatmap table -->
        <div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table class="w-full">
            <thead>
              <tr class="bg-slate-50">
                <th class="w-12 px-3 py-3"></th>
                <th class="w-8 px-3 py-3"></th>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500">Date</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500">Day</th>
                <th class="px-3 py-3 text-center text-xs font-medium text-emerald-600">✅</th>
                <th class="px-3 py-3 text-center text-xs font-medium text-amber-500">🤔</th>
                <th class="px-3 py-3 text-center text-xs font-medium text-rose-600">❌</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-slate-500">Score</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr class="selected cursor-pointer">
                <td class="px-3 py-3 text-center">
                  <div class="flex h-5 w-5 items-center justify-center rounded-md border-2 border-emerald-600 bg-emerald-600 mx-auto">
                    <svg class="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                </td>
                <td class="px-3 py-3"></td>
                <td class="px-4 py-3"><span class="text-sm font-medium text-slate-900">Mar 15</span></td>
                <td class="px-4 py-3 text-sm text-slate-500">Friday</td>
                <td class="px-3 py-3 text-center text-sm font-medium text-emerald-700">8</td>
                <td class="px-3 py-3 text-center text-sm font-medium text-amber-600">2</td>
                <td class="px-3 py-3 text-center text-sm font-medium text-rose-600">1</td>
                <td class="px-4 py-3 text-center">
                  <span class="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-xs font-semibold text-slate-700">18</span>
                </td>
              </tr>
              <tr class="bg-emerald-50 cursor-pointer">
                <td class="px-3 py-3 text-center">
                  <div class="flex h-5 w-5 items-center justify-center rounded-md border-2 border-slate-300 bg-white mx-auto"></div>
                </td>
                <td class="px-3 py-3"></td>
                <td class="px-4 py-3"><span class="text-sm font-medium text-slate-900">Mar 17</span></td>
                <td class="px-4 py-3 text-sm text-slate-500">Sunday</td>
                <td class="px-3 py-3 text-center text-sm font-medium text-emerald-700">7</td>
                <td class="px-3 py-3 text-center text-sm font-medium text-amber-600">3</td>
                <td class="px-3 py-3 text-center text-sm font-medium text-rose-600">2</td>
                <td class="px-4 py-3 text-center">
                  <span class="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-xs font-semibold text-slate-700">17</span>
                </td>
              </tr>
              <tr class="selected cursor-pointer">
                <td class="px-3 py-3 text-center">
                  <div class="flex h-5 w-5 items-center justify-center rounded-md border-2 border-emerald-600 bg-emerald-600 mx-auto">
                    <svg class="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                </td>
                <td class="px-3 py-3"></td>
                <td class="px-4 py-3"><span class="text-sm font-medium text-slate-900">Mar 22</span></td>
                <td class="px-4 py-3 text-sm text-slate-500">Friday</td>
                <td class="px-3 py-3 text-center text-sm font-medium text-emerald-700">9</td>
                <td class="px-3 py-3 text-center text-sm font-medium text-amber-600">1</td>
                <td class="px-3 py-3 text-center text-sm font-medium text-rose-600">0</td>
                <td class="px-4 py-3 text-center">
                  <span class="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-xs font-semibold text-slate-700">19</span>
                </td>
              </tr>
              <tr class="selected cursor-pointer">
                <td class="px-3 py-3 text-center">
                  <div class="flex h-5 w-5 items-center justify-center rounded-md border-2 border-emerald-600 bg-emerald-600 mx-auto">
                    <svg class="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                </td>
                <td class="px-3 py-3"></td>
                <td class="px-4 py-3"><span class="text-sm font-medium text-slate-900">Mar 29</span></td>
                <td class="px-4 py-3 text-sm text-slate-500">Friday</td>
                <td class="px-3 py-3 text-center text-sm font-medium text-emerald-700">8</td>
                <td class="px-3 py-3 text-center text-sm font-medium text-amber-600">2</td>
                <td class="px-3 py-3 text-center text-sm font-medium text-rose-600">1</td>
                <td class="px-4 py-3 text-center">
                  <span class="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-xs font-semibold text-slate-700">18</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </body>
    </html>
    `;
    
    await page.setContent(heatmapHTML);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/greenroom-videos/approach-a-step1-multiselect.png', fullPage: true });
    
    // Step 2: Configuration screen
    console.log('Step 2: Batch configuration form');
    const configHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-50 p-8">
      <div class="max-w-4xl mx-auto pb-12">
        <h2 class="text-2xl font-bold text-slate-900 mb-2">Create 3 Events</h2>
        <p class="text-sm text-slate-600 mb-6">
          Configure your batch event creation. Each date will create a separate event with one consolidated notification.
        </p>

        <!-- Step indicator -->
        <div class="mb-8 flex items-center gap-4">
          <div class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-emerald-100 text-emerald-900">
            <div class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold bg-emerald-600 text-white">1</div>
            Configure
          </div>
          <div class="h-px flex-1 bg-slate-200"></div>
          <div class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-slate-100 text-slate-600">
            <div class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold bg-slate-300 text-slate-600">2</div>
            Review
          </div>
        </div>

        <!-- Shared fields -->
        <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <h3 class="mb-4 text-lg font-semibold text-slate-900">Shared Information</h3>
          <div class="space-y-4">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Event Title</label>
              <input type="text" value="Spring Rehearsal" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <p class="mt-1 text-xs text-slate-500">This title will be used for all 3 events</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Event Type</label>
              <select class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option selected>🎯 Rehearsal</option>
                <option>🎭 Show</option>
                <option>📅 Other</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Default Time</label>
              <div class="flex items-center gap-2">
                <svg class="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <input type="text" value="19:00-21:00" class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">
              </div>
            </div>
          </div>
        </div>

        <!-- Per-date locations -->
        <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 class="mb-4 text-lg font-semibold text-slate-900">Locations</h3>
          
          <div class="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <label class="mb-2 block text-sm font-medium text-emerald-900">
              <svg class="inline h-4 w-4 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              Quick Fill: Apply Location to All
            </label>
            <div class="flex gap-2">
              <input type="text" placeholder="e.g., Studio A" class="flex-1 rounded-lg border border-emerald-300 px-3 py-2 text-sm">
              <button class="flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
                Apply
              </button>
            </div>
          </div>

          <div class="space-y-3">
            <div class="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div class="flex-shrink-0">
                <div class="text-sm font-medium text-slate-900">Mar 15</div>
                <div class="text-xs text-slate-500">Friday</div>
              </div>
              <input type="text" value="Main Theater" class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">
            </div>
            <div class="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div class="flex-shrink-0">
                <div class="text-sm font-medium text-slate-900">Mar 22</div>
                <div class="text-xs text-slate-500">Friday</div>
              </div>
              <input type="text" value="Studio B" class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">
            </div>
            <div class="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div class="flex-shrink-0">
                <div class="text-sm font-medium text-slate-900">Mar 29</div>
                <div class="text-xs text-slate-500">Friday</div>
              </div>
              <input type="text" value="Main Theater" class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between mt-6">
          <span class="text-sm font-medium text-slate-600">Cancel</span>
          <button class="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md">
            Review Events →
          </button>
        </div>
      </div>
    </body>
    </html>
    `;
    
    await page.setContent(configHTML);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/greenroom-videos/approach-a-step2-configure.png', fullPage: true });
    
    // Step 3: Review screen
    console.log('Step 3: Review events');
    const reviewHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-50 p-8">
      <div class="max-w-4xl mx-auto pb-12">
        <h2 class="text-2xl font-bold text-slate-900 mb-2">Create 3 Events</h2>
        <p class="text-sm text-slate-600 mb-6">
          Configure your batch event creation. Each date will create a separate event with one consolidated notification.
        </p>

        <!-- Step indicator -->
        <div class="mb-8 flex items-center gap-4">
          <div class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-slate-100 text-slate-600">
            <div class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold bg-slate-300 text-slate-600">1</div>
            Configure
          </div>
          <div class="h-px flex-1 bg-slate-200"></div>
          <div class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-emerald-100 text-emerald-900">
            <div class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold bg-emerald-600 text-white">2</div>
            Review
          </div>
        </div>

        <!-- Summary banner -->
        <div class="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-6 mb-6">
          <div class="flex items-start gap-4">
            <div class="rounded-full bg-emerald-200 p-3">
              <svg class="h-6 w-6 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-emerald-900">Ready to Create</h3>
              <p class="mt-1 text-sm text-emerald-700">
                You're about to create <strong>3 events</strong> with the title "<strong>Spring Rehearsal</strong>". One notification email will be sent to the group.
              </p>
            </div>
          </div>
        </div>

        <!-- Event list -->
        <div class="space-y-3 mb-6">
          <h3 class="text-lg font-semibold text-slate-900">Events to Create</h3>
          
          <div class="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 font-bold text-emerald-700">1</div>
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <h4 class="font-semibold text-slate-900">Spring Rehearsal</h4>
                <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">rehearsal</span>
              </div>
              <div class="mt-1 space-y-0.5 text-sm text-slate-600">
                <div class="flex items-center gap-1.5">
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  Mar 15 (Friday)
                </div>
                <div class="flex items-center gap-1.5">
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  19:00-21:00
                </div>
                <div class="flex items-center gap-1.5">
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                  </svg>
                  Main Theater
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 font-bold text-emerald-700">2</div>
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <h4 class="font-semibold text-slate-900">Spring Rehearsal</h4>
                <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">rehearsal</span>
              </div>
              <div class="mt-1 space-y-0.5 text-sm text-slate-600">
                <div class="flex items-center gap-1.5">
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  Mar 22 (Friday)
                </div>
                <div class="flex items-center gap-1.5">
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  19:00-21:00
                </div>
                <div class="flex items-center gap-1.5">
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                  </svg>
                  Studio B
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 font-bold text-emerald-700">3</div>
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <h4 class="font-semibold text-slate-900">Spring Rehearsal</h4>
                <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">rehearsal</span>
              </div>
              <div class="mt-1 space-y-0.5 text-sm text-slate-600">
                <div class="flex items-center gap-1.5">
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  Mar 29 (Friday)
                </div>
                <div class="flex items-center gap-1.5">
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  19:00-21:00
                </div>
                <div class="flex items-center gap-1.5">
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                  </svg>
                  Main Theater
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Final actions -->
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-slate-600">← Back to Configuration</span>
          <button class="flex items-center gap-2 rounded-lg bg-emerald-600 px-8 py-3 text-base font-semibold text-white shadow-lg">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            Create 3 Events & Notify
          </button>
        </div>
      </div>
    </body>
    </html>
    `;
    
    await page.setContent(reviewHTML);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/greenroom-videos/approach-a-step3-review.png', fullPage: true });
    
    // Step 4: Success state
    console.log('Step 4: Success state');
    const successHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-50 p-8">
      <div class="max-w-4xl mx-auto">
        <h2 class="text-2xl font-bold text-slate-900 mb-6">Spring Rehearsal Availability</h2>
        
        <!-- Success banner -->
        <div class="mb-6 rounded-lg border-2 border-emerald-300 bg-emerald-100 px-5 py-4">
          <div class="flex items-start gap-3">
            <div class="rounded-full bg-emerald-600 p-1">
              <svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div>
              <p class="font-semibold text-emerald-900">Success! 3 events created</p>
              <p class="mt-0.5 text-sm text-emerald-700">
                One consolidated notification has been sent to the group.
              </p>
            </div>
          </div>
        </div>

        <!-- Back to normal heatmap view -->
        <div class="rounded-xl border border-slate-200 bg-white p-6">
          <h3 class="text-lg font-semibold text-slate-900 mb-4">Results</h3>
          <div class="overflow-hidden rounded-xl border border-slate-200">
            <table class="w-full">
              <thead>
                <tr class="bg-slate-50">
                  <th class="w-8 px-3 py-3"></th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-500">Date</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-500">Day</th>
                  <th class="px-3 py-3 text-center text-xs font-medium text-emerald-600">✅</th>
                  <th class="px-3 py-3 text-center text-xs font-medium text-amber-500">🤔</th>
                  <th class="px-3 py-3 text-center text-xs font-medium text-rose-600">❌</th>
                  <th class="px-4 py-3 text-center text-xs font-medium text-slate-500">Score</th>
                  <th class="px-4 py-3 text-right text-xs font-medium text-slate-500"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr class="bg-emerald-100 cursor-pointer">
                  <td class="px-3 py-3"></td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium text-slate-900">Mar 15</span>
                      <span class="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">Event Created</span>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-sm text-slate-500">Friday</td>
                  <td class="px-3 py-3 text-center text-sm font-medium text-emerald-700">8</td>
                  <td class="px-3 py-3 text-center text-sm font-medium text-amber-600">2</td>
                  <td class="px-3 py-3 text-center text-sm font-medium text-rose-600">1</td>
                  <td class="px-4 py-3 text-center">
                    <span class="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-xs font-semibold text-slate-700">18</span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <span class="text-xs text-slate-400">✓ Created</span>
                  </td>
                </tr>
                <tr class="bg-emerald-50 cursor-pointer">
                  <td class="px-3 py-3"></td>
                  <td class="px-4 py-3"><span class="text-sm font-medium text-slate-900">Mar 17</span></td>
                  <td class="px-4 py-3 text-sm text-slate-500">Sunday</td>
                  <td class="px-3 py-3 text-center text-sm font-medium text-emerald-700">7</td>
                  <td class="px-3 py-3 text-center text-sm font-medium text-amber-600">3</td>
                  <td class="px-3 py-3 text-center text-sm font-medium text-rose-600">2</td>
                  <td class="px-4 py-3 text-center">
                    <span class="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-xs font-semibold text-slate-700">17</span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <a href="#" class="text-xs font-medium text-emerald-600 hover:text-emerald-700">Create Event</a>
                  </td>
                </tr>
                <tr class="bg-emerald-100 cursor-pointer">
                  <td class="px-3 py-3"></td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium text-slate-900">Mar 22</span>
                      <span class="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">Event Created</span>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-sm text-slate-500">Friday</td>
                  <td class="px-3 py-3 text-center text-sm font-medium text-emerald-700">9</td>
                  <td class="px-3 py-3 text-center text-sm font-medium text-amber-600">1</td>
                  <td class="px-3 py-3 text-center text-sm font-medium text-rose-600">0</td>
                  <td class="px-4 py-3 text-center">
                    <span class="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-xs font-semibold text-slate-700">19</span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <span class="text-xs text-slate-400">✓ Created</span>
                  </td>
                </tr>
                <tr class="bg-emerald-100 cursor-pointer">
                  <td class="px-3 py-3"></td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium text-slate-900">Mar 29</span>
                      <span class="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">Event Created</span>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-sm text-slate-500">Friday</td>
                  <td class="px-3 py-3 text-center text-sm font-medium text-emerald-700">8</td>
                  <td class="px-3 py-3 text-center text-sm font-medium text-amber-600">2</td>
                  <td class="px-3 py-3 text-center text-sm font-medium text-rose-600">1</td>
                  <td class="px-4 py-3 text-center">
                    <span class="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-xs font-semibold text-slate-700">18</span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <span class="text-xs text-slate-400">✓ Created</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </body>
    </html>
    `;
    
    await page.setContent(successHTML);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/greenroom-videos/approach-a-step4-success.png', fullPage: true });
    
    console.log('✓ All screenshots captured successfully');
    
    await context.tracing.stop();
  });
});
