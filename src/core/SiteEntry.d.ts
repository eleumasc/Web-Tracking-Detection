import { Credential } from "./credential/Credential";

export type SiteEntry = {
  name: string;
  rank: number;
  loginPageCandidates: string[];
  credentials: Credential[];
};
