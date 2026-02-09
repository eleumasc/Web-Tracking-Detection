export interface Request {
  requestId: string;
  url: string;
}

export function toAbstractRequest({ requestId, url }: Request): Request {
  return { requestId, url };
}

export function toAbstractRequests(requests: Request[]): Request[] {
  return requests.map((request) => toAbstractRequest(request));
}
