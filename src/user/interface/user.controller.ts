import { Body, Controller, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { UserService } from '../app/user.service';
import { LoginBodyDto, RegisterFcmBodyDto, SignupBodyDto } from './user.dto';
import { sendFailRes, sendSuccessRes } from 'src/common/generateResponse';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { Request } from 'express';
import { FcmHistoryService } from '../app/fcm-history.service';
import { ClientIp } from 'src/common/client-ip.decorator';
import { Not } from 'typeorm';
import { LogService } from 'src/log/app/log.service';
import { SessionId } from 'src/log/app/session-id.decorator';
import { ETopic } from 'src/command/domain/command.enum';

@Controller('user')
export class UserController {
  constructor(
    private readonly service: UserService,
    private readonly fcmHistoryService: FcmHistoryService,
    private readonly logService: LogService,
  ) {}

  @Post('/signup')
  async signup(@Body() body: SignupBodyDto) {
    const result = await this.service.signup(body);
    if (result === -1) return sendFailRes('이미 가입된 이메일입니다.');
    if (result === -2) return sendFailRes('이미 가입된 이름입니다.');

    return sendSuccessRes(null);
  }

  @Post('/login')
  async login(
    @Body() body: LoginBodyDto,
    @ClientIp() ip: string,
    @SessionId() sessionId: string,
  ) {
    const result = await this.service.login(body, ip, sessionId);
    if (result === -1) return sendFailRes('일치하는 계정 정보가 없습니다.');

    return sendSuccessRes(result);
  }

  @Post('/refresh-access-token')
  async refreshAccessToken(
    @Body() body: { refreshToken: string; deviceId: string },
    @ClientIp() ip: string,
  ) {
    const result = await this.service.renewRefreshToken(
      body.refreshToken,
      ip,
      body.deviceId,
    );
    return sendSuccessRes(result);
  }

  @Patch('/password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Body()
    body: { prevPassword: string; password: string; passwordConfirm: string },
    @Req() { user }: Request,
  ) {
    if (!user) return sendFailRes('인증 정보가 올바르지 않습니다.');

    const result = await this.service.changePassword(user.id, body);
    if (result === -1) return sendFailRes('비정상적인 접근입니다.');
    if (result === 1)
      return sendFailRes('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
    if (result === 2) return sendFailRes('현재 비밀번호가 일치하지 않습니다.');

    return sendSuccessRes(true);
  }

  /** @deprecated */
  @Patch('/topic')
  @UseGuards(JwtAuthGuard)
  async changeTopic(
    @Body()
    body: { topic: ETopic },
    @Req() { user }: Request,
  ) {
    if (!user) return sendFailRes('인증 정보가 올바르지 않습니다.');

    await this.service.updateUser(
      { id: user.id },
      { interestTopic: body.topic, interestTechId: 1 },
    );

    return sendSuccessRes(true);
  }
  @Patch('/tech')
  @UseGuards(JwtAuthGuard)
  async changeTech(
    @Body() body: { techId: number },
    @Req() { user }: Request,
    @SessionId() sessionId: string,
  ) {
    if (!user) return sendFailRes('인증 정보가 올바르지 않습니다.');

    await this.service.updateUser(
      { id: user.id },
      { interestTechId: body.techId },
    );
    this.logService.createTechLog({
      techId: body.techId,
      userId: user.id,
      sessionId: sessionId,
      changedAt: new Date(),
    });

    return sendSuccessRes(true);
  }

  @Post('/fcm')
  @UseGuards(JwtAuthGuard)
  async registerFcm(
    @Body() body: RegisterFcmBodyDto,
    @Req() { user }: Request,
  ) {
    if (!user) return sendFailRes('인증 정보가 올바르지 않습니다.');

    this.fcmHistoryService.create({
      userId: user.id,
      fcm: body.fcm,
      deviceId: body.deviceId,
      deviceModel: body.deviceModel,
      deviceOsVersion: body.deviceOsVersion,
      deviceOs: body.deviceOs,
      appVersion: body.appVersion,
    });

    await this.service.updateUser({ id: user.id }, { fcm: body.fcm });

    return sendSuccessRes(null);
  }

  @Post('/logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() { user }: Request) {
    // TODO: 구현 필요

    return sendSuccessRes(null);
  }

  @Post('/leave')
  @UseGuards(JwtAuthGuard)
  async leave(@Req() { user }: Request) {
    if (!user) return sendSuccessRes(null);

    await this.service.deleteMany([user.id]);

    return sendSuccessRes(null);
  }
}
