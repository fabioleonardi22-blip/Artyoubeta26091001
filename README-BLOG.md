# La finestra sul cortile

Blog editoriale automatico di Artyou Roma.

## Struttura
- `/la-finestra-sul-cortile/`: archivio pubblico.
- `/blog/articles.json`: indice degli articoli.
- `/blog/sources.json`: fonti ufficiali autorizzate.
- `/scripts/generate-blog.mjs`: generatore automatico.
- `.github/workflows/weekly-blog.yml`: esecuzione settimanale.

## Provider AI
Il generatore usa:
1. Gemini API come provider principale.
2. OpenRouter Free come fallback.

Secrets GitHub richiesti:
- `GEMINI_API_KEY`
- `OPENROUTER_API_KEY`

## Programmazione
Il workflow parte ogni mercoledì alle 08:15 UTC e può essere avviato anche manualmente da GitHub Actions.

## Regole editoriali
Il generatore legge direttamente un elenco di fonti ufficiali e chiede al modello di usare solo quelle. Non deve inventare festival, date, biografie, ruoli, citazioni o eventi.

Le categorie ruotano:
1. Improv around the world
2. Festival Radar
3. Impro People
4. Dentro l'improv

Gli articoli sono in italiano e hanno una lunghezza indicativa di 1000-1500 caratteri.

La branch di test resta separata da `main` finché non viene approvata.

## Foto degli articoli (Unsplash)
Ogni articolo nuovo riceve una foto d'atmosfera da Unsplash, cercata con le parole chiave suggerite dal modello (`image_query`, sempre luoghi o temi, mai persone). Se non trova nulla usa una ricerca di riserva per rubrica; se Unsplash non risponde, l'articolo esce lo stesso con il riquadro colorato.

- Segreto GitHub richiesto: `UNSPLASH_ACCESS_KEY` (gratuito, da unsplash.com/developers).
- Le foto restano ospitate su Unsplash e ogni articolo cita il fotografo, come chiedono le linee guida Unsplash.
- `node scripts/blog-images.mjs` aggiunge la foto agli articoli che non ce l'hanno (gira anche ogni settimana nel workflow).
- Per scegliere una foto a mano basta scrivere nell'articolo in `blog/articles.json` i campi `image`, `imageThumb`, `imageAlt`, `imageCredit` (`name`, `url`).

## Due articoli a settimana e Festival Radar
- **Lunedì** esce sempre un articolo **Festival Radar**; **giovedì** un articolo delle altre rubriche a rotazione (Improv around the world, Impro People, Dentro l'improv).
- Ogni esecuzione legge i calendari internazionali dei festival elencati in `blog/sources.json` con `"type": "festival-directory"`, ne estrae i festival in programma nei prossimi 12 mesi e controlla il sito ufficiale di ognuno: compare "Verificato sul sito ufficiale" solo se il sito risponde e riporta nome e anno.
- I festival trovati aggiornano il riquadro "Festival Radar" dell'archivio; quelli già raccontati finiscono in `festivalsCovered` per non ripeterli.
- Avvio manuale: Actions → Weekly blog → Run workflow, scegliendo eventualmente la rubrica.
- Per aggiungere un calendario di festival basta inserire in `sources.json` una voce con `"type": "festival-directory"`.
