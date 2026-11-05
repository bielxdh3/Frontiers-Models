import { defineConfig } from 'vite';
import {readFileSync} from 'node:fs';
export default defineConfig({base:'./',plugins:[{name:'track-source',generateBundle(){this.emitFile({type:'asset',fileName:'track.json',source:readFileSync(new URL('./track.json',import.meta.url),'utf8')})}}],build:{target:'es2022',chunkSizeWarningLimit:1200},server:{port:5173,strictPort:true}});
