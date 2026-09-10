# Crucigrama Multijugador 🧩

Plataforma web de crucigramas multijugador en tiempo real. Compite con amigos, elige categorías y juega en modo contrarreloj o libre.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Backend | Node.js · Express · Socket.io |
| Frontend | React 18 · Vite · React Router |
| BD persistente | PostgreSQL 16 |
| Estado efímero | Redis 7 |
| Entorno dev | Docker Compose |

---

## Requisitos previos

- [Node.js](https://nodejs.org/) v18+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (para PostgreSQL y Redis)

---

## Etapa 0 — Levantar el entorno de desarrollo

### 1. Clonar el repo y copiar variables de entorno

```bash
git clone <url-del-repo>
cd crucigrama

# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env
```

Edita `backend/.env` con tus valores (en desarrollo puedes dejar los defaults).

### 2. Levantar PostgreSQL y Redis con Docker

```bash
docker compose up -d
```

Verifica que los dos contenedores estén healthy:

```bash
docker compose ps
```

### 3. Instalar dependencias

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 4. Correr backend y frontend

En terminales separadas:

```bash
# Terminal 1 — Backend (http://localhost:3001)
cd backend && npm run dev

# Terminal 2 — Frontend (http://localhost:5173)
cd frontend && npm run dev
```

### 5. Verificar que funciona

```bash
curl http://localhost:3001/health
# → {"status":"ok","service":"crucigrama-backend",...}
```

---

## Correr tests

```bash
cd backend && npm test
```

---

## Variables de entorno

Ver [`backend/.env.example`](./backend/.env.example) y [`frontend/.env.example`](./frontend/.env.example) para la lista completa con descripción de cada variable.

---

## Etapas del proyecto

| Etapa | Qué produce | Estado |
|---|---|---|
| **0** | Esqueleto del proyecto | ✅ Completo |
| 1 | Esquema PostgreSQL | 🔜 |
| 2 | Estado en Redis | 🔜 |
| 3 | API de categorías/partidas | 🔜 |
| 4 | Unión de invitados | 🔜 |
| 5 | Tiempo real (grid) | 🔜 |
| 6 | Modos de juego | 🔜 |
| 7 | Leaderboard en vivo | 🔜 |
| 8 | Chat | 🔜 |
| 9 | Frontend completo | 🔜 |
| 10 | Concurrencia y despliegue | 🔜 |

---

## Estructura del repositorio

```
crucigrama/
├── backend/
│   ├── src/
│   │   ├── index.js        # Entry point (HTTP + Socket.io)
│   │   ├── app.js          # Express app y middlewares
│   │   └── routes/
│   │       └── health.js   # GET /health
│   ├── __tests__/
│   │   └── health.test.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   └── HomePage.css
│   │   └── styles/
│   │       └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── .env.example
│   └── package.json
├── docker-compose.yml
├── .gitignore
└── README.md
```
