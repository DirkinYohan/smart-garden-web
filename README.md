# Smart Garden – Web

Frontend Angular de **Smart Garden**: monitoreo de la huerta IoT en tiempo real y control del riego automático con IA. Habla **solo** con el `api-gateway` del backend (`smart-garden-backend`) por **REST** (`/api/v1`) y **WebSocket STOMP** (`/ws`).

- Angular 22 (standalone, signals, `@if`/`@for`, `inject()`, rutas lazy, zoneless) + Angular Material 3 (tema verde, modo oscuro).
- Chart.js 4 + ng2-charts 11, @stomp/rx-stomp 2.
- Toda la interfaz en español; fechas y números con el locale `es-CO`.

## Requisitos

- Node.js 20.19+ / 22+ (probado con Node 24) y npm.
- Para datos reales: el backend levantado (`docker compose up --build` en `smart-garden-backend`). Su CORS permite `http://localhost:4200`.

## Instalación y ejecución

```bash
npm install
```

Con el backend real (`environment.development.ts`):

```bash
npm start
```

Sin backend, con datos simulados (modo mock):

```bash
npm run start:mock
```

Abre <http://localhost:4200>. En modo mock inicia sesión con **admin / admin123**. Con el backend real usa el usuario configurado en `ADMIN_USERNAME` / `ADMIN_PASSWORD` del backend.

Otros comandos:

```bash
npm run build      # build de producción en dist/smart-garden-web
npm test           # tests unitarios (Vitest), en modo watch
npx ng test --watch=false
```

## Configuración (`src/environments`)

| Archivo | Se usa en | `useMock` |
|---|---|---|
| `environment.ts` | `ng build` (producción) | `false` |
| `environment.development.ts` | `ng serve` / `npm start` | `false` |
| `environment.mock.ts` | `npm run start:mock` (`--configuration mock`) | `true` |

```ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api/v1',
  wsUrl: 'ws://localhost:8080/ws',
  useMock: false,
};
```

Para apuntar a otro servidor cambia `apiUrl` y `wsUrl`, y agrega el origen del frontend a `CORS_ALLOWED_ORIGINS` en el backend.

## Pantallas

| Ruta | Pantalla | Contenido |
|---|---|---|
| `/login` | Inicio de sesión | Formulario reactivo con validaciones; token en `localStorage` |
| `/` | Panel | Medidor circular de humedad (rojo/verde/azul con marcas de umbral), bomba (animada al regar), ESP32 en línea y tiempo desde la última lectura, modo, cultivo, alerta «Revisar sensor», clima, resumen de IA con el próximo riego y mini gráfica en vivo |
| `/historial` | Historial | Gráfica 24 h / 7 d / 30 d (promedio + banda mín–máx + umbrales) y tabla paginada de riegos |
| `/control` | Control | Modo Automático / Manual / IA, cultivo, slider doble de umbrales (máx − mín ≥ 10; bloqueado en IA), pausa por lluvia, riego manual con confirmación y cuenta regresiva, edición de perfiles (diálogo) |
| `/ia` | Inteligencia artificial | Pantalla pensada para entenderse en 5 segundos; ver la sección siguiente |

## Pantalla de IA (`/ia`)

Cada sección carga y falla por separado (esqueleto, estado vacío o error con «Reintentar»), así que un fallo en `/ai/stats` no tapa el estado de la huerta.

| Sección | Qué muestra | Datos |
|---|---|---|
| **A. Estado de tu huerta** | Semáforo con ícono y texto (Bien / Atención / Crítico), titular y resumen, chip de la próxima acción, hora del análisis, insignia **Gemini** o **Reglas** y «Analizar ahora». Si se usaron las reglas, una nota en lenguaje simple explica por qué (sin cuota, sin clave, Gemini no respondió…). Si el análisis tiene más de 40 min, aparece un aviso. | `/ai/analysis/latest` (`headline`, `healthStatus`, `nextAction`, `fallbackReason`) |
| **B. Indicadores** | Humedad actual frente al rango recomendado (gráfica de bala, se actualiza con `/topic/telemetry`), próximo riego estimado con su confianza, velocidad de secado y lluvia en las próximas 12 h | `inputSnapshot`, `projection`, `/weather` |
| **C. ¿Cuándo hay que regar?** | Humedad real de las últimas 24 h (línea continua) y pronóstico de las próximas 24 h (línea punteada), banda recomendada, línea del mínimo, barras de probabilidad de lluvia (eje derecho) y marcas «Ahora» y «Riego estimado». Debajo, una frase de lectura («Si no llueve, la humedad bajará del 40 % cerca de las 2:40 p. m.»). En móvil la leyenda baja y el eje muestra solo el mediodía de cada día. | `/telemetry/history?range=24h`, `projection` |
| **D. ¿Qué te recomienda la IA?** | Tarjetas ordenadas por prioridad con ícono de categoría y chip de prioridad. Las que traen acción muestran un botón: diálogo de confirmación → `PUT /config` → snackbar. «Revisar sensor» abre los pasos de ayuda. Se ocultan las acciones que la configuración actual ya cumple. Los análisis antiguos sin detalles muestran las recomendaciones en texto. | `recommendationDetails`, `/config` |
| **E. ¿Por qué la IA decidió esto?** | Panel desplegable con los factores que recibió la IA; se resaltan los que más influyeron | `inputSnapshot` |
| **F. Tendencias (7 / 30 días)** | Humedad diaria (promedio con banda mín–máx y barras de riegos), historial de umbrales con puntos coloreados por riesgo, dona de salud con el % en el centro y fichas de resumen (análisis, hechos por Gemini, pausas por lluvia, minutos de bomba) | `GET /ai/stats?days=7\|30` |
| **G. ¿Va a llover?** | Probabilidad de lluvia por hora (barras) y temperatura (línea), próximas 12 h | `/weather` |
| **H. Historial de análisis** | Línea de tiempo compacta (semáforo, titular, fuente); al pulsar se abre el análisis completo; «Ver más» carga el resto | `/ai/analysis`, `/topic/analysis` |

- **Tiempo real:** un análisis nuevo por `/topic/analysis` muestra el snackbar «Nuevo análisis de la IA» y resalta la tarjeta A. Las gráficas no se redibujan cada segundo, porque el reloj de la pantalla avanza por minutos.
- **Colores:** verde = bien o dentro del rango, ámbar = atención, rojo = crítico o seco, azul = húmedo o lluvia. El color siempre va con texto e ícono.
- **Accesibilidad:** cada gráfica tiene un `aria-label` con el resumen en texto, y los formatos de fecha y número son `es-CO`.
- **Compatibilidad:** los campos v1.1 del análisis son opcionales. Si llegan `null`, ausentes o con un valor de enum desconocido, la pantalla degrada a lo que se pueda mostrar.
- **Componentes compartidos** (`shared/`): `health-badge`, `bullet-gauge`, `stat-tile`, `recommendation-card`, `sensor-help-dialog`, `chart-plugins` (marcas verticales y texto central de la dona) y `ai-labels` (textos, íconos y formatos).

## Arquitectura

```
src/app/
├── core/
│   ├── api/        GardenApi (abstracta), HttpGardenApi, api-mappers (contrato del gateway → modelos de UI)
│   ├── auth/       AuthService, authInterceptor, errorInterceptor, authGuard / guestGuard
│   ├── realtime/   RealtimeService (abstracta), StompRealtimeService (rx-stomp), MockRealtimeService
│   ├── mock/       MockBackend (simulación) + mockBackendInterceptor
│   ├── state/      GardenStore: estado compartido con signals (REST inicial + WebSocket)
│   ├── notification.service.ts (snackbars) · theme.service.ts (modo oscuro)
├── models/         garden.models.ts (UI) · api.models.ts (formato del gateway)
├── shared/         moisture-gauge, connection-indicator, empty/error/loading, confirm-dialog, labels
├── layout/         shell: toolbar + navegación lateral (escritorio) / inferior (móvil)
└── features/       auth/login · dashboard · history · control · ai
```

- **Autenticación:** `POST /auth/login` → `{token, expiresAt}` en `localStorage`. La sesión se cierra sola al expirar el token, y ante cualquier 401 el interceptor cierra la sesión y lleva al login.
- **Errores:** el interceptor muestra el `message` del cuerpo `{timestamp, status, error, message, path}` en un snackbar.
- **Tiempo real:** `/topic/telemetry`, `/topic/config`, `/topic/analysis` y `/topic/device-status`, con el JWT en el CONNECT y reconexión cada 5 s. El indicador de la toolbar muestra «Conectado / Reconectando… / Desconectado».
- **Modo mock:** `mockBackendInterceptor` responde las peticiones con **el mismo formato del gateway**, y `MockRealtimeService` emite una lectura cada 5 s. Así también se ejercitan los mapeos, los interceptores y los snackbars. El ESP32 simulado riega por umbrales en AUTO/IA y obedece la bomba en MANUAL, con 30 días de historial sembrado. El estado vive en memoria y se reinicia al recargar la página.

## Contratos de la API: diferencias y ajuste propuesto

La especificación del frontend describía algunas respuestas con una forma distinta a la del `api-gateway` ya implementado. **No se cambió ningún lado en silencio.** Los modelos de la UI (`models/garden.models.ts`) siguen la especificación, y `core/api/api-mappers.ts` traduce el formato real:

| Endpoint / tópico | Especificación | api-gateway real | Mapeo |
|---|---|---|---|
| `GET /status`, `/topic/telemetry` | plano, con `deviceOnline` y `timestamp` | `{deviceOnline, deviceStatus, lastSeen, reading:{…, receivedAt}}`; el tópico envía solo `reading` | Se aplana; `timestamp = receivedAt`; se agrega `hasReading` (sin lecturas, `reading` es `null`) |
| `GET /telemetry/history` | arreglo de puntos | `{range, intervalMinutes, points:[…]}` | `points` |
| `GET /irrigation/events` | `moistureStart/End` | `startMoisture/endMoisture`, `inProgress` | Renombrado; se conserva `inProgress` |
| `GET/PUT /config` | `cropId` | `crop:{…}` en la respuesta; `cropProfileId` en el PUT | `cropId = crop.id`; en el PUT `cropId → cropProfileId` |
| `GET /weather` | `temperature, airHumidity, rainProbabilityNext12h, precipitationNext12h, hourly[{time, rainProbability, temperature}]` | `{current:{temperature, relativeHumidity…}, hourly:[{precipitationProbability…}], maxRainProbability12h, totalPrecipitation12h}` | Campo a campo |
| `/topic/device-status` | `{deviceOnline, timestamp}` | `{deviceId, online, reason, changedAt}` | `online → deviceOnline`, `changedAt → timestamp` |
| `GET /ai/analysis/latest` | — | 404 si aún no hay análisis | Se trata como «sin análisis» (sin snackbar) |
| `GET /ai/analysis*` v1.1 | `headline, healthStatus, nextAction, recommendationDetails, inputSnapshot, projection` | Igual, y además `fallbackDetail`, `inputSnapshot.rainPause` e `inputSnapshot.readingAgeMinutes`; `fallbackReason` también puede ser `MODEL_NOT_FOUND` o `UNAVAILABLE` | Todos opcionales; enums desconocidos → `null` |

Si prefieres que el gateway responda exactamente con la forma de la especificación, el ajuste es solo en sus DTOs; aquí bastaría con simplificar `api-mappers.ts`.

## Accesibilidad y responsive

- Navegación lateral en escritorio e inferior en móvil (< 840 px), sin desbordes horizontales a 375 px.
- `aria-label` en todos los botones de solo ícono, medidor con `role="meter"`, indicador de conexión con `aria-live`, enlace «Saltar al contenido», foco visible y respeto de `prefers-reduced-motion`.
- Modo oscuro con el interruptor de la toolbar; se guarda la preferencia y por defecto se sigue la del sistema.

## Tests

`npx ng test --watch=false` (Vitest + jsdom):

- `auth.service.spec.ts`: login, restauración y expiración de la sesión, logout.
- `auth.guard.spec.ts`: redirección al login con `returnUrl` y bloqueo del login con sesión activa.
- `error.interceptor.spec.ts`: snackbar con el `message` del backend, 401 → cierre de sesión, error de red, peticiones silenciosas.
- `http-garden-api.spec.ts`: mapeo de cada contrato del gateway (status, history, config, weather, 404 del último análisis).
- `mock-backend.spec.ts`: simulación (409 fuera de MANUAL, validación de umbrales, límite de un análisis por minuto, `/ai/stats` de 7 y 30 días, campos v1.1 del análisis).
- `api-mappers.spec.ts`: campos nuevos del análisis, `inputSnapshot` y `/ai/stats`; degradación de análisis antiguos, de `null` y de enums desconocidos.
- `ai-actions.spec.ts`: cuerpo del `PUT /config` de cada acción y cuándo ocultar una acción que ya está aplicada.
- `why-factors.spec.ts`: factores resaltados, textos con datos `null` y marcas horarias del eje de la gráfica.
