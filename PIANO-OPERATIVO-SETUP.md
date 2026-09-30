# Piano Operativo Artyou – Attivazione backend

Questa branch contiene già:
- pagina `/calendario-docenti/`
- bacheca operativa
- responsabili e contatti
- API Vercel `/api/plan`
- backend Apps Script `google-apps-script/PianoOperativo.gs`
- routing integrato in `google-apps-script/GestionaleEventi.gs`

## 1. Copiare il backend nel progetto Apps Script del Gestionale Eventi
Nel progetto Apps Script che pubblica il Gestionale Eventi:
1. sostituire `GestionaleEventi.gs` con la versione di questa branch;
2. creare un nuovo file `PianoOperativo.gs`;
3. incollare il contenuto del file omonimo presente in questa branch.

## 2. Proprietà script
Impostare:
- `PO_ADMIN_EMAILS` = email degli amministratori separate da virgola
- `PO_CALENDAR_ID` = facoltativo. Se non impostato, eseguendo `PO_setup("email-admin")` viene creato un calendario dedicato.
- `PO_WHATSAPP_TOKEN` = token WhatsApp Business, solo quando si attiveranno i promemoria WhatsApp
- `PO_WHATSAPP_PHONE_ID` = Phone Number ID WhatsApp Business

Restano valide le proprietà già usate dal Gestionale:
- `ARTYOU_SHEET_ID`
- `ARTYOU_GESTIONALE_PIN`

## 3. Setup iniziale
Eseguire una volta dall'editor Apps Script:

```javascript
PO_setup("EMAIL_ADMIN")
```

Questo:
- crea i fogli `PianoOperativo` e `Responsabili`;
- crea, se necessario, il calendario `Artyou · Piano Operativo`;
- installa il controllo giornaliero dei promemoria alle 09:00.

## 4. Deploy
Pubblicare una nuova versione della Web App Apps Script mantenendo lo stesso URL `/exec` usato dal Gestionale Eventi.

## 5. Attivare il sito
Dopo il deploy, modificare:

`js/artyou-calendar-config.js`

in:

```javascript
window.ARTYOU_CALENDAR_ENDPOINT = "/api/plan";
```

## Comportamento finale
- Evento creato nel Piano Operativo → salvato nel foglio + creato/aggiornato su Google Calendar.
- Evento creato direttamente nel calendario Artyou → visibile nel Piano Operativo.
- Responsabili registrati → selezionabili nelle attività.
- Promemoria email → disponibili.
- WhatsApp → disponibile quando vengono configurate le credenziali ufficiali Meta.
- Attività con stato `Fatto` → nessun ulteriore promemoria.


## Accesso Google e permessi

Il Piano Operativo usa Google Identity Services. Configurare in Vercel:

- `GOOGLE_CLIENT_ID`: Client ID OAuth 2.0 di tipo Applicazione web.
- Origini JavaScript autorizzate: dominio principale, dominio Vercel di produzione e preview usata per i test.

La persona deve essere presente nel foglio `Responsabili`, con email Google esatta e stato attivo. I livelli supportati sono:

- `Amministratore`: accesso completo, compresa Anagrafica.
- `Staff`: modifica Piano Operativo, attività e riunioni; Anagrafica in sola lettura.
- `Docente`: Piano Operativo in sola lettura.

Gli amministratori configurati in `PO_ADMIN_EMAILS` restano amministratori anche se non sono ancora presenti in Anagrafica.

## Checklist prima della pubblicazione

1. Copiare nel progetto Apps Script sia `GestionaleEventi.gs` sia `PianoOperativo.gs`.
2. Eseguire `PO_setup("EMAIL_ADMIN")` una volta.
3. Ridistribuire la Web App Apps Script mantenendo lo stesso URL `/exec`.
4. Configurare `GOOGLE_CLIENT_ID` su Vercel e ridistribuire.
5. Inserire almeno un amministratore e un docente di prova nell'Anagrafica.
6. Verificare: admin entra e modifica; Staff modifica il piano ma non l'anagrafica; Docente vede in sola lettura; account non registrato o non attivo viene rifiutato.
7. Verificare una riunione con invito Calendar e promemoria e-mail/WhatsApp.
8. Verificare generazione Piano Operativo da Spettacolo, Workshop e YEP e assenza di duplicati.
9. Verificare da mobile Mese, Agenda, Bacheca, Piano Operativo e Anagrafica.

Il foglio `PianoOperativoAudit` viene creato automaticamente e registra creazione, modifica ed eliminazione di attività e anagrafiche.
