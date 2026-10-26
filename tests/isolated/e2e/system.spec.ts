import { test, expect } from '/work/node_modules/@playwright/test/index.mjs'

let runtimeErrors: string[] = []
test.beforeEach(async ({ page }) => {
  runtimeErrors = []
  page.on('pageerror', error => runtimeErrors.push(error.message))
})
test.afterEach(async ({ page }) => {
  await page.screenshot({ path: test.info().outputPath('final-screen.png'), fullPage: true })
  expect(runtimeErrors, 'Errores de ejecución de React/navegador').toEqual([])
})

function future(days: number) { const d = new Date(); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10) }
test('navegador: CSRF, validaciones, duplicados, identidad y cierre de sesión', async ({ page, context }) => {
  await page.goto('/register')
  await page.getByLabel('Usuario', { exact: true }).fill('x')
  await page.getByRole('button', { name: 'Registrarme' }).click()
  await expect(page.locator('input[name="username"]:invalid')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('register-validation.png'), fullPage: true })
  const result = await page.evaluate(async () => {
    const username = 'security-' + Date.now()
    const account = { username, email: username + '@example.invalid', password: 'Synthetic-security-123' }
    async function send(path: string, body: object, protectedRequest = true) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (protectedRequest) {
        const response = await fetch('/api/auth/csrf', { credentials: 'include' })
        if (!response.ok) throw new Error('CSRF HTTP ' + response.status)
        const csrf = await response.json()
        headers[csrf.headerName] = csrf.token
      }
      return fetch('/api/auth/' + path, { method: 'POST', credentials: 'include', headers, body: JSON.stringify(body) })
    }
    const missingCsrf = (await send('register', account, false)).status
    const invalid = (await send('register', { ...account, email: 'invalid', password: 'short' })).status
    const registered = (await send('register', account)).status
    const duplicate = (await send('register', account)).status
    const wrongLogin = (await send('login', { username, password: 'incorrect' })).status
    const login = (await send('login', account)).status
    const meResponse = await fetch('/api/auth/me', { credentials: 'include' })
    const identity = await meResponse.json()
    return { missingCsrf, invalid, registered, duplicate, wrongLogin, login, username, identity }
  })
  expect(result).toMatchObject({ missingCsrf: 403, invalid: 400, registered: 201, duplicate: 409, wrongLogin: 401, login: 200 })
  expect(result.identity).toMatchObject({ username: result.username, role: 'USER' })
  expect((await context.cookies()).find(cookie => cookie.name === 'JSESSIONID')).toMatchObject({ httpOnly: true, sameSite: 'Lax', secure: false })
  await page.goto('/my-reservations')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible()
  const loggedOut = await page.evaluate(async () => {
    const csrf = await (await fetch('/api/auth/csrf')).json()
    const logout = await fetch('/api/auth/logout', { method: 'POST', headers: { [csrf.headerName]: csrf.token } })
    return { logout: logout.status, me: (await fetch('/api/auth/me')).status, reservations: (await fetch('/api/reservations/me')).status }
  })
  expect(loggedOut).toEqual({ logout: 204, me: 401, reservations: 401 })
})

test('cliente: registro, login, búsqueda, reserva, historial, cancelación y permisos', async ({ page }) => {
  const name = 'guest-' + Date.now()
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Nuestros hoteles' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver habitaciones' }).first()).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('home-catalog.png'), fullPage: true })
  await page.getByRole('link', { name: 'Registrarse', exact: true }).first().click()
  await page.getByLabel('Usuario', { exact: true }).fill(name)
  await page.getByLabel('Email', { exact: true }).fill(name + '@example.invalid')
  await page.getByLabel('Contraseña', { exact: true }).fill('Synthetic-guest-123')
  await page.getByRole('button', { name: 'Registrarme' }).click()
  await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.getByRole('link', { name: 'Iniciar sesión', exact: true }).click()
  await page.getByLabel('Usuario', { exact: true }).fill(name)
  await page.getByLabel('Contraseña', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toContainText('incorrectos')
  await page.screenshot({ path: test.info().outputPath('login-error.png'), fullPage: true })
  await page.getByLabel('Contraseña', { exact: true }).fill('Synthetic-guest-123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible()
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Acceso denegado' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Administración' })).toHaveCount(0)
  await page.goto('/products')
  await page.getByLabel('Destino o nombre').fill('zz-no-match')
  await page.getByRole('button', { name: 'Buscar hoteles' }).click()
  await expect(page.getByText('No encontramos hoteles')).toBeVisible()
  await page.getByLabel('Destino o nombre').fill('Hotel Demo 1')
  await page.getByRole('button', { name: 'Buscar hoteles' }).click()
  await page.getByRole('link', { name: 'Ver habitaciones' }).first().click()
  await page.getByLabel('Entrada', { exact: true }).fill(future(10))
  await page.getByLabel('Salida', { exact: true }).fill(future(12))
  await page.getByRole('button', { name: 'Consultar disponibilidad' }).click()
  await page.getByRole('button', { name: 'Reservar habitación 101', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Confirmar reserva' })).toContainText('160')
  await page.getByRole('button', { name: 'Confirmar reserva', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'confirmada' })).toBeVisible()
  await page.getByRole('link', { name: 'Ver mis reservas' }).click()
  await expect(page.getByText('CONFIRMED', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Cancelar reserva #/ }).click()
  await expect(page.getByText('CANCELLED', { exact: true })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('my-reservations.png'), fullPage: true })
  await page.reload()
  await expect(page.getByText('CANCELLED', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page.getByRole('link', { name: 'Iniciar sesión', exact: true })).toBeVisible()
  await page.goto('/my-reservations')
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
})

test('administrador: crear y editar inventario visible al público y filtrar reservas', async ({ page }) => {
  const hotelName = 'E2E Hotel ' + Date.now()
  await page.goto('/login')
  await page.getByLabel('Usuario', { exact: true }).fill('demo-admin')
  await page.getByLabel('Contraseña', { exact: true }).fill('Synthetic-admin-123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.getByRole('link', { name: 'Administración', exact: true }).click()
  const hotel = page.getByRole('form', { name: 'Formulario de hotel' })
  await hotel.getByLabel('Nombre del hotel').fill(hotelName)
  await hotel.getByLabel('Ubicación').fill('Panamá')
  await hotel.getByLabel('Descripción').fill('Inventario sintético creado desde el navegador')
  await hotel.getByRole('button', { name: 'Guardar hotel' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Hotel guardado' })).toBeVisible()
  await page.getByRole('button', { name: 'Editar hotel ' + hotelName, exact: true }).click()
  await hotel.getByLabel('Descripción').fill('Descripción editada desde el navegador')
  await hotel.getByRole('button', { name: 'Guardar hotel' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Hotel guardado' })).toBeVisible()
  await page.getByRole('tab', { name: 'Habitaciones', exact: true }).click()
  await page.getByRole('combobox', { name: 'Hotel', exact: true }).selectOption({ label: hotelName })
  const room = page.getByRole('form', { name: 'Formulario de habitación' })
  await room.getByLabel('Número de habitación').fill('E2E-1')
  await room.getByLabel('Tipo', { exact: true }).fill('Suite')
  await room.getByLabel('Precio por noche').fill('175')
  await room.getByRole('button', { name: 'Guardar habitación' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Habitación guardada' })).toBeVisible()
  await page.getByRole('button', { name: 'Editar habitación E2E-1', exact: true }).click()
  await room.getByLabel('Precio por noche').fill('180')
  await room.getByRole('button', { name: 'Guardar habitación' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Habitación guardada' })).toBeVisible()
  await page.getByRole('tab', { name: 'Reservas', exact: true }).click()
  await page.getByRole('combobox', { name: 'Estado', exact: true }).selectOption('CANCELLED')
  await page.getByRole('button', { name: 'Filtrar reservas' }).click()
  await expect(page.getByRole('form', { name: 'Filtrar reservas' })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('admin-reservations.png'), fullPage: true })
  await page.goto('/products?q=' + encodeURIComponent(hotelName))
  await page.getByRole('link', { name: 'Ver habitaciones' }).click()
  await expect(page.getByRole('heading', { name: /Habitación E2E-1/ })).toBeVisible()
  await expect(page.getByText(/180\.00 por noche/)).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('hotel-detail.png'), fullPage: true })
})

test('móvil: navegación y sesión accesibles sin desbordamiento', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Menú', exact: true }).click()
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Hoteles', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Encuentra tu hotel' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('mobile-catalog.png'), fullPage: true })
})

test('interfaz: informa un fallo CSRF sin enviar credenciales ni simular una sesión', async ({ page }) => {
  let loginRequests = 0
  page.on('request', request => { if (request.url().endsWith('/api/auth/login')) loginRequests++ })
  await page.route('**/api/auth/csrf', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Synthetic outage"}' }))
  await page.goto('/login')
  await page.getByLabel('Usuario', { exact: true }).fill('synthetic-unavailable')
  await page.getByLabel('Contraseña', { exact: true }).fill('Synthetic-unavailable-123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toContainText('HTTP 503')
  expect(loginRequests).toBe(0)
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
})
