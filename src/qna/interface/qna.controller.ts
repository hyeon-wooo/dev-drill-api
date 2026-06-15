import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { QnaService } from '../app/qna.service';
import { FindManyOptions, FindOptionsWhere, Like } from 'typeorm';
import { QnaEntity } from '../infra/qna.entity';
import { sendFailRes, sendSuccessRes } from 'src/common/generateResponse';
import { Roles } from 'src/auth/role/role.decorator';
import { ERole } from 'src/auth/role/role.enum';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { RolesGuard } from 'src/auth/role/role.guard';
import { Request } from 'express';
import { ListQueryDto } from 'src/common/default.dto';
import { QnaAnswerBodyDto, QnaCreateBodyDto } from './qna.dto';
import { PushService } from 'src/notification/app/push.service';
import { ConfigService } from '@nestjs/config';

@Controller('qna')
export class QnaController {
  constructor(
    private readonly service: QnaService,
    // private notificationService: NotificationService,
    private readonly pushService: PushService,
    private readonly configService: ConfigService,
  ) {}

  @Get('/')
  async getList(@Query() query: ListQueryDto & { withAnswer?: 'y' | 'n' }) {
    const from = Number(query.from) || 0;
    const limit = Number(query.limit) || 20;

    const condition: FindOptionsWhere<QnaEntity> = {};
    if (query.searchKeyword) condition.title = Like(`%${query.searchKeyword}%`);
    const options: FindManyOptions<QnaEntity> = {
      where: condition,
      skip: from,
      take: limit,
      select: query.withAnswer !== 'y' ? { answer: false } : undefined,
      relations: { user: true },
      order: { createdAt: 'DESC' },
    };
    const qnas = await this.service.findMany(options);

    let totalCount: number | undefined;
    if (query.needTotalCount === 'y')
      totalCount = await this.service.count(condition);

    return sendSuccessRes({
      list: qnas,
      totalCount,
    });
  }

  @Get('/my')
  @Roles(ERole.USR)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getMyList(@Req() { user }: Request) {
    if (!user) return sendFailRes('비정상적인 접근입니다.');

    const qnas = await this.service.findMany({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
    });
    return sendSuccessRes({ list: qnas });
  }

  @Get('/:id')
  async get(@Param('id') idStr: string) {
    const id = Number(idStr);
    const found = await this.service.findOne({ id }, { user: true });

    return sendSuccessRes({ qna: found });
  }

  @Post('/')
  @Roles(ERole.USR)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async create(@Body() body: QnaCreateBodyDto, @Req() { user }: Request) {
    if (!user) return sendFailRes('비정상적인 접근입니다.');
    const created = await this.service.create({ ...body, userId: user.id });

    const payload = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📌 새로운 문의가 등록되었습니다',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*문의 제목:*\n${body.title}`,
            },
            {
              type: 'mrkdwn',
              text: `*등록 일시:*\n${new Date().toLocaleString()}`,
            },
          ],
        },
        {
          type: 'divider',
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '관리자 페이지에서 상세 내용을 확인하세요.',
            },
          ],
        },
      ],
    };
    fetch(this.configService.get('SLACK_HOOK_QNA')!, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return sendSuccessRes({ id: created[0].id });
  }

  @Post('/:id/answer')
  @Roles(ERole.ADM)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async answer(@Param('id') idStr: string, @Body() body: QnaAnswerBodyDto) {
    const id = Number(idStr);
    const qna = await this.service.findOne({ id }, { user: true });
    if (!qna) return sendFailRes('존재하지 않는 Q&A입니다.');

    await this.service.update(
      { id: Number(idStr) },
      { answer: body.answer, answerAt: new Date() },
    );

    // 사용자에게 푸시알림
    if (qna.user.fcm)
      this.pushService.sendToDevice(
        qna.user.fcm,
        '남겨주신 문의에 대한 답변이 등록되었습니다.',
      );

    return sendSuccessRes(true);
  }

  @Delete('/:id')
  @Roles(ERole.ADM)
  @UseGuards(
    JwtAuthGuard,
    // RolesGuard
  )
  async delete(@Param('id') idStr: string) {
    await this.service.deleteMany([Number(idStr)]);

    return sendSuccessRes(true);
  }
}
