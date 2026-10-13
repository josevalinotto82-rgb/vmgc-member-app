# Casilla móvil y versiones publicadas

La configuración ya está aplicada al proyecto bnnfolhrqxgxjmobclrm. El SQL adjunto documenta una instalación inicial; no volver a ejecutarlo sobre las tablas existentes.

La web conserva `club_notice_inbox`, `club_notice_hidden` y `club_notice_inbox_state`. La app utiliza instalaciones y avisos ocultos propios, con una ventana de 14 días. Las funciones se ejecutan con los permisos del usuario y todas las tablas tienen RLS.

`mobile-release-sync` consulta la ficha pública de Apple en Argentina y los lanzamientos publicados y completados en Google. No considera aprobaciones que todavía no están publicadas. Google usa `GOOGLE_PLAY_SERVICE_ACCOUNT` o, si falta, `FIREBASE_SERVICE_ACCOUNT`, siempre como secreto del servidor.

La función tiene autenticación propia mediante el encabezado `x-vmgc-sync`. Su token se genera en la base y está en una tabla sin permisos para clientes. Nunca copiar ese token al paquete móvil. El cron `vmgc-mobile-published-releases` la ejecuta cada hora. `last_status` sólo contiene estados seguros, sin credenciales.

Apple se comprobó correctamente. Google ya está vinculado: el 12/10/2026 confirmó Alpha 1.0.4 (8). La app no anuncia ninguna versión Android sin una publicación verificada. La cuenta de servicio actual es `firebase-adminsdk-fbsvc@villa-maria-golf.iam.gserviceaccount.com`; conceder acceso únicamente a esta app cuando se retome la integración.

`minimum_version` (iOS) y `minimum_build` (Android) son reglas manuales para actualizaciones obligatorias. La sincronización conserva esas reglas. No se activa automáticamente una versión mínima. El aviso recomendado puede posponerse 24 horas; un fallo de conexión no bloquea la app.

Android está configurado para Alpha en `scripts/updates.mjs`. Antes de generar la app para el canal de producción se debe cambiar esa selección. No se debe mezclar un lanzamiento de prueba con la publicación pública.

Fuentes: [Apple Lookup](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/LookupExamples.html), [Google release lifecycle](https://developers.google.com/android-publisher/api-ref/rest/v3/applications.tracks.releases), [Google track status](https://developers.google.com/android-publisher/api-ref/rest/v3/edits.tracks).

