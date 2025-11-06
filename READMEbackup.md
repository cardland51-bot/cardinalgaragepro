# JARED-HERO2 Frontend (Canvas-only UI)

- Mobile-first canvas UI (corporate green)
- Push-to-talk "Jared", image upload/preview, TTS playback
- Works with backend at `window.API_BASE`

## Local quick start
Open `index.html` in a local static server (recommended) and set:
```html
<script>window.API_BASE="http://localhost:3001";</script>
```
Run any simple static server (e.g., VS Code Live Server).

## Deploy
Host these files on any static hosting (GitHub Pages, Netlify, Render static sites). Point `API_BASE` to your backend URL.
