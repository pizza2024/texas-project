import { IsString, NotEquals } from 'class-validator';

export class SendFriendRequestDto {
  @IsString()
  @NotEquals('')
  usernameOrEmail: string;
}
