#!/usr/bin/env bash
# Prova di ripristino (audit 10/10/2026, A8): decifra un backup, lo carica in un MySQL temporaneo
# vuoto e confronta le righe per tabella con il file .counts.tsv creato durante il backup.
#   BACKUP_PASSPHRASE=...  scripts/backup/mysql-restore-check.sh <file.sql.gz.enc> <file.counts.tsv>
# Non tocca mai i database reali: avvia e poi elimina un container locale.
set -euo pipefail
enc="${1:?file .sql.gz.enc}"; counts="${2:?file .counts.tsv}"; : "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE mancante}"
image="${MYSQL_SERVER_IMAGE:-mysql:9}"; name="restore-check-$$"; rootpw="$(openssl rand -hex 16)"
docker run -d --name "$name" -e MYSQL_ROOT_PASSWORD="$rootpw" -e MYSQL_DATABASE=restore "$image" >/dev/null
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
for i in $(seq 1 60); do docker exec -e MYSQL_PWD="$rootpw" "$name" mysql -uroot -e "SELECT 1" restore >/dev/null 2>&1 && break; sleep 2; done
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$enc" | gunzip \
  | docker exec -i -e MYSQL_PWD="$rootpw" "$name" mysql -uroot restore
fail=0
while IFS=$'\t' read -r t expected; do
  got="$(docker exec -e MYSQL_PWD="$rootpw" "$name" mysql -uroot -N -B restore -e "SELECT COUNT(*) FROM \`$t\`" 2>/dev/null || echo ERR)"
  # il backup e il conteggio non sono atomici: sono ammesse poche righe nuove arrivate nel frattempo
  if [ "$got" = "ERR" ] || [ "$got" -gt "$expected" ] || [ $((expected - got)) -gt 5 ]; then echo "DIFFERENZA $t: attese $expected, ripristinate $got"; fail=1; else echo "ok $t $got"; fi
done < "$counts"
[ "$fail" = 0 ] && echo "Ripristino verificato." || { echo "Ripristino NON conforme."; exit 1; }
