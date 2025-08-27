import { Credential } from "./credential/Credential";

export type SiteEntry = {
  name: string;
  rank: number;
  landingPage: string;
  loginPageCandidates: string[];
  credentials?: Credential[];
};
