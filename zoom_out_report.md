# Etapa 5: Zoom Out inicial

* **Documento revisado:** `docs/designs/emergency_triage.md` (líneas 1-1377)
* **Revisores:** `egm-zoom-out` (simplicidad y alcance) y `egm-inventive-catalyst` (contradicciones de diseño), cada uno sin contexto previo.
* **Estándar:** `zoom-out-standard.md`
* **GoldfishContext:** ninguno
* **Fecha:** 2026-11-18

## Veredicto

No hay bloqueantes. Los dos revisores coinciden en que el documento explica qué construye y por qué, y en que la base del diseño es sólida:
- el dominio en funciones puras;
- `report.incidentId` como única fuente de verdad;
- la elegibilidad decidida por código;
- el servidor sin estado;
- el contexto completo del edificio.

Los problemas principales son cinco:
1. lógica de elegibilidad duplicada, presentada como una frontera de confianza que no existe;
2. un SSR que cuesta configuración y aporta poco;
3. dos caminos de fallo de la demo (cascada de 429 y modo sin API solo con el tablero vacío);
4. corregir una agrupación errónea solo se puede hacer descartando, lo que destruye el incidente;
5. una puerta de la fase 4 sin salida si el modelo no converge.

Las referencias de línea son aproximadas.

## Hallazgos

### 🟡 Z1. La elegibilidad se aplica en dos capas y la frontera de confianza del servidor no existe

*Lo señalan los dos revisores (zoom-out M1 e inventive N5).*

- **Dónde:** Technical Plan §3 «Elegibilidad» (~426-438), §4 pasos 3 y 6 (~455, ~465-472), §6 `applyDecision` (~524-534); archivos 16, 19 y 26.
- **Problema:** `canJoin`/`canRelate` y la conversión «agrupar → crear, quizá relacionado» se ejecutan dos veces:
  - en `sanitize.ts`, en el servidor, sobre la foto que envía el cliente;
  - en `applyDecision`, en el cliente, sobre el estado actual.

  La regla de mismo edificio y misma planta se comprueba en cinco sitios. El documento dice que los indicadores «no vienen del cliente, los calcula el servidor», pero el servidor no tiene estado y los calcula con datos que le envía el cliente. No hay ninguna frontera de seguridad.
- **Escenario de fallo:**
  - En la entrevista preguntan por qué se calcula en el servidor si los datos vienen del cliente, y la respuesta tiene que admitir que no añade seguridad.
  - Las dos rutas de conversión pueden divergir. Entonces la misma respuesta de la IA da resultados distintos en `check-burst` (que pasa por el saneado) y en la interfaz.
  - Cada regla necesita además dos juegos de tests.
- **Propuesta:**
  - En el saneado del servidor, dejar solo la integridad referencial: alias desconocido → `null` o `invalid_ref`, y traducción de alias a ID.
  - Hacer de `applyDecision` el único lugar donde se aplica la elegibilidad, con el estado actual.
  - Calcular los indicadores para el prompt donde sea cómodo, por ejemplo en `buildTriageInput`.
  - Describir la validación del servidor como validación de forma, no como autoridad.

### 🟡 Z2. El SSR añade configuración de hidratación para casi nada

*Lo señalan los dos revisores (zoom-out M2 e inventive N6).*

- **Dónde:** §1 loader (~305), §7 «Persistencia y SSR» (~563-575); archivos 37, 40 y 41.
- **Problema:** todas las zonas con estado van en `ClientOnly`, así que el SSR solo pinta la cabecera y las columnas vacías. A cambio hacen falta `skipHydration`, `StoreHydrator`, un indicador `hydrated`, esqueletos de carga, una cola que espera a la hidratación y un loader que devuelve constantes que se podrían importar directamente.
- **Escenario de fallo:** avisos de hidratación, o un `hydrated` que se queda en `false`, consumen la 1,5 h de la fase 5, a cambio de una cabecera pintada en el servidor que nadie va a notar.
- **Propuesta:** si el enunciado no exige SSR, poner `ssr: false` en la ruta `/` (o usar el modo SPA), importar las constantes y eliminar el loader, `ClientOnly`, `StoreHydrator` y `skipHydration`. Si el SSR es obligatorio, decirlo en el Overview y justificarlo en una línea.

### 🟡 Z3. Un 429 se trata como fallo de un aviso y la cola sigue, lo que lo convierte en una cascada

*Inventive, hallazgo 2.*

- **Dónde:** Goal 4 (~83-84), CUJ 7 (~221-227), `drain()` (~588-592), `rate-limit.ts` (~454, ~1108-1111).
- **Problema:** un `rate_limit` no es un fallo de ese aviso, es una señal de que el canal está saturado. Tras dos 429 en S5, la cola manda S6 de inmediato contra el mismo límite. Además, el limitador propio del servidor usa una ventana fija de 60 s, así que el reintento a los 2 s siempre falla.
- **Escenario de fallo:**
  - De S5 a S9 todos acaban en `error: rate_limit` y el tablero se queda en 3 incidentes en lugar de 5.
  - Los reintentos van al final de la cola, de modo que S6 (grupo B) se evalúa después de S7 y S8, fuera del orden del guion.
- **Propuesta:**
  - Tratar `rate_limit` (y quizá `timeout`) como una señal de la cola: se pausa la cola, el aviso sigue `queued` al principio, se muestra una cuenta atrás y se reanuda cuando pasa el tiempo indicado por el servidor (`retryAfterMs`).
  - Dejar el error por aviso con «Reintentar» solo para los fallos que de verdad son de un aviso (`invalid_output`, `invalid_ref`).
  - Poner un límite de pausas para que un Gateway caído no bloquee la demo para siempre.

### 🟡 Z4. El modo sin API solo funciona con el tablero vacío, aunque el diseño ya sabe recuperarse a mitad de ráfaga

*Inventive, hallazgo 3.*

- **Dónde:** Goal 4 (~85), CUJ 8 (~229-237), Alternativa T (~768-772), interruptor (~609), crédito agotado (~636).
- **Problema:** la Alternativa T rechaza el cambio de modo a mitad de ráfaga porque las respuestas pregrabadas «solo son coherentes con un tablero que sigue el guion desde el principio». Sin embargo:
  - `FallbackEngine` ya resuelve los avisos ancla contra el estado actual;
  - `applyDecision` ya convierte un destino obsoleto o no elegible en «crear».
- **Escenario de fallo:** en S6 se agota el crédito o cae el proveedor. Ese error probablemente se clasifica como `server`, un caso que el documento no cubre, y todos los avisos restantes fallan. La única salida es reiniciar delante del evaluador, que es justo lo que el Goal 4 quiere evitar.
- **Propuesta:**
  - En modo IA, si un aviso del guion falla tras su reintento con `rate_limit`, `timeout`, `server` o `network`, se usa la respuesta pregrabada de ese aviso y se aplica con la etiqueta «Sin API».
  - Opcionalmente, permitir el interruptor siempre que la cola esté parada, no solo con el tablero vacío.
  - Coste: un test (la IA falla en S6, la respuesta pregrabada toma el relevo, los grupos finales coinciden). En el README hay que admitir que el tablero puede mezclar resultados del modelo y pregrabados.

### 🟡 Z5. «Ante la duda, separar» se apoya en que no se puede deshacer, y la única corrección destruye el incidente

*Inventive, hallazgo 1.*

- **Dónde:** Política de agrupación, regla 3 (~115); Non-Goals, fusión manual (~149); riesgos de The Problem (~43-46); Future Improvements (~798).
- **Problema:** la política sacrifica un riesgo (separar de más) para proteger otro (mezclar). El motivo no viene del dominio: es que «Separar aviso» está fuera del alcance.
- **Escenario de fallo:** en directo, el modelo agrupa S8 (desmayo) con A (fuego). El operador solo puede descartar A, y eso:
  - marca un incendio real como «propuesta no aprobada»;
  - hace que los avisos de humo siguientes creen un incidente sin relación, porque un incidente descartado no es elegible para nada;
  - entierra la historia de S1, S2, S4 y S7.
- **Propuesta:** añadir `detachReport(state, reportId, …)`, solo para incidentes `pending`. Pone `report.incidentId = null`, devuelve el aviso a la cola y excluye el incidente de origen en esa llamada. No hace falta un contrato nuevo con la IA.
  - Coste: 1-1,5 h y unos 4 tests.
  - Hay que decidir qué pasa si es el último aviso del incidente (invariante 3): prohibirlo, o borrar el incidente vacío.
  - Si no hay tiempo, al menos documentar la corrección como «descartar y reenviar» y admitir en el README que se pierde la historia.

### 🟡 Z6. La categoría dinámica depende de una pregunta abierta que el documento llama «sin impacto en el código»

*Zoom-out, M3.*

- **Dónde:** Open Questions (~167-171) frente a la decisión 9 (~31), §3 «Categoría al agrupar», CUJ 6, fase 7 y archivos 17 y 47.
- **Problema:** si el enunciado aceptara categorías fijas, se gastarían 2-3 h y toda una fuente de variabilidad de la IA (el nombre de S9) en una funcionalidad especulativa. Llamar a esa pregunta «sin impacto en el código» es falso.
- **Propuesta:** resolver la pregunta antes de implementar, o convertir las categorías dinámicas en una fase opcional que se pueda recortar. En cualquier caso, quitar «sin impacto en el código».

### 🟡 Z7. El documento se declara vigente, pero cita identificadores que solo existen en el brief histórico

*Zoom-out, M4.*

- **Dónde:** tabla de decisiones (~21-31), ~521 («ADR-20»), ~640; línea ~258 («La comunicación sigue tal como estaba definida»).
- **Problema:** M8, ADR-22, B1/B2, ADR-17, ADR-24, ADR-20 y M4 no se explican en el documento. La línea ~258 es un resto de la conversación de redacción y no tiene sentido leída sola.
- **Propuesta:** explicar en una línea cada referencia donde se usa, o quitarla. Reescribir la línea ~258 como una afirmación directa.

### 🟡 Z8. La puerta de la fase 4 no tiene salida

*Zoom-out, M5.*

- **Dónde:** fase 4 (~815), Goal 1 (~143), riesgo de S8 (~967).
- **Problema:** la fase 4 exige que `check-burst` termine en verde con el modelo real, y la norma es «se ajusta el prompt, nunca el texto». La salida del modelo no es estable ni con temperatura 0. La fase 0 tiene un plan B; la fase 4, no.
- **Escenario de fallo:** tras 1,5 h, S8 sigue agrupándose con A una de cada tres veces y el margen se consume ajustando el prompt.
- **Propuesta:**
  - Fijar un tiempo máximo y una salida: cambiar al otro modelo candidato, aceptar una desviación documentada del guion, o usar el modo sin API como camino principal de la ráfaga y la IA real solo para los avisos manuales.
  - Exigir varias ejecuciones seguidas en verde, no una sola.

### 🟢 Nits

| # | Hallazgo | Dónde | Propuesta |
|---|---|---|---|
| N1 | El limitador en memoria por instancia apenas protege en serverless y además provoca Z3. | §4 paso 2, archivo 30 | Quitarlo y llevarlo a Future Improvements, o asegurarse de que no se dispara en los ensayos. |
| N2 | El recorte priorizado del contexto (30/150) protege un caso que la demo no alcanza. | ~438, archivo 18, test 54 | Mantener el límite estricto en el servidor y quitar el recorte del cliente. |
| N3 | Cambios de altitud: el pseudocódigo de `drain()`, la configuración de Zustand opción a opción y los detalles de comparación en tiempo constante están en el Technical Plan. | §4, §7, §8 | Describirlos como contrato en el Technical Plan y dejar los detalles en los archivos 29, 34 y 35. |
| N4 | `summaryLockedAtReportCount` y su indicador son un detalle de interfaz especulativo para 24 h. | modelo ~344, test 53 | Marcarlo como opcional. |
| N5 | `applyDecision` devuelve estado más `createdCategory`, pero el store dice que toda acción es `set(s => domainFn(s))`. | ~559, archivos 19 y 50 | Decir explícitamente que la cola llama a `applyDecision` fuera de `set` y gestiona el toast. |
| N6 | Un fallo de validación de entrada en el servidor se convierte en `error: server`, y «Reintentar» nunca lo arreglará. | ~453 | Usar `invalid_input` o documentar que no se puede reintentar. |
| N7 | Una contraseña incorrecta consume un aviso del guion (S1, el ancla de A). Tampoco está claro cuándo se abre el diálogo. | ~628-633, archivos 35 y 43 | Pedir y comprobar la contraseña antes de encolar la ráfaga, y ante `unauthorized` devolver el aviso a `queued`, no a `error`. |
| N8 | Una sola cola global es más estricta de lo necesario; bastaría ordenar por edificio. | Alternativa B, §8 | No construirlo. Prepararlo como respuesta para la pregunta de producción. |
| N9 | Incoherencias: estado «Approved» con preguntas abiertas; el prompt dice «cinco partes» y lista siete; «alternativas N a S» cuando también existe la T; el archivo 61 se refiere a sí mismo como copia de `design_draft.md`. | ~4, ~401, ~640, ~1351 | Corregir el texto. |

## Valoración del Elephant (contexto que los revisores no tenían)

Los revisores no recibieron el historial de decisiones. Hay dos hallazgos que ese historial matiza:

- **Z2 (SSR):** el stack que pediste incluye «TanStack Start con SSR» de forma explícita. La propuesta de `ssr: false` choca con un requisito del enunciado, no solo con una preferencia. Hay una parte del hallazgo que sí se sostiene sin depender de eso: la configuración de hidratación es un riesgo de calendario real.
- **Z6 (categorías dinámicas):** tu lista inicial de requisitos incluía «Propuesta de categorías nuevas» y «Aprobación humana de categorías nuevas». La funcionalidad no es especulativa. Lo que sí es cierto es que la pregunta abierta sobre el enunciado está mal descrita como «sin impacto en el código».

Los hallazgos que más afectan a la demo en directo son **Z3 y Z4**. Los dos describen el mismo escenario: la IA falla a mitad de la ráfaga delante del evaluador. Por eso tienen más peso que el resto.
