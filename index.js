// --- 環境・設定管理クラス ---
class EnvConfig {
  constructor(env) {
    this.env = env || (typeof process !== 'undefined' && process.release && process.release.name === 'node' ? 'node' : 'gas');
  }
  isNode() {
    return this.env === 'node';
  }
  getDebugLogEnabled() {
    if (this.isNode()) {
      return process.env.DEBUG_LOG_ENABLED === 'true';
    } else {
      var prop = PropertiesService.getScriptProperties().getProperty('DEBUG_LOG_ENABLED');
      return prop === 'true';
    }
  }
  getSlackNotifyEnabled() {
    if (this.isNode()) {
      return process.env.ENABLE_SLACK_NOTIFY === 'true';
    } else {
      var prop = PropertiesService.getScriptProperties().getProperty('ENABLE_SLACK_NOTIFY');
      return prop === 'true';
    }
  }
  getApiKey() {
    if (this.isNode()) {
      return process.env.YOUTUBE_API_KEY;
    } else {
      return PropertiesService.getScriptProperties().getProperty('YOUTUBE_API_KEY');
    }
  }
  getSlackWebhookUrl() {
    if (this.isNode()) {
      return process.env.SLACK_WEBHOOK_URL;
    } else {
      return PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_URL');
    }
  }
  sleep(ms) {
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
  constructor(envConfig) {
    this.envConfig = envConfig;
  }
  info(...args) {
    const msg = '[INFO] ' + args.map(String).join(' ');
    if (typeof Logger !== 'undefined' && typeof Logger.log === 'function') {
      Logger.log(msg);
    } else {
      console.log(msg);
    }
  }
  debug(...args) {
    if (!this.envConfig.getDebugLogEnabled()) return;
    const msg = '[DEBUG] ' + args.map(String).join(' ');
    if (typeof Logger !== 'undefined' && typeof Logger.log === 'function') {
      Logger.log(msg);
    } else {
      console.log(msg);
    }
  }
  log(...args) {
    this.info(...args);
  }
}

// --- データ管理クラス ---
class StreamDB {
  constructor(envConfig, watch) {
    this.envConfig = envConfig;
    this.watch = watch;
    this.mockDB = {
      m_streamer: [
        { name: '配信者A', platform: 'YouTube', id1: '@example1', id2: 'UCxxxxxxxxxxxxxxxxxxxxxx', url: 'https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx' },
        { name: '配信者B', platform: 'YouTube', id1: '@example2', id2: 'UCxxxxxxxxxxxxxxxxxxxxxx', url: 'https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx' }
      ],
      t_stream: []
    };
  }
  getMStreamer() {
    if (this.envConfig.isNode()) {
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
  getTStream() {
    if (this.envConfig.isNode()) {
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
  toJSTISOString(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().replace('T', ' ').replace(/\..+/, '');
  }
}

// --- YouTube APIユーティリティ ---
class YouTubeAPI {
  constructor(envConfig, watch) {
    this.envConfig = envConfig;
    this.watch = watch;
  }
  async fetchChannelTitle(id2) {
    await this.envConfig.sleep(1000);
    const apiKey = this.envConfig.getApiKey();
    if (id2 && id2.startsWith('UC')) {
      const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${id2}&key=${apiKey}`;
      this.watch.debug(`fetchYouTubeChannelTitle: url=${url}`);
      try {
        if (this.envConfig.isNode()) {
          const axios = require('axios');
          try {
            const res = await axios.get(url);
            this.watch.debug(`fetchYouTubeChannelTitle: status=${res.status}, statusText=${res.statusText}, data.items.length=${res.data.items ? res.data.items.length : 0}`);
            this.watch.debug(`fetchYouTubeChannelTitle: full response data=`, JSON.stringify(res.data, null, 2));
            if (res.data.items && res.data.items.length > 0) {
              return res.data.items[0]?.snippet?.title || null;
            } else {
              this.watch.debug(`fetchYouTubeChannelTitle: APIレスポンス items空 or undefined`, res.data);
            }
          } catch (apiErr) {
            if (apiErr.response) {
              this.watch.info(`fetchYouTubeChannelTitle: API error response`, `status=${apiErr.response.status}, statusText=${apiErr.response.statusText}`, JSON.stringify(apiErr.response.data, null, 2));
            } else {
              this.watch.info(`fetchYouTubeChannelTitle:`, apiErr.message || apiErr);
            }
          }
        } else {
          try {
            const response = UrlFetchApp.fetch(url);
            this.watch.debug(`fetchYouTubeChannelTitle: GAS responseCode=${response.getResponseCode()}`);
            const data = JSON.parse(response.getContentText());
            this.watch.debug(`fetchYouTubeChannelTitle: GAS data.items.length=${data.items ? data.items.length : 0}`);
            this.watch.debug(`fetchYouTubeChannelTitle: GAS full response data=`, JSON.stringify(data, null, 2));
            if (data.items && data.items.length > 0) {
              return data.items[0]?.snippet?.title || null;
            } else {
              this.watch.debug(`fetchYouTubeChannelTitle: GAS APIレスポンス items空 or undefined`, data);
            }
          } catch (e) {
            this.watch.info(`fetchYouTubeChannelTitle: GAS error`, e.message || e);
          }
        }
      } catch (e) {
        this.watch.info(`fetchYouTubeChannelTitle: id2(${id2})で取得失敗:`, e.message || e);
      }
    }
    this.watch.info(`fetchYouTubeChannelTitle: id2(${id2}) でデータが取得できません`);
    return null;
  }
  async fetchRecentLiveVideos(id2) {
    await this.envConfig.sleep(1000);
    const apiKey = this.envConfig.getApiKey();
    const publishedAfter = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    if (id2 && id2.startsWith('UC')) {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${id2}&type=video&publishedAfter=${publishedAfter}&key=${apiKey}`;
      this.watch.debug(`fetchRecentLiveVideos: url=${url}`);
      try {
        if (this.envConfig.isNode()) {
          const axios = require('axios');
          try {
            const res = await axios.get(url);
            this.watch.debug(`fetchRecentLiveVideos: status=${res.status}, statusText=${res.statusText}, data.items.length=${res.data.items ? res.data.items.length : 0}`);
            this.watch.debug(`fetchRecentLiveVideos: full response data=`, JSON.stringify(res.data, null, 2));
            if (res.status !== 200 || !res.data || typeof res.data.items === 'undefined') {
              this.watch.info(`fetchRecentLiveVideos: APIレスポンス異常 status=${res.status}, items undefined`, JSON.stringify(res.data, null, 2));
              return [];
            }
            if (res.data.items.length === 0) {
              this.watch.debug(`fetchRecentLiveVideos: items空`);
              return [];
            }
            return res.data.items;
          } catch (apiErr) {
            if (apiErr.response) {
              this.watch.info(`fetchRecentLiveVideos: API error response`, `status=${apiErr.response.status}, statusText=${apiErr.response.statusText}`, JSON.stringify(apiErr.response.data, null, 2));
            }
            throw apiErr;
          }
        } else {
          const response = UrlFetchApp.fetch(url);
          const data = JSON.parse(response.getContentText());
          this.watch.debug(`fetchRecentLiveVideos: GAS data.items.length=${data.items ? data.items.length : 0}`);
          this.watch.debug(`fetchRecentLiveVideos: GAS full response data=`, JSON.stringify(data, null, 2));
          if (response.getResponseCode() !== 200 || typeof data.items === 'undefined') {
            this.watch.info(`fetchRecentLiveVideos: GAS APIレスポンス異常 responseCode=${response.getResponseCode()}, items undefined`, JSON.stringify(data, null, 2));
            return [];
          }
          if (data.items.length === 0) {
            this.watch.debug(`fetchRecentLiveVideos: GAS items空`);
            return [];
          }
          return data.items;
        }
      } catch (e) {
        this.watch.info(`fetchRecentLiveVideos: id2(${id2})で取得失敗:`, e.message || e, e.response?.data);
      }
    } else {
      this.watch.debug(`fetchRecentLiveVideos: id2が未設定またはUC形式でない: id2=${id2}`);
    }
    this.watch.info(`fetchRecentLiveVideos: id2(${id2}) でデータが取得できません`);
    return [];
  }
}

// --- Slack通知ユーティリティ ---
class SlackNotifier {
  constructor(envConfig, watch) {
    this.envConfig = envConfig;
    this.watch = watch;
  }
  async notify(channelTitle, title, liveId, status, platform, scheduledAt) {
    if (!this.envConfig.getSlackNotifyEnabled()) {
      this.watch.info('[Slack通知] 無効化されています:', channelTitle, title, liveId, status, platform);
      return;
    }
    await this.envConfig.sleep(1000);
    const webhookUrl = this.envConfig.getSlackWebhookUrl();
    if (!webhookUrl) {
      this.watch.info('[Slack通知] Webhook URLが未設定です');
      return;
    }
    const streamUrl = platform === 'YouTube'
      ? `https://www.youtube.com/watch?v=${liveId}`
      : liveId;
    let color = '#cccccc';
    let statusText = status;
    if (status === 'upcoming') {
      statusText = 'upcoming（公開予定）';
      color = '#f2c744';
    } else if (status === 'live') {
      statusText = 'live（配信中）';
      color = '#e01e5a';
    } else if (status === 'none') {
      statusText = 'none（終了）';
      color = '#cccccc';
    } else {
      color = '#cccccc';
    }
    let scheduledAtJST = scheduledAt || '';
    if (scheduledAtJST) {
      scheduledAtJST = scheduledAtJST.replace(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}).*$/, '$1');
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
                text: `*【${platform}】${channelTitle}*\n*${title}*\n*公開/配信日時:* ${scheduledAtJST}`
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
      ],
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: streamUrl
          }
        }
      ]
    };
    if (this.envConfig.isNode()) {
      const axios = require('axios');
      try {
        await axios.post(webhookUrl, payload);
        this.watch.info('[Slack通知] 送信成功:', JSON.stringify(payload));
      } catch (e) {
        this.watch.info('[Slack通知] 送信失敗:', e.message);
      }
    } else {
      try {
        UrlFetchApp.fetch(webhookUrl, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload)
        });
        this.watch.info('[Slack通知] 送信成功:', JSON.stringify(payload));
      } catch (e) {
        this.watch.info('[Slack通知] 送信失敗:', e.message);
      }
    }
  }
}

// --- メイン処理クラス ---
class StreamWatchman {
  constructor(envConfig, watch, streamDB, youTubeAPI, slackNotifier) {
    this.envConfig = envConfig;
    this.watch = watch;
    this.streamDB = streamDB;
    this.youTubeAPI = youTubeAPI;
    this.slackNotifier = slackNotifier;
  }
  async processYouTubeStreams() {
    this.watch.info('=== YouTube配信チェック開始 ===');
    const mStreamer = this.streamDB.getMStreamer();
    let tStream = this.streamDB.getTStream();
    this.watch.info(`m_streamer件数: ${mStreamer.length}`);
    for (const streamer of mStreamer) {
      if (streamer.platform !== 'YouTube') continue;
      const id2 = streamer.id2 || '';
      const platform = 'YouTube';
      const channelUrl = streamer.url || (id2 ? `https://www.youtube.com/channel/${id2}` : '');
      this.watch.debug(`[配信者チェック] 配信者名: ${streamer.name}, id2: ${id2}`);
      const channelTitle = await this.youTubeAPI.fetchChannelTitle(id2);
      if (!channelTitle) {
        this.watch.info(`[ERROR] 配信者ID: ${id2} からチャンネル名が取得できません`);
        continue;
      }
      this.watch.info(`配信者ID: ${id2}, 配信者名: ${channelTitle}`);
      const lives = await this.youTubeAPI.fetchRecentLiveVideos(id2);
      this.watch.info(`  取得したライブ数: ${lives.length}`);
      for (const live of lives) {
        const liveId = live.id.videoId;
        const title = live.snippet.title;
        const channelIdFromLive = live.snippet.channelId || id2;
        const channelTitleFromLive = live.snippet.channelTitle || channelTitle;
        const scheduledAt = this.streamDB.toJSTISOString(live.snippet.publishedAt);
        const now = this.streamDB.toJSTISOString(new Date().toISOString());
        const status = live.snippet.liveBroadcastContent || '';
        const streamUrl = `https://www.youtube.com/watch?v=${liveId}`;
        const tIndex = tStream.findIndex(t => t.platform === platform && t.streamId === liveId);
        if (tIndex === -1) {
          // 新規追加
          if (this.envConfig.isNode()) {
            this.streamDB.mockDB.t_stream.push({
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
          this.watch.info(`    [追加] t_streamに追加: ${liveId}`);
          // ステータスに関係なく新規は必ず通知
          await this.slackNotifier.notify(channelTitleFromLive, title, liveId, status, platform, scheduledAt);
        } else {
          // 既存: 既存データの更新（status変化のみで上書き）
          const tItem = tStream[tIndex];
          if (tItem.status !== status) {
            if (this.envConfig.isNode()) {
              this.streamDB.mockDB.t_stream[tIndex] = {
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
            this.watch.info(`    [更新] t_streamのstatusを上書き: ${liveId} → ${status}`);
            // ステータスが変化した場合は必ず通知（noneも含む）
            await this.slackNotifier.notify(channelTitleFromLive, title, liveId, status, platform, scheduledAt);
          } else {
            this.watch.info(`    [判定] t_streamに既に存在しstatusも同じ: ${liveId}`);
          }
        }
      }
    }
    this.watch.info('=== YouTube配信チェック終了 ===');
  }
}

// --- メインエントリーポイント（Node.js実行時のみ） ---
async function Excecute() {
  const envConfig = new EnvConfig();
  const watch = new Watch(envConfig);
  const streamDB = new StreamDB(envConfig, watch);
  const youTubeAPI = new YouTubeAPI(envConfig, watch);
  const slackNotifier = new SlackNotifier(envConfig, watch);
  const streamWatchman = new StreamWatchman(envConfig, watch, streamDB, youTubeAPI, slackNotifier);
  await streamWatchman.processYouTubeStreams();
}

if ((typeof process !== 'undefined') && (process.release && process.release.name === 'node')) {
  Excecute();
}
