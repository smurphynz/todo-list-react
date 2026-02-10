## Calitrack (React + Vite)

This project is a Vite + React frontend and can be deployed to Render as a **Static Site**.

## Local development

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Build production bundle: `npm run build`
- Preview production build: `npm run preview`

## Deploying to Render

This repository includes a `render.yaml` Blueprint config for Render.

### Option A: Blueprint deploy (recommended)

1. Push this repo to GitHub.
2. In Render, choose **New +** → **Blueprint**.
3. Select your repo.
4. Render will read `render.yaml` and create a static site.

### Option B: Manual static site setup

If you prefer creating the service manually:

- **Environment**: Node
- **Build Command**: `npm ci && npm run build`
- **Publish Directory**: `dist`

Render will host the built static assets from `dist`.
