# Modulo Bodega en Dixiapp

Estado: **construido** (version 1). Esta nota describe la arquitectura, que quedo hecho y que falta.

## Que quedo hecho

- Existencias por Bodega central, Local Soda y Local Pollos, con minimos y marca de bajo minimo, buscador y ajuste directo.
- Recibir: facturas de proveedores por recibir, con el articulo y el factor que el facturador ya recuerda; "Recibir todo" con un toque.
- Sacar: consumo, merma, devolucion a proveedor y pasar de la bodega a un local, con botones + y - y un solo guardar.
- Contar: conteo fisico ciego (no muestra el esperado), guardar avance, revision de diferencias y confirmacion; cancelar sin tocar existencias.
- Alertas: bajo minimo, por vencer y vencidos, con contador en la pestana.
- Todo es un movimiento nuevo; nada se edita ni se borra (ajustes y conteos son contramovimientos).
- Pruebas: datos (modo de prueba), cliente falso de Supabase (argumentos exactos hacia `fx_inv_*`) y flujo en navegador.

## Segunda version (minimos, asignar, deshacer, notas, lotes, traslados)

- Minimos: pestana Minimos (tabla articulo x lugar, guardado con `fx_inv_articulo_guardar`) y campo en cada articulo de Existencias. La **sugerencia** de 15 articulos de Local Soda (`web/src/datos/minimos-sugeridos.js`) se muestra aparte y solo se aplica con un toque de aprobacion.
- Asignar articulo: en Recibir, cada linea sin equivalencia muestra la propuesta de la IA (`fx_ia_propuestas`, la mas reciente de Sonnet u Opus) con «Usar esta propuesta» o «Elegir otro articulo»; el factor se edita en la misma linea y Recibir recuerda la equivalencia (lo hace `fx_inv_recibir`).
- Deshacer una recepcion (`fx_inv_recepcion_deshacer`, solo si el lote no se uso) y notas de credito (`fx_inv_notas_proveedor`, `fx_inv_nota_devolver`, `fx_inv_nota_ignorar`), dentro de Recibir.
- Lotes y vencimientos: vencimiento opcional al recibir (`vence_en`), lotes por orden de vencimiento al tocar un articulo, alertas de vencidos con merma en dos toques.
- Stock por local: chip «Todos los lugares» en Existencias. Traslados Bodega central a local: en Sacar, «Llenar lo que falta» y, desde Alertas, «Reponer desde la bodega».
- Cada seccion abre con la linea de HOY. Los filtros y el buscador de cada seccion se conservan al cambiar de pestana.

## Que falta

- Verificarlo contra la base real con una cuenta que sea administradora del facturador (no se pudo: no hay cuentas de produccion y las funciones del facturador exigen una sesion real). La forma exacta de la sugerencia de articulo en `fx_inv_pendientes` se leyo del codigo; se lee de forma tolerante.
- Aprobar la sugerencia de minimos (Emil) y fijar los de Pollos cuando haya compras reales.
- Corregir la fecha de vencimiento de un lote ya recibido (el facturador no tiene funcion para eso; hoy se fija al recibir).
- Verificar con cuenta real: la forma de `fx_inv_lotes`, `fx_inv_articulos` y `fx_inv_notas_proveedor` se leyo del codigo SQL y se lee de forma tolerante.
- Operar con cajeros (hoy solo administradores).



## Lo que ya existe en el esquema fact (se reutiliza, no se duplica)

Dixiapp llama directamente a las funciones `public.fx_inv_*` del facturador (existencias, alertas, pendientes, recibir, salida, trasladar, conteos, ajustar, movimientos). Ya validan, auditan (`inv_aud`), son idempotentes (`p_idem`) y exigen que quien llama sea administrador del facturador. Por eso Bodega **no agrega nada a la base**.

El facturador ya tiene un inventario completo con prefijo `inv_` (73 articulos, 144 lotes, 211 movimientos al momento de revisar):

| Necesidad de Bodega | Ya existe en fact |
|---|---|
| Catalogo de articulos y unidad | `inv_articulos` (nombre, categoria, unidad, CABYS, vigencia), `inv_categorias` (con `grupo`), `inv_unidades` |
| Productos vendibles y sus factores | `productos` (+ `inv_articulo_producto`: cantidad de articulo que consume cada producto, con alternativas), `inv_producto_modo` |
| Enlaces unitarios 1:1 y porcionado | `inv_articulo_producto` (cantidad 1) y movimientos `porcion_salida` / `porcion_entrada` |
| Local y bodega | `inv_ubicaciones`: BODEGA_CENTRAL (bodega), LOCAL_SODA y LOCAL_POLLOS (locales ligados a sociedad) |
| Existencias | `inv_lotes` (cantidad_actual por articulo y ubicacion, costo, vencimiento); existencia = suma de lotes (`inv_existencia`) |
| Historial | `inv_movimientos` (tipos: entrada_factura, entrada_manual, traslado, consumo, merma, devolucion, ajuste_conteo, ajuste_manual, venta, ...) |
| Entradas desde facturas de proveedores | `inv_recepcion_lineas` + `inv_equivalencias` (proveedor + CABYS + descripcion -> articulo y factor) + `inv_regla_cabys` |
| Conteo fisico y ajustes | `inv_conteos` + `inv_conteo_lineas` (esperado al iniciar, esperado al contar, contado, ajuste) |
| Minimos y alertas | `inv_minimos` (articulo x ubicacion), `inv_al_minimos`, `inv_al_vencen`, `inv_al_vencidos`, `inv_alertas_atendidas` |
| Descuento por venta | `inv_descontar_venta`, `inv_revertir_venta`, `inv_venta_consumo` |
| Idempotencia | `inv_idem` (evita doble envio al reintentar) |

Conclusion: la logica de negocio ya esta escrita y probada en funciones SQL del facturador. Bodega en Dixiapp es una capa de captura rapida en tableta sobre esa logica, no un inventario nuevo.

## Como se conecta sin tocar fact

Las funciones `fx_inv_*` son SECURITY DEFINER y comprueban en `fx_chk()` que la sesion sea de un usuario activo del facturador y, para inventarios, administrador. Dixiapp las llama con el mismo usuario de Supabase Auth, sin intermediarios: la cuenta de Dixiapp de la administradora debe ser tambien administradora del facturador. No se crean funciones `dixi.bodega_*`; eso evita duplicar reglas de costos, lotes y vencimientos.

## En la app

La app ya se organiza por modulos: cada modulo aporta una pestana, sus metodos en el contrato de datos y su vista. Bodega seria un cuarto modulo (`bodega`) con su propio bloque de metodos en `interfaz.js` y su implementacion de prueba, igual que Compras. La capa de datos de prueba permite construir y probar la pantalla sin base.

## Pantallas (tableta, pocos toques)

Una sola pestana Bodega con selector de ubicacion arriba (Bodega central, Local Soda, Local Pollos), simetrico y con texto grande:

1. Existencias: lista por categoria con cantidad, unidad y un indicador de minimo (en rojo si esta bajo). Buscar por nombre.
2. Entradas: lista de lineas pendientes de facturas recibidas ya mapeadas por `inv_equivalencias`. Un toque en "Recibir" confirma cantidad y destino (precargada). Lineas sin equivalencia salen aparte con una sugerencia (`inv_sugerencia`).
3. Salidas: tocar articulo, teclado numerico, elegir motivo con fichas (Consumo, Merma, Traslado a local, Devolucion). Dos toques mas el monto.
4. Conteo fisico: lista del conteo abierto; para cada articulo se escribe lo contado; al cerrar se muestra el ajuste y se confirma (usa `inv_conteos`). Para cajeros el conteo es ciego (no ven el esperado), igual que el cierre de caja.
5. Alertas: bajo minimo, por vencer y vencidos (`inv_al_*`), con "atendida" (`inv_alertas_atendidas`).

## Orden recomendado para lo que falta

Recomendacion: **Existencias + alertas de minimos (solo lectura)**, luego **Salidas/consumos**, luego **Conteo fisico**, y al final **Entradas desde facturas** (es la mas delicada porque toca costos y equivalencias).

Razon: lectura primero valida permisos, el contrato de datos y la pantalla sin riesgo de escribir mal en el inventario del facturador. Los minimos estan vacios (`inv_minimos` tiene 0 filas), asi que la primera utilidad real exige que Emil los defina.

## Decisiones que necesito de Emil

1. **Quien captura**: solo administradores o tambien cajeros/bodegueros. Recomendacion: empezar solo administradores (igual que Compras) y habilitar el rol `empleado`, ya soportado en el esquema, cuando se pruebe el conteo ciego.
2. **Que bodegas y locales**: confirmar que BODEGA_CENTRAL, LOCAL_SODA y LOCAL_POLLOS son todas las ubicaciones. Recomendacion: usarlas tal cual y no crear otras en Dixiapp.
3. **Minimos**: valores por articulo y ubicacion (hoy no hay ninguno). Recomendacion: empezar con 10 articulos criticos de Pollos y Soda y ampliar.
4. **Entradas**: confirmar o recibir automaticamente las lineas de facturas con equivalencia conocida. Recomendacion: confirmacion con un toque al inicio; automatico solo para equivalencias con muchos usos.
5. **Ajustes de conteo**: quien puede aprobar diferencias y desde que monto. Recomendacion: el administrador aprueba siempre; el cajero solo cuenta.
6. **Costos visibles**: si los cajeros ven costo y valor del inventario. Recomendacion: no (solo cantidades), igual que las ventas en la caja.
7. **Convivencia con el panel actual del facturador**: si el inventario se seguira capturando tambien en panel.dmalabomba.com. Recomendacion: si, durante la transicion, porque ambos escriben en las mismas tablas con idempotencia.
8. **Dispositivo**: tableta fija en la bodega o compartida. Recomendacion: una tableta por local con PIN local por aparato (ya disenado).
