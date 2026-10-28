# Validación aislada del sistema completo

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/isolated/run.ps1
```

Linux/CI: `pwsh -File tests/isolated/run.ps1`. Se fija siempre proyecto
`hotel-reservation-system-test`, archivo `compose.test.yaml` y `empty.env`.
Se rechaza comenzar sobre contenedores de pruebas ya existentes.

Para repetir: `powershell -NoProfile -ExecutionPolicy Bypass -File tests/isolated/reset.ps1`.
Ese comando verifica nombres, etiquetas, redes y montajes antes de retirar
**solo** los recursos temporales; rechaza recursos desconocidos o checks activos.
No elimina archivos, volúmenes de desarrollo ni utiliza limpieza global.

## Recorrido ejecutado

1. Construir imágenes con Java 17/Maven, Node 22 y Chromium/Playwright 1.60.0.
   Los checks usan copias de fuentes y cachés propias. Maven Central se configura
   solo dentro de las imágenes; no se instalan herramientas globales.
2. PostgreSQL 17.11 en tmpfs, sin puerto del host y con credenciales públicas
   exclusivas de pruebas; bases `hotel_test`, `hotel_legacy`, `hotel_adopt` y
   `hotel_demo` (vacía para verificar arranque automático).
3. Restaurar DDL original sin datos, cargar seis fixtures sintéticos en la copia
   de adopción, migrar V1 desde cero y demostrar rechazo sin baseline.
4. Baseline explícito 1, comparar V1 fielmente, aplicar V2 en ambas rutas,
   repetir migrate/validate y comprobar igualdad de DDL y conservación de
   columnas legacy, fechas, IDs y posiciones de secuencia.
5. Arrancar el JAR real contra `hotel_demo` vacía: Boot ejecuta automáticamente
   V1/V2, Hibernate validate, readiness y catálogo vacío. El proceso temporal se
   detiene al verificarlo. Rechazar URLs de desarrollo antes de Maven (64 y marcador).
6. `mvn -o -B -ntp clean verify`, prueba adicional de autoconfiguración Flyway/Boot
   y árbol de dependencias. El backend principal ya incluye Flyway 10.20.1,
   módulo PostgreSQL, validación y Security; no se inyecta un POM alternativo.
7. TypeScript, ESLint y build de producción en la copia frontend.
8. Iniciar una demo vacía con perfil explícito y datos sintéticos; esperar readiness.
9. Cargar exclusivamente en hotel_test el escenario histórico HU-03: 132 noches
   confirmadas, ocho cancelaciones en ventana, lunes 12/8=1.50; backend marcado
   SYNTHETIC_DEMO. El SQL rechaza hotel-bd y no pertenece al arranque normal.
10. Playwright: regresión de cliente/administración/móvil y HU-03 (gráficos,
    matemáticas, filtros, insuficiencia, permisos, errores y sesión expirada).

HU-03 añade pruebas puras del cálculo y consultas de PostgreSQL con reloj fijo.
Se comprueban noches con salida exclusiva, cancelaciones, capacidad, datos legacy
y snapshots de tablas antes/después de consultas. La interfaz ofrece tablas además
de gráficos Recharts. Guía y resultados esperados:
[HU03_PREVISION_DEMANDA.md](../../docs/HU03_PREVISION_DEMANDA.md).

`-SkipBuild` solo reutiliza imágenes que ya reflejan las fuentes actuales.
`-SkipE2E` omite demo/navegador, manteniendo DB/JUnit/frontend.

## Aislamiento y acceso manual

PostgreSQL, backend y runners solo pertenecen a la red interna propia. El
frontend de demo se conecta además a una red web exclusiva del proyecto, sin
credenciales PostgreSQL, para publicar **127.0.0.1:55173**. La API se accede por
`http://127.0.0.1:55173/api`; el backend no publica puerto y PostgreSQL tampoco.
Ningún servicio se une a la red de desarrollo ni monta su volumen PostgreSQL.
Esta separación permite acceso desde Docker Desktop sin abrir salida de la base
ni de los runners. Los puertos 3000/5173/5432 de desarrollo no son targets de pruebas.

La configuración Spring `isolated` exige datasource explícito, Hibernate validate,
Flyway sin baseline automático/clean y DevTools desactivado. Las URLs de desarrollo
se rechazan explícitamente en ambos runners; no hay fallback a properties privadas.
Las fuentes de la aplicación no se montan en los servicios de ejecución.
Solo se escriben reportes en `.local/isolated-artifacts/`.

La demo usa únicamente cuentas sintéticas de `compose.test.yaml` y exige base
vacía `hotel_test`; la carga no es un seeder de producción. Las instrucciones
para usuarios/admin y para una instalación normal están en [INICIO-LOCAL.md](../../INICIO-LOCAL.md).

## Evidencias

- `.local/isolated/<fecha>/`: logs por comprobación y códigos de salida.
- `.local/isolated-artifacts/backend/surefire-reports/`: XML y texto de JUnit.
- `.local/isolated-artifacts/e2e/<fecha>/`: HTML, JUnit, capturas y trazas de fallo.
- Las ejecuciones fallidas se conservan; sus logs no se presentan como aprobados.

En GitHub Actions los mismos directorios se suben como artifacts incluso cuando
falla una prueba. Todos los códigos obligatorios se propagan; solo los rechazos
negativos concretos se aceptan después de comprobar mensaje/código.

`schema/legacy.sql` y `migrations/V1__legacy_schema.sql` son referencias del ensayo
inicial. Las migraciones activas están en `backend/src/main/resources/db/migration`
(subproyecto `hotel-reservation-system-backend`). `flyway-profile.xml` y
`prepare-backend.awk` se conservan como referencia de la comprobación anterior;
las imágenes actuales no los usan. El harness no interviene sobre desarrollo.
La adopción posterior de desarrollo, autorizada expresamente tras el diagnóstico
web, se documenta en [AI Development Log](../../docs/AI_DEVELOPMENT_LOG.md).
La auditoría histórica permanece intacta. Los respaldos privados de esa operación
no pertenecen a los artifacts del harness ni se publican en GitHub.

## Seguimiento de historial HU-03 (V6)

El harness también valida V6 en instalación limpia y adopción legacy, y ejecuta
DemandHistoryBatchTests: seis pruebas de idempotencia, determinismo, intervalos,
procedencia por filtros, rollback y reversión exclusiva con dependencias.
Estas pruebas permanecen restringidas a hotel_test; no generan datos en desarrollo.
El procedimiento explícito y separado de desarrollo se documenta en
[Historial sintético HU-03](../../docs/HU03_HISTORIAL_SINTETICO.md).
