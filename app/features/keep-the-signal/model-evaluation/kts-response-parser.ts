import {
  parseResponse,
  type ParsedResponse,
  type RawResponseEnvelope,
} from "../../intelligence-harness/model-evaluation";

export function parseKtsResponse(response: RawResponseEnvelope): ParsedResponse {
  return parseResponse(response, {
    unicodeForm: "NFC",
    removeSingleCodeFence: true,
    trimSurroundingWhitespace: true,
  });
}
