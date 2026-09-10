# 🧩 Crucigrama Multijugador

Plataforma de crucigramas en tiempo real para múltiples jugadores. Los equipos compiten simultáneamente resolviendo el mismo tablero, con un leaderboard en vivo y chat integrado.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTE (React)                       │
│  SelectPage → LobbyPage → GamePage ← → ResultsPage          │
│          Socket.io-client + Axios REST                       │
└─────────────────┬──────────────────────────┬────────────────┘
                  │ HTTP/WS (proxy Vite/nginx)│
┌─────────────────▼──────────────────────────▼────────────────┐
│                   BACKEND (Node.js + Express)                │
│                                                              │
│   REST API ──────► /api/categories                          │
│                    /api/games (CRUD + join + leaderboard)    │
│                                                              │
│   Socket.io ─────► game:join   → game:state                 │
│   (rooms por       cell:update → cell:updated + stats:update │
│    gameId)         chat:message → chat:message               │
│                    disconnect  → player:left                 │
│                                                              │
│   GameManager ───► Timers, checkWinCondition, endGame        │
└──────────┬───────────────────────────────────────────────────┘
           │
     ┌─────▼──────┐   ┌──────────────────┐
     │ PostgreSQL  │   │      Redis        │
     │  (Prisma)  │   │  Estado efímero   │
     │ Datos       │   │  Grid, Timers,    │
     │ persistentes│   │  Players en vivo  │
     └────────────┘   └──────────────────┘
```

### Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + React Router v6 |
| API REST | Node.js + Express |
| Tiempo real | Socket.io 4 |
| Base de datos | PostgreSQL + Prisma ORM |
| Estado efímero | Redis 7 |
| Infraestructura | Docker + Docker Compose |

---

## Primeros Pasos (Desarrollo)

### Requisitos previos
- Node.js ≥ 18
- Docker Desktop

### 1. Clonar el repositorio
```bash
git clone <url-del-repo>
cd Crucigrama
```

### 2. Levantar PostgreSQL y Redis
```bash
docker compose up -d
```

### 3. Configurar el backend
```bash
cd backend
cp .env.example .env
# Edita .env con tus valores si es necesario
```

### 4. Inicializar la base de datos
```bash
# Ejecutar migraciones
npx prisma migrate deploy

# Poblar con datos de ejemplo (categorías y crucigramas)
node prisma/seed.js
```

### 5. Iniciar el backend
```bash
npm run dev
# Escucha en http://localhost:3001
```

### 6. Iniciar el frontend (en otra terminal)
```bash
cd ../frontend
npm install
npm run dev
# Abre http://localhost:5173
```

---

## Variables de Entorno

### Backend (`backend/.env`)

| Variable | Ejemplo | Descripción |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@localhost:5432/crucigrama` | Cadena de conexión PostgreSQL |
| `REDIS_URL` | `redis://localhost:6379` | URL de Redis |
| `SESSION_SECRET` | `un-secreto-muy-largo` | Clave para firmar tokens HMAC-SHA256 |
| `PORT` | `3001` | Puerto del servidor (default: 3001) |
| `NODE_ENV` | `development` | Entorno (`development` / `production`) |

### Frontend (`frontend/.env`)
Sin variables requeridas en desarrollo. El proxy de Vite redirige `/api` y `/socket.io` al backend automáticamente.

---

## API REST

### Categorías
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/categories` | Lista todas las categorías con conteo de crucigramas |

### Partidas
| Método | Ruta | Body | Descripción |
|---|---|---|---|
| `POST` | `/api/games` | `{ categoryId, mode, duration? }` | Crea una partida nueva |
| `GET` | `/api/games/:gameId` | — | Metadata de la partida |
| `POST` | `/api/games/:gameId/join` | `{ name }` | Un invitado se une, recibe token |
| `GET` | `/api/games/:gameId/leaderboard` | — | Clasificación final (solo partidas FINISHED) |

---

## Eventos Socket.io

### Cliente → Servidor
| Evento | Payload | Descripción |
|---|---|---|
| `game:join` | `{ gameId, token }` | Autenticar y unirse a la room |
| `cell:update` | `{ gameId, token, row, col, letter }` | Actualizar una celda |
| `chat:message` | `{ gameId, token, text }` | Enviar mensaje de chat |

### Servidor → Cliente
| Evento | Payload | Descripción |
|---|---|---|
| `game:state` | `{ status, grid, players }` | Estado completo al conectarse |
| `cell:updated` | `{ row, col, letter, playerId, correct }` | Celda actualizada en tiempo real |
| `stats:update` | `[{ rank, playerId, name, score }]` | Ranking en vivo tras cada acierto |
| `chat:message` | `{ playerId, name, text, timestamp }` | Mensaje de chat difundido |
| `timer:sync` | `{ timeLeft }` | Segundos restantes (modo TIMED) |
| `game:ended` | `{ gameId, reason, players }` | Fin de partida (`COMPLETED`/`TIME_UP`) |
| `player:joined` | `{ playerId, name }` | Nuevo jugador en la room |
| `player:left` | `{ playerId, name }` | Jugador desconectado |
| `error` | `{ message }` | Error de autenticación u otro |

---

## Tests

```bash
cd backend

# Todos los tests (unitarios + integración)
npm test

# Solo tests de API REST
npx jest --testPathPattern=api

# Solo tests de Socket.io
npx jest --testPathPattern=socket

# Prueba de carga (requiere backend corriendo)
node scripts/loadTest.js 10 4
```

**Suite completa: 61 tests en 7 archivos.**

---

## Despliegue en Producción

### Con Docker Compose

1. Crear el archivo `.env` en la raíz del proyecto:
```env
POSTGRES_PASSWORD=tu_contraseña_segura
SESSION_SECRET=secreto_largo_y_aleatorio_minimo_32_chars
DATABASE_URL=postgresql://crucigrama_user:tu_contraseña_segura@postgres:5432/crucigrama
REDIS_URL=redis://redis:6379
```

2. Levantar todos los servicios:
```bash
docker compose -f docker-compose.prod.yml up -d
```

3. Ver logs:
```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

### Estructura de contenedores en producción

| Servicio | Imagen | Puerto |
|---|---|---|
| `postgres` | postgres:16-alpine | interno |
| `redis` | redis:7-alpine | interno |
| `backend` | Node.js 18 (custom) | 3001 |
| `frontend` | nginx + build estático | 80/443 |

### Escalabilidad

Para escalar el backend horizontalmente (múltiples instancias), es necesario:
- Migrar el `socketDataMap` y `chatRateMap` (actualmente en memoria) a Redis usando el **[adaptador de Redis de Socket.io](https://socket.io/docs/v4/redis-adapter/)**.
- Usar un balanceador de carga con soporte de sticky sessions para Socket.io.

---

## Reconexión

El cliente (`useSocket.js`) se reconecta automáticamente gracias a Socket.io. Al reconectarse emite `game:join` con el token almacenado en `sessionStorage`, y el servidor re-envía el estado completo del grid y los jugadores actuales sin interrumpir el juego.

---

## Etapas del proyecto

| Etapa | Qué produce | Tag |
|---|---|---|
| 0 | Esqueleto del proyecto | v0.0-setup |
| 1 | Esquema PostgreSQL | v0.1-db |
| 2 | Estado en Redis | v0.2-redis |
| 3 | API de categorías/partidas | v0.3-api-games |
| 4 | Unión de invitados | v0.4-join |
| 5 | Tiempo real (grid) | v0.5-realtime |
| 6 | Modos de juego | v0.6-modes |
| 7 | Leaderboard en vivo | v0.7-leaderboard |
| 8 | Chat | v0.8-chat |
| 9 | Frontend completo | v0.9-frontend |
| 10 | Concurrencia y despliegue | v1.0 |
