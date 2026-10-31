# Configuración de tees recomendados

Proyecto: bnnfolhrqxgxjmobclrm. Tabla pública: `tee_recommendation_settings`.
La fila de Villa María Golf tiene `aag_field_id = 1466`.

El sistema debe leer y guardar la columna `rules` completa en una sola operación.
Ejemplo inicial (ya cargado en Supabase):

```json
{
  "male": [
    {"tee": "Negro", "max_index": 9},
    {"tee": "Amarillo", "max_index": 15},
    {"tee": "Blanco", "max_index": 54}
  ],
  "female": [
    {"tee": "Rojo", "max_index": 54}
  ]
}
```

Cada `max_index` incluye ese valor. El primer rango empieza en -10 incluido;
el siguiente empieza por encima del límite anterior. Así 9 corresponde a Negro,
9.1 a Amarillo, 15 a Amarillo y 15.1 a Blanco. Se aceptan límites decimales.
El último límite debe ser 54. Categorías: `male` caballeros y `female` damas.
Tees permitidos: Negro, Amarillo, Blanco y Rojo, sin repetir dentro de una categoría.
Cada categoría admite entre 1 y 4 rangos ordenados. La base rechaza rangos inválidos.

```js
const { data, error } = await db.from('tee_recommendation_settings')
  .select('aag_field_id,rules,revision,updated_at')
  .eq('aag_field_id', 1466).single();

// Con sesión de administrador activa. revision evita pisar otra edición concurrente.
const { data: saved, error: saveError } = await db.from('tee_recommendation_settings')
  .update({ rules: nuevosRangos })
  .eq('aag_field_id', 1466).eq('revision', data.revision)
  .select('aag_field_id,rules,revision,updated_at').single();
// Si no devuelve una fila, recargar: pudo haber cambiado la configuración o faltar permiso.
```

Lectura: usuarios autenticados. Edición: `profiles.role = 'admin'` y `active = true`.
No se usan permisos editables por el usuario ni claves privadas en el navegador.
`revision` y `updated_at` se actualizan automáticamente. No editar esas columnas.
Un backend de confianza con service_role también puede guardar `rules`.

La app preparada para 1.1.4 consulta al entrar en Consultas, al volver del segundo plano,
al recuperar conexión, al abrir la consulta individual y antes de calcular una pareja.
Mientras Consultas está visible revisa cada 60 segundos y vuelve a renderizar los resultados.
No usa límites fijos de respaldo: si falla la consulta muestra los HCP de cada tee sin
inventar una recomendación y bloquea el cálculo por pareja hasta recuperar las reglas.
Los Slope/Rating/Par siguen viniendo de aag_teeouts; no se modificaron.

Las versiones instaladas anteriores necesitan actualizarse una vez a esta implementación.
Después, modificar rangos no requiere recompilar ni volver a publicar la app.
Esto no cambia las reglas particulares ni los resultados históricos de los torneos.
