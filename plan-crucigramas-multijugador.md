# Plataforma de crucigramas multijugador — Plan por etapas

## Por qué dividir el proyecto

El prompt original describe un sistema con muchas piezas acopladas: generación de partidas, invitados sin cuenta, dos modos de juego, tiempo real con Socket.io, persistencia en PostgreSQL, estado efímero en Redis, chat y estadísticas en vivo. Si le pides a una IA (o a ti mismo) que lo construya todo en una sola pasada, pasan dos cosas:

- Es difícil revisar el resultado porque todo llega junto.
- Si algo falla, no sabes si el problema está en el modelo de datos, en la lógica de tiempo real, o en el frontend.

Dividir en etapas te permite: probar cada pieza antes de avanzar, hacer commits pequeños y reversibles, y si un paso sale mal, volver al commit anterior sin perder todo el trabajo.

## Flujo de trabajo sugerido con Git/GitHub

1. **Un repo, una rama por etapa.** `main` siempre debe quedar en un estado funcional. Trabaja cada etapa en `git checkout -b etapa-1-setup`, y solo haces merge a `main` cuando esa etapa compila y funciona.
2. **Commit al final de cada etapa, no en medio.** Idealmente un commit único y descriptivo por etapa (o unos pocos si la etapa es grande), con mensaje tipo `feat: modelo de datos y migraciones iniciales`.
3. **Tags para marcar hitos.** Después de cada merge a `main`, un tag como `v0.1-setup`, `v0.2-db`, etc. Así puedes volver a cualquier punto estable con `git checkout v0.2-db`.
4. **`.env` fuera del repo desde el día uno.** Con Redis, PostgreSQL y (si usas) claves de API, agrega `.gitignore` con `.env`, `node_modules/`, etc. antes del primer commit — no después.
5. **README que crece con el proyecto.** Cada etapa agrega una sección: cómo levantar esa parte, qué variables de entorno necesita, cómo probarla.
6. **Si usas un asistente de IA para programar:** dale un prompt por etapa (no el proyecto completo), y pídele explícitamente que no toque código de etapas anteriores salvo que sea necesario. Revisa el diff antes de aceptar/commitear.

## El prompt original, mejorado

El prompt original es un buen punto de partida pero le faltan decisiones técnicas concretas que, si no las tomas tú, las toma la IA por ti (y no siempre bien). Versión mejorada:

> Diseña y construye una plataforma web de crucigramas multijugador en tiempo real, con esta arquitectura:
>
> **Backend:** Node.js + Express, Socket.io para tiempo real, PostgreSQL para datos persistentes (usuarios, partidas históricas, categorías, puntuaciones), Redis para estado efímero de partidas en curso (grid actual, jugadores conectados, timers).
>
> **Flujo de partida:** Un usuario elige una categoría/temática desde una lista predefinida, configura el modo (contrarreloj con duración configurable, o libre sin límite), y el sistema genera una partida con un enlace único (ej. `/play/:gameId`). Otros usuarios entran por ese enlace, ingresan solo un nombre (sin registro), y se unen como invitados.
>
> **Durante la partida:** grid de crucigrama sincronizado en tiempo real entre todos los jugadores, tabla de clasificación en vivo (aciertos, tiempo, posición), chat de texto por partida.
>
> **No funcional:** debe soportar alta concurrencia (múltiples partidas simultáneas, múltiples jugadores por partida) sin que el estado de una partida interfiera con otra.
>
> Antes de escribir código, prop焦 propón el esquema de base de datos (PostgreSQL) y la estructura de claves en Redis, y espera mi validación antes de continuar.

La diferencia clave: le pides que **primero proponga el diseño de datos y espere validación**, en vez de que empiece a generar código directo. Eso evita que tengas que deshacer trabajo si el modelo de datos no te convence.

---

## Las 10 etapas

### Etapa 0 — Setup del repositorio
**Objetivo:** estructura base del proyecto, sin lógica de negocio todavía.

**Prompt:**
> Crea la estructura inicial de un proyecto Node.js para una plataforma de crucigramas multijugador. Necesito: carpetas separadas para `backend` (Express + Socket.io) y `frontend` (indica qué framework recomiendas y por qué, dado que necesito actualizaciones en tiempo real fluidas — React o Vue son opciones válidas). Configura `package.json`, ESLint, `.gitignore` (incluyendo `.env`, `node_modules`), variables de entorno de ejemplo en `.env.example`, y un `README.md` con instrucciones para levantar el proyecto localmente. No implementes lógica de negocio todavía, solo el esqueleto y un endpoint `/health` que responda 200.

**Commit sugerido:** `chore: estructura inicial del proyecto` → tag `v0.0-setup`

---

### Etapa 1 — Modelo de datos en PostgreSQL
**Objetivo:** esquema de base de datos y migraciones, sin conectarlo aún al backend en producción.

**Prompt:**
> Diseña el esquema de PostgreSQL para esta plataforma de crucigramas. Necesito tablas para: categorías de crucigramas, puzzles (palabras, pistas, posición en el grid, categoría), partidas (modo, categoría, estado, fecha, duración si es contrarreloj), jugadores por partida (nombre de invitado, partida a la que pertenece, puntuación, tiempo), y resultados finales. Usa un ORM o query builder (indícame cuál recomiendas para este caso — Prisma o Knex, por ejemplo — y por qué). Genera las migraciones y un script de seed con 2-3 categorías y puzzles de ejemplo. Muéstrame el diagrama de relaciones antes de generar el código.

**Commit sugerido:** `feat: esquema de base de datos y migraciones` → tag `v0.1-db`

---

### Etapa 2 — Estructura de estado en Redis
**Objetivo:** definir cómo se representa una partida en curso.

**Prompt:**
> Diseña la estructura de claves en Redis para representar el estado en vivo de una partida de crucigrama: grid actual con las casillas completadas, jugadores conectados y sus puntuaciones parciales, timer restante (si es modo contrarreloj), y estado de la partida (esperando jugadores / en curso / terminada). Debe soportar múltiples partidas simultáneas sin colisión de claves. Escribe funciones helper en Node.js para crear, leer, actualizar y expirar el estado de una partida en Redis. No implementes Socket.io todavía, solo las funciones de acceso a Redis y pruebas unitarias básicas.

**Commit sugerido:** `feat: gestión de estado de partida en Redis` → tag `v0.2-redis`

---

### Etapa 3 — API REST: categorías y creación de partida
**Objetivo:** endpoints para elegir categoría/modo y generar el enlace de partida.

**Prompt:**
> Sobre la base de datos y Redis ya definidos, crea los endpoints REST: `GET /categories` (lista categorías disponibles), `POST /games` (crea una partida nueva con categoría y modo elegidos, devuelve el `gameId` y el enlace para compartir), `GET /games/:gameId` (info básica de la partida para la pantalla previa a unirse). Valida los inputs y maneja errores (categoría inexistente, modo inválido). Escribe tests de integración para estos tres endpoints.

**Commit sugerido:** `feat: API de categorías y creación de partidas` → tag `v0.3-api-games`

---

### Etapa 4 — Unirse como invitado
**Objetivo:** flujo de entrada de un jugador sin cuenta.

**Prompt:**
> Implementa el endpoint `POST /games/:gameId/join` donde un usuario invitado se une a una partida ingresando solo su nombre. Debe: validar que la partida existe y acepta jugadores, evitar nombres duplicados dentro de la misma partida, registrar al jugador en Redis (estado en vivo) y devolver un token de sesión simple (no requiere login) para identificar a ese jugador en las siguientes peticiones y en la conexión de Socket.io. Escribe tests para los casos de partida llena, partida ya iniciada, y nombre duplicado.

**Commit sugerido:** `feat: flujo de unión de invitados` → tag `v0.4-join`

---

### Etapa 5 — Conexión en tiempo real con Socket.io
**Objetivo:** sincronizar el grid entre jugadores.

**Prompt:**
> Implementa la capa de Socket.io: al conectarse, un jugador se une a una "room" identificada por `gameId`. Eventos necesarios: `cell:update` (un jugador completa una casilla, se valida contra la respuesta correcta, se difunde a todos en la room), `player:joined` y `player:left`, y sincronización del estado inicial del grid al conectarse (leyendo desde Redis). Asegúrate de que el estado en Redis sea la fuente de verdad y que dos jugadores no puedan generar estados inconsistentes si escriben casi al mismo tiempo. Explícame brevemente cómo evitas condiciones de carrera aquí.

**Commit sugerido:** `feat: sincronización de grid en tiempo real` → tag `v0.5-realtime`

---

### Etapa 6 — Lógica de modos: contrarreloj y libre
**Objetivo:** temporizador y condiciones de fin de partida.

**Prompt:**
> Sobre la infraestructura de Socket.io y Redis ya construida, implementa la lógica de los dos modos: en modo contrarreloj, un temporizador en el servidor (no confíes en el cliente) que al llegar a cero termina la partida y persiste resultados en PostgreSQL; en modo libre, la partida termina cuando el grid se completa. Emite un evento `game:ended` con los resultados finales a todos los jugadores. Escribe tests para ambos modos, incluyendo el caso del timer llegando a cero con el grid incompleto.

**Commit sugerido:** `feat: lógica de modos contrarreloj y libre` → tag `v0.6-modes`

---

### Etapa 7 — Estadísticas en vivo y tabla de clasificación
**Objetivo:** leaderboard actualizado en tiempo real dentro de la partida.

**Prompt:**
> Implementa el cálculo y difusión de estadísticas en vivo durante una partida: aciertos por jugador, tiempo transcurrido, y posición relativa. Debe emitirse por Socket.io cada vez que cambia (no hace falta polling). Al terminar la partida, persiste la clasificación final en PostgreSQL vinculada a esa partida. Añade un endpoint `GET /games/:gameId/leaderboard` para consultar resultados de partidas ya terminadas.

**Commit sugerido:** `feat: estadísticas en vivo y clasificación` → tag `v0.7-leaderboard`

---

### Etapa 8 — Chat de texto por partida
**Objetivo:** mensajería simple dentro de la room de Socket.io.

**Prompt:**
> Añade un chat de texto por partida usando la misma room de Socket.io ya existente. Evento `chat:message` con nombre del jugador, texto y timestamp, difundido solo a los jugadores de esa partida. Incluye un límite básico de longitud de mensaje y un rate limit simple por jugador para evitar spam. No requiere persistencia en base de datos (el chat es efímero, se pierde al terminar la partida) salvo que prefieras lo contrario — dime si quieres guardarlo y por qué antes de implementarlo.

**Commit sugerido:** `feat: chat de partida` → tag `v0.8-chat`

---

### Etapa 9 — Frontend: flujo completo de usuario
**Objetivo:** interfaz que conecta con todo lo anterior.

**Prompt:**
> Construye el frontend (usando el framework definido en la Etapa 0) con las pantallas: selección de categoría y modo, pantalla de "partida creada" con el enlace para compartir, pantalla de ingreso de nombre para invitados, tablero de crucigrama interactivo sincronizado por Socket.io, panel lateral con tabla de clasificación en vivo y chat, y pantalla de resultados finales. Prioriza que el tablero se sienta responsivo — las actualizaciones de otros jugadores deben reflejarse sin recargar.

**Commit sugerido:** `feat: interfaz de usuario completa` → tag `v0.9-frontend`

---

### Etapa 10 — Concurrencia, despliegue y endurecimiento
**Objetivo:** preparar el sistema para múltiples partidas simultáneas en producción.

**Prompt:**
> Revisa toda la aplicación para alta concurrencia: pruebas de carga simulando múltiples partidas simultáneas con varios jugadores cada una, verifica que no haya fugas de memoria en las conexiones de Socket.io, configura expiración adecuada de claves en Redis para partidas abandonadas, y agrega manejo de reconexión (un jugador que pierde conexión brevemente debe poder retomar la partida). Propón una estrategia de despliegue (contenedores, variables de entorno de producción, dónde correr Redis y PostgreSQL) y documenta todo en el README.

**Commit sugerido:** `perf: concurrencia, reconexión y despliegue` → tag `v1.0`

---

## Resumen rápido

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

Cada fila es un prompt independiente que puedes pegarle a tu asistente de IA (Claude Code, por ejemplo, es buena opción para esto porque trabaja directo con tu repo), revisar el resultado, y solo entonces hacer commit y subir a GitHub.
