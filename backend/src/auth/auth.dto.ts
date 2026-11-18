import {
  IsBoolean,
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
export class LoginDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  @ApiProperty()
  email: string;
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @ApiProperty({ format: "password" })
  password: string;
}
export class RegisterDto extends LoginDto {
  @IsString() @Matches(/\S/) @MaxLength(100) @ApiProperty() name: string;
  @MinLength(12) declare password: string;
}
export class UserAccessDto {
  @IsBoolean() @ApiProperty() active: boolean;
}
