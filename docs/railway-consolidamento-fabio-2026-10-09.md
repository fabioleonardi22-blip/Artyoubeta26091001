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
