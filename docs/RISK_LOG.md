# Risk Log

## Riesgos técnicos y de producto

### R1 — No instalable como PWA (impacto alto)
**Mitigación:** agregar manifest + icons + service worker.
**Verificación:** Lighthouse PWA y prueba de instalación en Android/Desktop.

### R2 — UX móvil limitada (impacto medio)
**Mitigación:** diseño mobile-first con targets táctiles y navegación simplificada.
**Verificación:** pruebas manuales en viewport 360x640 y 390x844.

### R3 — Accesibilidad insuficiente (impacto medio)
**Mitigación:** focus visible, dialog accesible, keyboard navigation.
**Verificación:** navegación completa con teclado y lector de pantalla básico.

### R4 — Persistencia sin migraciones (impacto medio)
**Mitigación:** versionado de `AppState` y migraciones.
**Verificación:** cargar datos antiguos en build nuevo sin errores.

### R5 — Importación JSON sin validación (impacto medio)
**Mitigación:** validación de tamaño y estructura del archivo.
**Verificación:** importar JSON inválido y comprobar errores manejados.

## Suposiciones (y cómo verificarlas)
- Uso principal offline/local → validar con usuarios en móvil.
- No hay backend → confirmar si habrá sync a futuro.
- Volumen de tareas moderado → testear con 500+ tareas.

## Dependencias externas
- `localforage` (IndexedDB).
- `react`, `react-dom`.
- Vite para build.
