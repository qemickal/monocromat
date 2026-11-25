# Base de datos: preparación

`schema.sql` es una propuesta inicial no ejecutada. La app actual todavía usa almacenamiento local y no está conectada a Neon. No ejecutar en producción sin revisar la migración y hacer pruebas.

Antes de usar datos reales: implementar autenticación segura y autorización en cada operación, hash de contraseñas resistente a ataques (Argon2id o scrypt), sesiones seguras, límites de intentos y recuperación de cuenta; transacciones y bloqueo para impedir sobrepagos simultáneos; verificar autorización de empaque al registrar una entrega; crear respaldos y probar restauración. Separar las bases de desarrollo/pruebas y producción. No exponer la cadena de conexión al navegador.
