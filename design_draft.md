# EmergencyTriage

*   **Author:** JackElSimple
*   **Status:** Draft
*   **Date:** 2026-11-18

--------------------------------------------------------------------------------

## Overview

EmergencyTriage es un prototipo de consola de operaciones para incidentes en edificios. Recibe avisos de texto libre, usa una IA para proponer cómo agruparlos en incidentes y deja que una persona responsable de seguridad valide o descarte cada incidente.

Es la entrega de una prueba técnica de un proceso de selección, con un plazo de 2 días de unas 12 horas. Trabaja solo con datos ficticios y **no es un sistema real de gestión de emergencias**. Se presenta en directo en una entrevista técnica, donde el autor tiene que explicar cómo funciona por dentro, por qué tomó cada decisión y cómo llevaría el diseño a producción.

Se construye con React, TypeScript, TanStack Start (con SSR), shadcn/ui, Vercel AI SDK y Vercel AI Gateway, y se despliega en Vercel Hobby. El objetivo de coste es 0 €. Este repositorio (`fusuma-test`) contiene el producto.

## The Problem

### El problema

Cuando pasa algo en un edificio, varios ocupantes avisan casi a la vez, y cada uno lo describe a su manera:

- «Huele a humo en la segunda planta».
- «Hay una especie de niebla gris en la planta 2».
- «Se percibe olor a quemado cerca de las escaleras».

La persona responsable de seguridad tiene que leerlo todo y deducir cuántos incidentes reales hay, dónde están, qué gravedad tienen y qué protocolo aplicar. Con pocos avisos es manejable. Con una ráfaga de diez en un minuto, mezclados entre edificios y plantas, aparecen tres riesgos:
- tratar el mismo incidente como si fueran varios y repartir la atención;
- mezclar incidentes distintos;
- tardar demasiado en decidir.

### La solución propuesta

EmergencyTriage procesa los avisos de uno en uno, en el orden en que llegan. Para cada aviso, una IA **propone**:
- si pertenece a un incidente abierto del mismo edificio y la misma planta, o si abre un incidente nuevo;
- una categoría;
- una gravedad (Baja, Media, Alta o Crítica);
- uno de los 5 protocolos predefinidos;
- un resumen ejecutivo del incidente;
- una frase con el motivo de su propuesta.

La persona responsable ve en una sola pantalla los avisos originales y las tarjetas de incidente que se van formando. Puede corregir cualquier campo de un incidente pendiente y después **validarlo**, si se aplicará el protocolo, o **descartarlo**, por ejemplo si es una falsa alarma. Un incidente validado o descartado ya no cambia.

La IA no toma decisiones de evacuación, no emite instrucciones oficiales y no inventa ubicaciones, rutas ni puntos de reunión. Solo puede elegir protocolos de una lista cerrada y referirse a los incidentes y categorías que se le envían. El código comprueba ambas cosas en cada respuesta, no solo el prompt.

### A quién sirve

- **Usuario del producto:** la persona responsable de seguridad que mira el tablero. En un uso real, los ocupantes enviarían los avisos desde el móvil. En la demo, una misma persona (el autor o el reclutador) hace los dos papeles desde la misma pantalla.
- **Público de la demo:** el equipo evaluador. Valora sobre todo dos cosas: que se entregue un MVP funcional y visualmente cuidado en poco tiempo, y que el autor sepa defender su arquitectura y sus trade-offs.

## Goals

1. **Demostrar la consolidación en directo.** Al pulsar «Simular ráfaga», los 9 avisos del guion aparecen uno a uno en el feed y se consolidan en el número de incidentes que el guion espera. Con el motor de IA real, el resultado coincide con el guion en al menos 4 de 5 ejecuciones seguidas sobre un tablero reiniciado. *(Objetivo propuesto; se medirá con el script de prueba de la ráfaga.)*
2. **La IA nunca inventa referencias.** Cualquier respuesta de la IA que nombre un incidente, una categoría o un protocolo que no se le envió, o que proponga agrupar con un incidente cerrado o de otra planta, se corrige o se rechaza antes de tocar el estado. Hay al menos un test unitario por cada regla de saneado.
3. **La persona tiene la última palabra.**
   - Toda edición manual de categoría, gravedad, protocolo o resumen en un incidente pendiente bloquea ese campo frente a la IA.
   - La IA puede mantener o subir la gravedad, nunca bajarla.
   - Solo una persona pasa un incidente a `Validado` o `Descartado`, y desde ese momento nadie puede modificarlo.
4. **La demo no se cae del todo.**
   - Un fallo de la IA (límite de peticiones, timeout, respuesta inválida) afecta solo a ese aviso, que queda marcado con el tipo de error y un botón «Reintentar», y la cola continúa.
   - Con el tablero vacío, el «Modo sin API» reproduce la ráfaga completa sin llamar a ninguna API.
5. **El estado sobrevive a una recarga del navegador.** Los avisos, los incidentes y las categorías se guardan en `localStorage` con `schemaVersion: 1`. Si la versión guardada no coincide, se empieza con un tablero limpio.
6. **Coste 0 €.** Vercel Hobby y el crédito gratuito de AI Gateway cubren el desarrollo y la demo. Los mensajes tienen un máximo de 500 caracteres y las respuestas de la IA un límite de tokens.
7. **Arquitectura explicable.** Las reglas de negocio están en funciones de TypeScript puro, sin React, con tests propios. El motor de IA y el modo sin API implementan la misma interfaz. Un README con diagramas Mermaid explica el flujo de datos, los trade-offs y la hoja de ruta a producción.
8. **Entregado y desplegado en 24 horas.** Hay una URL pública en Vercel desde las primeras 2 horas (esqueleto mínimo) y la versión final está ensayada antes de la entrevista.

## Non-Goals

- **No es un sistema de emergencias real.** No ejecuta protocolos, no envía notificaciones y no se integra con alarmas, sensores ni servicios de emergencia.
- **No se arrastran tarjetas.** Las columnas `Pendiente | Validado | Descartado` cambian solo con botones explícitos.
- **No hay fusión manual de incidentes.** Una agrupación errónea se corrige descartando el incidente («Separar aviso» queda como opcional si sobra tiempo).
- **No hay agrupación entre plantas distintas.** Los avisos de otra planta abren un incidente nuevo, que se puede enlazar como relacionado.
- **No hay incidentes con varias plantas.** La propagación entre plantas se describe en el resumen.
- **No hay estado `Resuelto`.** `Validado` significa «protocolo aprobado», no «emergencia terminada». El estado `Resuelto` queda para la hoja de ruta.
- **No se crean ni se borran categorías a mano.** «Cambiar categoría» solo elige entre las existentes, y las categorías no oficiales sin uso se ocultan, no se borran.
- **No hay base de datos, Redis ni infraestructura externa.** El límite de peticiones en el servidor es parcial (por instancia) y se presenta así.
- **No hay varios usuarios ni sincronización** entre pestañas o dispositivos, ni autenticación.
- **No hay vista móvil del ocupante** ni avisos por audio.
- **No hay registro de eventos (event sourcing).** Queda en la hoja de ruta junto con Postgres.
- **No hay vista de arquitectura dentro de la app.** La documentación va en el README.
- **No hay backoff exponencial ni cancelación de peticiones con AbortController.** Un `runId` descarta las respuestas obsoletas y hay un único reintento fijo.
- **No hay evaluación formal de la IA.** Solo el script manual que ejecuta la ráfaga.

## Open Questions

*   **Categoría al agrupar**: cuando un aviso se une a un incidente `Pendiente`, ¿puede la IA cambiar su categoría (si el campo no está bloqueado) o solo se asigna al crear el incidente?
*   **Resumen bloqueado**: el resumen se regenera en cada agrupación salvo que esté bloqueado. Si lo está, ¿la tarjeta muestra «N avisos nuevos desde tu edición»?
*   **`relatedRef` y confianza**: `relatedRef` puede apuntar a incidentes de otra planta o cerrados del mismo edificio. ¿También a otro incidente de la misma planta cuando la IA duda? ¿Se usa el campo `confidence` que devuelve la IA, sabiendo que la confianza que el modelo declara sobre sí mismo es difícil de defender?
*   **Recarga a mitad de la cola**: propuesta: los avisos en cola o en proceso pasan a `error: interrupted`, con «Reintentar».
*   **Uso sin el autor**: ¿usará el reclutador la URL por su cuenta? De eso depende si hace falta una contraseña de demo.
*   **Enunciado de la prueba**: ¿exige categorías dinámicas y una URL desplegada, o bastaría con categorías fijas o una demo local?
*   **Visibilidad**: ¿qué ve el operador cuando la IA crea una categoría (aviso emergente, etiqueta, nada)?
*   **Datos de protocolos**: ¿qué salidas y puntos de reunión concretos tiene cada edificio?
*   **Idioma**: ¿en qué idioma van la interfaz y el prompt?
*   **Guion de la ráfaga**: los 9 avisos deben cubrir a propósito los casos clave. Hay que fijar el texto, el edificio, la planta y el resultado esperado de cada uno.
*   **Historia de producción**: con varios operadores, ¿dónde vive la serialización por edificio? Respuesta preparada: una cola o un bloqueo por edificio en Postgres o Redis.

## Critical User Journeys (CUJs)

### CUJ 1: La ráfaga se consolida en directo

*   **Given**: tablero vacío, motor de IA real activo.
*   **When**: el operador pulsa «Simular ráfaga».
*   **Then**:
    *   los 9 avisos aparecen uno a uno en el feed, cada uno con su estado (en cola, procesando, asignado o error);
    *   las tarjetas de incidente se crean o se actualizan después de cada aviso;
    *   el tablero termina con el número de incidentes que espera el guion, todos en `Pendiente`, cada uno con categoría, gravedad, protocolo, resumen, motivo y número de avisos.

### CUJ 2: Un aviso manual se agrupa en un incidente existente

*   **Given**: hay un incidente `Pendiente` de humo en Torre Central, planta 2.
*   **When**: el operador envía desde el formulario «Olor a quemado junto a la escalera» para Torre Central, planta 2.
*   **Then**:
    *   el aviso aparece en el feed asignado a ese incidente;
    *   el contador del incidente sube y su resumen se actualiza (si no está bloqueado);
    *   la gravedad se mantiene o sube;
    *   no se crea ningún incidente nuevo.

### CUJ 3: Un aviso en otra planta se relaciona, no se agrupa

*   **Given**: hay un incidente `Pendiente` de humo en Torre Central, planta 2.
*   **When**: llega «Hay humo saliendo del hueco de la escalera» para Torre Central, planta 3.
*   **Then**: se crea un incidente nuevo en la planta 3, y su tarjeta muestra que está relacionado con el incidente de la planta 2.

### CUJ 4: El operador corrige y valida

*   **Given**: un incidente `Pendiente` con gravedad Alta y protocolo «Solo informar».
*   **When**: el operador cambia el protocolo a «Evacuación hacia las salidas más cercanas» y pulsa «Validar».
*   **Then**:
    *   el protocolo queda bloqueado en cuanto se edita;
    *   al validar, la tarjeta pasa a la columna `Validado` y ya no se puede editar;
    *   un aviso posterior sobre el mismo hecho abre un incidente nuevo relacionado con este.

### CUJ 5: El operador descarta una falsa alarma

*   **Given**: un incidente `Pendiente` cuyo resumen indica que el «humo» era vapor de una cafetera.
*   **When**: el operador pulsa «Descartar».
*   **Then**: la tarjeta pasa a la columna `Descartado`, queda inmutable y no se aplica ningún protocolo.

### CUJ 6: La IA crea una categoría y el operador la aprueba

*   **Given**: llega «Hay agua cayendo del techo en el laboratorio 3», y ninguna categoría existente encaja.
*   **When**: la IA crea la categoría no oficial «Fuga de agua» y el operador pulsa «Aprobar categoría» en la tarjeta.
*   **Then**: la categoría pasa a oficial, y todas las tarjetas que la usan dejan de mostrar el botón «Aprobar categoría».

### CUJ 7: La IA falla en un aviso y el operador reintenta

*   **Given**: la ráfaga está en curso y la IA responde con un límite de peticiones (429) dos veces seguidas en el aviso 5.
*   **When**: el sistema hace su único reintento automático, vuelve a fallar y continúa con el aviso 6.
*   **Then**:
    *   el aviso 5 queda en el feed como «Error al procesar: límite de peticiones», con un botón «Reintentar»;
    *   al pulsarlo, el aviso vuelve al final de la cola y se procesa con el estado actual del tablero.

### CUJ 8: Demo sin API

*   **Given**: tablero vacío y cola parada.
*   **When**: el operador activa «Modo sin API» y pulsa «Simular ráfaga».
*   **Then**:
    *   la ráfaga se reproduce con respuestas pregrabadas y el mismo resultado visual, sin llamadas de red a la IA;
    *   cada resultado muestra la etiqueta «Sin API»;
    *   el formulario manual está desactivado y un tooltip explica por qué;
    *   si el tablero no estaba vacío, el interruptor estaba desactivado y pedía reiniciar primero.

### CUJ 9: Reinicio durante la ráfaga

*   **Given**: la ráfaga va por el aviso 4 y hay una llamada en curso.
*   **When**: el operador pulsa «Reiniciar demo».
*   **Then**: el tablero, el feed y las categorías no oficiales se vacían, y la respuesta que estaba en curso se ignora al llegar, porque su `runId` ya no es el actual.

--------------------------------------------------------------------------------

*Drafted with EGM*
