import { test, expect } from '@playwright/test'

test.describe('Stanza App E2E Tests', () => {
  test('homepage has correct title', async ({ page }) => {
    // Navigate to dev server
    await page.goto('http://localhost:7777')
    // Check that title contains Stanza
    await expect(page).toHaveTitle(/Stanza/i)
  })

  test('app root renders correctly', async ({ page }) => {
    await page.goto('http://localhost:7777')
    const rootElement = page.locator('#root')
    await expect(rootElement).toBeAttached()
  })
})
