# Global Meet Adjuster - Project Plan

## Overview
時差のある拠点間での会議日程調整を効率化する汎用Webアプリケーション。
タイムゾーン自動変換と直感的な投票UIで、グローバルチームのスケジュール調整をシンプルに。

## Phase 1 (MVP) - Current Implementation

### Completed Features
| # | Feature | Status |
|---|---------|--------|
| 1 | Google認証（profile/email scope）+ ログアウト | Done |
| 2 | ホストダッシュボード（イベント一覧、ステータス表示） | Done |
| 3 | イベント作成（手動候補日入力、日付ピッカー） | Done |
| 4 | イベント編集（全項目変更可能） | Done |
| 5 | イベント削除（確認ダイアログ付き、確定済みも削除可能） | Done |
| 6 | 共有URL発行 + 共有導線（URLコピー、LINE、メール、QR） | Done |
| 7 | ゲスト投票（◯△×、部分回答OK、投票優先フロー） | Done |
| 8 | タイムゾーン自動変換・併記（date-fns-tz） | Done |
| 9 | 回答一覧表示（PC: テーブル / モバイル: カード） | Done |
| 10 | ゲスト回答編集（editToken、SHA-256ハッシュ化） | Done |
| 11 | イベント確定（確定日時表示、expiresAtリセット） | Done |
| 12 | 確定後画面状態（ゲスト: 閲覧のみ / ホスト: ステータス表示） | Done |
| 13 | 同一メール重複チェック（サーバーサイド） | Done |
| 14 | 過去日時バリデーション | Done |
| 15 | i18n（日英2言語、next-intl） | Done |
| 16 | Server Actions + Admin SDK（書き込みアーキテクチャ） | Done |
| 17 | Firestore Security Rules | Done |
| 18 | データ自動削除（Firestore TTL、90日） | Config needed |
| 19 | レスポンシブ対応（テーブル/カード切り替え） | Done |

### Remaining for MVP Launch
- [ ] Firebaseプロジェクト作成 + 環境変数設定
- [ ] Firestore TTLポリシー設定（gcloud CLI）
- [ ] Vercelデプロイ設定
- [ ] E2Eテスト（主要フローの動作確認）
- [ ] Google OAuth consent screen設定

## Phase 2 - Planned Features
| # | Feature | Priority |
|---|---------|----------|
| 1 | AI候補日入力補助（Gemini API, 構造化出力） | Should |
| 2 | Google Calendar連携 + Meet URL自動発行 | Should |
| 3 | メール通知 - 全員回答完了通知（Cloud Functions） | Could |
| 4 | 編集リンク再発行（メールベース復旧） | Should |
| 5 | TTL孤立サブコレクション連鎖削除（Cloud Function） | Should |
| 6 | 本格的レートリミット（Upstash Redis等） | Could |
| 7 | 確定解除機能 | Could |
| 8 | ダークモード | Could |
| 9 | ゲストメールのprivateサブコレクション分離 | Should |

## Tech Stack
- **Frontend**: Next.js 15 (App Router) + TypeScript + React 19
- **Styling**: Tailwind CSS + shadcn/ui
- **i18n**: next-intl (ja/en)
- **Timezone**: date-fns + date-fns-tz
- **Backend**: Firebase (Authentication, Firestore)
- **Write Architecture**: Server Actions + Firebase Admin SDK
- **Read Architecture**: Client SDK (onSnapshot) for real-time + Admin SDK for SSR
- **Deployment**: Vercel

## Architecture Decisions

### Security
- editToken: SHA-256ハッシュ化してFirestoreに保存。平文はクライアントのlocalStorageのみ
- 全書き込み: Server Actions + Admin SDK経由（クライアント直接書き込み禁止）
- Firestoreルール: クライアント書き込み全面禁止、listはホスト自身のイベントのみ

### Data Flow
```
Browser → Server Actions (Admin SDK) → Firestore (Write)
Browser → Client SDK (onSnapshot) → Firestore (Read, real-time)
Browser → Server Components (Admin SDK) → Firestore (Read, SSR)
```

### Authentication
```
signInWithPopup → ID Token → Server Action → Session Cookie (httpOnly, 5 days)
```

## Timeline
- Phase 0 (仕様レビュー): Complete
- Phase 1 (MVP実装): Complete (コード)
- Phase 1 (デプロイ・テスト): Next
- Phase 2: TBD
