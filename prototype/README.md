# Prototype

The single-page PM-AVN app that this product started as: home, my work, boards, lists, timelines, meeting notes from transcripts, whiteboard, documents.

It was built to run as a Claude artifact, where Claude and account storage are provided by the page host. Opened as a plain file it still works, in offline mode: data stays in the browser and the Claude features are switched off.

```bash
npm run prototype      # writes prototype/index.html
```

Files: `core.js` (transcript parsing, heuristics, dates), `app1.js` (state, storage, Claude calls), `app2.js` (views and events), `style.css`, `sample.txt` (a sample transcript).

Use it as the reference when porting screens into `src/`. Do not add features here.
