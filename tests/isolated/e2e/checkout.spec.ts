import { test, expect } from '/work/node_modules/@playwright/test/index.mjs'

// UI contract DOUBLE only. No Stripe charge is represented by these responses.
test('checkout UI double: pending never claims a reservation; failure and verified result are distinct', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/login')
  await page.getByLabel('Usuario', { exact: true }).fill('demo-user')
  await page.getByLabel('Contraseña', { exact: true }).fill('Synthetic-user-123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible()
  let stage = 'PENDING'
  const id = '00000000-0000-4000-8000-000000000001'
  await page.route('**/api/checkouts/' + id + '/sync', route => route.fulfill({ json: {
    id, stage, paymentStatus: stage === 'SUCCEEDED' ? 'succeeded' : 'requires_payment_method',
    amountCents: 16000, currency: 'usd', expiresAt: new Date(Date.now() + 600000).toISOString(),
    reservationId: stage === 'SUCCEEDED' ? 999 : null, clientSecret: null,
  } }))
  await page.goto('/checkout/' + id)
  await expect(page.getByText('Pendiente de pago', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Autorizar y pagar' })).toBeDisabled()
  await expect(page.getByText('Reserva #999.')).toHaveCount(0)
  await expect(page.getByText(/esta aplicación no recibe su número ni CVV/)).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('checkout-ui-double-pending.png'), fullPage: true })
  stage = 'FAILED'
  await page.reload()
  await expect(page.getByText('Pago fallido', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Autorizar y pagar' })).toHaveCount(0)
  stage = 'SUCCEEDED'
  await page.reload()
  await expect(page.getByText('Pago de prueba completado', { exact: true })).toBeVisible()
  await expect(page.getByText('Reserva #999.')).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: test.info().outputPath('checkout-ui-double-success-mobile.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  expect(errors).toEqual([])
})

test('checkout UI double: unauthorized response exposes no payment form or reservation', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Usuario', { exact: true }).fill('demo-user')
  await page.getByLabel('Contraseña', { exact: true }).fill('Synthetic-user-123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible()
  const id = '00000000-0000-4000-8000-000000000002'
  await page.route('**/api/checkouts/' + id + '/sync', route => route.fulfill({ status: 403, json: { message: 'Checkout ajeno' } }))
  await page.goto('/checkout/' + id)
  await expect(page.getByRole('alert')).toContainText('Checkout ajeno')
  await expect(page.getByRole('button', { name: 'Autorizar y pagar' })).toHaveCount(0)
})

for (const useSaved of [false, true]) {
  test('checkout UI double: ' + (useSaved ? 'reuses an authorized method without card input' : 'records explicit consent for the first payment'), async ({ page }) => {
    const methodId = '00000000-0000-4000-8000-000000000123', checkoutId = '00000000-0000-4000-8000-000000000124'
    await page.route('**/api/checkouts/config', route => route.fulfill({ json: { enabled: true, mode: 'test', publishableKey: 'pk_test_synthetic' } }))
    await page.route('**/api/payment-methods', route => route.fulfill({ json: useSaved ? [{ id: methodId, brand: 'visa', lastFour: '4242', expiryMonth: 12, expiryYear: 2099, expired: false }] : [] }))
    const synthetic = { id: checkoutId, stage: 'SUCCEEDED', paymentStatus: 'succeeded', amountCents: 16000, currency: 'usd', expiresAt: new Date().toISOString(), reservationId: 999, clientSecret: null, savedMethod: useSaved, saveMethod: !useSaved }
    await page.route('**/api/checkouts', async route => {
      const input = route.request().postDataJSON()
      expect(input.paymentMethodId).toBe(useSaved ? methodId : null)
      expect(input.saveMethod).toBe(!useSaved)
      expect(Object.keys(input).sort()).toEqual(['endDate', 'paymentMethodId', 'roomId', 'saveMethod', 'startDate'])
      await route.fulfill({ json: synthetic })
    })
    await page.route('**/api/checkouts/' + checkoutId + '/sync', route => route.fulfill({ json: synthetic }))
    await page.goto('/login')
    await page.getByLabel('Usuario', { exact: true }).fill('demo-user')
    await page.getByLabel('Contraseña', { exact: true }).fill('Synthetic-user-123')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible()
    await page.goto('/products')
    await page.getByRole('link', { name: 'Ver habitaciones' }).first().click()
    const arrival = new Date(); arrival.setDate(arrival.getDate() + 100)
    const departure = new Date(arrival); departure.setDate(departure.getDate() + 2)
    await page.getByLabel('Entrada', { exact: true }).fill(arrival.toISOString().slice(0, 10))
    await page.getByLabel('Salida', { exact: true }).fill(departure.toISOString().slice(0, 10))
    await page.getByRole('button', { name: 'Consultar disponibilidad' }).click()
    await page.getByRole('button', { name: /Reservar habitación/ }).first().click()
    const consent = page.getByRole('checkbox', { name: /Autorizo guardar este método/ })
    await expect(consent).not.toBeChecked()
    if (useSaved) await page.getByRole('radio', { name: /visa.*4242/ }).check()
    else await consent.check()
    await page.getByRole('button', { name: 'Confirmar reserva', exact: true }).click()
    await expect(page).toHaveURL(new RegExp('/checkout/' + checkoutId))
    await expect(page.getByText('Pago de prueba completado', { exact: true })).toBeVisible()
    await page.screenshot({ path: test.info().outputPath(useSaved ? 'recurrent-contract-double.png' : 'consent-contract-double.png'), fullPage: true })
  })
}
