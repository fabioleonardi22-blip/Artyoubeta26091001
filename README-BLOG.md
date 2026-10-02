# La finestra sul cortile

Blog editoriale automatico di Artyou Roma.

## Struttura
- `/la-finestra-sul-cortile/`: archivio pubblico.
- `/blog/articles.json`: indice degli articoli e Festival Radar.
- `/scripts/generate-blog.mjs`: generatore.
- `.github/workflows/weekly-blog.yml`: esecuzione ogni mercoledì alle 08:15 UTC (10:15 a Roma con ora legale, 09:15 con ora solare).

## Attivazione
Nel repository GitHub aggiungere un Actions secret chiamato `OPENAI_API_KEY`.
Il workflow può anche essere avviato manualmente da Actions > Weekly blog - La finestra sul cortile > Run workflow.

## Regole editoriali
Il generatore usa ricerca web e richiede almeno una fonte URL valida. Date, festival e profili non devono essere inventati. Le categorie ruotano settimanalmente:
1. Improv around the world
2. Festival Radar
3. Impro People
4. Dentro l'improv

Per la fase di test questa branch non va unita in main finché grafica e contenuti non sono approvati.
