# Artyou Booking Lab — staging isolato

Branch di lavoro: \`booking-lab-isolated-20261008\`. **Non effettuare merge su main.**

## Componenti

- \`index.html\` e \`booking-lab.js\`: dimostrazione completamente offline in memoria; nessuna API o vendita reale.
- \`api/booking-lab.js\`: endpoint Vercel di staging, **disabilitato di default**, che richiede token segreto in header.
- \`store.js\`: MySQL transazionale con lock InnoDB \`SELECT ... FOR UPDATE\` per evento, idempotenza e prezzi lato server.
- \`paypal-sandbox.js\`: API PayPal **solo sandbox**, per order, capture e refund; non usa URL produzione.
- \`staging-schema.sql\`: schema da applicare solo su **database MySQL separato**.
- \`booking-lab.test.js\` e \`staging.test.js\`: test offline senza chiamate reali.

## Avvio sicuro

1. Creare un **nuovo database** MySQL staging (con credenziali dedicate e dati fittizi). **Non usare DATABASE_URL / MYSQL_URL di produzione.**
2. Applicare \`staging-schema.sql\` sul DB staging, e inserire eventi demo:
   \`\`\`sql
   INSERT INTO lab_events (slug,capacity,price_cents)
   VALUES ('shortyou-demo',5,1500),('workshow-demo',3,9500),('yep-demo',4,2000);
   \`\`\`
3. Creare un **progetto Vercel staging separato** e utilizzare il target **preview** (non produzione), collegato alla branch, con queste variabili configurate **solo sul progetto staging**:
   - \`ARTYOU_BOOKING_LAB_MODE=sandbox\`
   - \`ARTYOU_BOOKING_LAB_DATABASE_URL=mysql://.../DB_DI_STAGING\`
   - \`ARTYOU_BOOKING_LAB_TOKEN=<segreto casuale di almeno 32 caratteri>\`
   - \`ARTYOU_BOOKING_LAB_PAYPAL_CLIENT_ID=<client ID di PayPal Sandbox>\`
   - \`ARTYOU_BOOKING_LAB_PAYPAL_SECRET=<secret di PayPal Sandbox>\`
   - \`ARTYOU_BOOKING_LAB_SSL=true\` solo con certificato MySQL valido e verificabile
   - \`ARTYOU_BOOKING_LAB_POOL_SIZE=2\` (default)
4. Nessun altro progetto deve ricevere queste variabili. L'API rifiuta l'avvio se mode/token/DB staging mancano o se l'URL coincide con il DB produzione.

## API privata di staging

Tutte le chiamate richiedono header \`X-Booking-Lab-Token: <segreto>\`. Non mettere mai il token nel browser o nel codice pubblico; usare client server-side/test runner.

- \`GET /api/booking-lab?eventSlug=shortyou-demo\` — capienza.
- \`POST /api/booking-lab\` JSON \`{"action":"reserve","eventSlug":"shortyou-demo","seats":1,"requestKey":"uuid-test-0001"}\`.
- \`{"action":"order","bookingId":"UUID"}\` — crea ordine PayPal Sandbox.
- Dopo approvazione PayPal Sandbox: \`{"action":"capture","bookingId":"UUID"}\` — cattura verificata server-side.
- \`{"action":"refund","bookingId":"UUID"}\` — rimborso sandbox, mantiene il posto occupato.
- \`{"action":"cancel","bookingId":"UUID"}\` — libera il posto solo se il pagamento è regolato.
- \`{"action":"compare","eventSlug":"shortyou-demo","manager":{"capacity":5,"booked":1,"remaining":4}}\` — confronto con **dati forniti dal test runner**, non con il gestionale live.

La capture in stato \`CAPTURING\` resta contabilizzata anche durante timeout del provider per evitare overbooking; richiede riconciliazione manuale/automatica prima del go-live. Un rimborso \`REFUNDING\` incerto non deve essere duplicato: va riconciliato con PayPal.

## Test automatici

\`\`\`sh
node sandbox/booking-lab/booking-lab.test.js
node sandbox/booking-lab/staging.test.js
node sandbox/booking-lab/compare-snapshots.test.js
node sandbox/booking-lab/compare-snapshots.js legacy-anon.json staging-anon.json
\`\`\`

La suite usa un fake MySQL in memoria per verificare il flusso SQL, **non prova realmente transazioni su più istanze Vercel**.

## Smoke test su MySQL reale (solo quando staging è configurato)

Lo script `staging-smoke.js` invia prenotazioni sintetiche concorrenti tramite HTTPS,
verifica che i posti liberi scendano esattamente del numero di richieste accettate e
rifiuta qualunque host diverso dalla preview isolata Vercel.

```sh
ARTYOU_BOOKING_LAB_PREVIEW_URL="https://artyoubeta2691001-git-booking-lab-isolated-20261008-weroad.vercel.app" \
ARTYOU_BOOKING_LAB_TOKEN="<segreto-staging>" \
node sandbox/booking-lab/staging-smoke.js
```

Non lanciare su database di produzione; lo script crea prenotazioni fittizie sul database
di staging e non simula catture PayPal.

## Limitazioni attuali e gate di attivazione

- Non sono ancora disponibili credenziali e istanza MySQL staging e PayPal Sandbox configurate; nessun pagamento, rimborso o prenotazione reali sono stati effettuati.
- Non sono implementati webhook PayPal con verifica firma e riconciliazione completa di capture/refund pendenti; **non utilizzare in produzione**.
- Il modello dimostrativo copre evento singolo. YEP/RIF con workshop multipli e risorse condivise richiedono inventario e lock granulari.
- Manca confronto con **copia anonimizzata** del gestionale reale, import storico e verifica QR/check-in.
- Prima di migrare: prove su MySQL vero, PayPal Sandbox, E2E di tutte le pagine, audit di sicurezza, rollback e verifica differenze pari a zero.

**La produzione continua a utilizzare il backend attuale e non viene toccata da questa branch.**
