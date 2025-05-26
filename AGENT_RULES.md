# AGENT実行ルール

## 1. 実行目的
- このプロジェクトのagentは、Google Apps Script（GAS）またはNode.jsとして動作し、YouTube配信監視・Slack通知を自動化することを目的とする。
- 開発中はNode.jsでローカル実行・テストが可能。

## 2. 実行環境
- Node.js バージョン: xx.x.x
- 必要なパッケージ: axios
- 最終的なデプロイ先: Google Apps Script

## 3. 実行手順
1. `npm install` で依存パッケージをインストールする
2. 必要な環境変数またはGASスクリプトプロパティを設定する
   - `YOUTUBE_API_KEY` : YouTube Data API v3のAPIキー
   - `SLACK_WEBHOOK_URL` : Slack Incoming WebhookのURL
   - `DEBUG_LOG_ENABLED` : `true`でdebugログ有効、未設定/`false`で無効
   - `ENABLE_SLACK_NOTIFY` : `true`でSlack通知有効、未設定/`false`で無効
3. `node index.js` でローカルテスト
4. 完成後、`index.js`の内容をGASプロジェクトにコピーして利用

## 4. 入出力仕様
- GASで実行する関数名は `Excecute` とする
- スプレッドシートは `m_streamer`/`t_stream` シートを利用

## 5. 制約・ルール
- GASで動作するように、Node.js固有のAPIやパッケージ利用は最小限にする
- エラー発生時は即時終了し、エラーメッセージを標準出力に表示
- YouTube APIはid2（UC形式）のみ利用
- Slack通知・debugログは環境変数またはプロパティで有効/無効を制御
- Slack通知はBlock Kit形式・色分け・アイコン付き

## 6. その他
- GAS用に変換・移植が必要な場合はコメント等で明示する
- 個人情報・APIキー等は必ず安全に管理すること
