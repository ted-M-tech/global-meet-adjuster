# Project Specification: Global Meet Adjuster (v3 - Final)

## 1. Project Overview

「Global Meet Adjuster」は、時差のある拠点間での会議日程調整を効率化する汎用Webアプリケーション。
「調整さん」のようなリスト形式の日程調整機能をベースに、タイムゾーン自動変換と直感的な投票UIを提供する。

### 前提条件
- **ターゲット**: 汎用（特定拠点に限定しない）
- **想定参加者数**: 最大20人程度（ソフトリミット。UIで警告表示するが制限はしない）
- **言語**: 日本語・英語の2言語対応（i18n）
- **ランタイム**: Node.js 20以上

### Phase概要
- **Phase 1 (MVP)**: 手動候補日入力、ゲスト投票、タイムゾーン変換、イベント確定
- **Phase 2**: AI候補日入力補助（Gemini API）、Google Calendar連携 + Meet URL自動発行、メール通知

---

## 2. Tech Stack

### Phase 1 (MVP)
- **Frontend**: Next.js 15 (App Router), TypeScript, React 19
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Lucide React icons)
- **i18n**: next-intl
- **Timezone**: date-fns + date-fns-tz
- **Backend**: Firebase (Authentication, Firestore)
  - 読み取り: クライアントSDK（onSnapshot によるリアルタイム購読）
  - 書き込み: Next.js Server Actions + Firebase Admin SDK
- **Auth**: Firebase Authentication (Google OAuth, profile/email scope のみ)
- **Deployment**: Vercel (Frontend + Server Actions)

### Phase 2 (追加)
- **AI**: Google Gemini API (`gemini-2.5-flash`, 構造化出力/JSON mode)
- **Calendar**: Google Calendar API + Meet URL発行（OAuth `calendar.events` scope）
- **Notification**: Cloud Functions (Firestore trigger) + メール送信サービス

---

## 3. Core Features & User Flow

### A. Host - Authentication & Dashboard

1. **Authentication**: Googleアカウントでログイン。
   - MVP Scope: `profile`, `email` のみ（Calendar scope は Phase 2）。
   - Firebase Authentication の Google Provider を使用。
2. **Dashboard**: ホストが作成したイベント一覧を表示。
   - 各イベントのステータス（調整中 `planning` / 確定済み `fixed`）をバッジで表示。
   - 確定済みイベント: 確定日時を表示。
   - イベントの作成日時順（降順）でソート。
3. **Logout**: ヘッダーにログアウトボタンを配置。

### B. Host - Event Creation

1. **Create Event** (`/events/new`):
   - イベントタイトル（必須）、メモ（任意）を入力。
   - **Duration**: 会議の長さを選択（30分 / 1時間 / 1.5時間 / 2時間）。
   - **候補日入力**: 日付ピッカー + 時間セレクタから候補日を手動で追加。
     - 過去日時はバリデーションで入力不可とする。
     - 候補日は最低1つ必須。
   - 候補日を確認・修正（並べ替え・削除可能）し、イベントを保存。
2. **Share**: 保存後、共有用URLが発行される。
   - 共有導線: URLコピー、LINE共有ボタン、メール共有ボタン、QRコード表示。

### C. Host - Event Edit

1. **Edit Event** (`/events/[id]/edit`): ホストのみアクセス可能。
   - 編集可能項目: タイトル、メモ、Duration、候補日の追加/削除。
   - **候補日削除の制約**: ゲスト回答が存在する候補日を削除する場合、確認ダイアログを表示し、該当候補日への回答も併せて削除される旨を警告する。
   - 新規追加する候補日も過去日時バリデーションを適用。
   - `status: 'fixed'` のイベントは編集不可（確定解除機能は Phase 2 検討）。

### D. Host - Event Delete

1. **Delete Event**: ダッシュボードまたはイベント詳細画面から削除可能。
   - ゲスト回答が存在するイベントも削除可能。
   - 確認ダイアログを表示（「このイベントと全ての回答が削除されます」）。
   - 削除は論理削除ではなく物理削除（Firestore ドキュメント + サブコレクション削除）。

### E. Guest - Voting (No Login Required)

1. **Access**: 共有URLにアクセスする（ログイン不要）。
2. **Event View**:
   - イベントタイトル、メモ、候補日一覧を表示。
   - 既存の参加者の回答状況（◯△×）がテーブル（PC）/ カード（モバイル）で表示。
   - **Timezone**: 候補日時は、**ゲストのブラウザのタイムゾーン**に自動変換されて表示。ホストのタイムゾーンも併記。
3. **Voting Flow** (投票優先フロー):
   - 「新しく回答する」ボタンを押す。
   - **Step 1 - Voting**: 各候補日に対して ◯（OK）・△（Maybe）・×（NG）を選択。全候補日への回答は必須ではない（部分回答OK）。未回答の候補日は「未回答」として表示。
   - **Step 2 - Profile (保存時)**: 名前（必須）、メールアドレス（任意）を入力するダイアログを表示。
   - 保存時にUUIDトークン（editToken）を生成し、localStorageに保存。editToken の SHA-256 ハッシュ値を Firestore に保存。
4. **Edit**: 自分の回答行をクリックすることで編集モードに入る（localStorage の editToken で本人確認）。
5. **Token Loss**: localStorage 消去等で editToken を喪失した場合、新規回答として再登録が必要。メールベースの編集リンク再発行は Phase 2 で実装。
6. **Duplicate Check**: 同一メールアドレスでの重複登録はサーバーサイド（Server Action）でブロック。保存時にチェックし、エラー時は「このメールアドレスは既に登録されています。回答を編集する場合は既存の回答をクリックしてください」と表示。クライアント側でのリアルタイムチェックは行わない（メール列挙攻撃防止）。

### F. Host - Event Finalization

1. **Review**: ゲスト全員の回答状況を確認。各候補日の◯△×の集計サマリーを表示。
2. **Fix Event**: 最適な候補日を選択し、「確定」ボタンを押す。
   - ゲスト0人でも確定可能（ホストだけの予定確保ユースケース）。
   - 確認ダイアログを表示（「この日程で確定しますか？」）。
   - `status` を `'fixed'` に更新し、`fixedCandidateId` を記録。
   - `expiresAt` を「確定日 + 90日」にリセット（確定直後にTTL期限切れになるのを防止）。

### G. Post-Finalization States

1. **Guest View (確定後)**:
   - 確定した日時をハイライト表示（バナーまたはカード）。
   - 投票結果は閲覧のみ可能。
   - 新規投票フォームは非表示。既存回答の編集も不可。
2. **Host View (確定後)**:
   - ダッシュボード: ステータス「確定済み」バッジ + 確定日時を表示。
   - イベント詳細: 確定日時のハイライト表示。編集ボタンは非表示（確定解除は Phase 2）。
   - **削除は許可**: 確定済みイベントでも削除可能。強い警告付き確認ダイアログを表示（「このイベントは確定済みです。削除すると復元できません。本当に削除しますか？」）。

---

## 4. Data Structure (Firestore)

### Collection: `users`
| Field | Type | Description |
|-------|------|-------------|
| `uid` | string | Firebase Auth User ID (= document ID) |
| `email` | string | Google account email |
| `name` | string | Display name |
| `photoURL` | string | Profile photo URL |
| `createdAt` | Timestamp | Account creation time |

### Collection: `events`
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Auto-generated (= document ID) |
| `hostId` | string | Reference to `users.uid` |
| `title` | string | Event title (required) |
| `description` | string | Event memo/description (optional) |
| `duration` | number | Meeting duration in minutes: `30 \| 60 \| 90 \| 120` |
| `timezone` | string | Host's timezone (e.g., `"America/Vancouver"`) |
| `candidates` | Array\<Map\> | Candidate date/times (see below) |
| `status` | string | `'planning'` \| `'fixed'` |
| `fixedCandidateId` | string? | ID of the confirmed candidate (when `status='fixed'`) |
| `expiresAt` | Timestamp | TTL: Auto-deletion date (default: `createdAt + 90 days`) |
| `createdAt` | Timestamp | Creation time |
| `updatedAt` | Timestamp | Last update time |

#### `candidates[]` Map:
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUID |
| `start` | Timestamp | Start time in UTC |
| `end` | Timestamp | End time in UTC (`start + duration`) |

### Subcollection: `events/{eventId}/guests`
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Auto-generated (= document ID) |
| `name` | string | Guest name (required) |
| `editTokenHash` | string | SHA-256 hash of the editToken UUID |
| `answers` | Array\<Map\> | Voting answers (see below) |
| `registeredAt` | Timestamp | Registration time |
| `updatedAt` | Timestamp | Last update time |

### Subcollection: `events/{eventId}/guests/{guestId}/private/contact`
| Field | Type | Description |
|-------|------|-------------|
| `email` | string? | Guest email (optional). Admin SDK 経由でのみ読み取り可能。投票テーブルのリアルタイム表示（onSnapshot）には含まれない。 |

#### `answers[]` Map:
| Field | Type | Description |
|-------|------|-------------|
| `candidateId` | string | Reference to `candidates[].id` |
| `status` | string | `'ok'` \| `'maybe'` \| `'ng'` |

**Note**: 全候補日への回答は必須ではない。`answers` 配列に含まれない候補日は「未回答」として扱う。

### Phase 2 追加フィールド (events)
| Field | Type | Description |
|-------|------|-------------|
| `googleEventLink` | string? | Google Calendar event URL |
| `googleMeetLink` | string? | Google Meet URL |
| `allRespondedNotifiedAt` | Timestamp? | 全員回答完了通知送信済みフラグ（冪等性担保） |

---

## 5. Security

### Firestore Security Rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users: 本人のみ読み書き可能
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Events: 認証済みユーザーはドキュメントIDを知っていれば読み取り可能
    // list (コレクション一覧取得) は禁止
    // 書き込みは Admin SDK 経由のみ（クライアント書き込み禁止）
    match /events/{eventId} {
      allow get: if true;  // URLを知っていれば誰でも閲覧可能
      allow list: if request.auth != null && resource.data.hostId == request.auth.uid;
      allow create, update, delete: if false;  // Admin SDK only

      // Guests: 読み取りは誰でも可能、書き込みは Admin SDK 経由のみ
      match /guests/{guestId} {
        allow read: if true;
        allow create, update, delete: if false;  // Admin SDK only

        // Private: メールアドレス等の個人情報。クライアントからの読み取り禁止
        match /private/{docId} {
          allow read, write: if false;  // Admin SDK only
        }
      }
    }
  }
}
```

### Authentication & Token Security
- **editToken**: ゲスト回答保存時に UUIDv4 を生成。クライアントの localStorage に平文で保存。Firestore には **SHA-256 ハッシュ値のみ** を保存（`editTokenHash`）。
- **editToken 検証**: 編集リクエスト時、クライアントから送信された editToken を Server Action 側で SHA-256 ハッシュ化し、Firestore の `editTokenHash` と比較。
- **OAuth Token**: MVP では profile/email scope のみ。クライアント側で保持し、サーバーに永続化しない。
- **Event ID**: Firestore の auto-generated ID を使用（推測困難な文字列）。

### Server Action Authentication Flow
ホスト操作を伴う Server Action では以下の手順で Firebase Auth を検証する:
1. クライアント側で `firebase.auth().currentUser.getIdToken()` により Firebase ID Token を取得。
2. Server Action の引数として ID Token を送信。
3. サーバー側で `admin.auth().verifyIdToken(idToken)` を実行し、トークンの有効性を検証。
4. 検証成功時、デコード結果から `uid` を取得し、Firestore のリソース所有者（`hostId`）と照合。
5. 検証失敗時は認証エラーを返却（401相当）。

### Write Architecture
- **全ての書き込み操作は Server Actions + Firebase Admin SDK 経由**で実行。
  - イベント CRUD
  - ゲスト登録・回答保存・回答編集
  - editToken 検証
- **クライアント SDK はリアルタイム読み取り（onSnapshot）のみ**に限定。
- Server Actions 内で以下を検証:
  - 認証状態（ホスト操作の場合）
  - editToken の一致（ゲスト編集の場合）
  - イベントステータス（`fixed` イベントへの書き込み拒否）
  - 入力バリデーション（過去日時チェック、重複メールチェック等）

---

## 6. UI/UX Guidelines

### Design Principles
- **Library**: `shadcn/ui` を全面的に使用。
- **Theme**: シンプルで清潔感のあるデザイン。ライトモードのみ（MVP）。
- **Responsive**: PC、タブレット、スマホ（縦・横）で全機能が動作。
  - 投票テーブル: PC では横長テーブル、モバイルではカード形式に切り替え。

### Components
- `Card`, `Button`, `Input`, `Table`, `Dialog`, `Select`, `Textarea`, `Calendar`, `Popover`, `Badge`, `Toast`, `AlertDialog`（確認ダイアログ用）

### Timezone Display
- ゲスト画面: ローカル時間（プライマリ）+ ホスト時間（セカンダリ、小さめ表示）を併記。
- ホスト画面: ホストのローカル時間で表示。

### i18n
- `next-intl` を使用。日本語・英語の2言語対応。
- デフォルト言語はブラウザの `Accept-Language` ヘッダーから自動判定。
- ヘッダーに言語切り替えボタンを配置。
- URL パス構造: `/{locale}/dashboard`, `/{locale}/events/[id]` 等。

### Voting UX
- 投票ボタンは ◯・△・× のトグル形式。タップ/クリックで切り替え。
- 未回答状態はグレーアウトで「−」表示。
- 投票サマリー: 各候補日の ◯/△/× の合計数を表示。最も◯が多い候補日をハイライト。

### Share UX
- 共有URL発行後に共有方法選択パネルを表示:
  - URLコピー（クリップボード）
  - LINE共有（LINE URL scheme）
  - メール共有（mailto: リンク）
  - QRコード表示（画面上にQRコードを生成）

---

## 7. Page Structure

| Path | Description | Access |
|------|-------------|--------|
| `/{locale}` | ランディングページ（Googleログインボタン、サービス説明） | Public |
| `/{locale}/dashboard` | ホストのイベント一覧 | Auth required |
| `/{locale}/events/new` | イベント作成 | Auth required |
| `/{locale}/events/[id]` | イベント詳細・投票画面 | Public (URL知っている人) |
| `/{locale}/events/[id]/edit` | イベント編集 | Auth required (Host only) |

---

## 8. Server Actions

全ての書き込みは Next.js Server Actions で実行。Firebase Admin SDK を使用。

| Action | Description | Auth |
|--------|-------------|------|
| `createEvent` | イベント新規作成 | Host (Firebase Auth) |
| `updateEvent` | イベント編集（タイトル、メモ、Duration、候補日） | Host (Firebase Auth) |
| `deleteEvent` | イベント削除（サブコレクション含む） | Host (Firebase Auth) |
| `fixEvent` | イベント確定（status → fixed） | Host (Firebase Auth) |
| `registerGuest` | ゲスト登録 + 回答保存（重複メールチェック含む） | Public (editToken 発行) |
| `updateGuestAnswer` | ゲスト回答編集 | editToken 検証 |

---

## 9. Edge Cases & Validation

### Input Validation
- **過去日時**: 候補日の `start` が現在時刻より過去の場合、作成・追加を拒否。
- **メールアドレス形式**: 入力された場合のみ形式チェック（RFC 5322 簡易バリデーション）。
- **重複メール**: 同一イベント内で同じメールアドレスのゲスト登録をサーバーサイド（`registerGuest` Server Action）でブロック。クライアント側でのリアルタイムチェックは行わない（メール列挙攻撃防止）。エラー時は既存回答の編集を促すメッセージを表示。
- **空タイトル**: イベントタイトルは必須。空文字・空白のみは拒否。
- **候補日最低数**: 候補日は最低1つ必須。

### State Constraints
- **確定済みイベント**: `status='fixed'` のイベントに対して:
  - 新規ゲスト登録: 拒否（UIで投票フォーム非表示）
  - 既存回答編集: 拒否
  - イベント編集: 拒否（確定解除は Phase 2 で検討）
  - イベント削除: **許可**（強い警告付き確認ダイアログを表示。誤確定時の救済手段として）
- **候補日削除時の回答整合性**: 既にゲスト回答がある候補日を削除する場合、該当 `candidateId` を持つ `answers` エントリも削除する。

### Concurrency
- **同時回答**: 複数ゲストが同時に回答する場合、各ゲストは独立したドキュメント（`guests/{guestId}`）に書き込むため競合しない。
- **同時編集**: ホストがイベントを編集中にゲストが回答する場合を考慮し、候補日削除時は Firestore トランザクションを使用。

### Token & Recovery
- **localStorage 消去 (Phase 1)**: editToken 喪失時は新規回答として再登録が必要（メール登録有無を問わず）。
- **別端末/ブラウザ (Phase 1)**: 同上。新規回答として再登録。
- **Phase 2**: メールアドレス登録済みの場合、編集リンク再発行（ワンタイムリンク送信）で復旧可能にする。

---

## 10. Non-Functional Requirements

### Performance
- **初期表示**: LCP 2.5秒以内（Vercel Edge + Server Components による SSR）。
- **リアルタイム更新**: Firestore onSnapshot による即時反映（数百ミリ秒以内）。
- **AI応答** (Phase 2): Gemini API レスポンス 5秒以内。

### Data Retention & TTL
- **主要な削除手段**: ホストによる手動削除（`deleteEvent` Server Action）。サブコレクション（guests）も含めて完全削除。
- **TTL自動削除（フォールバック）**: イベントは `expiresAt` フィールドに基づき、Firestore TTL ポリシーで自動削除。コスト最小のクリーンアップ手段として位置づけ。
  - デフォルト: `createdAt + 90日`。
  - イベント確定時: `expiresAt` を `確定日 + 90日` にリセット。
  - **注意**: Firestore TTL はドキュメント単位で動作し、**サブコレクション（guests）は自動削除されない**。孤立したサブコレクションは Phase 2 で Cloud Function による連鎖削除を実装してクリーンアップする。

### Browser Support
- **対象**: モダンブラウザの最新2バージョン（Chrome, Firefox, Safari, Edge）。
- **モバイル**: iOS Safari, Android Chrome。

### Accessibility
- **基本対応**: セマンティックHTML、キーボードナビゲーション、適切な `aria-label`。
- **shadcn/ui**: 内蔵のアクセシビリティ機能を活用（Radix UI ベース）。

### Rate Limiting
- **MVP (Phase 1)**: Server Action 内での簡易チェック（同一イベントへの連続登録間隔制限。Firestore の `registeredAt` / `updatedAt` を参照し、直近N秒以内の重複リクエストを拒否）。
- **Phase 2**: 本格的なレートリミット（Redis等の外部ストアによるIPベース制限）を検討。Vercel サーバーレス環境ではインメモリカウンタは機能しないため。

### Error Handling
- 全ての Server Action でエラーハンドリングを実装。
- ユーザー向けエラーメッセージを Toast で表示（技術的詳細は非表示）。
- ネットワークエラー時のリトライ UI は提供しない（ユーザーに再操作を促す）。

---

## 11. Environment Variables

```env
# Firebase (Client)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase (Admin SDK - Server Only)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Phase 2
# GEMINI_API_KEY=
# GOOGLE_CALENDAR_CLIENT_ID=
# GOOGLE_CALENDAR_CLIENT_SECRET=
```

---

## 12. Phase Roadmap

### Phase 1 - MVP
| # | Feature | Priority |
|---|---------|----------|
| 1 | Google認証（profile/email scope）+ ログアウト | Must |
| 2 | ホストダッシュボード（イベント一覧、ステータス表示） | Must |
| 3 | イベント作成（手動候補日入力、日付ピッカー） | Must |
| 4 | イベント編集（全項目変更可能） | Must |
| 5 | イベント削除（確認ダイアログ付き） | Must |
| 6 | 共有URL発行 + 共有導線（URLコピー、LINE、メール、QR） | Must |
| 7 | ゲスト投票（◯△×、部分回答OK、投票優先フロー） | Must |
| 8 | タイムゾーン自動変換・併記（date-fns-tz） | Must |
| 9 | 回答一覧表示（PC: テーブル / モバイル: カード） | Must |
| 10 | ゲスト回答編集（editToken、SHA-256ハッシュ化） | Must |
| 11 | イベント確定（確定日時表示） | Must |
| 12 | 確定後画面状態（ゲスト: 閲覧のみ / ホスト: ステータス表示） | Must |
| 13 | 同一メール重複チェック | Must |
| 14 | 過去日時バリデーション | Must |
| 15 | i18n（日英2言語、next-intl） | Must |
| 16 | Server Actions + Admin SDK（書き込みアーキテクチャ） | Must |
| 17 | Firestore Security Rules | Must |
| 18 | データ自動削除（Firestore TTL、90日。サブコレクション孤立は許容） | Should |
| 19 | レスポンシブ対応（テーブル/カード切り替え） | Must |

### Phase 2
| # | Feature | Priority |
|---|---------|----------|
| 1 | AI候補日入力補助（Gemini API, 構造化出力） | Should |
| 2 | Google Calendar連携 + Meet URL自動発行 | Should |
| 3 | メール通知 - 全員回答完了通知（Cloud Functions） | Could |
| 4 | 編集リンク再発行（メールベース editToken 復旧） | Should |
| 5 | TTL孤立サブコレクション連鎖削除（Cloud Function） | Should |
| 6 | 本格的レートリミット（Redis等外部ストア） | Could |
| 7 | 確定解除機能 | Could |
| 8 | ダークモード | Could |
