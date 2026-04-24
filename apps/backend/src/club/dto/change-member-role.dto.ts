import { IsString, IsIn } from 'class-validator';
import { MemberRole } from '../entity/member-role.enum';

export class ChangeMemberRoleDto {
  @IsString()
  @IsIn([MemberRole.ADMIN, MemberRole.MEMBER])
  role: MemberRole;
}
