#!/usr/bin/env bash
# Backup completo e cifrato di un database MySQL (audit 10/10/2026, A8).
#   DB_URL=URL MySQL nel formato  mysql + "://utente:password@host:porta/database"
#   BACKUP_PASSPHRASE=frase lunga, conservata fuori da Railway e da GitHub
#   scripts/backup/mysql-backup.sh <nome> <cartella-output>
# Produce <nome>-AAAAMMGG-HHMM.sql.gz.enc (AES-256, PBKDF2) e <nome>-...counts.tsv con le righe per tabella.
# Sola lettura sulla sorgente: mysqldump --single-transaction e SELECT COUNT(*).
set -euo pipefail
name="${1:?nome del database}"; out="${2:?cartella di output}"
: "${DB_URL:?DB_URL mancante}"; : "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE mancante}"
[ "${#BACKUP_PASSPHRASE}" -ge 24 ] || { echo "BACKUP_PASSPHRASE troppo corta (minimo 24 caratteri)"; exit 2; }
image="${MYSQL_CLIENT_IMAGE:-mysql:9}"
proto_rest="${DB_URL#*://}"; creds="${proto_rest%%@*}"; hostpart="${proto_rest#*@}"
user="$(python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.argv[1]))' "${creds%%:*}")"
pass="$(python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.argv[1]))' "${creds#*:}")"
host="${hostpart%%/*}"; db="${hostpart#*/}"; db="${db%%\?*}"; port="${host##*:}"; host="${host%%:*}"; [ "$port" = "$host" ] && port=3306
stamp="$(date -u +%Y%m%d-%H%M)"; mkdir -p "$out"; base="$out/$name-$stamp"
run(){ docker run --rm -i ${MYSQL_DOCKER_ARGS:-} -e MYSQL_PWD="$pass" "$image" "$@"; }
# In caso di errore il messaggio di MySQL finisce in un'annotazione del workflow (GitHub copre i segreti con ***),
# così si legge il motivo anche senza aprire i registri completi.
err="$(mktemp)"; trap 'rm -f "$err"' EXIT
fail(){ echo "::error title=Backup $name::$1: $(grep -v -i -E 'pulling|waiting|download|verifying|digest|status:|unable to find image|already exists|pull complete' "$err" | tail -n 3 | tr '\n' ' ' | cut -c1-400)"; exit 2; }
docker pull -q "$image" >/dev/null
echo "Collegamento a $host:$port, database $db, utente $user"
run mysql --host="$host" --port="$port" --user="$user" -N -B -e "SELECT VERSION()" "$db" >/dev/null 2>"$err" || fail "collegamento non riuscito"
if ! run mysqldump --host="$host" --port="$port" --user="$user" --single-transaction --quick --routines --triggers --events \
  --no-tablespaces --set-gtid-purged=OFF --default-character-set=utf8mb4 "$db" 2>"$err" \
  | gzip -9 | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -out "$base.sql.gz.enc"; then
  fail "mysqldump non riuscito"
fi
tables="$(run mysql --host="$host" --port="$port" --user="$user" -N -B -e "SELECT table_name FROM information_schema.tables WHERE table_schema='$db' AND table_type='BASE TABLE' ORDER BY table_name" 2>"$err")" || fail "elenco tabelle non riuscito"
: > "$base.counts.tsv"
for t in $tables; do n="$(run mysql --host="$host" --port="$port" --user="$user" -N -B "$db" -e "SELECT COUNT(*) FROM \`$t\`")"; printf '%s\t%s\n' "$t" "$n" >> "$base.counts.tsv"; done
sha256sum "$base.sql.gz.enc" > "$base.sha256"
echo "::notice title=Backup $name::$(wc -l < "$base.counts.tsv") tabelle, $(awk -F'\t' '{s+=$2} END{print s+0}' "$base.counts.tsv") righe: $(awk -F'\t' '{printf "%s=%s ", $1, $2}' "$base.counts.tsv" | cut -c1-900)"
echo "Backup: $base.sql.gz.enc ($(du -h "$base.sql.gz.enc" | cut -f1)), tabelle: $(wc -l < "$base.counts.tsv")"
