# [photos.agarun.com](https://photos.agarun.com)

My photography portfolio with galleries, tags, folders, and a globe 🌎

# Setup

The prerequisites are Node >= 20 and npm (comes with Node.js).

First, install the dependencies:

```sh
npm install
```

Run the development server:

```sh
npm run dev
```

Open http://localhost:3000 to see the app!

# Technologies

## Development

The project is written in TypeScript, using Zod, Tailwind, and [Next.js](https://nextjs.org/).

## Visualization

[Globe.GL](https://github.com/vasturiano/globe.gl) for the homepage globe and [cobe](https://github.com/shuding/cobe) for the about page globe

[d3-geo](https://threejs.org/) for globe data

[three](https://threejs.org/) for scene creation

## Images

[PhotoSwipe](https://photoswipe.com/) for image lightboxes

[Masonic](https://github.com/jaredLunde/masonic) for masonry layouts

[Pig](https://github.com/schlosser/pig.js/) for image grid layouts

[`cwebp`](https://developers.google.com/speed/webp/docs/cwebp) for compressing .jpg to .webp images. See `scripts/webp.sh` for details regarding image optimization.

## Hosting

The Next.js site can be deployed as a static export or as a server-side application.

All photo data is currently stored as mock data in the application for demonstration purposes.

## Data Structure

The application uses TypeScript interfaces to define the photo album and folder structures. See the [album types](https://github.com/agarun/photos/blob/main/src/types/albums.ts#L14) for more information.

### Photo Albums

Albums featured on the front page with globe coordinates:

- title: Album name
- photos: Array of photo objects
- color: Display color for the album
- type: "location" or "custom"
- description: Album description
- date: Date string
- lat/lng: Geographic coordinates
- locations: Array of specific locations within the album
- order: Display order

### Photo Folders

Optional folders feature available at the `/folders` route:

- title: Folder name
- parent_title: Parent folder (if nested)
- photos: Array of photo objects
- description: Folder description
- date: Date string
- order: Display order
