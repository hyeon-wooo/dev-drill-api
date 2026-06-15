import { Test, TestingModule } from '@nestjs/testing';
import { CloudflareService } from './cloudflare.service';
import { ConfigService } from '@nestjs/config';

// Mock S3Client
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => {
      return {
        send: mockSend,
      };
    }),
    PutObjectCommand: jest.fn().mockImplementation((args) => args),
  };
});

describe('CloudflareService', () => {
  let service: CloudflareService;

  beforeEach(async () => {
    mockSend.mockClear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloudflareService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'R2_ACCOUNT_ID') return 'test-account';
              if (key === 'R2_ACCESS_KEY_ID') return 'test-access-key';
              if (key === 'R2_SECRET_ACCESS_KEY') return 'test-secret-key';
              if (key === 'R2_BUCKET_NAME') return 'test-bucket';
              if (key === 'R2_PUBLIC_URL') return 'https://pub-test.r2.dev';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CloudflareService>(CloudflareService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadBuffer', () => {
    it('should upload a buffer and return the public URL', async () => {
      mockSend.mockResolvedValueOnce({});

      const buffer = Buffer.from('test file content');
      const key = 'test-folder/test-file.txt';
      const contentType = 'text/plain';

      const result = await service.uploadBuffer(buffer, key, contentType);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        url: 'https://pub-test.r2.dev/test-folder/test-file.txt',
        key: 'test-folder/test-file.txt',
      });
    });
  });
});
