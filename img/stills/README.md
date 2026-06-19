# Still / frame della serie — domande con immagine

Metti qui le immagini (frame, scene, cameo) da usare nelle domande, es:

    img/stills/s03-frame-01.jpg
    img/stills/cameo-brad-pitt.jpg

Formati consigliati: `.jpg` / `.webp`, lato lungo ~800px (restano leggere).

## Come aggiungere una domanda con immagine

In `data.js` ogni domanda è un oggetto. Per mostrarne una con immagine,
aggiungi il campo `image` con il percorso del file. Esempio:

```js
{
  "id": 900,
  "image": "img/stills/s03-frame-01.jpg",
  "question": "Which season is this frame from?",
  "question_it": "Di che stagione è questo frame?",
  "options": ["Season 2","Season 3","Season 4","Season 5"],
  "options_it": ["Stagione 2","Stagione 3","Stagione 4","Stagione 5"],
  "answer": "Season 3",
  "answer_it": "Stagione 3",
  "difficulty": "hard",
  "episode": "S03"
}
```

Per i cameo:

```js
{
  "id": 901,
  "image": "img/stills/cameo-x.jpg",
  "question": "What's the name of this character?",
  "question_it": "Come si chiama questo personaggio?",
  "options": ["...","...","...","..."],
  "options_it": ["...","...","...","..."],
  "answer": "...",
  "answer_it": "...",
  "difficulty": "expert",
  "episode": "S04"
}
```

Note:
- `image` è **facoltativo**: le domande senza immagine funzionano come prima.
- `answer` deve corrispondere ESATTAMENTE a una delle `options` (stessa lingua),
  e `answer_it` a una delle `options_it`.
- L'immagine appare sopra il testo della domanda, con cornice dorata.
- Ricordati di alzare il numero di versione nei tag `?v=` in `index.html`
  (es. `data.js?v=4`) quando aggiorni `data.js`, così salti la cache del browser.
