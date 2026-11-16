import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({plugins:[react()],base:"/admin/",server:{proxy:{"/api":"http://127.0.0.1:4300","/uploads":"http://127.0.0.1:4300","/assets":"http://127.0.0.1:4300","/game-objects":"http://127.0.0.1:4300"}}});
