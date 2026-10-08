# Artyou Booking Lab — isolamento totale

Questa cartella è una **simulazione**, non un sostituto del backend in produzione.

## Sicurezza e separazione

- Nessun accesso a \`/api/artyou\`, Apps Script, MySQL, PayPal, Railway o alle email.
- Tutti i dati sono inventati e conservati **solo in memoria**.
- La pagina si resetta a ogni ricaricamento. Non usare dati personali reali.
- La branch \`booking-lab-isolated-20261008\` non va fusa in \`main\` prima di test, review e autorizzazione.
- Non collegare le variabili \`DATABASE_URL\`, \`MYSQL_URL\`, \`ARTYOU_APPS_SCRIPT_URL\` o credenziali PayPal reali al progetto laboratorio.

## Esecuzione test

\`\`\`sh
node --test sandbox/booking-lab/booking-lab.test.js
\`\`\`

Il file contiene otto scenari con assert e termina con codice di errore in caso di fallimento. Per esecuzione diretta:

\`\`\`sh
node sandbox/booking-lab/booking-lab.test.js
\`\`\`

## Roadmap per migrazione reale (NON implementata qui)

1. MySQL di **staging separato** (non replica dello stesso database production), schema di staging e seed fittizi.
2. API server-side Vercel staging con transazioni InnoDB, lock per evento/data, idempotency key e scadenza HOLD; gestione prezzi lato server e audit log.
3. PayPal **Sandbox** Orders API e webhook con verifica firma, deduplicazione di capture/refund e riconciliazione; mai usare client redirect come prova di pagamento.
4. Stati contabili separati da stati dei posti: \`booking_status\` e \`payment_status\`; nel database attuale \`bookings.status\` enum non include RIMBORSATO, quindi serve migrazione progettata.
5. Importazione e confronto su copie **anonimizzate** dei dati del gestionale; controllare per ogni evento posti totali, HOLD attivi, pagati, annullati, rimborsi, QR e importi.
6. Canary per un evento non critico, monitoraggio, rollback con riconciliazione delle prenotazioni scritte durante il canary. Non ripristinare ciecamente un backup sovrascrivendo vendite nuove.

### Requisiti di go/no-go

- Zero overbooking con richieste concorrenti a DB reale, anche da più istanze serverless.
- Nessun \`PAGATO\` senza capture verificata server-side; webhook ripetuti innocui.
- Rimborsi tracciati e QR disattivati soltanto con policy di annullamento esplicita.
- Reconciliation 100% di prenotazioni, posti e incassi nel dataset di staging.
- Test E2E di tutte le categorie: Spettacoli, WorkshoW, YEP, RIF, Un Vortice di Emozioni.
- Backup, rollback e freeze del passaggio documentati; nessun cambio a produzione senza review.

### Criticità rilevata nel backend attuale

\`api/artyou.js\` scrive prima su Apps Script e poi replica in MySQL in un \`try/catch\` che non blocca la prenotazione quando il mirror fallisce. Quindi non esiste ancora consistenza transazionale tra le due fonti. La migrazione dovrà prevedere un solo sistema autoritativo per l'inventario e una riconciliazione degli stati.

**Questo prototipo non ha verificato MySQL né PayPal.**
