import { randomUUID } from 'node:crypto'
import postgres, { type Sql } from 'postgres'
import type { PublicProfile, TankId } from '@tank-online/shared'

interface StoredProfile extends PublicProfile {
  passwordHash: string | null
}

interface SessionRecord {
  userId: string
  tokenHash: string
  expiresAt: Date
}

export class GameStore {
  private sql: Sql | null = null
  private readonly users = new Map<string, StoredProfile>()
  private readonly sessions = new Map<string, SessionRecord>()

  async boot() {
    if (!process.env.DATABASE_URL) {
      if (process.env.REQUIRE_DATABASE === 'true') throw new Error('DATABASE_URL is required')
      console.info('[storage] DATABASE_URL yo‘q — memory development store ishlaydi.')
      return
    }

    try {
      this.sql = postgres(process.env.DATABASE_URL, { connect_timeout: 3, max: 5 })
      await this.sql`select 1`
      await this.migrate()
      console.info('[storage] PostgreSQL ulandi.')
    } catch (error) {
      if (process.env.REQUIRE_DATABASE === 'true') {
        await this.sql?.end({ timeout: 1 }).catch(() => undefined)
        this.sql = null
        throw error
      }
      console.warn('[storage] PostgreSQL mavjud emas, memory fallback ishlaydi.', error)
      await this.sql?.end({ timeout: 1 }).catch(() => undefined)
      this.sql = null
    }
  }

  private async migrate() {
    if (!this.sql) return
    await this.sql.unsafe(`
      create table if not exists users (
        id uuid primary key,
        email text unique,
        password_hash text,
        is_guest boolean not null default true,
        created_at timestamptz not null default now()
      );
      create table if not exists profiles (
        user_id uuid primary key references users(id) on delete cascade,
        nickname varchar(16) not null,
        level integer not null default 1,
        xp integer not null default 0,
        credits integer not null default 500,
        matches integer not null default 0,
        wins integer not null default 0,
        favorite_tank varchar(24) not null default 'assault'
      );
      create table if not exists sessions (
        token_hash text primary key,
        user_id uuid not null references users(id) on delete cascade,
        expires_at timestamptz not null
      );
      create table if not exists inventory (
        user_id uuid not null references users(id) on delete cascade,
        item_id text not null,
        acquired_at timestamptz not null default now(),
        primary key (user_id, item_id)
      );
      create table if not exists tank_stats (
        user_id uuid not null references users(id) on delete cascade,
        tank_id varchar(24) not null,
        matches integer not null default 0,
        kills integer not null default 0,
        deaths integer not null default 0,
        primary key (user_id, tank_id)
      );
      create table if not exists matches (
        id uuid primary key,
        mode varchar(24) not null,
        map_id varchar(24) not null,
        winner varchar(16),
        ended_at timestamptz not null default now()
      );
      create table if not exists match_players (
        match_id uuid not null references matches(id) on delete cascade,
        user_id uuid not null references users(id) on delete cascade,
        tank_id varchar(24) not null,
        team varchar(16) not null,
        kills integer not null,
        deaths integer not null,
        won boolean not null,
        primary key (match_id, user_id)
      );
    `)
  }

  async createGuest(nickname: string): Promise<PublicProfile> {
    const profile: StoredProfile = {
      id: randomUUID(), nickname, email: null, passwordHash: null, isGuest: true,
      level: 1, xp: 0, credits: 500, matches: 0, wins: 0, favoriteTank: 'assault',
    }
    this.users.set(profile.id, profile)
    if (this.sql) {
      await this.sql.begin(async (sql) => {
        await sql`insert into users (id, is_guest) values (${profile.id}, true)`
        await sql`insert into profiles (user_id, nickname) values (${profile.id}, ${nickname})`
      })
    }
    return this.publicProfile(profile)
  }

  async findById(id: string): Promise<StoredProfile | null> {
    const local = this.users.get(id)
    if (local) return local
    if (!this.sql) return null
    const rows = await this.sql`
      select u.id, u.email, u.password_hash, u.is_guest, p.nickname, p.level, p.xp, p.credits,
             p.matches, p.wins, p.favorite_tank
      from users u join profiles p on p.user_id = u.id where u.id = ${id} limit 1
    `
    return rows[0] ? this.mapRow(rows[0]) : null
  }

  async findByEmail(email: string): Promise<StoredProfile | null> {
    if (!this.sql) return [...this.users.values()].find((user) => user.email === email) ?? null
    const rows = await this.sql`
      select u.id, u.email, u.password_hash, u.is_guest, p.nickname, p.level, p.xp, p.credits,
             p.matches, p.wins, p.favorite_tank
      from users u join profiles p on p.user_id = u.id where lower(u.email) = ${email.toLowerCase()} limit 1
    `
    return rows[0] ? this.mapRow(rows[0]) : null
  }

  async register(userId: string | null, email: string, passwordHash: string, nickname: string) {
    const existing = userId ? await this.findById(userId) : null
    const profile: StoredProfile = existing
      ? { ...existing, email, passwordHash, nickname, isGuest: false }
      : {
          id: randomUUID(), email, passwordHash, nickname, isGuest: false,
          level: 1, xp: 0, credits: 500, matches: 0, wins: 0, favoriteTank: 'assault',
        }
    this.users.set(profile.id, profile)
    if (this.sql) {
      if (existing) {
        await this.sql`update users set email = ${email}, password_hash = ${passwordHash}, is_guest = false where id = ${profile.id}`
        await this.sql`update profiles set nickname = ${nickname} where user_id = ${profile.id}`
      } else {
        await this.sql.begin(async (sql) => {
          await sql`insert into users (id, email, password_hash, is_guest) values (${profile.id}, ${email}, ${passwordHash}, false)`
          await sql`insert into profiles (user_id, nickname) values (${profile.id}, ${nickname})`
        })
      }
    }
    return this.publicProfile(profile)
  }

  async updateProfile(userId: string, patch: { nickname?: string; favoriteTank?: TankId }) {
    const user = await this.findById(userId)
    if (!user) return null
    if (patch.nickname) user.nickname = patch.nickname
    if (patch.favoriteTank) user.favoriteTank = patch.favoriteTank
    this.users.set(user.id, user)
    if (this.sql) {
      await this.sql`
        update profiles set nickname = ${user.nickname}, favorite_tank = ${user.favoriteTank} where user_id = ${user.id}
      `
    }
    return this.publicProfile(user)
  }

  async saveSession(record: SessionRecord) {
    this.sessions.set(record.tokenHash, record)
    if (this.sql) {
      await this.sql`insert into sessions (token_hash, user_id, expires_at) values (${record.tokenHash}, ${record.userId}, ${record.expiresAt})`
    }
  }

  async consumeSession(tokenHash: string) {
    const local = this.sessions.get(tokenHash)
    if (local && local.expiresAt > new Date()) return local.userId
    if (!this.sql) return null
    const rows = await this.sql`select user_id from sessions where token_hash = ${tokenHash} and expires_at > now() limit 1`
    return rows[0]?.user_id as string | undefined ?? null
  }

  async deleteSession(tokenHash: string) {
    this.sessions.delete(tokenHash)
    if (this.sql) await this.sql`delete from sessions where token_hash = ${tokenHash}`
  }

  publicProfile(profile: StoredProfile): PublicProfile {
    const { passwordHash: _passwordHash, ...publicProfile } = profile
    return publicProfile
  }

  private mapRow(row: Record<string, unknown>): StoredProfile {
    return {
      id: String(row.id), email: row.email ? String(row.email) : null,
      passwordHash: row.password_hash ? String(row.password_hash) : null,
      isGuest: Boolean(row.is_guest), nickname: String(row.nickname), level: Number(row.level),
      xp: Number(row.xp), credits: Number(row.credits), matches: Number(row.matches), wins: Number(row.wins),
      favoriteTank: String(row.favorite_tank) as TankId,
    }
  }
}

export const gameStore = new GameStore()
