# Migrazione Artyou → MySQL

Branch di migrazione: `mysql-migration`.

## Obiettivo

Sostituire gradualmente Google Sheets/Apps Script come database, senza cambiare subito le pagine del sito.

Percorso:

```
Sito Artyou
   ↓
API Vercel
   ↓
MySQL
```

Google Calendar, email e PayPal possono restare integrazioni separate.

## Variabili Vercel

Aggiungere al progetto:

- `DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/NOME_DB`
- `MYSQL_SSL=true` solo se il provider MySQL richiede SSL
- opzionale `MYSQL_POOL_SIZE=5`

Non inserire mai password MySQL nei file HTML o nel repository.

## Inizializzazione

Eseguire `database/schema.sql` sul nuovo database MySQL 8+.

Poi testare:

`GET /api/mysql-health`

Risposta attesa:

```json
{"ok":true,"mysql":true}
```

## Stato beta · 4 ottobre 2026

La beta usa un MySQL Railway separato dal database merchandising.

- schema operativo migrato in modo compatibile con il vecchio schema di test;
- 23 eventi pubblici importati dalla sorgente Apps Script;
- Vercel configurato con `DATABASE_URL` come secret e `MYSQL_SSL=true`;
- `/api/artyou` mantiene Apps Script come fonte primaria e replica in MySQL soltanto le prenotazioni concluse con successo;
- un errore nel mirror MySQL non blocca la prenotazione principale;
- passaggio a MySQL come fonte primaria rimandato finché il dual-write non è verificato.

## Compatibilità con il sito attuale

`/api/mysql-events?eventi=1` restituisce:

```json
{"ok":true,"eventi":{"shortyou":{"titolo":"...","data":"...","capienza":25,"prezzo":15,"attivo":true}}}
```

`/api/mysql-events?disponibilita=1` restituisce:

```json
{"ok":true,"disponibilita":{"shortyou":25}}
```

Sono volutamente compatibili con le risposte attuali dell'Apps Script.

## Migrazione dati

Prima importare gli eventi pubblici:

```bash
DATABASE_URL="mysql://..." node scripts/mysql-import-public.js
```

Le prenotazioni contengono dati personali e NON vengono scaricate da endpoint pubblici.
Vanno esportate dal Google Sheet e importate con uno script server-side dedicato.

## Strategia di attivazione

1. Creare database e schema.
2. Importare eventi.
3. Verificare `mysql-health`, eventi e disponibilità.
4. Importare prenotazioni.
5. Mettere il sistema in dual-read/dual-write per un periodo di verifica.
6. Spostare il sito da `/api/artyou` a MySQL mantenendo Apps Script come fallback.
7. Dopo la verifica, lasciare Google Sheets solo come report/export.

Nessuna pagina pubblica viene modificata in questa prima fase.


## Autenticazione area interna · 5 ottobre 2026

L'accesso a Calendario Docenti e Anagrafica usa ora MySQL come fonte primaria delle autorizzazioni:

```
Google Identity → API Vercel → tabella users MySQL
```

Per rendere la migrazione non distruttiva, gli utenti non ancora presenti in MySQL vengono verificati una sola volta tramite il vecchio backend Apps Script; se autorizzati, vengono inseriti automaticamente nella tabella `users`. Dagli accessi successivi l'autorizzazione viene letta direttamente da MySQL.

Se MySQL è temporaneamente indisponibile durante questa fase di transizione, Apps Script resta come fallback per evitare di bloccare l'area interna.


## Hardening autenticazione · 7 ottobre 2026

- MySQL `users` è l'unica authority per autorizzare gli accessi; il fallback Apps Script è disattivato di default (`ARTYOU_ALLOW_LEGACY_AUTH=false`).
- Google Identity viene verificato server-side (firma, audience, issuer, scadenza, email verificata) e il token viene conservato in cookie `HttpOnly; Secure; SameSite=Strict`, non in localStorage/sessionStorage.
- Gestionale Eventi, Scanner QR e Dashboard Prenotazioni richiedono Google login e RBAC. Le mutazioni Eventi/Piano Operativo/Check-in/Instagram vengono registrate in `security_audit`.
- Il Gestionale Eventi usa MySQL come storage autoritativo. Il vecchio PIN non viene più inviato dal browser né usato per list/save/delete; resta solo come integrazione server-side opzionale per l'upload immagini legacy Apps Script.
- Il proxy merchandising applica rate limit, honeypot e può autenticarsi verso Railway con `ARTYOU_MERCH_PROXY_SECRET`; la stessa variabile deve essere configurata su Vercel e sul servizio Railway.
- La CSP è ora applicata anche in enforcement mode; la policy Report-Only più restrittiva resta attiva per guidare la successiva eliminazione degli script inline.
