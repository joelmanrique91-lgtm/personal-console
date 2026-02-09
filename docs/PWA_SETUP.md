# PWA Setup

## Instalabilidad (Desktop)
1) Ejecutar `npm run build`.
2) Ejecutar `npm run preview -- --host 0.0.0.0 --port 4173`.
3) Abrir `http://localhost:4173/` en Chrome.
4) Verificar botón “Install” en la barra de direcciones.

## Instalabilidad (Android)
1) Con el preview corriendo, acceder desde el teléfono a la URL publicada (LAN o túnel).
2) En Chrome Android, abrir el menú y elegir **“Agregar a pantalla principal”**.

## Verificación offline (DevTools)
1) Abrir DevTools → Application → Service Workers y verificar que esté registrado.
2) Ir a DevTools → Network → marcar **Offline**.
3) Recargar la página y verificar que el app shell cargue.
