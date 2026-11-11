# 🧠 Project Memory & Context

## 1. 🏗️ Tech Stack & Architettura
- **Frontend / App Framework:** React Native (`v0.88.0`), Expo (`v58.0.16`), React (`v19.3.0`), TypeScript (`~6.0.3`).
- **Navigation:** `@react-navigation/native` (`v7`) with `@react-navigation/native-stack` (`v7`).
- **Backend & Database:** Supabase (`@supabase/supabase-js`), Supabase Edge Functions (Deno runtime integrating Gemini AI API).
- **3D & Graphics / UI Rendering:** `react-native-webview` embedding Three.js (`v0.128.0` via CDN) for holographic 3D avatars/minigames, `expo-blur`, `expo-linear-gradient`, `@expo/vector-icons`.
- **Security & Encryption:** `crypto-js` for AES End-to-End Encryption (E2EE) of chat messages.
- **Realtime Collaboration:** Supabase Realtime Postgres Changes and Realtime Broadcast channels for live sync, multiplayer rooms, and typing indicators.

---

## 2. 📂 Struttura del Progetto
- `App.tsx` & `index.ts`: Application entry points.
- `src/navigation/AppNavigator.tsx`: Root stack navigator, authentication session orchestration, and Expo push notifications setup.
- `src/screens/`: All views and game screens including `ProfileScreen`, `ChatHubScreen`, `PrivateChatScreen`, `GroupChatScreen`, `HolonetFeedScreen`, `ArcadeScreen`, `WarRoomGamesScreen`, `RoomHubScreen`, `RoomDetailScreen`, `TurbineScreen`, and 10+ 3D/Web Arcade Mini-games (`StroopTestScreen`, `ChuteTapScreen`, `Dominio15Screen`, `GravityRunnerScreen`, `PongScreen`, `ShapeSmistScreen`, `SimonDigitalScreen`, `StopTheClockScreen`, `TowerStackScreen`, `VisualCounterScreen`, `WallBounceScreen`).
- `src/components/`: Reusable interface components (`MessageBubble`, `GifPickerModal`, `GameOverModal`).
- `src/lib/`: Core utilities (`supabase.ts`, `e2eEncryption.ts`, `cryptoUtils.ts`, `gameUtils.ts`).
- `supabase/functions/`: Serverless backend functions (`generate-daily-story`).

---

## 3. 🗄️ Database & Backend (Supabase)
- **Primary Tables:**
  - `profiles`: User account data (`id`, `username`, `avatar_url`, `push_token`, `current_game_multiplier`, `last_turbine_spin`).
  - `game_rooms`: Multiplayer/social game rooms (`id`, `name`, `host_id`, `invite_code`, `current_game`, `status`, `created_at`).
  - `game_room_members`: Participants mapping in game rooms (`id`, `room_id`, `user_id`, `joined_at`).
  - `game_room_scores`: Daily room score records enforcing room limits, practice attempts, and 5-attempt thresholds (`id`, `room_id`, `user_id`, `game_id`, `play_date`, `highest_score`, `practice_used`, `attempts_used`).
  - `daily_prompts`: Active and historical narrative prompts (`id`, `season_id`, `day_number`, `prompt_text`, `winning_response`, `winning_username`, `published_date`).
  - `social_posts`: User submissions and moves answering daily prompts (`id`, `user_id`, `prompt_id`, `content`, `is_daily_story`, `upvotes`).
  - `arcade_scores`: Mini-game leaderboard records (`id`, `user_id`, `score`, `game_id`, `play_date`, `created_at`).
  - `user_trophies` & `trophies`: Achievement definitions and unlocked user badges.
  - `narrative_leaderboard`: Karma and engagement points (`user_id`, `total_karma`).
  - `narrative_hall_of_fame`: Historical season archive.
  - `group_rooms` & `group_members`: Group chat rooms and participant mappings.
  - `group_messages`: Group chat messages supporting E2EE content, GIFs, and view-once photos (`id`, `room_id`, `sender_id`, `content`, `media_type`, `media_url`, `is_read`, `is_view_once`, `has_been_viewed`, `created_at`).
  - `private_rooms`: 1-on-1 private chat channels (`id`, `user1_id`, `user2_id`).
  - `private_messages`: Private encrypted messages (`id`, `room_id`, `sender_id`, `content`, `media_type`, `media_url`, `is_read`, `is_view_once`, `has_been_viewed`, `created_at`).
  - `post_likes`: Upvotes and reaction tracking for social feed posts.
- **Edge Functions:**
  - `generate-daily-story`: Automated background/cron routine invoking Google Gemini (`gemini-3.5-flash-lite`) to generate 14-day cumulative narrative arcs and process winning player moves from the previous day.
- **Row Level Security (RLS):** Enabled across tables to restrict chat message visibility, profile updates, and social submissions to authenticated participants.

---

## 4. ⚙️ Core Features & Meccaniche
- **Sistema di Stanze di Gioco (Game Rooms):**
  - Managed via `RoomHubScreen` and `RoomDetailScreen`.
  - Daily Game of the Day rotation with 8-hour shift (`08:00 AM Shift`).
  - Room Mode scoring (`handleGameScoreSubmission` in `gameUtils.ts`):
    - First attempt is Free Practice (`practice_used = true`, `attempts_used = 0`).
    - Subsequent 5 attempts (`attempts_used < 5`) require scoring above 50% of the user's current highest score (`computedFinalScore > currentHighest * 0.5`).
    - Integrates daily turbine wheel multipliers (`current_game_multiplier`).
- **Sistema Narrativo & Cumulative Prompts (Holonet & Daily Prompts):**
  - Structured in 14-day cumulative narrative seasons (Day 15 epilogue).
  - Users submit moves as `social_posts`. The top-voted move influences the next day's AI-generated cumulative prompt.
  - Handled in `ProfileScreen` and `HolonetFeedScreen`. Uses `.maybeSingle()` for robust response checking.
- **Interfaccia Olografica & 3D WebViews:**
  - Embedded via `react-native-webview` running Three.js (`v0.128.0`) via CDN.
  - Renders 3D holograms, arcade simulation worlds, and interactive avatars with raycasting (`raycaster.intersectObject`).
  - Binary/Base64 media upload flow optimized without relying on legacy `FormData` issues.
- **Sistema di Comunicazione & Chat (E2EE & Typing Broadcast):**
  - End-to-End Encryption via `crypto-js` AES (`encryptMessage` / `decryptMessage`) before insertion into `group_messages` and `private_messages`.
  - Cyberpunk visual palette strictly adhered to: Black (`#050B14`), Dark Gray (`#121624`), Light Gray (`#8892B0`), White (`#FFFFFF`), and Teal accents (`#00E5FF`).
  - Realtime typing indicator implemented via Supabase Realtime Broadcast (`typing` event) with a 2-second send throttle and 3-second inactivity timeout.

---

## 5. 📌 Stato Attuale & Modifiche Recenti
- **Integrazione Game Rooms & Room Mode:** Implementazione completa di `game_rooms`, `game_room_members`, `game_room_scores` e `handleGameScoreSubmission` con logica del 50% e 5 tentativi su tutti i minigiochi arcade.
- **Rimozione Lottie Stickers:** Rimozione completa di `lottie-react-native`, relativi sticker JSON, modali e pulsanti in favore di chat pulite, GIF animate e messaggi E2EE.
- **Ottimizzazione Raycasting 3D:** Risolto il problema di precisione dei tocchi WebView su dispositivi mobili passando da un raycast mirato a un raycast ricorsivo sull'intero gruppo `avatarGroup`.
- **Risoluzione Errori Supabase:** Sostituito `.single()` con `.maybeSingle()` nel controllo dei post sociali giornalieri per prevenire eccezioni (`PGRST116`) quando l'utente non ha ancora risposto.
- **Standardizzazione Palette:** Unificazione dei colori in tutta la suite di chat secondo lo standard Nero/Grigio/Verde Acqua.

---

## 6. 🚀 To-Do & Ottimizzazioni Future
- Espansione delle modalità multiplayer e sincronizzazione match in tempo reale.
- Ottimizzazione delle performance della WebView 3D su dispositivi Android di fascia bassa.
- Copertura di test automatizzati estesa per i flussi di autenticazione e sincronizzazione Supabase.
