# Piano migrazione Railway — Artyou Roma (2026-10-09)
**STATO: INVENTARIO COMPLETATO; NESSUN CUTOVER ESEGUITO**

## Scopo e destinazione
- Origine: workspace `fabioleonardi22-blip's Projects`, progetto `Artyou MySQL` (ID `e8f52c9a-d5ff-4420-9661-1d2c724a61ca`), ambiente `production`.
- Destinazione richiesta: account `artyouroma@gmail.com`, workspace `Artyou Roma's Projects`, progetto `talented-radiance` (ID osservato in precedente collegamento `4959f57b-6f17-4ea5-ae6a-e3573b3f8093`). La destinazione NON è attualmente accessibile tramite il collegamento Railway attivo: verificare di nuovo l'ID.
- Obiettivo: migrare i dati e servizi dell'origine nel progetto di destinazione, mantenendo la produzione attiva fino a collaudo e cutover.

## Inventario verificato dell'origine
| Servizio | ID | Risorsa | Dipendenze e rete |
|---|---|---|---|
| `MySQL` | `f8c93852-400f-45b3-bf72-759672984d55` | mysql:9; volume `mysql-volume`, 500 MB montato /var/lib/mysql | endpoint TCP pubblico `altaria.proxy.rlwy.net:47404`; database prenotazioni/gestionale; 1 replica sfo |
| `MySQL-cQic` | `5292dd72-40da-428d-ade0-925c87fb75e8` | mysql:9; volume `mysql-volume-Ai5J`, 500 MB montato /var/lib/mysql | endpoint TCP pubblico `hopper.proxy.rlwy.net:18249`; database separato; 1 replica sfo |
| `artyou-merch-api` | `8fd85294-2d41-481f-9090-4b66517b0631` | Repo GitHub `fabioleonardi22-blip/Artyoubeta26091001`; start `node railway-merch-server.js` | port 3000; `/health`; URL `artyou-merch-api-production.up.railway.app` |
Tutti online all'inventario; zero cambi staged. Le password/variabili segrete NON sono raccolte in questo documento.

### Dati da confrontare senza sovrascrivere
- Database principale: `users`, `events`, `event_dates`, `bookings`, `payments`, `operational_tasks`, `auth_identities`, `auth_sessions`, `security_audit`, `security_rate_limits`.
- Database secondario: inventario schemi completo da esportare e confrontare con destinazione; possibile impatto merchandising.
- Baseline visiva precedente: 23 eventi e 23 date nel database principale; ricontare prima e dopo la copia. Prenotazioni, pagamenti e users sono dinamici, quindi non assumere numeri precedenti.

## Vincoli di sicurezza
1. Non spostare volumi con operazioni distruttive, non eliminare servizi, non importare dump in database popolati senza analisi conflitti.
2. Non cambiare `DATABASE_URL`, `MYSQL_URL`, proxy, domini, variabili merchandising o webhook prima dei test e di una finestra di cutover.
3. Esportare dump consistenti con `--single-transaction --routines --triggers --events` (se permessi disponibili) per entrambi i MySQL, salvare cifrati e conservarne checksum.
4. Preparare **database di staging nuovi e distinti** nel progetto destinazione. Inventariare prima i servizi già presenti di `talented-radiance`.
5. Confrontare schema, FK, AUTO_INCREMENT, indici e conteggi per tabella, più checksum/campioni anonimizzati.
6. Collaudare autenticazione Google, CRUD anagrafiche, calendari, eventi, prenotazioni simultanee, disponibilità e flussi sandbox dei pagamenti; non eseguire addebiti reali.
7. Definire freeze delle scritture legacy o replicazione/sync fino al cutover, altrimenti il dump iniziale perderà le nuove prenotazioni.
8. Ruotare credenziali amministrative MySQL esposte in screenshot; creare utente applicativo least-privilege, senza DDL runtime non necessario. Non salvare segreti su GitHub.
9. Aggiornare Vercel/Railway/Stripe/PayPal/Resend usando endpoint nuovi e verificati, mantenendo i vecchi servizi pronti al rollback.
10. Verifica dopo cutover: test prenotazione controllato, riconciliazione conteggi/pagamenti, monitoraggio errori, backup. Eliminare origine SOLO con conferma separata dopo un congruo periodo di osservazione.

## Sequenza operativa / gate
- **G0: Accesso** — autorizzare visibilità progetto `talented-radiance` al collegamento Railway oppure ottenere export inventario dalla destinazione.
- **G1: Snapshot origine** — inventariare schemi, row count e backup per entrambi MySQL; misurare variabili e dipendenze senza esporre segreti.
- **G2: Inventario destinazione** — identificare i servizi già presenti, individuare i conflitti di nomi/dati/volumi e capacità disponibile.
- **G3: Ambiente staging** — creare servizi e DB isolati **soltanto dopo G1/G2**; ripristinare dump e testare integrità.
- **G4: Test end-to-end** — API gestionali, prenotazioni, concorrenza, pagamento sandbox, resilienza e rollback provato.
- **G5: Cutover** — freeze o sync finale, backup finale, aggiornamento config atomico, smoke test e monitoraggio.
- **G6: Decommission** — solo dopo periodo di stabilità e autorizzazione separata.

**Blocco attuale:** con un solo workspace Railway collegato alla volta, posso inventariare l'origine ma non confrontare simultaneamente l'account di destinazione. Trasferire ownership non equivale a fondere due progetti. Non assumere che l'invito `Can Edit` sposti i dati.
