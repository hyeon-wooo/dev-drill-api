import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { UserEntity } from 'src/user/infra/user.entity';

@Injectable()
export class CloudflareService {
  private readonly logger = new Logger(CloudflareService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly endpoint: string;

  constructor(private readonly configService: ConfigService) {
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID')!;
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
    )!;
    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME')!;
    this.endpoint = this.configService.get<string>('R2_ENDPOINT')!;

    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey!,
      },
      region: 'auto',
    });
  }

  async uploadUser(user: UserEntity) {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const date = now.getDate().toString().padStart(2, '0');
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    const second = now.getSeconds().toString().padStart(2, '0');
    const millisecond = now.getMilliseconds();
    const fileName = `user_${user.id}_${year}${month}${date}_${hour}${minute}${second}${millisecond}.json`;

    const res = await this.uploadBuffer(
      Buffer.from(JSON.stringify(user)),
      `db/wal/${fileName}`,
      'application/json',
    );

    if (res) return true;
    else return false;
  }

  async uploadFile(
    file: Express.Multer.File,
    key: string,
  ): Promise<{ url: string; key: string } | null> {
    return this.uploadBuffer(file.buffer, key, file.mimetype);
  }

  async uploadBuffer(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<{ url: string; key: string } | null> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      await this.s3Client.send(command);

      const url = `${this.endpoint}/${key}`;

      return {
        url,
        key,
      };
    } catch (error) {
      this.logger.error(
        `Failed to upload object to R2 (Key: ${key}): ${error.message}`,
        error.stack,
      );

      const payload = {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '⚠️ R2 파일 업로드 실패',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*파일 키:*\n${key}`,
              },
              {
                type: 'mrkdwn',
                text: `*오류:*\n${error.message}`,
              },
            ],
          },
        ],
      };

      const slackUrl = this.configService.get('SLACK_HOOK_ALERT')!;
      fetch(slackUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
        },
      }).catch((err) => this.logger.error('Failed to send Slack alert', err));

      return null;
    }
  }
}
