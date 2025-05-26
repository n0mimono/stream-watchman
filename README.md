# stream-watchman

## 概要

YouTube（将来的にはTwitch等も対応予定）の配信監視・管理ツールです。Google Apps Script（GAS）とNode.js両対応で、配信情報の取得・管理・Slack通知を自動化します。

## 特徴
- GAS/Node.js両対応
- 配信者・配信情報をスプレッドシートまたはモックDBで管理
- YouTube API v3で配信情報を取得（id2/UC形式のみ利用）
- 配信の新規追加やステータス変更時にSlack通知（upcoming/liveのみ通知、noneは通知しない）
- Slack通知はBlock Kit形式で、statusごとに色分け・アイコン表示
- ログ出力はinfo/debugレベルで制御可能（環境変数またはGASプロパティでON/OFF）
- 日本時間（JST）で日時管理

## ファイル構成
- `index.js` : メインロジック（GAS/Node.js両対応）
- `AGENT_RULES.md` : 開発・運用ルール
- `package.json` : Node.js用依存管理

## 使い方

### Node.jsでの実行
1. 依存パッケージのインストール
   ```sh
   npm install
   ```
2. 必要な環境変数を設定
   - `.env`ファイルやシェルで以下を設定
     - `YOUTUBE_API_KEY` : YouTube Data API v3のAPIキー
     - `SLACK_WEBHOOK_URL` : Slack Incoming WebhookのURL
     - `DEBUG_LOG_ENABLED` : `true`でdebugログ有効、未設定/`false`で無効
     - `ENABLE_SLACK_NOTIFY` : `true`でSlack通知有効、未設定/`false`で無効
   例（.envファイル）:
   ```
   YOUTUBE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz
   DEBUG_LOG_ENABLED=true
   ENABLE_SLACK_NOTIFY=true
   ```
3. `index.js`を実行
   ```sh
   node index.js
   ```

### GASでの実行
1. `index.js`の内容をGASプロジェクトにコピー
2. スプレッドシートに `m_streamer`/`t_stream` シートを用意（1行目はヘッダ）
3. スクリプトプロパティで以下を設定
   - `YOUTUBE_API_KEY` : APIキー
   - `SLACK_WEBHOOK_URL` : Webhook URL
   - `DEBUG_LOG_ENABLED` : `true`でdebugログ有効、未設定/`false`で無効
   - `ENABLE_SLACK_NOTIFY` : `true`でSlack通知有効、未設定/`false`で無効
4. 関数 `Excecute` を実行

## スプレッドシート仕様

### m_streamer
| 配信者名 | プラットフォーム | 配信者ID_1 | 配信者ID_2 | 配信者URL |
|----------|------------------|------------|------------|------------|

### t_stream
| プラットフォーム | 配信ID | 配信タイトル | 配信者ID | 配信者名 | 作成日 | 配信予定日 | status | 配信URL |
|------------------|--------|--------------|-----------|-----------|--------|------------|--------|---------|

## Slack通知
- Webhook URLは環境変数またはGASプロパティで設定
- 通知内容：
  - Block Kit形式で、statusがupcomingなら黄色＋:large_yellow_circle:、liveなら赤＋:red_circle:、noneはグレー
  - 本文は太字・リンク付きで視認性向上
- 通知対象：upcoming/liveのみ

## ログ出力
- info/debugレベルで出力
- `DEBUG_LOG_ENABLED`（環境変数またはGASプロパティ）が`true`の場合のみdebugログ出力

## APIキー・Webhook URL・各種設定の管理
- Node.js: 環境変数または`.env`で管理
- GAS: スクリプトプロパティで管理
- 未設定時はdebug/slack通知ともに無効（安全設計）

## 注意事項
- YouTube APIキーやWebhook URLは安全に管理してください
- GASでのsleepは `Utilities.sleep` を利用
- GAS/Node.jsで動作差異が出ないよう設計

## ライセンス
MIT
