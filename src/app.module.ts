import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DBConfigService } from './config/DBConfigService';
import { UserModule } from './user/user.module';
import { QuestionModule } from './question/question.module';
import { CategoryModule } from './category/category.module';
import { NotificationModule } from './notification/notification.module';
import { AdModule } from './ad/ad.module';
import { ShopModule } from './shop/shop.module';
import { FileModule } from './file/file.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AdminModule } from './admin/admin.module';
import * as dotenv from 'dotenv';
import { ExamModule } from './exam/exam.module';
import { PracticeModule } from './practice/practice.module';
import { QnaModule } from './qna/qna.module';
import { NoticeModule } from './notice/notice.module';
import { LogModule } from './log/log.module';
import { LoggerModule } from 'nestjs-pino';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { UserContextInterceptor } from './common/user-context.interceptor';
import { CommandModule } from './command/command.module';
import { RedisModule } from './redis/redis.module';
import { TechModule } from './tech/tech.module';
import { QuizModule } from './quiz/quiz.module';
import { CloudflareModule } from './cloudflare/cloudflare.module';

dotenv.config();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: process.env.FILE_PUBLIC_STORAGE,
      serveRoot: '/public',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useClass: DBConfigService,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: { colorize: true, singleLine: false },
              }
            : undefined,
        customSuccessMessage: (req, res) => {
          return `${res.statusCode} ${req.method} ${req.url} (${req.headers['x-session-id'] || 'no-session'})`;
        },
      },
    }),
    UserModule,
    QuestionModule,
    CategoryModule,
    NotificationModule,
    AdModule,
    ShopModule,
    FileModule,
    AdminModule,
    ExamModule,
    PracticeModule,
    QnaModule,
    NoticeModule,
    LogModule,
    CommandModule,
    RedisModule,
    TechModule,
    QuizModule,
    CloudflareModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: UserContextInterceptor },
  ],
})
export class AppModule {}
