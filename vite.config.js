import { defineConfig } from 'vite'
import { readdir } from 'node:fs/promises'

async function findPublicImages(directory, relativeDirectory = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      return findPublicImages(`${directory}/${entry.name}`, relativePath)
    }
    return /\.(nii(?:\.gz)?|mgh|mgz|mnc|hdr|img)$/i.test(entry.name) ? [relativePath] : []
  }))
  return nested.flat().sort()
}

function publicImageManifest() {
  let publicDirectory
  return {
    name: 'public-image-manifest',
    configResolved(config) {
      publicDirectory = config.publicDir
    },
    transformIndexHtml: {
      order: 'pre',
      async handler() {
        const files = await findPublicImages(publicDirectory)
        const manifest = JSON.stringify(files).replace(/</g, '\\u003c')
        return [{
          tag: 'script',
          children: `window.__PUBLIC_IMAGE_FILES__ = ${manifest}`,
          injectTo: 'head',
        }]
      },
    },
  }
}

export default defineConfig({
  root: '.',
  base: './',
  plugins: [publicImageManifest()],
  server: {
    open: 'index.html'
  },
  build: {
    rollupOptions: {
      output: {
        format: 'es'
      }
    }
  },
  worker: {
    format: 'es'
  },
  // exclude @niivue/niimath from optimization
  optimizeDeps: {
    exclude: ['@niivue/niimath']
  }
})