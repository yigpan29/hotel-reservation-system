# Hotel Reservation System · HOTEL MN

Aplicación universitaria funcional para buscar hoteles, consultar habitaciones
por fecha, registrar una cuenta, iniciar sesión, confirmar y cancelar reservas.
El administrador gestiona hoteles/habitaciones y consulta o cancela reservas.

React 18 + TypeScript + Vite + Tailwind; Java 17 + Spring Boot 3.3.2,
Spring Security con sesión/CSRF, JPA y PostgreSQL 17; Flyway 10.20.1.
No usa JWT, pagos externos ni datos de tarjetas. Payment y Review se conservan
por compatibilidad; no hay flujos de pago ni publicación de reseñas.

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

La CI valida frontend y el ciclo completo DB/JUnit/Playwright en PR a `base`
y por ejecución manual, con reportes como artifacts. No despliega a producción.

## Exclusiones

HU-01 (checkout acelerado/medios de pago) y HU-02 (calendario interactivo avanzado)
permanecen fuera de esta rama. HU-03 incorpora la pestaña administrativa
**Previsión de demanda**, con histórico, promedio semanal de ocho semanas,
gráficos y horizonte de 30 días. Es informativa y no modifica precios/inventario.
Método, limitaciones y demo aislada: [HU03_PREVISION_DEMANDA.md](docs/HU03_PREVISION_DEMANDA.md).
El histórico básico de reservas se conserva para el funcionamiento del sistema;
no implementa esas historias individuales.
# HU-04: constancia PDF

Desde **Mis reservas** se puede descargar la constancia de una reserva propia, confirmada o cancelada. Incluye sus datos y precios pactados; no acredita pagos ni es factura fiscal. [Contrato, seguridad y demostración](docs/HU04_CONSTANCIA.md).
