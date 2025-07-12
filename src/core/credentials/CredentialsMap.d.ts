import { Credentials } from "./Credentials";

export type CredentialsMap = CredentialsMapEntry[];

export type CredentialsMapEntry = {
  url: string;
  credentials: Credentials;
};
