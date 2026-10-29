# Pruebas del frontend

## Ejecutar

```bash
npm ci
npx ng test --watch=false     # una pasada (Vitest + jsdom)
npm run build                 # compilación de producción
```

## Qué se cubre

| Área | Archivo | Se verifica |
|---|---|---|
| Mapeo de la API | `core/api/api-mappers.spec.ts` | DTO del gateway → modelo de dominio |
| Cliente HTTP | `core/api/http-garden-api.spec.ts` | Rutas, parámetros y cuerpos enviados |
| Sesión | `core/auth/auth.service.spec.ts` | Token, expiración y cierre de sesión |
| Guard | `core/auth/auth.guard.spec.ts` | Rutas privadas y cambio de contraseña obligatorio |
| Errores | `core/auth/error.interceptor.spec.ts` | 401/403/409/423 traducidos a mensajes |
| Estado | `core/state/garden-store.spec.ts` | Derivaciones: cultivo actual, análisis que no corresponde… |
| Idioma | `core/i18n/i18n.service.spec.ts` | Cambio, persistencia, marcadores y formato |
| Modo demo | `core/mock/mock-backend.spec.ts` | Comportamiento del backend simulado |
| Nivel de humedad | `shared/moisture-level.spec.ts` | Límites de los seis niveles |
| Medidor | `shared/moisture-gauge.spec.ts` | Arco, banda recomendada y texto |
| Chip | `shared/moisture-level-chip.spec.ts` | Icono, texto y tono |
| Control | `features/control/control.spec.ts` | Umbrales, modos y cambio de cultivo |
| Login | `features/auth/login/login.spec.ts` | Validación y cuenta bloqueada |
| Contraseña | `features/auth/change-password/change-password.spec.ts` | Requisitos de la política |
| IA | `features/ai/*.spec.ts` | KPIs según el sensor, factores y aviso de actualización |

Las pruebas no dependen de la red: el modo demo y los dobles de prueba sustituyen al gateway.
