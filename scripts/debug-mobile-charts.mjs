import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 375, height: 812 }, // iPhone X dimensions
  deviceScaleFactor: 2,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
});

const page = await context.newPage();

// Capture console errors
page.on('console', msg => {
  if (msg.type() === 'error') console.log(`[CONSOLE ERROR] ${msg.text()}`);
});

await page.goto('http://localhost:3001/dashboard', { waitUntil: 'networkidle', timeout: 30000 });

// Get the chart container dimensions
const chartInfo = await page.evaluate(() => {
  const containers = document.querySelectorAll('.recharts-responsive-container');
  return Array.from(containers).map((c, i) => {
    const rect = c.getBoundingClientRect();
    const style = window.getComputedStyle(c);
    const parent = c.parentElement;
    const parentRect = parent?.getBoundingClientRect();
    return {
      index: i,
      width: rect.width,
      height: rect.height,
      minHeight: style.minHeight,
      overflow: style.overflow,
      parentWidth: parentRect?.width,
      parentHeight: parentRect?.height,
      parentOverflow: parent ? window.getComputedStyle(parent).overflow : null,
    };
  });
});

console.log('Chart container info:', JSON.stringify(chartInfo, null, 2));

// Check overall page layout
const bodyInfo = await page.evaluate(() => {
  return {
    bodyWidth: document.body.scrollWidth,
    bodyHeight: document.body.scrollHeight,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  };
});
console.log('Page info:', bodyInfo);

await page.screenshot({ path: '/tmp/admin-mobile-dashboard.png', fullPage: false });
console.log('Screenshot saved to /tmp/admin-mobile-dashboard.png');

await browser.close();
