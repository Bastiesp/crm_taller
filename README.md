# 🔧 BGarage — Sistema de Gestión de Taller

Sistema de gestión para taller automotriz. Presupuestos con PDF, control de reparaciones con Kanban e informes descargables.

## Deploy en Vercel

1. Sube este repositorio a GitHub
2. Importa en vercel.com
3. Agrega variable de entorno: `NODE_ENV=production`
4. Deploy ✅

## Desarrollo local

```bash
npm install
npm run dev
# Abre http://localhost:3000
```

## Funcionalidades

- ✅ Presupuestos con datos de cliente + vehículo + ítems (mano de obra / repuestos)
- ✅ PDF de presupuesto con logo, firma y datos del taller
- ✅ Guardar, editar, reabrir y eliminar presupuestos
- ✅ Kanban de reparaciones: En reparación → Presupuesto enviado → Entregado
- ✅ Informe PDF de reparación completada con detalle y total
- ✅ Firma automática: Bastian Espinoza F. / +56 9 5935 5607
