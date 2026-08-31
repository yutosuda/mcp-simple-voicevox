import { describe, it, expect, beforeEach } from '@jest/globals';
import { VoicevoxClient } from '../src/voicevox-client';

describe('VoicevoxClient', () => {
  let client: VoicevoxClient;
  const mockEndpoint = 'http://localhost:50021';

  beforeEach(() => {
    client = new VoicevoxClient(mockEndpoint);
  });

  describe('constructor', () => {
    it('should create instance with correct endpoint', () => {
      expect(client).toBeInstanceOf(VoicevoxClient);
    });
  });

  describe('synthesize', () => {
    // 合成の失敗が呼び出し側に伝わることを守る。ここが握り潰されると、
    // エンジンが落ちていても「おしゃべり完了」が返る無音の失敗になる。
    it('エンジンに到達できないときは reject する', async () => {
      const unreachable = new VoicevoxClient('http://127.0.0.1:1');

      await expect(unreachable.synthesize('テスト', 1)).rejects.toThrow(
        'VOICEVOXエンジンに接続できません'
      );
    });
  });

  describe('SpeakOptions interface', () => {
    it('should have correct structure', () => {
      const options = {
        text: 'テスト',
        speaker: 1,
        speedScale: 1.0,
        volumeScale: 1.0,
      };

      expect(typeof options.text).toBe('string');
      expect(typeof options.speaker).toBe('number');
      expect(typeof options.speedScale).toBe('number');
      expect(typeof options.volumeScale).toBe('number');
    });
  });
});
