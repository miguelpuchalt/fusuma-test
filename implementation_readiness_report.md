# Etapa 9: Preparación para implementar

* **Documento revisado:** `docs/designs/emergency_triage.md`, DetailedRange (líneas 597-755: «## Detailed Implementation Plan» hasta el final). Las líneas 1-596 se usaron solo como referencia.
* **Revisores (Goldfish, en paralelo):**
  * `egm-implementation-readiness`: 0 bloqueantes, 3 importantes, 6 menores. Veredicto: «listo tras los arreglos».
  * `egm-codebase-details`: 0 bloqueantes, 6 importantes, 4 menores. Veredicto: «sin bloqueos; listo con los arreglos 2, 3, 4, 5 y 7».
  * `egm-style`: 0 bloqueantes, 8 importantes, 16 menores. Veredicto: «no listo», por redacción.
* **Criterios del autor aplicados:**
  * bloqueante solo si impide un requisito obligatorio o el recorrido esencial de la demo;
  * cada hallazgo se etiqueta como defecto, mejora opcional o preferencia;
  * nada de persistencia, reintentos automáticos ni concurrencia;
  * siempre la solución más sencilla;
  * ninguna hora extra sin decir de dónde sale.
* **Comprobaciones del Elephant:**
  * La línea 603 (fase 0) es como la citan los revisores.
  * La 630 («se comprueba en la fase 0») y la 749 (`.output/public`) también.
  * Los archivos 4 y 36 están marcados como «Create», y `.gitignore` y `README.md` ya existen en la raíz.
  * El paso 5 no menciona `maxRetries`.
* **Nota de calibración:** el «no listo» de `egm-style` se debe a que cuenta 8 defectos de redacción como importantes. Con los criterios del autor, la mayoría son correcciones de texto. Ninguno impide un requisito. Los que pueden dar una implementación equivocada o una verificación imposible pasan a la lista de imprescindibles. El resto queda en menores.

## ¿Comprueba pronto la fase 0 el despliegue y una llamada real a AI Gateway?

**En parte.** La condición de salida de la fase 0 («la URL pública devuelve una decisión válida») obliga a que la llamada salga del entorno desplegado, y eso es lo esencial. Pero:

| Qué hace falta comprobar | ¿Lo dice el plan? |
|---|---|
| Que la página se pinta en el servidor (SSR) | No. Solo se despliega la plantilla. |
| Cómo se lanza la llamada sin interfaz (la interfaz llega en la fase 5) | No. |
| Que la llamada usa el `AiDecisionSchema` real, para comprobar la Alternativa I el día 1 | No. El esquema es de la fase 2. |
| Variables en Vercel (`TRIAGE_MODEL`, `DEMO_PASSWORD`; OIDC en lugar de `AI_GATEWAY_API_KEY`) | Solo en `.env.example`, no en la salida de la fase. |
| Crédito del Gateway: saldo y coste de una llamada | No. |
| Adaptador de despliegue y `maxDuration` efectivo | «Se comprueba», sin decir qué ni dónde. |
| Qué hacer si ningún modelo funciona | Dice «modo sin API» y contradice la Alternativa L (BYOK). También repite la promesa exagerada de M3. |

Lo resuelve **I1**.

## Imprescindibles antes de empezar (todas son correcciones de texto)

Ninguna es un bloqueante de diseño. Son decisiones que el plan deja abiertas y que Claude Code tendría que tomar por su cuenta, o condiciones de salida que no se pueden cumplir tal como están escritas.

**I1. Reescribir la condición de salida de la fase 0** · *defecto real* · línea 603 · IR-1, CD (fase 0), M3
- **Solución más sencilla.** La fase 0 termina cuando se cumple todo esto:
  1. `curl <URL>` devuelve HTML con contenido ya pintado.
  2. Un botón temporal en `src/routes/index.tsx` llama a `triageReport` con S1 y la contraseña, y la respuesta pasa `AiDecisionSchema`. Para ello `AiDecisionSchema` y la comprobación de la contraseña se adelantan de la fase 2 a la fase 0.
  3. En Vercel están configuradas `TRIAGE_MODEL` y `DEMO_PASSWORD`, y la autenticación es por OIDC.
  4. Se anotan el saldo del crédito y los tokens que consumió la llamada.
  5. Si ningún modelo funciona, se aplica la Alternativa L (BYOK o unos euros de saldo). Solo si eso tampoco funciona se pasa al modo sin API, que cubre solo lo que dice M3.
- **Coste:** unas 0,25 h que pasan de la fase 2 a la fase 0. No se añade nada.

**I2. Añadir una subsección «Decisiones de API fijadas»** · *defecto real* · líneas 630, 697 y 698 · CD-2, CD-3, CD-4, CD-5, CD-7, IR-2, IR-6
- **Contenido de la subsección:**
  - **Server Function:**
    - `createServerFn({ method: 'POST' })`. Por defecto el método es GET, con el que el contexto (hasta 128 KB) y la contraseña irían en la URL. Con un contexto grande, la URL se pasaría del límite de Vercel y la ráfaga fallaría.
    - Validador solo de tipo y `safeParse` dentro de la función, para que una entrada no válida devuelva `invalid_input` y no lance una excepción.
  - **Llamada al modelo:**
    - `maxRetries: 0`. El AI SDK reintenta 2 veces por defecto, y eso contradice el alcance «sin reintentos automáticos».
    - `abortSignal: AbortSignal.timeout(15_000)`.
  - **Esquema:** el esquema que recibe el SDK no lleva `.max` en los textos; esos límites los aplica el recorte del paso 7.
  - **Traducción de errores:**
    - el error del SDK cuando la salida no cumple el esquema → `invalid_output`;
    - un error de timeout o de aborto → `timeout`;
    - `statusCode === 429` → `rate_limit`.
  - **Contraseña:** se compara el SHA-256 de las dos cadenas con `timingSafeEqual`. Comparadas directamente, si las longitudes difieren se lanza una excepción, y el CUJ 9 acabaría en `server`.
  - **Versiones:**
    - versión mayor exacta de `ai` y la función concreta (`generateObject`, o `generateText` con `Output.object`, según la versión);
    - `zod` con versión mayor fijada;
    - versiones exactas en `package.json`.
  - **Gemini:** `thinkingBudget: 0`, para que el razonamiento no se coma los 800 tokens de salida.
  - **ID del modelo:** el que ofrezca el catálogo del Gateway. La expresión «versión exacta» (líneas 365 y 632) se sustituye por «ID fijado en la fase 0».
  - **Regla general:** lo que la fase 0 descubra distinto se anota en esta misma subsección.
- **Coste:** unos 15-20 min de redacción y 0 h de implementación.

**I3. Adaptador de Vercel y `maxDuration`** · *defecto real* · líneas 630 y 749 · IR-3, CD-6, estilo 7
- **Problema:** el límite de duración por defecto depende del plan y de la configuración de Vercel, y podría ser menor que los 15 s del timeout de IA.
- **Solución más sencilla.** Escribir: «Se sigue la guía oficial de Vercel para TanStack Start vigente el día 1.»
  - El plan propone fijar `maxDuration: 30` en la configuración de Nitro, dentro de `vite.config.ts`.
  - Si no se aplica, se crea `vercel.json`, que se añade a la lista como «Create si hace falta».
  - Salida de la fase 0: el panel de Vercel muestra 30 s.
  - El README anota la carpeta de salida del cliente, y la verificación 3 busca ahí en lugar de en `.output/public`.
- **Coste:** cabe en las 2 h de la fase 0.

**I4. Los archivos `.gitignore` y `README.md` ya existen** · *defecto real* · líneas 633 y 739 · CD-1
- **Solución más sencilla:**
  - Marcar los archivos 4 y 36 como **Modify**. En el 4: «añadir `.env*` y `!.env.example`; conservar el resto».
  - En la fase 0, generar la plantilla en una carpeta temporal y copiarla. El generador puede negarse a escribir en una carpeta que no está vacía, o sobrescribir los archivos.
- **Coste:** 5 min.

**I5. Un único criterio de «la ráfaga coincide con el guion» y un alcance cerrado para la fase 6** · *defecto real* · líneas 609, 673 y 748 · estilo 4 y 5, M1
- **Solución más sencilla:**
  - En los tres sitios, escribir: «coincide con los resultados esperados del archivo 9 según la regla de la línea 673».
  - En la fase 6 solo se modifica `src/ai/prompt.ts`, subiendo `PROMPT_VERSION`. Los archivos 8 y 9 no cambian.
  - Entre una ráfaga y la siguiente se espera 1 minuto (M1).
  - Si no se consigue, se anota en «Limitaciones conocidas» del README.
- **Coste:** solo texto.

**I6. Las respuestas pregrabadas usan valores únicos** · *defecto real* · líneas 649 y 729 · estilo 6
- **Problema:** el test 34 exige una coincidencia exacta, pero el archivo 9 da rangos y alternativas.
- **Solución más sencilla:**
  - Usar el valor que va fuera del paréntesis.
  - Escribir explícitamente las gravedades de A:
    - S1: Media;
    - S2: Alta;
    - S4: Alta;
    - S7: Crítica.
  - Fijar un único nombre para la categoría de E.
- **Coste:** solo texto.

**I7. Cada archivo con su fase** · *defecto real* · líneas 601-611 · estilo 3, IR-8
- **Solución más sencilla:** añadir a la tabla de fases una columna «Archivos»:

  | Fase | Archivos |
  |---|---|
  | 0 | 1 a 4 |
  | 1 | 5 a 7 y 10 a 14, con los tests 31 y 32 |
  | 2 | 15 a 18, con el test 33 |
  | 3 | 19, 21 y 22, con el test 35 |
  | 4 | 8, 9 y 20, con el test 34 |
  | 5 | 23 a 30 |
  | 7 | 36 |

  La salida de la fase 1 pasa a ser «tests 31 y 32 en verde», no solo `npm test`.
- **Coste:** solo texto.

**I8. Correcciones pendientes de la etapa 8** (ver `intermediate_zoom_out_report.md`)
- **M1:** esperar 1 minuto entre ráfagas. Queda cubierto por I5.
- **M2:** tabla de qué CUJ se recorre en cada modo:
  - modo sin API: CUJ 1, 4, 5, 6 y 8;
  - modo IA: todos menos el 8.
  - El CUJ 7 se cubre con el test 35 y con una ejecución local con un `TRIAGE_MODEL` no válido. También afecta a la línea 608 (estilo 24) y a IR-9.
- **M3:** R2 dice qué cubre de verdad el modo sin API. Queda cubierto en parte por I1.
- **M4:** el diálogo de contraseña no se puede cerrar sin contraseña. Para salir, se usa «Reiniciar» o se recarga la página.
- **N1:** «Reiniciar» conserva `mode` y la contraseña (`createInitialState(mode)`).
- **N2:** dentro de cada vuelta de `drain()`, cualquier excepción pasa a `markError(report, "server")`.

**Coste total de las imprescindibles:** unos 45-60 min de edición del documento, antes de implementar. Horas de implementación: unas 0,25 h que pasan de la fase 2 a la fase 0. **No hay que recortar nada.**

## Menores (🟢): se pueden aplicar en la misma pasada o dejar a criterio de quien implementa

| # | Hallazgo | Etiqueta | Solución |
|---|---|---|---|
| m1 | Faltan en la lista `src/lib/utils.ts` (lo crea shadcn), `src/routeTree.gen.ts` (generado), el componente `input` de shadcn y, quizá, `vitest.config.ts`. | Defecto real | Añadirlos con una línea cada uno. `vitest.config.ts` sin plugins, con entorno `node`, solo si Vitest falla con el plugin de Start. |
| m2 | No se dice quién crea la instancia de la cola ni dónde están `setMode`, `resetDemo` y `setPassword`. | Defecto real | `triage-store.ts` exporta la instancia `triageQueue` y esas tres acciones. |
| m3 | Faltan tests: un aviso inexistente o que no está en `processing`; un `join` a un incidente `pending` de otra planta; `retry` que vuelve al final de la cola. Además, `FallbackEngine` espera sin poder sustituir el temporizador. | Defecto real | Añadir los tres casos y la firma `createFallbackEngine(getState, sleep)`. Unos 15 min, dentro de las fases 1, 3 y 4. |
| m4 | El patrón de rutas de shadcn usa el alias `@/*` y la plantilla suele traer `~/*`. | Defecto real | Fijar `@/*`. |
| m5 | `npx shadcn init` hace preguntas interactivas. | Mejora opcional | Indicar las respuestas o los flags. |
| m6 | `floorLabel` solo tiene ejemplos. | Mejora opcional | n > 0 → «Planta n»; 0 → «Planta baja»; n < 0 → «Sótano \|n\|». |
| m7 | Faltan los nombres visibles de las categorías oficiales. | Mejora opcional | Escribir los pares ID → nombre. |
| m8 | «Paso 5», «paso 8» y «pasos 1 a 9» no dicen de qué sección son. | Mejora opcional | Añadir «del Technical Plan §5». |
| m9 | La generación de UUID se describe de dos formas (líneas 704 y 705). | Mejora opcional | Usar solo `crypto.randomUUID`, inyectado en la cola. |
| m10 | No se dicen los colores de las gravedades. | Preferencia | Dar los tokens de Tailwind o dejarlo a la fase 5. |
| m11 | Rutas incompletas (`IncidentCard.tsx`, `PasswordDialog.tsx`); falta `src/styles/` en la tabla de estructura. | Mejora opcional | Escribir la ruta completa. |
| m12 | `triageReport` aparece en la fase 0, pero su archivo (18) es de la fase 2. | Mejora opcional | «Versión provisional en la fase 0, que la fase 2 completa.» Queda resuelto con I1. |
| m13 | «Recortes» (línea 728) y «comportamiento básico de la cola» (línea 745) son vagos. | Mejora opcional | Nombrar los campos y los límites, y «los casos del archivo 35». |
| m14 | En la línea 750, «avisos de hidratación» se confunde con «aviso» (report). | Mejora opcional | «Advertencias de hidratación (hydration mismatch).» |
| m15 | «Mejoras opcionales en su orden» remite a una lista que está fuera del rango. | Mejora opcional | Citar la sección. |
| m16 | «El test que se enseña en la entrevista» no le sirve a quien implementa. | Preferencia | Moverlo al guion de la demo. |

## Lo que pasa sin cambios

- Los 36 archivos tienen su justificación.
- El orden de las fases respeta las dependencias, salvo lo que corrigen I1 e I7.
- El presupuesto suma 24 h.
- Los tests cubren `applyDecision`, las acciones, el contrato con la IA, el motor sin API y la cola. Solo faltan los casos de m3.
- Los nombres de las variables de entorno están fijados y ninguno lleva el prefijo `VITE_`.
- La descripción de SSR (store en módulo, que el servidor no modifica) y la estructura de rutas coinciden con cómo funciona TanStack Start.
- No hay nada escrito a mano que ya den Zod, Zustand o shadcn.
- Ningún revisor pide recuperar persistencia, reintentos automáticos ni concurrencia.

## Veredicto

**Listo para implementar después de una pasada de correcciones de texto (I1 a I8).** No hay bloqueantes de diseño. Sin esa pasada, Claude Code tendría que decidir por su cuenta:
- el método HTTP de la Server Function;
- los reintentos ocultos del SDK;
- la traducción de errores del esquema;
- el adaptador de Vercel.

Además, las condiciones de salida de las fases 0, 5, 6 y 7 no se podrían cumplir tal como están escritas.

## Estado

No se ha editado el documento ni se ha escrito código.
