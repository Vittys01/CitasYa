# Heroku: migraciones antes de levantar web; worker opcional (requiere escalar: heroku ps:scale worker=1)
release: npx prisma migrate deploy
# Con next.config "standalone", usar el servidor empaquetado (Heroku inyecta PORT).
web: node .next/standalone/server.js
worker: npm run worker
