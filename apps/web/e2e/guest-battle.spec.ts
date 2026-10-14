import { expect, test } from '@playwright/test'

// Tracing continuously screenshots moving frames and distorts software-GPU FPS.
// Keep explicit result screenshots; measure this performance smoke without tracing.
test.use({ trace: 'off', screenshot: 'only-on-failure' })

test('guest can open a real-player battle and see the HUD', async ({ page }, testInfo) => {
  const nickname = `Pilot${testInfo.workerIndex}${Date.now().toString().slice(-5)}`

  await page.goto('/')
  await expect(page.getByRole('heading', { name: /FRONTGA CHIQING/i })).toBeVisible()

  await page.getByRole('textbox', { name: 'CALLSIGN' }).fill(nickname)
  await page.getByRole('button', { name: 'GUEST SIFATIDA KIRISH' }).click()
  await expect(page.getByText('FRONT SIZNI KUTMOQDA')).toBeHidden()

  await page.getByRole('button', { name: /Angar/i }).click()
  await expect(page.getByRole('heading', { name: /Tank angari/i })).toBeVisible()
  await expect(page.locator('.tank-roster canvas')).toHaveCount(10)
  const vehicleImages = await page.locator('.tank-roster canvas').evaluateAll(canvases => canvases.map(c => (c as HTMLCanvasElement).toDataURL()))
  expect(new Set(vehicleImages).size).toBe(10)
  await page.screenshot({ path: testInfo.outputPath('garage.png') })

  await page.getByRole('button', { name: /Janglar/i }).click()
  await expect(page.getByRole('heading', { name: 'FRONT XARITASI' })).toBeVisible()
  await page.getByRole('button', { name: 'GLOBAL MATCH' }).click()

  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/O‘YINCHI KUTILMOQDA|JANGGA TAYYORLANING|40 KILLGACHA|BAZANI EGALLANG/)).toBeVisible()
  await expect(page.getByText(new RegExp(`${nickname} /`))).toBeVisible()
  await expect(page.getByText(/\d+\/16 ONLINE/)).toBeVisible()

  const zoom = page.getByLabel('Zoom darajasi')
  const initialZoom = Number((await zoom.innerText()).replace('%', ''))
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click()
  await expect(zoom).toHaveText(`${initialZoom - 15}%`)
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect(zoom).toHaveText(`${initialZoom}%`)
  if (!testInfo.project.name.includes('mobile')) {
    await page.locator('canvas').hover()
    await page.mouse.wheel(0, 250)
    await expect.poll(async () => Number((await zoom.innerText()).replace('%', ''))).toBeLessThan(initialZoom)
  }
  const ability = page.getByRole('button', { name: 'Maxsus qobiliyat (Q)', exact: true })
  await expect(ability).toBeEnabled()
  if (testInfo.project.name.includes('mobile')) await ability.click()
  else await page.keyboard.press('q')
  await expect(ability).toBeDisabled()
  await expect(ability).toContainText(/\d+s/)
  const localMarker = page.locator('.tactical-map circle[fill="#fff1b1"]')
  const startY = Number(await localMarker.getAttribute('cy'))
  const stats = page.getByLabel('O‘yin unumdorligi')
  await expect.poll(async () => Number(await stats.getAttribute('data-fps'))).toBeGreaterThan(0)
  if (testInfo.project.name.includes('mobile')) await page.locator('.touch-dpad .down').dispatchEvent('pointerdown')
  else await page.keyboard.down('s')
  const measurements: { fps: number; p95: number; updateMs: number; renderMs: number }[] = []
  try {
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(500)
      measurements.push({ fps: Number(await stats.getAttribute('data-fps')), p95: Number(await stats.getAttribute('data-p95')), updateMs: Number(await stats.getAttribute('data-update-ms')), renderMs: Number(await stats.getAttribute('data-render-ms')) })
    }
  } finally {
    if (testInfo.project.name.includes('mobile')) await page.locator('.touch-dpad .down').dispatchEvent('pointerup')
    else await page.keyboard.up('s')
  }
  expect(Number(await localMarker.getAttribute('cy')) - startY).toBeGreaterThan(50)
  await testInfo.attach('movement-performance', { body: JSON.stringify(measurements), contentType: 'application/json' })
  console.log(`${testInfo.project.name} movement: ${JSON.stringify(measurements)}`)
  console.log(`Game renderer: ${await stats.getAttribute('data-renderer')}`)
  const diagnostic = await page.context().browser()!.newBrowserCDPSession()
  const gpu = await diagnostic.send('SystemInfo.getInfo')
  console.log(`Renderer: ${JSON.stringify(gpu.gpu.devices)}`)
  await diagnostic.detach()
  await page.screenshot({ path: testInfo.outputPath('battlefield.png') })

  await page.getByRole('button', { name: /CHIQISH/ }).click()
  await expect(page.getByRole('heading', { name: /FRONTGA CHIQING/i })).toBeVisible()
})
