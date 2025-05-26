// --- 環境・設定管理クラス ---
class EnvConfig {
  /** Node.js環境かどうかを判定 */
  static isNode() {
    return (typeof process !== 'undefined') && (process.release && process.release.name === 'node');
  }
  /** debugログ出力を有効にするか */
  static getDebugLogEnabled() {
    if (this.isNode()) {
      return process.env.DEBUG_LOG_ENABLED === 'true';
    } else {
      var prop = PropertiesService.getScriptProperties().getProperty('DEBUG_LOG_ENABLED');
      return prop === 'true';
    }
  }
  /** Slack通知を有効にするか */
  static getSlackNotifyEnabled() {
    if (this.isNode()) {
      return process.env.ENABLE_SLACK_NOTIFY === 'true';
    } else {
      var prop = PropertiesService.getScriptProperties().getProperty('ENABLE_SLACK_NOTIFY');
      return prop === 'true';
    }
  }
  /** YouTube APIキーを取得 */
  static getApiKey() {
    if (this.isNode()) {
      return process.env.YOUTUBE_API_KEY;
    } else {
      return PropertiesService.getScriptProperties().getProperty('YOUTUBE_API_KEY');
    }
  }
  /** Slack Webhook URLを取得 */
  static getSlackWebhookUrl() {
    if (this.isNode()) {
      return process.env.SLACK_WEBHOOK_URL;
    } else {
      return PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_URL');
    }
  }
  /** 指定ミリ秒だけ待機 */
  static sleep(ms) {
    if (this.isNode()) {
      return new Promise(resolve => setTimeout(resolve, ms));
    } else {
      Utilities.sleep(ms);
      return Promise.resolve();
    }
  }
}

// --- ログ管理クラス ---
class Watch {
  /** infoレベルのログ出力 */
  static info(...args) {
    const msg = '[INFO] ' + args.map(String).join(' ');
    if (typeof Logger !== 'undefined' && typeof Logger.log === 'function') {
      Logger.log(msg);
    } else {
      console.log(msg);
    }
  }
  /** debugレベルのログ出力（有効時のみ） */
  static debug(...args) {
    if (!EnvConfig.getDebugLogEnabled()) return;
    const msg = '[DEBUG] ' + args.map(String).join(' ');
    if (typeof Logger !== 'undefined' && typeof Logger.log === 'function') {
      Logger.log(msg);
    } else {
      console.log(msg);
    }
  }
  /** 旧API: infoにリダイレクト */
  static log(...args) {
    Watch.info(...args);
  }
}

// --- データ管理クラス ---
class StreamDB {
  static mockDB = {
    m_streamer: [
      { name: '配信者A', platform: 'YouTube', id1: '@example1', id2: 'UCxxxxxxxxxxxxxxxxxxxxxx', url: 'https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx' },
      { name: '配信者B', platform: 'YouTube', id1: '@example2', id2: 'UCxxxxxxxxxxxxxxxxxxxxxx', url: 'https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx' }
    ],
    t_stream: []
  };
  /** mockDBまたはスプレッドシートから配信者リストを取得 */
  static getMStreamer() {
    if (EnvConfig.isNode()) {
      return this.mockDB.m_streamer;
    } else {
      const sheet = SpreadsheetApp.getActive().getSheetByName('m_streamer');
      const values = sheet.getDataRange().getValues();
      if (values.length <= 1) return [];
      return values.slice(1).map(row => ({
        name: row[0], platform: row[1], id1: row[2], id2: row[3], url: row[4]
      }));
    }
  }
  /** mockDBまたはスプレッドシートから配信情報リストを取得 */
  static getTStream() {
    if (EnvConfig.isNode()) {
      return this.mockDB.t_stream;
    } else {
      const sheet = SpreadsheetApp.getActive().getSheetByName('t_stream');
      const values = sheet.getDataRange().getValues();
      if (values.length <= 1) return [];
      return values.slice(1).map(row => ({
        platform: row[0], streamId: row[1], title: row[2], channelId: row[3], channelTitle: row[4], createdAt: row[5], scheduledAt: row[6], status: row[7], url: row[8]
      }));
    }
  }
  /** JST形式に変換 */
  static toJSTISOString(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().replace('T', ' ').replace(/\..+/, '');
  }
}

// --- YouTube APIユーティリティ ---
class YouTubeAPI {
  /** id2（UC形式）のみでYouTubeチャンネル名を取得 */
  static async fetchChannelTitle(id2) {
    await EnvConfig.sleep(1000);
    const apiKey = EnvConfig.getApiKey();
    if (id2 && id2.startsWith('UC')) {
      const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${id2}&key=${apiKey}`;
      Watch.debug(`fetchYouTubeChannelTitle: url=${url}`);
      try {
        if (EnvConfig.isNode()) {
          const axios = require('axios');
          try {
            const res = await axios.get(url);
            Watch.debug(`fetchYouTubeChannelTitle: status=${res.status}, statusText=${res.statusText}, data.items.length=${res.data.items ? res.data.items.length : 0}`);
            Watch.debug(`fetchYouTubeChannelTitle: full response data=`, JSON.stringify(res.data, null, 2));
            if (res.data.items && res.data.items.length > 0) {
              return res.data.items[0]?.snippet?.title || null;
            } else {
              Watch.debug(`fetchYouTubeChannelTitle: APIレスポンス items空 or undefined`, res.data);
            }
          } catch (apiErr) {
            if (apiErr.response) {
              Watch.info(`fetchYouTubeChannelTitle: API error response`, `status=${apiErr.response.status}, statusText=${apiErr.response.statusText}`, JSON.stringify(apiErr.response.data, null, 2));
            } else {
              Watch.info(`fetchYouTubeChannelTitle:`, apiErr.message || apiErr);
            }
          }
        } else {
          try {
            const response = UrlFetchApp.fetch(url);
            Watch.debug(`fetchYouTubeChannelTitle: GAS responseCode=${response.getResponseCode()}`);
            const data = JSON.parse(response.getContentText());
            Watch.debug(`fetchYouTubeChannelTitle: GAS data.items.length=${data.items ? data.items.length : 0}`);
            Watch.debug(`fetchYouTubeChannelTitle: GAS full response data=`, JSON.stringify(data, null, 2));
            if (data.items && data.items.length > 0) {
              return data.items[0]?.snippet?.title || null;
            } else {
              Watch.debug(`fetchYouTubeChannelTitle: GAS APIレスポンス items空 or undefined`, data);
            }
          } catch (e) {
            Watch.info(`fetchYouTubeChannelTitle: GAS error`, e.message || e);
          }
        }
      } catch (e) {
        Watch.info(`fetchYouTubeChannelTitle: id2(${id2})で取得失敗:`, e.message || e);
      }
    }
    Watch.info(`fetchYouTubeChannelTitle: id2(${id2}) でデータが取得できません`);
    return null;
  }
  /** id2（UC形式）のみで直近のYouTubeライブ動画リストを取得 */
  static async fetchRecentLiveVideos(id2) {
    await EnvConfig.sleep(1000);
    const apiKey = EnvConfig.getApiKey();
    const publishedAfter = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    if (id2 && id2.startsWith('UC')) {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${id2}&type=video&publishedAfter=${publishedAfter}&key=${apiKey}`;
      Watch.debug(`fetchRecentLiveVideos: url=${url}`);
      try {
        if (EnvConfig.isNode()) {
          const axios = require('axios');
          try {
            const res = await axios.get(url);
            Watch.debug(`fetchRecentLiveVideos: status=${res.status}, statusText=${res.statusText}, data.items.length=${res.data.items ? res.data.items.length : 0}`);
            Watch.debug(`fetchRecentLiveVideos: full response data=`, JSON.stringify(res.data, null, 2));
            if (res.status !== 200 || !res.data || typeof res.data.items === 'undefined') {
              Watch.info(`fetchRecentLiveVideos: APIレスポンス異常 status=${res.status}, items undefined`, JSON.stringify(res.data, null, 2));
              return [];
            }
            if (res.data.items.length === 0) {
              Watch.debug(`fetchRecentLiveVideos: items空`);
              return [];
            }
            return res.data.items;
          } catch (apiErr) {
            if (apiErr.response) {
              Watch.info(`fetchRecentLiveVideos: API error response`, `status=${apiErr.response.status}, statusText=${apiErr.response.statusText}`, JSON.stringify(apiErr.response.data, null, 2));
            }
            throw apiErr;
          }
        } else {
          const response = UrlFetchApp.fetch(url);
          const data = JSON.parse(response.getContentText());
          Watch.debug(`fetchRecentLiveVideos: GAS data.items.length=${data.items ? data.items.length : 0}`);
          Watch.debug(`fetchRecentLiveVideos: GAS full response data=`, JSON.stringify(data, null, 2));
          if (response.getResponseCode() !== 200 || typeof data.items === 'undefined') {
            Watch.info(`fetchRecentLiveVideos: GAS APIレスポンス異常 responseCode=${response.getResponseCode()}, items undefined`, JSON.stringify(data, null, 2));
            return [];
          }
          if (data.items.length === 0) {
            Watch.debug(`fetchRecentLiveVideos: GAS items空`);
            return [];
          }
          return data.items;
        }
      } catch (e) {
        Watch.info(`fetchRecentLiveVideos: id2(${id2})で取得失敗:`, e.message || e, e.response?.data);
      }
    } else {
      Watch.debug(`fetchRecentLiveVideos: id2が未設定またはUC形式でない: id2=${id2}`);
    }
    Watch.info(`fetchRecentLiveVideos: id2(${id2}) でデータが取得できません`);
    return [];
  }
}

// --- Slack通知ユーティリティ ---
class SlackNotifier {
  /** Slack通知用関数（Block Kit形式・status色分け対応） */
  static async notify(channelTitle, title, liveId, status, platform) {
    if (!EnvConfig.getSlackNotifyEnabled()) {
      Watch.info('[Slack通知] 無効化されています:', channelTitle, title, liveId, status, platform);
      return;
    }
    await EnvConfig.sleep(1000);
    const webhookUrl = EnvConfig.getSlackWebhookUrl();
    if (!webhookUrl) {
      Watch.info('[Slack通知] Webhook URLが未設定です');
      return;
    }
    const streamUrl = platform === 'YouTube'
      ? `https://www.youtube.com/watch?v=${liveId}`
      : liveId;
    let color = '#cccccc';
    let statusText = status;
    if (status === 'upcoming') {
      color = '#f2c744';
      statusText = ':large_yellow_circle: upcoming';
    } else if (status === 'live') {
      color = '#e01e5a';
      statusText = ':red_circle: live';
    } else if (status === 'none') {
      color = '#cccccc';
      statusText = 'none';
    }
    const payload = {
      attachments: [
        {
          color: color,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*【${platform}】${channelTitle}*\n*${title}*\n<${streamUrl}|配信ページ>`
              }
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `*status:* ${statusText}`
                }
              ]
            }
          ]
        }
      ]
    };
    if (EnvConfig.isNode()) {
      const axios = require('axios');
      try {
        await axios.post(webhookUrl, payload);
        Watch.info('[Slack通知] 送信成功:', JSON.stringify(payload));
      } catch (e) {
        Watch.info('[Slack通知] 送信失敗:', e.message);
      }
    } else {
      try {
        UrlFetchApp.fetch(webhookUrl, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload)
        });
        Watch.info('[Slack通知] 送信成功:', JSON.stringify(payload));
      } catch (e) {
        Watch.info('[Slack通知] 送信失敗:', e.message);
      }
    }
  }
}

// --- メイン処理 ---
/**
 * YouTube配信情報の取得・DB/シート更新・Slack通知のメイン処理
 */
async function processYouTubeStreams() {
  Watch.info('=== YouTube配信チェック開始 ===');
  const mStreamer = StreamDB.getMStreamer();
  let tStream = StreamDB.getTStream();
  Watch.info(`m_streamer件数: ${mStreamer.length}`);
  for (const streamer of mStreamer) {
    if (streamer.platform !== 'YouTube') continue;
    const id2 = streamer.id2 || '';
    const platform = 'YouTube';
    const channelUrl = streamer.url || (id2 ? `https://www.youtube.com/channel/${id2}` : '');
    Watch.debug(`[配信者チェック] 配信者名: ${streamer.name}, id2: ${id2}`);
    const channelTitle = await YouTubeAPI.fetchChannelTitle(id2);
    if (!channelTitle) {
      Watch.info(`[ERROR] 配信者ID: ${id2} からチャンネル名が取得できません`);
      continue;
    }
    Watch.info(`配信者ID: ${id2}, 配信者名: ${channelTitle}`);
    const lives = await YouTubeAPI.fetchRecentLiveVideos(id2);
    Watch.info(`  取得したライブ数: ${lives.length}`);
    for (const live of lives) {
      const liveId = live.id.videoId;
      const title = live.snippet.title;
      const channelIdFromLive = live.snippet.channelId || id2;
      const channelTitleFromLive = live.snippet.channelTitle || channelTitle;
      const scheduledAt = StreamDB.toJSTISOString(live.snippet.publishedAt);
      const now = StreamDB.toJSTISOString(new Date().toISOString());
      const status = live.snippet.liveBroadcastContent || '';
      const streamUrl = `https://www.youtube.com/watch?v=${liveId}`;
      const tIndex = tStream.findIndex(t => t.platform === platform && t.streamId === liveId);
      if (tIndex === -1) {
        // 新規追加
        if (EnvConfig.isNode()) {
          StreamDB.mockDB.t_stream.push({
            platform,
            streamId: liveId,
            title,
            channelId: channelIdFromLive,
            channelTitle: channelTitleFromLive,
            createdAt: now,
            scheduledAt,
            status,
            url: streamUrl
          });
        } else {
          const sheet = SpreadsheetApp.getActive().getSheetByName('t_stream');
          sheet.appendRow([platform, liveId, title, channelIdFromLive, channelTitleFromLive, now, scheduledAt, status, streamUrl]);
        }
        Watch.info(`    [追加] t_streamに追加: ${liveId}`);
        if (status === 'upcoming' || status === 'live') {
          await SlackNotifier.notify(channelTitleFromLive, title, liveId, status, platform);
        } else {
          Watch.debug(`    [通知スキップ] status=${status} のためSlack通知しません: ${liveId}`);
        }
      } else {
        // 既存: 既存データの更新（status変化のみで上書き）
        const tItem = tStream[tIndex];
        if (tItem.status !== status) {
          if (EnvConfig.isNode()) {
            StreamDB.mockDB.t_stream[tIndex] = {
              ...tItem,
              title,
              channelId: channelIdFromLive,
              channelTitle: channelTitleFromLive,
              scheduledAt,
              status,
              url: streamUrl
            };
          } else {
            const sheet = SpreadsheetApp.getActive().getSheetByName('t_stream');
            sheet.getRange(tIndex + 2, 3, 1, 7).setValues([[title, channelIdFromLive, channelTitleFromLive, tItem.createdAt, scheduledAt, status, streamUrl]]);
          }
          Watch.info(`    [更新] t_streamのstatusを上書き: ${liveId} → ${status}`);
          if (status === 'upcoming' || status === 'live') {
            await SlackNotifier.notify(channelTitleFromLive, title, liveId, status, platform);
          } else {
            Watch.debug(`    [通知スキップ] status=${status} のためSlack通知しません: ${liveId}`);
          }
        } else {
          Watch.info(`    [判定] t_streamに既に存在しstatusも同じ: ${liveId}`);
        }
      }
    }
  }
  Watch.info('=== YouTube配信チェック終了 ===');
}

/**
 * メインエントリーポイント（Node.js実行時のみ）
 */
async function Excecute() {
  await processYouTubeStreams();
}

if (EnvConfig.isNode()) {
  Excecute();
}
