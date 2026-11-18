# EmergencyTriage

* **Author:** JackElSimple
* **Date:** 2026-11-18
* **Estado:** Revisado tras la primera ronda Goldfish (7 revisores) y las respuestas del autor. Quedan preguntas menores abiertas para `/egm-draft`.

## Overview

EmergencyTriage es un prototipo para una prueba técnica de un proceso de selección. Plazo: 2 días de unas 12 horas cada uno. Trabaja con datos ficticios: no es un sistema real de emergencias.

**Problema.** Durante un incidente en un edificio, varios ocupantes envían avisos de texto libre que describen lo mismo con palabras distintas («huele a humo en la planta 2», «niebla gris en la segunda», «olor a quemado junto a la escalera»). El responsable de seguridad tiene que leerlos todos, deducir cuántos incidentes reales hay, lo graves que son y qué protocolo aplicar. Hacerlo a mano es lento y es fácil equivocarse cuando llegan muchos avisos a la vez.

**Usuario principal.** El responsable de seguridad, que mira un tablero web. En la vida real los ocupantes enviarían los avisos desde el móvil. En la demo, la misma persona (el autor o el reclutador) hace los dos papeles desde una única pantalla.

**Qué hace.** Cada aviso que llega se procesa en orden, de uno en uno. Una IA, llamada a través de Vercel AI Gateway, *propone*:
- una categoría;
- una gravedad;
- uno de los 5 protocolos predefinidos;
- un resumen ejecutivo;
- si el aviso pertenece a un incidente abierto del mismo edificio o si abre uno nuevo.

El responsable revisa la propuesta, corrige los campos que hagan falta y **valida** o **descarta** el incidente. La IA nunca decide una evacuación ni inventa ubicaciones: solo elige protocolos de una lista cerrada, por su identificador.

**Valor para la entrevista.** Una demo visual en la que 9 avisos se convierten en 3-4 tarjetas en tiempo real, con una arquitectura que el autor puede explicar capa por capa:
- dominio en TypeScript puro;
- motor de IA intercambiable;
- servidor sin estado;
- estado en el cliente.

**Stack fijo:** React, TypeScript, TanStack Start (SSR), shadcn/ui, Vercel AI SDK, Vercel AI Gateway (plan gratuito) y Vercel Hobby. Coste objetivo: 0 €.

## Analysis

### Veredicto general

Los revisores consideran el concepto sólido y defendible. Tal como está escrito, ocupa entre 30 y 34 horas para alguien que no conoce el stack, así que hay que recortar entre 8 y 10 horas para que quepa en 24. Hay además dos huecos de especificación graves: si no se cierran antes de generar código, Claude Code tomará esas decisiones por su cuenta.
1. La forma exacta de la respuesta de la IA y cómo se resuelven sus identificadores.
2. Cómo se aplica una decisión de la IA a un tablero que ha cambiado mientras la llamada estaba en curso.

### Objeciones bloqueantes

**B1. La IA decide sobre una foto antigua del tablero.** Las llamadas a la IA no guardan estado y tardan unos segundos. Mientras tanto, el operador puede validar o editar un incidente.

*Escenario:* el operador valida el incidente #2 mientras el aviso 5 está en vuelo. La respuesta dice «agrupar en #2 y subir la gravedad», y el aviso acaba dentro de un incidente que debería ser inmutable. Variantes del mismo problema:
- se sobrescribe un campo bloqueado;
- se borra una categoría a la que apunta una decisión pendiente;
- un reintento envía un contexto viejo.

*Solución:* todas las escrituras pasan por una única función pura, `applyDecision(estadoActual, decision)`, que comprueba la decisión contra el estado **actual** y no contra el que se envió:
- si el destino ya no existe o no está `Pendiente`, se crea un incidente nuevo relacionado con él;
- los campos bloqueados se ignoran;
- la gravedad final es `max(anterior, propuesta)`;
- las respuestas con un `runId` antiguo se descartan;
- un reintento reconstruye su contexto a partir del tablero actual.

*Esfuerzo:* 1,5-2 h, con tests.

**B2. La IA puede devolver identificadores que no existen.** Si el esquema acepta cualquier texto, la IA puede devolver «inc-7» (nunca enviado), un protocolo «P6» o un incidente cerrado como destino. Eso rompería la afirmación central de la demo: «la IA no inventa nada».

*Solución:*
- Enviar alias cortos (I1..In, C1..Cn, P1..P5) y validar que la respuesta solo use los alias enviados.
- Añadir un paso determinista de saneado:
  - un destino desconocido se convierte en «crear incidente nuevo»;
  - un destino cerrado se convierte en «crear incidente nuevo con relación»;
  - un protocolo o una categoría desconocidos producen el error `invalid_ref`, con reintento;
  - un nombre de categoría nueva que coincida con uno existente (sin mayúsculas, sin tildes, sin espacios sobrantes) reutiliza la categoría existente.
- Cada regla tiene su test unitario.

*Esfuerzo:* 2 h.

**B3. La forma de la respuesta de la IA no está definida y puede fallar según el proveedor.** Algunos proveedores de salida estructurada no admiten uniones de tipos ni campos opcionales. Si eso ocurre, todos los avisos terminarían con un error de validación.

*Solución:* un objeto plano en el que todos los campos son obligatorios y «sin valor» se expresa con `null` (ver ADR-22). Se acompaña de una tabla de reglas entre campos (por ejemplo, `join` exige `targetRef`) y se prueba el mismo esquema con los dos modelos candidatos el primer día.

*Esfuerzo:* 2 h.

**B4. La cadena de herramientas no está probada.** La API de TanStack Start ha cambiado hace poco (de Vinxi a un plugin de Vite) y buena parte del código generado usa la versión anterior. La autenticación del Gateway funciona distinto en local (clave) que en Vercel (OIDC). Tampoco está confirmado el crédito gratuito ni los nombres exactos de los modelos.

*Solución:* dedicar las primeras 2 horas a una prueba mínima:
1. desplegar la plantilla oficial;
2. añadir una Server Function que haga una única llamada con salida estructurada a través del Gateway;
3. fijar las versiones en el lockfile.

Si el Gateway falla, se decide en ese momento que el modo sin API pasa a ser el camino principal de la demo.

### Objeciones importantes

- **M1. Fallback por posición.** Si las respuestas pregrabadas referencian incidentes por posición («el creado por el aviso nº 1»), el modo sin API solo funciona con el tablero recién reiniciado. Si la IA falla en mitad de la entrevista, habría que reiniciar delante del reclutador.
  - Solución: claves simbólicas («A», «B») que se asocian a IDs reales al ejecutar; activar el modo con el tablero sucio pide confirmación y reinicia; los controles desactivados muestran un tooltip con el motivo; las decisiones pregrabadas pasan por el mismo `applyDecision`, con un retardo simulado.
  - Los revisores no se ponen de acuerdo en si conviene un motor de reglas que funcione desde cualquier estado (unas 3 h). Recomendación: la solución barata ahora y el motor de reglas solo si sobra tiempo.
- **M2. Ciclo de vida de las categorías.**
  - Si la limpieza de categorías huérfanas solo cuenta incidentes `Pendiente`, las tarjetas cerradas se quedan sin nombre de categoría.
  - La IA puede crear «Inundación», «Inundacion» y «Fuga de agua».
  - Invariante: todo `categoryId` resuelve, contando incidentes en cualquier estado. Los nombres son únicos una vez normalizados.
  - Alternativa más barata (ahorra unas 2,5 h): no borrar nunca. Un filtro derivado oculta las categorías no oficiales sin uso, y «Cambiar categoría» solo permite elegir una existente.
- **M3. La planta principal al agrupar no está definida.** Un aviso de la planta -2 podría agruparse en un incidente de la planta 3. *Resuelto por el autor (ADR-24):* solo se agrupan avisos del mismo edificio **y de la misma planta**. La planta la fija el primer aviso y no cambia. Un aviso de otra planta abre un incidente nuevo que puede enlazarse con `relatedRef`. La regla se comprueba también en el saneado, no solo en el prompt: si la IA propone agrupar con un incidente de otra planta, se crea uno nuevo relacionado.
- **M4. La Server Function es un proxy abierto a la IA.** Con la URL, cualquiera puede enviar peticiones grandes o inventadas y gastar el crédito. El límite de peticiones en memoria no se comparte entre instancias.
  - Solución: validar la entrada del servidor con Zod (máximo de incidentes, longitud del resumen, tamaño total); fijar `maxOutputTokens`; opcionalmente, una contraseña de demo en una variable de entorno.
- **M5. «La IA no decide» no coincide con lo que se ve en pantalla.** El reclutador ve que la IA crea y agrupa incidentes sola, y sin fusión manual una agrupación errónea no se puede deshacer.
  - Solución: presentarlo como «la IA propone en `Pendiente` y solo una persona valida o descarta». Cada tarjeta lleva la etiqueta «Propuesto por IA» y una línea con el **motivo** que da la IA.
  - Opcional: una acción «Separar aviso» que saca un aviso a un incidente nuevo (2 h).
- **M6. Datos duplicados y estado sin versión.** `incident.reports[]` y el contador duplican la lista de avisos. Un reintento puede hacer retroceder `lastUpdated`. Una recarga deja avisos en «procesando» para siempre.
  - Solución: `report.incidentId` es la única fuente de verdad; el contador, la lista y `lastUpdated = max(timestamp)` se calculan a partir de ella.
  - `localStorage` guarda `{schemaVersion, masterDataHash, state}`; si no coincide o no se puede leer, se empieza con un tablero limpio.
  - Al cargar, los avisos que estaban en «procesando» pasan a `error: interrupted`.
- **M7. No hay contrato de prompt ni estrategia de pruebas.** Hacen falta:
  - un archivo de prompt versionado con las reglas;
  - el texto del aviso entre delimitadores, tratado como dato y no como instrucción (defensa básica contra inyección de prompt);
  - un ejemplo resuelto en el prompt;
  - tests de Vitest para el dominio;
  - un script manual que ejecute la ráfaga contra el modelo real, para poder dar cifras de acierto en la entrevista.
- **M8. Contexto compacto.** Por cada incidente se envía `{ref, planta, categoría, gravedad, resumen ≤300, nº avisos, estado}`, nunca los avisos completos. Ahorra tokens y latencia.

### Contradicciones de fondo y cómo se resuelven

1. **La IA propone sobre un tablero vivo.** Las llamadas no tienen estado y el operador actúa mientras tanto. Se resuelve con un único intermediario: toda escritura pasa por un paso de aplicación comprobado, y las acciones del operador siempre ganan (B1).
2. **Demo con IA en directo frente a una demo que no puede fallar.** Se resuelve con un modo sin API que use el mismo camino de aplicación y, si sobra tiempo, que funcione desde cualquier estado del tablero (M1).
3. **La IA agrupa frente a «la IA no decide».** Se resuelve tratando cada agrupación como una propuesta con su motivo visible, que solo pasa a ser definitiva cuando una persona valida (M5).
4. **Estado en el cliente frente a credibilidad de producción.** Alternativa más ambiciosa: modelar el dominio como un registro de eventos más un *reducer* (función que calcula el estado aplicando los eventos en orden), así la migración a Postgres sería una tabla de solo inserción. Cuesta unas 3 h si se decide desde la hora 0 y mucho más después. *Decisión del autor (ADR-28):* fuera del MVP. Se usa estado inmutable actualizado con funciones puras, y el registro de eventos queda en la hoja de ruta.
5. **Categorías dinámicas frente a coherencia.** Se resuelve normalizando nombres y enviando la lista completa a la IA con la instrucción de reutilizar si el significado coincide (M2).
6. **Muchas funcionalidades frente a 24 h.** Se resuelve por orden de construcción: primero el dominio, la UI y el modo sin API, de modo que la app se pueda enseñar sin IA; después el motor de IA real.

Los revisores consideran que dos decisiones son acertadas y no meras concesiones: que la gravedad solo pueda subir por la IA y que el tablero se renderice solo en el cliente.

### Resultado final ideal

El tablero es una función pura del historial de lo ocurrido. Cada motor (IA real, respuestas pregrabadas, reglas) solo *propone*. Un único paso comprobado aplica las propuestas, y lo que hace el operador siempre prevalece. Si algo falla, solo ese aviso cambia al modo sin API, de forma visible y desde cualquier estado del tablero. La demo en directo no puede caerse del todo, y pasar a producción consiste en cambiar dónde se guarda el estado, no en rediseñar.

## Goals vs. Non-Goals

### Requisitos confirmados (In-Scope Goals)

- Vista única de consola con:
  - panel lateral: formulario de aviso (edificio, planta, texto de 500 caracteres como máximo), botón «Simular ráfaga» (9 avisos), botón «Reiniciar demo» e interruptor «Modo sin API»;
  - zona principal: feed de avisos originales y tarjetas de incidentes en tres columnas, `Pendiente | Validado | Descartado`.
- Datos maestros estáticos:
  - 3 edificios (Torre Central, Edificio Anexo A, Laboratorios), cada uno con sus plantas (negativas para sótanos, 0 para la planta baja, positivas para las superiores);
  - 5 protocolos con datos concretos por edificio (salidas, puntos de reunión) que la IA no puede inventar.
- Procesamiento incremental y secuencial, aviso a aviso, en una única cola en el cliente.
- Propuesta de la IA para cada aviso: agrupar en un incidente `Pendiente` del mismo edificio o crear uno nuevo; categoría; gravedad (Baja, Media, Alta, Crítica); protocolo por ID; resumen ejecutivo; motivo.
- **Primero, un esqueleto mínimo desplegado (2 h):** TanStack Start en Vercel, una Server Function que hace una llamada con salida estructurada a través de AI Gateway Free y los IDs de modelo comprobados. Ninguna lógica de dominio antes de que esto funcione.
- Agrupación solo dentro del mismo edificio y la misma planta. Las relaciones entre plantas se expresan con `relatedRef`.
- Categorías dinámicas `{id, nombre, oficial}`. Oficiales iniciales: Incendio/Humo, Fallo Eléctrico, Médico, Seguridad. La IA crea una categoría nueva solo como último recurso, como mucho una por aviso, y nace no oficial.
  - Acciones de la tarjeta: «Aprobar categoría» y «Cambiar categoría», que solo deja elegir una categoría existente del catálogo.
  - Las categorías nunca se borran: un filtro de la UI oculta las no oficiales que no usa ningún incidente.
- `applyDecision(estadoActual, decision)` como único punto de escritura; alias cortos en el prompt; esquema de decisión plano; saneado determinista de referencias.
- Modo por defecto: motor de IA real. El interruptor «Modo sin API» solo se puede activar con el tablero vacío y la cola parada; en otro caso está desactivado y un mensaje pide reiniciar primero.
- README técnico con diagramas Mermaid que explica la arquitectura, los trade-offs y la hoja de ruta.
- El operador puede editar categoría, gravedad, protocolo y resumen mientras el incidente está `Pendiente`. Cada campo editado queda bloqueado para la IA.
- La IA solo puede mantener o subir la gravedad. Una persona puede bajarla, y entonces el campo queda bloqueado.
- Validar o descartar deja el incidente inmutable.
- Los errores de IA (límite de peticiones, timeout, salida inválida, referencia inválida) no detienen la cola: el aviso queda marcado con el tipo de error y un botón «Reintentar».
- Estado en el cliente con `localStorage`; Server Functions sin estado; SSR para el layout y los datos maestros; tablero renderizado solo en el cliente.
- Dominio en TypeScript puro con tests, detrás de la interfaz `TriageEngine`, con dos implementaciones: IA real y respuestas pregrabadas.
- Despliegue en Vercel Hobby con coste 0 €.

### Hipótesis pendientes de validar (día 1)

1. La plantilla oficial de TanStack Start se despliega en Vercel Hobby y una `createServerFn` funciona de principio a fin. Comprobar los nombres actuales de la API (por ejemplo `inputValidator`) y la configuración de Vercel.
2. El crédito gratuito de AI Gateway (5 USD al mes, sin tarjeta) existe y se aplica. La autenticación funciona en local (clave) y en Vercel (OIDC).
3. Los nombres de modelo (`google/gemini-2.5-flash`, `openai/gpt-4o-mini`) funcionan. Medir latencia y coste por llamada. Desactivar o reducir el «thinking» de Gemini.
4. La versión de AI SDK instalada y qué API de salida estructurada no está obsoleta (`generateObject` frente a `generateText` con `Output.object`). Fijar versiones antes de generar código.
5. El esquema plano de decisión funciona en los dos modelos.
6. Los errores 429, timeout y crédito agotado llegan al cliente como errores distinguibles, no como un 500 genérico.
7. Desde dónde se exporta `ClientOnly`, y que no aparece ningún aviso de hidratación en el build desplegado.
8. shadcn con Tailwind v4 renderiza con SSR.
9. Tiempo y coste totales de la ráfaga de 9 llamadas, para ajustar la pausa entre ellas.

### Funcionalidades opcionales (solo si sobra tiempo)

- Motor de reglas para el modo sin API que funcione desde cualquier estado del tablero, y cambio automático a ese modo tras N fallos (unas 3 h).
- Acción «Separar aviso» para deshacer una agrupación (unas 2 h).
- Contador de progreso de la ráfaga («3/9») y etiqueta «IA» o «Sin API» en cada resultado.

### Fuera del alcance (Out-of-Scope Non-Goals)

- Fusión manual de incidentes.
- Arrastrar y soltar tarjetas (las columnas cambian solo con botones).
- Base de datos externa, Redis, límite de peticiones real compartido entre instancias.
- Varios usuarios, sincronización entre pestañas o dispositivos, autenticación.
- Vista móvil del ocupante y avisos de audio.
- Incidentes con varias plantas (la propagación se describe en el resumen).
- Estado `Resuelto` posterior a `Validado`.
- Ejecución real de protocolos o envío de notificaciones.
- Evaluación formal de la calidad de la IA (solo el script manual de la ráfaga).
- Vista «Arquitectura y Decisiones» dentro de la app (se sustituye por el README).
- Borrado físico de categorías y creación de categorías desde «Cambiar categoría».
- Backoff exponencial y cancelación de peticiones con AbortController.
- Registro de eventos (event sourcing): queda en la hoja de ruta junto con Postgres.
- Agrupación entre plantas distintas.

## Alternatives Weighed

- **Reagrupar todos los avisos en bloque en cada llamada.** Rechazado por el autor: los incidentes cambiarían de ID y de orden mientras el operador los mira, el coste crece con cada aviso y es más difícil de explicar.
- **Procesar los avisos de la ráfaga en paralelo.** Rechazado por el autor: condiciones de carrera entre decisiones, peticiones por minuto superadas y una demo menos legible.
- **Estado en memoria del servidor.** Rechazado por el autor: las funciones serverless de Vercel no comparten memoria entre instancias y se perderían avisos.
- **Base de datos externa (Postgres o Redis).** Rechazado por el autor para el MVP: añade infraestructura que la prueba no necesita. Queda en la hoja de ruta.
- **Clave propia de Gemini mediante BYOK.** Rechazado por el autor: BYOK en AI Gateway requiere el plan de pago. Se usa el crédito gratuito del Gateway.
- **Dos vistas separadas (ocupante y operador).** Rechazado por el autor: exige sincronizar pestañas y no añade valor a la demo.
- **Incidentes con varias plantas.** Rechazado por el autor: complica el esquema; la propagación se cuenta en el resumen.
- **Categorías «Otro» y «Falsa Alarma» y campo `categoriaSugerida`.** Rechazado por el autor: «Otro» escondía información y obligaba a mantener un campo paralelo; «Falsa Alarma» mezclaba el tipo de incidente con su veracidad. La falsa alarma se gestiona descartando el incidente.
- **Acción global «Rechazar categoría».** Rechazado por el autor: afectaría a otros incidentes que comparten la categoría. Se sustituye por «Cambiar categoría» en cada incidente.
- **Fusión manual de incidentes.** Rechazado por el autor por tiempo: exige otra llamada a la IA para regenerar resumen y gravedad.
- **Esquema de decisión como unión de tipos (`join` / `create`).** Rechazado en la revisión: algunos proveedores de salida estructurada no lo admiten. Se usa un objeto plano con `null`.
- **Límite de peticiones en memoria presentado como protección real.** Rechazado en la revisión: no se comparte entre instancias. Se presenta como parcial o se sustituye por límites de entrada, `maxOutputTokens` y una contraseña opcional.
- **Registro de eventos más reducer como modelo de dominio.** Rechazado por el autor para el MVP: cuesta unas 3 h y es más difícil de leer y explicar que un estado inmutable actualizado con funciones puras. Queda en la hoja de ruta junto con Postgres.
- **Agrupar avisos de plantas contiguas (±1).** Rechazado por el autor: la misma planta es una regla más fácil de explicar y de comprobar en el saneado; la relación entre plantas se expresa con `relatedRef`.
- **Borrar categorías huérfanas.** Rechazado por el autor: exige definir qué cuenta como uso y comprobarlo contra las llamadas en curso. Un filtro de la UI que las oculta ahorra unas 1,5 h sin riesgo de referencias rotas.
- **Crear categorías desde «Cambiar categoría».** Rechazado por el autor: obliga a comprobar nombres duplicados y añade formularios; elegir una existente cubre la demo.
- **Backoff exponencial y AbortController.** Rechazado por el autor: el `runId` ya descarta las respuestas obsoletas y un único reintento fijo basta para la ráfaga.
- **Arrastrar y soltar en el tablero.** Rechazado por el autor: 2-3 h para una interacción que los botones resuelven.
- **Vista de arquitectura dentro de la app.** Rechazado por el autor: un README con Mermaid transmite lo mismo por menos coste.
- **Interruptor del modo sin API activable en cualquier momento.** Rechazado por el autor: las respuestas pregrabadas solo son coherentes con un tablero vacío; se exige reiniciar antes de activarlo.

## Key Decisions & Staging for Next Steps

### Registro de decisiones de arquitectura (ADRs)

| # | Decisión | Trade-off asumido |
|---|---|---|
| ADR-01 | Vista única de consola; el operador hace también de ocupante en la demo. | No representa la experiencia móvil real, pero se ve causa y efecto en una sola pantalla sin sincronizar pestañas. |
| ADR-02 | Agrupación incremental aviso a aviso, comparando solo con incidentes del mismo edificio. | IDs estables y coste lineal, pero un aviso mal agrupado al principio condiciona los siguientes. |
| ADR-03 | Una única cola secuencial en el cliente para la ráfaga y los avisos manuales. | Sin condiciones de carrera entre decisiones, pero la ráfaga tarda la suma de las latencias (unos 20-40 s). |
| ADR-04 | Estado maestro en el cliente (`localStorage`); Server Functions sin estado; salida validada con Zod. | Sin infraestructura y fácil de explicar, pero sin varios usuarios, y el cliente envía el contexto (en él se confía). |
| ADR-05 | La IA propone y una persona valida: los campos se pueden editar mientras el incidente está `Pendiente`. | Más control humano a cambio de más clics por incidente. |
| ADR-06 | Una sola planta principal; la propagación se describe en el resumen. | Esquema plano a cambio de perder datos estructurados sobre la propagación. |
| ADR-07 | Categorías `{id, nombre, oficial}` sin «Otro»; la IA crea una nueva como último recurso (máx. 1 por aviso). | Más información que un cajón de sastre, a cambio de más categorías no oficiales que revisar. |
| ADR-08 | Sin concepto de falsa alarma; el operador descarta el incidente. | Modelo más simple, pero no queda registrado *por qué* se descartó. |
| ADR-09 | Estados `Pendiente → Validado` o `Pendiente → Descartado`, ambos finales e inmutables. | Trazabilidad clara, pero un incidente validado que empeora genera uno nuevo relacionado. |
| ADR-10 | SSR para el layout y los datos maestros; tablero renderizado solo en el cliente. | Se usa TanStack Start donde aporta (primer pintado, clave de IA solo en el servidor), pero el SSR no aporta nada al tablero. |
| ADR-11 | Solo `runId` para descartar respuestas tras un reinicio; sin AbortController. | Poco código; el servidor puede terminar llamadas cuyo resultado se descarta (coste de tokens pequeño). |
| ADR-12 | Los campos editados por una persona quedan bloqueados; la IA solo puede subir la gravedad. | Las ediciones humanas no se pierden, pero un resumen bloqueado no refleja los avisos nuevos. |
| ADR-13 | Coste 0 € con AI Gateway Free (5 USD/mes, pendiente de verificar) en lugar de BYOK. | Sin gasto, pero con un tope de crédito que se puede agotar. |
| ADR-14 | Pausa corta entre llamadas y un único reintento con retardo fijo ante 429; si falla, el aviso queda en error con «Reintentar». | Más simple que un backoff exponencial; algunos avisos pueden necesitar un reintento manual. |
| ADR-15 | Los errores de IA no bloquean la cola; «Reintentar» lo vuelve a poner al final y reconstruye el contexto desde el tablero actual. | La demo sigue avanzando, pero el orden de procesamiento puede no coincidir con el de llegada. |
| ADR-16 | Interfaz `TriageEngine` con dos implementaciones (IA real y respuestas pregrabadas). | Un poco más de estructura a cambio de una demo que no depende de la red y de un ejemplo concreto de desacoplamiento. |
| ADR-17 | Respuestas pregrabadas con claves simbólicas que se asocian a IDs reales al ejecutar. | Funciona tras un reinicio sin depender de IDs generados, pero no desde cualquier estado del tablero. |
| ADR-18 | Límite de 500 caracteres, validación de entrada en el servidor y `maxOutputTokens`; límite de peticiones en memoria solo como protección parcial. | Sin infraestructura extra; queda expuesto a un abuso que agote el crédito. |
| ADR-19 | Fusión manual fuera del alcance. | Ahorra unas 3 h; una agrupación errónea no se puede deshacer (salvo «Separar aviso», opcional). |
| ADR-20 | `applyDecision(estadoActual, decision)` como único punto de escritura, comprobado contra el estado actual. | Un poco más de lógica de dominio a cambio de consistencia aunque el tablero cambie durante una llamada. |
| ADR-21 | Alias cortos (`I1`, `C1`, `P1`) y saneado determinista de la respuesta de la IA. | Garantiza que la IA no inventa IDs, protocolos ni ubicaciones, con algo de código extra y sus tests. |
| ADR-22 | Esquema de decisión plano con todos los campos obligatorios y `null`: `{action, targetRef, confidence, categoryRef, newCategoryName, severity, protocolRef, summary, relatedRef, rationale}`. | Compatible con más proveedores, pero las reglas entre campos se validan en código. |
| ADR-23 | `report.incidentId` como única fuente de verdad; contador, lista y `lastUpdated` se calculan. `localStorage` con versión de esquema. *(Propuesto en la revisión; pendiente de confirmar por el autor.)* | Sin datos duplicados y con recuperación ante cambios de esquema; el estado guardado se pierde al cambiar la versión. |
| ADR-24 | Agrupación solo en el mismo edificio y la misma planta; la planta la fija el primer aviso; otras plantas se relacionan con `relatedRef`. La regla se comprueba en el saneado. | Regla simple y comprobable, pero un incendio que sube por la escalera aparece como varios incidentes relacionados. |
| ADR-25 | Motor de IA real por defecto; «Modo sin API» solo activable con el tablero vacío y la cola parada. | Respuestas pregrabadas siempre coherentes, pero si la IA falla en directo hay que reiniciar antes de usar el modo sin API. |
| ADR-26 | Las categorías nunca se borran (un filtro oculta las no oficiales sin uso); «Cambiar categoría» solo elige entre las existentes. | Sin referencias rotas y unas 2,5 h menos, pero el operador no puede crear categorías a mano. |
| ADR-27 | Documentación de arquitectura en un README con diagramas Mermaid, no en una vista dentro de la app. | Más barato y revisable en el repositorio, pero menos vistoso durante la demo. |
| ADR-28 | Estado inmutable actualizado con funciones puras; el registro de eventos queda en la hoja de ruta. | Más fácil de leer y explicar; sin historial de auditoría en el MVP. |
| ADR-29 | Un esqueleto mínimo desplegado en las primeras 2 h, antes de cualquier lógica de dominio. | Retrasa las funcionalidades visibles, pero saca a la luz pronto los fallos de TanStack Start, Gateway y modelos. |

### Presupuesto de horas sugerido (24 h)

| Bloque | Horas |
|---|---|
| Prueba mínima de stack y despliegue | 2 |
| Tipos, esquemas y datos maestros | 1 |
| Dominio, saneado y tests | 3,5 |
| Server Function, prompt y motor de IA | 2,5 |
| Ajuste del prompt y prueba de la ráfaga | 1,5 |
| Cola, reintento y reinicio | 1,5 |
| UI | 5,5 |
| Categorías (versión simplificada) | 1,5 |
| Modo sin API con claves simbólicas | 1,5 |
| README y ensayo de la demo | 1,5 |
| Margen | 2,5 |

### Preguntas abiertas para llevar a `/egm-draft`

Resueltas en esta ronda: plantas (ADR-24), limpieza y cambio de categorías (ADR-26), modo sin API (ADR-25) y registro de eventos (ADR-28). Quedan:

1. **ADR-23:** ¿se confirma que `report.incidentId` es la única fuente de verdad y que `localStorage` lleva versión de esquema?
2. **Categoría al agrupar:** ¿puede la IA cambiar la categoría de un incidente `Pendiente` al añadir un aviso, o solo la asigna al crearlo?
3. **Resumen bloqueado:** ¿se regenera en cada agrupación? Si está bloqueado, ¿la tarjeta muestra «N avisos nuevos desde tu edición»?
4. **`relatedRef` y confianza:** `relatedRef` puede apuntar a incidentes de otra planta o cerrados del mismo edificio. ¿También a otro incidente de la misma planta cuando la confianza es baja? ¿Se usa el campo `confidence` que devuelve la IA, sabiendo que la confianza que el modelo declara sobre sí mismo es difícil de defender?
5. **Recarga:** ¿qué pasa con la cola y con los avisos en vuelo al recargar la página? Propuesta: pasan a `error: interrupted` con «Reintentar».
6. **Reclutador a solas:** ¿usará el reclutador la URL sin ti? De eso depende si hace falta una contraseña de demo.
7. **Enunciado de la prueba:** ¿exige categorías dinámicas y una URL desplegada, o bastaría con categorías fijas o una demo local?
8. **Visibilidad:** ¿qué ve el operador cuando la IA crea una categoría (aviso emergente, etiqueta, nada)? ¿Se muestra el motivo en cada tarjeta?
9. **Datos de protocolos:** ¿qué salidas y puntos de reunión concretos tiene cada edificio?
10. **Idioma:** ¿en qué idioma van la UI y el prompt?
11. **Guion de la ráfaga:** los 9 avisos deberían cubrir a propósito los casos clave: varios avisos del mismo incidente, otro incidente en la misma planta, un aviso en otra planta que se relaciona, otro edificio y un aviso que obliga a crear una categoría no oficial.
12. **Historia de producción:** con varios operadores, ¿dónde vive la serialización por edificio? Respuesta preparada: una cola o un bloqueo por edificio en Postgres o Redis.
