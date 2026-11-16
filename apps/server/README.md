# Standalone game server

`npm run build` builds the game and Admin. `npm start` serves them from localhost on port 4300. Existing audio and spawn files use `var/game`. The Phase 04 catalog uses its own document and media objects.

## Dedicated MongoDB

Use a separate loopback MongoDB instance with a directory inside the game workspace. For example, run this from PowerShell in the game workspace and leave the process running.

```powershell
New-Item -ItemType Directory -Force 'var/game/catalog-mongo' | Out-Null
mongod --bind_ip 127.0.0.1 --port 4317 --dbpath 'var/game/catalog-mongo'
```

In another PowerShell window in the same workspace, start the game server.

```powershell
$env:NETA_CATALOG_MONGO = 'mongodb://127.0.0.1:4317/neta_uthche'
npm start
```

Mongoose connects to the dedicated `neta_uthche` database. The game catalog is an atomic versioned document and the visual uploads live in the `game_objects` GridFS bucket. The existing audio store and uploaded voices keep their paths. With no `NETA_CATALOG_MONGO` setting, the catalog uses `game-catalog.json` and `catalog-objects` in the game data directory. Select a storage mode before the first edit. The two modes maintain separate catalogs.
