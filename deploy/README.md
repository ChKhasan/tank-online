# Docker Compose bilan ishga tushirish

Ubuntu: Docker Engine va Compose v2 plugin o‘rnatilgan bo‘lishi kerak.
Windows: Linux containers rejimidagi Docker Desktop ishlayotgan bo‘lsin.
Host kompyuterga Node.js, pnpm yoki PostgreSQL o‘rnatish shart emas.

## Birinchi ishga tushirish (Ubuntu)

Butun loyihani ko‘chiring; `node_modules`, `dist`, `.git`, `.env*` maxfiy
fayllarni ko‘chirmang. `.env.docker.example` namunasi qolishi kerak.
Quyidagi buyruqlarni loyiha ildizida bajaring:

```bash
docker version
docker compose version
cp .env.docker.example .env.docker
openssl rand -hex 32
openssl rand -hex 32
nano .env.docker
```

Birinchi tasodifiy qiymatni `POSTGRES_PASSWORD`, ikkinchisini `JWT_SECRET`
qatoriga joylang. Parolga hex qiymat ishlating: u DATABASE_URL ichida ham
ishlatiladi. `.env.docker` ni Git yoki boshqa odamlarga yubormang.
`WEB_ORIGIN` ichida ishlatadigan aniq brauzer manzillarini vergul bilan yozing,
masalan `http://localhost:8080,http://172.16.16.33:8080`.

```bash
docker compose --env-file .env.docker -f docker-compose.game.yml up -d --build
docker compose --env-file .env.docker -f docker-compose.game.yml ps
```

Uch servis ham `healthy` bo‘lishini kuting. Birinchi build internet va bir
necha daqiqa talab qiladi. O‘sha kompyuterda `http://localhost:8080`, LAN orqali
`http://172.16.16.33:8080` ochiladi (Ubuntu IP manzili o‘zgarsa uni almashtiring).
Cookie va multiplayer bir xil origin orqali ishlaydi, clientga Windows IP'si
yoki alohida backend URL yozish kerak emas.

```bash
curl http://localhost:8080/backend/health
```

`{"ok":true,...}` kutiladi. Web — Nginx production build; `/backend/` orqali
API, matchmaking va WebSocket serverga proxy qilinadi. Faqat `8080` hostga
chiqariladi; `2567` va `5432` Docker ichki tarmog‘ida qoladi.
Firewall to‘ssa, faqat ishonchli LAN/client uchun TCP 8080 ga ruxsat bering.
Docker mavjud tarmoq yoki tashkilot firewall cheklovlarini chetlab o‘tmaydi.

## Kundalik buyruqlar

```bash
# Loglar (chiqish: Ctrl+C; konteynerlar ishlashda davom etadi)
docker compose --env-file .env.docker -f docker-compose.game.yml logs -f --tail=100

# Kod yangilangandan keyin build/recreate
docker compose --env-file .env.docker -f docker-compose.game.yml up -d --build

# To‘xtatish — baza volume ichida qoladi
docker compose --env-file .env.docker -f docker-compose.game.yml down

# Qayta yoqish
docker compose --env-file .env.docker -f docker-compose.game.yml up -d
```

`down -v` ishlatmang: bazadagi akkaunt va statistikani o‘chiradi.
Server restartida faol janglar tugaydi, ammo PostgreSQL ma’lumotlari qoladi.
Mavjud baza volume bo‘lsa `.env.docker` dagi parolni o‘zgartirish PostgreSQL
parolini avtomatik o‘zgartirmaydi. Parol va JWT secretni saqlab qo‘ying.
Docker rejimida baza ulanmasa server memory fallback bilan ishlamaydi,
xato beradi — ma’lumotning sezilmasdan vaqtinchalik saqlanishi oldi olinadi.

Port band bo‘lsa `.env.docker` ichida `HTTP_PORT=8081` qilib, `WEB_ORIGIN`
manzillaridagi portlarni ham yangilang va `up -d` ni qayta bajaring.

Bu LAN demo konfiguratsiyasi. Internetga chiqarishdan oldin HTTPS/WSS,
secure cookie sozlamalari, origin tekshiruvi va xavfsizlik auditi kerak.
Production multi-replica scaling bu konfiguratsiyaga kirmaydi.

Eski `docker-compose.yml` faqat lokal development PostgreSQL uchun saqlandi;
to‘liq o‘yinni ishga tushirishda har doim `-f docker-compose.game.yml` ishlating.
