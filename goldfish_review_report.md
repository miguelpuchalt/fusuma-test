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
