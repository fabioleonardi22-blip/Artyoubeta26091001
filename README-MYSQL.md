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
