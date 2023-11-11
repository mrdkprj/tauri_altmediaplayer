import { defineConfig } from "vite";
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(async () => ({
    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
        port: 1420,
        strictPort: true,
    },
    // 3. to make use of `TAURI_DEBUG` and other env variables
    // https://tauri.app/v1/api/config#buildconfig.beforedevcommand
    envPrefix: ["VITE_", "TAURI_"],

    build:{
        rollupOptions: {
            input: {
                player: resolve(__dirname, 'src/player/player.html'),
                playlist: resolve(__dirname, 'src/playlist/playlist.html'),
                menu: resolve(__dirname, 'src/menu/menu.html'),
            },
        }
    }

}));
