import { Module } from '@nestjs/common';
import { AccountDirectory } from './account-directory';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { TokenIssuer } from './token-issuer';
import { TokenVerifier } from './token-verifier';

@Module({
  controllers: [AuthController],
  providers: [TokenVerifier, TokenIssuer, AccountDirectory, AuthService, JwtAuthGuard, RolesGuard],
  exports: [TokenVerifier, JwtAuthGuard, RolesGuard, AccountDirectory],
})
export class AuthModule {}
