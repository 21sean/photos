# Photos

An interactive HDR photography portfolio featuring travel photos from around the world, displayed on an immersive 3D globe interface.

## Features

- **Interactive 3D Globe**: Explore albums by location on a rotating globe with smooth interaction
- **HDR-aware pipeline**: EXIF + HDR metadata extracted at build time; P3-aware image styling
- **Responsive gallery**: Masonry layout with hover EXIF badge (focal/aperture/shutter/ISO)
- **Location-based albums**: Photos organized by destination
- **Modern UI**: Tailwind CSS + Next.js App Router
- **Static export ready**: Ship as a static site or run SSR

## Technology Stack

- **Framework**: [Next.js 14](https://nextjs.org/) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **3D Visualization**: [React Three Fiber](https://docs.pmnd.rs/react-three-fiber), [Three.js](https://threejs.org/), [Cobe](https://github.com/shuding/cobe)
- **Layout**: [Masonic](https://github.com/jaredLunde/masonic) for masonry grid layouts

## Getting Started

### Prerequisites

- Node.js 20+ (recommended)
- npm or compatible package manager

### Installation

1. Clone the repository:
```sh
git clone https://github.com/21sean/photos.git
cd photos
```

2. Install dependencies:
```sh
npm install
```

3. Run the development server:
```sh
npm run dev
```

4. Open http://localhost:3000 in your browser

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format:fix` - Fix code formatting with Prettier
- `npm run check` - Run TypeScript type checking
- `npm run knip` - Find unused dependencies and exports
- `npm run check:all` - Run all checks (TypeScript, Knip, ESLint, Prettier)
- `npm run test` - Run Playwright tests
- `npm run build:static` - Build as static site for export
- `npm run deploy:static` - Build and deploy static site

### Project Structure

```
src/
├── app/              # Next.js App Router pages
│   ├── [slug]/       # Dynamic album pages
│   ├── about/        # About page
│   ├── folders/      # Folder views
│   ├── tags/         # Tag-based filtering
│   └── page.tsx      # Homepage with globe
├── components/       # React components
├── lib/              # Utilities and data
│   ├── globes/       # Globe visualization components
│   ├── mock-data.ts  # Album and photo data
│   └── api.ts        # Data fetching logic
├── types/            # TypeScript type definitions
├── hooks/            # Custom React hooks
├── data/             # Static data files
└── fonts/            # Custom fonts
```

## Data Configuration

Photos are sourced from Cloudflare R2 and materialized into `src/lib/photos.json` (generated). Albums live in `src/lib/mock-data.ts` and reference photos via `src/lib/photos.ts` helpers.

### Photo manifest generation (EXIF + HDR)

Run the sync script to rebuild `src/lib/photos.json` from the R2 bucket and extract EXIF:

```sh
npm run sync:photos      # or: node scripts/sync-photos.js
# Optional flags:
#   --dry-run   Preview JSON to stdout
#   --quick     Skip EXIF extraction (faster)
```

The script pulls width/height, ISO, aperture, shutter, focal length, date, GPS (if present), and tries to capture HDR mastering luminance if available. HDR fields appear under `hdrMetadata` when present.

## Deployment

### Static Export

The project supports static site generation:

```sh
npm run build:static
```

This creates a fully static version in the `out/` directory that can be deployed to any static hosting service (Vercel, Netlify, GitHub Pages, etc.).

### Standard Deployment

For server-side rendering, deploy using Next.js-compatible platforms like Vercel:

```sh
npm run build
npm run start
```

## License

Private portfolio project.
