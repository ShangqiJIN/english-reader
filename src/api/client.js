const apiBaseUrl = "";

export function isRemoteApiConfigured() {
  return Boolean(apiBaseUrl);
}

export async function lookupVocabulary(_request, _signal) {
  throw new Error("Remote vocabulary API is not configured.");
}

export async function analyzeSentence(_request, _onEvent, _signal) {
  throw new Error("Remote sentence API is not configured.");
}
