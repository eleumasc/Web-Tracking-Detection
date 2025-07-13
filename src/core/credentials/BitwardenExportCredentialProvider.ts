import assert from "assert";
import { Credentials } from "./Credentials";
import { CredentialsMap } from "./CredentialsMap";
import { CredentialsProvider } from "./CredentialsProvider";
import { isSameSite } from "../../util/site";
import { readFileSync } from "fs";

export default class BitwardenExportCredentialsProvider
  implements CredentialsProvider
{
  constructor(readonly credentialsMap: CredentialsMap) {}

  get(givenUrl: string): Credentials[] {
    return this.credentialsMap
      .filter(({ url }) => isSameSite(url, givenUrl))
      .map(({ credentials }) => credentials);
  }

  static fromFile(file: string) {
    const data = JSON.parse(readFileSync(file, "utf8"));

    assert(data.encrypted === false);
    const credentialsMap: CredentialsMap = (data.items as any[])
      .filter((item) => item.type === 1)
      .flatMap((item): CredentialsMap => {
        const { login } = item;
        const credentials: Credentials = {
          username: login.username,
          password: login.password,
        };
        return (login.uris as any[])
          .map((uriEntry) => uriEntry.uri)
          .map((url) => ({ url, credentials }));
      });

    return new BitwardenExportCredentialsProvider(credentialsMap);
  }
}
