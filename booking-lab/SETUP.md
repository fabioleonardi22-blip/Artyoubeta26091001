# Attivazione del laboratorio (solo test)

1. Creare un database **nuovo** chiamato `artyou_booking_lab` su un'istanza MySQL di test. Non usare l'istanza di produzione.
2. Creare un utente MySQL dedicato con privilegi limitati esclusivamente a questo database. Non riutilizzare le credenziali Artyou.
3. Eseguire `schema.sql`, poi `refunds-schema.sql` sul database di test.
4. Configurare `LAB_MYSQL_HOST`, `LAB_MYSQL_PORT`, `LAB_MYSQL_USER`, `LAB_MYSQL_PASSWORD`, `LAB_MYSQL_DATABASE` e `BOOKING_LAB_ENABLED=true` solo nell'ambiente test.
5. Eseguire `node --test booking-lab/*.test.js` in una copia di lavoro Node.js compatibile.
6. Eseguire test di integrazione MySQL con un evento fittizio e verificare capienza, doppie richieste e rimborsi.

## Blocchi di sicurezza ancora aperti

- `settlePayment` non è un endpoint webhook. Prima di esporlo va aggiunta verifica crittografica della firma PayPal, dell'ambiente Sandbox, dell'ID ordine/cattura, dell'importo e della valuta attesa.
- `recordRefund` deve essere invocata solo dopo conferma del rimborso dal provider, mai direttamente da input cliente.
- Non esporre le funzioni database direttamente a browser o utenti non autenticati.
- Occorre gestire prenotazioni pending scadute, retry e cancellazioni in modo idempotente.
- I test unitari non sostituiscono test MySQL reali, test PayPal Sandbox e test end-to-end.
- Nessun deploy o merge in produzione finché tutti i blocchi non sono risolti.
