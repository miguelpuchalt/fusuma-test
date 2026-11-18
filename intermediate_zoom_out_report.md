# Etapa 8: Zoom Out intermedio

* **Documento revisado:** `docs/designs/emergency_triage.md`, documento completo (755 líneas), versión simplificada.
* **Revisor:** `egm-zoom-out` (Goldfish, sin contexto previo). Usó `zoom_out_report.md` (etapa 5) solo para no repetir hallazgos.
* **Criterios aplicados (del autor):**
  * solo es bloqueante lo que impide un requisito obligatorio o el recorrido esencial de la demo;
  * cada hallazgo se etiqueta como defecto real, mejora opcional o preferencia;
  * no se reincorporan persistencia, reintentos automáticos ni concurrencia;
  * se aceptan las limitaciones ya documentadas;
  * siempre la solución más sencilla;
  * ninguna hora extra sin decir qué se recorta.
* **Resultado:** **0 bloqueantes, 4 importantes, 5 menores.** Los cuatro importantes se arreglan cambiando texto o una línea. Ninguno añade horas.

## Comprobación de las afirmaciones del revisor

El Elephant comprobó en el documento las citas en que se apoyan los hallazgos importantes:

| Hallazgo | Texto del documento | Línea |
|---|---|---|
| M1 | «límite de peticiones… 20 peticiones por minuto» (R6) y «Tres ráfagas seguidas» (fase 6 y verificación) | 571, 609, 748 |
| M2, M3 | «el formulario manual está desactivado» en modo sin API | 186, 465 |
| M3 | R2: «el modo sin API sirve para toda la demo» | 567 |
| N1 | «Reinicio: `createInitialState()`» sin decir qué pasa con `mode` | 414 |
| N3 | `retryReport` «vuelve a la cola con un `seq` nuevo» | 414 |

Todas las citas existen y dicen lo que el revisor afirma.

## Qué confirma la revisión

- Todos los requisitos obligatorios tienen un camino: SSR, avisos manuales, ráfaga, campos de la IA, aprobación de categorías, acciones del operador y reinicio.
- La reescritura cierra la mayoría de los hallazgos de la etapa 5:
  - la elegibilidad se comprueba en un solo sitio (`applyDecision`);
  - desaparece la maquinaria de SSR e hidratación;
  - una contraseña errónea ya no gasta un aviso;
  - `invalid_input` es un tipo de error propio;
  - la fase 6 tiene un límite de tiempo y un plan B.
- El revisor **no** pide recuperar reintentos, persistencia, respaldo automático ni «Separar aviso». Están en Non-Goals o en limitaciones.
- Las fases suman 24 h exactas.

## Hallazgos importantes (🟡)

**M1. El límite de 20 peticiones por minuto puede hacer fallar la salida de la fase 6** · *defecto real*
- **Dónde:** §5 paso 1 (~361), salida de la fase 6 (609), verificación paso 2 (748).
- **Problema:**
  - Una ráfaga son 9 llamadas. «Tres ráfagas seguidas» son unas 27 en uno o dos minutos.
  - Con un modelo rápido se supera el límite, y algunos avisos acaban en `rate_limit` a mitad de ráfaga.
  - El reintento manual cambia el orden, y la ráfaga deja de coincidir con el guion aunque el prompt sea bueno.
  - Pasa lo mismo si en la entrevista piden una segunda ráfaga enseguida.
- **Solución más sencilla:** escribir «esperar 1 minuto entre ráfagas consecutivas» en la fase 6, en la verificación y en el guion de la demo. La otra opción es subir el límite a 60 por minuto.
- **Coste:** solo texto.

**M2. Algunos CUJ no se pueden recorrer tal como piden las condiciones de salida** · *defecto real (plan de verificación)*
- **Dónde:** salidas de las fases 5 y 7 (~608, ~610) y verificación manual paso 1 (~747).
- **Problema:**
  - El plan pide recorrer «CUJ 1 a 9 en modo IA y en modo sin API».
  - En modo sin API no hay formulario, ni errores, ni contraseña, así que los CUJ 2, 3, 7 y 9 no se pueden recorrer.
  - En modo IA, el CUJ 7 necesita un 429 o un timeout, y el diseño no tiene forma de provocarlo.
- **Solución más sencilla:**
  - Añadir una tabla de una línea:
    - modo sin API: CUJ 1, 4, 5, 6 y 8;
    - modo IA: todos menos el 8.
  - El CUJ 7 queda cubierto por el test de la cola (archivo 35) más una ejecución local con un `TRIAGE_MODEL` erróneo, que da un error `server` reintentable.
  - Sin interruptores de depuración.
- **Coste:** solo texto.

**M3. R2 promete que el modo sin API cubre «toda la demo», y no es así** · *defecto real (afirmación mal calibrada)*
- **Dónde:** R2 (567) y salida de la fase 0 (~603).
- **Problema:**
  - Sin formulario manual, el modo sin API no enseña ni el requisito 2 (avisos manuales) ni el análisis con IA de un aviso escrito en directo.
  - Si falta crédito en el Gateway, la demo se queda en la ráfaga, las acciones del operador, la aprobación de categorías y el reinicio.
- **Solución más sencilla:**
  - Corregir R2 y la salida de la fase 0 para que digan qué cubre el modo sin API.
  - Añadir como limitación aceptada que los avisos manuales y la IA en directo necesitan crédito.
- **Mejora opcional, no necesaria:**
  - En modo sin API, dar a los avisos manuales una respuesta fija: un incidente nuevo con el texto como resumen, gravedad Media, protocolo `notify` y la categoría «Otro».
  - Coste: unos 30-45 min, que saldrían de las 2,5 h de margen. **No se recomienda** mientras la fase 0 confirme que hay crédito.

**M4. El diálogo de contraseña no tiene salida definida** · *defecto real (hueco de especificación)*
- **Dónde:** CUJ 9 (~193-195), §8 último punto (~457) y `PasswordDialog.tsx` (archivo 29).
- **Problema:**
  - Si el operador cierra el diálogo, los avisos quedan «En cola» con `running = false`, y nada visible vuelve a arrancar la cola.
  - «Reintentar» solo aparece en avisos con error.
- **Solución más sencilla:** que el diálogo no se pueda cerrar sin contraseña. Para salir de él, se usa «Reiniciar demo» o se recarga la página, que da lo mismo porque el estado solo está en memoria. Sin estado ni botones nuevos.

## Hallazgos menores (🟢)

| # | Hallazgo | Etiqueta | Solución más sencilla |
|---|---|---|---|
| N1 | No se dice qué conserva «Reiniciar». Como `mode` está en `TriageState`, `createInitialState()` volvería a modo IA en mitad de una demo sin API. | Defecto real (ambigüedad) | Una línea: «Reiniciar conserva `mode` y la contraseña, y cierra el diálogo»; `createInitialState(mode)`. |
| N2 | `drain()` usa `try/finally` sin `catch`. Una excepción del cliente deja el aviso en «Procesando» para siempre, sin «Reintentar». | Defecto real | Dentro de cada vuelta, convertir cualquier excepción en `markError(report, "server")` y seguir. No es un mecanismo de recuperación. |
| N3 | `seq` se describe como «orden estable», pero `retryReport` le da uno nuevo. El contador de progreso puede pasar de 9. | Defecto real (documento) | Corregir el comentario: «orden de cola y feed; Reintentar lo manda al final». |
| N4 | El contador «n/9» repite lo que ya muestra el feed y añade un campo, un selector y un caso límite. | Mejora opcional (YAGNI) | Quitarlo, o mantenerlo con `min(n, 9)`. |
| N5 | `applyDecision` devuelve `createdCategory`, y solo lo usaría el toast opcional. | Mejora opcional (YAGNI) | Devolver solo `state`; añadirlo si se hace el toast. |

## Preferencias (no requieren cambios)

- El limitador en memoria, `timingSafeEqual` y la espera de 1 s son más de lo estrictamente necesario detrás de una contraseña, pero son baratos, están documentados en R6 y se pueden defender en la entrevista.
- Los 7 tipos de error podrían reducirse, pero cuestan poco y se ven en la interfaz.

## Valoración del Elephant

- **Bloqueantes:** ninguno. Ningún hallazgo impide un requisito obligatorio ni el recorrido esencial de la demo.
- **M1 y M2** son los más útiles: sin ellos, las condiciones de salida de las fases 5, 6 y 7 no se pueden cumplir tal como están escritas, y eso cuesta tiempo el día 2.
- **M3** cambia una promesa del documento, no el producto. Hay que corregirla porque es lo que se defiende en la entrevista si falla el crédito.
- **M4, N1 y N2** son una línea cada uno y evitan que Claude Code tenga que decidir por su cuenta.
- **N4 y N5:** quitarlos reduce trabajo. Se recomienda quitar los dos.
- **Horas:** ninguna corrección necesaria añade horas. La única con coste es la mejora opcional de M3, y no se recomienda.

## Estado

No se ha editado el documento. Las correcciones se agrupan con las de la etapa 9 en el veredicto final.
