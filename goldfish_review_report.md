Status: resolved

# Goldfish Annotated Review Report

**Target:** `docs/designs/emergency_triage.md` (FeatureRange 1-804, con los cambios que arrastra al DetailedRange)

**Origen:** `critic_report.md` (etapa 7, ronda 1). **Instrucción del autor:** resolver K1 a K15 y los hallazgos menores aplicables; K3 con la opción (a) y sin segunda llamada a la IA; K4 con una conversión determinista a `create`, sin vaciar el tablero; mantener el SSR y las categorías dinámicas; rebatir R1 y aceptar R2.

## Prioritized Findings & AI Suggestions

### [K1] [`egm-design`] - Severity: Major
*   **Affected Scope:** §8 Cola secuencial, CUJ 9
*   **Discrepancy Description:** tras «Reiniciar» y una ráfaga nueva durante una llamada en curso, el `drain()` antiguo sale y los avisos nuevos quedan `queued` para siempre.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** el defecto es real y aparece en una secuencia típica de demo.
*   ***Proposed Edit:*** reescribir el pseudocódigo. Ante un `runId` distinto, la cola descarta la respuesta y **continúa** con la cola nueva. Se documenta por qué no se puede perder un aviso entre la comprobación del bucle y `running ← false`. La cola pasa a construirse con dependencias inyectadas y se añade el test nuevo `src/queue/triage-queue.test.ts` (archivo 63). CUJ 9 y la fase 5 se amplían.

### [K2] [`egm-design`] - Severity: Major
*   **Affected Scope:** §8, §10, archivos 35 y 43
*   **Discrepancy Description:** el pseudocódigo no trata `unauthorized`; no se dice cuándo se abre el diálogo ni en qué estado queda el aviso.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** coincide con C2 y Z-N7. Con el diseño actual, una contraseña errónea consume S1.
*   ***Proposed Edit:***
    *   En modo IA sin contraseña, la cola se pausa **antes** de llamar y el aviso sigue `queued`.
    *   Ante `unauthorized`, la nueva acción de dominio `returnToQueue` devuelve el aviso a `queued` conservando su posición, se borra la contraseña y la cola se pausa.
    *   `unauthorized` deja de ser un error de aviso: el tipo `ReportErrorKind` lo excluye.
    *   Se añaden el CUJ 10 y tests de la cola.

### [K3] [`egm-design`] - Severity: Major
*   **Affected Scope:** §3, §4 paso de saneado, §6 `applyDecision`
*   **Discrepancy Description:** cuando un `join` se convierte en `create`, el incidente nuevo hereda un resumen y una gravedad escritos para otro incidente.
*   ***AI Suggestion:*** PROPOSE FIX (opción (a), sin segunda llamada)
*   ***Justification:*** la única forma de reconstruir el resumen y la gravedad del aviso individual sin volver a llamar a la IA es que la IA los devuelva siempre.
*   ***Proposed Edit:***
    *   Añadir al esquema `reportSummary` (≤ 200) y `reportSeverity`, que describen solo el aviso nuevo según la rúbrica.
    *   Nueva función pura `convertJoinToCreate`, compartida por el saneado y `applyDecision`: usa `reportSummary` y `reportSeverity`, conserva la categoría y el protocolo, y sustituye el motivo por uno que explica la reasignación.
    *   Las respuestas pregrabadas incluyen los dos campos. Hay tests nuevos en los archivos 52, 56 y 57.

### [K4] [`egm-design`] - Severity: Major
*   **Affected Scope:** §5 `FallbackEngine`, Goal 1
*   **Discrepancy Description:** si un aviso ancla se reintenta después de otro de su grupo, el resultado no está definido.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** el modo sin API es la red de seguridad de la demo y no puede tener casos sin definir.
*   ***Proposed Edit:***
    *   Un ancla de destino sin incidente convierte la respuesta en `create` con `convertJoinToCreate`; un ancla de relación sin incidente deja la relación en `null`. Nunca hay error. El tablero no se vacía al recargar.
    *   El Goal 1 pasa a decir «el mismo resultado para el mismo orden de procesamiento».
    *   El archivo 58 añade el caso «S1 interrumpido y reintentado después de S2».

### [K5] [`egm-structural`, `egm-design`] - Severity: Major
*   **Affected Scope:** documento completo
*   **Discrepancy Description:** falta la sección de riesgos y mitigaciones que exige el estándar.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** el estándar la exige.
*   ***Proposed Edit:*** nueva H2 «Riesgos y mitigaciones», con 12 riesgos (R1 a R12), su impacto, mitigación y riesgo residual. Incluye el orden de recorte si falta tiempo.

### [K6] [`egm-design`] - Severity: Major
*   **Affected Scope:** Goal 1, CUJ 1, fase 4
*   **Discrepancy Description:** la coherencia de la IA en directo se da por supuesta.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** coincide con Z8.
*   ***Proposed Edit:***
    *   Al menos 5 ejecuciones seguidas de `check-burst` antes de la entrevista, anotando el resultado.
    *   Versión exacta del modelo fijada en `TRIAGE_MODEL`.
    *   La fase 4 queda limitada a 1,5 h más un máximo de 1 h del margen, con una salida definida: cambiar al otro modelo candidato y, si tampoco converge, usar el modo sin API para la ráfaga en la entrevista.
    *   Plan para cuando el resultado diverge en directo (riesgo R1).

### [K7] [`egm-design`] - Severity: Major
*   **Affected Scope:** §4, §10, archivos 29 y 30
*   **Discrepancy Description:** la contraseña se puede probar sin límite.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** el defecto es real en una URL pública.
*   ***Proposed Edit:***
    *   El límite de peticiones pasa a ser el paso 1, antes de la contraseña, y cuenta también los intentos fallidos.
    *   Retardo de 1 s tras un fallo.
    *   `DEMO_PASSWORD` de al menos 12 caracteres; si es más corta, la función rechaza todas las peticiones.
    *   Cambiar la contraseña tras la entrevista.

### [K8] [`egm-design`] - Severity: Major
*   **Affected Scope:** §4, archivos 27 y 28
*   **Discrepancy Description:** el timeout de 15 s no está relacionado con la duración máxima de la función en Vercel.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** sin esa relación, un corte de Vercel se clasificaría mal.
*   ***Proposed Edit:*** `maxDuration` de 30 s fijado explícitamente (se comprueba el día 1 en Hobby); el timeout de la IA queda siempre al menos 10 s por debajo. Riesgo R9.

### [K9] [`egm-style`, `egm-design`] - Severity: Major
*   **Affected Scope:** The Problem, Goal 2, §1
*   **Discrepancy Description:** «la IA no inventa ubicaciones» y «la IA nunca inventa referencias» prometen más de lo que comprueba el código.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** el resumen y el motivo son texto libre que no se verifica.
*   ***Proposed Edit:***
    *   Las garantías se reescriben como lo que impone el código: ninguna referencia inventada llega al estado, y las ubicaciones del protocolo salen solo de los datos maestros.
    *   El texto libre se etiqueta en la tarjeta como «Texto generado por IA».
    *   Riesgo R5.

### [K10] [`egm-style`] - Severity: Major
*   **Affected Scope:** Goal 6, §10, Alternativa M
*   **Discrepancy Description:** el crédito gratuito aparece como un hecho en un sitio y como pendiente en otro.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** «pendiente de verificar el día 1» en todas las menciones; el modo sin API figura como garantía de coste. Riesgo R2.

### [K11] [`egm-style`, `egm-design`] - Severity: Major
*   **Affected Scope:** §3, §4, NFR
*   **Discrepancy Description:** varios límites se describen como «acotados» sin valor.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** 128 KB por petición, 800 tokens de salida y 40 caracteres para `newCategoryName`. Estimación aproximada de tokens en NFR.

### [K12] [`egm-style`] - Severity: Major
*   **Affected Scope:** Goal 2, invariantes, §4
*   **Discrepancy Description:** los tests se describen en presente, como si ya existieran.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** «debe tener».

### [K13] [`egm-style`] - Severity: Major
*   **Affected Scope:** §3, Alternativa H
*   **Discrepancy Description:** «algunos proveedores no admiten» y «fallaría siempre», sin respaldo.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** formulación condicional, con comprobación el día 1 en los dos modelos candidatos.

### [K14] [`egm-structural`] - Severity: Major
*   **Affected Scope:** Goals (invariantes, política, alias)
*   **Discrepancy Description:** hay diseño técnico dentro de Goals.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** mover estos apartados a la nueva sección del Technical Plan «Reglas del dominio y contrato de referencias». En Goals se queda el guion como criterio de aceptación.

### [K15] [`egm-style`, `egm-structural`, `egm-design`] - Severity: Major
*   **Affected Scope:** varias secciones
*   **Discrepancy Description:** contradicciones internas sobre el número de partes del prompt, el estado del guion, el estado de «Separar aviso» y la línea que remite a una versión anterior.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** «siete partes»; el guion queda como fijado en el archivo 12; «Separar aviso» queda solo en Future Improvements; la línea sustituida por el flujo de un aviso.

### [R1] [`egm-structural`, `egm-design`] - Severity: Major/Nit
*   **Discrepancy Description:** «Rejected by author» incumpliría el estándar.
*   ***AI Suggestion:*** CONTEST
*   ***Justification:*** la plantilla EGM (`skills/egm-draft/references/design_doc.md`) indica literalmente «Rejected by author: technical rationale». La prohibición se refiere a atribuir rechazos a un **mantenedor** sin enlace. Solo se quita «(propuesto en la revisión Goldfish)» de H, que es jerga del proceso (E-N2).

### [R2] [`egm-design`] - Severity: Major
*   **Discrepancy Description:** falta la alternativa SSR frente a SPA.
*   ***AI Suggestion:*** PROPOSE FIX (aceptado por el autor)
*   ***Proposed Edit:* El Overview dice que el stack, incluido el SSR, lo fija el enunciado. Se añade la Alternativa U «SPA sin SSR», rechazada por ese requisito, y el riesgo de calendario de la hidratación (R8).

### Hallazgos menores

| # | Sugerencia | Cambio |
|---|---|---|
| n1 | PROPOSE FIX | El pseudocódigo nuevo usa la firma completa de `applyDecision`. La cola la llama fuera de `set` y guarda `state` (también resuelve Z-N5). |
| n2 | PROPOSE FIX | `rationale` se actualiza siempre (C10). |
| n3 | PROPOSE FIX | `newCategoryName` admite como máximo 40 caracteres. Con la categoría bloqueada no se crea ninguna categoría. |
| n4 | PROPOSE FIX (variante) | `approveCategory` se separa de las acciones sobre incidentes. «Aprobar categoría» aparece en cualquier columna: aprobar cambia el catálogo, no el incidente, y una categoría usada solo por incidentes validados no podría aprobarse nunca. La invariante 5 lo aclara. |
| n5 | PROPOSE FIX | `schemaVersion` = `version` de `persist`. |
| n6 | PROPOSE FIX | Nuevo error `invalid_input`, sin reintento (Z-N6). |
| n7 | PROPOSE FIX | Status «In Review». |
| n8 | PROPOSE FIX | La introducción de las alternativas explica el orden y las letras N a U. |
| n9 | PROPOSE FIX / CONTEST | Future Improvements pasa a ser una H2; se quita «### El problema», que repetía el encabezado. Se mantiene «La solución propuesta» dentro de The Problem, porque la plantilla dice «Summarize the problem and the proposed solution here». |
| n10 | CONTEST | Open Questions va antes de los CUJ en la plantilla EGM. |
| n11 | PROPOSE FIX | Las etiquetas en negrita de §3 pasan a H5. |
| n12 | DECLINE (en parte) | No se unifican `*` y `-` en todo el documento: es un cambio grande sin efecto en la lectura. Sí se numeran desde 1 los pasos de la Server Function. |
| n13 | PROPOSE FIX | Enlace relativo a `concepts_brief.md`. |
| n14 | PROPOSE FIX (en parte) | Menos repeticiones de «validar no ejecuta», «decisión de diseño» y M8. |
| n15 | PROPOSE FIX | Lenguaje coloquial o subjetivo reescrito. |
| n16 | PROPOSE FIX | Afirmaciones sin respaldo matizadas. |
| n17 | PROPOSE FIX | «2 días, unas 24 horas de trabajo». |
| n18 | PROPOSE FIX | Estimación aproximada de tokens en NFR. |

### Hallazgos de las etapas 5 y 6 resueltos en esta pasada (porque coinciden con K o n)

C1 (modelos candidatos), C2 (= K2), C3 y C4 (referencias del brief explicadas y nota sobre términos), C5 (= Z7, línea del flujo), C6, C7 (reinicio del catálogo), C8, C9 (orden de relleno), C10, C11 (etiqueta `INC-n`), C12 (insignia del motor), C13 (tablero vacío = sin avisos), C14, C15 (archivo 61), C16, Z6 (se elimina «sin impacto en el código»; categorías dinámicas confirmadas), Z7, Z8 (= K6), Z-N5, Z-N6, Z-N7 (= K2), Z-N9 y la redacción de Z1 (la elegibilidad no es una frontera de seguridad).

### Decisiones del autor tras la resolución (segunda pasada)

- **Z3, aceptado:** ante un 429 la cola se pausa y reintenta el mismo aviso tras `clamp(Retry-After ?? 3 s, 1 s, 10 s)`, con dos esperas como máximo.
- **Z4, aceptado con alcance limitado:** si en una ráfaga persiste un fallo transitorio (`rate_limit`, `timeout`, `server`, `network`), ese aviso y el resto de la ráfaga pasan a `FallbackEngine`, sin más llamadas al proveedor. No se aplica a los avisos manuales ni a los errores de validación.
- **Procedencia:** insignia de motor por aviso y `incidentEngine` con los valores `llm`, `fallback` y `mixed`.
- **Z1:** se mantiene la elegibilidad compartida; el texto explicita que no es una frontera de seguridad y que manda `applyDecision`.
- **Z5:** `detachReport` sigue en Future Improvements (R4).
- **Añadidos para cumplirlo:**
  - `burstId` en `Report`, porque las anclas se buscan dentro de la misma ráfaga;
  - `retryAfterMs` en `TriageResult`;
  - `queuePause` con el motivo `rate_limit`;
  - `burstFallback`;
  - archivos 64 y 65 (`parseRetryAfter`);
  - `TRIAGE_FORCE_ERROR`, solo fuera de producción, para ensayar los CUJ 7 y 11;
  - CUJ 11, Alternativa W y riesgo R13.
- **Presupuesto:** fase 5 de 2 a 3 h, fase 6 de 5,5 a 5 h y margen de 1,5 a 1 h. El total sigue en 24 h, pero con menos margen (R11).

### Estado inicial, antes de la segunda pasada (histórico)

- **Z1 (estructura):** la elegibilidad sigue aplicándose en el saneado y en `applyDecision`. Se reduce el riesgo de que diverjan: las dos rutas usan las mismas funciones (`canJoin`, `canRelate`, `convertJoinToCreate`). Se corrige la redacción, pero no se elimina la comprobación del servidor.
- **Z2:** el SSR se mantiene por requisito (R2). El coste queda como riesgo R8.
- **Z3 (pausar la cola ante un 429)** y **Z4 (respaldo automático por aviso con respuestas pregrabadas):** no se adoptan en esta pasada. Quedan como riesgos R3 y R1 con su mitigación actual y como Future Improvements.
- **Z5 (`detachReport`):** queda en Future Improvements; riesgo R4.
- **Z-N1, Z-N2, Z-N3, Z-N4, Z-N8:** se mantienen. El orden de recorte por calendario (R11) incluye el indicador de avisos nuevos y el recorte priorizado del contexto.

## Resultado

- Correcciones aplicadas: 15 importantes y 16 menores.
- Rebatidos: 2 (R1, n10).
- Rechazados: 1 (n12, en parte).
- Escalados: 0.

## Resolución de las etapas 8 y 9 (pasada final)

**Fuentes:**
- `intermediate_zoom_out_report.md` (etapa 8);
- `implementation_readiness_report.md` (etapa 9).

**Alcance:** I1 a I8 y los defectos reales menores m1 a m4. Solo se ha editado `docs/designs/emergency_triage.md`. No se ha escrito código ni se ha inicializado el proyecto.

**Decisión del autor que modifica I1:** el coste es 0 €.
- No se compran créditos, no se contrata ningún plan y no se usa BYOK.
- Si no hay un modelo elegible que funcione sin coste, se registra el resultado y la demo usa el modo sin API.

| Hallazgo | Cambio en el diseño | Dónde |
|---|---|---|
| I1 | Nueva subsección «Fase 0 en detalle»: <ul><li>saldo gratuito y modelos elegibles;</li><li>prueba de un modelo elegible con salida estructurada;</li><li>registro del ID, la respuesta y el coste;</li><li>`curl` para comprobar el SSR;</li><li>variables de entorno en Vercel;</li><li>botón temporal con `AiDecisionSchema` real;</li><li>sin modelo sin coste, modo sin API y ningún pago.</li></ul> La fase 0 pasa de 2 a 2,25 h y la fase 2, de 3 a 2,75 h. Se actualizan R2, la Alternativa L, el Goal 6 y el Goal 1. | Detailed Implementation Plan; Goals; Alternatives; Risks |
| I2 | Nueva subsección «Decisiones de API fijadas»: <ul><li>POST;</li><li>`safeParse` dentro de la función;</li><li>`maxRetries: 0`;</li><li>`AbortSignal.timeout(15_000)`;</li><li>esquema sin límites de longitud;</li><li>orden de clasificación de errores;</li><li>SHA-256 con `timingSafeEqual`;</li><li>versiones exactas.</li></ul> Los nombres que dependen de la versión se toman de la versión instalada y se anotan en la tabla «Registro de la fase 0». | §5 pasos 2, 3, 5, 6 y 8; archivos 17 y 18 |
| I3 | Despliegue según la guía oficial de TanStack Start para Vercel con Nitro; se comprueba en el panel de Vercel que `maxDuration` es de 30 s; la carpeta de salida queda registrada y la usa la verificación 3. | Fase 0; archivo 1; Verification Plan |
| I4 | `.gitignore` y `README.md` pasan a **Modify**; la plantilla se genera en una carpeta temporal. | Archivos 4 y 36; fase 0 |
| I5 | Un único «criterio de coincidencia»; la fase 6 solo toca `prompt.ts` y sube `PROMPT_VERSION`; 1 minuto entre ráfagas; si no se consigue, se anota en el README. | Archivo 9; fase 6; CUJ 1; Verification Plan |
| I6 | Las respuestas pregrabadas usan el valor principal, con la gravedad y el protocolo explícitos para S1 a S9. | Archivo 8 |
| I7 | Columna «Archivos» en la tabla de fases; las salidas de las fases 1 a 4 nombran sus tests. | Tabla de fases |
| I8 (M1) | 1 minuto entre ráfagas reales. | R3; fase 6; limitaciones; verificación 2 |
| I8 (M2) | Tabla «CUJ por modo» con la columna de URL pública; el CUJ 7 se cubre con el test 35 y una ejecución local con un `TRIAGE_MODEL` no válido. | Verification Plan; fases 5 y 7 |
| I8 (M3) | R2 dice qué cubre el modo sin API y qué no (avisos manuales y análisis con IA). | R2; limitaciones; fase 0 |
| I8 (M4) | El diálogo de contraseña no se puede cerrar; para salir, se recarga la página. | CUJ 9; §8; limitaciones |
| I8 (N1) | `createInitialState(mode)`; el reinicio conserva el modo y `demoPassword` y cierra el diálogo. | §7; archivo 21 |
| I8 (N2) | `drain()` convierte cualquier excepción de una vuelta en `markError(report, "server")`. | §8; test 35 |
| m1 | Archivos 37 (`src/lib/utils.ts`), 38 (`src/routeTree.gen.ts`) y 39 (`vitest.config.ts`, solo si hace falta); `input` en el archivo 30. | Lista de archivos |
| m2 | `triage-store.ts` exporta `triageQueue`, `setMode`, `resetDemo` y `setPassword`. | Archivo 21 |
| m3 | Tests nuevos: <ul><li>aviso que no existe o que no está en `processing`;</li><li>`join` a un `pending` de otra planta;</li><li>`retry` al final;</li><li>excepción en `propose`.</li></ul> Además, la firma `createFallbackEngine(getState, sleep)`. | Archivos 20, 31 y 35 |
| m4 | Alias `@/*` en `tsconfig.json` y `components.json`. | Archivos 1 y 2 |
| N3 (de paso) | El comentario de `seq` ya dice que «Reintentar» asigna uno nuevo. | §2 |

**Comprobaciones finales:**
- **Horas:** las fases suman 24 h (2,25 + 4 + 2,75 + 1,5 + 1,5 + 6 + 1,5 + 2 + 2,5).
- **Archivos:** los 39 tienen una fase asignada:
  - 16 también en la fase 6;
  - 15, 17, 18 y 24 tienen además una versión provisional en la fase 0.
- **Condiciones de salida:** todas se pueden cumplir también sin un modelo sin coste. En ese caso, la fase 2 exige solo el test 33, la fase 6 no se hace y la tabla «CUJ por modo» limita el recorrido.
- **Sin restos de lo anterior:** no quedan «toda la demo», «versión exacta» del modelo, «CUJ 1 a 9 en ambos modos» ni `.output/public`.

**Sin cambios:**
- N4 (`burstProgress`) y N5 (`createdCategory`), por ser mejoras opcionales;
- los menores de estilo m5 a m16 del informe de la etapa 9.

No se reincorporan persistencia, reintentos automáticos, recuperación avanzada, BYOK ni funcionalidades nuevas.

**Estado:** el diseño queda cerrado. Siguiente paso: pedir autorización para implementar la fase 0.

## Cambio de proveedor de IA y fase 1

**Decisión definitiva del autor:** se deja de usar Vercel AI Gateway. La IA se llama directamente a la Gemini Developer API con el proveedor oficial `@ai-sdk/google` del AI SDK. Es una **desviación deliberada del enunciado** y queda documentada como tal.

**Motivo:** en la fase 0, AI Gateway devolvió un 403 en sus 5 modelos de precio 0, porque exige una tarjeta de crédito registrada para desbloquear los créditos gratuitos. El objetivo de coste es 0 € sin tarjeta, sin planes y sin pagos.

**Qué se mantiene:** React, TypeScript, TanStack Start con SSR, shadcn/ui, Vercel AI SDK y despliegue en Vercel. El resto del alcance del MVP no cambia.

| Cambio en `docs/designs/emergency_triage.md` | Dónde |
|---|---|
| Nueva sección «Desviación del enunciado: sin AI Gateway», con motivo, decisión, qué se mantiene, qué cambia, coste de volver atrás y configuración prevista para la fase 2 | Overview |
| Stack y requisito 1 de los obligatorios: AI Gateway queda fuera por decisión del autor | Overview; Goals |
| Goal 6: nivel gratuito de la Gemini Developer API, `GOOGLE_GENERATIVE_AI_API_KEY` solo en el servidor, sin facturación, planes ni pagos | Goals |
| Non-Goal nuevo: sin AI Gateway | Non-Goals |
| Diagrama y resumen: el servidor llama a la Gemini Developer API con `@ai-sdk/google` | Technical Plan |
| Alternativa L reescrita: «Vercel AI Gateway (lo que pide el enunciado)», rechazada por el autor | Alternatives |
| R2 reescrito para el nivel gratuito de Gemini (disponibilidad y cuota); R9 nuevo para la desviación; Seguridad con la nueva variable | Risks; NFR |
| Future Improvements: migrar al Gateway cuando haya créditos | Future Improvements |
| Fase 0: nota «Resultado y cambio de proveedor». La llamada real a la IA pasa a la fase 2. La fase 2 incluye instalar `@ai-sdk/google`, configurar la clave y comprobar la disponibilidad y la cuota. | Detailed Implementation Plan |
| Registro de la fase 0: las filas del Gateway quedan como histórico y `TRIAGE_MODEL` pasa a «se fija en la fase 2» | Registro de la fase 0 |
| Archivo 3 (`.env.example`) y verificación 3: `GOOGLE_GENERATIVE_AI_API_KEY` en lugar de `AI_GATEWAY_API_KEY`. El archivo se actualizará en la fase 2. | Lista de archivos; Verification Plan |
| Decisiones de API fijadas: nuevo apartado «Proveedor» | Detailed Implementation Plan |

**No se ha hecho, por orden expresa:**
- no se ha instalado `@ai-sdk/google`;
- no se ha tocado la integración temporal de la fase 0;
- no se ha configurado ninguna variable de entorno nueva;
- `.env.example` y las variables de Vercel siguen con los valores de la fase 0 (la variable `TRIAGE_MODEL` de Vercel tiene un ID de AI Gateway que ya no sirve).

**Fase 1 (dominio), implementada:**
- **Archivos:** 5, 6, 7 (datos maestros), 10 a 14 (`types`, `rules`, `apply-decision`, `actions`, `selectors`) y tests 31 y 32. También el 39 (`vitest.config.ts`).
- **Resultado:** 59 tests en verde, `typecheck` y `build` sin errores. Se comprobó con dos mutaciones que los tests detectan fallos en `canRelate` y en la regla de la gravedad.
- **Decisiones de implementación que el diseño dejaba abiertas:**
  - `createReport(state, input)` devuelve `{ state, report }` y solo asigna `seq`; `enqueueReports(state, reports, burst)` inserta los avisos y fija `burstStartSeq`.
  - `applyDecision` lanza un error si la categoría existente o el protocolo no existen. El servidor lo impide con `invalid_ref`, y la cola lo convertiría en un error `server` del aviso.
  - `editIncident` rechaza sin cambiar nada una categoría no visible o un protocolo desconocido.
  - `retryReport` no reintenta `invalid_input`.
  - `src/domain/` solo importa constantes de `src/data/`; la tabla de estructura del diseño lo dice así.

## Fase 2 (IA y servidor): estado

**Hecho** (100 tests en verde, `typecheck` y `build` sin errores):
- **Archivos:** 9 (`src/data/burst-script.ts`), 15 (`src/ai/contract.ts`), 16 (`src/ai/prompt.ts`), 17 (`src/server/llm-client.ts`, con `@ai-sdk/google`), 18 (`src/server/triage-report.ts`, pasos 1 a 9) y el test 33 (`src/ai/contract.test.ts`).
- **Actualizados:** `.env.example` (con `GOOGLE_GENERATIVE_AI_API_KEY`) y el botón temporal de `src/routes/index.tsx`, que ahora envía el contexto completo de S1 y muestra la decisión traducida a IDs reales.
- **Dependencia:** `@ai-sdk/google` 4.0.122, versión exacta y compatible con `ai` 7.0.176 (comparten `@ai-sdk/provider` 4.0.39).
- **Verificado con el SDK real y un modelo simulado:** un `abortSignal` vencido llega como `TimeoutError` (→ `timeout`) y una salida que no cumple el esquema como `NoObjectGeneratedError` (→ `invalid_output`). Ya están como tests.

**Pendiente, por falta de una clave de Google:**
- la llamada real a Gemini con S1;
- la elección del modelo según su disponibilidad y su cuota en el nivel gratuito;
- si el esquema con campos `null` lo admite el modelo elegido;
- configurar `GOOGLE_GENERATIVE_AI_API_KEY` y `TRIAGE_MODEL` en Vercel y desplegar.

Hasta entonces, la condición de salida de la fase 2 se cumple en la parte del test 33 y queda sin cumplir en la llamada real. No se ha configurado ninguna variable ni se ha desplegado nada.

**Decisiones de implementación que el diseño dejaba abiertas:**
- La petición del cliente es el `TriageInput` completo más la contraseña; el servidor la valida con Zod (`parseTriageRequest`, en `contract.ts` para poder testearla).
- La contraseña se lee de la petición sin validar antes del paso 2, de modo que una contraseña incorrecta siempre da `unauthorized` aunque el resto de la entrada sea inválida.
- `GOOGLE_GENERATIVE_AI_API_KEY` o `TRIAGE_MODEL` ausentes dan `server` (error de configuración), no `unauthorized`.
- El test de clasificación de errores y los del prompt están dentro de `contract.test.ts`, sin crear archivos de test nuevos.
