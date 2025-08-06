import { Credential } from "./Credential";

export interface CredentialProvider {
  get(givenUrl: string): Promise<Credential[]>;
}
