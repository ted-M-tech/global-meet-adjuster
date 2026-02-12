# Global Meet Adjuster - テスト戦略書

## 1. テストフレームワーク・ツールの推奨

| レイヤー | ツール | 理由 |
|---------|--------|------|
| ユニットテスト | **Vitest** | Next.js 15との相性が良い。Jest互換APIで学習コスト低。ESM対応。高速。 |
| コンポーネントテスト | **Vitest + React Testing Library** | ユーザー操作ベースのテストが書ける。shadcn/uiコンポーネントとの相性が良い。 |
| E2Eテスト | **Playwright** | クロスブラウザ対応。タイムゾーン設定変更が容易（`context.setTimezone()`）。Next.js公式推奨。 |
| APIテスト | **Vitest** | Server Actions / API Routesのテストに利用。 |
| Firebase関連 | **Firebase Emulator Suite** | Firestore, Auth, Cloud Functionsをローカルでエミュレート。本番に影響なし。 |
| カバレッジ | **v8 (Vitest内蔵)** | ビルトインで設定不要。 |

### 推奨パッケージ一覧
```json
{
  "devDependencies": {
    "vitest": "^3.x",
    "@testing-library/react": "^16.x",
    "@testing-library/user-event": "^14.x",
    "@testing-library/jest-dom": "^6.x",
    "playwright": "^1.x",
    "@playwright/test": "^1.x",
    "msw": "^2.x",
    "firebase-tools": "^13.x"
  }
}
```

---

## 2. テスト対象の洗い出し

### 2.1 ユニットテスト

#### タイムゾーン変換ロジック
| ID | テストケース | 入力 | 期待値 |
|----|-------------|------|--------|
| U-TZ-01 | UTC→ゲストTZへの変換 | UTC 2025-01-15 10:00, TZ=Asia/Tokyo | 2025-01-15 19:00 JST |
| U-TZ-02 | UTC→ゲストTZ（負のオフセット） | UTC 2025-01-15 10:00, TZ=America/Vancouver | 2025-01-15 02:00 PST |
| U-TZ-03 | 日付をまたぐ変換 | UTC 2025-01-15 23:00, TZ=Asia/Tokyo | 2025-01-16 08:00 JST |
| U-TZ-04 | 夏時間切替日の変換（米国） | UTC 2025-03-09 10:00, TZ=America/New_York | 2025-03-09 06:00 EDT |
| U-TZ-05 | 夏時間切替日の変換（欧州） | UTC 2025-03-30 01:00, TZ=Europe/London | 2025-03-30 02:00 BST |
| U-TZ-06 | TZ=UTC+13:45（チャタム諸島等）での変換 | UTC 2025-01-15 10:00, TZ=Pacific/Chatham | 2025-01-16 00:45 |
| U-TZ-07 | ホストTZ併記テキスト生成 | start=UTC, hostTZ=America/Vancouver, guestTZ=Asia/Tokyo | "19:00 JST (02:00 PST)" 形式 |

#### 候補日生成・バリデーション
| ID | テストケース | 入力 | 期待値 |
|----|-------------|------|--------|
| U-CD-01 | start + duration からend算出 | start=10:00, duration=60 | end=11:00 |
| U-CD-02 | duration=30分のend算出 | start=10:00, duration=30 | end=10:30 |
| U-CD-03 | duration=90分のend算出 | start=10:00, duration=90 | end=11:30 |
| U-CD-04 | duration=120分のend算出 | start=10:00, duration=120 | end=12:00 |
| U-CD-05 | 過去の日時を候補日に指定 | 2020-01-01 10:00 | バリデーションエラー（※仕様未記載、要確認） |
| U-CD-06 | 候補日の重複検出 | 同一start/endを2件追加 | 重複警告 or 排除（※仕様未記載、要確認） |

#### 回答集計ロジック
| ID | テストケース | 入力 | 期待値 |
|----|-------------|------|--------|
| U-AG-01 | 全員◯の候補日が最適 | 3人全員ok | 最適候補として表示 |
| U-AG-02 | ◯△混在の優先度 | 2人ok, 1人maybe | okのみ全員より優先度低 |
| U-AG-03 | ×がある候補日 | 2人ok, 1人ng | ngありとして表示 |
| U-AG-04 | 全員未回答の候補日 | answers=[] | 回答なし表示 |
| U-AG-05 | 全員回答完了判定 | ゲスト3人、全候補日に全員回答済 | true |
| U-AG-06 | 一部未回答の完了判定 | ゲスト3人、1人が1候補未回答 | false |

#### UUIDトークン管理
| ID | テストケース | 期待値 |
|----|-------------|--------|
| U-TK-01 | トークン生成 | UUID v4形式の文字列 |
| U-TK-02 | localStorage保存 | key: イベントID関連、value: editToken |
| U-TK-03 | トークン照合（一致） | 編集可能 |
| U-TK-04 | トークン照合（不一致） | 編集不可 |
| U-TK-05 | localStorage無効環境 | エラーハンドリング（※後述エッジケース参照） |

#### フォームバリデーション
| ID | テストケース | 期待値 |
|----|-------------|--------|
| U-FV-01 | イベントタイトル空 | エラー表示 |
| U-FV-02 | ゲスト名空 | エラー表示 |
| U-FV-03 | ゲストメール空 | エラー表示 |
| U-FV-04 | ゲストメール不正形式 | エラー表示 |
| U-FV-05 | 候補日が0件でイベント保存 | エラー表示（※仕様未記載、要確認） |
| U-FV-06 | duration未選択 | エラー表示 |

### 2.2 コンポーネントテスト（React Testing Library）

#### ランディングページ (`/`)
| ID | テストケース | 期待値 |
|----|-------------|--------|
| C-LP-01 | Googleログインボタン表示 | ボタンが表示される |
| C-LP-02 | ログイン済みユーザーの場合 | ダッシュボードへリダイレクト（※仕様未記載、要確認） |

#### ダッシュボード (`/dashboard`)
| ID | テストケース | 期待値 |
|----|-------------|--------|
| C-DB-01 | イベント一覧表示 | 作成したイベントがリスト表示 |
| C-DB-02 | ステータスバッジ表示 | planning→「調整中」、fixed→「確定済み」 |
| C-DB-03 | イベント0件時の空状態 | 空状態メッセージ表示 |
| C-DB-04 | 未認証アクセス | ログインページへリダイレクト |

#### イベント作成ページ (`/events/new`)
| ID | テストケース | 期待値 |
|----|-------------|--------|
| C-EC-01 | フォーム初期表示 | タイトル、メモ、duration選択、AI入力エリア、手動追加ボタン |
| C-EC-02 | Duration選択（30/60/90/120分） | 選択UIが動作する |
| C-EC-03 | AI日付入力→候補日リスト生成 | テキスト入力後API呼出、候補日一覧表示 |
| C-EC-04 | 手動で候補日追加 | 日付ピッカーから追加可能 |
| C-EC-05 | 候補日の削除 | 候補日リストから個別削除可能 |
| C-EC-06 | 候補日の修正 | 生成された候補日を編集可能 |
| C-EC-07 | イベント保存成功 | 共有URL表示 |
| C-EC-08 | 未認証アクセス | ログインページへリダイレクト |

#### 投票画面 (`/events/[id]`)
| ID | テストケース | 期待値 |
|----|-------------|--------|
| C-VT-01 | 投票テーブル表示（PC） | 横長テーブルで候補日×参加者の行列 |
| C-VT-02 | 投票カード表示（スマホ） | カード形式に切り替わる |
| C-VT-03 | タイムゾーン変換表示 | ゲストのローカルTZ + ホストTZ併記 |
| C-VT-04 | 「新しく回答する」ボタン | ダイアログが開く |
| C-VT-05 | 名前・メール入力ダイアログ | 必須バリデーション動作 |
| C-VT-06 | ◯△×選択UI | 各候補日に対して3択選択可能 |
| C-VT-07 | 回答保存 | Firestoreに保存、テーブル更新 |
| C-VT-08 | 自分の回答編集（トークンあり） | 編集可能 |
| C-VT-09 | 他人の回答編集不可 | 編集UI非表示 |
| C-VT-10 | 確定済みイベント表示 | 確定日の強調、Google Meet/Calendarリンク表示 |

#### イベント確定フロー
| ID | テストケース | 期待値 |
|----|-------------|--------|
| C-FX-01 | 「決定 (Fix)」ボタン表示（ホストのみ） | ゲストには非表示 |
| C-FX-02 | 候補日選択→確定 | 選択UIと確認ダイアログ |
| C-FX-03 | OAuth再認証プロンプト | トークン失効時に再認証UIを表示 |
| C-FX-04 | Calendar作成成功 | 確定状態に遷移、リンク表示 |
| C-FX-05 | Calendar作成失敗 | エラーメッセージ表示 |

### 2.3 結合テスト

| ID | テストケース | 範囲 |
|----|-------------|------|
| I-01 | AI日付パース→候補日生成フロー | フロントエンド → `/api/ai/parse-dates` → Gemini API（モック）→ 候補日リスト |
| I-02 | ゲスト登録→回答→保存フロー | フォーム → Firestore（エミュレータ）→ 読み取り確認 |
| I-03 | イベント確定→Calendar作成フロー | 確定ボタン → `/api/calendar/create-event` → Google Calendar API（モック）→ 状態更新 |
| I-04 | 全員回答完了→通知フロー | Firestore書き込み → Cloud Functions（エミュレータ）→ メール送信（モック） |
| I-05 | Firestoreセキュリティルール検証 | ルール単体テスト（`@firebase/rules-unit-testing`）|
| I-06 | OAuthトークン再取得→Calendar作成 | 失効トークン検出 → 再認証 → 再送信 → 成功 |

### 2.4 E2Eテスト (Playwright)

| ID | テストシナリオ | 手順概要 |
|----|---------------|---------|
| E-01 | ホスト：ログイン→イベント作成→共有URL取得 | Google OAuth（モック）→ フォーム入力 → AI候補生成 → 保存 → URL確認 |
| E-02 | ゲスト：共有URLアクセス→回答→保存 | URL開く → TZ確認 → 名前/メール入力 → ◯△×選択 → 保存 |
| E-03 | ゲスト：自分の回答を編集 | 保存済み回答クリック → 変更 → 更新 |
| E-04 | ホスト：全回答確認→イベント確定 | ダッシュボード → イベント詳細 → 候補選択 → 確定 → Calendar/Meet確認 |
| E-05 | 複数ゲストが順番に回答 | ゲストA回答 → ゲストB回答 → テーブルに両方表示 |
| E-06 | レスポンシブ表示確認 | PC/タブレット/スマホビューポートでの表示切替 |
| E-07 | タイムゾーン異なるゲストの表示 | `context.setTimezone('Asia/Tokyo')` → 表示確認 → `context.setTimezone('America/Vancouver')` → 表示確認 |

---

## 3. テストが困難な箇所の特定と対策

### 3.1 Google OAuth認証

**困難な点**: 実際のGoogleログインフローはブラウザリダイレクト・ポップアップを伴い自動テスト困難。

**対策**:
- **ユニット/結合**: Firebase Auth Emulatorを使用。`signInWithCredential`をモックし、テストユーザーを直接作成。
- **E2E**: Firebase Auth Emulatorの`signInWithCustomToken`でテストユーザーログインをバイパス。
- Playwright用のヘルパー関数を用意：
  ```typescript
  async function loginAsTestHost(page: Page) {
    // Firebase Auth Emulatorにテストユーザーを作成し、
    // カスタムトークンでログイン状態をセットアップ
  }
  ```

### 3.2 Google Calendar API

**困難な点**: 本番APIはレート制限・認証が必要。テスト中にカレンダーイベントを作成したくない。

**対策**:
- **ユニット/結合**: MSW (Mock Service Worker) で `/api/calendar/create-event` のレスポンスをモック。
- **結合テスト**: Calendar API呼び出し部分をDI可能に設計し、テスト時はモック実装を注入。
- **E2Eテスト**: MSWをブラウザ側でもセットアップし、Calendar API呼び出しをインターセプト。
- モックレスポンス例:
  ```json
  {
    "htmlLink": "https://calendar.google.com/calendar/event?eid=xxx",
    "hangoutLink": "https://meet.google.com/xxx-xxx-xxx"
  }
  ```

### 3.3 Gemini API (AI日付パース)

**困難な点**: LLMの出力は非決定的。同じ入力でも異なる結果が返る可能性がある。

**対策**:
- **ユニット**: Gemini APIクライアントをモックし、固定のJSON出力を返す。入力→出力のマッピングを複数パターン用意。
- **結合**: MSWで `/api/ai/parse-dates` をインターセプト。
- **専用のパース結果バリデーション関数**: Geminiの出力が期待するスキーマ（`Array<{date: string, time: string}>`）に合致するか検証するバリデータをテスト。
- **プロンプトの回帰テスト**: 代表的な入力パターン（"来週の月水金 19:00"等）に対するGeminiの実レスポンスをスナップショットとして保存し、構造化出力のスキーマが維持されているか定期的に検証（手動 or CI低頻度実行）。

### 3.4 タイムゾーン変換

**困難な点**: テスト実行環境のTZに依存した結果になりがち。夏時間の境界も複雑。

**対策**:
- テスト実行時にTZ環境変数を固定: `TZ=UTC vitest run`
- Playwrightの`browserContext.setTimezone()`で任意のTZを指定。
- 日付ライブラリ（推奨: `date-fns-tz` or `Temporal API`）のラッパー関数を用意し、ピュアな入出力テストが可能な設計にする。

### 3.5 Firebase Cloud Functions

**困難な点**: Firestoreトリガーの実行タイミングが非同期。

**対策**:
- **Firebase Emulator Suite**でローカルテスト。
- `@firebase/rules-unit-testing`でセキュリティルールの単体テスト。
- Cloud Functionsのテスト: Firestoreエミュレータにデータを書き込み→一定時間待機→メール送信モックの呼び出しを検証。
- Firestore triggerのロジック部分を純粋関数として切り出し、ユニットテスト可能にする。

### 3.6 localStorage

**困難な点**: SSR（Next.js）環境ではlocalStorageが未定義。

**対策**:
- localStorage操作を専用ユーティリティに集約し、存在チェックを内包。
- VitestではjsdomのlocalStorage実装が使える。
- Playwrightでは実ブラウザなのでそのまま動作。

---

## 4. 主要テストシナリオ（ハッピーパス + 異常系）

### 4.1 ハッピーパス

| # | シナリオ | 前提条件 | 手順 | 期待結果 |
|---|---------|---------|------|---------|
| HP-01 | ホストがイベントを作成 | ログイン済み | タイトル入力→duration選択→AI入力→候補日確認→保存 | イベント作成、共有URL発行 |
| HP-02 | ゲストが投票 | 共有URLアクセス | 名前/メール入力→各候補日に◯△×→保存 | 投票保存、テーブル更新 |
| HP-03 | ゲストが回答を編集 | 投票済み、同じブラウザ | 自分の回答クリック→変更→保存 | 更新された回答が反映 |
| HP-04 | ホストがイベントを確定 | 全員回答済み | 候補日選択→Fix→Calendar/Meet作成 | ステータス=fixed、Calendar/Meetリンク表示 |
| HP-05 | 全員回答完了通知 | 全ゲスト回答済み | (自動) | ホストにメール通知 |
| HP-06 | 手動で候補日追加 | イベント作成画面 | 日付ピッカーで日時選択→追加 | 候補日リストに追加 |
| HP-07 | 複数TZゲストの投票 | 東京とバンクーバーのゲスト | それぞれの画面で候補日を確認→投票 | 各ゲストのTZで正しく表示 |

### 4.2 異常系

| # | シナリオ | 前提条件 | 手順 | 期待結果 |
|---|---------|---------|------|---------|
| ER-01 | AI日付パース失敗 | Gemini APIエラー | テキスト入力→送信 | エラーメッセージ表示、手動追加への誘導 |
| ER-02 | AI不正な出力 | Geminiがスキーマ外のJSONを返す | テキスト入力→送信 | バリデーションエラー、手動追加への誘導 |
| ER-03 | Calendar作成失敗 | Google API 403/500エラー | Fix実行 | エラーメッセージ表示、リトライ誘導 |
| ER-04 | OAuthトークン失効 | 1時間経過 | Fix実行 | 再認証プロンプト表示 |
| ER-05 | OAuthスコープ不足 | calendar.events未承認 | Fix実行 | 権限エラーメッセージ、再認証誘導 |
| ER-06 | Firestore書き込み失敗 | ネットワークエラー | ゲスト回答保存 | エラーメッセージ表示、データ消失防止 |
| ER-07 | 存在しないイベントURL | 不正なeventId | URLアクセス | 404ページ or エラーメッセージ |
| ER-08 | 不正なeditToken | 改ざんされたトークン | 回答編集試行 | 権限エラー、編集拒否 |
| ER-09 | Firestoreセキュリティルール違反 | 他人のイベントに書き込み | 直接API呼び出し | permission-denied |
| ER-10 | 確定済みイベントへの投票 | status=fixed | 新規回答試行 | 投票不可（※仕様未記載、要確認） |
| ER-11 | メール通知送信失敗 | メールサービスエラー | 全員回答完了 | Functions内でエラーログ、リトライ |

---

## 5. エッジケース

### 5.1 タイムゾーン関連
| ID | ケース | 詳細 |
|----|--------|------|
| EC-TZ-01 | 日付境界をまたぐ変換 | UTC 23:00 → Asia/Tokyo で翌日08:00 |
| EC-TZ-02 | 夏時間(DST)切替の瞬間 | 米国: 3月第2日曜 2:00AM → 3:00AM (1時間消失) |
| EC-TZ-03 | DST終了の瞬間（重複時間） | 11月第1日曜 1:00AM が2回出現 |
| EC-TZ-04 | UTC+13/+14のタイムゾーン | Pacific/Tongaなどの極端なオフセット |
| EC-TZ-05 | 30分/45分オフセットのTZ | Asia/Kolkata (+5:30), Asia/Kathmandu (+5:45) |
| EC-TZ-06 | ホストとゲストの日付が異なる | 東京22:00 = バンクーバー05:00（同日）→ 東京25:00的表示 |
| EC-TZ-07 | AI入力「来週月曜」の解釈 | ホストのTZでの「来週月曜」が正しくUTC変換されるか |
| EC-TZ-08 | DST切替日を含む候補日 | 切替時間帯にまたがる会議枠 |

### 5.2 データ・ストレージ関連
| ID | ケース | 詳細 |
|----|--------|------|
| EC-DS-01 | localStorage無効（プライベートブラウズ） | 一部ブラウザでlocalStorage書き込みが例外をスロー。投票は可能だが再編集不可。UIでの案内が必要。 |
| EC-DS-02 | localStorage容量超過 | 大量のイベントトークンが蓄積された場合 |
| EC-DS-03 | 別ブラウザからの自分の回答編集 | トークン未保持のため新規回答扱いになる（※仕様未記載、要確認） |
| EC-DS-04 | Cookie/ストレージクリア後の再アクセス | 編集権限喪失 |

### 5.3 同時操作
| ID | ケース | 詳細 |
|----|--------|------|
| EC-CC-01 | 複数ゲストが同時に回答保存 | Firestoreの楽観ロックの動作確認 |
| EC-CC-02 | ホスト確定と同時にゲスト回答 | 確定済みなのに回答が保存されるか |
| EC-CC-03 | ホストが同一イベントを複数タブで開く | 状態の不整合 |

### 5.4 ブラウザ互換性
| ID | ケース | 詳細 |
|----|--------|------|
| EC-BR-01 | Chrome最新版 | 主要動作確認 |
| EC-BR-02 | Firefox最新版 | TZ表示、localStorage動作 |
| EC-BR-03 | Safari最新版 | Date/TZ処理の差異（歴史的にバグが多い） |
| EC-BR-04 | モバイルSafari (iOS) | タッチ操作、ダイアログ表示 |
| EC-BR-05 | モバイルChrome (Android) | タッチ操作、レスポンシブ |

### 5.5 入力・境界値
| ID | ケース | 詳細 |
|----|--------|------|
| EC-IV-01 | イベントタイトルに極端な長さ | 1文字 / 1000文字（※最大長の仕様未記載） |
| EC-IV-02 | ゲスト名に特殊文字 | 絵文字、HTML、`<script>` タグ（XSS対策） |
| EC-IV-03 | メールアドレスの国際化 | IDN対応、長いアドレス |
| EC-IV-04 | AI入力に曖昧な表現 | "なるべく早めに"、"適当に" |
| EC-IV-05 | AI入力に英語 | "next Monday at 3pm" |
| EC-IV-06 | 候補日が1件のみ | 最小ケース |
| EC-IV-07 | 候補日が大量（50件以上） | UIの表示・パフォーマンス |
| EC-IV-08 | ゲスト10人全員回答 | 仕様上の最大参加者数での表示 |
| EC-IV-09 | ゲスト0人でFix | ゲスト未登録の状態で確定可能か（※仕様未記載） |
| EC-IV-10 | メモ欄にマークダウン/HTML | 表示の安全性 |

---

## 6. モック戦略

### 6.1 Firebase Authentication

```typescript
// Firebase Auth Emulatorを使用
import { connectAuthEmulator } from 'firebase/auth';
connectAuthEmulator(auth, 'http://127.0.0.1:9099');

// テストユーザー作成
const testUser = {
  uid: 'test-host-001',
  email: 'host@example.com',
  displayName: 'Test Host',
};
```

### 6.2 Firestore

```typescript
// Firestore Emulatorを使用
import { connectFirestoreEmulator } from 'firebase/firestore';
connectFirestoreEmulator(db, '127.0.0.1', 8080);

// テストデータのセットアップ/クリーンアップ
beforeEach(async () => {
  await clearFirestoreData({ projectId: 'test-project' });
  await seedTestEvent(); // テスト用イベントデータを投入
});
```

### 6.3 Gemini API (MSW)

```typescript
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const handlers = [
  http.post('/api/ai/parse-dates', async ({ request }) => {
    const { text, timezone } = await request.json();
    // 固定レスポンスを返す
    return HttpResponse.json({
      candidates: [
        { date: '2025-02-17', time: '19:00' },
        { date: '2025-02-19', time: '19:00' },
        { date: '2025-02-21', time: '19:00' },
      ],
    });
  }),
];

const server = setupServer(...handlers);
```

### 6.4 Google Calendar API (MSW)

```typescript
const calendarHandlers = [
  http.post('/api/calendar/create-event', async () => {
    return HttpResponse.json({
      htmlLink: 'https://calendar.google.com/calendar/event?eid=mock123',
      hangoutLink: 'https://meet.google.com/mock-meet-url',
      status: 'confirmed',
    });
  }),
];
```

### 6.5 メール送信

```typescript
// Cloud Functions内のメール送信をモック
// Firebase Emulator + Cloud Functions内でメール送信サービスをDIで差し替え
const mockMailer = {
  send: vi.fn().mockResolvedValue({ messageId: 'mock-message-id' }),
};
```

### 6.6 モック使い分け方針

| テストレイヤー | Firebase Auth | Firestore | Gemini API | Calendar API | メール |
|--------------|--------------|-----------|------------|-------------|-------|
| ユニット | モック | モック | モック | モック | モック |
| コンポーネント | Emulator | Emulator or モック | MSW | MSW | N/A |
| 結合 | Emulator | Emulator | MSW | MSW | モック |
| E2E | Emulator | Emulator | MSW (ブラウザ) | MSW (ブラウザ) | モック |

---

## 7. CI/CDでのテスト自動化方針

### 7.1 パイプライン構成（GitHub Actions推奨）

```yaml
name: CI
on: [push, pull_request]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  unit-and-component-tests:
    runs-on: ubuntu-latest
    env:
      TZ: UTC
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx vitest run --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

  integration-tests:
    runs-on: ubuntu-latest
    env:
      TZ: UTC
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - name: Start Firebase Emulators
        run: npx firebase emulators:start --only auth,firestore,functions &
      - run: npx wait-on http://127.0.0.1:8080
      - run: npx vitest run --config vitest.integration.config.ts

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - name: Start Firebase Emulators
        run: npx firebase emulators:start --only auth,firestore,functions &
      - name: Start Next.js dev server
        run: npm run build && npm start &
      - run: npx wait-on http://localhost:3000
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  firestore-rules-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - name: Start Firestore Emulator
        run: npx firebase emulators:start --only firestore &
      - run: npx wait-on http://127.0.0.1:8080
      - run: npx vitest run --config vitest.rules.config.ts
```

### 7.2 テスト実行ポリシー

| トリガー | 実行対象 | 目的 |
|---------|---------|------|
| Push to feature branch | lint + typecheck + ユニット + コンポーネント | 高速フィードバック（~2-3分） |
| Pull Request | 全テスト（上記 + 結合 + E2E + Firestoreルール） | マージ前の品質ゲート（~8-10分） |
| Merge to main | 全テスト + デプロイ | 本番デプロイ前の最終チェック |
| 週次（Cron） | Gemini APIプロンプト回帰テスト（実API使用） | プロンプトの品質監視 |

### 7.3 カバレッジ目標

| 対象 | 目標 |
|------|------|
| ユーティリティ関数（TZ変換等） | 90%以上 |
| Reactコンポーネント | 80%以上（主要ユーザーフロー） |
| API Routes / Server Actions | 85%以上 |
| Cloud Functions | 85%以上 |
| 全体 | 80%以上 |

---

## 8. 仕様の曖昧な点・テスト設計に支障がある箇所

以下の点が仕様書で未定義または曖昧であり、テスト設計に影響します。

### 8.1 重要度: 高（テスト設計をブロック）

| # | 箇所 | 問題 | テストへの影響 | 提案 |
|---|------|------|--------------|------|
| A-01 | 確定済みイベントへの投票 | `status=fixed`のイベントにゲストが新規回答・編集できるか未定義 | ER-10テストの期待値が書けない | 確定後は投票UIを非表示にし、閲覧のみにすべき |
| A-02 | 過去日時の候補日 | 過去の日時を候補日として追加可能か未定義 | U-CD-05のバリデーションテストが書けない | 過去日時は追加不可とすべき |
| A-03 | 候補日の重複 | 同一日時の候補日を複数追加可能か未定義 | U-CD-06のテストが書けない | 重複排除 or 警告を出すべき |
| A-04 | イベント編集ページの仕様 | `/events/[id]/edit`が存在するが、何が編集可能かの詳細なし | イベント編集テスト全般が書けない | 候補日の追加/削除/タイトル変更等の範囲を明記すべき |
| A-05 | ゲスト0人での確定 | ゲスト未登録でFix可能か未定義 | EC-IV-09のテストが書けない | 少なくとも1人のゲスト回答を必須とすべき |

### 8.2 重要度: 中（テスト設計に影響あるが推測で対応可能）

| # | 箇所 | 問題 | テストへの影響 | 提案 |
|---|------|------|--------------|------|
| A-06 | ログイン済みユーザーの`/`アクセス | ログイン済みの場合のランディングページ挙動が未定義 | C-LP-02のテストが書けない | `/dashboard`へリダイレクトが自然 |
| A-07 | 入力フィールドの最大長 | タイトル、メモ、ゲスト名等の文字数制限なし | 境界値テストが書けない | タイトル100文字、メモ1000文字、名前50文字等を規定すべき |
| A-08 | 候補日の最大数 | 候補日を何件まで追加できるか未定義 | パフォーマンス/UI テストの上限が決まらない | 最大20-30件程度の制限を設けるべき |
| A-09 | 別ブラウザからの回答編集 | localStorageベースのトークンが別ブラウザにないケース | EC-DS-03のテスト期待値が曖昧 | 新規回答として扱い、同名・同メールの重複許可 or 拒否を明記すべき |
| A-10 | メール通知の具体的な内容 | 通知メールの件名・本文テンプレートが未定義 | メール内容のアサーションが書けない | テンプレートを定義すべき |
| A-11 | エラー時のリトライ方針 | Calendar API/Gemini APIエラー時の自動リトライ有無 | リトライテストの要否が不明 | ユーザー手動リトライ（ボタン再クリック）で十分と思われる |
| A-12 | イベント削除機能 | ホストがイベントを削除できるかの記載なし | 削除関連テストの要否 | ダッシュボードから削除可能にすべき |
| A-13 | 同名ゲストの扱い | 異なる人が同じ名前で回答した場合の表示 | 表示テストの期待値が曖昧 | 名前+メールで一意識別を明記すべき |

### 8.3 重要度: 低（テスト設計には大きな影響なし）

| # | 箇所 | 問題 |
|---|------|------|
| A-14 | OAuth審査とテストユーザー制限 | 開発中のテストユーザー100人制限の記載はあるが、テスト環境でのOAuth Emulator使用で回避可能 |
| A-15 | メール送信サービスの選定 | 具体的なサービス（SendGrid? Resend?）が未定義。モック戦略には影響なし |
| A-16 | AI入力の対応言語 | 日本語のみか英語も対応するか。テストケースの網羅性に影響 |

---

## 9. 補足: テストディレクトリ構成（推奨）

```
/
├── __tests__/               # ユニット・コンポーネントテスト
│   ├── utils/
│   │   ├── timezone.test.ts
│   │   ├── candidates.test.ts
│   │   └── token.test.ts
│   ├── components/
│   │   ├── VotingTable.test.tsx
│   │   ├── EventForm.test.tsx
│   │   └── TimezoneDisplay.test.tsx
│   └── api/
│       ├── parse-dates.test.ts
│       └── create-event.test.ts
├── __tests__/integration/   # 結合テスト
│   ├── guest-voting-flow.test.ts
│   ├── event-creation-flow.test.ts
│   └── notification-flow.test.ts
├── __tests__/rules/         # Firestoreセキュリティルール
│   └── firestore.rules.test.ts
├── e2e/                     # E2Eテスト (Playwright)
│   ├── host-flow.spec.ts
│   ├── guest-flow.spec.ts
│   ├── timezone.spec.ts
│   └── responsive.spec.ts
├── vitest.config.ts
├── vitest.integration.config.ts
├── vitest.rules.config.ts
└── playwright.config.ts
```

---

## 10. テスト優先度マトリクス

実装時に以下の優先度で着手することを推奨:

| 優先度 | テスト領域 | 理由 |
|--------|-----------|------|
| P0 (最優先) | タイムゾーン変換ユニットテスト | コアロジック。バグ発生時の影響大 |
| P0 | Firestoreセキュリティルールテスト | セキュリティ直結。権限漏れは致命的 |
| P0 | フォームバリデーション | ユーザー入力の安全性担保 |
| P1 | 投票フロー結合テスト | メインユースケースの品質担保 |
| P1 | ホスト認証・確定フロー | 認証まわりは不具合が出やすい |
| P1 | E2E ハッピーパス | 全体の動作保証 |
| P2 | AI日付パースのテスト | モック前提なら優先度やや下げ可能 |
| P2 | レスポンシブ表示テスト | 機能障害ではなくUX品質 |
| P2 | Cloud Functions通知テスト | 補助機能 |
| P3 | エッジケース（DST等） | 発生頻度は低いが重要 |
| P3 | ブラウザ互換性テスト | モダンブラウザ前提で問題少 |
