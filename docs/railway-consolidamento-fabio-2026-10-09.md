# Consolidamento Railway — destinazione definitiva (9 ottobre 2026)

**Destinazione scelta:** workspace `fabioleonardi22-blip's Projects` su Railway.

## Stato verificato
- Progetto `Artyou MySQL`: `MySQL` (gestionale/prenotazioni/calendario), `MySQL-cQic` (database separato) e `artyou-merch-api` (repo Artyou) online.
- Progetto `genuine-liberation`: `gestionaleartyou-beta`, `artyou-booking-lab-mysql`.
- Vercel `artyoubeta2691001`: già configurate `DATABASE_URL` in production e preview; credenziali non riportate. Presenti anche variabili per Google, Apps Script e merchandising.
- Origine da consolidare **verso** questo workspace: progetto `talented-radiance` di `artyouroma@gmail.com`. Non disponibile attraverso l'attuale singolo account Railway collegato.
- I 23 eventi/date sono già presenti sul MySQL principale secondo il censimento UI precedente. Ricontare alla data del cutover.

## Piano operativo
1. **Non toccare la produzione funzionante.** Backup consistenti MySQL principale e MySQL-cQic, conservati e verificati.
2. Inventariare `talented-radiance`: servizi, configurazioni, domini, volumi, variabili (solo nomi), stato. Distinguere dati unici da servizi laboratorio.
3. Portare nel workspace finale solo servizi/dati *non già disponibili*. Non copiare MySQL di prova sopra quello principale.
4. Collaudare il gestionale beta e il booking lab su staging separato; misurare differenze di dati.
5. Consolidare gli endpoint e le variabili Vercel/GitHub con cutover reversibile; non eseguire automaticamente addebiti.
6. Verifica post-cutover: account, YEP/RIF/Vortice/WorkshoW, anagrafiche, check-in, ordini merchandise, disponibilità e pagamenti sandbox.
7. Dismettere l'origine SOLO dopo conferma distinta, backup verificati e stabilità.

## Blocchi
- Il plugin Railway consente un solo account collegato per volta: nel workspace finale non è visibile `talented-radiance`.
- Le variabili Vercel sensibili sono volutamente **non lette** per evitare credenziali nei log o nel repository.
- Nessun backup o import è stato eseguito, nessuna connessione alterata. Le operazioni di trasferimento dei dati richiedono confronto origine/destinazione e finestra controllata.


## Verifica incrociata eseguita sui 3 progetti (Railway + GitHub)
Il collegamento Railway ora permette la lettura anche di `talented-radiance`. I suoi 4 servizi sono:
- `comfortable-celebration`: repo `GestionaleArtyou`, branch `piattaforma-funzionale`, cartella `platform`, entrypoint `npm start`, dominio `comfortable-celebration-production-1b2c.up.railway.app`.
- `MySQL`: mysql:9 con volume persistente indipendente; **NON** copiare o unire senza confronto dei dati.
- `artyou-booking-lab-mysql`: mysql:8.4 con volume indipendente.
- `artyou-booking-lab-migrator`: repo `Artyoubeta26091001`, branch `booking-lab-isolated-20261008`.

Nel workspace destinazione:
- `genuine-liberation/gestionaleartyou-beta`: repo `GestionaleArtyou`, branch `beta-operativa`, root `platform`, `node server.js`, dominio `gestionaleartyou-beta-production.up.railway.app`.
- `genuine-liberation/artyou-booking-lab-mysql`: mysql:8.4 con volume distinto.
- `Artyou MySQL`: `MySQL` (mysql:9), `MySQL-cQic` (mysql:9), `artyou-merch-api`.

### Differenze reali tra i gestionali
- `platform/package.json` e `platform/migrate.js` hanno blob SHA identici tra `beta-operativa` e `piattaforma-funzionale`.
- `platform/server.js` e `platform/public/app.js` differiscono: NON sostituire la versione beta con la branch precedente.
- `beta-operativa` contiene `GET /api/beta-self-test` e import di `ensureBetaStorage`, `betaMode`; assenti dal server della precedente `piattaforma-funzionale`.
- Le principali route per dati, prenotazioni, report, checkout e webhook Stripe risultano presenti in entrambe. Non dedurre equivalenza funzionale dalla sola lista route.
- Le variabili di origine e beta differiscono: il beta usa `ARTYOU_ENV`, `BETA_SHARED_DB`, `MYSQL_SSL`, `AUTOMATIC_BACKUPS_ENABLED`, `EMAIL_DELIVERY_ENABLED` e `BOOTSTRAP_ADMIN_EMAIL`. Valori e segreti non copiati.

### Decisione prudente
La destinazione contiene già un gestionale beta e un database booking-lab, quindi **nessuna duplicazione automatica**. Occorre confrontare i dati dei due MySQL di origine con quelli finali, mantenere la vecchia applicazione raggiungibile fino a verifica delle funzioni residue, poi solo dopo decidere quali servizi dismettere.

**Non eseguito:** dump e restore SQL, spostamento volumi, modifica DB URL, webhook, dominio, secrets, cancellazione servizi.
