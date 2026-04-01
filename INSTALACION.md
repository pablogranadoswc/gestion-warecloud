# Guía de instalación — Gestión Financiera
## Supabase + Netlify

---

## PASO 1 — Crear proyecto en Supabase

1. Ir a https://supabase.com y crear una cuenta gratuita
2. Hacer clic en **"New project"**
3. Elegir nombre (ej: `gestion-financiera`) y una contraseña para la base de datos
4. Seleccionar región **South America (São Paulo)** para menor latencia
5. Esperar ~2 minutos a que el proyecto esté listo

---

## PASO 2 — Crear la tabla en Supabase

1. En el panel izquierdo ir a **SQL Editor**
2. Hacer clic en **"New query"**
3. Copiar y pegar todo el contenido del archivo `supabase_schema.sql`
4. Hacer clic en **Run** (botón verde)
5. Debe aparecer el mensaje: *"Success. No rows returned"*

---

## PASO 3 — Obtener las credenciales de Supabase

1. En el panel izquierdo ir a **Settings → API**
2. Copiar los siguientes valores:
   - **Project URL** → empieza con `https://...supabase.co`
   - **anon / public key** → clave larga que empieza con `eyJ...`

---

## PASO 4 — Configurar la app

1. Abrir el archivo `js/config.js`
2. Reemplazar los valores:

```js
const SUPABASE_URL = 'https://TU-PROJECT-ID.supabase.co';   // ← tu Project URL
const SUPABASE_ANON_KEY = 'eyJ...';                          // ← tu anon key
```

3. Guardar el archivo

---

## PASO 5 — Publicar en Netlify

1. Ir a https://netlify.com y crear una cuenta gratuita
2. Desde el dashboard, hacer clic en **"Add new site → Deploy manually"**
3. **Arrastrar la carpeta completa** `gestion-financiera` al área de drop
4. Netlify va a generar una URL automáticamente (ej: `https://nombre-random.netlify.app`)
5. ¡Listo! La app ya está online

---

## PASO 6 — Crear tu cuenta en la app

1. Abrir la URL de Netlify en el navegador
2. Ingresar tu email y una contraseña (mínimo 6 caracteres)
3. Hacer clic en **"Crear cuenta"**
4. Revisar el email para confirmar la cuenta (puede estar en spam)
5. Volver a la app y hacer clic en **"Ingresar"**

---

## PASO 7 (opcional) — Poner tu propio dominio

1. En Netlify ir a **Site settings → Domain management**
2. Hacer clic en **"Add custom domain"**
3. Seguir las instrucciones para apuntar tu dominio

---

## Estructura de archivos

```
gestion-financiera/
├── index.html              ← app principal
├── css/
│   └── style.css           ← estilos
├── js/
│   ├── config.js           ← ← ← COMPLETAR CON TUS CREDENCIALES
│   └── app.js              ← lógica de la app
└── supabase_schema.sql     ← SQL para crear la tabla (solo se usa una vez)
```

---

## Solución de problemas frecuentes

**No puedo ingresar / dice "Invalid login credentials"**
→ Asegurate de haber confirmado el email. Revisá la carpeta de spam.

**Los datos no se guardan**
→ Verificá que el SQL del schema se ejecutó correctamente en Supabase. Revisá que las credenciales en `config.js` sean correctas.

**La app no carga después de publicar en Netlify**
→ Asegurate de haber subido la carpeta completa, incluyendo las subcarpetas `css/` y `js/`.

---

¿Dudas? Consultale a Claude con el error exacto que aparece en pantalla.
