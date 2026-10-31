# Vestigio en Android

La app de Android sale del mismo código que la de escritorio, con Tauri v2. El proyecto generado vive en `src-tauri/gen/android/`.

## Compilar un APK

Requisitos: Android SDK (plataforma 36), NDK 27, Java 21, Rust y **unos 6 GB libres**.

```powershell
./scripts/android-build.ps1 -Arch aarch64 -Profile release   # para teléfonos
./scripts/android-build.ps1 -Arch x86_64  -Profile debug     # para el emulador
```

El script existe porque `tauri android build` crea un enlace simbólico que en Windows exige el Modo de desarrollador. Con ese modo activado, también sirve `npm run tauri android build`.

Las URLs y los secretos de `.env.local` quedan dentro del APK, igual que en el instalador de escritorio.

## Firma

Android solo instala APK firmados. El release se firma si existe `src-tauri/gen/android/keystore.properties` (ignorado por git):

```properties
storeFile=C:/ruta/absoluta/vestigio-release.jks
storePassword=...
keyAlias=vestigio
keyPassword=...
```

**Guarda el `.jks` y sus contraseñas fuera del repositorio y con copia de seguridad.** Si se pierden, las actualizaciones de la app ya no se podrán instalar encima de la versión existente.

## Qué cambia frente al escritorio

| Función | En Android |
|---|---|
| Diseño | Por debajo de 820 px: barra inferior, cabecera con el proyecto y detalles a pantalla completa |
| Revivir | Desde el botón de detalles: arrastrar una tarjeta competiría con el desplazamiento de la lista |
| Acceso con Google | No disponible: su flujo necesita un servidor local de retorno. Se usan cuentas locales |
| Archivos vinculados | No disponibles: Android no da rutas estables a archivos externos |
| Vista previa de PDF | No disponible: el WebView no tiene visor. Se usa «Guardar como» |
| Backups y exportaciones | Pasan por el selector de archivos del sistema |
| Restaurar un backup | La app se cierra y el backup se aplica al volver a abrirla |
| Botón Atrás | Cierra lo que esté encima, vuelve a la galería y, por último, sale de la app |

Los datos viven en el almacenamiento privado de la app: **desinstalarla los borra**, salvo que exista un backup.

## Probar en el emulador

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd HP_Telefono
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r <ruta-al-apk>
```

El APK de x86_64 solo funciona en el emulador; el de `aarch64` es el de los teléfonos.
