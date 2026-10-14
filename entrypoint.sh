#!/usr/bin/env bash
set -uo pipefail
DATA=/var/lib/pasarguard
mkdir -p "$DATA/node-certs" /var/lib/pg-node
export PORT=8080   # fixed: set the Railway domain target port to 8080

# owner admin/admin is written by bootstrap.py on FIRST boot only
unset SUDO_USERNAME SUDO_PASSWORD

# ---- node secrets: generated once, kept on the volume ----
[ -f "$DATA/node_api_key" ] || python -c "import uuid;print(uuid.uuid4())" > "$DATA/node_api_key"
if [ ! -f "$DATA/node-certs/cert.pem" ]; then
  openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 3650 -keyout "$DATA/node-certs/key.pem" -out "$DATA/node-certs/cert.pem" -subj "/CN=localhost" -addext "subjectAltName=IP:127.0.0.1,DNS:localhost" >/dev/null 2>&1
fi

# ---- unique config paths for this install (kept on the volume) ----
python /code/genpaths.py || exit 1

# ---- nginx ----
sed "s/__PORT__/${PORT}/g" /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
if [ ! -s /proc/net/if_inet6 ]; then
  # region without IPv6 inside the container: listen on IPv4 only instead of failing to start
  sed -i '/listen \[::\]/d' /etc/nginx/nginx.conf
  echo "[chost] IPv6 not available here, listening on IPv4 only"
fi
nginx -t || exit 1
echo "[chost] region: ${RAILWAY_REPLICA_REGION:-unknown}, domain: ${RAILWAY_PUBLIC_DOMAIN:-not generated yet}"

# ---- node (xray) ----
node_run() {
  cd /opt/pg-node || exit 1
  export SERVICE_PORT=62050 NODE_HOST=127.0.0.1 SERVICE_PROTOCOL=grpc
  export API_KEY="$(cat "$DATA/node_api_key")"
  export SSL_CERT_FILE="$DATA/node-certs/cert.pem" SSL_KEY_FILE="$DATA/node-certs/key.pem"
  exec ./main
}
( node_run ) &
NODE_PID=$!

# ---- panel ----
( cd /code && python -m alembic upgrade head && exec python main.py ) &
PANEL_PID=$!

# ---- auto setup + self-healing (restarts itself if it ever crashes) ----
( cd /code && while true; do python bootstrap.py; echo "[chost] bootstrap exited, restarting in 10s"; sleep 10; done ) &

# ---- Telegram sales bot (idle until it is turned on in Settings > ربات فروش) ----
( cd /code && sleep 20 && while true; do python chostbot.py; echo "[chost] sales bot exited, restarting in 10s"; sleep 10; done ) &

nginx -g 'daemon off;' &
NGINX_PID=$!

# ---- watchdog: if the panel or nginx stops answering for ~3 minutes, restart the whole service ----
(
  sleep 240; fails=0   # slow regions pull and migrate slower: give them time before watching
  while true; do
    if bash /usr/local/bin/chost-healthcheck; then fails=0; else fails=$((fails+1)); fi
    if [ "$fails" -ge 6 ]; then echo "[chost] watchdog: service not answering, restarting"; kill "$PANEL_PID" "$NGINX_PID" 2>/dev/null; break; fi
    sleep 30
  done
) &

wait -n $NODE_PID $PANEL_PID $NGINX_PID
echo "a process exited, restarting container"; exit 1
