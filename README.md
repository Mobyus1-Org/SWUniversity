# SWUniversity

SWUniversity is a Next.js + React + TypeScript app for learning and practicing STAR WARS: Unlimited.

## Tech Stack

- Next.js 16 (`pages` router)
- React 18
- TypeScript
- Tailwind CSS v4 + daisyUI v5

## Runtime Requirements

- Node.js 20.9+ (required by Next.js 16)

## Scripts

- `npm run dev` - Start local dev server
- `npm run build` - Production build
- `npm run start` - Run production server
- `npm run lint` - Run ESLint

## Migration Notes

This repository has been migrated from Vite to Next.js.
The active runtime entrypoint is `pages/_app.tsx` and routes in `pages/`.

## Assets

Static assets are served from `public/` and referenced with `/assets/...` paths.
