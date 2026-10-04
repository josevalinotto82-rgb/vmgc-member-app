# VMGC · Estadísticas ampliadas (versión 2)

Versión de prueba sobre el ZIP original. No publicada; sin cambios en datos o permisos de Supabase.

## Cambios
- Acceso a Mis estadísticas en lugar de Crea tu Torneo.
- Sólo vueltas de 18 hoyos; se quitó la opción de 9 hoyos.
- Cantidades y porcentajes de birdie o menos, par, bogey y doble bogey o más.
- Tortas para la vuelta completa y comparación de ida/vuelta dentro de las tarjetas de 18 hoyos.
- Tabla de los 18 hoyos con par histórico, promedio de golpes, diferencia vs. par y cantidad de registros. Destaca el hoyo de mayor diferencia promedio sobre par.
- Promedio en par 3, 4 y 5, mejores gross/neto, regularidad y comparación de últimas 5 vueltas con las 5 anteriores.
- Datos personales visibles apenas terminan sus consultas, sin esperar al club. Filtros de fecha en servidor, páginas del club en paralelo y reutilización del comparativo ya consultado por período durante la visita.
- Desde una tarjeta se abre el torneo con origen=estadisticas; el enlace Volver regresa a Estadísticas. El período queda guardado por sesión.

## Probar
Servir esta carpeta por HTTP como la app actual. Ingresar en login.html con un usuario vinculado a players.profile_id y abrir Mis estadísticas. Para revisar el diseño sin sesión: estadisticas.html?vista=demo. Los datos de esa vista son ficticios y están identificados.

## Reglas y datos incompletos
Sólo Medal individual, estado valid y gross mayor que cero para promedios. Sólo torneos publicados, oficializados o archivados de versión 2. Historial de otras modalidades visible, sin mezclarlo en promedios. Cada hoyo usa sus golpes y par_value históricos de hole_scores. Si el par no está, se usa la regla histórica de categoría únicamente cuando se identifica sin ambigüedad. No se inventan pares ni golpes ausentes. Los hoyos sin información se excluyen de porcentajes y se informa su cantidad. Si un hoyo tuvo distintos pares, se muestran todos y cada resultado se compara con su par respectivo.

Birdie o menos incluye eagle/albatros/hoyo en uno. Doble bogey o más incluye triple y resultados superiores. Clasificación gross, sin descuento de hándicap. Regularidad es desvío estándar poblacional de gross; con pocas tarjetas es poco representativa. Comparativo general por tarjeta, incluye al jugador y no ajusta diferencias de hándicap o salida.

## Validación
Cálculos probados con todas las clases de resultado, estados inválidos, golpes faltantes, par histórico y reglas ambiguas. Prueba de carga con comparativo demorado: datos personales visibles sin cambiar filtros. Consulta real filtrada a Supabase: 3.938 tarjetas válidas Medal de 18 hoyos en los últimos 12 meses al verificar; 180 hoyos correctamente clasificados en una muestra de 10 tarjetas. Revisión visual móvil de tortas y tabla. Verificado enlace real Volver a estadísticas en la pantalla de torneo.

## Pendientes
Probar de punta a punta con la sesión de un socio real; no se usaron credenciales personales en esta revisión. Revisar permisos antes de publicar (la clave pública actual permite leer tarjetas sin sesión). Para escala mayor, trasladar el comparativo a agregación en servidor: ahora ya no bloquea los datos personales pero sigue consultando páginas numéricas del período solicitado. Todo el historial puede tardar más. Las políticas actuales determinan la muestra visible del club.

Confirmar si todos los torneos del sistema se jugaron en Villa María: tournaments no identifica cancha. No se cambiaron datos ni permisos de producción. Notificaciones y empaquetado para tiendas corresponden a etapas siguientes.

## Versión 3 · Selector de torneos
Se agregó Elegir torneos con búsqueda por nombre/fecha, selección múltiple, marcar visibles, desmarcar todos y Aplicar selección. La lista muestra únicamente torneos donde el socio tiene tarjetas en el período elegido, con cantidad, promedios y advertencias cuando hay tarjetas excluidas o hoyos sin información verificable.

Todas las estadísticas e historial se filtran por los torneos seleccionados. El comparativo del club usa los mismos identificadores de torneo. Se agrega Selección vs. período completo con los resultados personales del período como referencia. Cambiar selección no vuelve a consultar la base; usa datos ya cargados. El período y selección se conservan en esta sesión del navegador. La selección queda separada por usuario.

Esto es revisión de resultados para el socio: no modifica, oficializa, corrige ni audita administrativamente tarjetas en Supabase. Selección vacía muestra cero tarjetas; no cambia silenciosamente a todos los torneos. Cancelar conserva la selección previa. Ver todos restablece el período completo.

Pruebas: selección de 2 torneos recalcula las métricas a 2 tarjetas y 36 hoyos y limita al club/historial; búsqueda, cancelar, vaciar y restablecer comprobados. Revisión visual móvil del selector. La muestra usa nombres, fechas y resultados ficticios. Abrir estadisticas.html?vista=demo desde un servidor HTTP para probarla sin una cuenta.

## Ajuste móvil del selector
El buscador ya no recibe foco automático al abrir: se evita mostrar teclado o cambiar escala sin intervención. Campos de texto y período usan 16 px. Ventana limitada al ancho y alto disponibles, lista con desplazamiento interno y adaptación para pantallas bajas. No se bloquea el zoom manual: el viewport no incluye maximum-scale ni user-scalable=no. Verificado en la vista móvil: foco en cerrar, escala 1 y ventana dentro de la pantalla. Pendiente prueba específica en Safari/iPhone físico.
