# EmergencyTriage

*   **Author:** JackElSimple
*   **Status:** In Review
*   **Date:** 2026-11-18

--------------------------------------------------------------------------------

## Overview

EmergencyTriage es un prototipo de consola de operaciones para incidentes en edificios. Recibe avisos de texto libre, usa una IA para proponer cómo agruparlos en incidentes y deja que una persona responsable de seguridad valide o descarte cada incidente.

Es la entrega de una prueba técnica de un proceso de selección: 2 días, unas 24 horas de trabajo. Trabaja solo con datos ficticios y **no es un sistema real de gestión de emergencias**. Se presenta en directo en una entrevista técnica.

**Criterio de diseño.** La prioridad es un recorrido completo, desplegado y demostrable de principio a fin. Se prefiere una aplicación pequeña con limitaciones conocidas y documentadas antes que mecanismos que no lleguen a implementarse. Cada funcionalidad tiene que justificar su coste frente a lo que aporta a la demo.

El stack lo fija el enunciado: React, TypeScript, **TanStack Start con SSR**, shadcn/ui, Vercel AI SDK y Vercel AI Gateway, con despliegue en Vercel (plan Hobby). El objetivo de coste es 0 €. El código vive en este repositorio (`fusuma-test`).

### Relación con documentos anteriores

[`concepts_brief.md`](../../concepts_brief.md) y `design_draft.md` son históricos. **Este documento es la especificación vigente.** Cambios principales respecto al brief:

| Decisión vigente | Qué cambia |
|---|---|
| La IA recibe todos los incidentes del edificio con los textos completos de sus avisos. | Sustituye a la recomendación del brief de enviar solo un resumen compacto. |
| El estado vive **solo en memoria** del navegador. Una recarga empieza de cero. | Sustituye a la persistencia en `localStorage` del brief (no era requisito del enunciado). |
| Ante un error de la IA, el aviso queda en error con «Reintentar» manual. Sin reintentos automáticos. | Sustituye a la pausa corta con un reintento fijo del brief. |
| Mientras la cola procesa, no se puede reiniciar, cambiar de modo ni actuar sobre incidentes. | Nueva: evita gestionar cambios concurrentes del tablero. |
| La respuesta de la IA no tiene campo `confidence`. | Sustituye al esquema inicial del brief. |
| Se agrupa solo en el mismo edificio y la misma planta; otras plantas se relacionan. | Concreta la regla del brief. |
| Contraseña de demo compartida, validada en el servidor. | El brief la dejaba como opcional. |

## The Problem

Cuando pasa algo en un edificio, varios ocupantes avisan casi a la vez, y cada uno lo describe a su manera:

- «Huele a humo en la segunda planta».
- «Hay una especie de niebla gris en la planta 2».
- «Se percibe olor a quemado cerca de las escaleras».

La persona responsable de seguridad tiene que leerlo todo y deducir cuántos incidentes reales hay, dónde están, qué gravedad tienen y qué protocolo aplicar. Con una ráfaga de avisos mezclados entre edificios y plantas aparecen tres riesgos: tratar un incidente como si fueran varios, mezclar incidentes distintos y tardar demasiado en decidir.

### La solución propuesta

EmergencyTriage procesa los avisos de uno en uno. Para cada aviso, una IA **propone**:
- si pertenece a un incidente pendiente del mismo edificio y planta, o si abre uno nuevo;
- una categoría (existente o, como último recurso, una nueva no oficial);
- una gravedad (Baja, Media, Alta o Crítica);
- uno de 5 protocolos predefinidos;
- un resumen y una frase con el motivo.

La persona responsable ve en una sola pantalla los avisos y las tarjetas de incidente. Puede corregir cualquier campo de un incidente pendiente y después **validarlo** (aprueba la propuesta de protocolo; en la demo no se ejecuta nada) o **descartarlo** (por ejemplo, una falsa alarma). Un incidente validado o descartado ya no cambia.

La IA no decide, solo propone. El código garantiza que **ninguna referencia inventada** (incidente, categoría o protocolo) llega al estado, y que las ubicaciones, rutas y puntos de reunión **del bloque de protocolo** de la tarjeta salen solo de los datos maestros. El resumen y el motivo son texto libre de la IA, no se verifican y se muestran como «Texto generado por IA».

### A quién sirve

- **Usuario del producto:** la persona responsable de seguridad que mira el tablero. En la demo, una misma persona hace también de ocupante desde el formulario lateral.
- **Público de la demo:** el equipo evaluador de la prueba técnica.

## Goals

### Requisitos obligatorios (enunciado)

1. Stack: React, TypeScript, TanStack Start con SSR, shadcn/ui, AI SDK, AI Gateway y despliegue en Vercel con una URL pública.
2. Recepción manual de avisos (edificio, planta, texto) y simulación de una ráfaga de avisos ficticios.
3. Análisis con IA: clasificación, gravedad, agrupación semántica, resumen y protocolo recomendado.
4. Categorías nuevas propuestas por la IA con aprobación humana.
5. Tablero de incidentes con intervención humana: corregir, validar o descartar.
6. Botón para reiniciar la demo.

### Funcionalidades esenciales del MVP

1. **Recorrido de la ráfaga.** «Simular ráfaga» encola 9 avisos del guion, que se procesan de uno en uno y terminan en las agrupaciones de la tabla «Guion de la ráfaga». Antes de la entrevista se comprueba a mano con la IA real y con el modo sin API. No es una evaluación estadística del modelo.
2. **Ninguna referencia inventada llega al estado.** Los alias que la IA no recibió se descartan o producen un error; un incidente no elegible nunca recibe el aviso.
3. **La persona tiene la última palabra.** Un campo editado a mano queda bloqueado frente a la IA; la IA nunca baja la gravedad de un incidente; solo una persona valida o descarta.
4. **Modo sin API determinista.** Seleccionable con el tablero vacío; reproduce la ráfaga con 9 respuestas pregrabadas y siempre da el mismo resultado.
5. **Errores visibles y recuperables a mano.** Un error de la IA deja el aviso marcado con su tipo y un botón «Reintentar»; la cola sigue con el siguiente.
6. **Coste 0 € y claves protegidas.** El crédito gratuito de AI Gateway (pendiente de verificar el día 1) y Vercel Hobby. La clave del Gateway solo existe en el servidor; las llamadas a la IA exigen una contraseña de demo.
7. **Arquitectura explicable.** Reglas de negocio en funciones de TypeScript puro con tests; el motor de IA y el modo sin API implementan la misma interfaz; README con diagramas.

### Guion de la ráfaga: agrupaciones esperadas

9 avisos que deben terminar en **5 incidentes**. Los textos, la rúbrica de gravedad y los resultados detallados están en el archivo 9 del Detailed Implementation Plan.

| Grupo | Edificio y planta | Avisos | Caso que demuestra |
|---|---|---|---|
| A: humo | Torre Central, planta 2 | S1, S2, S4, S7 | Textos distintos se agrupan; la gravedad sube. |
| B: humo en la escalera | Torre Central, planta 3 | S6 | Mismo fenómeno en otra planta: incidente nuevo **relacionado** con A. |
| C: persona desmayada | Torre Central, planta 2 | S8 | Misma planta que A pero otro suceso: incidente nuevo **sin** relación. |
| D: fallo eléctrico | Edificio Anexo A, planta 0 | S3, S5 | Agrupación en otro edificio, intercalada con A. |
| E: agua cayendo del techo | Laboratorios, planta -1 | S9 | Ninguna categoría encaja: la IA crea una categoría no oficial. |

### Mejoras opcionales (solo si sobra margen, en este orden)

1. Indicador «N avisos nuevos desde tu edición» en el resumen bloqueado.
2. Script `check-burst` que ejecuta la ráfaga contra el modelo real en Node y compara con la tabla.
3. Persistencia en `localStorage` (sin SSR del tablero).
4. Toast al crear una categoría nueva (la insignia «No oficial» ya es esencial).

## Non-Goals

- **No es un sistema de emergencias real.** No ejecuta protocolos ni envía notificaciones.
- **Sin recuperación automática:** ni reintentos automáticos, ni pausa por 429, ni cambio automático al modo sin API, ni respaldo por aviso.
- **Sin persistencia:** el estado vive en memoria; una recarga empieza de cero.
- **Sin acciones concurrentes:** mientras la cola procesa no se puede reiniciar, cambiar de modo, editar, validar, descartar ni aprobar categorías.
- **Sin fusión manual ni «Separar aviso».** Una agrupación errónea se corrige descartando el incidente.
- **Sin agrupación entre plantas** ni incidentes con varias plantas.
- **Sin estado `Resuelto`.** `Validado` significa «propuesta aprobada».
- **Sin creación ni borrado de categorías a mano.** «Cambiar categoría» elige entre las existentes.
- **Sin base de datos, varios usuarios, cuentas, vista móvil, audio, event sourcing ni arrastrar tarjetas.**

## Open Questions

Ninguna que bloquee el MVP. La pregunta de producción (dónde serializar el procesamiento con varios operadores) está en Future Improvements.

## Critical User Journeys (CUJs)

### CUJ 1: La ráfaga se consolida en directo

*   **Given**: tablero vacío, modo IA, contraseña de demo introducida.
*   **When**: el operador pulsa «Simular ráfaga».
*   **Then**:
    *   los 9 avisos entran en el feed como «En cola» y se procesan de uno en uno («Procesando», «Asignado a INC-n»);
    *   las tarjetas se crean o se actualizan después de cada aviso;
    *   mientras la cola procesa, «Reiniciar», el cambio de modo y las acciones de las tarjetas están desactivados;
    *   el tablero termina con los incidentes del guion, todos en `Pendiente`.

### CUJ 2: Un aviso manual se agrupa

*   **Given**: un incidente `Pendiente` de humo en Torre Central, planta 2.
*   **When**: el operador envía «Olor a quemado junto a la escalera» para Torre Central, planta 2.
*   **Then**:
    *   el aviso queda asignado a ese incidente;
    *   el contador sube, el resumen se actualiza si no está bloqueado y la gravedad se mantiene o sube.

### CUJ 3: Un aviso de otra planta se relaciona

*   **Given**: un incidente `Pendiente` de humo en Torre Central, planta 2.
*   **When**: llega «Hay humo saliendo del hueco de la escalera» para la planta 3.
*   **Then**:
    *   se crea un incidente nuevo en la planta 3;
    *   su tarjeta muestra «Relacionado con INC-n».

### CUJ 4: El operador corrige y valida

*   **Given**: un incidente `Pendiente`, cola parada.
*   **When**: el operador cambia el protocolo y pulsa «Validar».
*   **Then**:
    *   el protocolo queda bloqueado al editarlo;
    *   la tarjeta pasa a `Validado`, muestra «Protocolo aprobado (no ejecutado: demo)» y ya no se puede editar;
    *   un aviso posterior sobre el mismo hecho crea un incidente nuevo relacionado con este.

### CUJ 5: El operador descarta una falsa alarma

*   **Given**: un incidente `Pendiente`, cola parada.
*   **When**: el operador pulsa «Descartar».
*   **Then**:
    *   la tarjeta pasa a `Descartado` y queda inmutable.

### CUJ 6: La IA crea una categoría y el operador la aprueba

*   **Given**: llega un aviso que no encaja en ninguna categoría.
*   **When**: la IA crea la categoría no oficial «Fuga de agua» y, con la cola parada, el operador pulsa «Aprobar categoría».
*   **Then**:
    *   la categoría pasa a oficial;
    *   ninguna tarjeta que la use vuelve a mostrar «Aprobar categoría».

### CUJ 7: La IA falla y el operador reintenta

*   **Given**: modo IA; la IA devuelve un error (por ejemplo, 429 o timeout) en un aviso.
*   **When**: la cola recibe el error.
*   **Then**:
    *   el aviso queda como «Error: <tipo>» con «Reintentar» (salvo `invalid_input`, que no se puede reintentar);
    *   la cola sigue con el siguiente aviso;
    *   al pulsar «Reintentar», el aviso vuelve al final de la cola y se procesa con el estado actual.

### CUJ 8: Demo sin API

*   **Given**: tablero vacío y cola parada.
*   **When**: el operador activa «Modo sin API» y pulsa «Simular ráfaga».
*   **Then**:
    *   la ráfaga se procesa con respuestas pregrabadas, sin llamadas a la IA ni contraseña;
    *   el resultado coincide exactamente con la tabla del guion;
    *   la cabecera indica «Modo: Sin API»;
    *   el formulario manual está desactivado, porque solo hay respuestas pregrabadas para los 9 avisos del guion.

### CUJ 9: Contraseña de demo

*   **Given**: modo IA, sin contraseña en esta sesión.
*   **When**: el operador envía un aviso o pulsa «Simular ráfaga».
*   **Then**:
    *   antes de la primera llamada se abre el diálogo de contraseña y los avisos siguen «En cola»;
    *   si el servidor la rechaza, el aviso vuelve a la cola en su misma posición, la cola se detiene y el diálogo se abre con «Contraseña incorrecta»;
    *   con la contraseña correcta, la cola continúa sin haber perdido ningún aviso.

## Technical Plan (Architecture)

### Resumen

Tres partes:

1. **Cliente.** React para la interfaz, un store de Zustand con el estado en memoria y una cola que procesa los avisos de uno en uno.
2. **Servidor.** Una Server Function de TanStack Start, sin estado, que llama a la IA a través de AI Gateway, valida la respuesta y devuelve una decisión con IDs reales o un error tipado.
3. **Dominio.** Tipos y reglas en TypeScript puro, sin React ni AI SDK. Lo usan el cliente, el servidor y los tests.

Flujo de un aviso:
1. La cola toma el primer aviso en cola y construye su contexto con el estado actual.
2. El motor activo devuelve una decisión: en modo IA, a través de la Server Function; en modo sin API, desde las respuestas pregrabadas.
3. La cola aplica la decisión con `applyDecision`, que es **la única comprobación que manda** sobre qué cambia en el estado.

**SSR.** Lo exige el enunciado. El servidor pinta la página completa con el estado inicial (tablero vacío y datos maestros). Como no hay persistencia, el estado inicial es el mismo en el servidor y en el cliente, así que no hay diferencias de hidratación ni hace falta `ClientOnly`. El store nunca se modifica en el servidor: sus acciones solo se ejecutan por interacción del usuario en el navegador.

```mermaid
flowchart LR
  subgraph Cliente
    UI["UI React<br/>panel · feed · tablero"] -->|acciones| Store["Store Zustand<br/>(en memoria)"]
    UI -->|aviso / ráfaga| Queue["Cola secuencial"]
    Queue -->|getState| Store
    Queue --> Engine{"TriageEngine"}
    Engine --> Fallback["FallbackEngine<br/>respuestas pregrabadas"]
    Engine --> Llm["LlmEngine"]
    Queue -->|applyDecision| Store
  end
  Llm -->|contraseña + aviso + contexto| SF["Server Function triageReport<br/>límite · contraseña · validación<br/>alias · saneado"]
  SF --> GW["AI Gateway"] --> M["Modelo (TRIAGE_MODEL)"]
  SF -->|TriageResult| Llm
  Dom["Dominio (TS puro)"] -.-> Store
  Dom -.-> SF
```

### 1. Datos maestros

Constantes de TypeScript:
- **Edificios:** `{ id, name, floors }`. Torre Central (−2 a 8), Edificio Anexo A (−1 a 3), Laboratorios (−1 a 2).
- **Protocolos:** 5 entradas `{ id, title }` con un texto ficticio por edificio («[FICTICIO]», sin validez operativa). La tarjeta muestra ese texto; la IA solo elige el `id`.
- **Categorías iniciales:** Incendio/Humo, Fallo Eléctrico, Médico y Seguridad, oficiales.

### 2. Modelo de datos

```text
Severity        = "low" | "medium" | "high" | "critical"     // low < medium < high < critical
IncidentState   = "pending" | "validated" | "discarded"
Mode            = "llm" | "fallback"
ReportErrorKind = "rate_limit" | "timeout" | "invalid_input" | "invalid_output"
                | "invalid_ref" | "network" | "server"
TriageErrorKind = ReportErrorKind | "unauthorized"   // unauthorized nunca se guarda en un aviso

Report {
  id: string
  seq: number                   // orden estable: cola, feed y lista de avisos
  buildingId: string
  floor: number
  text: string                  // 1..500 caracteres
  createdAt: number             // solo para mostrar la hora
  status: "queued" | "processing" | "done" | "error"
  errorKind: ReportErrorKind | null
  incidentId: string | null     // ÚNICA relación aviso→incidente
  scriptKey: string | null      // "S1".."S9" si viene de la ráfaga
}

Incident {
  id: string
  number: number                // etiqueta estable «INC-n», asignada al crearlo
  buildingId: string
  floor: number                 // la del primer aviso; no cambia
  categoryId: string
  severity: Severity
  protocolId: string
  summary: string               // ≤ 300
  rationale: string             // ≤ 200; motivo de la última propuesta aplicada
  state: IncidentState
  relatedIncidentId: string | null
  locks: { category, severity, protocol, summary: boolean }
}

Category { id: string, name: string /* ≤ 40 */, official: boolean }

TriageState {
  mode: Mode
  nextSeq: number
  nextIncidentNumber: number
  burstStartSeq: number | null  // seq del primer aviso de la última ráfaga (progreso «n/9»)
  reports: Record<id, Report>
  incidents: Record<id, Incident>
  categories: Record<id, Category>
}
```

**Datos derivados** (selectores, no se guardan):
- `reportsOf(incident)`: avisos con `incidentId === incident.id`, por `seq`; de ahí el contador y la hora del último aviso.
- `queueOrder`: avisos `queued` por `seq`.
- `visibleCategories`: oficiales más las no oficiales que usa algún incidente.
- `isBoardEmpty`: no hay ningún aviso.
- `burstProgress`: avisos con `scriptKey` y `seq ≥ burstStartSeq` que ya no están en cola ni procesándose, sobre 9.

### 3. Reglas del dominio

**Invariantes** (cada una con su test o cubierta por un test de `applyDecision`):
1. `report.incidentId` es la única relación aviso-incidente. El incidente no guarda lista ni contador.
2. Un incidente se crea en la misma operación que asigna su primer aviso.
3. Todos los avisos de un incidente tienen su edificio y su planta.
4. Un incidente `validated` o `discarded` no cambia. Aprobar una categoría cambia el catálogo, no los incidentes.
5. Un campo bloqueado no lo cambia la IA. La IA nunca baja la gravedad de un incidente; una persona sí, y el campo queda bloqueado.
6. Toda `categoryId`, `protocolId` y `relatedIncidentId` apunta a un registro existente. Las categorías solo desaparecen con «Reiniciar demo».

**Política de agrupación** (va en el prompt):
1. Mismo edificio y misma planta es **necesario**, no suficiente.
2. Además, los avisos deben describir **el mismo suceso** o fenómenos directamente relacionados con él.
3. **Ante la duda, separar:** crear un incidente nuevo. Una agrupación errónea no se puede deshacer; una separación innecesaria cuesta una tarjeta de más.
4. **Relacionar no es agrupar:** se relaciona el mismo fenómeno en otra planta o información nueva sobre un incidente validado.

**Elegibilidad.** Dos funciones puras, `canJoin(incident, report)` y `canRelate(incident, report)`. El servidor las usa para marcar en el prompt qué incidentes se pueden usar; `applyDecision` las aplica con el estado actual y es la comprobación que manda. No son una frontera de seguridad: el servidor calcula los indicadores con datos que envía el cliente.

| Incidente | `canJoin` | `canRelate` |
|---|---|---|
| `pending`, misma planta | sí | no |
| `pending`, otra planta del edificio | no | sí |
| `validated`, cualquier planta del edificio | no | sí |
| `discarded` | no | no |

Que un incidente `pending` de la misma planta no se pueda relacionar impide relacionar por código dos sucesos distintos de esa planta. Frente a un incidente `validated` de la misma planta, evitar una relación entre sucesos distintos depende del prompt.

### 4. Contrato con la IA

La IA recibe alias cortos (I1…, C1…, P1…P5), nunca IDs reales, y devuelve un objeto plano en el que todos los campos son obligatorios y «sin valor» es `null`:

```text
AiDecision {
  action: "join" | "create"
  targetRef: string | null        // I1..; obligatorio con join; se ignora con create
  relatedRef: string | null       // I1..; solo se usa con create
  categoryRef: string | null      // C1..
  newCategoryName: string | null  // ≤ 40; solo si ninguna categoría encaja
  severity: Severity
  protocolRef: string             // P1..P5
  summary: string                 // ≤ 300
  rationale: string               // ≤ 200
}
```

Reglas entre campos (si no se cumplen, `invalid_output`): `join` exige `targetRef`; exactamente uno de `categoryRef` o `newCategoryName`.

**Contexto por aviso:** el aviso nuevo; todos los incidentes del mismo edificio, con sus campos, los textos completos de sus avisos y los indicadores `canJoin`/`canRelate`; el catálogo de categorías completo; y los 5 protocolos con su texto para el edificio. Límites: 30 incidentes, 150 avisos de contexto y 128 KB por petición.

**Prompt** (en español, versionado con `PROMPT_VERSION`), en siete partes:
1. rol: «propones, no decides»;
2. política de agrupación;
3. prohibición de inventar ubicaciones, rutas, instrucciones o referencias, también en el texto libre;
4. reglas de gravedad y rúbrica ficticia de la demo;
5. categoría nueva como último recurso, pensada para el incidente en su conjunto;
6. un ejemplo resuelto de agrupación;
7. un ejemplo negativo: dos sucesos independientes en la misma planta y con pocos minutos de diferencia no se agrupan.

El texto de los avisos va entre delimitadores y se declara como dato, no como instrucción.

### 5. Server Function `triageReport`

Creada con `createServerFn`; `maxDuration` de 30 s; sin estado salvo el contador del límite. Pasos:

1. **Límite de peticiones:** contador en memoria por instancia, 20 por minuto, contando también los intentos con contraseña incorrecta. Si se supera, `rate_limit`.
2. **Contraseña:** comparación en tiempo constante con `DEMO_PASSWORD`. Si la variable falta o tiene menos de 12 caracteres, `server` (error de configuración, no de contraseña). Si no coincide, espera 1 s y devuelve `unauthorized`.
3. **Validación de entrada** con Zod (textos, edificio y planta existentes, todos los incidentes del mismo edificio, límites de tamaño). Si falla, `invalid_input`.
4. **Elegibilidad y alias:** calcula `canJoin`/`canRelate` y asigna alias.
5. **Llamada a la IA:** `TRIAGE_MODEL` con versión exacta, temperatura 0, 800 tokens de salida como máximo, razonamiento extendido desactivado o al mínimo, timeout de 15 s.
6. **Validación de la salida** con Zod y las reglas entre campos. Si falla, `invalid_output`.
7. **Traducción y saneado de referencias:**
   - `targetRef` desconocido → `targetIncidentId: null` (`applyDecision` lo convertirá en «crear»);
   - `relatedRef` desconocido → `null`;
   - `categoryRef` o `protocolRef` desconocidos → `invalid_ref`;
   - `newCategoryName` que, normalizado (minúsculas, sin tildes, espacios simples), coincide con una categoría existente → esa categoría;
   - textos recortados a su máximo.
8. **Errores:** 429 → `rate_limit`; timeout → `timeout`; cualquier otro → `server`. Nunca lanza excepciones al cliente.
9. **Log:** una línea por llamada con `{ model, promptVersion, latencyMs, tokens, outcome }`.

```text
TriageResult = { ok: true, decision: TriageDecision } | { ok: false, error: TriageErrorKind }

TriageDecision {        // IDs reales
  action: "join" | "create"
  targetIncidentId: string | null
  relatedIncidentId: string | null
  category: { existingId } | { newName }
  severity, protocolId, summary, rationale
}
```

### 6. Motores

```text
interface TriageEngine { propose(input: TriageInput): Promise<TriageResult> }
TriageInput { report, contextIncidents: { incident, reports[] }[], categories }
```

- **`LlmEngine`:** llama a `triageReport` con la contraseña en memoria; un fallo de red es `network`.
- **`FallbackEngine`:** devuelve la respuesta pregrabada de `report.scriptKey` tras unos 600 ms. Las respuestas no usan IDs, sino el **aviso ancla** del grupo («unirse al incidente del aviso S1»), que se traduce al `incidentId` actual de ese aviso. Como el modo sin API solo procesa una ráfaga sobre un tablero vacío y nunca falla, cada ancla existe y es única. Si un ancla no tuviera incidente, el destino sería `null` y `applyDecision` lo trataría como «crear».

### 7. `applyDecision` y acciones

`applyDecision(state, { reportId, decision, newIncidentId, newCategoryId }) → { state, createdCategory }`. Es una función pura: los IDs nuevos llegan como datos y los números (`seq`, `INC-n`) salen de los contadores del estado.

1. Si el aviso no existe o no está `processing`, no cambia nada.
2. **`join` a un destino con `canJoin`:**
   - el aviso se asigna al destino;
   - el resumen, el protocolo y la categoría se actualizan si no están bloqueados (si la categoría está bloqueada, una categoría nueva propuesta no se crea);
   - `severity = max(actual, propuesta)` si no está bloqueada;
   - `rationale` se actualiza siempre;
   - **la relación del destino no cambia.**
3. **`join` sin destino válido** (alias desconocido o incidente sin `canJoin`): se crea un incidente nuevo. Su resumen es el texto del aviso (recortado a 300), su gravedad la propuesta y su motivo «Incidente nuevo: el incidente propuesto no admitía este aviso.». Queda relacionado con el destino si este existe y tiene `canRelate`.
4. **`create`:** incidente nuevo con `number = nextIncidentNumber`, estado `pending`, sin bloqueos y con el edificio y la planta del aviso. La relación propuesta se guarda si el incidente existe y tiene `canRelate`.
5. **Categoría nueva:** si el nombre normalizado ya existe, se reutiliza; si no, se crea no oficial y se devuelve como `createdCategory`.
6. El aviso pasa a `done`.

**Acciones del operador** (solo sobre incidentes `pending`): `editIncident` (cada campo editado queda bloqueado; la categoría se elige entre `visibleCategories`), `validateIncident` y `discardIncident`. **Sobre el catálogo:** `approveCategory`, visible en cualquier columna. **Sobre avisos:** `enqueueReports`, `markProcessing`, `markError`, `retryReport` (vuelve a la cola con un `seq` nuevo, al final) y `returnToQueue` (vuelve a la cola conservando su `seq`). **Reinicio:** `createInitialState()`.

```mermaid
stateDiagram-v2
  [*] --> pending: create
  pending --> pending: join / edición
  pending --> validated: Validar
  pending --> discarded: Descartar
```

### 8. Store y cola

**Store de Zustand**, sin persistencia. Guarda `TriageState` y tres campos de interfaz: `running` (la cola está procesando), `demoPassword` (solo en memoria) y `passwordPrompt` (`null` o `{ rejected: boolean }`). Las acciones del store llaman a las funciones del dominio.

**Cola** (módulo TypeScript sin React, con el store y los motores inyectados para poder testearla):

```text
drain():
  si running: salir                 // el bucle en curso recogerá los avisos nuevos
  running ← true
  try:
    mientras queueOrder no esté vacío:
      s ← getState();  report ← primero de queueOrder(s)
      si s.mode = "llm" y no hay demoPassword:
          passwordPrompt ← { rejected: false };  salir del bucle
      markProcessing(report)
      result ← motor(s.mode).propose(buildTriageInput(getState(), report.id))
      si result.ok:
          { state, createdCategory } ← applyDecision(getState(), { reportId: report.id,
              decision: result.decision, newIncidentId: uuid(), newCategoryId: uuid() })
          setState(state)
      si no, si result.error = "unauthorized":
          returnToQueue(report);  demoPassword ← null
          passwordPrompt ← { rejected: true };  salir del bucle
      si no:
          markError(report, result.error)        // la cola sigue
      si report.scriptKey: esperar 300 ms
  finally:
    running ← false
```

- Un aviso encolado mientras `running` está activo lo recoge el bucle en curso: entre la última comprobación y el `finally` no hay ningún `await`.
- **Mientras `running` es verdadero**, la interfaz desactiva «Reiniciar», el interruptor de modo, «Simular ráfaga», «Editar», «Validar», «Descartar» y «Aprobar categoría». Siguen activos «Enviar aviso» y «Reintentar», que solo añaden avisos a la cola. Así el tablero no cambia por acciones del operador durante una llamada.
- Al introducir la contraseña: se guarda, `passwordPrompt ← null` y `drain()`.

### 9. Interfaz

Una ruta (`/`), componentes de shadcn/ui:

- **Cabecera:** nombre, «Demo con datos ficticios» y «Modo: IA / Sin API».
- **Panel lateral:**
  - formulario (edificio, planta, texto con contador de 500; desactivado en modo sin API);
  - «Simular ráfaga» (en modo sin API, solo con el tablero vacío);
  - «Reiniciar demo» con confirmación;
  - interruptor «Modo sin API» (solo con el tablero vacío y la cola parada);
  - progreso «n/9».
- **Feed:** avisos del más reciente al más antiguo, con edificio, planta, hora, texto, estado («En cola», «Procesando», «Asignado a INC-n», «Error: …») y «Reintentar» si procede.
- **Tablero:** columnas `Pendiente | Validado | Descartado`. Cada tarjeta muestra:
  - `INC-n`, categoría (con «No oficial» y «Aprobar categoría» si procede), gravedad con color, edificio y planta;
  - el protocolo con su texto «[FICTICIO]»;
  - resumen y motivo bajo «Texto generado por IA»;
  - número de avisos, hora del último aviso y «Relacionado con INC-m»;
  - un candado en los campos bloqueados;
  - en `Pendiente`: «Editar», «Validar», «Descartar». En `Validado`: «Protocolo aprobado (no ejecutado: demo)».
- **Diálogos:** edición del incidente y contraseña.

## Alternatives Considered

#### Alternative A: Reagrupar todos los avisos en bloque

*   **Pros**: la IA podría corregir agrupaciones anteriores.
*   **Cons**: IDs inestables mientras el operador mira; coste creciente por llamada.
*   **Reason for Rejection**: Rejected by author: la agrupación incremental mantiene incidentes estables y un coste lineal.

#### Alternative B: Procesar avisos en paralelo

*   **Pros**: ráfaga más rápida.
*   **Cons**: dos avisos del mismo suceso se evalúan sin verse y duplican incidentes.
*   **Reason for Rejection**: Rejected by author: la cola secuencial evalúa cada aviso con el estado que dejó el anterior.

#### Alternative C: Agrupar plantas contiguas o incidentes con varias plantas

*   **Pros**: un incendio que sube quedaría en una tarjeta.
*   **Cons**: regla arbitraria y más difícil de comprobar; esquema más complejo.
*   **Reason for Rejection**: Rejected by author: «misma planta» se comprueba por código en una línea; la propagación se expresa con relaciones.

#### Alternative D: Persistencia en `localStorage`

*   **Pros**: el tablero sobrevive a una recarga.
*   **Cons**: con SSR obliga a desactivar la hidratación automática, renderizar el tablero solo en el cliente, versionar el estado y tratar los avisos interrumpidos.
*   **Reason for Rejection**: Rejected by author: no es un requisito; en una demo de una sola sesión, su coste no compensa. Queda como mejora opcional.

#### Alternative E: Estado en el servidor o base de datos

*   **Pros**: estado compartido y más cercano a producción.
*   **Cons**: las funciones serverless no comparten memoria; una base de datos añade infraestructura.
*   **Reason for Rejection**: Rejected by author: fuera del MVP; está en Future Improvements.

#### Alternative F: `useReducer` + Context en lugar de Zustand

*   **Pros**: sin dependencias.
*   **Cons**: la cola, que vive fuera de React, necesitaría una `ref` mantenida a mano para leer el estado actual.
*   **Reason for Rejection**: Rejected by author: con Zustand la cola lee el estado con `getState()`.

#### Alternative G: Recuperación automática de errores

*   **Pros**: una ráfaga con errores transitorios terminaría sola (pausa por 429, reintentos, cambio automático al modo sin API).
*   **Cons**: varios estados y caminos de espera nuevos, con interacciones difíciles con el reinicio; la primera revisión encontró defectos en ellos.
*   **Reason for Rejection**: Rejected by author: el error queda visible con «Reintentar» manual y el modo sin API se elige antes de la ráfaga.

#### Alternative H: Contexto compacto para la IA

*   **Pros**: menos tokens.
*   **Cons**: la IA dependería de resúmenes que pueden estar bloqueados o desactualizados.
*   **Reason for Rejection**: Rejected by author: con el volumen de la demo, enviar los avisos completos cuesta poco y mejora la agrupación.

#### Alternative I: Esquema de respuesta como unión de tipos

*   **Pros**: tipos más precisos.
*   **Cons**: si la salida estructurada del proveedor no admite uniones, la validación fallaría.
*   **Reason for Rejection**: Rejected by author: un objeto plano con `null` funciona con más proveedores; se comprueba el día 1.

#### Alternative J: Categorías «Otro» y «Falsa Alarma»

*   **Pros**: lista cerrada.
*   **Cons**: «Otro» esconde información; «Falsa Alarma» mezcla el tipo de suceso con su veracidad.
*   **Reason for Rejection**: Rejected by author: categorías dinámicas con aprobación; una falsa alarma se descarta.

#### Alternative K: Fusión manual, «Separar aviso», arrastrar tarjetas o vista de arquitectura en la app

*   **Pros**: más control y una demo más vistosa.
*   **Cons**: entre 1 y 3 h cada una.
*   **Reason for Rejection**: Rejected by author: no caben en 24 h; los botones y el README cubren la necesidad.

#### Alternative L: Clave propia de Gemini (BYOK)

*   **Pros**: usaría la cuota gratuita de Google.
*   **Cons**: BYOK en AI Gateway requiere el plan de pago.
*   **Reason for Rejection**: Rejected by author: se usa el crédito gratuito del Gateway (pendiente de verificar el día 1); si no existe, BYOK vuelve a considerarse.

#### Alternative M: SPA sin SSR

*   **Pros**: algo más simple.
*   **Cons**: no cumple el enunciado.
*   **Reason for Rejection**: Rejected by author: el SSR es obligatorio; sin persistencia, no añade complejidad de hidratación.

--------------------------------------------------------------------------------

## Risks & Mitigations

| # | Riesgo | Mitigación | Limitación aceptada |
|---|---|---|---|
| R1 | El modelo se desvía del guion en directo (por ejemplo, agrupa S8 con A). | Prompt con ejemplo negativo; modelo con versión fijada; la ráfaga se prueba varias veces antes de la entrevista; el modo sin API reproduce el guion. | Con la IA real no hay garantía de resultado. Si diverge, se usa para enseñar por qué una persona valida. |
| R2 | El crédito gratuito del Gateway no existe o se agota. | Comprobarlo el día 1; el modo sin API sirve para toda la demo. | Sin crédito, la IA real solo se enseña si hay presupuesto. |
| R3 | Errores de la IA en mitad de la ráfaga (429, timeout). | Error visible por aviso y «Reintentar». | Varios avisos pueden quedar en error; reintentarlos cambia el orden y el resultado puede no coincidir con el guion. |
| R4 | Una agrupación errónea no se puede deshacer. | «Ante la duda, separar»; el motivo de cada propuesta es visible. | Corregirla exige descartar el incidente. |
| R5 | El texto libre de la IA inventa ubicaciones o instrucciones. | Prohibido en el prompt; etiqueta «Texto generado por IA»; el bloque de protocolo sale de los datos maestros. | El texto libre no se verifica. |
| R6 | Abuso de la URL pública. | Contraseña de al menos 12 caracteres; límite de peticiones antes de la contraseña; 1 s de espera tras un fallo; límites de tamaño y tokens; se cambia la contraseña tras la entrevista. | El límite es por instancia y global: alguien con la URL puede agotar las 20 peticiones por minuto. |
| R7 | APIs de TanStack Start o AI SDK distintas de lo previsto. | La fase 0 despliega la plantilla oficial con una llamada real; versiones fijadas en `package-lock.json`; un único archivo usa AI SDK. | — |
| R8 | Las 24 h no alcanzan. | Margen de 2,5 h; las mejoras opcionales solo entran con margen; orden de recorte: pulido visual, luego script de comprobación. | — |

**Limitaciones conocidas** (documentadas en el README, sin código para evitarlas):
- Una recarga del navegador borra el tablero.
- Durante el procesamiento (unos 20-40 s en una ráfaga) el operador no puede actuar sobre los incidentes.
- Si un `join` apunta a un incidente no válido, el incidente nuevo usa la gravedad propuesta, que la IA pensó para el incidente consolidado.
- Un contexto por encima de los límites (30 incidentes, 150 avisos o 128 KB) devuelve `invalid_input` y no se puede reintentar. La demo está muy por debajo.
- Una sola sesión y un solo navegador.

## Non-Functional Requirements

- **Seguridad:** la clave del Gateway y `DEMO_PASSWORD` solo existen en el servidor (ninguna variable con prefijo `VITE_`); entrada validada con Zod; respuesta de la IA saneada; datos ficticios.
- **Rendimiento:** una llamada por aviso; ráfaga de unos 20-40 s con la IA real (se mide el día 1) y unos 8 s sin API. Estimación aproximada: 20.000-25.000 tokens de entrada por ráfaga.
- **Despliegue:** cada push a `main` despliega en Vercel; se vuelve atrás promoviendo el despliegue anterior.

## Future Improvements

- Estado en el servidor (Postgres o Redis) con una cola por edificio para varios operadores; con él, la elegibilidad pasaría a comprobarse con autoridad en el servidor.
- Persistencia, estado `Resuelto`, «Separar aviso» y registro de auditoría.
- Recuperación automática de errores y límite de peticiones compartido entre instancias.
- Vista móvil del ocupante, avisos por audio y evaluación formal de la agrupación.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

### Fases y presupuesto (24 h)

| Fase | Contenido | Horas | Condición de salida |
|---|---|---|---|
| 0. Esqueleto | Plantilla oficial de TanStack Start desplegada en Vercel; `triageReport` hace una llamada real con salida estructurada a `google/gemini-2.5-flash` u `openai/gpt-4o-mini`; versiones fijadas. | 2 | La URL pública devuelve una decisión válida con al menos un modelo. Se fija ese en `TRIAGE_MODEL`. Si ninguno funciona, la demo se hace en modo sin API (R2). |
| 1. Dominio | Tipos, reglas, `applyDecision`, acciones, selectores y sus tests. | 4 | `npm test` en verde. |
| 2. IA y servidor | Contrato, alias, saneado, prompt, Server Function y tests del saneado. | 3 | Tests en verde y una llamada real correcta. |
| 3. Store y cola | Store en memoria, cola y sus tests. | 1,5 | Tests de la cola en verde. |
| 4. Modo sin API | Guion, respuestas pregrabadas, `FallbackEngine` y su test. | 1,5 | El test de la ráfaga sin API en verde. |
| 5. Interfaz | Panel, feed, tablero, tarjetas y diálogos. | 6 | Los CUJ 1 a 9 funcionan en local. |
| 6. Ajuste del prompt | Ráfaga real en la interfaz, repetida hasta que las agrupaciones coinciden con el guion. | 1,5 | Tres ráfagas seguidas con las agrupaciones, relaciones y categorías del guion. Si no se consigue en este tiempo, se documenta y la ráfaga de la entrevista se hace sin API. |
| 7. Cierre | README, despliegue final, recorrido de los CUJ en la URL pública y ensayo. | 2 | CUJ 1 a 9 en la URL pública. |
| Margen | Imprevistos y, si sobra, mejoras opcionales en su orden. | 2,5 | |
| **Total** | | **24** | |

### Estructura

| Carpeta | Responsabilidad |
|---|---|
| `src/domain/` | Tipos y reglas puras. No importa nada de fuera. |
| `src/data/` | Datos maestros, guion y respuestas pregrabadas. |
| `src/ai/` | Contrato con la IA (esquema, alias, saneado) y prompt. |
| `src/server/` | Server Function y llamada al modelo. |
| `src/engines/` | `LlmEngine` y `FallbackEngine`. |
| `src/store/`, `src/queue/` | Store y cola. |
| `src/components/`, `src/routes/` | Interfaz. |

### Archivos

#### Configuración

1. **`package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`** (Create, desde la plantilla oficial). Añaden `ai`, `zod` (3.25 o posterior), `zustand`, Tailwind v4, shadcn/ui y `vitest`. Scripts: `dev`, `build`, `start`, `test` (`vitest run`), `typecheck` (`tsc --noEmit`). `strict: true`. La configuración del destino de Vercel y de `maxDuration` se comprueba en la fase 0.
2. **`components.json`** (Create con `npx shadcn init`).
3. **`.env.example`** (Create): `AI_GATEWAY_API_KEY` (solo en local; en Vercel, OIDC), `TRIAGE_MODEL` (versión exacta) y `DEMO_PASSWORD` (12 caracteres o más).
4. **`.gitignore`** (Create): `node_modules/`, `.env*` salvo `.env.example`, `.output/`, `.vercel/`, `dist/`.

#### Datos

5. **`src/data/buildings.ts`** (Create): los 3 edificios con sus plantas y `floorLabel(n)` (−1 → «Sótano 1», 0 → «Planta baja»).
6. **`src/data/protocols.ts`** (Create): los 5 protocolos y su texto ficticio por edificio:

    | Protocolo | Torre Central | Edificio Anexo A | Laboratorios |
    |---|---|---|---|
    | `evac-plan`: evacuación por las rutas del plano | Ruta verde, escaleras E-1 y E-2 hasta la salida principal | Ruta azul, escalera única hasta el patio interior | Ruta naranja, escalera de servicio hasta el muelle de carga |
    | `evac-nearest`: evacuación por las salidas más cercanas | Salidas Norte y Sur de planta baja | Salida de recepción y salida lateral Oeste | Salida principal y salida de emergencia del sótano −1 |
    | `meet-inside`: punto de reunión en una planta | Vestíbulo de planta baja | Sala polivalente de planta 1 | Aula 0.2 de planta baja |
    | `meet-outside`: punto de reunión exterior | Plaza exterior, punto PR-1 | Aparcamiento Este, punto PR-2 | Jardín Norte, punto PR-3 |
    | `notify`: solo informar a los usuarios | Notificación a ocupantes de Torre Central | Notificación a ocupantes del Anexo A | Notificación a ocupantes de Laboratorios |

7. **`src/data/categories.ts`** (Create): las 4 categorías iniciales oficiales (`fire-smoke`, `electrical`, `medical`, `security`).
8. **`src/data/fallback-fixtures.ts`** (Create): una respuesta pregrabada por clave S1 a S9, con `targetAnchor` y `relatedAnchor` en lugar de IDs (A: ancla S1; D: ancla S3; B se relaciona con S1). Usa siempre el valor esperado del archivo 9. La gravedad de A sube S1 Media → S2 Alta → S4 Alta → S7 Crítica; la categoría nueva de S9 se llama «Fuga de agua».
9. **`src/data/burst-script.ts`** (Create): el guion y los resultados esperados. **Fixtures de demostración, no recomendaciones de seguridad.**

    | Clave | Edificio, planta | Texto | Grupo |
    |---|---|---|---|
    | S1 | Torre Central, 2 | «Huele a humo en el pasillo de la segunda planta, cerca de las salas de reuniones.» | A (crea) |
    | S2 | Torre Central, 2 | «Hay una especie de niebla gris saliendo del falso techo junto a la sala 2.04.» | A |
    | S3 | Anexo A, 0 | «Se ha ido la luz en toda la recepción y las puertas automáticas no abren.» | D (crea) |
    | S4 | Torre Central, 2 | «Olor a quemado muy fuerte junto a la escalera de la planta 2, pican los ojos.» | A |
    | S5 | Anexo A, 0 | «En recepción tampoco funcionan los ordenadores ni el ascensor, parece un corte general.» | D |
    | S6 | Torre Central, 3 | «Está entrando humo por la puerta de la escalera en la planta 3.» | B (crea, relacionado con A) |
    | S7 | Torre Central, 2 | «Ya se ven llamas pequeñas en el cuarto de fotocopiadoras de la segunda planta.» | A |
    | S8 | Torre Central, 2 | «Una persona se ha desmayado en la cafetería de la planta 2. Está consciente y responde cuando le hablan.» | C (crea, sin relación) |
    | S9 | Laboratorios, −1 | «Cae agua del techo en el almacén del sótano y se está formando un charco grande.» | E (crea categoría no oficial) |

    **Rúbrica de gravedad** (ficticia, sin valor operativo; va en el prompt):

    | Gravedad | Criterio |
    |---|---|
    | Baja | Anomalía sin riesgo para las personas ni efecto en el uso del edificio. |
    | Media | Afecta a un servicio o a una zona (luz, accesos, ascensores, agua), o a una persona sin gravedad aparente. |
    | Alta | Riesgo posible para las personas o propagación probable (humo en zonas de paso, varias personas afectadas). |
    | Crítica | Peligro activo con riesgo inmediato para la vida (llamas, humo denso que se extiende, personas atrapadas). |

    **Resultados esperados.** Agrupación, relación y categoría deben coincidir; gravedad y protocolo se aceptan dentro del rango.

    | Grupo | Avisos | Categoría | Gravedad (rango) | Protocolo (alternativa) | Relación |
    |---|---|---|---|---|---|
    | A | S1, S2, S4, S7 | Incendio/Humo | Crítica (Alta-Crítica) | `evac-plan` (`evac-nearest`) | — |
    | B | S6 | Incendio/Humo | Alta (Alta-Crítica) | `evac-nearest` (`evac-plan`) | → A |
    | C | S8 | Médico | Media (Media-Alta) | `notify` | — |
    | D | S3, S5 | Fallo Eléctrico | Media (Media-Alta) | `notify` | — |
    | E | S9 | Nueva no oficial: «Fuga de agua» o «Filtración de agua» | Media (Baja-Media) | `notify` | — |

    `notify` en C es el protocolo genérico que mejor encaja entre los cinco, no una respuesta médica.

#### Dominio

10. **`src/domain/types.ts`** (Create): los tipos del Technical Plan §2, más `TriageDecision`, `TriageResult`, `TriageInput` y la interfaz `TriageEngine`.
11. **`src/domain/rules.ts`** (Create): `maxSeverity`, `canJoin`, `canRelate`, `normalizeCategoryName` y `findCategoryByName`.
12. **`src/domain/apply-decision.ts`** (Create): `applyDecision` con las reglas 1 a 6 del Technical Plan §7.
13. **`src/domain/actions.ts`** (Create): `createInitialState`, `createReport` (asigna `seq`), `enqueueReports`, `markProcessing`, `markError`, `retryReport`, `returnToQueue`, `editIncident`, `validateIncident`, `discardIncident` y `approveCategory`.
14. **`src/domain/selectors.ts`** (Create): `reportsOf`, `queueOrder`, `visibleCategories`, `incidentsByState`, `isBoardEmpty`, `burstProgress` y `buildTriageInput` (todos los incidentes del mismo edificio con sus avisos).

#### IA y servidor

15. **`src/ai/contract.ts`** (Create): `AiDecisionSchema` (Zod), `checkCrossFieldRules`, `buildAliases` y `sanitizeDecision` (paso 7 del Technical Plan §5).
16. **`src/ai/prompt.ts`** (Create): `PROMPT_VERSION`, `buildSystemPrompt()` con las siete partes y `buildUserPrompt(input, aliases, flags)` con los avisos entre etiquetas `<aviso>…</aviso>`.
17. **`src/server/llm-client.ts`** (Create): `callTriageModel(system, user)`. Es el único archivo que importa `ai`. Configuración del paso 5 y traducción de errores del paso 8.
18. **`src/server/triage-report.ts`** (Create): la Server Function con los pasos 1 a 9, incluido el contador del límite de peticiones y la comprobación de la contraseña con `timingSafeEqual`.

#### Motores, store y cola

19. **`src/engines/llm-engine.ts`** (Create): `createLlmEngine(getPassword)`.
20. **`src/engines/fallback-engine.ts`** (Create): `createFallbackEngine(getState)`; traduce las anclas al `incidentId` actual del aviso con esa clave.
21. **`src/store/triage-store.ts`** (Create): `useTriageStore` sin persistencia, con `TriageState`, `running`, `demoPassword` y `passwordPrompt`. Genera los UUID al llamar al dominio.
22. **`src/queue/triage-queue.ts`** (Create): `createTriageQueue({ getState, setState, getEngine, sleep, uuid })` con `drain()`, `submitManualReport`, `startBurst`, `retry` y `submitPassword`, según el pseudocódigo del Technical Plan §8.

#### Interfaz

23. **`src/routes/__root.tsx`** (Create): `<html lang="es">`, estilos y metadatos.
24. **`src/routes/index.tsx`** (Create): la página con cabecera, panel, feed y tablero; importa los datos maestros directamente.
25. **`src/router.tsx`** y **`src/styles/app.css`** (Create): los de la plantilla, más cuatro colores de gravedad.
26. **`src/components/ControlPanel.tsx`** (Create): formulario de aviso, «Simular ráfaga», «Reiniciar demo» con confirmación, interruptor de modo y progreso, con las reglas de activación del Technical Plan §8 y §9.
27. **`src/components/ReportFeed.tsx`** (Create): el feed con estado y «Reintentar».
28. **`src/components/IncidentBoard.tsx`** e **`IncidentCard.tsx`** (Create): columnas y tarjetas según el Technical Plan §9.
29. **`src/components/EditIncidentDialog.tsx`** y **`PasswordDialog.tsx`** (Create): edición (categoría de `visibleCategories`, gravedad, protocolo, resumen) y contraseña.
30. **`src/components/ui/*`** (Create con shadcn): `button`, `card`, `badge`, `dialog`, `alert-dialog`, `select`, `textarea`, `label`, `switch`, `tooltip`.

#### Tests

31. **`src/domain/apply-decision.test.ts`** (Create):
    *   `join` válido: asigna, actualiza campos no bloqueados, gravedad con `max`, no cambia la relación del destino;
    *   campos bloqueados no cambian; con la categoría bloqueada no se crea una categoría nueva;
    *   `join` a un incidente validado → incidente nuevo relacionado; a uno descartado → sin relación; a un destino `null` → incidente nuevo;
    *   `create` con relación válida y no válida (misma planta `pending`);
    *   categoría nueva creada como no oficial; nombre equivalente reutilizado;
    *   `INC-n` crece de uno en uno.
32. **`src/domain/actions.test.ts`** (Create): `editIncident` bloquea; validar y descartar son finales; `approveCategory`; `retryReport` va al final y `returnToQueue` conserva la posición; `visibleCategories` oculta las no oficiales sin uso; las cuatro filas de la tabla de elegibilidad.
33. **`src/ai/contract.test.ts`** (Create): reglas entre campos; traducción de alias; `targetRef` y `relatedRef` desconocidos; `categoryRef` y `protocolRef` desconocidos → `invalid_ref` (**el test que se enseña en la entrevista**); nombre de categoría equivalente; recortes.
34. **`src/engines/fallback-engine.test.ts`** (Create): la ráfaga S1 a S9 con `FallbackEngine` y `applyDecision` sobre un estado inicial coincide exactamente con los resultados esperados (agrupación, relación, categoría, gravedad y protocolo), y dos ejecuciones dan el mismo resultado.
35. **`src/queue/triage-queue.test.ts`** (Create, con un motor falso controlable):
    *   procesa de uno en uno y nunca hay dos `propose` en curso;
    *   un error deja el aviso en error y la cola sigue;
    *   sin contraseña en modo IA, se detiene antes de llamar;
    *   ante `unauthorized`, el aviso vuelve a la cola en su posición y la cola se detiene;
    *   un aviso encolado durante el procesamiento se procesa en el mismo `drain()`.

#### Documentación

36. **`README.md`** (Create): qué es y advertencia de datos ficticios; cómo ejecutarlo; diagrama de arquitectura y de un aviso en Mermaid; reglas del dominio; limitaciones conocidas; hoja de ruta; guion de la demo.

### Verification Plan

*   **Build:** `npm run typecheck` y `npm run build` sin errores; despliegue de vista previa en cada push.
*   **Unit Tests:** `npm test` (archivos 31 a 35).
*   **Cobertura:** sin porcentaje. Cada regla de `applyDecision`, cada fila de elegibilidad, cada regla de saneado, la ráfaga sin API y el comportamiento básico de la cola tienen al menos un test.
*   **Manual:**
    1. En la URL pública, recorrer los CUJ 1 a 9 en modo IA y en modo sin API.
    2. Tres ráfagas reales seguidas con las agrupaciones del guion antes de la entrevista (se repite la mañana de la entrevista).
    3. Buscar en `.output/public` que no aparezcan los valores de `DEMO_PASSWORD` ni de `AI_GATEWAY_API_KEY`.
    4. Comprobar en la consola del navegador que no hay avisos de hidratación.

--------------------------------------------------------------------------------

*Drafted with EGM*
