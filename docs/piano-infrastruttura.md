# Infrastruttura: interventi da confermare

Audit del 10 ottobre 2026. Niente di quanto segue è stato eseguito: ogni intervento cambia i servizi in produzione e va avviato solo dopo un sì esplicito di Fabio.

## Inventario attuale (Railway)

| Servizio | Progetto | Immagine | Esposizione pubblica | Note |
| --- | --- | --- | --- | --- |
| MySQL | Artyou MySQL | mysql:9 (9.7.2) | proxy TCP `altaria.proxy.rlwy.net:47404` | volume 500 MB, log binario disattivato, performance_schema spento |
| MySQL-cQic | Artyou MySQL | mysql:9 | proxy TCP `hopper.proxy.rlwy.net:18249` | volume 500 MB |
| artyou-merch-api | Artyou MySQL | Node, da questo repo | dominio `*.up.railway.app` | si collega al database con la rete privata |
| gestionaleartyou-beta | genuine-liberation | Node, ramo beta-operativa | dominio `*.up.railway.app` | |
| artyou-booking-lab-mysql | genuine-liberation | mysql:8.4 | nessuna | |

Prima di qualsiasi intervento: un backup completo verificato con `.github/workflows/mysql-backup.yml`.

## B3 · Proxy TCP pubblico

Le funzioni Vercel e il workflow di backup raggiungono il database solo dal proxy pubblico, quindi non si può togliere a quello del sito. Si può togliere da quello che serve solo al merchandising, se Vercel non lo usa.

1. Verificare a quale servizio puntano `DATABASE_URL` (Vercel) e `MYSQLHOST` (artyou-merch-api): l'host `mysql` o `mysql-cqic` indica la rete privata.
2. Per il database usato solo da artyou-merch-api: rimuovere il proxy TCP da Railway (Settings > Networking).
   Se serve per il backup, crearne uno temporaneo durante la finestra di backup o spostare il backup in un servizio cron Railway.
3. Per il database del sito: usare un utente dedicato a Vercel con soli permessi su quel database, una password lunga e `MYSQL_SSL_CA` impostato.
   - Effetto: nessun fermo.
   - Rollback: ricreare il proxy (Railway assegna una porta nuova, da aggiornare nelle variabili).

## B4 · mysql:9 → 8.4 LTS e performance_schema

La 9.x è una serie "innovation" con aggiornamenti frequenti; la 8.4 è la versione a supporto lungo. Il passaggio indietro di versione non si fa sullo stesso volume.

1. Backup verificato.
2. Nuovo servizio MySQL 8.4 con volume nuovo, avviato con `--performance_schema=ON` e senza `--disable-log-bin`.
3. Import del backup nel nuovo servizio; confronto delle righe per tabella con il file `.counts.tsv`.
4. Finestra di manutenzione: prenotazioni sospese per 15–30 minuti, ultimo backup, import differenziale, cambio delle variabili `DATABASE_URL`/`MYSQL*` su Vercel e Railway, nuovi deploy.
5. Il vecchio servizio resta fermo ma intatto per 14 giorni.
   - Rollback: ripristinare le variabili precedenti.

## M1 · Regione dei dati

Decisione del 10/10/2026: i dati restano negli USA e l'informativa privacy lo dichiara. Se in futuro si sceglie l'UE:

1. Vercel: impostare la regione delle funzioni a `fra1` (Francoforte) in `vercel.json` (`"regions": ["fra1"]`). È un nuovo deploy, nessun fermo.
2. Railway: creare i servizi MySQL nella regione Europa (Amsterdam) e migrare come in B4 (stessi passi, stessa finestra di manutenzione).
3. Aggiornare l'informativa privacy, togliendo i trasferimenti verso gli USA non più necessari.

Funzioni e database vanno spostati insieme. Dal 10/10/2026 le funzioni Vercel girano a San Francisco (`sfo1`), accanto ai database Railway (`sfo`): misurato dall'ambiente Vercel, il contatto con il database è sceso da 150–230 ms (Washington) a circa 30 ms.

## Connessione TLS sito → MySQL

Dal 10/10/2026 `MYSQL_SSL_CA` (solo Production) contiene la CA autogenerata del MySQL `altaria` (CN `MySQL_Server_9.7.2_Auto_Generated_CA_Certificate`, SHA-256 `19:82:70:D8:…:D6:B1`, scadenza 30/09/2036): la connessione è cifrata (TLS 1.3) e il certificato del server viene verificato. Il nome host non viene confrontato (comportamento predefinito di mysql2), perché il certificato autogenerato non contiene il dominio del proxy.

Se il servizio MySQL viene ricreato o il volume sostituito, MySQL genera una CA nuova e il sito non riesce più a collegarsi: in quel caso estrarre la nuova CA con `openssl s_client -starttls mysql -connect <host>:<porta> -showcerts` (secondo certificato) e aggiornare `MYSQL_SSL_CA`.
