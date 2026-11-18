# Etapa 7: Critic Review (ronda 2, única repetición permitida)

* **Documento revisado:** `docs/designs/emergency_triage.md`, FeatureRange (líneas 1-991)
* **Revisores:**
  * `egm-design`: **completado**. 0 bloqueantes, 7 importantes, 9 menores.
  * `egm-structural`: **completado**. 0 bloqueantes, 0 importantes, 10 menores. La estructura pasa.
  * `egm-style`: **completado**. 0 bloqueantes, 3 importantes, 7 menores.
* **Estado de la ronda:** **no limpia** (10 hallazgos importantes sin resolver).
* **Repeticiones disponibles:** **ninguna**. La etapa 7 ya usó su única repetición. Los hallazgos de esta ronda pueden resolverse sin volver a auditar; la etapa 8 vuelve a revisar el documento completo.
* **Ronda 1:** `critic_report.md`.

## Lo que se considera resuelto

Ningún revisor vuelve a plantear K1 a K15, R1 ni R2. La revisión de estructura confirma:
- todas las secciones obligatorias, incluida la de riesgos;
- el orden de la plantilla;
- los 11 CUJ en formato Given/When/Then;
- las 23 alternativas con «Rejected by author» bien usado;
- referencias cruzadas que resuelven.

## Hallazgos importantes (🟡)

### Cola y política de reintentos (introducidos en la segunda pasada)

**K16. Un «Reiniciar» durante una espera provoca otra llamada a la IA por un aviso que ya no existe** *(D-M1)*
- **Dónde:** §8, `proponerConPolitica`.
- **Problema:** el `runId` solo se comprueba después de `propose()`. Tras una espera por 429 o los 2 s de reintento, se llama a `buildTriageInput` con un aviso borrado. El resultado es un comportamiento indefinido y una llamada real al proveedor, y la ráfaga nueva queda esperando detrás.
- **Propuesta:** comprobar el `runId` después de cada espera y antes de cada `propose`, y devolver «descartado» sin llamar al motor. Añadir un test.

**K17. «Procesando» frente a «En cola» durante una espera por 429** *(D-M6)*
- **Problema:** el CUJ 7 dice «sigue En cola», pero el pseudocódigo ya ha marcado el aviso como `processing`.
- **Propuesta:** aceptar «Procesando» con la cuenta atrás al lado y corregir el CUJ 7, o definir un subestado.

**K18. El peor caso de espera está infravalorado y no tiene límite por ráfaga** *(D-M7, E-M3)*
- **Problema:** dos esperas de hasta 10 s **por aviso**, más el camino de `timeout` (15 + 2 + 15 s), dan hasta unos 3 minutos sin activar el respaldo. R3 habla de «20 s».
- **Propuesta:** un presupuesto de espera por ráfaga (por ejemplo, 20 s acumulados), a partir del cual se activa el respaldo; o corregir R3 y NFR con el peor caso real.

### Orden, etiquetas y relación

**K19. Los 9 avisos de la ráfaga se encolan en el mismo milisegundo, sin desempate** *(D-M2)*
- **Problema:** `queueOrder`, `reportsOf` e `incidentLabel` ordenan por marcas de tiempo que pueden empatar. El determinismo del modo sin API depende de ese orden. Además, el CUJ 1 dice «aparecen uno a uno», pero aparecerían los 9 a la vez como «En cola».
- **Propuesta:** un número de secuencia creciente (`seq`) como desempate en los tres órdenes, y aclarar en el Goal 1 y el CUJ 1 que se *procesan* uno a uno.

**K20. No se define de dónde sale `Incident.createdAt`, así que `INC-n` puede cambiar** *(D-M3)*
- **Problema:** `applyDecision` no recibe la hora. Si se toma la del aviso, un aviso reintentado puede crear un incidente que se ordena antes que los existentes y desplaza todas las etiquetas. Además, el texto «no se pudo unir a INC-n» queda guardado y pasaría a apuntar a otra tarjeta.
- **Propuesta:** guardar en el incidente un número de etiqueta estable al crearlo (`seq`) y pasar `now` a `applyDecision`.

**K21. El servidor no puede escribir «INC-n» en `convertJoinToCreate`** *(D-M4)*
- **Problema:** la etiqueta se calcula en el cliente con todo el tablero. Con un alias inventado, ni siquiera hay destino.
- **Propuesta:** que la función reciba un motivo estructurado (`reassignReason`) y que el cliente forme el texto en `applyDecision`; definir el texto para «destino desconocido».

**K22. No se define qué hace un `join` con `relatedRef`** *(D-M5)*
- **Problema:** ¿sobrescribe la relación que ya tenía el destino? ¿`canRelate` se comprueba frente al aviso o frente al incidente?
- **Propuesta:** una regla clara (por ejemplo, en un `join` la relación solo se rellena si el destino no tenía; nunca se borra) y su test.

### Afirmaciones mal calibradas

**K23. «Las ubicaciones que muestra la tarjeta salen solo de los datos maestros» cubre más de lo que se garantiza** *(E-M1)*
- **Dónde:** ~65, ~340.
- **Propuesta:** limitarlo al bloque del protocolo.

**K24. «Nunca se relacionen de forma automática» es más amplio que la regla que lo sostiene** *(E-M2)*
- **Dónde:** ~499.
- **Problema:** frente a un incidente `validated` de la misma planta, solo lo evita el prompt.
- **Propuesta:** decirlo así.

## Hallazgos menores (🟢)

| # | Hallazgo | Revisor |
|---|---|---|
| m1 | Sin `DEMO_PASSWORD` válida en el servidor se devuelve `unauthorized`, y el diálogo pediría la contraseña sin fin. Debería ser un error de configuración (`server`). | D-N2 |
| m2 | El formulario se puede usar antes de `hydrated`; un aviso enviado en ese momento podría perderse. | D-N3 |
| m3 | El pseudocódigo nunca devuelve `burstFallback` a `null`. | D-N4 |
| m4 | El límite global por instancia permite que cualquiera con la URL agote las 20 peticiones por minuto y fuerce el respaldo; falta en R7. | D-N5 |
| m5 | No se dice si «Simular ráfaga» se desactiva mientras hay una ráfaga en curso, aunque `burstFallback` solo admite una ráfaga. | D-N6 |
| m6 | No se dice si el recorte de contexto es por incidente o por aviso; el recorte 2 de R11 provoca `invalid_input` permanente en edificios grandes. | D-N7 |
| m7 | Las reglas entre campos no cubren `create` con `targetRef` distinto de `null`. | D-N8 |
| m8 | El Goal 1 no dice cuántas de las 5 ejecuciones deben pasar; no hay estimación en USD por ráfaga. | D-N1, D-N9 |
| m9 | El encabezado «Riesgos y mitigaciones» está en español mientras las demás H2 de la plantilla están en inglés; R13 aparece entre R3 y R4; las letras de las alternativas no siguen el mismo orden en cada grupo. | S-1, S-2, S-3 |
| m10 | Faltan separadores `---` de la plantilla; Future Improvements es H2; falta Additional Resources. | S-4, S-5 |
| m11 | Open Questions incluye una lista de preguntas resueltas y una única pregunta que es preparación de la entrevista. | S-6 |
| m12 | La tabla de decisiones hace pesado el Overview. | S-7 |
| m13 | Los CUJ 3, 5 y 6 no usan viñetas en «Then»; marcadores de lista mezclados. | S-8 |
| m14 | Los motivos de rechazo de E, H e I repiten la opción elegida en lugar de dar la razón. | S-9 |
| m15 | Status con nota; «hoja de ruta» frente a Future Improvements; «Alternativa M» frente a «Alternative M»; dos formas de la marca «FICTICIO». | S-10 |
| m16 | Redacción: «el código garantiza… no solo el prompt», «visualmente cuidado», «el mismo resultado visual», «no debería ocurrir», frase sobre la entrevista, «mucho más después», «perder información es peor». | E-N1 a E-N7 |

## Valoración del Elephant

- **K16 a K18** son defectos de la segunda pasada: el respaldo y la pausa por 429 añadieron caminos de espera que no se protegieron frente al reinicio ni se acotaron por ráfaga. **K16 es el más serio**, porque produce llamadas reales tras un reinicio, justo en la secuencia del CUJ 9.
- **K19 y K20** afectan a la promesa central del modo sin API («determinista para el mismo orden»). Se resuelven con un único número de secuencia creciente que sirva para tres cosas: desempatar la cola, ordenar los avisos y dar a los incidentes una etiqueta estable.
- **K21 y K22** son huecos de especificación que Claude Code tendría que decidir solo.
- Los menores m9 a m15 son de forma y no bloquean.

## Resolución: simplificación del diseño (decisión del autor)

El autor cambió el criterio: prioridad a un MVP pequeño, completo y demostrable. El documento se reescribió (de unas 1.600 a unas 750 líneas). Así quedan los hallazgos de esta ronda:

| Hallazgo | Estado |
|---|---|
| K16, K17, K18 | **Desaparecen:** no hay reintentos automáticos, pausas por 429 ni respaldo automático; «Reiniciar» está desactivado mientras la cola procesa, así que no hace falta `runId`. |
| K19, K20 | **Resueltos:** contador `seq` para avisos y `number` estable para incidentes (`INC-n`), ambos en el estado. |
| K21 | **Resuelto:** el servidor solo traduce alias (un `targetRef` desconocido pasa a `null`); la conversión a «crear» y su texto se hacen solo en `applyDecision`, sin `INC-n`. |
| K22 | **Resuelto:** un `join` no cambia la relación del destino; `relatedRef` solo se usa con `create`. |
| K23, K24 | **Resueltos:** la garantía se limita al bloque de protocolo; la regla de relación dice qué depende del prompt. |
| m1 | Resuelto: una contraseña mal configurada en el servidor devuelve `server`. |
| m2, m3 | Desaparecen (sin hidratación especial ni `burstFallback`). |
| m4 | Documentado en R6. |
| m5 | Resuelto: «Simular ráfaga» está desactivado mientras la cola procesa. |
| m6 | Sin recorte en el cliente; el límite del servidor queda como limitación conocida. |
| m7 | Resuelto: `targetRef` se ignora con `create`. |
| m8 a m16 | Resueltos o eliminados con la reescritura (encabezado «Risks & Mitigations», Open Questions sin preguntas resueltas, alternativas reducidas y ordenadas, Overview más corto). |

Esta resolución no se ha vuelto a auditar en la etapa 7 (no quedan repeticiones). La etapa 8 revisa el documento completo.
