import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Single-file build so dist/index.html can be published as one page.
export default defineConfig({
  plugins: [viteSingleFile()],
  server: { port: 5173 },
});
