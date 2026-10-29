# Internacionalización (ES / EN)

La aplicación está disponible en español e inglés. El idioma se cambia con el botón `ES / EN` de la barra
superior, de la pantalla de login y de la de cambio de contraseña.

## Cómo funciona

- `core/i18n/translations.ts`: dos diccionarios planos (`ES` y `EN`) con claves como `ctrl.thresholdsTitle`.
- `core/i18n/i18n.service.ts`: señal `lang` y método `t(clave, params)`.
  - `t()` lee la señal, así que cualquier plantilla que la use se repinta sola al cambiar de idioma.
  - Si falta una clave en inglés se usa el español; si tampoco existe, devuelve la clave.
  - Los marcadores `{crop}`, `{min}`… se sustituyen con el segundo argumento.
- La elección se guarda en `localStorage` (`smart-garden.lang`) y se refleja en `<html lang>`.
- Fechas y números usan el locale activo (`es-CO` / `en-US`).

## Convenciones

- Etiquetas de enums: `mode.AUTO`, `level.SATURATED`, `risk.HIGH`, `category.WEATHER`…
  Se resuelven con `modeLabel()`, `moistureLevelLabel()`, `riskLabel()`…
- Textos con datos: `t('ctrl.recommendedRange', { crop, min, max })`.
- El texto que genera el backend (titular de la IA, nombres de cultivo, errores del servidor) no se traduce:
  llega ya redactado en español.

## Añadir un idioma

1. Añade el código a `Language` y a `LANGUAGES` en `i18n.service.ts`.
2. Copia `ES` en `translations.ts`, traduce los valores y regístralo en `dictionaries`.
3. Registra el locale de `@angular/common/locales` si hace falta.
