import _ from "lodash";
import assert from "assert";
import { Credential } from "./Credential";
import { CredentialProvider } from "./CredentialProvider";
import { getSiteByUrl } from "../../util/site";
import { isEmail } from "../../util/email";
import { JSDOM } from "jsdom";

export default class BugmenotCredentialProvider implements CredentialProvider {
  protected cacheMap: Map<string, Credential[]> | undefined;

  constructor(cacheEnabled: boolean = true) {
    this.cacheMap = cacheEnabled ? new Map() : undefined;
  }

  async get(givenUrl: string): Promise<Credential[]> {
    const site = getSiteByUrl(givenUrl);

    const cacheValue = this.cacheMap?.get(site);
    if (cacheValue) {
      return cacheValue;
    }

    const fetchValue = await fetchCredentials(site);
    this.cacheMap?.set(site, fetchValue);
    return fetchValue;
  }
}

async function fetchCredentials(site: string): Promise<Credential[]> {
  const response = await fetch(`https://bugmenot.com/view/${site}`);
  assert(
    response.status === 200,
    `Cannot fetch credential candidates from BugMeNot (status ${response.status})`
  );
  const html = await response.text();
  const dom = new JSDOM(html);
  const credentials = [
    ...dom.window.document.querySelectorAll("#content article"),
  ].map((e): Credential => {
    const [username, password] = [...e.querySelectorAll("kbd")]
      .slice(0, 2)
      .map((f) => f.textContent) as [string, string];
    return { username, password };
  });

  // Sort credentials in reverse order (most recent first), and prioritize those where the username is an email address.
  const sortedCredentials = _.sortBy(
    _.reverse([...credentials]),
    (credential) => (isEmail(credential.username) ? 0 : 1)
  );

  return sortedCredentials;
}
