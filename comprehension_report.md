# Etapa 6: Comprehension Test

* **Documento revisado:** `docs/designs/emergency_triage.md`
* **Rangos:** FeatureRange 1-804, DetailedRange 805-1377
* **Revisor:** `egm-comprehension`, sin contexto previo y sin estándar de documento
* **GoldfishContext:** ninguno
* **Fecha:** 2026-11-18

El revisor escribió su resultado en inglés. Lo reproduzco completo, traducido al español.

---

**What this proposes**

EmergencyTriage es una consola de demostración para una entrevista de trabajo. Usa solo datos inventados y debe construirse en unas 24 horas con coste cero. Los avisos de texto libre de los ocupantes de un edificio pasan por una cola en el cliente, de uno en uno. Por cada aviso se llama a un LLM a través de una Server Function sin estado de TanStack Start y de Vercel AI Gateway. El LLM propone una de dos cosas: unir el aviso a un incidente abierto del mismo edificio y planta, o crear un incidente nuevo. Un incidente nuevo puede quedar «relacionado» con otro. El LLM también propone una categoría (que puede ser nueva y no oficial), una gravedad que solo puede mantenerse o subir, uno de 5 protocolos fijos, un resumen y un motivo.

El servidor da al LLM alias cortos en lugar de IDs reales. Calcula qué incidentes se pueden usar como destino para agrupar o relacionar (`canJoin`/`canRelate`) y sanea la respuesta antes de traducirla de nuevo a IDs reales. En el cliente, la función pura `applyDecision` vuelve a comprobar la decisión contra el estado actual antes de aplicarla. Una persona puede editar campos de un incidente pendiente, lo que los bloquea frente al LLM, y después validarlo o descartarlo. Los dos resultados son definitivos, y validar no ejecuta nada. El estado vive en un store de Zustand guardado en `localStorage`. Un modo sin conexión reproduce respuestas pregrabadas para una ráfaga de 9 avisos que debe acabar en 5 incidentes.

**How the existing system works, per this document**

No existe ningún sistema previo: es un desarrollo nuevo en un repositorio vacío. El único artefacto anterior es `concepts_brief.md`, un documento de concepto más antiguo que se conserva pero ya no se edita. Cuando los dos difieren, manda este documento, y una tabla de 9 filas enumera las decisiones que sustituyen o amplían el brief. Todavía no existe nada en ejecución. El «comportamiento actual» que el lector necesita son las decisiones del brief, a las que el documento se refiere por ID (M8, ADR-22, B1/B2, ADR-17, M4, ADR-24, ADR-20).

**Valoración global:** el FeatureRange se puede parafrasear de principio a fin y sus partes encajan. El modelo de datos, la elegibilidad, el saneado del servidor y `applyDecision` describen las mismas reglas de forma coherente. No hay bloqueantes. Hay dos hallazgos importantes (1 y 2) y el resto son menores.

---

## Hallazgos

### 🟡 C1. Fase 0: «los dos modelos candidatos» no están definidos

- **Dónde:** DetailedRange, condición de salida de la fase 0 (línea 811).
- **Problema:** el texto exige que la URL devuelva «una decisión válida de los dos modelos candidatos», pero el documento no dice cuáles son. Solo aparece `gemini-2.5-flash`, como ejemplo (líneas 280 y 887). Un lector nuevo no puede comprobar esta condición.
- **Propuesta:** nombrar los dos modelos, o indicar dónde se eligen, y decir qué pasa si solo funciona uno.

### 🟡 C2. El pseudocódigo de la cola contradice el tratamiento de la contraseña

- **Dónde:** pseudocódigo de §8 (líneas 581-594) frente a §10 (línea 632) y archivo 35 (línea 1158).
- **Problema:** el pseudocódigo dice que cualquier error lleva a `markError` y que «la cola continúa». Sin embargo, §10 dice que un `unauthorized` detiene la cola y vuelve a abrir el diálogo. El pseudocódigo no tiene ni estado de pausa ni rama para `unauthorized`. Además, no queda claro:
  - si, tras introducir la contraseña, el aviso en `error: unauthorized` se reintenta solo o necesita «Reintentar» a mano;
  - si el diálogo se abre antes de la primera llamada al LLM (cuando aún no hay contraseña guardada) o solo después de que el servidor rechace una.
- **Propuesta:** añadir al pseudocódigo la rama `unauthorized` y la pausa, y decir claramente qué pasa con el aviso rechazado y cuándo se abre el diálogo por primera vez.

### 🟢 Nits

| # | Dónde | Problema | Propuesta |
|---|---|---|---|
| C3 | Tabla de decisiones (21-31); líneas 521 y §3 | ADR-24 no tiene ninguna explicación, y ADR-20 y ADR-22 necesitan el brief para entenderse. No se da la ruta de `concepts_brief.md` hasta la línea 1358. | Añadir una descripción breve de ADR-24, ADR-20 y ADR-22, y la ruta del brief. |
| C4 | Tabla de decisiones (19-31) | Usa `canJoin`, `canRelate`, «destino», «aviso ancla», `applyDecision`, `summaryLockedAtReportCount` y `error: interrupted` antes de definirlos. | Añadir «los términos se definen en el Technical Plan» o mover la tabla más abajo. |
| C5 | Línea 258 | «Esta decisión de estado… La comunicación sigue tal como estaba definida» no dice qué decisión es y remite a una versión que el lector no ha visto. | Nombrar la decisión (Zustand) y quitar la comparación con la versión anterior. |
| C6 | Línea 401 | El prompt tiene «cinco partes», pero se enumeran siete. | Corregir el número. |
| C7 | Invariante 8 (106) y Non-Goals (153) frente a CUJ 9 (243) y `resetState` (545) | Las categorías «no se borran nunca», pero un reinicio vacía las no oficiales. | Matizar: nunca se borran salvo con «Reiniciar demo», que sustituye todo el estado. |
| C8 | Líneas 115, 149, 798 | «Separar aviso» figura como fuera del alcance, como opcional si sobra tiempo y como hoja de ruta. | Elegir un único estado. |
| C9 | Línea 438 frente a archivo 18 (1019) | «El resto se omite» frente a «luego el resto». | Describirlo como un solo orden de prioridad que llena hasta el límite. |
| C10 | `applyDecision`, regla de `join` (527) | `rationale` deja de actualizarse cuando el resumen está bloqueado, sin dar el motivo; la tarjeta puede mostrar un motivo antiguo. | Explicar la relación o actualizar `rationale` de forma independiente. |
| C11 | Líneas 611, 619, 1217 | «#incidente», «#…» y «#corto»: no se define la etiqueta corta que se ve en pantalla. | Definir cómo se construye. |
| C12 | Líneas 620, 1232 | `engine` está en `Report`, no en `Incident`; no se dice cómo se obtiene la insignia del incidente. | Decir de dónde se deriva (por ejemplo, del último aviso). |
| C13 | Líneas 85, 237, 609, 1018 | «Tablero vacío» decide si se puede activar el modo sin API, pero no se define (¿sin incidentes o sin avisos?). | Definirlo. |
| C14 | Línea 730 | «Revisión Goldfish» es un término del proceso de redacción. | Quitarlo o explicarlo. |
| C15 | Archivos 61-62 (1351-1358) y Status (4) | El archivo 61 se describe como «copia final de este `design_draft.md`», pero es el propio documento revisado, que ya está aprobado. | Actualizar la referencia. |
| C16 | Línea 13 frente a Goal 8 (90) | «2 días de unas 12 horas» se puede leer como 12 horas en total. | Escribir «2 días, unas 24 horas de trabajo». |

## Coincidencias con la etapa 5

- **C5** coincide con **Z7** (línea 258), **C6** y **C15** con **N9**, y **C9** con **N2** (`zoom_out_report.md`).
- **C2** afecta a **N7** (contraseña que consume un aviso del guion): conviene resolver los dos juntos.
- **C3** coincide en parte con **Z7** (referencias al brief).
