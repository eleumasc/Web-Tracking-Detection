import { Credentials } from "./Credentials";
import { CredentialsMap } from "./CredentialsMap";
import { CredentialsProvider } from "./CredentialsProvider";
import { isSameSite } from "../../util/site";
import { readFileSync } from "fs";

export default class BugmenotCredentialsProvider
  implements CredentialsProvider
{
  constructor(readonly credentialsMap: CredentialsMap) {}

  get(givenUrl: string): Credentials[] {
    return this.credentialsMap
      .filter(({ url }) => isSameSite(url, givenUrl))
      .map(({ credentials }) => credentials);
  }

  static fromFile(file: string) {
    const credentialsMap = JSON.parse(readFileSync(file, "utf8"));

    return new BugmenotCredentialsProvider(credentialsMap);
  }
}
