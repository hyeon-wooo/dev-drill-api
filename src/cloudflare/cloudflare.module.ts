import { Global, Module } from '@nestjs/common';
import { CloudflareService } from './cloudflare.service';

@Global()
@Module({
  providers: [CloudflareService],
  exports: [CloudflareService],
})
export class CloudflareModule {}
