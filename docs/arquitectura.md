# Arquitectura del frontend

Aplicación Angular 22 con componentes standalone, señales y detección de cambios sin zonas
(`provideZonelessChangeDetection`).

## Capas

```
features/        páginas: dashboard, control, historial, IA, login, cambio de contraseña
  └─ shared/     piezas reutilizables: medidor, chips, tarjetas, diálogos, estados
core/
  api/           puerto GardenApi + implementación HTTP (mapea DTO del gateway → modelo)
  state/         GardenStore: señales compartidas y suscripciones en vivo
  realtime/      RealtimeService (STOMP real o canal en memoria para el modo demo)
  auth/          sesión, interceptor de token, interceptor de errores, guard de rutas
  i18n/          diccionarios ES/EN y servicio de traducción en tiempo de ejecución
  mock/          backend simulado (environment.useMock)
models/          contratos de la API y modelo de dominio
layout/          shell con barra superior, navegación y menú de usuario
```

## Flujo de datos

1. Tras el login, el shell arranca `GardenStore.start()`.
2. El store carga el estado inicial por REST (`/status`, `/config`, `/crops`, `/ai/analysis/latest`, `/weather`).
3. Se abre el canal STOMP en `/ws` y cada topic actualiza una señal:
   - `/topic/telemetry` → `status` y la muestra del gráfico en vivo.
   - `/topic/config` → `config` (modo, umbrales, cultivo).
   - `/topic/analysis` → `latestAnalysis` y el historial.
   - `/topic/device-status` → estado en línea del dispositivo.
4. Las vistas leen señales (directas o con `computed`), así que se repintan sin recargar la página.

## Reglas del proyecto

- Ninguna vista usa `HttpClient` directamente: siempre a través de `GardenApi`.
- Los DTO del gateway no llegan a las plantillas: `ApiMappers` los convierte en modelos de dominio.
- Las escrituras pasan por el store, que actualiza la señal sin esperar el eco del WebSocket.
- Con `environment.useMock` activo, `MockBackendInterceptor` y `MockRealtimeService` sustituyen a la red.
