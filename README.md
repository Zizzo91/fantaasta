# FantaAsta AI

Assistente AI per asta del fantacalcio italiano. PWA utilizzabile da qualsiasi dispositivo.

## Funzionalita

- **Configurazione lega**: parametri (crediti, rilancio minimo, composizione rosa), upload CSV quotazioni, partecipanti con flag "Io", wishlist prioritizzata
- **Dashboard**: rose di tutti i partecipanti (giocatori comprati per ruolo), classifica crediti residui, mercato residuo per ruolo, stato wishlist
- **Asta**: selezione chi chiama, ricerca calciatore, suggerimento AI (rilancio/passaggio o chiama/bluff), registrazione esito vendita o svincolato
- **AI**: Google Gemini (gemini-3.6-flash, gratuito) -- suggerimenti basati su contesto asta (budget, slot liberi, avversari, wishlist)
- **Persistenza**: stato salvato in localStorage, esportabile/importabile come JSON
- **PWA**: installabile sul telefono, funziona offline (dati salvati nel browser)

## Demo Live

[Tu puoi linkare la tua demo GitHub Pages qui]

## Installazione come PWA

1. Apri il link della demo su Chrome (Android)
2. Tocca "Aggiungi alla schermata iniziale" (o il banner automatico)
3. L'app apparira come un'app normale nel tuo telefono

## Uso

1. Apri l'app
2. Tab **Config**: inserire parametri lega, caricare CSV quotazioni, aggiungere partecipanti (flaggare "Io"), inserire wishlist, salvare
3. Tab **Impostazioni**: inserire API key Gemini
4. Tab **Asta**: selezionare chi chiama, seguire i suggerimenti AI, registrare le vendite
5. Tab **Dashboard**: monitorare rose, crediti e mercato in tempo reale

## File

```
fantaasta/
  index.html          # SPA con 4 tab (Config, Dashboard, Asta, Impostazioni)
  manifest.json       # PWA manifest
  sw.js               # Service worker per offline
  icons/              # Icone PWA (192x192, 512x512)
  css/style.css       # Dark theme responsive
  js/store.js         # Persistenza localStorage, ricerca giocatori
  js/config.js        # Logica tab Config (CSV, partecipanti, wishlist)
  js/auction.js       # Logica tab Asta (chiamata, rilancio, AI, esito)
  js/dashboard.js     # Rendering dashboard (rose, crediti, mercato, wishlist)
  js/advisor.js       # Integrazione Gemini API, costruzione contesto AI
  js/app.js           # Entry point, routing tab, bind settings
```

## Dipendenze

- [PapaParse](https://www.papaparse.com/) (CDN) -- parsing CSV
- Google Gemini API key (gratuita) -- [ottieni qui](https://aistudio.google.com/apikey)

## Note tecniche

- Nessuna build richiesta: vanilla JS, zero framework
- I dati della sessione (CSV, rose, vendite) restano in localStorage
- L'API Gemini e' gratuita: 15 richieste/min, 1M token/giorno
- Formato CSV: delimitatore `;`, colonne `Id;R;RM;Nome;Squadra;Qt.A;Qt.I;Diff.;Qt.A M;Qt.I M;Diff.M;FVM;FVM M`
- Service worker con strategia "stale-while-revalidate" per uso offline
