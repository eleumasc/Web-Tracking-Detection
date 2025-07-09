import openDocumentStore from "../core/openDocumentStore";
import { Document } from "../util/DocumentStore";
import { FAKE_PASSWORD } from "../data/credentials";
import { hasPasswordSource } from "../core/taint";
import { isFailure, Success } from "../util/Completion";
import { PROBE_COLLECTION_TYPE, ProbeEntry } from "../commands/cmdProbe";
import { TaintReport } from "../core/foxhound";

(async () => {
  const srcStore = openDocumentStore();
  const dstStore = openDocumentStore("login-taint-analysis.new.sqlite");

  const dstCollection = dstStore.createCollection(1, "1751731123025", {
    type: PROBE_COLLECTION_TYPE,
  });

  for (const srcDocument of srcStore.getDocumentsByCollection(3)) {
    const dstDocument: Document = {
      ...srcDocument,
      collectionId: dstCollection.id,
    };

    const srcData = srcStore.getDocumentData(srcDocument.id);
    const dstData = transformData(srcData);

    dstStore.importDocument(dstDocument, dstData);
  }
})();

function transformData(srcData: any): ProbeEntry {
  const password = FAKE_PASSWORD;

  return (srcData as any[]).map((item) => ({
    loginPageUrl: item.loginPageUrl as string,
    completion: ((_completion) => {
      if (isFailure(_completion)) return _completion;
      const {
        value: { taintReports: _taintReports },
      } = _completion;
      return Success({
        password,
        taintReports: (_taintReports as TaintReport[]).filter((taintReport) =>
          hasPasswordSource(taintReport.taint, password)
        ),
      });
    })(item.simulateLoginCompletion),
  }));
}
