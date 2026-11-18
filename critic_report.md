# Etapa 7: Critic Review (ronda 1)

* **Documento revisado:** `docs/designs/emergency_triage.md`, FeatureRange (líneas 1-804)
* **Revisores:**
  * `egm-design`, con `feature-spec-standard`: **completado**
  * `egm-structural`, con `feature-spec-standard`: **completado**
  * `egm-style`, sin estándar: **completado**
* **GoldfishContext:** ninguno
* **Fecha:** 2026-11-18

## Veredicto

Ningún revisor encuentra bloqueantes, pero los tres coinciden en que el documento todavía no pasa. Entre los hallazgos importantes destacan:
- **cuatro defectos de comportamiento reales** en la cola y en el modo sin API (K1 a K4), que ninguna etapa anterior había detectado;
- la falta de una sección de **riesgos y mitigaciones**, que el estándar exige;
- varias **afirmaciones absolutas** que el código no respalda.

Las referencias de línea son aproximadas. Cada hallazgo indica qué revisor lo planteó (D = diseño, S = estructura, E = estilo) y si coincide con hallazgos de las etapas 5 (Z) o 6 (C).

## Hallazgos importantes (🟡)

### Defectos de comportamiento

**K1. La cola se bloquea tras «Reiniciar demo» seguido de una ráfaga nueva** *(D-M1)*
- **Dónde:** §8 `drain()` (~582-598), CUJ 9 (~243).
- **Escenario:**
  1. El operador pulsa «Reiniciar» con una llamada en curso y, enseguida, «Simular ráfaga».
  2. El nuevo `drain()` no hace nada, porque `running` sigue activo.
  3. Cuando llega la respuesta antigua, el `drain()` viejo ve que el `runId` no coincide y **sale**.
  4. Nadie vuelve a llamar a `drain()`: los 9 avisos nuevos se quedan `queued` para siempre.

  Es justo la secuencia que ocurre en una demo en directo.
- **Propuesta:** ante un `runId` distinto, descartar el resultado y **continuar** el bucle con el estado actual en lugar de salir. Añadir un test: reinicio durante una llamada y después ráfaga nueva.

**K2. `unauthorized`: el pseudocódigo y la sección de seguridad se contradicen** *(D-M2; coincide con C2 y Z-N7)*
- **Dónde:** §8 (~588-592) frente a §10 (~629-633).
- **Problema:** el pseudocódigo marca el error y sigue; §10 dice que la cola se pausa. Además, no se define:
  - en qué estado queda el aviso rechazado;
  - cómo se reanuda la cola;
  - cuándo se pide la contraseña la primera vez.

  Con el pseudocódigo actual, una contraseña errónea consume S1, el aviso ancla del grupo A.
- **Propuesta:**
  - Pedir la contraseña antes de la primera llamada en modo IA.
  - Ante `unauthorized`, devolver el aviso a `queued` al principio de la cola (no a `error`), pausar la cola y reanudarla al introducir la contraseña.
  - Añadir esa rama al pseudocódigo.

**K3. Un `join` que acaba en `create` hereda un resumen y una gravedad escritos para otro incidente** *(D-M3)*
- **Dónde:** §3 «Categoría al agrupar» (~392-399), saneado (~466-467), `applyDecision` (~531-534).
- **Problema:** en un `join`, la IA escribe el resumen, la gravedad, la categoría y el motivo pensando en el incidente consolidado. Si el saneado o `applyDecision` lo convierten en `create`, el incidente nuevo tiene un solo aviso pero hereda un resumen del tipo «4 avisos de humo en la planta 2» y una gravedad basada en avisos de otro incidente. Es justo lo que ve el operador en el CUJ 4.
- **Propuesta (elegir una opción):**
  - (a) en la conversión se conservan solo la categoría y el protocolo; el resumen pasa a ser el texto del aviso, la gravedad la de la rúbrica para ese aviso, y el motivo «Reasignado: el incidente destino ya no admitía avisos»;
  - (b) el aviso se vuelve a procesar automáticamente con el estado actual;
  - (c) se acepta el riesgo y se documenta.

**K4. El modo sin API no es determinista si se reintenta un aviso ancla** *(D-M4)*
- **Dónde:** §5 (~512-515), §7 (~573), §8 (~597), Goal 1 (~76).
- **Problema:** si se recarga la página durante una ráfaga en modo sin API, los avisos pasan a `interrupted`, y «Reintentar» los manda al final de la cola. Si S1 se reintenta después de S2, la búsqueda de S2 («unirse al incidente del aviso S1») encuentra `incidentId = null`. Ese caso no está definido.
- **Propuesta:** si el aviso ancla no tiene incidente, la respuesta pregrabada se convierte en `create`. Alternativa: en modo sin API, una recarga vacía el tablero y la ráfaga se repite.

### Contenido que falta

**K5. No hay sección de riesgos y mitigaciones** *(S-M1, D-M5)*
- **Problema:** el estándar la exige. Los riesgos están repartidos entre Non-Goals, Seguridad, NFR y las alternativas, y algunos ni aparecen:
  - el modelo se desvía del guion en directo;
  - el crédito del Gateway se agota o no existe;
  - los límites de Vercel Hobby;
  - la inyección de prompt;
  - el calendario de 24 h, sin una lista de qué recortar;
  - el limitador por instancia;
  - una agrupación errónea que no se puede deshacer;
  - cambios en la API de los proveedores.
- **Propuesta:** una H2 «Riesgos y mitigaciones», con una tabla de riesgo, impacto, mitigación y riesgo residual que enlace a las secciones existentes.

**K6. La coherencia de la IA en directo se da por supuesta, no se demuestra** *(D-M6; coincide con Z8)*
- **Problema:** el CUJ 1 exige los 5 incidentes en directo, pero solo se comprueba una vez antes de la entrevista. Temperatura 0 no garantiza que el resultado sea siempre el mismo, y el grupo C es el caso más inestable.
- **Propuesta:**
  - Ejecutar la ráfaga varias veces (5-10) antes de la entrevista y anotar cuántas coinciden.
  - Fijar una versión exacta del modelo en `TRIAGE_MODEL`.
  - Documentar qué hacer si el resultado en directo diverge. Esto enlaza con Z3 y Z4 de la etapa 5.

**K7. La contraseña se puede probar sin límite** *(D-M7)*
- **Problema:** el paso 0 (contraseña) va antes del paso 2 (límite de peticiones), así que los intentos fallidos no se cuentan.
- **Propuesta:** aplicar el límite antes de comprobar la contraseña (o contar también los fallos), añadir un retardo tras un fallo y exigir una longitud mínima. Cambiar la contraseña después de la entrevista.

**K8. El timeout de 15 s puede ser mayor que la duración máxima de la función en Vercel** *(D-M8)*
- **Problema:** si Vercel corta la función antes, el cliente recibe un error de plataforma que se clasifica como `network` o `server`, no como `timeout`.
- **Propuesta:** fijar `maxDuration` explícitamente, añadirlo a las comprobaciones del día 1 y dejar el timeout de la IA por debajo con margen.

### Afirmaciones mal calibradas

**K9. «La IA no inventa ubicaciones» y «La IA nunca inventa referencias» prometen más de lo que el código comprueba** *(E-M2, D-M9)*
- **Dónde:** ~64, ~78, ~302.
- **Problema:** el código solo comprueba las referencias (`protocolRef` y los alias). El resumen y el motivo son texto libre sin verificar, y el modelo puede escribir en ellos «evacuar por la escalera B».
- **Propuesta:** describir la garantía por lo que impone el código:
  - «Ninguna referencia inventada llega al estado»;
  - «Las ubicaciones del protocolo salen solo de los datos maestros»;
  - «El texto libre no se verifica».

  En la tarjeta, mostrar el resumen como «Texto generado por IA».

**K10. El crédito gratuito del Gateway aparece como un hecho en un sitio y como pendiente de verificar en otro** *(E-M3)*
- **Dónde:** ~88, ~636 frente a ~766.
- **Propuesta:** añadir «pendiente de verificar el día 1» en las tres menciones, o presentar el modo sin API como la garantía de coste.

**K11. Límites descritos como «acotados» sin valor** *(E-M7, D-N4)*
- **Dónde:** «tamaño total acotado» (~438, ~451), «`maxOutputTokens` acotado» (~460), «salida acotada» (~785).
- **Propuesta:** dar los valores (por ejemplo, 256 KB de entrada y 800 tokens de salida, como ya dice el archivo 28), o decir dónde se fijan.

**K12. Tests descritos en presente, como si ya existieran** *(E-M8)*
- **Dónde:** ~78, ~94, ~474.
- **Propuesta:** «debe tener» en lugar de «hay» o «tiene».

**K13. «Algunos proveedores no admiten uniones» y «la respuesta fallaría siempre», sin respaldo** *(E-M9)*
- **Dónde:** ~369, ~729.
- **Propuesta:** limitarlo a «puede fallar con proveedores cuya salida estructurada no admite uniones de tipos; se comprueba el día 1».

### Organización y coherencia interna

**K14. Hay material de diseño técnico dentro de Goals** *(S-M2)*
- **Dónde:** las invariantes, la política de agrupación y la tabla de alias (~92-129).
- **Problema:** son diseño técnico. La tabla de alias, en concreto, separa el contrato con la IA en dos secciones.
- **Propuesta:** moverlas al Technical Plan y dejar en Goals solo el guion como criterio de aceptación.

**K15. Afirmaciones contradictorias entre secciones** *(E-M1, E-M4, E-M5, E-M6, S-N1, S-N10, D-N2, D-N10; coincide con Z7, C5, C6 y C8)*
- El prompt tiene «cinco partes» pero se enumeran siete (~401).
- El guion aparece como «Propuesta» (~133) y a la vez como pregunta resuelta (~165).
- «Separar aviso» aparece con tres estados distintos (~115, ~149, ~798).
- La línea ~258 remite a una versión anterior del documento.
- **Propuesta:** corregir cada una en su sitio.

## Hallazgos que el Elephant propone rebatir

**R1. «Rejected by author» incumple el estándar** *(S-N3, D-M10a)*

Los dos revisores leen que la regla prohíbe atribuir rechazos a una persona sin enlace. La regla del estándar y de la plantilla EGM prohíbe atribuirlos a un **mantenedor** externo sin enlace. «Rejected by author» es la fórmula que la propia plantilla pide para las decisiones del autor. Propuesta: mantenerlo y quitar solo «(propuesto en la revisión Goldfish)» de la alternativa H, que es jerga del proceso (E-N2).

**R2. Falta la alternativa SSR frente a SPA** *(D-M10b; coincide con Z2)*

El stack («TanStack Start con SSR») es un requisito del enunciado de la prueba, no una elección de diseño. El hallazgo sí acierta en que el documento no lo dice. Propuesta: añadir una línea en el Overview («el stack, incluido el SSR, viene fijado por el enunciado») y una alternativa breve «SPA sin SSR, rechazada porque el enunciado exige SSR», con su coste de hidratación como inconveniente aceptado.

## Hallazgos menores (🟢)

| # | Hallazgo | Revisor | Propuesta |
|---|---|---|---|
| n1 | Las dos firmas de `applyDecision` no coinciden (~521 frente a ~591): el pseudocódigo no pasa `engine` ni los IDs nuevos. | S-N8 | Alinear el pseudocódigo. |
| n2 | `rationale` se bloquea con el resumen; el motivo puede no corresponder al cambio de gravedad o de protocolo. | D-N7, C10 | Actualizar `rationale` siempre. |
| n3 | `newCategoryName` no tiene longitud máxima. Con la categoría bloqueada, no se dice si se crea igualmente una categoría huérfana. | D-N6 | Máximo 40 caracteres; con la categoría bloqueada, no se crea. |
| n4 | `approveCategory` está bajo «todas rechazan los incidentes no pending». No se dice si «Aprobar categoría» aparece en las tarjetas finales. | D-N8 | Separar `approveCategory`; el botón solo aparece en `Pendiente`; aprobar no modifica los incidentes, solo la categoría. |
| n5 | `schemaVersion` en el texto, pero Zustand guarda `version`. | D-N9 | Aclararlo en una línea. |
| n6 | Una entrada inválida devuelve `error: server`. | D-N5, Z-N6 | Usar `invalid_input` (no reintentable). |
| n7 | «Status: Approved» durante la revisión. | S-N4, D-N1, Z-N9 | «In Review». |
| n8 | El orden de las alternativas (A-G, N-S, H-M, T) y la frase «N a S» no cuadran. | S-N2, E-N3, D-N3 | Ordenar por tema y decir que T también es nueva. |
| n9 | «Future Improvements» está dentro de NFR. «The Problem» contiene la solución y repite «El problema». | S-N5, S-N6, E-N11 | Ajustar los encabezados. |
| n10 | Open Questions está en mitad del documento. | S-N9 | Mantenerlo (la plantilla EGM lo sitúa ahí). **Rebatir.** |
| n11 | Etiquetas en negrita usadas como encabezados en §3. | S-N11 | Convertirlas en H5. |
| n12 | Mezcla de `*` y `-` en las listas, separadores irregulares y lista numerada desde 0. | S-N12 | Unificar. |
| n13 | No hay hipervínculos a `concepts_brief.md`. | S-N13 | Añadir enlace relativo. |
| n14 | Repeticiones: «validar no ejecuta» (6 veces), «decisión de diseño, no requisito» (3), sustitución de M8 (3). | E-N6, E-N7, E-N8 | Dejar una mención y una referencia. |
| n15 | Lenguaje coloquial o subjetivo: «no se cae del todo», «fácil de testear», «control total», «explícitamente», «a propósito». | E-N1, E-N5, E-N9 | Reescribir. |
| n16 | Afirmaciones sin respaldo: «el código generado con asistentes es menos fiable», «un único reintento basta». | E-N4 | Matizarlas. |
| n17 | «2 días de unas 12 horas» es ambiguo. | E-N10, C16 | «2 días, unas 24 horas de trabajo». |
| n18 | No hay estimación de tokens que respalde «coste 0 €». | D-N10 | Añadir una estimación aproximada tras medirlo el día 1. |

## Estado de la ronda

- Ronda 1: **no limpia** (hay hallazgos importantes sin resolver).
- Para que la etapa converja hacen falta dos rondas limpias seguidas, con un máximo de 5 rondas. En `egm-review`, cada etapa admite como máximo una repetición de la auditoría.
