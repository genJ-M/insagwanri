import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

export interface SocialUser {
  provider: 'google' | 'kakao';
  providerAccountId: string;
  email: string;
  name: string;
  profileImageUrl: string | null;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID', ''),
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET', ''),
      callbackURL: config.get<string>('GOOGLE_CALLBACK_URL', 'http://localhost:3001/api/v1/auth/google/callback'),
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('Google 계정에서 이메일을 가져올 수 없습니다.'), undefined);
      return;
    }

    const socialUser: SocialUser = {
      provider: 'google',
      providerAccountId: profile.id,
      email,
      name: profile.displayName ?? email.split('@')[0],
      profileImageUrl: profile.photos?.[0]?.value ?? null,
    };

    done(null, socialUser);
  }
}
