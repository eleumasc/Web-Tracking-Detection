import assert from "assert";
import { Credentials } from "./Credentials";
import { CredentialsProvider } from "./CredentialsProvider";
import { isSameSite } from "../../util/site";
import { readFileSync } from "fs";

type _CredentialsMap = { url: string; credentials: Credentials }[];

export default class BitwardenExportCredentialsProvider
  implements CredentialsProvider
{
  constructor(readonly credentialsMap: _CredentialsMap) {}

  get(givenUrl: string): Credentials[] {
    return this.credentialsMap
      .filter(({ url }) => matchUrl(url, givenUrl))
      .map(({ credentials }) => credentials);
  }

  static fromFile(file: string) {
    const data = JSON.parse(readFileSync(file, "utf8"));

    assert(data.encrypted === false);
    const credentialsMap: _CredentialsMap = (data.items as any[])
      .filter((item) => item.type === 1)
      .flatMap((item): _CredentialsMap => {
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

function matchUrl(url: string, givenUrl: string): boolean {
  return isSameSite(url, givenUrl);
}
