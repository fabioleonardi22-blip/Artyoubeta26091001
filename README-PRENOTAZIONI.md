# ARTOU Booking System v2

Sistema per capienza e prenotazioni degli spettacoli.

1. Apri il Google Sheet delle prenotazioni.
2. Estensioni → Apps Script.
3. Sostituisci il contenuto con `google-apps-script/Code.gs`.
4. Esegui una volta `setup()`.
5. Distribuisci come Applicazione web: Esegui come Me, accesso Chiunque.
6. Se l'URL /exec cambia, aggiorna `js/artyou-booking-config.js`.

Foglio Eventi:
`Evento | Titolo | Data | Capienza | Prezzo | Attivo`

Il campo Evento deve coincidere con `f-evento-id` del sito.

Stati:
- HOLD: posti bloccati 15 minuti durante pagamento online
- RISERVATO: prenotazione attiva con pagamento in cassa
- PAGATO: pagamento confermato
- SCADUTO: hold non pagato
- ANNULLATO: posti liberati

Il conteggio usa LockService per evitare sovraprenotazioni simultanee.

PayPal: la struttura è predisposta per HOLD → PAGATO. La conferma automatica richiede un webhook/IPN PayPal Business; il semplice ritorno del browser da PayPal non è prova di pagamento.

Email: invio a artyouroma@gmail.com e al cliente con MailApp, usando body + htmlBody.