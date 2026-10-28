# Hotel Reservation System · HOTEL MN

Aplicación universitaria funcional para buscar hoteles, consultar habitaciones
por fecha, indicar cuántos adultos y niños viajan para que el sistema calcule y
valide las habitaciones necesarias, registrar una cuenta, iniciar sesión,
confirmar y cancelar reservas.
El administrador gestiona hoteles/habitaciones y consulta o cancela reservas.

React 18 + TypeScript + Vite + Tailwind; Java 17 + Spring Boot 3.3.2,
Spring Security con sesión/CSRF, JPA y PostgreSQL 17; Flyway 10.20.1.
No usa JWT. Payment y Review se conservan por compatibilidad; no hay publicación
de reseñas. El checkout Stripe sandbox es opcional y está deshabilitado
por defecto; permite guardado consentido en Stripe y reserva recurrente con sus referencias,
sin recibir números de tarjeta ni CVV en la aplicación.
Guía y límites: [checkout y reserva recurrente HU-01](docs/HU01_CHECKOUT_INICIAL.md).

## Ejecutar y demostrar

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/isolated/run.ps1
```

Ejecuta migraciones, pruebas JUnit, validaciones frontend y Playwright en Docker,
sin tocar PostgreSQL de desarrollo. Al terminar, la demo está en
http://127.0.0.1:55173. La API usa el mismo origen, `/api`; PostgreSQL y backend
permanecen en una red interna. Las cuentas sintéticas y los pasos para repetir
desde cero están en [INICIO-LOCAL.md](INICIO-LOCAL.md).

La base legacy existente **no se migra automáticamente**. Una instalación nueva
exige habilitar explícitamente migraciones sobre una base vacía; una adopción
existente requiere respaldo, revisión y baseline explícito autorizado.

## Documentación

- [Inicio, administrador, demo y pruebas](INICIO-LOCAL.md).
- [Contrato API y reglas del dominio](docs/API.md).
- [Entorno aislado y reportes](tests/isolated/README.md).
- [AI Development Log](docs/AI_DEVELOPMENT_LOG.md).
- [Evidencia y diagnóstico histórico](docs/diagnosticos/ESTABILIZACION.md).
- [Auditoría inicial conservada](docs/auditorias/AUDITORIA_INICIAL.md).

La CI valida frontend y el ciclo completo DB/JUnit/Playwright en PR a `base` y `main`
y por ejecución manual, con reportes como artifacts. No despliega a producción.

## Historias integradas y pendientes

HU-02 aporta calendario; HU-06 aporta selección de habitaciones y huéspedes.
HU-01 incorpora checkout opcional Stripe sandbox y reutilización consentida.
HU-03 incorpora la pestaña administrativa **Previsión de demanda**, con histórico,
promedio semanal de ocho semanas, gráficos y horizonte de 30 días. Es informativa
y no modifica precios/inventario. [Método y demo](docs/HU03_PREVISION_DEMANDA.md).
El histórico básico de reservas se conserva para el funcionamiento del sistema.

## HU-04: constancia PDF

Desde **Mis reservas** se puede descargar la constancia de una reserva propia, confirmada o cancelada. Incluye sus datos y precios pactados; no acredita pagos ni es factura fiscal. [Contrato, seguridad y demostración](docs/HU04_CONSTANCIA.md).

La integración con HU-05 y las historias de main requiere revisión coordinada.

HU-01 conserva la selección múltiple de main: un pago confirma todas las
habitaciones; cancelar una solicita únicamente su reembolso. Migraciones nuevas
V8 checkout y V7 reservada para HU-05: coordinar antes de desplegar a una base
compartida. La suite aislada prueba V1–V6/V8 sin modificar desarrollo.
