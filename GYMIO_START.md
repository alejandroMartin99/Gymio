# Gymio - Documento Base de Inicio

Guia inicial para arrancar `Gymio` reutilizando la base tecnica y de producto de `BankaAppTracker`.

---

## 1) Objetivo del starter

Este documento define:

- Stack tecnologico base (Frontend, Backend, Auth, Deploy).
- Estructura inicial recomendada de carpetas.
- Componentes UX/UI a reutilizar desde la app actual.
- Convenciones de desarrollo para construir rapido y sin deuda desde el dia 1.

---

## 2) Stack tecnologico (misma filosofia que BankaAppTracker)

- Frontend: `Angular` (standalone components, SCSS).
- Backend API: `FastAPI` (Python).
- Base de datos + Auth: `Supabase`.
- Deploy Backend: `Render`.
- Deploy Frontend: `Vercel`.

### Principios

- Misma separacion clara: frontend en Vercel, API en Render.
- Supabase como proveedor unico de autenticacion y datos.
- API backend con endpoints bien acotados por dominio.
- UI mobile-first con foco en rapidez y claridad.

---

## 3) Estructura inicial del repo (propuesta)

```text
Gymio/
├── Backend/                         # Root de Render
│   ├── app/
│   │   ├── api/
│   │   │   ├── routers/             # Endpoints por dominio
│   │   │   │   ├── auth.py
│   │   │   │   ├── workouts.py
│   │   │   │   ├── exercises.py
│   │   │   │   ├── plans.py
│   │   │   │   └── progress.py
│   │   │   └── schemas/             # Pydantic models
│   │   ├── services/
│   │   │   ├── supabase/
│   │   │   │   └── supabase_service.py
│   │   │   └── workouts/
│   │   ├── core/                    # settings, auth deps, errors
│   │   └── main.py
│   ├── requirements.txt
│   ├── .env.example
│   └── render.yaml
│
├── Frontend/
│   └── gymio-app/                   # Root de Vercel
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout/          # shell + bottom navbar + header
│       │   │   ├── pages/
│       │   │   │   ├── login/
│       │   │   │   ├── dashboard/
│       │   │   │   ├── workouts/
│       │   │   │   ├── plans/
│       │   │   │   ├── progress/
│       │   │   │   └── profile/
│       │   │   ├── services/        # auth, api, privacy, session
│       │   │   ├── models/
│       │   │   ├── guards/
│       │   │   ├── utils/
│       │   │   └── shared/          # botones, cards, modals, chips
│       │   ├── environments/
│       │   └── styles.scss
│       ├── package.json
│       └── vercel.json
│
├── README.md
└── GYMIO_STARTER.md
```

---

## 4) Reutilizable de BankaAppTracker (base UX y arquitectura)

### 4.1 Navegacion y layout

- `Navbar inferior` como patron principal mobile.
- `Layout shell` con header superior + acciones globales.
- Sistema de rutas protegidas con redireccion a login.

### 4.2 Autenticacion

- Login con Supabase.
- Manejo de sesion local robusto (evitar estados "limbo").
- Logout inmediato en UI + limpieza de token local + redireccion a login.

### 4.3 Perfil de usuario

- Modulo de perfil con foto y datos basicos.
- Avatar/foto en header o seccion de perfil.
- Nombre visible con fallback seguro si falta metadata.

### 4.4 Sistema visual

- Tipografia y escala visual consistente (misma linea de estilo).
- Componentes reutilizables: chips, cards, modales, botones pill.
- Estados comunes: loading overlay, empty state, error state.

### 4.5 Servicios frontend

- `AuthService` (sesion + token).
- `PrivacyService` (estado global de privacidad, si aplica en Gymio).
- `Api services` por dominio (`workout.service`, `plan.service`, etc.).

### 4.6 Backend patterns

- Routers por dominio + capa de servicios.
- Dependencia `get_current_user` para proteger endpoints.
- Respuestas consistentes (`success`, `data`, `count`, `detail` en error).
- Integracion Supabase centralizada en `supabase_service.py`.

---

## 5) Modelo funcional minimo (MVP de Gymio)

### 5.1 Modulos iniciales

- Auth: registro/login/logout.
- Workouts: crear entrenamiento y registrar series/repeticiones/peso.
- Exercises: catalogo de ejercicios (base + personalizados).
- Plans: rutinas semanales.
- Progress: historico y evolucion (volumen total, PRs, frecuencia).
- Profile: datos de usuario y foto.

### 5.2 Rutas frontend sugeridas

- `/login`
- `/dashboard`
- `/workouts`
- `/plans`
- `/progress`
- `/profile`

---

## 6) Convenciones tecnicas (arranque limpio)

### Frontend (Angular)

- Componentes standalone.
- Logica de datos en services; componentes lo mas declarativos posible.
- Tipado fuerte en modelos.
- Estilos por pagina y shared UI en `shared/`.
- Sin logica de negocio pesada en templates.

### Backend (FastAPI)

- Un router por agregado funcional.
- Schemas de request/response en `api/schemas`.
- Servicios puros para logica (evitar meter todo en routers).
- Manejo centralizado de errores (helpers utilitarios).

### Datos

- IDs UUID.
- Campos `created_at`, `updated_at`.
- RLS habilitado en tablas de usuario.
- Politicas claras: cada usuario solo ve/modifica sus datos.

---

## 7) Variables de entorno base

### Backend (`Backend/.env`)

```env
ENVIRONMENT=development
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

### Frontend (`environment.ts` / `environment.prod.ts`)

```ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000'
};
```

En produccion:

```ts
apiUrl: 'https://<gymio-backend>.onrender.com'
```

---

## 8) Plan de implementacion recomendado (orden)

1. Base repo + entornos + CI minima (build frontend/backend).
2. Auth end-to-end (login/logout/rutas protegidas).
3. Layout completo con navbar inferior + perfil.
4. CRUD de workouts.
5. CRUD de planes.
6. Panel de progreso.
7. Pulido UI/UX y rendimiento.

---

## 9) Checklist de "Definition of Ready" para comenzar

- [ ] Supabase creado con esquema inicial.
- [ ] Variables de entorno definidas (local y cloud).
- [ ] Backend corriendo en local (`/test` o `/health` OK).
- [ ] Frontend Angular levantado y conectado a backend.
- [ ] Login funcional con redireccion.
- [ ] Layout base + navbar inferior operativos.
- [ ] Perfil con foto/nombre visible.

---

## 10) Nota de reutilizacion practica

Para arrancar rapido en `Gymio`, conviene portar primero estos bloques de la app actual:

1. Estructura de `layout` y navegacion inferior.
2. Servicio de autenticacion y proteccion de rutas.
3. Estilo tipografico y componentes base (botones/cards/modales/chips).
4. Patron de servicios Angular + modelos tipados.
5. Estructura de routers FastAPI + servicio Supabase.

Con eso, `Gymio` empieza con una base solida de producto y tecnologia desde el primer sprint.

