import { doesSendPasswordInFlight, hasPasswordSource } from "./taint";
import { isSuccess } from "../util/Completion";
import { ProbeEntry } from "../commands/cmdProbe";

export type DetectSPAResult = {
  loginPageUrl: string;
};

export function detectSPA(probeEntry: ProbeEntry): DetectSPAResult | null {
  const found = probeEntry.find(
    ({ completion }) =>
      isSuccess(completion) &&
      (({ value: { taintReports, password } }) =>
        taintReports.some((taintReport) =>
          doesSendPasswordInFlight(taintReport, password)
        ))(completion)
  );

  if (!found) return null;

  const { loginPageUrl } = found;
  return { loginPageUrl };
}
