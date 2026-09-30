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
