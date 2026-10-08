# Booking Lab — ambiente isolato

Questa branch serve a sviluppare e validare il nuovo flusso prenotazioni prima di qualunque migrazione.

## Regole di sicurezza
- Non collegare il laboratorio al database MySQL di produzione con credenziali di scrittura.
- Usare un database/schema di test separato e credenziali limitate.
- PayPal esclusivamente Sandbox: nessuna chiamata di pagamento reale.
- Nessuna email, QR o WhatsApp a clienti reali; usare indirizzi e destinatari di test.
- Nessun deploy automatico in produzione, nessun merge in `main` senza verifica.
- Nessuna modifica alle prenotazioni esistenti.

## Scenari obbligatori
1. Prenotazione riuscita con decremento atomico della capienza.
2. Ultimo posto conteso da richieste simultanee: un solo vincitore.
3. Evento esaurito: risposta coerente, nessun overbooking.
4. Pagamento fallito o annullato: nessuna prenotazione pagata fittizia.
5. Webhook PayPal duplicato: idempotenza e nessun doppio accredito.
6. Rimborso completo/parziale: riconciliazione con prenotazione e contabilità.
7. Timeout e retry: nessun duplicato.
8. Confronto tra dati di test e report gestionale.
9. Controlli accesso, segreti, logging senza dati sensibili.
10. Verifica regressioni SEO e responsive sulle pagine pubbliche interessate.

## Criteri di passaggio
Tutti i test critici verdi; report di riconciliazione senza differenze non spiegate; backup e piano di rollback documentati; verifica manuale prima di abilitare traffico reale.

## Stato
Piano di test iniziale. Questo file non implica che l'infrastruttura sandbox o i test siano già attivi.
