// SUGERENCIA de minimos para Local Soda. NO se aplica sola: la pantalla "Minimos" la muestra y Emil decide.
// Origen: facturas recibidas de los ultimos 120 dias (2026-07-08 a 2026-10-31) cruzadas con la memoria de equivalencias del facturador
// (cantidad comprada x factor, por articulo). Es el mejor indicador de consumo real disponible hoy: el descuento por venta lleva pocos dias.
// Regla: minimo = consumo de 3 dias (compra semanal / 7 x 3), redondeado hacia arriba al multiplo de 6 (media caja). Entre 2 y 3 entregas por semana.
// Pollos La Bomba aun no tiene compras reales: no se sugiere nada para ese local hasta que haya datos.
export const SUGERENCIA_MINIMOS = {
  nota: 'Consumo estimado con las compras de los últimos 120 días (no son ventas). Mínimo = 3 días de consumo, redondeado a media caja.',
  ubicacionTipo: 'soda',
  items: [
    { articuloId: 'be86767c-609b-40c3-ab9b-0d1f2b2f14ab', articulo: 'Coca-Cola 600 mL PET', porSemana: 289.5, minimo: 126 },
    { articuloId: '13a85028-3250-465d-8ff7-a5ac7e2f3d72', articulo: 'Coca-Cola Sin Azúcar 600 mL PET', porSemana: 61.3, minimo: 30 },
    { articuloId: 'f1b3afcd-b0e5-4cd8-b41f-9a56aced2788', articulo: 'Jet 600 mL PET', porSemana: 57.9, minimo: 30 },
    { articuloId: '2afb9175-42b7-4153-94be-aa1c55a5c135', articulo: 'Canada Dry Ginger Ale 600 mL PET', porSemana: 47.1, minimo: 24 },
    { articuloId: '35c2071e-82a9-4b4a-b310-a82c0674b0b9', articulo: 'Coca-Cola 355 mL PET', porSemana: 46.1, minimo: 24 },
    { articuloId: '2f69486b-7b39-49ee-8013-aedd4c49c9b2', articulo: 'Tropical Té Frío Melo 500 mL PET', porSemana: 45.0, minimo: 24 },
    { articuloId: '482ba895-1661-44c9-9514-3548a01d236b', articulo: 'Fresca Toronja 600 mL PET', porSemana: 36.4, minimo: 18 },
    { articuloId: 'b7e99971-9d72-4965-b508-e02f39603377', articulo: 'Fanta Uva 600 mL PET', porSemana: 33.5, minimo: 18 },
    { articuloId: '3025c02f-abb4-48bf-8134-8da2fb777dae', articulo: 'Tropical Té Blanco 500 mL PET', porSemana: 32.2, minimo: 18 },
    { articuloId: '83af4dcb-e9b6-46ca-96a3-a3dc0e381ed1', articulo: 'Fanta Kolita 600 mL PET', porSemana: 28.5, minimo: 18 },
    { articuloId: '02d191f1-fb40-4638-bf6a-6ff19b6e443f', articulo: 'Fanta Naranja 600 mL PET', porSemana: 21.9, minimo: 12 },
    { articuloId: '74a83fc2-0e4d-4c5d-9518-5115ef54c391', articulo: 'Agua Cristal 1 L PET', porSemana: 20.4, minimo: 12 },
    { articuloId: '02c263ad-f697-4edc-8464-378f3494518f', articulo: 'Fresca 355 mL PET', porSemana: 20.0, minimo: 12 },
    { articuloId: 'f40dae0d-f66e-4e72-ba7c-8e7f0516c94a', articulo: 'Coca-Cola 1,5 L PET', porSemana: 19.3, minimo: 12 },
    { articuloId: '611e516c-588d-4f33-ab60-413b49f8c65a', articulo: 'Canada Dry Ginger Ale 355 mL PET', porSemana: 18.7, minimo: 12 },
  ],
};
