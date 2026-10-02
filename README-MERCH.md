# Artyou Merch – magazzino e ordini

Il magazzino del merchandising vive in un **Google Sheet dedicato**. La pagina `merchandising.html` lo legge tramite `/api/merch` (proxy Vercel in `api/merch.js`), che a sua volta chiama lo script `google-apps-script/MerchMagazzino.gs`.

Finché lo script non è collegato, la pagina funziona lo stesso in **modalità solo WhatsApp**: niente disponibilità mostrate, l'ordine parte come messaggio WhatsApp.

## Messa in funzione (una volta sola, ~10 minuti)

1. Crea un nuovo Google Sheet, per esempio **"Artyou Merch"**, con l'account Artyou. Non usare il foglio delle prenotazioni spettacoli.
2. Apri **Estensioni → Apps Script**, cancella il contenuto e incolla `google-apps-script/MerchMagazzino.gs`.
3. In alto in `MERCH` controlla gli indirizzi email che ricevono gli ordini (`EMAIL_ADMIN`, `EMAIL_BACKUP`).
4. Seleziona la funzione **setup** e premi **▶ Esegui**. Google chiederà le autorizzazioni (fogli, email, trigger): accetta.
   Si creano i fogli **Magazzino** (già compilato con tutte le varianti a quantità 0) e **Ordini**.
5. **Distribuisci → Nuova distribuzione → Applicazione web**
   - Esegui come: **Me**
   - Chi ha accesso: **Chiunque**
   Copia l'URL che finisce con `/exec`.
6. Su Vercel, nel progetto del sito: **Settings → Environment Variables** → aggiungi `MERCH_APPS_SCRIPT_URL` con quell'URL (per Production e Preview), poi rifai il deploy.
   In alternativa incolla l'URL direttamente in `api/merch.js` al posto di `INCOLLA_QUI_URL_EXEC`.
7. Nel foglio **Magazzino** inserisci le quantità reali nella colonna **Disponibili**. Da quel momento il sito mostra le disponibilità vere.

> Se modifichi lo script in futuro: **Distribuisci → Gestisci distribuzioni → ✏️ → Versione: nuova**. Così l'URL resta lo stesso.

## Uso quotidiano

**Foglio Magazzino** – una riga per variante (prodotto + colore + taglia)
- `Disponibili`: i pezzi in sede. Si aggiorna da solo a ogni ordine; correggilo a mano quando arriva merce nuova o vendi un capo di persona.
- `Prezzo`: il prezzo che vale davvero (il sito lo mostra e il totale dell'ordine si calcola da qui).
- `Attivo`: togli la spunta per nascondere una variante dal sito. Se togli tutte le varianti di un prodotto, il prodotto sparisce.

**Foglio Ordini** – ogni ordine dal sito arriva qui, e in più ricevete un'email.
- `Stato` (menu a tendina): **Riservato** → **Pronto** → **Ritirato**.
- Mettendo **Annullato** i pezzi tornano da soli in magazzino (colonna "Pezzi restituiti" = Sì). Non rimettere poi l'ordine in un altro stato: i pezzi non verrebbero riscalati.
- L'ultima colonna è nascosta e serve allo script: non modificarla.

## Cosa succede quando un cliente ordina
1. Il sito invia l'ordine; lo script blocca il foglio per un istante, controlla le quantità e le scala (due clienti non possono prendere lo stesso ultimo pezzo).
2. Se un capo è finito nel frattempo, il cliente lo vede segnato in rosso nel carrello e può correggere.
3. L'ordine viene salvato come **Riservato**, parte l'email agli indirizzi in `MERCH`, il cliente vede il numero d'ordine (`MERCH-0001`…) e può scrivervi su WhatsApp.
4. Il pagamento avviene al ritiro in sede.

## Aggiungere un prodotto nuovo
1. Carica la foto in `img/merch/` e aggiungi il prodotto all'elenco `PRODUCTS` in `merchandising.html` (scegli un `id`, per esempio `tote-bag`).
2. Nel foglio Magazzino aggiungi una riga per ogni colore/taglia con **lo stesso `ProdottoID`** e gli stessi nomi di colori e taglie usati nella pagina.

## Note
- `merchandising-gestionale.html` era la demo che salvava i dati nel browser: con il Google Sheet non serve più e si può eliminare.
- Il carrello del cliente resta salvato nel suo browser finché non invia l'ordine.