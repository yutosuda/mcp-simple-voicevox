#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createRequire } from 'node:module';
import { VoicevoxClient } from './voicevox-client.js';

// エンジンの居場所は注入できるようにしておく。VOICEVOX の GUI が 50021 を使うため、
// 常駐エンジンを別ポートに置きたい場合にここを切り替える。
const VOICEVOX_ENDPOINT =
  process.env.VOICEVOX_ENDPOINT ?? 'http://localhost:50021';

// package.json を唯一の正本にして、バージョンの二重管理を避ける
const { version } = createRequire(import.meta.url)('../package.json') as {
  version: string;
};

class VoicevoxMCPServer {
  private server: Server;
  private voicevoxClient: VoicevoxClient;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-voicevox',
        version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.voicevoxClient = new VoicevoxClient(VOICEVOX_ENDPOINT);
    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'speak',
            description: 'VOICEVOXを使用してテキストを読み上げます',
            inputSchema: {
              type: 'object',
              properties: {
                text: {
                  type: 'string',
                  description: '読み上げるテキスト',
                },
                speaker: {
                  type: 'number',
                  description: '話者ID（VOICEVOXの話者番号）',
                },
                speedScale: {
                  type: 'number',
                  description: '読み上げ速度のスケール（デフォルト1.0）',
                  minimum: 0.5,
                  maximum: 2.0,
                },
                volumeScale: {
                  type: 'number',
                  description: '音量のスケール（デフォルト1.0）',
                  minimum: 0.0,
                  maximum: 2.0,
                },
                async: {
                  type: 'boolean',
                  description:
                    '非同期再生モード（falseの場合、音声再生の完了を待ちます。デフォルトtrue）',
                },
              },
              required: ['text', 'speaker'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'speak') {
        try {
          const {
            text,
            speaker,
            speedScale,
            volumeScale,
            async: isAsync = true,
          } = request.params.arguments as {
            text: string;
            speaker: number;
            speedScale?: number;
            volumeScale?: number;
            async?: boolean;
          };

          // 合成までは async でも必ず待つ。ここを待たないと、エンジンが落ちていても
          // 「おしゃべり完了」を返してしまい、呼び出し側が無音の失敗に気づけない。
          const audio = await this.voicevoxClient.synthesize(
            text,
            speaker,
            speedScale,
            volumeScale
          );

          // ponytail: async のときは再生失敗（afplay 不在など）が stderr にしか出ない。
          // 再生の完了を待たない以上ここが上限で、検知したい場合は async: false を使う。
          isAsync
            ? void this.voicevoxClient
                .play(audio)
                .catch((e) => console.error(e))
            : await this.voicevoxClient.play(audio);

          return {
            content: [
              {
                type: 'text',
                text: 'おしゃべり完了',
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `エラー: ${
                  error instanceof Error ? error.message : '不明なエラー'
                }`,
              },
            ],
            isError: true,
          };
        }
      }

      throw new Error(`Unknown tool: ${request.params.name}`);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP VOICEVOX Server running on stdio');

    // プロセス終了時の処理
    process.on('SIGINT', () => {
      console.error('Received SIGINT, shutting down...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.error('Received SIGTERM, shutting down...');
      process.exit(0);
    });
  }
}

async function main() {
  const server = new VoicevoxMCPServer();
  await server.run();
}

// メインモジュールとして実行された場合
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
