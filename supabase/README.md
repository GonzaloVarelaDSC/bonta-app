# Conectar Supabase — paso a paso

Seguir el orden. Cada paso dice si es "en el dashboard de Supabase" o "en tu compu / con el código".

## 1. Credenciales (dashboard)

`Project Settings` → `API`. Copiá dos valores:

- **Project URL** (algo como `https://xxxxx.supabase.co`)
- **anon public key** (una key larga, empieza distinto a la `service_role`)

**Nunca copies ni compartas la `service_role key`** — esa key se salta todos los permisos (RLS) y solo debería vivir en el dashboard de Supabase. Con la `anon public key` alcanza para todo lo que hace esta app: está diseñada para exponerse en el frontend, la seguridad real la ponen las políticas RLS del paso 3.

## 2. Esquema de base de datos (dashboard)

`SQL Editor` → `New query`. Pegar y correr, **en este orden**, cada uno de estos archivos:

1. `001_schema.sql` — crea todas las tablas.
2. `002_policies.sql` — activa Row Level Security y las políticas por rol.
3. `003_seed_catalogs.sql` — carga tipos de trabajo y materiales (no depende de usuarios).

## 3. Bucket de archivos (dashboard)

`Storage` → `New bucket` → nombre `job-files` → **privado** (no marcar "Public bucket"). El acceso a los archivos lo controla la app a través de las políticas de la base, no hace falta que el bucket sea público.

## 4. Crear los 8 usuarios (dashboard)

`Authentication` → `Users` → `Add user` → `Create new user`. Para cada uno: email, una contraseña (se la vas a pasar vos a cada persona, después la pueden cambiar), y **tildar "Auto Confirm User"** para que no dependa de que revisen un mail de confirmación.

Crear estos 8, con estos emails exactos (los scripts de seed los buscan por email):

| Email | Nombre | Rol |
|---|---|---|
| marcela@estudiobonta.com | Marcela Bonta | Administrador |
| juan@estudiobonta.com | Juan Pérez | Coordinador / Producción |
| maria@estudiobonta.com | María Gómez | Diseño |
| lucia@estudiobonta.com | Lucía Fernández | Diseño |
| pedro@estudiobonta.com | Pedro Ramírez | Producción |
| diego@estudiobonta.com | Diego Sosa | Producción |
| nahuel@estudiobonta.com | Nahuel Torres | Instalación |
| gonzalo@estudiobonta.com | Gonzalo Varela | Coordinador / Producción |

(Podés usar tus emails reales del equipo en vez de estos — si lo hacés, ajustá `004_seed_profiles.sql` con los emails reales antes de correrlo.)

Cada usuario que crees dispara automáticamente la creación de su fila en `profiles` (por el trigger de `001_schema.sql`), con rol `produccion` por defecto.

## 5. Completar roles y datos de prueba (dashboard)

De vuelta en `SQL Editor`, correr en orden:

4. `004_seed_profiles.sql` — asigna el rol, nombre y sector correctos a cada usuario. Al final te muestra una tabla de verificación: tiene que haber 8 filas.
5. `005_seed_demo_data.sql` — carga los clientes y 10 trabajos de prueba con distintos estados, prioridades, un bloqueo, un atrasado, comentarios, archivos y control de calidad.

## 6. Conectar la app (tu compu / con el código)

En la carpeta del proyecto, crear un archivo `.env.local` (nunca se sube a git) con:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=la-anon-key-del-paso-1
```

Instalar la dependencia nueva y correr:

```bash
npm install
npm run dev
```

Ahora el login pide contraseña real (la que le pusiste a cada usuario en el paso 4) — ya no hay botones de "acceso rápido" con contraseña compartida.

## Si algo falla

- **"No se puede iniciar sesión"**: revisá que el usuario tenga "Auto Confirm User" tildado, o confirmalo manualmente desde `Authentication` → `Users`.
- **La tabla de trabajos aparece vacía para todos**: revisá que `004_seed_profiles.sql` haya encontrado los 8 emails (si no, corrió el `raise exception` y te avisa cuál falta).
- **Un usuario ve trabajos que no debería, o no ve los suyos**: revisá su `role` en la tabla `profiles` — las políticas RLS dependen de ese campo.
