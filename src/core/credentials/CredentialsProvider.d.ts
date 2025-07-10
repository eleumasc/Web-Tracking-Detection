import { Credentials } from "./Credentials";

export interface CredentialsProvider {
  get(givenUrl: string): Credentials[];
}
