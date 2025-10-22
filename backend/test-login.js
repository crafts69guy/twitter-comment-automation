#!/usr/bin/env node

/**
 * Test script for Twitter Auto-Login feature
 * 
 * Usage:
 *   node test-login.js <username> <password>
 * 
 * Example:
 *   node test-login.js myemail@gmail.com mypassword123
 */

import { chromium } from 'playwright';

const [username, password] = process.argv.slice(2);

if (!username || !password) {
  console.error('❌ Usage: node test-login.js <username> <password>');
  process.exit(1);
}

async function testLogin() {
  console.log('🚀 Starting Twitter login test...\n');
  
  let browser;
  try {
    // Launch browser
    console.log('📂 Launching browser...');
    browser = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
    });

    const page = await context.newPage();
    console.log('✅ Browser launched\n');

    // Navigate to login page
    console.log('🔗 Navigating to Twitter login page...');
    await page.goto('https://twitter.com/i/flow/login', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await page.waitForTimeout(2000);
    console.log('✅ Login page loaded\n');

    // Step 1: Enter username
    console.log('👤 Entering username...');
    const usernameInput = page.locator('input[autocomplete="username"]');
    await usernameInput.waitFor({ timeout: 10000 });
    await usernameInput.fill(username);
    console.log('✅ Username entered\n');

    await page.waitForTimeout(1000);

    // Click Next
    console.log('➡️  Clicking Next button...');
    const nextButton = page.locator('button:has-text("Next")').first();
    await nextButton.click();
    console.log('✅ Next button clicked\n');

    await page.waitForTimeout(2000);

    // Step 2: Enter password
    console.log('🔒 Entering password...');
    const passwordInput = page.locator('input[name="password"]');
    await passwordInput.waitFor({ timeout: 10000 });
    await passwordInput.fill(password);
    console.log('✅ Password entered\n');

    await page.waitForTimeout(1000);

    // Click Login
    console.log('🔐 Clicking Login button...');
    const loginButton = page.locator('button[data-testid="LoginForm_Login_Button"]');
    await loginButton.click();
    console.log('✅ Login button clicked\n');

    // Wait for navigation
    console.log('⏳ Waiting for navigation to home page...');
    await page.waitForURL('**/home', { timeout: 15000 });
    console.log('✅ Successfully navigated to home page\n');

    await page.waitForTimeout(3000);

    // Verify login success
    console.log('🔍 Verifying login success...');
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);

    if (currentUrl.includes('/home')) {
      console.log('\n✅✅✅ LOGIN SUCCESSFUL! ✅✅✅\n');
      console.log('🎉 Twitter auto-login is working correctly!\n');
    } else {
      console.log('\n⚠️  LOGIN MAY HAVE ISSUES\n');
      console.log('Expected URL to contain "/home" but got:', currentUrl);
    }

    // Keep browser open for 5 seconds
    console.log('🕐 Keeping browser open for 5 seconds...\n');
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('\n❌ LOGIN FAILED!\n');
    console.error('Error:', error.message);
    console.error('\nPossible reasons:');
    console.error('- Invalid username or password');
    console.error('- 2FA enabled (not supported yet)');
    console.error('- Twitter flagged login as suspicious');
    console.error('- Network timeout');
    console.error('- Twitter UI changed\n');
    process.exit(1);
  } finally {
    if (browser) {
      console.log('🔚 Closing browser...');
      await browser.close();
      console.log('✅ Browser closed\n');
    }
  }
}

// Run test
testLogin().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
