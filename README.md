# Tank Online: Armored Front

Ikkinchi jahon urushi muhitidagi top-down 2D, server-authoritative multiplayer tank o‘yini. 6144×6144 birliklik katta maydonlar, 10 ta o‘ziga xos tank va faqat haqiqiy o‘yinchilar mavjud.

## Talablar

- Node.js 24 LTS
- npm 11+
- Docker Desktop (PostgreSQL bilan to‘liq rejim uchun)

## Ishga tushirish

### Docker Compose — boshqa kompyuterga ko‘chirish uchun

Node.js o‘rnatmasdan web + multiplayer server + PostgreSQL ishlaydi.
Avval `.env.docker.example` dan `.env.docker` yarating va ikkita alohida
tasodifiy hex qiymat bilan `POSTGRES_PASSWORD`, `JWT_SECRET` ni to‘ldiring.

```bash
docker compose --env-file .env.docker -f docker-compose.game.yml up -d --build
```

Manzil: `http://localhost:8080` yoki `http://<LAN-IP>:8080`.
To‘liq Ubuntu yo‘riqnomasi: [deploy/README.md](deploy/README.md).
Faqat TCP 8080 tashqariga chiqariladi; API va WebSocket bir portdan ishlaydi.

### Node.js orqali development

```bash
corepack enable
pnpm install
npm run dev
```

`npm run dev` PostgreSQL bo‘lmasa xotiradagi development storage bilan ishlaydi. To‘liq lokal stack:

```bash
copy .env.example .env
npm run dev:full
```

Web: `http://localhost:5173`  
Server va health: `http://localhost:2567/health`

### Boshqa qurilmadan ulanish

Web `0.0.0.0:5173`, o‘yin serveri esa `0.0.0.0:2567` da tinglaydi
(server manzilini `HOST` environment variable bilan almashtirish mumkin).
Bir tarmoqdagi qurilmada `http://<kompyuter-LAN-IP>:5173` ni oching.
`0.0.0.0` brauzerga yoziladigan manzil emas. Windows Firewall ikkala TCP
portga ham tegishli tarmoqdan kirishga ruxsat berishi kerak.
Client uchun `VITE_SERVER_URL` berilgan bo‘lsa, u boshqa qurilmada ham
ochiladigan server URL bo‘lishi kerak; `localhost` faqat o‘sha qurilmaga ishora qiladi.

Internetdan kirish uchun faqat `0.0.0.0` yetarli emas: public IP va router
port-forwarding yoki HTTPS/WSS reverse proxy/tunnel kerak. CGNAT bo‘lsa odatiy
port-forwarding yetarli bo‘lmaydi. Public web origin serverdagi `WEB_ORIGIN`
ro‘yxatiga aniq qo‘shilishi kerak. Vite development serverini doimiy public
hosting sifatida ishlatmang; production build, HTTPS, kuchli `JWT_SECRET`
va persistent ma’lumotlar bazasi bilan joylashtiring.

Ikki yoki undan ko‘p browser oynasida guest nickname bilan kirib bir xonaga ulaning. Botlar yo‘q; bitta o‘yinchi warmup hududida boshqaruvni sinaydi.

## Boshqaruv va unumdorlik

- WASD — harakat; sichqoncha — nishon; chap tugma — oddiy o‘q.
- Q yoki HUD’dagi qobiliyat tugmasi — maxsus hujum/himoya.
- Scroll yoki +/− — zoom. Mobil ekranda yo‘nalish va FIRE tugmalari mavjud.
- Chap yuqorida FPS va tarmoq round-trip vaqti ko‘rsatiladi. Ustiga olib borilsa frame p95, update/render CPU va renderer turi chiqadi.
- Lokal tank kadr tezligida taxminiy harakat qiladi; timestamp’li server holati bilan tuzatiladi. Boshqa tanklar 100 ms snapshot buferidan silliqlanadi. Zarar, collision va balans server nazoratida qoladi.
- Yer detallari va dekorlar oldindan teksturaga yoziladi; HP faqat o‘zgarganda, izlar va minimap 10 Hz yangilanadi.
- GPU tezlashtirishi mavjud bo‘lsa WebGL; SwiftShader/llvmpipe kabi dasturiy WebGL yoki WebGL mavjud bo‘lmasa Canvas 2D avtomatik tanlanadi. O‘yin qoidalari va grafik assetlar bir xil.
- Development storage xotirada bo‘lsa server qayta ishga tushganda refresh sessiyalar yo‘qoladi. Shunda qayta kirish kerak; odatiy token muddati tugashi avtomatik refresh qilinadi.

## Buyruqlar

- `npm run dev` — web va server
- `npm run dev:full` — PostgreSQL, web va server
- `npm run build` — production build
- `npm run typecheck` — barcha workspace type-check
- `npm test` — unit va integration testlar
- `npm run test:e2e` — desktop va mobil Chromium E2E testi

## Arxitektura

- `apps/web` — Vue 3 menyu/HUD va Phaser 4 top-down 2D jang sahnasi
- `apps/server` — 20 Hz authoritative Colyseus server, REST auth va PostgreSQL adapter
- `packages/shared` — 10 tank balansi, 6144-unit xaritalar, collision va umumiy tiplar
# tank-online
