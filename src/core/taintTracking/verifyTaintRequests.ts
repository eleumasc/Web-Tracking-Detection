import { Link } from "./StorageTaint";
import { TaintRequest } from "./TaintRequest";

export function verifyTaintRequests(requests: TaintRequest[]) {
  const confirmedRequests: TaintRequest[] = [];
  const unknownRequests: TaintRequest[] = [];

  for (const request of requests) {
    if (request.storageTaints.some(({ links }) => hasSequentialRun(links))) {
      confirmedRequests.push(request);
    } else {
      unknownRequests.push(request);
    }
  }

  return {
    confirmedRequests,
    unknownRequests,
  };
}

export function hasSequentialRun(
  links: Link[],
  minLength: number = 8,
): boolean {
  if (links.length < minLength) {
    return false;
  }

  let runStart = 0;

  for (let i = 1; i < links.length; i++) {
    const [prevA, prevB] = links[i - 1];
    const [currA, currB] = links[i];

    const continues = currA === prevA + 1 && currB === prevB + 1;

    if (!continues) {
      runStart = i; // reset run
      continue;
    }

    if (i - runStart + 1 >= minLength) {
      return true;
    }
  }

  return false;
}
